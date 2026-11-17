# HTTP endpoint: `GET /tx/<signature>`

A JSON API for parsed Solana transactions in about 50 lines, using only `node:http`. Put it behind your frontend, a bot or a spreadsheet.

```bash
node examples/integrations/http-endpoint/server.js
```

```bash
curl http://localhost:8787/tx/x2nTgvSFFneAKW5W5mHcfMYhzen5o7Lfb1pBmepDQQDJZ4ud2Z7QpDxdYVVTVMDqG2e5TJ1qAA8zGDPAxdpudKR
curl "http://localhost:8787/tx/x2nTgvSFFneAKW5W5mHcfMYhzen5o7Lfb1pBmepDQQDJZ4ud2Z7QpDxdYVVTVMDqG2e5TJ1qAA8zGDPAxdpudKR?format=text"
```

| | |
|---|---|
| `GET /tx/<signature>` | The full `parseTransaction` result as JSON |
| `GET /tx/<signature>?format=text` | The same summary the CLI prints |
| 400 | Not a signature |
| 404 | Transaction not found (not confirmed yet, or older than the RPC's history) |
| 502 / 503 / 504 | RPC error / RPC rate limit (429) / RPC timeout |

Configuration: `PORT` (default `8787`), `SOLANA_RPC_URL` (default: the free public mainnet RPC, which rate limits quickly; use your own endpoint for anything real).

Confirmed transactions never change, so the last 500 results are kept in memory. CORS is open (`access-control-allow-origin: *`) so a browser page can call it; tighten that if you deploy it.

## In your own project

```bash
npm install github:blixvip/solana-tx-parse
```

Copy `server.js`; the import `from "solana-tx-parse"` works as is. Run on Node 20 or newer.

How this was checked: see [VERIFY.md](../../../VERIFY.md#integrations).
