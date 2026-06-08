import { describe, it, expect } from "vitest";
import { lineChartSvg, COLORS } from "../src/lib/chart";

describe("lineChartSvg", () => {
  const data = [
    { name: "A", growth: [100000, 150000, 200000], color: COLORS[0] },
    { name: "B", growth: [100000, 110000, 120000], color: COLORS[1] },
  ];
  it("回 svg 字串含兩條 polyline", () => {
    const svg = lineChartSvg(data, 600, 300);
    expect(svg).toContain("<svg");
    expect((svg.match(/<polyline/g) ?? []).length).toBe(2);
    expect(svg).toContain(COLORS[0]);
    expect(svg).toContain(COLORS[1]);
  });
  it("空資料回空 svg(不報錯)", () => {
    expect(lineChartSvg([], 600, 300)).toContain("<svg");
  });
});
