import { describe, it, expect } from "vitest";
import { computeCompare, type SeriesInput } from "../src/lib/compare";

// 每檔:days=該股交易日(unix 秒,遞增)、adj=對應 adjclose。
const A: SeriesInput = { ticker: "2330.TW", name: "台積電",
  days: [10, 20, 30], adj: [100, 150, 200] };
const B: SeriesInput = { ticker: "0050.TW", name: "元大台灣50",
  days: [10, 20, 30], adj: [50, 55, 60] };

describe("computeCompare", () => {
  it("相同區間:投報率與最終金額", () => {
    const r = computeCompare([A, B], 100000, "0050.TW");
    const a = r.stocks.find((s) => s.ticker === "2330.TW")!;
    expect(a.roi).toBeCloseTo(1.0);          // 100→200 = +100%
    expect(a.final).toBeCloseTo(200000);
    const b = r.stocks.find((s) => s.ticker === "0050.TW")!;
    expect(b.roi).toBeCloseTo(0.2);          // 50→60 = +20%
    expect(b.final).toBeCloseTo(120000);
    expect(r.days).toEqual([10, 20, 30]);    // 共同區間交易日(取第一檔)
  });
  it("vs 基準差額($與%),基準為 0050", () => {
    const r = computeCompare([A, B], 100000, "0050.TW");
    const a = r.stocks.find((s) => s.ticker === "2330.TW")!;
    expect(a.diff).toBeCloseTo(80000);        // 200000 - 120000
    expect(a.diffPct).toBeCloseTo(80000 / 120000);
  });
  it("贏家 = 最終金額最高", () => {
    const r = computeCompare([A, B], 100000, "0050.TW");
    expect(r.winner).toBe("2330.TW");
  });
  it("成長序列首=本金、末=最終金額", () => {
    const r = computeCompare([A, B], 100000, "0050.TW");
    const a = r.stocks.find((s) => s.ticker === "2330.TW")!;
    expect(a.growth[0]).toBeCloseTo(100000);
    expect(a.growth[a.growth.length - 1]).toBeCloseTo(200000);
  });
  it("共同區間:某檔較晚才有資料時對齊", () => {
    const late: SeriesInput = { ticker: "X.TW", name: "晚", days: [20, 30], adj: [10, 12] };
    const r = computeCompare([A, late], 100000, "2330.TW");
    expect(r.adjusted).toBe(true);            // 區間被調整
    expect(r.from).toBe(20);                  // 共同起點 = max(10,20)
    expect(r.to).toBe(30);
    const a = r.stocks.find((s) => s.ticker === "2330.TW")!;
    expect(a.roi).toBeCloseTo(200 / 150 - 1); // 從 day20(150) 起算
  });
  it("交易日不一致(某檔在區間內缺資料/停牌)→ 對齊到共同交易日交集、growth 等長", () => {
    // C 缺 day20,舊版只各自 clip 區間會讓兩檔長度對不上(3 vs 2)→ 圖表畫不出來。
    // 修正後對齊到交集 [10,30],兩檔等長,可正常計算。
    const sparse: SeriesInput = { ticker: "C.TW", name: "稀疏", days: [10, 30], adj: [10, 20] };
    const r = computeCompare([A, sparse], 100000, "2330.TW");
    expect(r.overlap).toBe(true);
    expect(r.days).toEqual([10, 30]);             // 交集(去掉只有 A 有的 day20)
    const a = r.stocks.find((s) => s.ticker === "2330.TW")!;
    const c = r.stocks.find((s) => s.ticker === "C.TW")!;
    expect(a.growth.length).toBe(2);              // 與共同交易日等長
    expect(c.growth.length).toBe(2);
    expect(a.roi).toBeCloseTo(200 / 100 - 1);     // day10(100)→day30(200)
    expect(c.roi).toBeCloseTo(20 / 10 - 1);
  });
  it("共同交易日不足 2 天 → overlap=false(避免單點無法算報酬)", () => {
    const one: SeriesInput = { ticker: "C.TW", name: "單日", days: [30], adj: [5] };
    const r = computeCompare([A, one], 100000, "2330.TW");
    expect(r.overlap).toBe(false);
    expect(r.stocks).toEqual([]);
  });
});

describe("computeCompare 不重疊保護", () => {
  it("兩檔日期完全不重疊 → overlap=false、stocks 空、無 NaN", () => {
    const a = { ticker: "A.TW", name: "A", days: [10, 20], adj: [1, 2] };
    const b = { ticker: "B.TW", name: "B", days: [30, 40], adj: [3, 4] };
    const r = computeCompare([a, b], 100000, "A.TW");
    expect(r.overlap).toBe(false);
    expect(r.stocks).toEqual([]);
  });
});

import { normalizeSplits } from "../src/lib/compare";
describe("normalizeSplits 拆股修正", () => {
  it("7:1 拆股假斷層被弭平、相鄰比值正常、保留真實報酬", () => {
    const out = normalizeSplits([700, 720, 100, 105]); // 720→100 為拆股
    for (let i = 1; i < out.length; i++) {
      const r = out[i] / out[i - 1];
      expect(r).toBeGreaterThan(0.85);
      expect(r).toBeLessThan(1.18);
    }
    // 真實總報酬 = (720/700)*(105/100),不含拆股假跌
    expect(out[out.length - 1] / out[0]).toBeCloseTo((720 / 700) * (105 / 100), 3);
  });
  it("無拆股序列比例不變", () => {
    const out = normalizeSplits([100, 110, 105]);
    expect(out[2] / out[0]).toBeCloseTo(105 / 100);
  });
  it("短序列原樣回傳", () => {
    expect(normalizeSplits([50])).toEqual([50]);
  });
});
