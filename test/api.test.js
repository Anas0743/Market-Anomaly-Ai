import test from "node:test";
import assert from "node:assert/strict";

import { createServer } from "../src/api.js";
import { getConfig } from "../src/config.js";

test("HTTP root serves local console", async () => {
  const server = createTestServer();
  await listen(server);

  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/`);
    const payload = await response.text();

    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /text\/html/);
    assert.match(payload, /Market Anomaly AI/);
  } finally {
    await close(server);
  }
});

test("HTTP API returns demo validation", async () => {
  const server = createTestServer();
  await listen(server);

  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/v1/demo/iphone-13?price_jod=700`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.classification, "overpriced");
    assert.equal(payload.currency, "JOD");
    assert.equal(payload.risk.level, "low");
  } finally {
    await close(server);
  }
});

test("HTTP API validates posted listings", async () => {
  const server = createTestServer();
  await listen(server);

  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/v1/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        listingId: "api-normal-phone",
        category: "phone",
        title: "iPhone 13 128GB used excellent condition",
        description: "Original battery, no repairs.",
        city: "Amman",
        price: 255,
        sellerVerified: true,
        sellerAccountAgeDays: 180
      })
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.classification, "normal");
  } finally {
    await close(server);
  }
});

test("HTTP API validates batches", async () => {
  const server = createTestServer();
  await listen(server);

  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/v1/validate/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        listings: [
          {
            listingId: "api-batch-normal",
            category: "phone",
            title: "iPhone 13 128GB used excellent condition",
            description: "Original battery.",
            city: "Amman",
            price: 255,
            sellerVerified: true,
            sellerAccountAgeDays: 120
          },
          {
            listingId: "api-batch-overpriced",
            category: "phone",
            title: "iPhone 13 128GB used excellent condition",
            description: "Original battery.",
            city: "Amman",
            price: 700,
            sellerVerified: true,
            sellerAccountAgeDays: 120
          }
        ]
      })
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.count, 2);
    assert.equal(payload.results[0].classification, "normal");
    assert.equal(payload.results[1].classification, "overpriced");
  } finally {
    await close(server);
  }
});

test("HTTP API returns structured validation errors", async () => {
  const server = createTestServer();
  await listen(server);

  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/v1/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: "phone", price: -1 })
    });
    const payload = await response.json();

    assert.equal(response.status, 422);
    assert.equal(payload.error, "validation_error");
    assert.ok(Array.isArray(payload.details));
    assert.ok(response.headers.get("x-request-id"));
  } finally {
    await close(server);
  }
});

test("HTTP API exposes readiness and market summary", async () => {
  const server = createTestServer();
  await listen(server);

  try {
    const { port } = server.address();
    const readyResponse = await fetch(`http://127.0.0.1:${port}/ready`);
    const ready = await readyResponse.json();
    const summaryResponse = await fetch(`http://127.0.0.1:${port}/v1/market-summary`);
    const summary = await summaryResponse.json();

    assert.equal(readyResponse.status, 200);
    assert.equal(ready.status, "ready");
    assert.equal(ready.history.count, 42);
    assert.equal(summaryResponse.status, 200);
    assert.ok(summary.categories.some((category) => category.key === "phone"));
  } finally {
    await close(server);
  }
});

test("HTTP API key protects v1 endpoints when configured", async () => {
  const server = createTestServer({ config: { ...getConfig({}), apiKey: "secret-key" } });
  await listen(server);

  try {
    const { port } = server.address();
    const healthResponse = await fetch(`http://127.0.0.1:${port}/health`);
    const blockedResponse = await fetch(`http://127.0.0.1:${port}/v1/market-summary`);
    const allowedResponse = await fetch(`http://127.0.0.1:${port}/v1/market-summary`, {
      headers: { "X-API-Key": "secret-key" }
    });

    assert.equal(healthResponse.status, 200);
    assert.equal(blockedResponse.status, 401);
    assert.equal(allowedResponse.status, 200);
  } finally {
    await close(server);
  }
});

function createTestServer(options = {}) {
  return createServer({ config: getConfig({}), ...options });
}

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
