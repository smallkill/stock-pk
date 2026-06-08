import type { SeriesInput } from "./compare";

const API = import.meta.env.PUBLIC_API_URL ?? "https://stock-pk-api.chinte-cheng.workers.dev";

export interface CompareApiError { error: string; }

/** 打 Worker 取多檔 adjclose 序列。回 SeriesInput[] 或 throw。 */
export async function fetchCompare(
  tickers: string[],
  fromSec: number,
  toSec: number,
): Promise<SeriesInput[]> {
  const url = `${API}/api/compare?tickers=${encodeURIComponent(tickers.join(","))}&from=${fromSec}&to=${toSec}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as CompareApiError;
    throw new Error(body.error ?? `http_${res.status}`);
  }
  return (await res.json()) as SeriesInput[];
}

/** 訪客 beacon(fire-and-forget)。 */
export function beacon(): void {
  try {
    fetch(`${API}/api/visit`, { method: "GET", mode: "no-cors", keepalive: true }).catch(() => {});
  } catch { /* ignore */ }
}

/** 取訪客數(失敗回 null)。 */
export async function fetchUses(): Promise<number | null> {
  try {
    const res = await fetch(`${API}/api/stats`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const d = (await res.json()) as { views?: number };
    return typeof d.views === "number" ? d.views : null;
  } catch { return null; }
}
