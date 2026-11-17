// Plain-text rendering of a parsed transaction, as the CLI prints it.
import { SOL } from "./parse.js";
import { WSOL_MINT } from "./programs.js";

const short = (a) => (a && a.length > 12 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a || "?");
const num = (n) => (n == null ? "?" : Number(n).toLocaleString("en-US", { maximumFractionDigits: 9 }));
const signed = (n) => (n > 0 ? `+${num(n)}` : num(n));
const asset = (mint) => (mint === SOL ? "SOL" : mint === WSOL_MINT ? "WSOL" : short(mint));
const label = (x) => (x && x.length > 40 ? short(x) : x);

/**
 * A readable multi-line summary of parseTransaction()'s result.
 * @param {object} p  the parsed transaction
 * @param {{ maxRows?: number }} [opts]  maxRows caps each list (default 12)
 */
export function formatSummary(p, { maxRows = 12 } = {}) {
  const lines = [];
  const row = (k, v) => lines.push(`${k.padEnd(11)}${v}`);
  const capped = (list, render) => {
    for (const x of list.slice(0, maxRows)) lines.push("  " + render(x));
    if (list.length > maxRows) lines.push(`  … ${list.length - maxRows} more (use --json for all)`);
  };

  row("Signature", p.signature);
  row("Status", p.status === "success" ? "success" : `FAILED: ${p.error?.message}${p.error?.log ? `\n${" ".repeat(11)}${p.error.log}` : ""}`);
  row("Slot", `${num(p.slot)}${p.time ? ` · ${p.time.replace("T", " ").replace(".000Z", " UTC")}` : ""} · version ${p.version}${p.accounts.fromLookupTables ? ` · ${p.accounts.fromLookupTables} accounts from ${p.accounts.lookupTables.length} lookup table(s)` : ""}`);
  row("Fee payer", p.feePayer);
  const f = p.fee;
  row("Fee", `${num(f.sol)} SOL (${num(f.lamports)} lamports: base ${num(f.baseLamports)} + priority ${num(f.priorityLamports)})`);
  const cu = p.computeUnits;
  const price = cu.priceMicroLamports != null ? ` @ ${num(cu.priceMicroLamports)} micro-lamports/CU` : p.computeBudget.source === "transactionConfig" && p.computeBudget.priorityFeeLamports != null ? ` · priority fee set to ${num(p.computeBudget.priorityFeeLamports)} lamports` : "";
  row("Compute", `${num(cu.consumed)} CU used of ${num(cu.limit)}${cu.limitSource === "default" ? " (default limit)" : ""}${price}`);
  row("Programs", p.programs.map((x) => x.label || short(x.programId)).join(", "));

  if (p.swaps.length) {
    // Signers are the traders; the other entries are usually pools, curves and vaults on the far side.
    const bySigner = p.swaps.filter((s) => s.isSigner);
    const shown = bySigner.length ? bySigner : p.swaps;
    lines.push("", "Swaps (balance-delta heuristic)");
    capped(shown, (s) => `${short(s.owner)}${s.isSigner ? " (signer)" : ""}  ${num(s.in.amount)} ${asset(s.in.mint)} → ${num(s.out.amount)} ${asset(s.out.mint)}${s.via.length ? `  via ${s.via.map(label).join(", ")}` : ""}`);
    if (shown.length < p.swaps.length) lines.push(`  + ${p.swaps.length - shown.length} counterpart leg(s) by pools or other non-signers (see --json)`);
  }
  const changes = [...p.solChanges.filter((c) => !c.isTokenAccount), ...p.tokenChanges];
  if (changes.length) {
    lines.push("", "Balance changes");
    capped(changes, (c) => `${short(c.owner)}  ${signed(c.change)} ${asset(c.mint)}${c.isFeePayer ? " (includes the fee)" : ""}`);
  }
  if (p.transfers.length) {
    lines.push("", "Transfers");
    capped(p.transfers, (t) => `${short(t.fromOwner || t.from)} → ${short(t.toOwner || t.to)}  ${num(t.amount ?? t.raw)} ${asset(t.mint)}${t.inner ? "  (inner)" : ""}`);
  }
  for (const w of p.warnings) lines.push("", `warning: ${w}`);
  return lines.join("\n");
}
