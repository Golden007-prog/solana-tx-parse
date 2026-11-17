# solana-tx-parse

**Solana transaction parser: any transaction signature, in words.** Give it a signature and get back who paid, what it cost (base and priority fee), whether it failed and why, which programs ran, whose balances moved, the SOL and SPL transfers, and the swaps. Works for legacy, v0 (address lookup tables) and v1 transactions. Zero dependencies.

![dependencies: 0](https://img.shields.io/badge/dependencies-0-brightgreen)
![node: 20+](https://img.shields.io/badge/node-20%2B-blue)
[![license: MIT](https://img.shields.io/badge/license-MIT-black)](LICENSE)
[![Discord](https://img.shields.io/badge/Discord-join-5865F2?logo=discord&logoColor=white)](https://discord.gg/grokbot)
[![GitHub stars](https://img.shields.io/github/stars/blixvip/solana-tx-parse?style=social)](https://github.com/blixvip/solana-tx-parse/stargazers)

<a href="https://blixvip.com"><img src="assets/blix-hero.jpg" width="100%" alt="BLIX: AI-powered Solana memecoin terminal. Trade memes first."></a>

**[Start trading at blixvip.com →](https://blixvip.com)** &nbsp;·&nbsp; [Docs and guides](https://blixvip.github.io/solana-tx-parse/) &nbsp;·&nbsp; [Public API](https://blixvip.com/api) &nbsp;·&nbsp; [MCP server](https://blixvip.com/mcp) &nbsp;·&nbsp; [Discord](https://discord.gg/grokbot)

Built by the team behind **[Blix](https://blixvip.com)**, a Solana memecoin terminal that reads a lot of transactions; this is the small, open part that turns one into a summary.

If solana-tx-parse saves you time, **[give it a ⭐](https://github.com/blixvip/solana-tx-parse)**. It helps other Solana developers find it.

## The problem

`getTransaction` gives you everything and explains nothing. The fee is one number with the priority fee hidden inside it, and the price per compute unit is a base58 blob in a Compute Budget instruction. Account indexes point past the end of `accountKeys` in a v0 transaction until you append the lookup-table addresses. Token transfers name token accounts, not wallets. A failure is `{"InstructionError":[2,{"Custom":6001}]}`. To answer "who swapped what for what, and what did it cost" you end up writing the same few hundred lines every time.

## Features

- **Fee breakdown**: total, base (5,000 lamports per signature) and priority, plus the priority fee the Compute Budget settings ask for (`SetComputeUnitLimit`, `SetComputeUnitPrice` decoded, the default limit worked out when none is set). v1 transactions, which carry their budget in `transactionConfig`, are read too.
- **Status in words**: `instruction 2 (L2TExMFK…) failed: custom program error 6001 (0x1771)` (the program is named when it is a known one), plus the program's own error line from the logs.
- **Programs invoked**, top-level and inner, with names for 18 well-known programs (System, Token, Token-2022, ATA, Compute Budget, Memo, Metaplex Token Metadata, Jupiter v6, Raydium AMM v4 / CPMM / CLMM, Orca Whirlpool, Meteora DLMM / DAMM v1 / DAMM v2, pump.fun, PumpSwap AMM). Add your own with `labels`.
- **Balance changes** per owner: SOL from `pre/postBalances`, tokens from `pre/postTokenBalances` grouped by owner and mint, with decimals, exact raw amounts as strings.
- **Transfers**: SOL and SPL (`transfer`, `transferChecked`, Token and Token-2022) from top-level and inner instructions, with the owning wallets resolved.
- **Swaps**: for each owner whose balance of one asset went down while another went up. A heuristic; see [Limitations](#limitations).
- **Address lookup tables**: `meta.loadedAddresses` merged into the account keys (writable, then read-only) when you pass a `json`-encoded transaction; `jsonParsed` already has them.
- **Batches**: `parseTransactions(signatures)` with a small concurrency limit; one bad signature does not sink the rest.
- **CLI**: `solana-tx-parse <signature> [--json]`.

## Install

```bash
npm install github:blixvip/solana-tx-parse
```

Node 20 or newer. No dependencies, no API key.

## Quick start

From the command line, against the free public Solana RPC:

```bash
npx github:blixvip/solana-tx-parse 2JRmPD7aXWeSwvpax5M1MNgUyjJmL6ixxtoQz7osMTBnWSgPC1kCo5cnSKj1sWiZkEQh34dfuucRVYGTtEFj7QpU
```

```
Signature  2JRmPD7aXWeSwvpax5M1MNgUyjJmL6ixxtoQz7osMTBnWSgPC1kCo5cnSKj1sWiZkEQh34dfuucRVYGTtEFj7QpU
Status     success
Slot       470,679,249 · 2026-11-17 21:10:10 UTC · version 1
Fee payer  gbUhftbTCP1qcsDHTbEDVDaPSZZM1uTMpiTCDV99WYs
Fee        0.000007726 SOL (7,726 lamports: base 5,000 + priority 2,726)
Compute    232,552 CU used of 272,511 · priority fee set to 2,726 lamports
Programs   Associated Token Account, Token Program, System Program, 6Vo3…uTAB, PumpSwap AMM, Token-2022, Jupiter v6, Meteora DLMM, Raydium CLMM

Swaps (balance-delta heuristic)
  gbUh…9WYs (signer)  184,615.488546 DxXJ…pump → 0.007984458 SOL  via 6Vo3…uTAB, PumpSwap AMM, Jupiter v6, Meteora DLMM, Raydium CLMM
  + 3 counterpart leg(s) by pools or other non-signers (see --json)

Balance changes
  gbUh…9WYs  +0.007976732 SOL (includes the fee)
  …

Transfers
  gbUh…9WYs → ANhJ…RmXf  184,615.488546 DxXJ…pump  (inner)
  …
```

Add `--json` for the full result, `--rpc <url>` (or `SOLANA_RPC_URL`) for your own endpoint.

As a library:

```js
import { parseTransaction } from "solana-tx-parse";

const tx = await parseTransaction("x2nTgvSFFneAKW5W5mHcfMYhzen5o7Lfb1pBmepDQQDJZ4ud2Z7QpDxdYVVTVMDqG2e5TJ1qAA8zGDPAxdpudKR");

tx.status;              // "success"
tx.fee;                 // { lamports: 106500, baseLamports: 5000, priorityLamports: 101500, ... }
tx.computeUnits;        // { consumed: 255, limit: 203000, limitSource: "default", priceMicroLamports: 500000 }
tx.transfers[0];        // { kind: "token", mint: "EPjF…", amount: 37.742077, fromOwner: "H8sM…", toOwner: "3vKW…", ... }
tx.tokenChanges;        // [{ owner, mint, decimals, pre, post, change, changeRaw }, ...]
tx.swaps;               // [] for a plain transfer
```

Already fetched the transaction yourself (a websocket, Geyser, your own RPC client)? Pass the object instead of the signature. `parseFetchedTransaction(tx)` does the same synchronously, with no network at all.

## Examples

| | |
|---|---|
| [`examples/offline-fixture.js`](examples/offline-fixture.js) | Parse a captured pump.fun buy. No network. |
| [`examples/swaps.js`](examples/swaps.js) | The signer's side of three captured swaps. No network. |
| [`examples/from-signature.js`](examples/from-signature.js) | Fetch one signature and print its summary. |
| [`examples/batch.js`](examples/batch.js) | Three signatures, one at a time with a pause, as a public RPC likes it. |

Run any of them with `node examples/<name>.js`. Their real output is in [VERIFY.md](VERIFY.md).

**Integrations** (copy into your project as they are):

| | |
|---|---|
| [`examples/integrations/http-endpoint`](examples/integrations/http-endpoint) | `GET /tx/<signature>` JSON API with `node:http`, cached. |
| [`examples/integrations/discord-webhook`](examples/integrations/discord-webhook) | Post a transaction summary to a Discord channel. |

Guides: [How to parse a Solana transaction in Node.js without web3.js](https://blixvip.github.io/solana-tx-parse/parse-solana-transaction-nodejs-without-web3js.html) · [How to see the priority fee a Solana transaction paid](https://blixvip.github.io/solana-tx-parse/solana-transaction-priority-fee.html)

## API

| | |
|---|---|
| `parseTransaction(signatureOrTx, opts?)` | Fetch (if given a signature) and parse. Returns a promise of the parsed transaction. |
| `parseFetchedTransaction(tx, opts?)` | Parse a `getTransaction` result you already have. Synchronous, no network. |
| `parseTransactions(signatures, opts?)` | Many at once, `concurrency` (default 2) at a time. Each entry is `{ signature, ok, tx }` or `{ signature, ok: false, error }`, in input order. |
| `fetchTransaction(signature, opts?)` | Only the fetch: the raw `getTransaction` result. |
| `formatSummary(parsed)` | The text the CLI prints. |
| `PROGRAM_LABELS`, `programLabel(id, extra?)` | The built-in program map. |

Errors are `InvalidInputError`, `RpcError` (with `code`: the JSON-RPC code or HTTP status), `RpcTimeoutError` and `TransactionNotFoundError`. Full reference, with every field of the result: [docs/API.md](docs/API.md). TypeScript declarations ship in `index.d.ts`.

## Configuration

| Option | Default | |
|---|---|---|
| `rpcUrl` | `SOLANA_RPC_URL`, else `https://api.mainnet-beta.solana.com` | Any Solana JSON-RPC endpoint. |
| `commitment` | `"confirmed"` | Or `"finalized"`. |
| `maxSupportedTransactionVersion` | `0` | Sent with `getTransaction`. |
| `autoVersion` | `true` | When the RPC answers "Transaction version (1) is not supported" (code -32015), ask once more with the version it names. |
| `timeoutMs` | `20000` | Per request (`AbortSignal.timeout`). |
| `retries` | `2` | Retries on HTTP 429, after 1 s and 2 s. |
| `labels` | none | Extra `{ programId: "Name" }` entries. |
| `includeLogs` | `false` | Copy the program logs into the result. |
| `concurrency`, `delayMs` | `2`, `0` | `parseTransactions` only. |
| `fetch` | global `fetch` | For tests and proxies. |

**Which services are involved.** Only the Solana RPC you point it at. The default is the free public endpoint run by the Solana Foundation, which serves `getTransaction` but rate limits hard (expect 429s past a few requests in a row). The free tiers of Helius, QuickNode, Alchemy and Triton work the same way through `SOLANA_RPC_URL`. Nothing here calls a Blix service. Blix also runs a [public API](https://blixvip.com/api) and an [MCP server](https://blixvip.com/mcp) for its own data; this library does not need either.

## How it works

1. **Fetch**: one `getTransaction` call, `encoding: "jsonParsed"`, `maxSupportedTransactionVersion: 0`. If the transaction is v1 the RPC says so and the call is repeated with version 1.
2. **Account keys**: `message.accountKeys`, plus `meta.loadedAddresses` (writable, then read-only) when the transaction came in `json`/`base64` encoding. With `jsonParsed` the RPC has merged them already and marks each with `source: "lookupTable"`, so nothing is added twice. If the keys still do not match the balance arrays in length, the result carries a warning instead of guessing.
3. **Instructions**: top-level and inner, flattened in execution order, in one shape whichever encoding they came in. Compute Budget instructions are decoded from their raw data (the RPC does not parse them). Token transfers are read from the parsed form, or decoded from raw data (`Transfer` = 3, `TransferChecked` = 12; System `Transfer` = 2) when the transaction is not `jsonParsed`.
4. **Fee**: base = 5,000 lamports × (transaction signatures + Ed25519 and secp256k1 precompile verifications). Priority = fee − base. The declared priority fee is `ceil(price × limit / 1,000,000)`, with the default limit (200,000 per top-level instruction, 3,000 for builtin programs, at most 1.4M) when none is set. On every captured fixture the two agree to the lamport.
5. **Balances**: SOL from `pre/postBalances` per address; tokens from `pre/postTokenBalances`, summed per owner and mint with BigInt.
6. **Swaps**: per owner, net every asset (native SOL and wrapped SOL together as `"SOL"`, the fee payer's fee added back, lamports of token accounts ignored). An owner with one asset down and another up gets `{ owner, in, out, via }`: `in` is what it put in, `out` what it got. If a side has several assets, SOL is dropped from it first (usually rent or a tip); if several remain, the first is used and the rest go in `otherLegs`. `via` lists every non-plumbing program in the transaction.

## Limitations

- **Swap detection is a balance-delta heuristic**, not instruction decoding. It sees net changes, not routes: an arbitrage that starts and ends in USDC shows as a tiny SOL → USDC "swap" (the v0 fixture is one). Amounts include fees the trade paid along the way (a pump.fun buy's `in` includes the protocol and creator fees). Rent for token accounts created in the same transaction can appear as a SOL leg. Pools, bonding curves and vaults show up as swaps too, with `isSigner: false`. `via` is every non-plumbing program in the transaction, not the ones that touched that owner.
- **No instruction decoding beyond System, SPL Token and Compute Budget.** Jupiter routes, Raydium or pump.fun instruction arguments and Anchor events are not decoded; the program is named, that is all.
- A token account created and closed in the same transaction is in neither balance list, so transfers to it have a `mint` (from `transferChecked`) but no `toOwner`.
- `transfers` lists SOL `transfer`/`transferWithSeed` and SPL `transfer`/`transferChecked`. Mints, burns, `createAccount` funding and account closes show up in balance changes, not as transfers.
- The base fee assumes 5,000 lamports per signature. Signatures checked by the Ed25519 / secp256k1 precompiles also cost a base fee and are not counted, so for those transactions part of the base fee is reported as priority.
- The default compute-unit limit is worked out from the runtime's current rules; a transaction from before those rules may disagree with `priorityLamports` (which is always the real figure, from the fee).
- UI amounts are JavaScript numbers. Use the `raw` / `changeRaw` strings for exact arithmetic.
- The public RPC rate limits quickly. For more than a handful of signatures use your own endpoint and keep `concurrency` low.

### How it compares

- **[Helius Enhanced Transactions](https://www.helius.dev/docs/enhanced-transactions)**: a hosted API that needs a Helius API key. It returns a type (`SWAP`, `TRANSFER`, `NFT_SALE`, …), a source and a description, and decodes many more programs than this. Helius's own docs now describe it as a legacy product in maintenance mode. Use it if a hosted service fits; use this if you want a library with no key and no third party between you and your RPC.
- **[Shyft transaction parser](https://docs.shyft.to/solana-apis/transactions/transaction-apis)**: also a hosted REST API (`/sol/v1/transaction/parsed`, bulk parsing of up to 100) behind an API key, with human-readable actions. Shyft also publishes an IDL-based parser for its gRPC streams.
- **[debridge-finance/solana-tx-parser-public](https://github.com/debridge-finance/solana-tx-parser-public)**: a TypeScript library (LGPL-2.1) that decodes instructions with Anchor IDLs or custom parsers, on top of `@solana/web3.js`. It is the better choice when you need instruction arguments. It does not compute fees, balance changes or swaps; this library does, with no dependencies, and decodes almost no instructions. The two fit together.

## Contributing

Bug reports with a signature are the most useful thing you can send: the fix and a new fixture follow from it. See [CONTRIBUTING.md](CONTRIBUTING.md), and come and talk in the [Discord](https://discord.gg/grokbot).

`npm test` runs everything offline against real mainnet transactions in `test/fixtures`. `LIVE=1 npm test` also re-fetches two of them from the public RPC and checks the results match.

## Good first issues

New to the project? These are small, self-contained tasks, each with why, what to do, where, and when it is done:

- [#1 Label the pump.fun fee program](https://github.com/blixvip/solana-tx-parse/issues/1)
- [#3 Add mint, burn and close to `transfers`](https://github.com/blixvip/solana-tx-parse/issues/3)
- [#5 Token-2022 transfer fees: fixture and `transferCheckedWithFee` support](https://github.com/blixvip/solana-tx-parse/issues/5)
- [#7 CLI exits with code 127 on Windows after a network error](https://github.com/blixvip/solana-tx-parse/issues/7)
- [#8 CLI: `--rpc` with no value silently uses the public RPC](https://github.com/blixvip/solana-tx-parse/issues/8)
- [#9 CLI: accept several signatures](https://github.com/blixvip/solana-tx-parse/issues/9)
- [#10 Label more DEX and launchpad programs](https://github.com/blixvip/solana-tx-parse/issues/10)

All of them: [good first issue](https://github.com/blixvip/solana-tx-parse/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) · bigger pieces and integration examples: [help wanted](https://github.com/blixvip/solana-tx-parse/issues?q=is%3Aissue+is%3Aopen+label%3A%22help+wanted%22) · everything by area: the [Roadmap](https://github.com/blixvip/solana-tx-parse/issues/14) · questions and ideas: [Discussions](https://github.com/blixvip/solana-tx-parse/discussions/15). Comment "I'll take this" on an issue before you start.

## Related projects

| | |
|---|---|
| [solana-rpc-pool](https://github.com/blixvip/solana-rpc-pool) | Spread `getTransaction` calls over several RPC keys under their rate limits; hand the results to `parseFetchedTransaction`. |
| [solana-ws-keepalive](https://github.com/blixvip/solana-ws-keepalive) | Subscriptions that reconnect on their own; `logsSubscribe` gives you signatures to parse. |
| [pump-curve](https://github.com/blixvip/pump-curve) | The state of a pump.fun bonding curve, for the coins you see in parsed pump.fun buys. |
| [sol-holders](https://github.com/blixvip/sol-holders) | Top holders of a token by wallet. |
| [solana-swap-parser](https://github.com/blixvip/solana-swap-parser) | Per-DEX swap decoding (price, venue) when you need more than balance deltas. |
| [solana-token-meta](https://github.com/blixvip/solana-token-meta) | Name, symbol and authorities for the mints that show up in a parsed transaction. |
| [solana-priority-fee](https://github.com/blixvip/solana-priority-fee) | What to bid next time, from the same RPC. |

## Contributors

Every merged pull request is credited in the release notes. Pick a [good first issue](https://github.com/blixvip/solana-tx-parse/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) or say hi in the [Discord](https://discord.gg/grokbot).

<a href="https://github.com/blixvip/solana-tx-parse/graphs/contributors"><img src="https://contrib.rocks/image?repo=blixvip/solana-tx-parse" alt="Contributors to solana-tx-parse"></a>

## License

MIT. See [LICENSE](LICENSE).
