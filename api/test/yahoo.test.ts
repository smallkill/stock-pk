import { describe, it, expect } from "vitest";
import { yahooUrl, parseChart } from "../src/yahoo";

describe("yahooUrl", () => {
  it("組正確 URL(period1/period2/interval)", () => {
    const u = yahooUrl("2330.TW", 1000, 2000);
    expect(u).toContain("/v8/finance/chart/2330.TW");
    expect(u).toContain("period1=1000");
    expect(u).toContain("period2=2000");
    expect(u).toContain("interval=1d");
  });
});
describe("parseChart", () => {
  const sample = { chart: { result: [{
    meta: { shortName: "TSMC" },
    timestamp: [10, 20, 30],
    indicators: {
      adjclose: [{ adjclose: [100, null, 200] }],
      quote: [{ close: [110, 115, 220] }],
    },
  }], error: null } };
  it("取 days/adj/close 並濾掉 null(以 adjclose 為準對齊)", () => {
    const r = parseChart(sample, "2330.TW");
    expect(r).not.toBeNull();
    expect(r!.days).toEqual([10, 30]);
    expect(r!.adj).toEqual([100, 200]);
    expect(r!.close).toEqual([110, 220]); // index 1 因 adjclose 為 null 被濾掉
    expect(r!.name).toBe("TSMC");
  });
  it("close 缺值時回退 adj(維持對齊)", () => {
    const s = { chart: { result: [{
      meta: { shortName: "X" },
      timestamp: [1, 2],
      indicators: { adjclose: [{ adjclose: [50, 60] }], quote: [{ close: [null, 66] }] },
    }] } };
    const r = parseChart(s, "X.TW");
    expect(r!.close).toEqual([50, 66]); // index 0 close=null → 回退 adj 50
  });
  it("無 quote 時 close 全回退 adj", () => {
    const s = { chart: { result: [{
      meta: { shortName: "Y" },
      timestamp: [1, 2],
      indicators: { adjclose: [{ adjclose: [7, 8] }] },
    }] } };
    expect(parseChart(s, "Y.TW")!.close).toEqual([7, 8]);
  });
  it("空結果回 null", () => {
    expect(parseChart({ chart: { result: null } }, "X")).toBeNull();
  });
});
