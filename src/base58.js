// Base58 (the Bitcoin alphabet Solana uses), with no dependencies.
const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const INDEX = new Map([...ALPHABET].map((c, i) => [c, i]));

/** Decode base58 text to bytes. Throws on a character outside the alphabet. */
export function b58decode(text) {
  const s = String(text);
  let n = 0n;
  for (const ch of s) {
    const i = INDEX.get(ch);
    if (i === undefined) throw new Error("not base58");
    n = n * 58n + BigInt(i);
  }
  const out = [];
  while (n > 0n) { out.unshift(Number(n & 255n)); n >>= 8n; }
  for (const ch of s) { if (ch !== "1") break; out.unshift(0); }
  return Uint8Array.from(out);
}

/** True when `text` decodes to exactly `length` bytes. */
export function isBase58OfLength(text, length) {
  if (typeof text !== "string" || !text) return false;
  try { return b58decode(text).length === length; } catch { return false; }
}

/** Little-endian unsigned integer of `size` bytes at `offset`, as a BigInt (null when out of range). */
export function readUintLE(bytes, offset, size) {
  if (!bytes || offset + size > bytes.length) return null;
  let v = 0n;
  for (let i = size - 1; i >= 0; i--) v = (v << 8n) | BigInt(bytes[offset + i]);
  return v;
}
