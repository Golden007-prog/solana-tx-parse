# Contributing to solana-tx-parse

Thanks for helping. solana-tx-parse is part of the [BLIX open-source tools](https://github.com/blixvip) for Solana developers. Small, focused pull requests are the easiest to review and the fastest to merge.

## Before you start

- Look for issues labelled [`good first issue`](https://github.com/blixvip/solana-tx-parse/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) or [`help wanted`](https://github.com/blixvip/solana-tx-parse/issues?q=is%3Aissue+is%3Aopen+label%3A%22help+wanted%22).
- Comment on the issue to claim it, or ask in the [Discord](https://discord.gg/grokbot) first if you plan something larger than a bug fix, so nobody builds the same thing twice.
- Found a security problem? Do not open an issue. Follow [SECURITY.md](SECURITY.md).

## Set up

```bash
git clone https://github.com/blixvip/solana-tx-parse.git
cd solana-tx-parse
npm install   # installs nothing at runtime; the package has no dependencies
npm test
```

Node 20 or newer. Tests run offline against recorded fixtures, so you do not need an RPC key to contribute.

## Making a change

1. Branch from `main`.
2. Keep the change to one concern. Add or update a test that fails without your change.
3. Run the checks:
   ```bash
   npm test
   ```
4. If you changed behaviour or the public API, update `README.md`, `docs/API.md`, `index.d.ts` and the `Unreleased` section of `CHANGELOG.md`.
5. Open a pull request and fill in the template.

## Ground rules

- No runtime dependencies without discussing it in an issue first. Zero dependencies is a feature of this project.
- No API keys, private RPC URLs or wallet keys in code, tests, fixtures or screenshots.
- Never add code that signs or sends transactions unless the issue explicitly asks for it.
- Test fixtures must be real responses from a public Solana RPC, trimmed if large. Note where each came from.
- Write docs in plain language. Only document what the code really does.

## Recording a fixture

Call the method against `https://api.mainnet-beta.solana.com` (or your own RPC), save the JSON-RPC `result` under `test/fixtures/<name>.json`, and add a line to the test saying what it is (mint, signature or account).

## Recognition

Every merged contributor is credited by GitHub handle in the release notes and in `CHANGELOG.md`. Regular contributors are invited to help triage and review.

## Code of conduct

This project follows the [Code of Conduct](CODE_OF_CONDUCT.md). Be kind and assume good intent.
