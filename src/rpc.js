// A minimal JSON-RPC client: one POST, a timeout on every call, a short back-off on 429.
import { RpcError, RpcTimeoutError } from "./errors.js";

export const PUBLIC_RPC = "https://api.mainnet-beta.solana.com";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * @param {string} method
 * @param {unknown[]} params
 * @param {{ rpcUrl?: string, fetch?: typeof fetch, timeoutMs?: number, retries?: number }} [opts]
 */
export async function rpcCall(method, params, { rpcUrl = PUBLIC_RPC, fetch: fetchFn = globalThis.fetch, timeoutMs = 20_000, retries = 2 } = {}) {
  for (let attempt = 0; ; attempt++) {
    let res;
    try {
      res = await fetchFn(rpcUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (e) {
      if (e?.name === "TimeoutError" || e?.name === "AbortError") throw new RpcTimeoutError(method, timeoutMs);
      throw new RpcError(`the RPC could not be reached (${e?.message || e})`, { method });
    }
    if (res.status === 429 && attempt < retries) { await sleep(1000 * 2 ** attempt); continue; }
    if (res.status === 429) throw new RpcError(`the RPC is rate limiting ${method} (HTTP 429): slow down, or set SOLANA_RPC_URL to your own endpoint`, { code: 429, method });
    if (!res.ok) throw new RpcError(`the RPC answered HTTP ${res.status} to ${method}`, { code: res.status, method });
    let body;
    try { body = await res.json(); } catch { throw new RpcError(`the RPC sent a body that is not JSON for ${method}`, { method }); }
    if (body?.error) throw new RpcError(`${method} failed: ${body.error.message || "RPC error"} (code ${body.error.code})`, { code: body.error.code ?? null, method });
    return body?.result;
  }
}
