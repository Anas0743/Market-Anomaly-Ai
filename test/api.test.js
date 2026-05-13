import test from "node:test";
import assert from "node:assert/strict";

import { createServer } from "../src/api.js";

test("HTTP root serves local console", async () => {
  const server = createServer();
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
  const server = createServer();
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
  const server = createServer();
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
