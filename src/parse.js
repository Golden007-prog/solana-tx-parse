// The parser: a fetched transaction in, a readable summary out. Pure: no network.
import { b58decode, readUintLE } from "./base58.js";
import { programLabel, INFRASTRUCTURE_PROGRAMS, SYSTEM_PROGRAM, TOKEN_PROGRAM, TOKEN_2022_PROGRAM, COMPUTE_BUDGET_PROGRAM, WSOL_MINT } from "./programs.js";
import { InvalidInputError } from "./errors.js";

/** The pseudo-mint used for native SOL in balance changes, transfers and swaps. */
export const SOL = "SOL";
/** Lamports charged per signature (the base fee on mainnet). */
export const LAMPORTS_PER_SIGNATURE = 5000;
const MAX_COMPUTE_UNIT_LIMIT = 1_400_000;

// Programs the runtime treats as builtins: an instruction to one of these gets a default budget of 3,000 compute
// units instead of 200,000 when the transaction does not set its own limit.
const BUILTINS = new Set([
  SYSTEM_PROGRAM, COMPUTE_BUDGET_PROGRAM,
  "AddressLookupTab1e1111111111111111111111111", "Vote111111111111111111111111111111111111111",
  "Stake11111111111111111111111111111111111111", "Config1111111111111111111111111111111111111",
  "BPFLoader1111111111111111111111111111111111", "BPFLoader2111111111111111111111111111111111",
  "BPFLoaderUpgradeab1e11111111111111111111111", "LoaderV411111111111111111111111111111111111",
  "Ed25519SigVerify111111111111111111111111111", "KeccakSecp256k11111111111111111111111111111",
  "Secp256r1SigVerify1111111111111111111111111", "ZkE1Gama1Proof11111111111111111111111111111",
]);

// ---------------------------------------------------------------- amounts

/** Exact decimal text for a raw integer amount with `decimals` places ("-1.5", "0.000005"). */
export function formatUnits(raw, decimals) {
  let v = BigInt(raw);
  const neg = v < 0n; if (neg) v = -v;
  const d = BigInt(10) ** BigInt(decimals);
  const whole = v / d, frac = decimals > 0 ? (v % d).toString().padStart(decimals, "0").replace(/0+$/, "") : "";
  return `${neg ? "-" : ""}${whole}${frac ? "." + frac : ""}`;
}
const ui = (raw, decimals) => Number(formatUnits(raw, decimals));

// ---------------------------------------------------------------- account keys

/**
 * Every account the transaction touched, in the order its balance arrays and instruction indexes use.
 * For a v0 transaction fetched with `encoding: "json"` (or "base64"), the addresses loaded from address lookup tables
 * are not in `message.accountKeys`: they sit in `meta.loadedAddresses` and are appended here, writable first, then
 * read-only, which is the order the runtime uses. With `jsonParsed` the RPC has already merged them (each key carries
 * `source: "lookupTable"`), so nothing is appended twice.
 * @returns {{ pubkey: string, signer: boolean, writable: boolean, source: "transaction" | "lookupTable" }[]}
 */
export function resolveAccountKeys(tx) {
  const msg = tx.transaction.message, meta = tx.meta || {};
  const raw = msg.accountKeys || [];
  const header = msg.header || null;
  const n = raw.length;
  const keys = raw.map((k, i) => {
    if (typeof k === "string") {
      // json encoding: signer and writable come from the message header.
      const req = header?.numRequiredSignatures ?? 1, roSigned = header?.numReadonlySignedAccounts ?? 0, roUnsigned = header?.numReadonlyUnsignedAccounts ?? 0;
      const signer = i < req;
      const writable = signer ? i < req - roSigned : i < n - roUnsigned;
      return { pubkey: k, signer, writable, source: "transaction" };
    }
    return { pubkey: k.pubkey, signer: Boolean(k.signer), writable: Boolean(k.writable), source: k.source === "lookupTable" ? "lookupTable" : "transaction" };
  });
  const alreadyMerged = keys.some((k) => k.source === "lookupTable");
  const loaded = meta.loadedAddresses;
  if (!alreadyMerged && loaded) {
    for (const pubkey of loaded.writable || []) keys.push({ pubkey, signer: false, writable: true, source: "lookupTable" });
    for (const pubkey of loaded.readonly || []) keys.push({ pubkey, signer: false, writable: false, source: "lookupTable" });
  }
  return keys;
}

// ---------------------------------------------------------------- instructions

