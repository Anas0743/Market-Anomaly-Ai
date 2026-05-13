import fs from "node:fs";
import path from "node:path";

import { buildDemoHistory } from "./demoData.js";
import { validateListingInput, ValidationError } from "./validation.js";

export function loadMarketHistory(marketDataFile = null) {
  const loadedAt = new Date().toISOString();

  if (!marketDataFile) {
    const listings = buildDemoHistory().map((listing, index) =>
      validateListingInput(listing, { requireListingId: false, label: `demoHistory[${index}]` })
    );
    return {
      source: "built-in-demo-history",
      loadedAt,
      count: listings.length,
      listings
    };
  }

  const absolutePath = path.resolve(marketDataFile);
  const raw = fs.readFileSync(absolutePath, "utf8");
  const parsed = parseHistoryFile(raw, absolutePath);
  const listings = extractListings(parsed).map((listing, index) =>
    validateListingInput(listing, { requireListingId: false, label: `listings[${index}]` })
  );

  if (listings.length === 0) {
    throw new ValidationError("Market history must contain at least one listing", [
      { field: "listings", issue: "min_items_1" }
    ]);
  }

  return {
    source: absolutePath,
    loadedAt,
    count: listings.length,
    listings
  };
}

function parseHistoryFile(raw, filePath) {
  if (path.extname(filePath).toLowerCase() === ".jsonl") {
    return raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, index) => {
        try {
          return JSON.parse(line);
        } catch {
          throw new ValidationError(`Invalid JSONL at line ${index + 1}`, [
            { field: `line_${index + 1}`, issue: "invalid_json" }
          ]);
        }
      });
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new ValidationError("Market history file must be valid JSON", [
      { field: "file", issue: "invalid_json" }
    ]);
  }
}

function extractListings(parsed) {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === "object" && Array.isArray(parsed.listings)) return parsed.listings;
  throw new ValidationError("Market history must be a JSON array or an object with a listings array", [
    { field: "listings", issue: "must_be_array" }
  ]);
}
