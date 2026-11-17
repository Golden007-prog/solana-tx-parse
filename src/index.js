// solana-tx-parse: a Solana transaction in, a readable summary out. Fee payer, fee and priority fee, status and the
// error in words, programs invoked with names, balance changes per owner, SOL and SPL transfers, and swaps (a
// balance-delta heuristic). Takes a signature (fetched over plain JSON-RPC) or a transaction you already fetched.
// No dependencies. Node 20+.
//
// A small, open piece of what powers Blix (https://blixvip.com), the Solana memecoin terminal.
import { rpcCall, PUBLIC_RPC } from "./rpc.js";
import { parseFetchedTransaction } from "./parse.js";
import { isBase58OfLength } from "./base58.js";
import { InvalidInputError, RpcError, TransactionNotFoundError } from "./errors.js";

export { PUBLIC_RPC } from "./rpc.js";
export { parseFetchedTransaction, resolveAccountKeys, flattenInstructions, decodeComputeBudget, describeError, formatUnits, SOL, LAMPORTS_PER_SIGNATURE } from "./parse.js";
export { PROGRAM_LABELS, programLabel, WSOL_MINT } from "./programs.js";
export { formatSummary } from "./format.js";
export { InvalidInputError, RpcError, RpcTimeoutError, TransactionNotFoundError } from "./errors.js";

/** True for a base58 string that decodes to a 64-byte transaction signature. */
export const isSignature = (s) => isBase58OfLength(s, 64);

/**
 * Fetch one transaction with getTransaction (encoding jsonParsed, maxSupportedTransactionVersion 0).
 * When the RPC answers that the transaction is a newer version (error -32015), the call is repeated once with the
 * version the RPC names, unless `autoVersion` is false.
 * @param {string} signature
 * @param {object} [opts]  rpcUrl, commitment ("confirmed"), maxSupportedTransactionVersion (0), autoVersion (true), fetch, timeoutMs, retries
 * @returns {Promise<object>} the raw getTransaction result
 */
export async function fetchTransaction(signature, opts = {}) {
  if (!isSignature(signature)) throw new InvalidInputError(`not a transaction signature: ${String(signature).slice(0, 20)}`);
  const { rpcUrl: rpcUrlOpt, commitment = "confirmed", maxSupportedTransactionVersion = 0, autoVersion = true, ...net } = opts;
  // An empty string (e.g. an unset-but-exported env var) means "use the default", not "no URL".
  const rpcUrl = rpcUrlOpt || process.env.SOLANA_RPC_URL || PUBLIC_RPC;
  const call = (version) => rpcCall("getTransaction", [signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: version, commitment }], { rpcUrl, ...net });
  let tx;
  try { tx = await call(maxSupportedTransactionVersion); }
  catch (e) {
    const wanted = e instanceof RpcError && e.code === -32015 && Number(/maxSupportedTransactionVersion\\?"?:\s*(\d+)/.exec(e.message)?.[1]);
    if (!autoVersion || !Number.isInteger(wanted) || wanted <= maxSupportedTransactionVersion) throw e;
    tx = await call(wanted);
  }
  if (tx == null) throw new TransactionNotFoundError(signature);
  return tx;
}

/**
 * Parse a transaction: pass a signature (it is fetched) or a transaction object you already fetched.
 * @param {string | object} signatureOrTx
 * @param {object} [opts]  fetch options (see fetchTransaction) plus labels (extra program labels), includeLogs
 */
export async function parseTransaction(signatureOrTx, opts = {}) {
  if (typeof signatureOrTx === "string") return parseFetchedTransaction(await fetchTransaction(signatureOrTx, opts), opts);
  return parseFetchedTransaction(signatureOrTx, opts);
}

/**
 * Parse several signatures, `concurrency` at a time (default 2, kept low for public RPCs). Never throws for a single
 * bad transaction: each entry is `{ signature, ok: true, tx }` or `{ signature, ok: false, error }`, in input order.
 * @param {string[]} signatures
 * @param {object} [opts]  concurrency, delayMs (pause between requests per worker, default 0), plus parseTransaction options
 */
export async function parseTransactions(signatures, opts = {}) {
  if (!Array.isArray(signatures)) throw new InvalidInputError("parseTransactions expects an array of signatures");
  const { concurrency = 2, delayMs = 0, ...rest } = opts;
  if (!Number.isInteger(concurrency) || concurrency < 1) throw new InvalidInputError("concurrency must be a positive integer");
  const out = new Array(signatures.length);
  let next = 0;
  const worker = async () => {
    while (next < signatures.length) {
      const i = next++;
      const signature = signatures[i];
      try { out[i] = { signature, ok: true, tx: await parseTransaction(signature, rest) }; }
      catch (error) { out[i] = { signature, ok: false, error }; }
      if (delayMs && next < signatures.length) await new Promise((r) => setTimeout(r, delayMs));
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, signatures.length) }, worker));
  return out;
}
