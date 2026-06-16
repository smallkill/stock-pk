export interface SeriesInput {
  ticker: string;
  name: string;
  days: number[];   // 交易日 unix 秒,遞增
  adj: number[];    // 對應 adjclose(含息還原價,已濾 null)
  close?: number[]; // 原始收盤(除息價);後端新增,舊回應可能缺 → 前端回退整條 adj。
                    // 不變式:存在時 close.length === adj.length === days.length(後端同步 push)
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

export function computeCompare(
  series: SeriesInput[],
  amount: number,
  baseTicker: string,
): CompareResult {
  // 使用者(實際抓到)的最寬區間,用來判斷是否因對齊被縮短。
  const reqFrom = Math.min(...series.map((s) => s.days[0]));
  const reqTo = Math.max(...series.map((s) => s.days[s.days.length - 1]));

  // 對齊到「共同交易日」= 所有檔都有的交易日之交集。
  // 舊版只各自 clip 到 [from,to] 區間,當各檔交易日不一致(例:新上市/停牌、
  // 或某檔在區間內缺資料)時,各檔 days/growth 會長度不一 → 圖表對不齊、畫不
  // 出來。改用交集對齊,確保每檔 growth 等長且對應同一批日期。
  const daySets = series.slice(1).map((s) => new Set(s.days));
  const commonDays = series[0].days.filter((d) => daySets.every((set) => set.has(d)));
  // s.days 後端保證遞增,filter 保留遞增順序。

  // 共同交易日不足 2 天 → 無法算報酬 → overlap:false,UI 顯示「資料不足」提示。
  if (commonDays.length < 2) {
    return {
      stocks: [], winner: "",
      from: commonDays[0] ?? 0, to: commonDays[commonDays.length - 1] ?? 0,
      adjusted: true, overlap: false, days: [],
    };
  }
  const from = commonDays[0];
  const to = commonDays[commonDays.length - 1];
  // adjusted:端點被縮短,或交集比最長序列少(內部缺日,如停牌)→ 都算「已對齊調整」。
  const maxLen = Math.max(...series.map((s) => s.days.length));
  const adjusted = from !== reqFrom || to !== reqTo || commonDays.length < maxLen;

  // 各檔依共同交易日查表取 adj,確保等長且對齊同一批日期。
  const interim = series.map((s) => {
    const m = new Map<number, number>();
    for (let i = 0; i < s.days.length; i++) m.set(s.days[i], s.adj[i]);
    const adj = commonDays.map((d) => m.get(d) as number);
    const adjStart = adj[0];
    const adjEnd = adj[adj.length - 1];
    const roi = adjEnd / adjStart - 1;
    const final = amount * (adjEnd / adjStart);
    const growth = adj.map((v) => amount * (v / adjStart));
    return { ticker: s.ticker, name: s.name, roi, final, growth };
  });

  const base = interim.find((x) => x.ticker === baseTicker) ?? interim[0];
  const stocks: StockResult[] = interim.map((x) => ({
    ...x,
    diff: x.final - base.final,
    diffPct: base.final === 0 ? 0 : (x.final - base.final) / base.final,
  }));

  const winner = stocks.reduce((w, s) => (s.final > w.final ? s : w), stocks[0]).ticker;
  return { stocks, winner, from, to, adjusted, overlap: true, days: commonDays };
}
