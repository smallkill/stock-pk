export interface Stock { code: string; name: string; suffix: "TW" | "TWO"; }

/** 代號以 q 開頭(大小寫不敏感,主動式 ETF 代號帶大寫 A 如 00981A)OR 中文名含 q;
 *  取前 limit 筆。空 q 回空。 */
export function filterStocks(list: Stock[], q: string, limit = 8): Stock[] {
  const t = q.trim();
  if (!t) return [];
  const tu = t.toUpperCase();
  const out: Stock[] = [];
  for (const s of list) {
    if (s.code.toUpperCase().startsWith(tu) || s.name.includes(t)) {
      out.push(s);
      if (out.length >= limit) break;
    }
  }
  return out;
}

/** Stock → Yahoo ticker(2330.TW / 6488.TWO)。 */
export function tickerOf(s: Stock): string {
  return `${s.code}.${s.suffix}`;
}
