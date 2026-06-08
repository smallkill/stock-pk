export const COLORS = ["#2347d6", "#e8590c", "#2f9e44", "#9c36b5", "#1098ad"];

export interface ChartLine { name: string; growth: number[]; color: string; }

/** 多檔成長序列 → SVG 字串(折線 + 基準線)。所有序列長度相同(共同區間)。 */
export function lineChartSvg(lines: ChartLine[], w: number, h: number): string {
  const pad = { l: 8, r: 8, t: 10, b: 10 };
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  if (lines.length === 0 || lines[0].growth.length === 0) {
    return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg"></svg>`;
  }
  const n = lines[0].growth.length;
  const all = lines.flatMap((l) => l.growth);
  const min = Math.min(...all), max = Math.max(...all);
  const span = max - min || 1;
  const x = (i: number) => pad.l + (n === 1 ? 0 : (i / (n - 1)) * innerW);
  const y = (v: number) => pad.t + innerH - ((v - min) / span) * innerH;
  const polys = lines
    .map((l) => {
      const pts = l.growth.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
      return `<polyline fill="none" stroke="${l.color}" stroke-width="2" points="${pts}" />`;
    })
    .join("");
  return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">${polys}</svg>`;
}
