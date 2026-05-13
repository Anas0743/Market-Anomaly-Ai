import test from "node:test";
import assert from "node:assert/strict";

import { AnomalyEngine } from "../src/engine.js";
import { buildDemoHistory, iphoneDemoListing } from "../src/demoData.js";

test("demo iPhone is overpriced", () => {
  const engine = new AnomalyEngine(buildDemoHistory());
  const result = engine.validate(iphoneDemoListing(700));

  assert.equal(result.classification, "overpriced");
  assert.ok(result.confidence >= 85);
  assert.equal(result.risk.level, "low");
  assert.ok(result.deltaVsMedianPct > 150);
});

test("normal iPhone price is normal", () => {
  const engine = new AnomalyEngine(buildDemoHistory());
  const result = engine.validate(iphoneDemoListing(255));

  assert.equal(result.classification, "normal");
  assert.ok(result.confidence >= 75);
  assert.ok(result.risk.score < 35);
});

test("underpriced suspicious listing is high risk", () => {
  const engine = new AnomalyEngine(buildDemoHistory());
  const listing = {
    ...iphoneDemoListing(95),
    sellerVerified: false,
    sellerAccountAgeDays: 2,
    description: "Urgent sale, WhatsApp only, deposit first.",
    attributes: { duplicateImageCount: 3 }
  };

  const result = engine.validate(listing);

  assert.equal(result.classification, "underpriced");
  assert.equal(result.risk.level, "high");
  assert.ok(result.risk.score >= 65);
});

test("Arabic listing attributes are inferred", () => {
  const engine = new AnomalyEngine(buildDemoHistory());
  const result = engine.validate({
    listingId: "arabic-iphone",
    category: "phone",
    title: "ايفون 13 ذاكرة 128 جيجا",
    description: "مستعمل وكالة ونظيف جدا في عمان",
    city: "Amman",
    price: 245,
    sellerVerified: true,
    sellerAccountAgeDays: 100
  });

  assert.equal(result.classification, "normal");
  assert.ok(result.confidence >= 75);
  assert.match(result.cohort.cohortKey, /exact/);
});

