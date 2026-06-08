import type { SeriesInput } from "./compare";

const API = import.meta.env.PUBLIC_API_URL ?? "https://stock-pk-api.chinte-cheng.workers.dev";

export interface CompareApiError { error: string; }

/** 用後端 /api/share(走 Derek 的 devbox 短網址服務)把長分享網址縮短。失敗回 null。 */
export async function shortenUrl(longUrl: string): Promise<string | null> {
  try {
    const res = await fetch(`${API}/api/share?u=${encodeURIComponent(longUrl)}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const d = (await res.json()) as { shortUrl?: string };
    return d.shortUrl ?? null;
  } catch {
    return null;
  }
}

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
