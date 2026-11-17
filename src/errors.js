// Error types thrown by solana-tx-parse. All extend Error, so `catch (e) { e.message }` always works.

/** Bad input: not a signature, not a transaction object, a bad option. */
export class InvalidInputError extends Error {
  constructor(message) { super(message); this.name = "InvalidInputError"; }
}

/** The RPC answered with an error, an HTTP failure or a body that is not JSON-RPC. `code` is the JSON-RPC code or HTTP status. */
export class RpcError extends Error {
  constructor(message, { code = null, method = null } = {}) { super(message); this.name = "RpcError"; this.code = code; this.method = method; }
}

/** The RPC did not answer within `timeoutMs`. */
export class RpcTimeoutError extends RpcError {
  constructor(method, timeoutMs) { super(`the RPC did not answer ${method} within ${timeoutMs} ms`, { code: "TIMEOUT", method }); this.name = "RpcTimeoutError"; }
}

/** getTransaction returned null: unknown signature, not confirmed yet, or older than the node's history. */
export class TransactionNotFoundError extends Error {
  constructor(signature) {
    super(`transaction ${signature} was not found: it may not be confirmed yet, or the RPC does not keep history that old`);
    this.name = "TransactionNotFoundError"; this.signature = signature;
  }
}
