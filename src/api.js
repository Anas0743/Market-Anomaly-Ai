import http from "node:http";
import { timingSafeEqual, randomUUID } from "node:crypto";
import { pathToFileURL, URL } from "node:url";

import { getConfig } from "./config.js";
import { AnomalyEngine } from "./engine.js";
import { iphoneDemoListing } from "./demoData.js";
import { loadMarketHistory } from "./historyStore.js";
import { validateBatchInput, validateListingInput, ValidationError } from "./validation.js";

export function createServer(options = {}) {
  if (typeof options?.validate === "function") {
    options = { engine: options };
  }

  const config = options.config ?? getConfig();
  const startedAt = new Date().toISOString();
  const historyState = options.historyState ?? (options.engine ? null : loadMarketHistory(config.marketDataFile));
  const engine =
    options.engine ?? new AnomalyEngine(historyState.listings, { minCohortSize: config.minCohortSize });
  const historyMeta =
    historyState ?? {
      source: "custom-engine",
      loadedAt: startedAt,
      count: getMarketSummary(engine).listingCount ?? null
    };

  return http.createServer(async (request, response) => {
    const requestId = headerValue(request.headers["x-request-id"]) || randomUUID();

    try {
      response.setHeader("X-Request-Id", requestId);
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      response.setHeader("Access-Control-Allow-Origin", config.corsOrigin);
      response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
      response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key, X-Request-Id");

      if (request.method === "OPTIONS") {
        response.writeHead(204);
        response.end();
        return;
      }

      const url = new URL(request.url, `http://${request.headers.host ?? "localhost"}`);

      if (requiresApiKey(url) && !isAuthorized(request, config.apiKey)) {
        throw new ApiError(401, "unauthorized", "A valid API key is required.");
      }

      if (request.method === "GET" && url.pathname === "/") {
        writeHtml(response, 200, rootConsoleHtml());
        return;
      }

      if (request.method === "GET" && url.pathname === "/health") {
        writeJson(response, 200, {
          status: "ok",
          service: "market-anomaly-ai",
          startedAt
        });
        return;
      }

      if (request.method === "GET" && url.pathname === "/ready") {
        writeJson(response, 200, {
          status: "ready",
          service: "market-anomaly-ai",
          modelVersion: getModelVersion(engine),
          history: historyMeta,
          apiKeyRequired: Boolean(config.apiKey)
        });
        return;
      }

      if (request.method === "GET" && url.pathname === "/openapi.json") {
        writeJson(response, 200, openApiSpec(config));
        return;
      }

      if (request.method === "GET" && url.pathname === "/v1/market-summary") {
        writeJson(response, 200, {
          ...getMarketSummary(engine),
          history: historyMeta
        });
        return;
      }

      if (request.method === "GET" && url.pathname === "/v1/categories") {
        writeJson(response, 200, {
          categories: getMarketSummary(engine).categories
        });
        return;
      }

      if (request.method === "GET" && url.pathname === "/v1/demo/iphone-13") {
        const price = Number(url.searchParams.get("price_jod") ?? 700);
        writeJson(response, 200, engine.validate(iphoneDemoListing(price)));
        return;
      }

      if (request.method === "POST" && url.pathname === "/v1/validate") {
        const body = await readJson(request, config.requestMaxBytes);
        const listing = validateListingInput(body);
        writeJson(response, 200, engine.validate(listing));
        return;
      }

      if (request.method === "POST" && url.pathname === "/v1/validate/batch") {
        const body = await readJson(request, config.requestMaxBytes);
        const listings = validateBatchInput(body, config.batchLimit);
        writeJson(response, 200, {
          count: listings.length,
          modelVersion: getModelVersion(engine),
          results: listings.map((listing) => engine.validate(listing))
        });
        return;
      }

      writeJson(response, 404, { error: "not_found" });
    } catch (error) {
      writeError(response, error, requestId);
    }
  });
}

if (isDirectRun()) {
  const config = getConfig();
  createServer({ config }).listen(config.port, () => {
    console.log(`Market Anomaly AI API listening on http://localhost:${config.port}`);
  });
}

function isDirectRun() {
  return process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
}