/** One instruction in a common shape, whichever encoding it came in. */
function normalizeInstruction(ix, keys, path, depth) {
  const programId = ix.programId ?? keys[ix.programIdIndex]?.pubkey ?? null;
  const out = { path, inner: depth > 0, programId, parsed: null, accounts: [], data: null };
  if (ix.parsed && typeof ix.parsed === "object") { out.parsed = ix.parsed; out.program = ix.program || null; }
  else if (typeof ix.parsed === "string") { out.parsed = { type: "memo", info: ix.parsed }; out.program = ix.program || null; }
  if (Array.isArray(ix.accounts)) out.accounts = ix.accounts.map((a) => (typeof a === "number" ? keys[a]?.pubkey ?? null : a));
  if (typeof ix.data === "string") out.data = ix.data;
  return out;
}

/** Top-level and inner instructions, flattened in execution order. `path` is "2" for a top-level one, "2.1" for its first inner one. */
export function flattenInstructions(tx, keys = resolveAccountKeys(tx)) {
  const top = tx.transaction.message.instructions || [];
  const innerByIndex = new Map((tx.meta?.innerInstructions || []).map((g) => [g.index, g.instructions || []]));
  const out = [];
  top.forEach((ix, i) => {
    out.push(normalizeInstruction(ix, keys, String(i), 0));
    (innerByIndex.get(i) || []).forEach((inner, j) => out.push(normalizeInstruction(inner, keys, `${i}.${j + 1}`, 1)));
  });
  return out;
}

const dataBytes = (ix) => { if (!ix.data) return null; try { return b58decode(ix.data); } catch { return null; } };

// ---------------------------------------------------------------- compute budget and fee

/** Decode the Compute Budget instructions: SetComputeUnitLimit (2), SetComputeUnitPrice (3), RequestHeapFrame (1), SetLoadedAccountsDataSizeLimit (4). */
export function decodeComputeBudget(instructions) {
  const out = { unitLimit: null, unitPriceMicroLamports: null, heapFrameBytes: null, loadedAccountsDataSizeLimit: null };
  for (const ix of instructions) {
    if (ix.inner || ix.programId !== COMPUTE_BUDGET_PROGRAM) continue;
    const b = dataBytes(ix); if (!b || !b.length) continue;
    if (b[0] === 2) out.unitLimit = Number(readUintLE(b, 1, 4));
    else if (b[0] === 3) out.unitPriceMicroLamports = readUintLE(b, 1, 8);
    else if (b[0] === 1) out.heapFrameBytes = Number(readUintLE(b, 1, 4));
    else if (b[0] === 4) out.loadedAccountsDataSizeLimit = Number(readUintLE(b, 1, 4));
  }
  return out;
}

function feeBreakdown(tx, instructions) {
  const fee = Number(tx.meta?.fee ?? 0);
  const signatures = (tx.transaction.signatures || []).length || 1;
  const base = signatures * LAMPORTS_PER_SIGNATURE;
  const fees = (priorityDeclared) => ({
    lamports: fee, sol: ui(fee, 9),
    baseLamports: Math.min(base, fee),
    priorityLamports: Math.max(0, fee - base),
    priorityLamportsDeclared: priorityDeclared,
    signatures,
  });

  // v1 transactions carry their budget in message.transactionConfig: a unit limit and a priority fee in lamports
  // (not a per-unit price), and no Compute Budget instructions.
  const config = tx.transaction.message.transactionConfig;
  if (config && typeof config === "object") {
    const limit = config.computeUnitLimit ?? null, priority = config.priorityFee ?? null;
    return {
      computeBudget: { source: "transactionConfig", unitLimit: limit, unitPriceMicroLamports: null, priorityFeeLamports: priority, heapFrameBytes: config.heapSize ?? null, loadedAccountsDataSizeLimit: config.loadedAccountsDataSizeLimit ?? null, effectiveUnitLimit: limit, unitLimitSource: limit == null ? "default" : "transactionConfig" },
      fee: fees(priority == null ? null : Number(priority)),
    };
  }

  const cb = decodeComputeBudget(instructions);
  // The limit the price is charged on: the one the transaction set, or the runtime default
  // (200,000 per top-level instruction, 3,000 for builtins, at most 1.4M).
  let limit = cb.unitLimit, limitSource = "instruction";
  if (limit == null) {
    limit = instructions.filter((i) => !i.inner).reduce((s, i) => s + (BUILTINS.has(i.programId) ? 3_000 : 200_000), 0);
    limitSource = "default";
  }
  limit = Math.min(limit, MAX_COMPUTE_UNIT_LIMIT);
  const price = cb.unitPriceMicroLamports ?? 0n;
  // lamports = ceil(price in micro-lamports per unit × limit / 1,000,000)
  const declared = Number((price * BigInt(limit) + 999_999n) / 1_000_000n);
  return {
    computeBudget: { source: "instructions", ...cb, unitPriceMicroLamports: cb.unitPriceMicroLamports == null ? null : Number(cb.unitPriceMicroLamports), priorityFeeLamports: declared, effectiveUnitLimit: limit, unitLimitSource: limitSource },
    fee: fees(declared),
  };
}

