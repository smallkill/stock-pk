// 由 FinMind TaiwanStockInfo 產生 web/public/stocks.json:
// [{ code, name, suffix }]  suffix: 'TW'(上市) | 'TWO'(上櫃);興櫃(emerging)排除。
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.resolve(here, "../web/public/stocks.json");

const res = await fetch("https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockInfo");
if (!res.ok) throw new Error(`FinMind ${res.status}`);
const json = await res.json();
const rows = json.data ?? [];

const seen = new Set();
const out = [];
for (const r of rows) {
  const market = r.type === "twse" ? "TW" : r.type === "tpex" ? "TWO" : null;
  if (!market) continue; // 排除 emerging(興櫃)
  const code = String(r.stock_id ?? "").trim();
  const name = String(r.stock_name ?? "").trim();
  if (!code || !name || seen.has(code)) continue;
  seen.add(code);
  out.push({ code, name, suffix: market });
}
out.sort((a, b) => a.code.localeCompare(b.code));

await mkdir(path.dirname(outPath), { recursive: true });
await writeFile(outPath, JSON.stringify(out), "utf8");
console.log(`stocks.json: ${out.length} 檔 → ${outPath}`);
