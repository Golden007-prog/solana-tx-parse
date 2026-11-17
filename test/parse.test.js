// Offline tests against real mainnet transactions captured into test/fixtures (provenance in VERIFY.md).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { parseFetchedTransaction, parseTransaction, formatSummary, formatUnits, PROGRAM_LABELS, WSOL_MINT, SOL } from "../src/index.js";
import { b58decode } from "../src/base58.js";

const load = (name) => JSON.parse(fs.readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), "utf8"));
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

test("plain SOL transfer: fee, default compute limit, one transfer, no swap", () => {
  const p = parseFetchedTransaction(load("sol-transfer"));
  assert.equal(p.signature, "4pLRvkZ9zuBUDNHnGUtHYi7f9Qm1Wwaod6H2gCutzsxUx1td6n1x292aDZ65HiYX7kD64VC9ZPeayJKVsk4qU3bo");
  assert.equal(p.status, "success");
  assert.equal(p.error, null);
  assert.equal(p.version, "legacy");
  assert.equal(p.slot, 470678583);
  assert.equal(p.time, "2026-11-17T21:07:45.000Z");
  assert.equal(p.feePayer, "H8sMJSCQxfKiFTCfDR3DUMLPwcRbM61LGFJ8N4dK3WjS");
  assert.deepEqual([p.fee.lamports, p.fee.baseLamports, p.fee.priorityLamports], [8000, 5000, 3000]);
  // No SetComputeUnitLimit: two builtin instructions (System, Compute Budget) at 3,000 each.
  assert.equal(p.computeUnits.limit, 6000);
  assert.equal(p.computeUnits.limitSource, "default");
  assert.equal(p.computeUnits.priceMicroLamports, 500000);
  assert.equal(p.fee.priorityLamportsDeclared, p.fee.priorityLamports, "500,000 micro-lamports × 6,000 CU = 3,000 lamports, as charged");
  assert.deepEqual(p.programs.map((x) => x.label), ["System Program", "Compute Budget"]);
  assert.equal(p.transfers.length, 1);
  const t = p.transfers[0];
  assert.deepEqual([t.kind, t.from, t.mint, t.amount, t.raw, t.inner], ["sol", p.feePayer, SOL, 0.275545307, "275545307", false]);
  const payer = p.solChanges.find((c) => c.owner === p.feePayer);
  assert.equal(payer.changeRaw, String(-(275545307 + 8000)), "the payer's change includes the fee");
  assert.equal(payer.isFeePayer, true);
  assert.deepEqual(p.swaps, []);
  assert.deepEqual(p.tokenChanges, []);
});

test("SPL transfer: transferChecked decoded, token changes grouped by owner and mint", () => {
  const p = parseFetchedTransaction(load("spl-transfer"));
  assert.equal(p.computeUnits.limit, 203000, "Token (200,000) + Compute Budget (3,000); the logs say 'of 203000'");
  assert.equal(p.fee.priorityLamports, 101500);
  assert.equal(p.fee.priorityLamportsDeclared, 101500);
  assert.equal(p.transfers.length, 1);
  const t = p.transfers[0];
  assert.deepEqual([t.kind, t.mint, t.decimals, t.amount, t.raw], ["token", USDC, 6, 37.742077, "37742077"]);
  assert.equal(t.fromOwner, "H8sMJSCQxfKiFTCfDR3DUMLPwcRbM61LGFJ8N4dK3WjS");
  assert.equal(t.toOwner, "3vKWT4RcdQUx63gfU6dyTGf1fDpoJrQ8PSuHUbF2AxbM");
  const byOwner = Object.fromEntries(p.tokenChanges.map((c) => [c.owner, c]));
  assert.equal(byOwner[t.fromOwner].changeRaw, "-37742077");
  assert.equal(byOwner[t.toOwner].change, 37.742077);
  assert.equal(byOwner[t.toOwner].pre, 0.297579);
  assert.equal(byOwner[t.toOwner].post, 38.039656);
  assert.deepEqual(p.swaps, [], "one owner down, another up: not a swap");
});

