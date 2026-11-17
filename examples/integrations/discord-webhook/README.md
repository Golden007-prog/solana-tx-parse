# Discord webhook: post a transaction summary to a channel

Parse a Solana transaction and post it to Discord as an embed: status, fee payer, fee and priority fee, programs, the signer's swap, any error, and the full text summary. A webhook needs no bot account and no Discord library.

```bash
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/... \
  node examples/integrations/discord-webhook/notify.js <signature>
```

Check what would be sent without posting anything:

```bash
node examples/integrations/discord-webhook/notify.js x2nTgvSFFneAKW5W5mHcfMYhzen5o7Lfb1pBmepDQQDJZ4ud2Z7QpDxdYVVTVMDqG2e5TJ1qAA8zGDPAxdpudKR --dry-run
```

## Get a webhook URL

In Discord: channel settings → Integrations → Webhooks → New Webhook → Copy Webhook URL. Keep it out of git: anyone with the URL can post in that channel.

## Ideas

- Call it from a `logsSubscribe` listener (see [solana-ws-keepalive](https://github.com/blixvip/solana-ws-keepalive)) to post every transaction of a wallet you watch.
- Only post failures: check `tx.status !== "success"` before sending.

Configuration: `DISCORD_WEBHOOK_URL` (required unless `--dry-run`), `SOLANA_RPC_URL` (default: the free public mainnet RPC).

## In your own project

```bash
npm install github:blixvip/solana-tx-parse
```

Copy `notify.js`; the import `from "solana-tx-parse"` works as is. Node 20 or newer.

How this was checked: see [VERIFY.md](../../../VERIFY.md#integrations).
