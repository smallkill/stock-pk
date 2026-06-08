// 「網址型分享」狀態的編解碼(純函式,無 DOM 依賴,給 index.astro 與測試共用)。
// 參數名:t=tickers(逗號分隔)、f=from、e=to、amt=amount、b=base ticker。

export interface ShareState {
  tickers: string[];
  from: string;
  to: string;
  amount: number;
  base: string;
}

const DEFAULT_AMOUNT = 100000;
const MAX_TICKERS = 5;
const TICKER_RE = /^[0-9A-Za-z]{2,6}\.(TW|TWO)$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** 編成 query string(不含開頭 ?)。 */
export function encodeState(s: ShareState): string {
  const p = new URLSearchParams();
  p.set("t", s.tickers.join(","));
  if (s.from) p.set("f", s.from);
  if (s.to) p.set("e", s.to);
  p.set("amt", String(s.amount));
  if (s.base) p.set("b", s.base);
  return p.toString();
}

/**
 * 從 URLSearchParams 解析;無 t 參數(或無任何合法 ticker)回 null。
 * - ticker 須符合 TICKER_RE、限 1~5 檔。
 * - amt 非正整數 → 用預設 100000。
 * - 日期不符 YYYY-MM-DD → 該欄空字串(讓呼叫端回退)。
 * - base 不在已過濾清單內 → 用第一檔。
 */
export function parseState(params: URLSearchParams): ShareState | null {
  const rawT = params.get("t");
  if (rawT === null) return null;

  const tickers = rawT
    .split(",")
    .map((x) => x.trim())
    .filter((x) => TICKER_RE.test(x))
    .slice(0, MAX_TICKERS);
  if (tickers.length === 0) return null;

  const rawAmt = params.get("amt");
  const n = rawAmt === null ? NaN : Number(rawAmt);
  const amount = Number.isInteger(n) && n > 0 ? n : DEFAULT_AMOUNT;

  const rawF = params.get("f") ?? "";
  const rawE = params.get("e") ?? "";
  const from = DATE_RE.test(rawF) ? rawF : "";
  const to = DATE_RE.test(rawE) ? rawE : "";

  const rawB = params.get("b") ?? "";
  const base = tickers.includes(rawB) ? rawB : tickers[0];

  return { tickers, from, to, amount, base };
}
