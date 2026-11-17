// Post a Solana transaction's summary to a Discord channel through a webhook. No bot, no dependencies.
//
//   DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/... node examples/integrations/discord-webhook/notify.js <signature>
//   node examples/integrations/discord-webhook/notify.js <signature> --dry-run   (print the payload, send nothing)
//
// Create the webhook in Discord: channel settings > Integrations > Webhooks > New Webhook > Copy Webhook URL.
// Treat that URL like a password: anyone who has it can post to the channel.
import { parseTransaction, formatSummary } from "solana-tx-parse";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const signature = args.find((a) => !a.startsWith("--"));
const webhook = process.env.DISCORD_WEBHOOK_URL;
if (!signature || (!webhook && !dryRun)) {
  console.error("usage: DISCORD_WEBHOOK_URL=<url> node notify.js <signature> [--dry-run]");
  process.exit(1);
}

const short = (a) => (a ? `${a.slice(0, 4)}…${a.slice(-4)}` : "?");

/** Build a Discord webhook body: one embed with the headline facts, and the full text summary in a code block. */
function discordPayload(tx) {
  const failed = tx.status !== "success";
  const signerSwap = tx.swaps.find((s) => s.isSigner);
  const fields = [
    { name: "Fee payer", value: `\`${short(tx.feePayer)}\``, inline: true },
    { name: "Fee", value: `${tx.fee.sol} SOL (priority ${tx.fee.priorityLamports.toLocaleString("en-US")} lamports)`, inline: true },
    { name: "Programs", value: tx.programs.map((p) => p.label || short(p.programId)).join(", ").slice(0, 1024) || "none" },
  ];
  if (signerSwap) fields.push({ name: "Swap", value: `${signerSwap.in.amount} ${short(signerSwap.in.mint)} → ${signerSwap.out.amount} ${short(signerSwap.out.mint)}` });
  if (failed) fields.push({ name: "Error", value: tx.error.message.slice(0, 1024) });
  // Discord caps an embed description at 4,096 characters.
  const summary = formatSummary(tx, { maxRows: 8 });
  return {
    username: "solana-tx-parse",
    embeds: [{
      title: `${failed ? "Failed" : "Confirmed"} transaction ${short(tx.signature)}`,
      url: `https://solscan.io/tx/${tx.signature}`,
      color: failed ? 0xe5484d : 0x30a46c,
      description: "```\n" + summary.slice(0, 3900) + "\n```",
      fields,
      timestamp: tx.time ?? undefined,
      footer: { text: "solana-tx-parse · github.com/blixvip/solana-tx-parse" },
    }],
  };
}

// process.exitCode, not process.exit(): exiting while fetch's sockets close can crash Node on Windows.
try {
  const tx = await parseTransaction(signature, { rpcUrl: process.env.SOLANA_RPC_URL });
  const body = discordPayload(tx);
  if (dryRun) {
    console.log(JSON.stringify(body, null, 2));
  } else {
    const res = await fetch(webhook, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(10_000) });
    if (!res.ok) { console.error(`Discord answered HTTP ${res.status}: ${await res.text()}`); process.exitCode = 1; }
    else console.log(`posted ${short(tx.signature)} to Discord (HTTP ${res.status})`);
  }
} catch (e) {
  console.error(`${e.name}: ${e.message}`);
  process.exitCode = 1;
}
