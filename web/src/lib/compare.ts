export interface SeriesInput {
  ticker: string;
  name: string;
  days: number[]; // 交易日 unix 秒,遞增
  adj: number[];  // 對應 adjclose(已濾 null)
}

/**
 * 修正 Yahoo 漏調的拆股。台股單日漲跌幅限 ±10%,故相鄰交易日 adjclose 比值
 * 落在 (0.85, 1.18) 之外必為拆股/反分割(不可能是真實價格變動,例如 0052
 * 2025-11 約 7:1 拆股,Yahoo 的 adjclose 沒調整→242→34 假斷層)。
 * 偵測到斷層就把「斷層之前」的值乘以該比值,使序列連續(只保留比例;絕對值無意義,
 * 本工具只用比率算報酬)。回新陣列,不改原輸入。
 */
export function normalizeSplits(adj: number[]): number[] {
  const n = adj.length;
  if (n < 2) return adj.slice();
  const out = new Array<number>(n);
  let cum = 1; // i 之後所有拆股比值的乘積
  for (let i = n - 1; i >= 0; i--) {
    out[i] = adj[i] * cum;
    if (i >= 1 && adj[i - 1] > 0) {
      const r = adj[i] / adj[i - 1];
      if (r < 0.85 || r > 1.18) cum *= r; // i-1 及更早需乘以此比值才與 i 之後同尺度
    }
  }
  return out;
}
export interface StockResult {
  ticker: string;
  name: string;
  roi: number;
  final: number;
  diff: number;      // vs 基準金額差
  diffPct: number;   // vs 基準百分比
  growth: number[];  // 共同區間每個交易日的金額
}
export interface CompareResult {
  stocks: StockResult[];
  winner: string;       // ticker
  from: number;         // 共同起點 unix 秒
  to: number;           // 共同終點
  adjusted: boolean;    // 區間是否因對齊被調整
  overlap: boolean;     // 所有檔在共同區間是否有重疊資料(false → stocks 為空,UI 顯示提示)
  days: number[];       // 共同區間的交易日 unix 秒(取第一檔代表,給 X 軸用)
}

/** 取共同區間 [from,to]:from=各檔最早日的最大值,to=各檔最末日的最小值。 */
function commonRange(series: SeriesInput[]): { from: number; to: number } {
  const from = Math.max(...series.map((s) => s.days[0]));
  const to = Math.min(...series.map((s) => s.days[s.days.length - 1]));
  return { from, to };
}

/** 在某檔序列中,取 day >= from 的第一個 index 與 day <= to 的最後一個 index。 */
function clip(s: SeriesInput, from: number, to: number): { adj: number[]; days: number[] } {
  const adj: number[] = [];
  const days: number[] = [];
  for (let i = 0; i < s.days.length; i++) {
    if (s.days[i] >= from && s.days[i] <= to) { adj.push(s.adj[i]); days.push(s.days[i]); }
  }
  return { adj, days };
}

export function computeCompare(
  series: SeriesInput[],
  amount: number,
  baseTicker: string,
): CompareResult {
  const { from, to } = commonRange(series);
  // 是否被調整:有任一檔的原始起點晚於使用者區間最早、或終點早於最晚。
  const reqFrom = Math.min(...series.map((s) => s.days[0]));
  const reqTo = Math.max(...series.map((s) => s.days[s.days.length - 1]));
  const adjusted = from !== reqFrom || to !== reqTo;

  const clipped = series.map((s) => ({ s, c: clip(s, from, to) }));
  // 不重疊保護:共同區間無效(from>to)或任一檔在區間內無資料 → 不算,避免 NaN。
  if (from > to || clipped.some(({ c }) => c.adj.length === 0)) {
    return { stocks: [], winner: "", from, to, adjusted: true, overlap: false, days: [] };
  }
  const interim = clipped.map(({ s, c }) => {
    const adjStart = c.adj[0];
    const adjEnd = c.adj[c.adj.length - 1];
    const roi = adjEnd / adjStart - 1;
    const final = amount * (adjEnd / adjStart);
    const growth = c.adj.map((v) => amount * (v / adjStart));
    return { ticker: s.ticker, name: s.name, roi, final, growth };
  });

  const base = interim.find((x) => x.ticker === baseTicker) ?? interim[0];
  const stocks: StockResult[] = interim.map((x) => ({
    ...x,
    diff: x.final - base.final,
    diffPct: base.final === 0 ? 0 : (x.final - base.final) / base.final,
  }));

  const winner = stocks.reduce((w, s) => (s.final > w.final ? s : w), stocks[0]).ticker;
  // 共同區間所有檔對齊同一批交易日,取第一檔的 clipped days 代表 X 軸。
  const days = clipped[0].c.days;
  return { stocks, winner, from, to, adjusted, overlap: true, days };
}
