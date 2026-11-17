# VERIFY

Everything below was run on 2026-11-17 (Windows 11, Node v24.15.0) in this folder. Live calls went to the public RPC `https://api.mainnet-beta.solana.com` only, one at a time with pauses. No transaction was signed or sent; nothing was paid for.

## `npm test` (offline)

```
﹣ a live fetch parses the same as its captured fixture (1.3461ms) # set LIVE=1 to run
✔ plain SOL transfer: fee, default compute limit, one transfer, no swap
✔ SPL transfer: transferChecked decoded, token changes grouped by owner and mint
✔ pump.fun buy: the signer's swap is SOL in, the coin out, via pump.fun
✔ failed transaction: the error in words, nothing moved but the fee
✔ v1 transaction: the budget comes from transactionConfig (priority fee in lamports)
✔ a JSON-RPC envelope is unwrapped; bad input is refused
✔ extra labels and logs on request
✔ formatSummary renders every section
✔ formatUnits is exact
✔ every built-in program ID is a 32-byte address
✔ v0 with address lookup tables: loaded addresses are merged into the account keys
✔ arbitrage through Jupiter: the heuristic reports the net, which is honest but not the route
✔ fetchTransaction asks for jsonParsed, version 0, confirmed
✔ a newer transaction version is fetched again with the version the RPC names
✔ errors: bad signature, not found, RPC error, HTTP error, 429, timeout
✔ parseTransactions keeps input order, isolates failures and respects the concurrency limit
✔ the CLI prints help offline and refuses a bad signature
ℹ tests 18
ℹ pass 17
ℹ fail 0
ℹ skipped 1
```

17 offline tests pass. The skipped one is the live test, gated behind `LIVE=1` (run below).

## Fixtures: real mainnet transactions

Captured with `getSignaturesForAddress` on the program or wallet named, then `getTransaction` (`jsonParsed`, `maxSupportedTransactionVersion` 0, later 1 once v1 transactions turned up); the v0 one came from `getBlock` at slot 320,000,000 (transactionDetails `accounts`), filtered for v0 + lookup tables + Jupiter v6, then fetched in both `jsonParsed` and `json` encodings.

| File | Signature | Slot | Version | What it is |
|---|---|---|---|---|
| `sol-transfer.json` | `4pLRvkZ9zuBUDNHnGUtHYi7f9Qm1Wwaod6H2gCutzsxUx1td6n1x292aDZ65HiYX7kD64VC9ZPeayJKVsk4qU3bo` | 470678583 | legacy | System transfer from an exchange hot wallet |
| `spl-transfer.json` | `x2nTgvSFFneAKW5W5mHcfMYhzen5o7Lfb1pBmepDQQDJZ4ud2Z7QpDxdYVVTVMDqG2e5TJ1qAA8zGDPAxdpudKR` | 470678784 | legacy | USDC `transferChecked` |
| `pump-buy.json` | `2axWwMEc9F41wpeitiAzxfqaByUEQSfX1ghp4AcdFmUXsa69jEYSgRqhhhoUgtMCBGv6sutdAZ6yAfKwKoLXBP1d` | 470680152 | legacy | pump.fun `Buy` |
| `failed.json` | `5GdMZeap3wrqtCkHRsc9M8UNCaKHD6cm9MoDT2xY39RJg5nW8sQ9inA6hWRCf4hXWgnqsb7Bb6NaYNojTvzGkZP8` | 470679566 | legacy | Failed bot tx touching pump.fun (custom error 6001) |
| `jupiter-swap-v1.json` | `2JRmPD7aXWeSwvpax5M1MNgUyjJmL6ixxtoQz7osMTBnWSgPC1kCo5cnSKj1sWiZkEQh34dfuucRVYGTtEFj7QpU` | 470679249 | 1 | Jupiter v6 swap routed through PumpSwap, Meteora DLMM, Raydium CLMM |
| `jupiter-swap-v0.json` (+ `.json-encoding.json`) | `4neabHc2bqNJSnwcmz1L7PvEozsFGLjKk59hwL13aBznowaPcN1ThLjvvPpzNWnGdaixg1ragf42WSNb8iN6FkjX` | 320000000 | 0 | Jupiter v6 arbitrage, 37 accounts from 5 lookup tables |

Finding while capturing: on 2026-11-17, of 47 recent successful Jupiter / Raydium CLMM / Meteora DLMM / Orca transactions sampled, 33 were **v1** and 14 were v0, and none of the v0 ones used lookup tables. `getTransaction` with `maxSupportedTransactionVersion: 0` fails on v1 with error -32015, which is why `fetchTransaction` retries with the version the RPC names (on by default, `autoVersion: false` turns it off). v1 transactions carry their budget in `message.transactionConfig` (`computeUnitLimit`, `priorityFee` in lamports) and have no Compute Budget instructions; the parser reads that.

