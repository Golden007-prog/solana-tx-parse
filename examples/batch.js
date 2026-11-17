// Parse several signatures, one request at a time with a pause, as a public RPC likes it.
// node examples/batch.js
import { parseTransactions } from "../src/index.js";

const signatures = [
  "4pLRvkZ9zuBUDNHnGUtHYi7f9Qm1Wwaod6H2gCutzsxUx1td6n1x292aDZ65HiYX7kD64VC9ZPeayJKVsk4qU3bo",
  "5GdMZeap3wrqtCkHRsc9M8UNCaKHD6cm9MoDT2xY39RJg5nW8sQ9inA6hWRCf4hXWgnqsb7Bb6NaYNojTvzGkZP8",
  "2JRmPD7aXWeSwvpax5M1MNgUyjJmL6ixxtoQz7osMTBnWSgPC1kCo5cnSKj1sWiZkEQh34dfuucRVYGTtEFj7QpU",
];
const results = await parseTransactions(signatures, { concurrency: 1, delayMs: 1000, rpcUrl: process.env.SOLANA_RPC_URL });
for (const r of results) {
  if (!r.ok) { console.log(`${r.signature.slice(0, 8)}…  error: ${r.error.message}`); continue; }
  const t = r.tx;
  console.log(`${r.signature.slice(0, 8)}…  ${t.version === "legacy" ? "legacy" : `v${t.version}`}  ${t.status}${t.error ? ` (${t.error.message})` : ""}  fee ${t.fee.lamports} lamports  programs: ${t.programs.map((p) => p.label || p.programId.slice(0, 6)).join(", ")}`);
}
