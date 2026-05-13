import { AnomalyEngine } from "./engine.js";
import { buildDemoHistory, iphoneDemoListing } from "./demoData.js";

const engine = new AnomalyEngine(buildDemoHistory());
const result = engine.validate(iphoneDemoListing(700));

console.log(JSON.stringify(result, null, 2));

