// v96 — TOTP two-factor authentication (RFC 4226/6238) on node:crypto only.
// Secrets are base32; codes are 6 digits over a 30-second window with one
// step of drift tolerance. Pending login challenges live in memory (single
// process, 5-minute expiry) — a password login for an MFA-enabled user
// returns a pending token instead of a session until the code verifies.
import { createHmac, randomBytes } from "node:crypto";

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export function base32Encode(buf: Buffer): string {
  let bits = 0, value = 0, out = "";
  for (const byte of buf) { value = (value << 8) | byte; bits += 8; while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; } }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}
export function base32Decode(s: string): Buffer {
  const clean = s.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0, value = 0; const out: number[] = [];
  for (const ch of clean) { value = (value << 5) | B32.indexOf(ch); bits += 5; if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; } }
  return Buffer.from(out);
}
export function newTotpSecret(): string { return base32Encode(randomBytes(20)); }
export function totpCode(secret: string, atMs = Date.now()): string {
  const counter = Math.floor(atMs / 30000);
  const msg = Buffer.alloc(8); msg.writeBigInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", base32Decode(secret)).update(msg).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const bin = ((hmac[offset] & 0x7f) << 24) | ((hmac[offset + 1] & 0xff) << 16) | ((hmac[offset + 2] & 0xff) << 8) | (hmac[offset + 3] & 0xff);
  return String(bin % 1000000).padStart(6, "0");
}
export function verifyTotp(secret: string, code: string): boolean {
  const c = String(code || "").replace(/\D/g, "");
  if (c.length !== 6 || !secret) return false;
  for (const drift of [0, -30000, 30000]) if (totpCode(secret, Date.now() + drift) === c) return true;
  return false;
}
export function otpauthUrl(secret: string, account: string): string {
  return `otpauth://totp/Workpile:${encodeURIComponent(account)}?secret=${secret}&issuer=Workpile&digits=6&period=30`;
}

const pending = new Map<string, { userId: string; expires: number }>();
export function createMfaPending(userId: string): string {
  const token = "mfa_" + randomBytes(18).toString("hex");
  pending.set(token, { userId, expires: Date.now() + 5 * 60000 });
  return token;
}
export function consumeMfaPending(token: string): string | null {
  const p = pending.get(token); if (!p) return null;
  pending.delete(token);
  return p.expires >= Date.now() ? p.userId : null;
}
export function peekMfaPending(token: string): string | null {
  const p = pending.get(token); if (!p) return null;
  return p.expires >= Date.now() ? p.userId : null;
}