// ---------------------------------------------------------------- errors

/** A readable description of `meta.err`, with the failing instruction's program and the program's own error line from the logs. */
export function describeError(err, instructions, logs = [], labels) {
  if (err == null) return null;
  const out = { raw: err, message: "", instructionIndex: null, programId: null, program: null, customCode: null, log: null };
  if (typeof err === "string") { out.message = err; }
  else if (err.InstructionError) {
    const [index, detail] = err.InstructionError;
    out.instructionIndex = index;
    const ix = instructions.find((i) => !i.inner && i.path === String(index));
    out.programId = ix?.programId ?? null;
    out.program = ix ? programLabel(ix.programId, labels) || ix.programId : null;
    let what;
    if (typeof detail === "string") what = detail;
    else if (detail && "Custom" in detail) { out.customCode = detail.Custom; what = `custom program error ${detail.Custom} (0x${Number(detail.Custom).toString(16)})`; }
    else what = JSON.stringify(detail);
    out.message = `instruction ${index}${out.program ? ` (${out.program})` : ""} failed: ${what}`;
  } else {
    const [k, v] = Object.entries(err)[0] || ["unknown", null];
    out.message = v == null ? k : `${k}: ${JSON.stringify(v)}`;
  }
  // The program's own words: Anchor's "Error Message: …", or the runtime's "Program X failed: …".
  const anchor = logs.find((l) => /Error Message:/.test(l));
  const failed = logs.find((l) => /^Program \w+ failed: /.test(l));
  const plainError = logs.find((l) => /^Program log: (Error|error)[: ]/.test(l));
  out.log = (anchor || plainError || failed || null);
  return out;
}

// ---------------------------------------------------------------- balances

function tokenAccountMaps(tx, keys) {
  const byAccount = new Map();
  const add = (list, which) => {
    for (const b of list || []) {
      const address = keys[b.accountIndex]?.pubkey; if (!address) continue;
      const e = byAccount.get(address) || { address, accountIndex: b.accountIndex, mint: b.mint, owner: b.owner || null, programId: b.programId || null, decimals: b.uiTokenAmount?.decimals ?? 0, pre: 0n, post: 0n };
      e[which] = BigInt(b.uiTokenAmount?.amount ?? "0");
      if (!e.owner && b.owner) e.owner = b.owner;
      byAccount.set(address, e);
    }
  };
  add(tx.meta?.preTokenBalances, "pre");
  add(tx.meta?.postTokenBalances, "post");
  return byAccount;
}

function solChanges(tx, keys, tokenAccounts) {
  const pre = tx.meta?.preBalances || [], post = tx.meta?.postBalances || [];
  const out = [];
  keys.forEach((k, i) => {
    if (pre[i] == null || post[i] == null) return;
    const d = BigInt(post[i]) - BigInt(pre[i]);
    if (d === 0n) return;
    out.push({
      owner: k.pubkey, mint: SOL, decimals: 9,
      pre: ui(pre[i], 9), post: ui(post[i], 9), change: ui(d, 9), changeRaw: d.toString(),
      isFeePayer: i === 0, isTokenAccount: tokenAccounts.has(k.pubkey),
    });
  });
  return out;
}

function tokenChanges(tokenAccounts) {
  const groups = new Map();
  for (const a of tokenAccounts.values()) {
    const owner = a.owner || a.address;
    const key = `${owner}|${a.mint}`;
    const g = groups.get(key) || { owner, mint: a.mint, decimals: a.decimals, programId: a.programId, pre: 0n, post: 0n, accounts: [] };
    g.pre += a.pre; g.post += a.post; g.accounts.push(a.address);
    groups.set(key, g);
  }
  const out = [];
  for (const g of groups.values()) {
    const d = g.post - g.pre;
    if (d === 0n) continue;
    out.push({ owner: g.owner, mint: g.mint, decimals: g.decimals, pre: ui(g.pre, g.decimals), post: ui(g.post, g.decimals), change: ui(d, g.decimals), changeRaw: d.toString(), programId: g.programId, accounts: g.accounts });
  }
  return out;
}

