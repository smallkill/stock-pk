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