test("pump.fun buy: the signer's swap is SOL in, the coin out, via pump.fun", () => {
  const p = parseFetchedTransaction(load("pump-buy"));
  assert.equal(p.computeBudget.unitLimit, 150000);
  assert.equal(p.computeBudget.unitPriceMicroLamports, 25000);
  assert.equal(p.fee.priorityLamports, 3750);
  assert.equal(p.fee.priorityLamportsDeclared, 3750);
  assert.ok(p.programs.some((x) => x.label === "pump.fun"));
  const s = p.swaps[0];
  assert.equal(s.isSigner, true);
  assert.equal(s.owner, p.feePayer);
  assert.deepEqual([s.in.mint, s.in.raw], [SOL, "135588207"], "SOL spent, fee added back");
  assert.deepEqual([s.out.mint, s.out.amount], ["73s8b6dbxPSGVMyzhZ8HHQpdtmMC1e61HR8QHLh5vush", 3306286.203444]);
  assert.ok(s.via.includes("pump.fun"));
  assert.ok(!s.via.includes("System Program") && !s.via.includes("Compute Budget"), "plumbing programs are not listed in via");
  // The bonding curve is the other side of the same trade, and is not a signer.
  const curve = p.swaps.find((x) => !x.isSigner);
  assert.equal(curve.in.mint, s.out.mint);
  assert.equal(curve.out.mint, SOL);
  // Inner transfers are found too.
  assert.ok(p.transfers.some((t) => t.inner && t.kind === "token" && t.toOwner === p.feePayer));
});

test("failed transaction: the error in words, nothing moved but the fee", () => {
  const p = parseFetchedTransaction(load("failed"));
  assert.equal(p.status, "failed");
  assert.deepEqual(p.error.raw, { InstructionError: [2, { Custom: 6001 }] });
  assert.equal(p.error.instructionIndex, 2);
  assert.equal(p.error.customCode, 6001);
  assert.match(p.error.message, /^instruction 2 \(L2TExMFKdjpN9kozasaurPirfHy9P8sbXoAN1qA3S95\) failed: custom program error 6001 \(0x1771\)$/);
  assert.match(p.error.log, /failed: custom program error: 0x1771/);
  assert.deepEqual(p.transfers, []);
  assert.deepEqual(p.swaps, []);
  assert.deepEqual(p.solChanges.map((c) => c.changeRaw), ["-5002"], "only the fee left the payer");
  assert.equal(p.fee.priorityLamports, 2);
});

test("v1 transaction: the budget comes from transactionConfig (priority fee in lamports)", () => {
  const p = parseFetchedTransaction(load("jupiter-swap-v1"));
  assert.equal(p.version, 1);
  assert.equal(p.computeBudget.source, "transactionConfig");
  assert.equal(p.computeUnits.limit, 272511);
  assert.equal(p.computeBudget.priorityFeeLamports, 2726);
  assert.equal(p.fee.priorityLamports, 2726, "fee 7,726 = 5,000 base + 2,726 priority");
  assert.equal(p.computeUnits.consumed, 232552);
  const labels = p.programs.map((x) => x.label);
  for (const l of ["Jupiter v6", "PumpSwap AMM", "Meteora DLMM", "Raydium CLMM"]) assert.ok(labels.includes(l), l);
  const s = p.swaps.find((x) => x.isSigner);
  assert.equal(s.in.mint, "DxXJjXjS9A6QZiQUUTizCmzZrmzAUqtKGpqRQY9kpump");
  assert.equal(s.in.amount, 184615.488546);
  assert.equal(s.out.mint, SOL, "wrapped SOL that was unwrapped to the wallet counts as SOL");
  assert.equal(s.out.raw, "7984458");
  assert.ok(s.via.includes("Jupiter v6"));
});

test("a JSON-RPC envelope is unwrapped; bad input is refused", async () => {
  const tx = load("sol-transfer");
  assert.equal(parseFetchedTransaction({ jsonrpc: "2.0", id: 1, result: tx }).signature, tx.transaction.signatures[0]);
  assert.equal((await parseTransaction(tx)).signature, tx.transaction.signatures[0], "parseTransaction takes an object too");
  assert.throws(() => parseFetchedTransaction(null), { name: "InvalidInputError" });
  assert.throws(() => parseFetchedTransaction({ transaction: {} }), { name: "InvalidInputError" });
});

test("extra labels and logs on request", () => {
  const p = parseFetchedTransaction(load("failed"), { labels: { L2TExMFKdjpN9kozasaurPirfHy9P8sbXoAN1qA3S95: "Some bot" }, includeLogs: true });
  assert.match(p.error.message, /\(Some bot\)/);
  assert.ok(Array.isArray(p.logs) && p.logs.length > 0);
  assert.equal(parseFetchedTransaction(load("failed")).logs, undefined);
});