function writeJson(response, statusCode, payload) {
  response.writeHead(statusCode);
  response.end(JSON.stringify(payload, null, 2));
}

function writeHtml(response, statusCode, html) {
  response.writeHead(statusCode, { "Content-Type": "text/html; charset=utf-8" });
  response.end(html);
}

class ApiError extends Error {
  constructor(statusCode, code, message, details = []) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

function readJson(request, maxBytes) {
  return new Promise((resolve, reject) => {
    let raw = "";
    let rejected = false;
    request.on("data", (chunk) => {
      if (rejected) return;
      raw += chunk;
      if (Buffer.byteLength(raw) > maxBytes) {
        rejected = true;
        reject(new ApiError(413, "request_too_large", "Request body is too large."));
        request.destroy();
      }
    });
    request.on("end", () => {
      if (rejected) return;
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new ApiError(400, "invalid_json", "Invalid JSON body."));
      }
    });
    request.on("error", reject);
  });
}

function writeError(response, error, requestId) {
  const isKnown = error instanceof ApiError || error instanceof ValidationError;
  const statusCode = isKnown ? error.statusCode : 500;
  const payload = {
    error: isKnown ? error.code : "internal_error",
    message: isKnown ? error.message : "Unexpected server error.",
    requestId
  };

  if (isKnown && error.details?.length) {
    payload.details = error.details;
  }

  writeJson(response, statusCode, payload);
}

function requiresApiKey(url) {
  return url.pathname.startsWith("/v1/");
}

function isAuthorized(request, apiKey) {
  if (!apiKey) return true;
  const apiKeyHeader = headerValue(request.headers["x-api-key"]);
  const authHeader = headerValue(request.headers.authorization);
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
  return safeEqual(apiKeyHeader, apiKey) || safeEqual(bearerToken, apiKey);
}

function safeEqual(received, expected) {
  if (!received || !expected) return false;
  const receivedBuffer = Buffer.from(String(received));
  const expectedBuffer = Buffer.from(String(expected));
  if (receivedBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(receivedBuffer, expectedBuffer);
}

function headerValue(value) {
  if (Array.isArray(value)) return value[0];
  return value ?? null;
}

function getMarketSummary(engine) {
  if (typeof engine.marketSummary === "function") return engine.marketSummary();
  return {
    modelVersion: getModelVersion(engine),
    listingCount: null,
    categories: [],
    currencies: [],
    topCities: []
  };
}

function getModelVersion(engine) {
  return engine.modelVersion ?? "custom";
}

function openApiSpec(config) {
  const security = config.apiKey ? [{ ApiKeyAuth: [] }] : [];
  return {
    openapi: "3.0.3",
    info: {
      title: "Market Anomaly AI API",
      version: "0.2.0"
    },
    paths: {
      "/health": { get: { summary: "Liveness check" } },
      "/ready": { get: { summary: "Readiness and loaded market data metadata" } },
      "/v1/validate": {
        post: {
          summary: "Validate a single marketplace listing",
          security,
          responses: {
            200: { description: "Validation result" },
            422: { description: "Invalid listing input" }
          }
        }
      },
      "/v1/validate/batch": {
        post: {
          summary: "Validate multiple marketplace listings",
          security,
          responses: {
            200: { description: "Batch validation results" },
            422: { description: "Invalid batch input" }
          }
        }
      },
      "/v1/market-summary": {
        get: {
          summary: "Loaded market data summary",
          security
        }
      }
    },
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: "apiKey",
          in: "header",
          name: "X-API-Key"
        }
      }
    }
  };
}