// ---------------------------------------------------------------- transfers

function transfers(instructions, tokenAccounts, labels) {
  const out = [];
  const tokenSide = (address) => tokenAccounts.get(address) || null;
  for (const ix of instructions) {
    const base = { instruction: ix.path, inner: ix.inner, programId: ix.programId, program: programLabel(ix.programId, labels) || ix.programId };
    if (ix.programId === SYSTEM_PROGRAM) {
      let from, to, lamports;
      if (ix.parsed && (ix.parsed.type === "transfer" || ix.parsed.type === "transferWithSeed")) {
        ({ source: from, destination: to, lamports } = ix.parsed.info || {});
      } else if (!ix.parsed) {
        const b = dataBytes(ix);
        if (b && readUintLE(b, 0, 4) === 2n && b.length >= 12) { lamports = readUintLE(b, 4, 8); [from, to] = ix.accounts; }
      }
      if (from && to && lamports != null) {
        const raw = BigInt(lamports);
        out.push({ ...base, kind: "sol", from, to, fromOwner: from, toOwner: to, mint: SOL, decimals: 9, amount: ui(raw, 9), raw: raw.toString(), authority: from });
      }
      continue;
    }
    if (ix.programId === TOKEN_PROGRAM || ix.programId === TOKEN_2022_PROGRAM) {
      let source, destination, raw = null, mint = null, decimals = null, authority = null;
      if (ix.parsed && ix.parsed.type === "transfer") {
        const i = ix.parsed.info || {};
        ({ source, destination } = i); raw = i.amount ?? i.tokenAmount?.amount; authority = i.authority || i.multisigAuthority || null;
      } else if (ix.parsed && ix.parsed.type === "transferChecked") {
        const i = ix.parsed.info || {};
        ({ source, destination, mint } = i); raw = i.tokenAmount?.amount; decimals = i.tokenAmount?.decimals ?? null; authority = i.authority || i.multisigAuthority || null;
      } else if (!ix.parsed) {
        const b = dataBytes(ix);
        if (b && b[0] === 3 && b.length >= 9) { raw = readUintLE(b, 1, 8); [source, destination, authority] = ix.accounts; }
        else if (b && b[0] === 12 && b.length >= 10) { raw = readUintLE(b, 1, 8); decimals = b[9]; [source, mint, destination, authority] = ix.accounts; }
      }
      if (source && destination && raw != null) {
        const s = tokenSide(source), d = tokenSide(destination);
        mint = mint || s?.mint || d?.mint || null;
        decimals = decimals ?? s?.decimals ?? d?.decimals ?? null;
        const r = BigInt(raw);
        out.push({ ...base, kind: "token", from: source, to: destination, fromOwner: s?.owner ?? authority ?? null, toOwner: d?.owner ?? null, mint, decimals, amount: decimals == null ? null : ui(r, decimals), raw: r.toString(), authority });
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------- swaps

/**
 * The swap heuristic. For each owner, net every asset it gained or lost in this transaction (native SOL and wrapped
 * SOL counted together as "SOL", the fee payer's fee added back). An owner that lost one asset and gained another
 * gets a swap: `in` is what it put in (went down), `out` is what it got out (went up).
 * When a side has more than one asset, SOL is dropped from that side first (it is usually rent or a tip); if that
 * still leaves several, the first is used and the rest are listed in `otherLegs`.
 */
function swaps(tx, keys, sol, tokens, programs, labels) {
  const fee = BigInt(tx.meta?.fee ?? 0);
  const net = new Map(); // owner -> Map(mint -> { raw, decimals })
  const bump = (owner, mint, decimals, raw) => {
    const m = net.get(owner) || new Map(); const e = m.get(mint) || { raw: 0n, decimals };
    e.raw += raw; m.set(mint, e); net.set(owner, m);
  };
  for (const s of sol) {
    if (s.isTokenAccount) continue; // a token account's lamports are rent or wrapped SOL; the WSOL balance covers the latter
    bump(s.owner, SOL, 9, BigInt(s.changeRaw) + (s.isFeePayer ? fee : 0n));
  }
  for (const t of tokens) bump(t.owner, t.mint === WSOL_MINT ? SOL : t.mint, t.mint === WSOL_MINT ? 9 : t.decimals, BigInt(t.changeRaw));

  const via = programs.filter((p) => !INFRASTRUCTURE_PROGRAMS.has(p.programId)).map((p) => p.label || p.programId);
  const signers = new Set(keys.filter((k) => k.signer).map((k) => k.pubkey));
  const leg = (mint, e) => ({ mint, amount: ui(e.raw < 0n ? -e.raw : e.raw, e.decimals), raw: (e.raw < 0n ? -e.raw : e.raw).toString(), decimals: e.decimals });
  const out = [];
  for (const [owner, m] of net) {
    let down = [...m].filter(([, e]) => e.raw < 0n), up = [...m].filter(([, e]) => e.raw > 0n);
    if (!down.length || !up.length) continue;
    if (down.length > 1) down = down.filter(([mint]) => mint !== SOL);
    if (up.length > 1) up = up.filter(([mint]) => mint !== SOL);
    const swap = { owner, isSigner: signers.has(owner), in: leg(...down[0]), out: leg(...up[0]), via };
    const extra = [...down.slice(1).map(([k, e]) => ({ side: "in", ...leg(k, e) })), ...up.slice(1).map(([k, e]) => ({ side: "out", ...leg(k, e) }))];
    if (extra.length) swap.otherLegs = extra;
    out.push(swap);
  }
  // Signers first: they are usually the trader; the rest are pools, curves and vaults on the other side.
  return out.sort((a, b) => Number(b.isSigner) - Number(a.isSigner));
}

// ---------------------------------------------------------------- main

/**
 * Parse a transaction already fetched with getTransaction (jsonParsed or json encoding, any version the RPC returned).
 * @param {object} tx  the `result` of getTransaction (or the whole JSON-RPC response; `result` is unwrapped)
 * @param {{ labels?: Record<string,string>, includeLogs?: boolean }} [opts]
 */
export function parseFetchedTransaction(tx, opts = {}) {
  if (tx && typeof tx === "object" && "jsonrpc" in tx && "result" in tx) tx = tx.result;
  if (!tx || typeof tx !== "object" || !tx.transaction?.message || !tx.meta) {
    throw new InvalidInputError("expected a transaction object from getTransaction (with .transaction.message and .meta)");
  }
  const labels = opts.labels;
  const keys = resolveAccountKeys(tx);
  const warnings = [];
  const pre = tx.meta.preBalances || [];
  if (pre.length && pre.length !== keys.length) warnings.push(`account keys (${keys.length}) and balances (${pre.length}) do not line up: balance changes may be attributed to the wrong addresses`);

  const instructions = flattenInstructions(tx, keys);
  const programMap = new Map();
  for (const ix of instructions) {
    const p = programMap.get(ix.programId) || { programId: ix.programId, label: programLabel(ix.programId, labels), topLevel: 0, inner: 0 };
    if (ix.inner) p.inner++; else p.topLevel++;
    programMap.set(ix.programId, p);
  }
  const programs = [...programMap.values()];
  const tokenAccounts = tokenAccountMaps(tx, keys);
  const sol = solChanges(tx, keys, tokenAccounts);
  const tokens = tokenChanges(tokenAccounts);
  const { fee, computeBudget } = feeBreakdown(tx, instructions);
  const logs = tx.meta.logMessages || [];
  const lookups = tx.transaction.message.addressTableLookups || [];
  const signature = (tx.transaction.signatures || [])[0] ?? null;
  const failed = tx.meta.err != null;

  const result = {
    signature,
    slot: tx.slot ?? null,
    blockTime: tx.blockTime ?? null,
    time: tx.blockTime != null ? new Date(tx.blockTime * 1000).toISOString() : null,
    version: tx.version ?? "legacy",
    status: failed ? "failed" : "success",
    error: describeError(tx.meta.err, instructions, logs, labels),
    feePayer: keys[0]?.pubkey ?? null,
    signers: keys.filter((k) => k.signer).map((k) => k.pubkey),
    fee,
    computeUnits: { consumed: tx.meta.computeUnitsConsumed ?? null, limit: computeBudget.effectiveUnitLimit, limitSource: computeBudget.unitLimitSource, priceMicroLamports: computeBudget.unitPriceMicroLamports },
    computeBudget,
    accounts: { total: keys.length, fromLookupTables: keys.filter((k) => k.source === "lookupTable").length, lookupTables: lookups.map((l) => l.accountKey) },
    programs,
    solChanges: sol,
    tokenChanges: tokens,
    // A failed transaction's instructions were rolled back: nothing moved except the fee.
    transfers: failed ? [] : transfers(instructions, tokenAccounts, labels),
    swaps: failed ? [] : swaps(tx, keys, sol, tokens, programs, labels),
    warnings,
  };
  if (opts.includeLogs) result.logs = logs;
  return result;
}
