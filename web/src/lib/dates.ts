export interface Preset { key: string; label: string; months: number; }
export const PRESETS: Preset[] = [
  { key: "1m", label: "1個月", months: 1 },
  { key: "6m", label: "半年", months: 6 },
  { key: "1y", label: "1年", months: 12 },
  { key: "3y", label: "3年", months: 36 },
  { key: "5y", label: "5年", months: 60 },
  { key: "10y", label: "10年", months: 120 },
];

/** ts(毫秒,UTC)→ 'YYYY-MM-DD'。 */
export function toYmd(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

/** 快捷區間:訖 = now,起 = now 往前推 N 個月。 */
export function presetRange(key: string, now: number): { from: number; to: number } {
  const p = PRESETS.find((x) => x.key === key);
  const months = p ? p.months : 12;
  const d = new Date(now);
  const from = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - months, d.getUTCDate());
  return { from, to: now };
}

/** 結束日夾到今天(不可選未來)。 */
export function clampEnd(end: number, now: number): number {
  return end > now ? now : end;
}

/** 驗證:from 必須早於 to。 */
export function validRange(from: number, to: number): { ok: boolean; reason?: string } {
  if (from >= to) return { ok: false, reason: "from_after_to" };
  return { ok: true };
}
