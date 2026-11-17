// A minimal JSON-RPC client: one POST, a timeout on every call, a short back-off on 429.
import { RpcError, RpcTimeoutError } from "./errors.js";

export const PUBLIC_RPC = "https://api.mainnet-beta.solana.com";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * A timeout signal on a ref'd timer. AbortSignal.timeout() uses an unref'd timer, so when nothing else holds the
 * event loop open (a custom fetch, a stalled stream) Node exits before it fires and the call never settles.
 * Call clear() once the call is done so a finished request does not hold the process open.
 * @param {number} ms
 */
export function timeoutSignal(ms) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(new DOMException(`The operation was aborted due to timeout`, "TimeoutError")), ms);
  return { signal: ac.signal, clear: () => clearTimeout(t) };
}

/**
 * @param {string} method
 * @param {unknown[]} params
 * @param {{ rpcUrl?: string, fetch?: typeof fetch, timeoutMs?: number, retries?: number }} [opts]
 */
export async function rpcCall(method, params, { rpcUrl = PUBLIC_RPC, fetch: fetchFn = globalThis.fetch, timeoutMs = 20_000, retries = 2 } = {}) {
  for (let attempt = 0; ; attempt++) {
    const timer = timeoutSignal(timeoutMs);
    let res;
    try {
      res = await attemptCall(method, params, rpcUrl, fetchFn, timeoutMs, timer.signal, attempt < retries);
    } finally {
      timer.clear();
    }
    if (res === RETRY) { await sleep(1000 * 2 ** attempt); continue; }
    return res;
  }
}

const RETRY = Symbol("retry");

async function attemptCall(method, params, rpcUrl, fetchFn, timeoutMs, signal, canRetry) {
  let res;
  try {
    res = await fetchFn(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal,
    });
  } catch (e) {
    if (e?.name === "TimeoutError" || e?.name === "AbortError") throw new RpcTimeoutError(method, timeoutMs);
    throw new RpcError(`the RPC could not be reached (${e?.message || e})`, { method });
  }
  if (res.status === 429 && canRetry) return RETRY;
  if (res.status === 429) throw new RpcError(`the RPC is rate limiting ${method} (HTTP 429): slow down, or set SOLANA_RPC_URL to your own endpoint`, { code: 429, method });
  if (!res.ok) throw new RpcError(`the RPC answered HTTP ${res.status} to ${method}`, { code: res.status, method });
  let body;
  try { body = await res.json(); } catch { throw new RpcError(`the RPC sent a body that is not JSON for ${method}`, { method }); }
  if (body?.error) throw new RpcError(`${method} failed: ${body.error.message || "RPC error"} (code ${body.error.code})`, { code: body.error.code ?? null, method });
  return body?.result;
}
