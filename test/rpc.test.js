// Fetching, retries, errors and batching, with a mocked fetch: no network.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { fetchTransaction, parseTransaction, parseTransactions, isSignature, RpcError, RpcTimeoutError, TransactionNotFoundError, InvalidInputError } from "../src/index.js";

const load = (name) => JSON.parse(fs.readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), "utf8"));
const FIXTURES = ["sol-transfer", "spl-transfer", "pump-buy", "failed", "jupiter-swap-v1"].map(load);
const bySig = new Map(FIXTURES.map((t) => [t.transaction.signatures[0], t]));
const SIGS = [...bySig.keys()];
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** A fetch that answers getTransaction from the fixtures, and records every request. */
function mockRpc({ v1Requires = false } = {}) {
  const calls = [];
  const fetch = async (url, init) => {
    const req = JSON.parse(init.body);
    calls.push({ url, ...req });
    const [sig, cfg] = req.params;
    const tx = bySig.get(sig) ?? null;
    if (v1Requires && tx?.version === 1 && cfg.maxSupportedTransactionVersion < 1) {
      return json({ jsonrpc: "2.0", id: 1, error: { code: -32015, message: 'Transaction version (1) is not supported by the requesting client. Please try the request again with the following configuration parameter: "maxSupportedTransactionVersion": 1' } });
    }
    return json({ jsonrpc: "2.0", id: 1, result: tx });
  };
  return { fetch, calls };
}

test("fetchTransaction asks for jsonParsed, version 0, confirmed", async () => {
  const { fetch, calls } = mockRpc();
  const tx = await fetchTransaction(SIGS[0], { fetch, rpcUrl: "https://rpc.example" });
  assert.equal(tx.transaction.signatures[0], SIGS[0]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://rpc.example");
  assert.equal(calls[0].method, "getTransaction");
  assert.deepEqual(calls[0].params[1], { encoding: "jsonParsed", maxSupportedTransactionVersion: 0, commitment: "confirmed" });
});

test("a newer transaction version is fetched again with the version the RPC names", async () => {
  const { fetch, calls } = mockRpc({ v1Requires: true });
  const p = await parseTransaction(SIGS[4], { fetch });
  assert.equal(p.version, 1);
  assert.deepEqual(calls.map((c) => c.params[1].maxSupportedTransactionVersion), [0, 1]);
  await assert.rejects(fetchTransaction(SIGS[4], { fetch, autoVersion: false }), (e) => e instanceof RpcError && e.code === -32015);
});

test("errors: bad signature, not found, RPC error, HTTP error, 429, timeout", async () => {
  await assert.rejects(fetchTransaction("nope"), InvalidInputError);
  await assert.rejects(fetchTransaction(SIGS[0].slice(0, 40)), InvalidInputError);
  const unknown = "1".repeat(64);
  assert.equal(isSignature(unknown), true);
  await assert.rejects(fetchTransaction(unknown, { fetch: mockRpc().fetch }), TransactionNotFoundError);

  const rpcErr = async () => json({ jsonrpc: "2.0", id: 1, error: { code: -32602, message: "Invalid param" } });
  await assert.rejects(fetchTransaction(SIGS[0], { fetch: rpcErr }), (e) => e instanceof RpcError && e.code === -32602 && /Invalid param/.test(e.message));

  await assert.rejects(fetchTransaction(SIGS[0], { fetch: async () => new Response("bad", { status: 502 }) }), (e) => e instanceof RpcError && e.code === 502);

  let hits = 0;
  const limited = async () => { hits++; return hits < 2 ? new Response("slow down", { status: 429 }) : json({ jsonrpc: "2.0", id: 1, result: FIXTURES[0] }); };
  assert.equal((await fetchTransaction(SIGS[0], { fetch: limited })).slot, FIXTURES[0].slot, "one 429 is retried");
  await assert.rejects(fetchTransaction(SIGS[0], { fetch: async () => new Response("", { status: 429 }), retries: 0 }), (e) => e.code === 429);

  const hang = (url, init) => new Promise((_, reject) => init.signal.addEventListener("abort", () => reject(init.signal.reason)));
  await assert.rejects(fetchTransaction(SIGS[0], { fetch: hang, timeoutMs: 30 }), RpcTimeoutError);
});

test("parseTransactions keeps input order, isolates failures and respects the concurrency limit", async () => {
  let inFlight = 0, peak = 0;
  const { fetch: inner } = mockRpc();
  const fetch = async (...a) => { inFlight++; peak = Math.max(peak, inFlight); await new Promise((r) => setTimeout(r, 5)); try { return await inner(...a); } finally { inFlight--; } };
  const input = [SIGS[2], "bad", SIGS[0], "1".repeat(64), SIGS[1]];
  const out = await parseTransactions(input, { fetch, concurrency: 2 });
  assert.deepEqual(out.map((r) => r.signature), input);
  assert.deepEqual(out.map((r) => r.ok), [true, false, true, false, true]);
  assert.equal(out[1].error.name, "InvalidInputError");
  assert.equal(out[3].error.name, "TransactionNotFoundError");
  assert.equal(out[0].tx.swaps[0].isSigner, true);
  assert.ok(peak <= 2, `peak concurrency ${peak}`);
  await assert.rejects(parseTransactions("x"), InvalidInputError);
  await assert.rejects(parseTransactions([], { concurrency: 0 }), InvalidInputError);
  assert.deepEqual(await parseTransactions([]), []);
});

test("the CLI prints help offline and refuses a bad signature", () => {
  const cli = fileURLToPath(new URL("../bin/cli.js", import.meta.url));
  const help = spawnSync(process.execPath, [cli, "--help"], { encoding: "utf8" });
  assert.equal(help.status, 0);
  assert.match(help.stdout, /solana-tx-parse <signature> --json/);
  const bad = spawnSync(process.execPath, [cli, "not-a-signature"], { encoding: "utf8" });
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /InvalidInputError: not a transaction signature/);
});
