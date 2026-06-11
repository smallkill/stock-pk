export interface Preset { key: string; label: string; months: number; }
export const PRESETS: Preset[] = [
  { key: "1m", label: "1個月", months: 1 },
  { key: "6m", label: "半年", months: 6 },
  { key: "ytd", label: "本年迄今", months: 0 }, // 特例:起 = 當年 1/1(見 presetRange),months 不參與計算
  { key: "1y", label: "1年", months: 12 },
  { key: "3y", label: "3年", months: 36 },
  { key: "5y", label: "5年", months: 60 },
  { key: "10y", label: "10年", months: 120 },
  { key: "max", label: "最久", months: 0 },
];

// 「最久」起點:夠早即可,實際起點由各檔資料最早日(common range)決定。
// 台股 Yahoo 資料最早約 1990 年代,設 1990-01-01 足夠涵蓋。
export const MAX_FROM_MS = Date.UTC(1990, 0, 1);

export interface DetailRange { key: string; label: string; }
// 個股展開圖的區間選項(全日線;5天於前端取最後 5 個交易日)。
export const DETAIL_RANGES: DetailRange[] = [
  { key: "5d", label: "5天" },
  { key: "1m", label: "1個月" },
  { key: "6m", label: "6個月" },
  { key: "ytd", label: "本年迄今" },
  { key: "1y", label: "1年" },
  { key: "5y", label: "5年" },
  { key: "max", label: "最久" },
];

/** 個股區間 key → {from,to}。to 一律 now;5d 抓寬一點(前端再取最後5個交易日)。 */
export function detailRange(key: string, now: number): { from: number; to: number } {
  const d = new Date(now);
  const back = (months: number): number =>
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - months, d.getUTCDate());
  switch (key) {
    case "5d": return { from: now - 21 * 86400000, to: now }; // 21 天確保 ≥5 交易日(含過年連假),前端取最後 5 個
    case "1m": return { from: back(1), to: now };
    case "6m": return { from: back(6), to: now };
    case "ytd": return { from: Date.UTC(d.getUTCFullYear(), 0, 1), to: now };
    case "1y": return { from: back(12), to: now };
    case "5y": return { from: back(60), to: now };
    case "max": return { from: MAX_FROM_MS, to: now };
    default: return { from: back(12), to: now };
  }
}

/** ts(毫秒,UTC)→ 'YYYY-MM-DD'。 */
export function toYmd(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

/** 快捷區間:訖 = now,起 = now 往前推 N 個月。「最久」回 MAX_FROM_MS(實際起點由資料決定)。 */
export function presetRange(key: string, now: number): { from: number; to: number } {
  if (key === "max") return { from: MAX_FROM_MS, to: now };
  const d = new Date(now);
  if (key === "ytd") return { from: Date.UTC(d.getUTCFullYear(), 0, 1), to: now };
  const p = PRESETS.find((x) => x.key === key);
  const months = p ? p.months : 12;
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
