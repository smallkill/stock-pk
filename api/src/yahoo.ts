export interface ParsedChart { ticker: string; name: string; days: number[]; adj: number[]; close: number[]; }

export function yahooUrl(ticker: string, period1: number, period2: number): string {
  return `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?period1=${period1}&period2=${period2}&interval=1d`;
}

/** 解析 Yahoo chart 回應,取 timestamp + adjclose(濾 null 對)。空/壞回 null。 */
export function parseChart(json: unknown, ticker: string): ParsedChart | null {
  const result = (json as { chart?: { result?: unknown[] } })?.chart?.result;
  if (!Array.isArray(result) || result.length === 0) return null;
  const r = result[0] as {
    meta?: { shortName?: string; longName?: string };
    timestamp?: number[];
    indicators?: {
      adjclose?: Array<{ adjclose?: (number | null)[] }>;
      quote?: Array<{ close?: (number | null)[] }>;
    };
  };
  const ts = r.timestamp ?? [];
  const adjArr = r.indicators?.adjclose?.[0]?.adjclose ?? [];
  const closeArr = r.indicators?.quote?.[0]?.close ?? [];
  const days: number[] = [];
  const adj: number[] = [];
  const close: number[] = []; // 原始收盤(除息價);缺值回退 adj 以維持與 days/adj 對齊
  for (let i = 0; i < ts.length; i++) {
    const v = adjArr[i];
    if (typeof v === "number" && Number.isFinite(v)) {
      days.push(ts[i]);
      adj.push(v);
      const c = closeArr[i];
      close.push(typeof c === "number" && Number.isFinite(c) ? c : v);
    }
  }
  if (days.length === 0) return null;
  return { ticker, name: r.meta?.shortName ?? r.meta?.longName ?? ticker, days, adj, close };
}

/** 抓單檔(逾時 6s)。失敗回 null。 */
export async function fetchChart(ticker: string, p1: number, p2: number): Promise<ParsedChart | null> {
  try {
    const res = await fetch(yahooUrl(ticker, p1, p2), {
      headers: { "user-agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    return parseChart(await res.json(), ticker);
  } catch { return null; }
}
