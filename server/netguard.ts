// Outbound URL guard (v17): resolver-grade SSRF defense for workspace-configured URLs.
// Validates the URL, resolves the host, and requires EVERY resolved address to be public.
// Residual (stated honestly): a hostile DNS server could rebind between validation and connect;
// full mitigation needs connection-level IP pinning — validation + redirect refusal narrows the
// window to that race, which is the accepted posture for this deployment size.
import { lookup } from "node:dns/promises";

export function ipIsPrivate(ip: string): boolean {
  const v = ip.toLowerCase();
  if (v.includes(":")) {
    if (v === "::1" || v === "::") return true;
    if (v.startsWith("fe8") || v.startsWith("fe9") || v.startsWith("fea") || v.startsWith("feb")) return true; // fe80::/10
    if (v.startsWith("fc") || v.startsWith("fd")) return true; // fc00::/7
    if (v.startsWith("ff")) return true; // multicast
    if (v.startsWith("2001:db8")) return true; // documentation
    const mapped = v.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return ipIsPrivate(mapped[1]);
    return false;
  }
  const p = v.split(".").map(Number);
  if (p.length !== 4 || p.some(n => isNaN(n) || n < 0 || n > 255)) return true; // unparseable = unsafe
  const [a, b] = p;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 169 && b === 254) return true; // link-local / metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && (b === 168 || b === 0)) return true;
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a === 198 && b === 51) return true; if (a === 203 && b === 0) return true; if (a === 192 && b === 0) return true; // TEST-NETs
  if (a >= 224) return true; // multicast + reserved
  return false;
}

export async function assertPublicUrl(raw: string): Promise<{ ok: true; url: URL } | { ok: false; error: string }> {
  let url: URL;
  try { url = new URL(raw); } catch { return { ok: false, error: "not a valid URL" }; }
  if (!/^https?:$/.test(url.protocol)) return { ok: false, error: "only http/https allowed" };
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return { ok: false, error: "local hostnames are not allowed" };
  const isLiteral = /^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(":");
  if (isLiteral) return ipIsPrivate(host) ? { ok: false, error: "private/loopback destination" } : { ok: true, url };
  let addrs: { address: string }[];
  try { addrs = await lookup(host, { all: true, verbatim: true }); } catch { return { ok: false, error: "host does not resolve" }; }
  if (!addrs.length) return { ok: false, error: "host does not resolve" };
  if (addrs.some(a => ipIsPrivate(a.address))) return { ok: false, error: "host resolves to a private/loopback address" };
  return { ok: true, url };
}