function rootConsoleHtml() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Market Anomaly AI</title>
  <style>
    :root {
      color-scheme: light;
      --ink: #14213d;
      --muted: #536173;
      --line: #d9e1ea;
      --surface: #f7f9fb;
      --accent: #0f766e;
      --warn: #b45309;
      --ok: #15803d;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: Inter, Segoe UI, Arial, sans-serif;
      color: var(--ink);
      background: var(--surface);
    }
    main {
      width: min(980px, calc(100% - 32px));
      margin: 0 auto;
      padding: 40px 0;
    }
    header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 24px;
      margin-bottom: 24px;
    }
    h1 {
      margin: 0 0 8px;
      font-size: clamp(30px, 4vw, 48px);
      line-height: 1.05;
      letter-spacing: 0;
    }
    p { margin: 0; color: var(--muted); line-height: 1.55; }
    .status {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border: 1px solid #b7dfc2;
      border-radius: 8px;
      color: var(--ok);
      background: #effaf2;
      font-weight: 700;
      white-space: nowrap;
    }
    .dot {
      width: 10px;
      height: 10px;
      border-radius: 999px;
      background: var(--ok);
    }
    .grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(280px, 380px);
      gap: 18px;
      align-items: start;
    }
    section {
      border: 1px solid var(--line);
      border-radius: 8px;
      background: white;
      padding: 20px;
    }
    h2 {
      margin: 0 0 14px;
      font-size: 18px;
      letter-spacing: 0;
    }
    label {
      display: block;
      margin-bottom: 8px;
      color: var(--muted);
      font-size: 13px;
      font-weight: 700;
    }
    input {
      width: 100%;
      height: 42px;
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 0 12px;
      font: inherit;
    }
    button {
      height: 42px;
      margin-top: 12px;
      border: 0;
      border-radius: 6px;
      padding: 0 16px;
      color: white;
      background: var(--accent);
      font: inherit;
      font-weight: 800;
      cursor: pointer;
    }
    pre {
      min-height: 280px;
      margin: 0;
      overflow: auto;
      border: 1px solid #cfd8e3;
      border-radius: 8px;
      padding: 16px;
      color: #d9f99d;
      background: #111827;
      font-size: 13px;
      line-height: 1.45;
    }
    .metric {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 12px;
      padding: 12px 0;
      border-bottom: 1px solid var(--line);
    }
    .metric:last-child { border-bottom: 0; }
    .metric strong { color: var(--ink); }
    .warn { color: var(--warn); font-weight: 800; }
    code {
      padding: 2px 5px;
      border-radius: 4px;
      background: #eef2f7;
    }
    @media (max-width: 760px) {
      header, .grid { grid-template-columns: 1fr; display: grid; }
      .status { justify-self: start; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>Market Anomaly AI</h1>
        <p>Intelligent Price Validation Engine running locally on <code>localhost:3000</code>.</p>
      </div>
      <div class="status"><span class="dot"></span>API Online</div>
    </header>

    <div class="grid">
      <section>
        <h2>Live Demo</h2>
        <label for="price">iPhone 13 128GB used price in JOD</label>
        <input id="price" type="number" min="1" step="1" value="700">
        <button id="run">Validate Price</button>
        <div class="metric"><span>Endpoint</span><strong>/v1/demo/iphone-13</strong></div>
        <div class="metric"><span>Health Check</span><strong>/health</strong></div>
      </section>

      <section>
        <h2>Current Result</h2>
        <div class="metric"><span>Classification</span><strong id="classification">Loading</strong></div>
        <div class="metric"><span>Confidence</span><strong id="confidence">-</strong></div>
        <div class="metric"><span>Risk</span><strong id="risk">-</strong></div>
        <div class="metric"><span>Expected Range</span><strong id="range">-</strong></div>
      </section>
    </div>

    <section style="margin-top: 18px;">
      <h2>Raw API Response</h2>
      <pre id="output">Loading...</pre>
    </section>
  </main>

  <script>
    async function runDemo() {
      const price = document.getElementById("price").value || 700;
      const response = await fetch("/v1/demo/iphone-13?price_jod=" + encodeURIComponent(price));
      const data = await response.json();
      document.getElementById("classification").textContent = data.classification;
      document.getElementById("classification").className = data.classification === "overpriced" ? "warn" : "";
      document.getElementById("confidence").textContent = data.confidence + "%";
      document.getElementById("risk").textContent = data.risk.level + " (" + data.risk.score + "/100)";
      document.getElementById("range").textContent = data.normalRange.low + "-" + data.normalRange.high + " " + data.currency;
      document.getElementById("output").textContent = JSON.stringify(data, null, 2);
    }

    document.getElementById("run").addEventListener("click", runDemo);
    runDemo();
  </script>
</body>
</html>`;
}
