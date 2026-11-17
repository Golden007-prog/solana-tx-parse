// Live check against mainnet. Skipped unless LIVE=1. Two getTransaction calls, one after the other.
// LIVE=1 node --test test/live.test.js
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { parseTransaction, parseFetchedTransaction } from "../src/index.js";

const live = process.env.LIVE === "1";
const load = (name) => JSON.parse(fs.readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), "utf8"));

test("a live fetch parses the same as its captured fixture", { skip: !live && "set LIVE=1 to run" }, async () => {
  for (const name of ["spl-transfer", "jupiter-swap-v1"]) {
    const fixture = load(name);
    const fromChain = await parseTransaction(fixture.transaction.signatures[0], { rpcUrl: process.env.SOLANA_RPC_URL });
    const offline = parseFetchedTransaction(fixture);
    for (const k of ["status", "fee", "solChanges", "tokenChanges", "transfers", "swaps"]) assert.deepEqual(fromChain[k], offline[k], `${name}: ${k}`);
    await new Promise((r) => setTimeout(r, 1500));
  }
});
