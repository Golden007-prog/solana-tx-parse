// Fetch one transaction by signature and print its summary. Uses SOLANA_RPC_URL or the public mainnet RPC.
// node examples/from-signature.js [signature]
import { parseTransaction, formatSummary } from "../src/index.js";

const signature = process.argv[2] || "x2nTgvSFFneAKW5W5mHcfMYhzen5o7Lfb1pBmepDQQDJZ4ud2Z7QpDxdYVVTVMDqG2e5TJ1qAA8zGDPAxdpudKR";
const p = await parseTransaction(signature, { rpcUrl: process.env.SOLANA_RPC_URL });
console.log(formatSummary(p));
console.log(`\npriority fee: ${p.fee.priorityLamports} lamports · compute used: ${p.computeUnits.consumed}`);
