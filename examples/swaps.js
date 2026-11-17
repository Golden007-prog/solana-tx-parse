// Who swapped what: the signer's side of every captured swap fixture. No network.
// node examples/swaps.js
import fs from "node:fs";
import { parseFetchedTransaction } from "../src/index.js";

for (const name of ["pump-buy", "jupiter-swap-v1", "jupiter-swap-v0"]) {
  const tx = JSON.parse(fs.readFileSync(new URL(`../test/fixtures/${name}.json`, import.meta.url), "utf8"));
  for (const s of parseFetchedTransaction(tx).swaps.filter((s) => s.isSigner)) {
    console.log(`${name}: ${s.owner} put in ${s.in.amount} ${s.in.mint}, got ${s.out.amount} ${s.out.mint} via ${s.via.join(", ")}`);
  }
}
