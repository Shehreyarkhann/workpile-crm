// v81 — timezone-correct date/time handling. Stored timestamps are UTC ISO;
// the calendar must bucket them by the WORKSPACE's local day, not the UTC day
// (a 8:30pm New York visit is 01:30 UTC the next day — it belongs on the
// evening it happens, locally). Date-only strings (work_date) are already
// local dates and pass through untouched.
const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(tz: string): Intl.DateTimeFormat {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", { timeZone: tz || "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    fmtCache.set(tz, f);
  }
  return f;
}
export function localParts(iso: string | null | undefined, tz: string): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const s = String(iso);
  if (!s.includes("T")) return { date: s.slice(0, 10), time: "" };
  const d = new Date(s);
  if (isNaN(d.getTime())) return { date: s.slice(0, 10), time: "" };
  const parts: Record<string, string> = {};
  for (const p of fmt(tz).formatToParts(d)) parts[p.type] = p.value;
  const hour = parts.hour === "24" ? "00" : parts.hour;
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${hour}:${parts.minute}` };
}
export function localToday(tz: string, offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return localParts(d.toISOString(), tz).date;
}
export function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
