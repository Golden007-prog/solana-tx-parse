# API

```js
import {
  parseTransaction, parseFetchedTransaction, parseTransactions, fetchTransaction, formatSummary,
  PROGRAM_LABELS, programLabel, isSignature, formatUnits, resolveAccountKeys, flattenInstructions,
  decodeComputeBudget, describeError, SOL, WSOL_MINT, PUBLIC_RPC, LAMPORTS_PER_SIGNATURE,
  InvalidInputError, RpcError, RpcTimeoutError, TransactionNotFoundError,
} from "solana-tx-parse";
```

## Functions

### `parseTransaction(signatureOrTx, opts?) → Promise<ParsedTransaction>`

A string is treated as a signature and fetched with `fetchTransaction`; an object is parsed as it is (a `getTransaction` result, or the whole JSON-RPC response, whose `result` is unwrapped). Takes every option of `fetchTransaction` and `parseFetchedTransaction`.

### `parseFetchedTransaction(tx, opts?) → ParsedTransaction`

Synchronous, no network. `tx` may be `jsonParsed` or `json` encoded, legacy, v0 or v1.

| Option | Default | |
|---|---|---|
| `labels` | none | `{ [programId]: "Name" }`, merged over `PROGRAM_LABELS`. |
| `includeLogs` | `false` | Adds `logs` (the program log lines). |

Throws `InvalidInputError` when `tx` has no `.transaction.message` or `.meta`.

### `fetchTransaction(signature, opts?) → Promise<object>`

One `getTransaction` call: `[signature, { encoding: "jsonParsed", maxSupportedTransactionVersion, commitment }]`.

| Option | Default | |
|---|---|---|
| `rpcUrl` | `process.env.SOLANA_RPC_URL`, else `PUBLIC_RPC` | |
| `commitment` | `"confirmed"` | |
| `maxSupportedTransactionVersion` | `0` | |
| `autoVersion` | `true` | On RPC error -32015 ("Transaction version (N) is not supported"), retry once with the version the message names. |
| `timeoutMs` | `20000` | Per HTTP request. |
| `retries` | `2` | Retries after HTTP 429, waiting 1 s, then 2 s. |
| `fetch` | `globalThis.fetch` | |

Throws `InvalidInputError` (not a 64-byte base58 signature), `TransactionNotFoundError` (the RPC returned `null`), `RpcError` (JSON-RPC error, HTTP error, unreachable; `code` holds the JSON-RPC code or HTTP status), `RpcTimeoutError` (subclass of `RpcError`, `code: "TIMEOUT"`).

### `parseTransactions(signatures, opts?) → Promise<BatchResult[]>`

Parses each signature with `parseTransaction`, `concurrency` (default `2`) at a time, waiting `delayMs` (default `0`) between requests in each worker. Never rejects for one transaction: each entry is `{ signature, ok: true, tx }` or `{ signature, ok: false, error }`, in input order. Rejects with `InvalidInputError` if `signatures` is not an array or `concurrency` is not a positive integer.

### `formatSummary(parsed, { maxRows = 12 }?) → string`

The multi-line text the CLI prints. Lists are capped at `maxRows`. When some swaps are by signers, only those are listed, with a count of the others.

### Helpers

- `isSignature(s)`: true for base58 text that decodes to 64 bytes.
- `programLabel(programId, extra?)`: the label, or `null`.
- `formatUnits(raw, decimals)`: exact decimal text (`formatUnits(-5002n, 9) === "-0.000005002"`).
- `resolveAccountKeys(tx)`: `[{ pubkey, signer, writable, source: "transaction" | "lookupTable" }]`, with `meta.loadedAddresses` appended when the encoding did not merge them.
- `flattenInstructions(tx, keys?)`: top-level and inner instructions in execution order as `{ path, inner, programId, parsed, accounts, data }`. `path` is `"2"` for top-level instruction 2 and `"2.1"` for its first inner instruction.
- `decodeComputeBudget(instructions)`: `{ unitLimit, unitPriceMicroLamports (BigInt), heapFrameBytes, loadedAccountsDataSizeLimit }` from top-level Compute Budget instructions.
- `describeError(err, instructions, logs?, labels?)`: the `error` object below.

## The parsed transaction

