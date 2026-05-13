import test from "node:test";
import assert from "node:assert/strict";

import { loadMarketHistory } from "../src/historyStore.js";

test("loads file-backed market history", () => {
  const state = loadMarketHistory("data/market-history.example.json");

  assert.equal(state.count, 12);
  assert.equal(state.listings[0].currency, "JOD");
  assert.ok(state.source.endsWith("data\\market-history.example.json") || state.source.endsWith("data/market-history.example.json"));
});
