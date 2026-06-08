import { describe, it, expect } from "vitest";
import { niceTicks, fmtWan, renderChartSvg, COLORS, type ChartLine } from "../src/lib/chart";

describe("niceTicks", () => {
  it("回合理整數刻度且涵蓋範圍", () => {
    const t = niceTicks(0, 100, 4);
    expect(t.length).toBeGreaterThanOrEqual(2);
    // 全為整數
    expect(t.every((v) => Number.isInteger(v))).toBe(true);
    // 涵蓋 [0,100]
    expect(t[0]).toBeLessThanOrEqual(0);
    expect(t[t.length - 1]).toBeGreaterThanOrEqual(100);
    // 等距
    const step = t[1] - t[0];
    for (let i = 1; i < t.length; i++) {
      expect(t[i] - t[i - 1]).toBeCloseTo(step);
    }
  });
  it("處理 min==max 不爆", () => {
    const t = niceTicks(50, 50, 4);
    expect(t.length).toBeGreaterThanOrEqual(1);
  });
});

describe("fmtWan", () => {
  it("238835 → 含「萬」", () => {
    expect(fmtWan(238835)).toContain("萬");
    expect(fmtWan(238835)).toBe("23.9萬");
  });
  it("100000 → 10萬", () => {
    expect(fmtWan(100000)).toBe("10萬");
  });
  it("小於一萬用千分位整數", () => {
    expect(fmtWan(5000)).toBe("5,000");
  });
});

describe("renderChartSvg", () => {
  const lines: ChartLine[] = [
    { name: "A", growth: [100000, 150000, 200000], color: COLORS[0] },
    { name: "B", growth: [100000, 110000, 120000], color: COLORS[1] },
  ];
  const days = [1700000000, 1700086400, 1700172800];
  it("每檔一條 polyline", () => {
    const { svg } = renderChartSvg(lines, days, 100000, 700, 240);
    expect(svg).toContain("<svg");
    expect((svg.match(/<polyline/g) ?? []).length).toBe(2);
    expect(svg).toContain(COLORS[0]);
    expect(svg).toContain(COLORS[1]);
  });
  it("含金額文字與 % 文字", () => {
    const { svg } = renderChartSvg(lines, days, 100000, 700, 240);
    expect(svg).toContain("萬");
    expect(svg).toContain("%");
  });
  it("不含 preserveAspectRatio=none(避免文字變形)", () => {
    const { svg } = renderChartSvg(lines, days, 100000, 700, 240);
    expect(svg).not.toContain('preserveAspectRatio="none"');
  });
  it("pointX 長度等於 growth 長度", () => {
    const { pointX } = renderChartSvg(lines, days, 100000, 700, 240);
    expect(pointX.length).toBe(lines[0].growth.length);
  });
  it("空資料 svg 不爆", () => {
    const { svg, pointX } = renderChartSvg([], [], 100000, 700, 240);
    expect(svg).toContain("<svg");
    expect(pointX).toEqual([]);
  });
});
