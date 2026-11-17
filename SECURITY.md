# Security policy

## Supported versions

The latest release on `main` receives security fixes.

## Reporting a vulnerability

Please do **not** open a public issue. Use GitHub's private reporting instead: **[Report a vulnerability](https://github.com/blixvip/solana-tx-parse/security/advisories/new)**. Include what you found, how to reproduce it and the impact you expect. You will get a reply within 7 days, and credit in the advisory once a fix ships, unless you prefer to stay anonymous.

## Scope and safety model

solana-tx-parse is a read-only developer tool. It never asks for a private key or seed phrase and never signs or sends a transaction. If anything that claims to be this project asks for a key, it is not this project.

Things worth reporting:

- A way to make the library send requests to a host the user did not configure.
- Leaking an RPC URL or API key (for example into logs, errors or output) when the user did not ask for it.
- Crashes or unbounded memory/CPU from crafted on-chain data or RPC responses.
- Supply-chain issues in the published package.

## Handling your RPC key

RPC URLs often contain an API key. Keep them in environment variables, not in code. solana-tx-parse redacts keys from its error messages where it can, but treat your terminal output as sensitive when you share it.
