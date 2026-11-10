// Object storage adapter (target §21): one interface, driver chosen by env. The local driver
// writes under STORAGE_DIR (default: <db dir>/uploads). An S3-compatible driver slots in
// behind the same three functions without touching callers.
import fs from "node:fs";
import path from "node:path";

function root(): string {
  const dir = process.env.STORAGE_DIR || path.join(path.dirname(process.env.LEADFLOW_DB || path.resolve("leadflow.db")), "uploads");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
const safe = (k: string) => k.replace(/[^a-zA-Z0-9/_.\-]/g, "_").replace(/\.\.+/g, "_");

export function storagePut(key: string, buf: Buffer): string {
  const k = safe(key); const full = path.join(root(), k);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, buf);
  return k;
}
export function storageGet(key: string): Buffer | null {
  try { return fs.readFileSync(path.join(root(), safe(key))); } catch { return null; }
}
export function storageDelete(key: string): void {
  try { fs.unlinkSync(path.join(root(), safe(key))); } catch { /* already gone */ }
}
