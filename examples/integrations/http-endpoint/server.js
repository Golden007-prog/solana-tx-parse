// A tiny JSON API over solana-tx-parse, with nothing but node:http.
//
//   node examples/integrations/http-endpoint/server.js
//   curl http://localhost:8787/tx/<signature>              -> the parsed transaction as JSON
//   curl http://localhost:8787/tx/<signature>?format=text  -> the CLI summary as plain text
//
// PORT (default 8787) and SOLANA_RPC_URL (default: the public mainnet RPC) are read from the environment.
// Confirmed transactions never change, so answers are cached in memory (the last 500).
import http from "node:http";
import { parseTransaction, formatSummary, InvalidInputError, TransactionNotFoundError, RpcTimeoutError, RpcError } from "solana-tx-parse";

const PORT = Number(process.env.PORT) || 8787;
const CACHE_SIZE = 500;
const cache = new Map(); // signature -> parsed result, oldest first

async function parsedCached(signature) {
  if (cache.has(signature)) return cache.get(signature);
  const tx = await parseTransaction(signature, { rpcUrl: process.env.SOLANA_RPC_URL });
  cache.set(signature, tx);
  if (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value);
  return tx;
}

function send(res, status, body, type = "application/json") {
  res.writeHead(status, { "content-type": `${type}; charset=utf-8`, "access-control-allow-origin": "*" });
  res.end(type === "application/json" ? JSON.stringify(body, null, 2) : body);
}

// Map the library's errors to HTTP statuses.
function statusFor(e) {
  if (e instanceof InvalidInputError) return 400;
  if (e instanceof TransactionNotFoundError) return 404;
  if (e instanceof RpcTimeoutError) return 504;
  if (e instanceof RpcError) return e.code === 429 ? 503 : 502;
  return 500;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const m = /^\/tx\/([^/]+)$/.exec(url.pathname);
  if (req.method !== "GET" || !m) return send(res, 404, { error: "use GET /tx/<signature>" });
  try {
    const tx = await parsedCached(decodeURIComponent(m[1]));
    if (url.searchParams.get("format") === "text") return send(res, 200, formatSummary(tx) + "\n", "text/plain");
    send(res, 200, tx);
  } catch (e) {
    send(res, statusFor(e), { error: e.name, message: e.message });
  }
});

server.listen(PORT, () => console.log(`solana-tx-parse endpoint on http://localhost:${PORT}/tx/<signature>`));