test("formatSummary renders every section", () => {
  const text = formatSummary(parseFetchedTransaction(load("pump-buy")));
  assert.match(text, /^Signature  2axWwMEc9F41/);
  assert.match(text, /Fee        0\.00000875 SOL \(8,750 lamports: base 5,000 \+ priority 3,750\)/);
  assert.match(text, /Compute    83,261 CU used of 150,000 @ 25,000 micro-lamports\/CU/);
  assert.match(text, /Swaps \(balance-delta heuristic\)\n  VzxT…87pb \(signer\)  0\.135588207 SOL → 3,306,286\.203444 73s8…vush  via pump\.fun/);
  assert.match(text, /\+ 1 counterpart leg\(s\)/);
  assert.match(formatSummary(parseFetchedTransaction(load("failed"))), /Status     FAILED: instruction 2/);
});

test("formatUnits is exact", () => {
  assert.equal(formatUnits(-5002n, 9), "-0.000005002");
  assert.equal(formatUnits("123456789", 6), "123.456789");
  assert.equal(formatUnits(1000000n, 6), "1");
  assert.equal(formatUnits(42, 0), "42");
});

test("every built-in program ID is a 32-byte address", () => {
  for (const id of Object.keys(PROGRAM_LABELS)) assert.equal(b58decode(id).length, 32, id);
  assert.equal(b58decode(WSOL_MINT).length, 32);
  assert.equal(PROGRAM_LABELS["JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4"], "Jupiter v6");
});

test("v0 with address lookup tables: loaded addresses are merged into the account keys", () => {
  const parsed = load("jupiter-swap-v0");                 // jsonParsed: the RPC already merged them (source: "lookupTable")
  const raw = load("jupiter-swap-v0.json-encoding");      // json: they are only in meta.loadedAddresses
  const loaded = raw.meta.loadedAddresses.writable.length + raw.meta.loadedAddresses.readonly.length;
  assert.equal(loaded, 37);
  assert.equal(raw.transaction.message.accountKeys.length + loaded, raw.meta.preBalances.length);

  const a = parseFetchedTransaction(parsed), b = parseFetchedTransaction(raw);
  for (const p of [a, b]) {
    assert.equal(p.version, 0);
    assert.equal(p.accounts.total, raw.meta.preBalances.length, "every balance has its address, none twice");
    assert.equal(p.accounts.fromLookupTables, 37);
    assert.equal(p.accounts.lookupTables.length, 5);
    assert.deepEqual(p.warnings, []);
  }
  // Same answer from both encodings: balances, transfers (decoded from raw instruction data in the json one), swaps.
  const strip = (p) => ({ sol: p.solChanges, tokens: p.tokenChanges, swaps: p.swaps, fee: p.fee, transfers: p.transfers.map(({ program, ...t }) => t) });
  assert.deepEqual(strip(b), strip(a));
  assert.equal(a.transfers.length, 12);
  // A loaded (lookup-table) address that received tokens is attributed correctly.
  const fromAlt = new Set(parsed.transaction.message.accountKeys.filter((k) => k.source === "lookupTable").map((k) => k.pubkey));
  assert.ok(a.transfers.some((t) => fromAlt.has(t.to) || fromAlt.has(t.from)), "some transfer touches a lookup-table account");

  // Without the merge, indexes past the static keys point nowhere: the parser says so instead of guessing.
  const broken = structuredClone(raw); delete broken.meta.loadedAddresses;
  assert.match(parseFetchedTransaction(broken).warnings[0], /do not line up/);
});

test("arbitrage through Jupiter: the heuristic reports the net, which is honest but not the route", () => {
  const p = parseFetchedTransaction(load("jupiter-swap-v0"));
  const s = p.swaps.find((x) => x.isSigner);
  // USDC → WSOL → mSOL → JitoSOL → … → USDC: the signer nets +0.001301 USDC and sent 1,000 lamports elsewhere.
  assert.deepEqual([s.out.mint, s.out.amount], [USDC, 0.001301]);
  assert.deepEqual([s.in.mint, s.in.raw], [SOL, "1000"]);
  for (const l of ["Jupiter v6", "Meteora DLMM", "Orca Whirlpool", "Raydium CLMM"]) assert.ok(s.via.includes(l), l);
  assert.equal(p.computeBudget.unitLimit, 750000);
  assert.equal(p.fee.priorityLamports, 0);
});
