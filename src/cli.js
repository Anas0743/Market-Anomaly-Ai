import fs from "node:fs";
import { parseArgs } from "node:util";

import { AnomalyEngine } from "./engine.js";
import { iphoneDemoListing } from "./demoData.js";
import { loadMarketHistory } from "./historyStore.js";
import { validateListingInput } from "./validation.js";

const { values } = parseArgs({
  options: {
    history: { type: "string" },
    listing: { type: "string" },
    price: { type: "string" }
  }
});

const history = loadMarketHistory(values.history ?? process.env.MARKET_DATA_FILE ?? null);
const engine = new AnomalyEngine(history.listings);
const listingInput = values.listing
  ? validateListingInput(JSON.parse(fs.readFileSync(values.listing, "utf8")))
  : iphoneDemoListing(Number(values.price ?? 700));
const listing = validateListingInput(listingInput);
const result = engine.validate(listing);

console.log(JSON.stringify(result, null, 2));