| Field | |
|---|---|
| `signature` | The first signature. |
| `slot`, `blockTime`, `time` | `time` is ISO 8601 UTC, or `null` when the RPC has no block time. |
| `version` | `"legacy"`, `0` or `1`. |
| `status` | `"success"` or `"failed"`. |
| `error` | `null`, or `{ raw, message, instructionIndex, programId, program, customCode, log }`. `raw` is `meta.err` as the RPC sent it; `log` is the program's own error line (Anchor's `Error Message:`, `Program log: Error…`, or the runtime's `Program X failed: …`). |
| `feePayer`, `signers` | |
| `fee` | `{ lamports, sol, baseLamports, priorityLamports, priorityLamportsDeclared, signatures }`. The base fee counts transaction signatures and Ed25519 and secp256k1 precompile verifications. `signatures` counts transaction signatures only. `priorityLamports` = fee − base (the real charge); `priorityLamportsDeclared` comes from the budget settings. |
| `computeUnits` | `{ consumed, limit, limitSource, priceMicroLamports }`. `limitSource` is `"instruction"`, `"default"` (no `SetComputeUnitLimit`; worked out from the runtime's rule) or `"transactionConfig"` (v1). |
| `computeBudget` | `{ source: "instructions" \| "transactionConfig", unitLimit, unitPriceMicroLamports, priorityFeeLamports, heapFrameBytes, loadedAccountsDataSizeLimit, effectiveUnitLimit, unitLimitSource }`. For v1, `priorityFeeLamports` is the config's `priorityFee` and there is no per-unit price. |
| `accounts` | `{ total, fromLookupTables, lookupTables }`: `lookupTables` are the table addresses from `addressTableLookups`. |
| `programs` | `[{ programId, label, topLevel, inner }]` in order of first appearance; `label` is `null` for unknown programs. |
| `solChanges` | `[{ owner, mint: "SOL", decimals: 9, pre, post, change, changeRaw, isFeePayer, isTokenAccount }]`, one per address whose lamports changed. The fee payer's change includes the fee. |
| `tokenChanges` | `[{ owner, mint, decimals, pre, post, change, changeRaw, programId, accounts }]`, summed per owner and mint. `owner` falls back to the token account address when the RPC gives no owner. |
| `transfers` | `[{ kind: "sol" \| "token", from, to, fromOwner, toOwner, mint, decimals, amount, raw, authority, instruction, inner, programId, program }]`. For SOL, `mint` is `"SOL"` and from/to are wallets. For tokens, from/to are token accounts and the owners are resolved from the token balances. Empty for a failed transaction. |
| `swaps` | `[{ owner, isSigner, in, out, via, otherLegs? }]`; `in`/`out` are `{ mint, amount, raw, decimals }`, `mint` is `"SOL"` for native and wrapped SOL together. Signers first. Empty for a failed transaction. See the README for the rules and their limits. |
| `warnings` | Strings, e.g. when account keys and balance arrays differ in length. |
| `logs` | Only with `includeLogs: true`. |

Amounts named `amount`, `pre`, `post`, `change` are JavaScript numbers in UI units; `raw`, `changeRaw` are exact integer strings in base units.

## Program labels

Each ID was checked on 2026-11-17 against the project's own source or documentation and confirmed to be an executable account on mainnet with `getMultipleAccounts`.

| Label | Program ID | Source |
|---|---|---|
| System Program | `11111111111111111111111111111111` | Solana runtime builtin |
| Token Program | `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA` | Solana Program Library |
| Token-2022 | `TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb` | Solana Program Library |
| Associated Token Account | `ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL` | Solana Program Library |
| Compute Budget | `ComputeBudget111111111111111111111111111111` | Solana runtime builtin |
| Memo / Memo v1 | `MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr` / `Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo` | Solana Program Library |
| Metaplex Token Metadata | `metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s` | `declare_id!` in metaplex-foundation/mpl-token-metadata |
| Jupiter v6 | `JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4` | `JUPITER_V6_PROGRAM_ID` in jup-ag/instruction-parser |
| Raydium AMM v4 | `675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8` | docs.raydium.io program addresses |
| Raydium CPMM | `CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C` | docs.raydium.io program addresses |
| Raydium CLMM | `CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK` | docs.raydium.io |
| Orca Whirlpool | `whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc` | `declare_id!` in orca-so/whirlpools |
| Meteora DLMM | `LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo` | `LBCLMM_PROGRAM_IDS` in MeteoraAg/dlmm-sdk, docs.meteora.ag |
| Meteora DAMM v1 | `Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB` | `PROGRAM_ID` in MeteoraAg/damm-v1-sdk |
| Meteora DAMM v2 | `cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG` | docs.meteora.ag DAMM v2 guide |
| pump.fun | `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P` | pump-fun/pump-public-docs |
| PumpSwap AMM | `pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA` | pump-fun/pump-public-docs |

## CLI

```
solana-tx-parse <signature>          readable summary
solana-tx-parse <signature> --json   the full parsed result
solana-tx-parse <signature> --logs   include the program logs (with --json)
--rpc <url> or SOLANA_RPC_URL        the RPC to use; --rpc requires an HTTP(S) URL
```

Exit code 0 on success, 1 on any error (printed as `<ErrorName>: <message>` on stderr).