## Live checks

`LIVE=1 node --test test/live.test.js`: re-fetches `spl-transfer` and `jupiter-swap-v1` by signature (the second through the -32015 retry) and checks status, fee, balance changes, transfers and swaps equal the fixture's.

```
✔ a live fetch parses the same as its captured fixture
ℹ tests 1
ℹ pass 1
ℹ fail 0
```

`node bin/cli.js 2JRmPD7a…QpU` (the README's CLI snippet, run from the checkout instead of `npx github:`). The first attempt got HTTP 429 from the public RPC right after the live test (`RpcError: the RPC is rate limiting getTransaction (HTTP 429)…`); after a 20 s pause:

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
  KfHb…zMFQ  +0.000020096 SOL
  2q5p…fWGJ  +0.00001 SOL
  8mia…xrth  +0.000012059 SOL
  8Xx3…Tj2g  +0.00377886 Xsc9…9qEh
  8sLb…Lwxj  -0.008026613 WSOL
  8sLb…Lwxj  +0.586474 EPjF…Dt1v
  gbUh…9WYs  -184,615.488546 DxXJ…pump
  ANhJ…RmXf  +184,615.488546 DxXJ…pump
  8Xx3…Tj2g  -0.586474 EPjF…Dt1v
  5YxQ…vxeD  +0.00000098 Xsc9…9qEh
  ANhJ…RmXf  -0.00377984 Xsc9…9qEh

Transfers
  gbUh…9WYs → ANhJ…RmXf  184,615.488546 DxXJ…pump  (inner)
  ANhJ…RmXf → gbUh…9WYs  0.00377886 Xsc9…9qEh  (inner)
  ANhJ…RmXf → 5YxQ…vxeD  0.00000098 Xsc9…9qEh  (inner)
  gbUh…9WYs → 8Xx3…Tj2g  0.00377886 Xsc9…9qEh  (inner)
  8Xx3…Tj2g → gbUh…9WYs  0.586474 EPjF…Dt1v  (inner)
  gbUh…9WYs → 8sLb…Lwxj  0.586474 EPjF…Dt1v  (inner)
  8sLb…Lwxj → 6hqu…MiJP  0.008026613 WSOL  (inner)
  gbUh…9WYs → 8mia…xrth  0.000012059 SOL
  gbUh…9WYs → KfHb…zMFQ  0.000020096 SOL
  gbUh…9WYs → 2q5p…fWGJ  0.00001 SOL
```

`node bin/cli.js 5GdMZeap…kZP8 --json` (first lines):

```
{
  "signature": "5GdMZeap3wrqtCkHRsc9M8UNCaKHD6cm9MoDT2xY39RJg5nW8sQ9inA6hWRCf4hXWgnqsb7Bb6NaYNojTvzGkZP8",
  "slot": 470679566,
  "blockTime": 1794949880,
  "time": "2026-11-17T21:11:20.000Z",
  "version": "legacy",
  "status": "failed",
  "error": {
    "raw": {
      "InstructionError": [
        2,
        {
          "Custom": 6001
        }
      ]
    },
    "message": "instruction 2 (L2TExMFKdjpN9kozasaurPirfHy9P8sbXoAN1qA3S95) failed: custom program error 6001 (0x1771)",
    "instructionIndex": 2,
    "programId": "L2TExMFKdjpN9kozasaurPirfHy9P8sbXoAN1qA3S95",
    "program": "L2TExMFKdjpN9kozasaurPirfHy9P8sbXoAN1qA3S95",
    "customCode": 6001,
    "log": "Program L2TExMFKdjpN9kozasaurPirfHy9P8sbXoAN1qA3S95 failed: custom program error: 0x1771"
  },
  "feePayer": "3Xtu99JsQ2j7r6DJW5TqMz9hDEBeDC75XdNK5mYxTUjT",
  …
```

README library snippet (run as a file inside the package so `import "solana-tx-parse"` resolves by self-reference, with each commented line printed):

```
success
{
  lamports: 106500,
  sol: 0.0001065,
  baseLamports: 5000,
  priorityLamports: 101500,
  priorityLamportsDeclared: 101500,
  signatures: 1
}
{
  consumed: 255,
  limit: 203000,
  limitSource: 'default',
  priceMicroLamports: 500000
}
{
  instruction: '0',
  inner: false,
  programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  program: 'Token Program',
  kind: 'token',
  from: '7dQmths1cyCQ4xaC5KcVfXz4BvVWtnHc3hcgnfnE1PBx',
  to: 'F4i1KiMiu6wRR6Nc11WisWnWcNFCxqh6WGUSfJnwoXyi',
  fromOwner: 'H8sMJSCQxfKiFTCfDR3DUMLPwcRbM61LGFJ8N4dK3WjS',
  toOwner: '3vKWT4RcdQUx63gfU6dyTGf1fDpoJrQ8PSuHUbF2AxbM',
  mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  decimals: 6,
  amount: 37.742077,
  raw: '37742077',
  authority: 'H8sMJSCQxfKiFTCfDR3DUMLPwcRbM61LGFJ8N4dK3WjS'
}
[
  {
    owner: 'H8sMJSCQxfKiFTCfDR3DUMLPwcRbM61LGFJ8N4dK3WjS',
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    decimals: 6,
    pre: 1571864.428863,
    post: 1571826.686786,
    change: -37.742077,
    changeRaw: '-37742077',
    programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
    accounts: [ '7dQmths1cyCQ4xaC5KcVfXz4BvVWtnHc3hcgnfnE1PBx' ]
  },
  {
    owner: '3vKWT4RcdQUx63gfU6dyTGf1fDpoJrQ8PSuHUbF2AxbM',
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    decimals: 6,
    pre: 0.297579,
    post: 38.039656,
    change: 37.742077,
    changeRaw: '37742077',
    programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
    accounts: [ 'F4i1KiMiu6wRR6Nc11WisWnWcNFCxqh6WGUSfJnwoXyi' ]
  }
]
[]
```

The docs/API.md import block was also run the same way: every name resolves (`all imports defined: true`).

## Examples

`node examples/offline-fixture.js`

```
Signature  2axWwMEc9F41wpeitiAzxfqaByUEQSfX1ghp4AcdFmUXsa69jEYSgRqhhhoUgtMCBGv6sutdAZ6yAfKwKoLXBP1d
Status     success
Slot       470,680,152 · 2026-11-17 21:13:27 UTC · version legacy
Fee payer  VzxTjAwPx8PTZRFgQoSqVnnvKKKsQFB3TgZRRf187pb
Fee        0.00000875 SOL (8,750 lamports: base 5,000 + priority 3,750)
Compute    83,261 CU used of 150,000 @ 25,000 micro-lamports/CU
Programs   Compute Budget, pump.fun, System Program, pfee…ojVZ, Token-2022

Swaps (balance-delta heuristic)
  VzxT…87pb (signer)  0.135588207 SOL → 3,306,286.203444 73s8…vush  via pump.fun, pfee…ojVZ
  + 1 counterpart leg(s) by pools or other non-signers (see --json)

Balance changes
  VzxT…87pb  -0.135596957 SOL (includes the fee)
  5YxQ…vxeD  +0.000629777 SOL
  62qc…fNgV  +0.000629778 SOL
  D1z7…Hrfj  +0.000397755 SOL
  EUs5…qBv4  +0.0013462 SOL
  J3ap…VZCS  +0.132584697 SOL
  J3ap…VZCS  -3,306,286.203444 73s8…vush
  VzxT…87pb  +3,306,286.203444 73s8…vush

Transfers
  J3ap…VZCS → VzxT…87pb  3,306,286.203444 73s8…vush  (inner)
  VzxT…87pb → D1z7…Hrfj  0.000397755 SOL  (inner)
  VzxT…87pb → J3ap…VZCS  0.132584697 SOL  (inner)
  VzxT…87pb → 5YxQ…vxeD  0.000629777 SOL  (inner)
  VzxT…87pb → 62qc…fNgV  0.000629778 SOL  (inner)
```

`node examples/swaps.js`

```
pump-buy: VzxTjAwPx8PTZRFgQoSqVnnvKKKsQFB3TgZRRf187pb put in 0.135588207 SOL, got 3306286.203444 73s8b6dbxPSGVMyzhZ8HHQpdtmMC1e61HR8QHLh5vush via pump.fun, pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ
jupiter-swap-v1: gbUhftbTCP1qcsDHTbEDVDaPSZZM1uTMpiTCDV99WYs put in 184615.488546 DxXJjXjS9A6QZiQUUTizCmzZrmzAUqtKGpqRQY9kpump, got 0.007984458 SOL via 6Vo3245eszAb5wuqEMw8mGdbfRUdKbHhDHP5LcaGuTAB, PumpSwap AMM, Jupiter v6, Meteora DLMM, Raydium CLMM
jupiter-swap-v0: 6Mo8FHvntTsgpjex4dMXjMWaAf9yLPgeJ6bmTLgQ7G63 put in 0.000001 SOL, got 0.001301 EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v via XXXaoN1GUF9895Tf9ojksGiGJa37F5op23QTYPvUH5H, Jupiter v6, Meteora DLMM, Orca Whirlpool, Raydium CLMM
```

`node examples/from-signature.js` (live)

```
Signature  x2nTgvSFFneAKW5W5mHcfMYhzen5o7Lfb1pBmepDQQDJZ4ud2Z7QpDxdYVVTVMDqG2e5TJ1qAA8zGDPAxdpudKR
Status     success
Slot       470,678,784 · 2026-11-17 21:08:28 UTC · version legacy
Fee payer  H8sMJSCQxfKiFTCfDR3DUMLPwcRbM61LGFJ8N4dK3WjS
Fee        0.0001065 SOL (106,500 lamports: base 5,000 + priority 101,500)
Compute    255 CU used of 203,000 (default limit) @ 500,000 micro-lamports/CU
Programs   Token Program, Compute Budget

Balance changes
  H8sM…3WjS  -0.0001065 SOL (includes the fee)
  H8sM…3WjS  -37.742077 EPjF…Dt1v
  3vKW…AxbM  +37.742077 EPjF…Dt1v

Transfers
  H8sM…3WjS → 3vKW…AxbM  37.742077 EPjF…Dt1v

priority fee: 101500 lamports · compute used: 255
```

`node examples/batch.js` (live)

```
4pLRvkZ9…  legacy  success  fee 8000 lamports  programs: System Program, Compute Budget
5GdMZeap…  legacy  failed (instruction 2 (L2TExMFKdjpN9kozasaurPirfHy9P8sbXoAN1qA3S95) failed: custom program error 6001 (0x1771))  fee 5002 lamports  programs: Compute Budget, L2TExM, pump.fun, Token-2022, System Program
2JRmPD7a…  v1  success  fee 7726 lamports  programs: Associated Token Account, Token Program, System Program, 6Vo324, PumpSwap AMM, Token-2022, Jupiter v6, Meteora DLMM, Raydium CLMM
```

`node bin/cli.js --help`

```
solana-tx-parse: a Solana transaction, in words

  solana-tx-parse <signature>          readable summary: fee, status, programs, balance changes, transfers, swaps
  solana-tx-parse <signature> --json   the full parsed result as JSON
  solana-tx-parse <signature> --logs   include the program logs (with --json)

  --rpc <url> or SOLANA_RPC_URL        your RPC (default: https://api.mainnet-beta.solana.com, rate limited)

  Made by Blix, the Solana memecoin terminal: https://blixvip.com   Discord: https://discord.gg/grokbot
```

## Program IDs

Every ID in `PROGRAM_LABELS` was checked against the project's own source or docs (table in docs/API.md) and with one live `getMultipleAccounts` call: all 18 exist on mainnet with `executable: true` (owners: NativeLoader for System and Compute Budget, BPFLoader / BPFLoader2 for Memo v1, Memo and ATA, BPFLoaderUpgradeable for the rest).

## Fee arithmetic

On all six fixtures `fee.priorityLamportsDeclared` (from the decoded Compute Budget instructions, or v1 `transactionConfig`) equals `fee.priorityLamports` (fee − 5,000 × signatures). For the two fixtures with no `SetComputeUnitLimit`, the default limit the parser works out (6,000 and 203,000) matches the limit the runtime printed in the logs ("consumed 105 of 203000").

## Docs site (GitHub Pages, `docs/`)

Checked 2026-11-17, Node v24.15.0, Windows 11. Every JavaScript block on `docs/index.html`, `docs/parse-solana-transaction-nodejs-without-web3js.html` and `docs/solana-transaction-priority-fee.html` was extracted from the HTML (entities unescaped), saved as `.mjs` and run against the public mainnet RPC, one at a time with 3 s pauses, with this repository installed as `solana-tx-parse` in a scratch folder. All five exited 0, and the output shown on the pages is the output they printed. The zero-dependency Compute Budget snippet was also run on the pump.fun buy `2axWwMEc…XBP1d`: `fee 8750 = base 5000 + priority 3750`, `price 25000 x limit 150000 = 3750`, matching the parser.

The error quoted on the pages for a v1 transaction requested with `maxSupportedTransactionVersion: 0` is the public RPC's real answer (code `-32015`) for `2JRmPD7a…Fj7QpU`.

## Integrations

`examples/integrations/`. Both files import `solana-tx-parse` by name; Node resolves that to this package through its `exports` field, so they run unchanged inside the repo and in a project that installed it.

### `http-endpoint/server.js`

Started with `node examples/integrations/http-endpoint/server.js`, then:

```
$ curl localhost:8787/tx/x2nTgvSF…dpudKR          (first call: fetched from the public RPC)
{"status":"success","feePayer":"H8sMJSCQxfKiFTCfDR3DUMLPwcRbM61LGFJ8N4dK3WjS","fee":106500,"priority":101500,"transfers":1}
HTTP 200 0.263686s
$ curl "localhost:8787/tx/x2nTgvSF…dpudKR?format=text"   (second call: from the in-memory cache)
Signature  x2nTgvSFFneAKW5W5mHcfMYhzen5o7Lfb1pBmepDQQDJZ4ud2Z7QpDxdYVVTVMDqG2e5TJ1qAA8zGDPAxdpudKR
Status     success
Slot       470,678,784 · 2026-11-17 21:08:28 UTC · version legacy
HTTP 200 0.034393s
$ curl localhost:8787/tx/notasig
{ "error": "InvalidInputError", "message": "not a transaction signature: notasig" }    HTTP 400
$ curl localhost:8787/foo
{ "error": "use GET /tx/<signature>" }    HTTP 404
$ curl localhost:8787/tx/1111111111111111111111111111111111111111111111111111111111111111
{ "error": "TransactionNotFoundError", "message": "transaction 1111…1111 was not found: …" }    HTTP 404
```

The first JSON line is a summary of the response made with `node -e`; the body itself is the full `parseTransaction` result. Not exercised: the 502/503/504 branches (they map the library's `RpcError`, 429 and `RpcTimeoutError`, which `test/rpc.test.js` covers).

### `discord-webhook/notify.js`

- `--dry-run` on `x2nTgvSF…dpudKR` printed the webhook body: one embed, title `Confirmed transaction x2nT…udKR`, green, the CLI summary in a code block, fields Fee payer / Fee / Programs.
- Sent for real to a **local stand-in webhook** (a `node:http` server on 127.0.0.1 that answers 204 like Discord): `DISCORD_WEBHOOK_URL=http://127.0.0.1:8790/api/webhooks/test node …/notify.js 5GdMZeap…kZP8` printed `posted 5GdM…kZP8 to Discord (HTTP 204)`; the server received `POST /api/webhooks/test application/json 1448 bytes`, embed `Failed transaction 5GdM…kZP8`, red, fields `Fee payer, Fee, Programs, Error`.
- No webhook URL and no `--dry-run`: usage message, exit 1. Unreachable webhook: `TypeError: fetch failed`, exit 1.
- **Not verified:** posting to a real Discord channel (no webhook URL was available for this check). The body follows Discord's documented webhook format (`username`, `embeds[]` with `title`, `url`, `color`, `description` up to 4,096 characters, `fields`, `timestamp`, `footer`).

### Found while doing this

`node bin/cli.js 1111…1111` (a well-formed but unknown signature) prints the right error and then crashes on Windows with `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)`, exit code 127 instead of 1: `process.exit()` right after a fetch. solana-token-meta fixed the same thing by setting `process.exitCode`. Filed as [#7](https://github.com/blixvip/solana-tx-parse/issues/7); the integration scripts already use `process.exitCode`.

## Not verified

- `npx github:blixvip/solana-tx-parse …` and `npm install github:blixvip/solana-tx-parse`: the repo is not published; the same code was run as `node bin/cli.js` and via package self-reference.
- `index.d.ts` was not type-checked: no TypeScript compiler is installed and the brief rules out adding a dependency. It was written by hand against the code.
- No Token-2022 `transferChecked` with transfer fees, no `transferWithSeed`, no Ed25519/secp256k1 precompile signatures, no Memo-only or Metaplex transaction is in the fixtures; those paths are covered by reading, not by a test on real data.
- Raydium AMM v4, Raydium CPMM, Meteora DAMM v1/v2 and Metaplex labels are verified as IDs, but no captured fixture invokes them.
- Keyed RPC providers (Helius, QuickNode, …) were not tried; only the public endpoint.

## Known limitations

See README, "Limitations": the swap detection is a balance-delta heuristic (the v0 fixture, an arbitrage, shows a 1,000-lamport SOL → 0.001301 USDC "swap"); no instruction decoding beyond System, SPL Token and Compute Budget; transfers to token accounts created and closed in the same transaction have no `toOwner`; precompile signatures are not counted in the base fee.
