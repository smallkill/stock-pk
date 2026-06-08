export const COLORS = ["#2347d6", "#e8590c", "#2f9e44", "#9c36b5", "#1098ad"];

export interface ChartLine { name: string; growth: number[]; color: string; }

/** 產生 ~count 個「漂亮」整數刻度涵蓋 [min,max]。用 1/2/5×10^k 演算法。 */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0];
  if (min === max) {
    // 退化區間:給單一刻度(取整),避免除以 0。
    return [Math.round(min)];
  }
  const range = max - min;
  const rawStep = range / Math.max(1, count);
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const norm = rawStep / mag;
  let niceNorm: number;
  if (norm <= 1) niceNorm = 1;
  else if (norm <= 2) niceNorm = 2;
  else if (norm <= 5) niceNorm = 5;
  else niceNorm = 10;
  const step = niceNorm * mag;
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  // 用整數步數迭代避免浮點累積誤差。
  const steps = Math.round((end - start) / step);
  for (let i = 0; i <= steps; i++) {
    const v = start + i * step;
    // 修正極小浮點殘差後再判斷整數。
    ticks.push(Math.round(v * 1e6) / 1e6);
  }
  return ticks;
}

/** 金額 → 「X萬/X.X萬」(≥1萬)否則千分位整數。 */
export function fmtWan(v: number): string {
  if (Math.abs(v) >= 10000) {
    const wan = v / 10000;
    // 整數萬不帶小數(10萬),否則一位小數(23.9萬)。
    const s = Number.isInteger(wan) ? String(wan) : wan.toFixed(1);
    return s + "萬";
  }
  return Math.round(v).toLocaleString("en-US");
}

export interface ChartRender { svg: string; pointX: number[]; }

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** 兩位 UTC → YY/MM */
function ymLabel(sec: number): string {
  const d = new Date(sec * 1000);
  const yy = String(d.getUTCFullYear() % 100).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${yy}/${mm}`;
}

/** 畫含座標軸/格線/雙Y(左金額右%)/本金虛線的多線圖。
 *  days=共同交易日(與 growth 對齊);amount=本金(右Y 0% 基準)。
 *  在 client 以容器實際像素 w/h 呼叫,viewBox=0 0 w h,不要 preserveAspectRatio="none"。
 *  回 svg 字串 + 每資料點像素 x(pointX,給 hover 對位)。 */
export function renderChartSvg(
  lines: ChartLine[],
  days: number[],
  amount: number,
  w: number,
  h: number,
): ChartRender {
  const head = `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">`;
  if (lines.length === 0 || lines[0].growth.length === 0) {
    return { svg: `${head}</svg>`, pointX: [] };
  }

  const pad = { l: 50, r: 44, t: 12, b: 28 };
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const n = lines[0].growth.length;

  const all = lines.flatMap((l) => l.growth);
  let min = Math.min(...all, amount);
  let max = Math.max(...all, amount);
  if (min === max) { min -= 1; max += 1; } // 退化保護

  const ticks = niceTicks(min, max, 4);
  const tMin = Math.min(min, ticks[0]);
  const tMax = Math.max(max, ticks[ticks.length - 1]);
  const span = tMax - tMin || 1;

  const x = (i: number) => pad.l + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v: number) => pad.t + innerH - ((v - tMin) / span) * innerH;

  const parts: string[] = [head];

  // Y 格線 + 左金額 + 右 %
  for (const t of ticks) {
    const yy = y(t).toFixed(1);
    parts.push(
      `<line x1="${pad.l}" y1="${yy}" x2="${w - pad.r}" y2="${yy}" stroke="#e5e7eb" stroke-width="1" />`,
    );
    const pct = amount === 0 ? 0 : (t / amount - 1) * 100;
    const pctStr = (pct >= 0 ? "+" : "") + pct.toFixed(0) + "%";
    parts.push(
      `<text x="${pad.l - 6}" y="${(Number(yy) + 3).toFixed(1)}" font-size="10" fill="#6b7280" text-anchor="end">${esc(fmtWan(t))}</text>`,
    );
    parts.push(
      `<text x="${w - pad.r + 6}" y="${(Number(yy) + 3).toFixed(1)}" font-size="10" fill="#6b7280" text-anchor="start">${esc(pctStr)}</text>`,
    );
  }

  // 本金基準虛線(0%)
  const yBase = y(amount).toFixed(1);
  parts.push(
    `<line x1="${pad.l}" y1="${yBase}" x2="${w - pad.r}" y2="${yBase}" stroke="#9ca3af" stroke-width="1" stroke-dasharray="4 3" />`,
  );

  // X 軸日期標籤(~5 個等距 index)
  const xCount = Math.min(5, n);
  const seen = new Set<number>();
  for (let k = 0; k < xCount; k++) {
    const i = xCount === 1 ? 0 : Math.round((k / (xCount - 1)) * (n - 1));
    if (seen.has(i)) continue;
    seen.add(i);
    const sec = days[i];
    if (sec === undefined) continue;
    const anchor = k === 0 ? "start" : k === xCount - 1 ? "end" : "middle";
    parts.push(
      `<text x="${x(i).toFixed(1)}" y="${(h - pad.b + 16).toFixed(1)}" font-size="10" fill="#6b7280" text-anchor="${anchor}">${esc(ymLabel(sec))}</text>`,
    );
  }

  // 軸線(左、下)
  parts.push(
    `<line x1="${pad.l}" y1="${pad.t}" x2="${pad.l}" y2="${pad.t + innerH}" stroke="#9ca3af" stroke-width="1" />`,
  );
  parts.push(
    `<line x1="${pad.l}" y1="${pad.t + innerH}" x2="${w - pad.r}" y2="${pad.t + innerH}" stroke="#9ca3af" stroke-width="1" />`,
  );

  // 折線
  for (const l of lines) {
    const pts = l.growth.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
    parts.push(`<polyline fill="none" stroke="${l.color}" stroke-width="2" points="${pts}" />`);
  }

  parts.push("</svg>");

  const pointX: number[] = [];
  for (let i = 0; i < n; i++) pointX.push(x(i));

  return { svg: parts.join(""), pointX };
}
