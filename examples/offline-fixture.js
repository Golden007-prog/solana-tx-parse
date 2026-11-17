// Parse a transaction you already have (here: a captured mainnet pump.fun buy). No network.
// node examples/offline-fixture.js
import fs from "node:fs";
import { parseTransaction, formatSummary } from "../src/index.js";

const tx = JSON.parse(fs.readFileSync(new URL("../test/fixtures/pump-buy.json", import.meta.url), "utf8"));
const p = await parseTransaction(tx);
console.log(formatSummary(p));
