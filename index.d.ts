// Type declarations for solana-tx-parse.

/** Native SOL in balance changes, transfers and swaps. */
export declare const SOL: "SOL";
export declare const WSOL_MINT: "So11111111111111111111111111111111111111112";
export declare const PUBLIC_RPC: string;
export declare const LAMPORTS_PER_SIGNATURE: number;
export declare const PROGRAM_LABELS: Readonly<Record<string, string>>;

export interface FetchOptions {
  /** RPC URL. Default: SOLANA_RPC_URL, else https://api.mainnet-beta.solana.com */
  rpcUrl?: string;
  /** Default "confirmed". */
  commitment?: "confirmed" | "finalized";
  /** Default 0. */
  maxSupportedTransactionVersion?: number;
  /** Repeat once with the version the RPC names when it answers -32015. Default true. */
  autoVersion?: boolean;
  /** Custom fetch (tests, proxies). Default globalThis.fetch. */
  fetch?: typeof fetch;
  /** Per-request timeout. Default 20000. */
  timeoutMs?: number;
  /** Retries on HTTP 429, with 1 s, 2 s back-off. Default 2. */
  retries?: number;
}

export interface ParseOptions {
  /** Extra program labels, merged over the built-in map. */
  labels?: Record<string, string>;
  /** Copy meta.logMessages into the result as `logs`. */
  includeLogs?: boolean;
}

export interface Amount {
  mint: string;
  /** UI amount (raw / 10^decimals). A JS number: may round past ~15 significant digits; use `raw` for exact maths. */
  amount: number;
  raw: string;
  decimals: number;
}

export interface BalanceChange {
  owner: string;
  mint: string;
  decimals: number;
  pre: number;
  post: number;
  change: number;
  changeRaw: string;
}
export interface SolChange extends BalanceChange {
  mint: "SOL";
  isFeePayer: boolean;
  /** The address is a token account (its lamports are rent or wrapped SOL). */
  isTokenAccount: boolean;
}
export interface TokenChange extends BalanceChange {
  programId: string | null;
  accounts: string[];
}

export interface Transfer {
  kind: "sol" | "token";
  from: string;
  to: string;
  fromOwner: string | null;
  toOwner: string | null;
  mint: string | null;
  decimals: number | null;
  amount: number | null;
  raw: string;
  authority: string | null;
  /** "3" for top-level instruction 3, "3.2" for its second inner instruction. */
  instruction: string;
  inner: boolean;
  programId: string;
  program: string;
}

export interface Swap {
  owner: string;
  isSigner: boolean;
  /** What the owner put in: its balance of this went down. */
  in: Amount;
  /** What the owner got out: its balance of this went up. */
  out: Amount;
  /** Non-plumbing programs invoked anywhere in the transaction (labels, or IDs when unknown). */
  via: string[];
  otherLegs?: (Amount & { side: "in" | "out" })[];
}

export interface TxError {
  raw: unknown;
  message: string;
  instructionIndex: number | null;
  programId: string | null;
  program: string | null;
  customCode: number | null;
  log: string | null;
}

export interface ParsedTransaction {
  signature: string | null;
  slot: number | null;
  blockTime: number | null;
  time: string | null;
  version: "legacy" | number;
  status: "success" | "failed";
  error: TxError | null;
  feePayer: string | null;
  signers: string[];
  fee: {
    lamports: number;
    sol: number;
    baseLamports: number;
    priorityLamports: number;
    /** What the compute-budget settings ask for; null when unknown. */
    priorityLamportsDeclared: number | null;
    signatures: number;
  };
  computeUnits: { consumed: number | null; limit: number | null; limitSource: "instruction" | "default" | "transactionConfig"; priceMicroLamports: number | null };
  computeBudget: {
    source: "instructions" | "transactionConfig";
    unitLimit: number | null;
    unitPriceMicroLamports: number | null;
    priorityFeeLamports: number | null;
    heapFrameBytes: number | null;
    loadedAccountsDataSizeLimit: number | null;
    effectiveUnitLimit: number | null;
    unitLimitSource: "instruction" | "default" | "transactionConfig";
  };
  accounts: { total: number; fromLookupTables: number; lookupTables: string[] };
  programs: { programId: string; label: string | null; topLevel: number; inner: number }[];
  solChanges: SolChange[];
  tokenChanges: TokenChange[];
  transfers: Transfer[];
  swaps: Swap[];
  warnings: string[];
  logs?: string[];
}

export type BatchResult =
  | { signature: string; ok: true; tx: ParsedTransaction }
  | { signature: string; ok: false; error: Error };

export declare function fetchTransaction(signature: string, opts?: FetchOptions): Promise<any>;
export declare function parseTransaction(signatureOrTx: string | object, opts?: FetchOptions & ParseOptions): Promise<ParsedTransaction>;
export declare function parseFetchedTransaction(tx: object, opts?: ParseOptions): ParsedTransaction;
export declare function parseTransactions(signatures: string[], opts?: FetchOptions & ParseOptions & { concurrency?: number; delayMs?: number }): Promise<BatchResult[]>;
export declare function formatSummary(parsed: ParsedTransaction, opts?: { maxRows?: number }): string;
export declare function isSignature(value: unknown): boolean;
export declare function programLabel(programId: string, extra?: Record<string, string>): string | null;
export declare function formatUnits(raw: bigint | string | number, decimals: number): string;
export declare function resolveAccountKeys(tx: object): { pubkey: string; signer: boolean; writable: boolean; source: "transaction" | "lookupTable" }[];
export declare function flattenInstructions(tx: object, keys?: ReturnType<typeof resolveAccountKeys>): { path: string; inner: boolean; programId: string | null; parsed: any; accounts: (string | null)[]; data: string | null }[];
export declare function decodeComputeBudget(instructions: ReturnType<typeof flattenInstructions>): { unitLimit: number | null; unitPriceMicroLamports: bigint | null; heapFrameBytes: number | null; loadedAccountsDataSizeLimit: number | null };
export declare function describeError(err: unknown, instructions: ReturnType<typeof flattenInstructions>, logs?: string[], labels?: Record<string, string>): TxError | null;

export declare class InvalidInputError extends Error {}
export declare class RpcError extends Error { code: number | string | null; method: string | null }
export declare class RpcTimeoutError extends RpcError {}
export declare class TransactionNotFoundError extends Error { signature: string }
