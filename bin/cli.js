#!/usr/bin/env node
// solana-tx-parse <signature> [--json] [--rpc <url>]
import { parseTransaction, formatSummary, PUBLIC_RPC } from "../src/index.js";

const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); if (i < 0) return false; args.splice(i, 1); return true; };
const value = (name) => { const i = args.indexOf(name); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
const rpc = value("--rpc");
if (rpc !== null) {
  if (!rpc || rpc.startsWith("-")) {
    console.error("--rpc requires a URL");
    process.exit(1);
  }
  if (!/^https?:\/\//i.test(rpc) || !URL.canParse(rpc)) {
    console.error("--rpc expects a valid HTTP or HTTPS URL");
    process.exit(1);
  }
}
const json = flag("--json"), logs = flag("--logs"), help = flag("-h") || flag("--help");
const rpcUrl = rpc || process.env.SOLANA_RPC_URL || PUBLIC_RPC;
const signature = args[0];
if (help || !signature) {
  console.log(`solana-tx-parse: a Solana transaction, in words

  solana-tx-parse <signature>          readable summary: fee, status, programs, balance changes, transfers, swaps
  solana-tx-parse <signature> --json   the full parsed result as JSON
  solana-tx-parse <signature> --logs   include the program logs (with --json)

  --rpc <url> or SOLANA_RPC_URL        your HTTP(S) RPC (default: ${PUBLIC_RPC}, rate limited)

  Made by Blix, the Solana memecoin terminal: https://blixvip.com   Discord: https://discord.gg/grokbot`);
  process.exit(help ? 0 : 1);
}
try {
  const p = await parseTransaction(signature, { rpcUrl, includeLogs: logs });
  console.log(json ? JSON.stringify(p, null, 2) : formatSummary(p));
} catch (e) {
  console.error(`${e.name}: ${e.message}`);
  process.exit(1);
}
