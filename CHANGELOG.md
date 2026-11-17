# Changelog

All notable changes to this project are documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-11-17

### Added

- `parseTransaction(signatureOrTx)`, `parseFetchedTransaction(tx)`, `parseTransactions(signatures, { concurrency })`, `fetchTransaction(signature)` and `formatSummary(parsed)`.
- Fee breakdown (base, priority, declared priority) with Compute Budget instructions decoded, the default compute-unit limit worked out when none is set, and v1 `transactionConfig` budgets read.
- Failure description with instruction index, program, custom code and the program's error log line.
- Labels for 18 well-known programs, overridable with `labels`.
- SOL and token balance changes per owner; SOL and SPL transfers from top-level and inner instructions, from `jsonParsed` or raw `json` encoding.
- Swap heuristic from balance deltas.
- Address lookup table support: `meta.loadedAddresses` merged into the account keys.
- Automatic retry with the transaction version the RPC asks for (error -32015).
- CLI `solana-tx-parse <signature> [--json] [--logs] [--rpc <url>]`.
- TypeScript declarations in `index.d.ts`.
