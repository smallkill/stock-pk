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
    indicators: { adjclose: [{ adjclose: [100, null, 200] }] },
  }], error: null } };
  it("取 days/adj 並濾掉 null", () => {
    const r = parseChart(sample, "2330.TW");
    expect(r).not.toBeNull();
    expect(r!.days).toEqual([10, 30]);
    expect(r!.adj).toEqual([100, 200]);
    expect(r!.name).toBe("TSMC");
  });
  it("空結果回 null", () => {
    expect(parseChart({ chart: { result: null } }, "X")).toBeNull();
  });
});
