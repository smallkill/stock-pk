import { recordVisit, fetchVisitStats } from "./visits";
import { fetchChart } from "./yahoo";

// Cloudflare Rate Limiting binding(per-colo「寬鬆過濾」,非精確;當濫用煞車用)。
interface RateLimiter {
  limit(opts: { key: string }): Promise<{ success: boolean }>;
}
export interface Env {
  DB: D1Database;
  VISIT_SALT?: string;
  CREATE_TOKEN?: string;
  DEVBOX?: Fetcher;
  RL?: RateLimiter; // optional:miniflare 測試不提供,缺少時放行
}

/** 速率限制查詢;無 binding 或出錯 → fail-open 放行。 */
async function rlOk(env: Env, key: string): Promise<boolean> {
  if (!env.RL) return true;
  try {
    return (await env.RL.limit({ key })).success;
  } catch {
    return true;
  }
}

const CORS = { "access-control-allow-origin": "*" };
const MAX_TICKERS = 5;
// 用 Derek 自己的 devbox 短網址服務縮分享連結;token 存 secret,不外露。
const SHORTEN_API = "https://devbox-api.chinte-cheng.workers.dev/api/links";
const SHARE_PREFIX = "https://derek-stock-pk.pages.dev/";

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;

    if (req.method === "GET" && path === "/api/visit") {
      try {
        const ip = req.headers.get("cf-connecting-ip") ?? "0.0.0.0";
        const country = (req as unknown as { cf?: { country?: string } }).cf?.country ?? "";
        await recordVisit(env, ip, country, "/");
      } catch { /* 不報錯 */ }
      return new Response(null, { status: 204, headers: CORS });
    }

    if (req.method === "GET" && path === "/api/stats") {
      const s = await fetchVisitStats(env);
      return Response.json({ views: s?.views ?? 0, uniqueToday: s?.uniqueToday ?? 0 }, { headers: CORS });
    }

    if (req.method === "GET" && path === "/api/compare") {
      // 速率煞車:防被當免費行情 API 刷量(快取仍是主要緩解)。
      const ip = req.headers.get("cf-connecting-ip") ?? "0.0.0.0";
      if (!(await rlOk(env, "compare:" + ip)))
        return Response.json({ error: "rate_limit" }, { status: 429, headers: CORS });
      const raw = (url.searchParams.get("tickers") ?? "").split(",").map((t) => t.trim()).filter(Boolean);
      const from = Number(url.searchParams.get("from"));
      const to = Number(url.searchParams.get("to"));
      if (raw.length < 1 || raw.length > MAX_TICKERS || !Number.isFinite(from) || !Number.isFinite(to) || from >= to) {
        return Response.json({ error: "bad_request" }, { status: 400, headers: CORS });
      }
      // 簡單格式檢查:^[0-9A-Za-z]{2,6}\.(TW|TWO)$
      if (!raw.every((t) => /^[0-9A-Za-z]{2,6}\.(TW|TWO)$/.test(t))) {
        return Response.json({ error: "bad_ticker" }, { status: 400, headers: CORS });
      }
      const cache = caches.default;
      const results = await Promise.all(
        raw.map(async (ticker) => {
          const key = new Request(`https://cache/${ticker}/${from}/${to}`);
          const hit = await cache.match(key);
          if (hit) return hit.json();
          const parsed = await fetchChart(ticker, from, to);
          if (parsed) {
            const resp = Response.json(parsed, { headers: { "cache-control": "max-age=86400" } });
            await cache.put(key, resp.clone());
            return parsed;
          }
          return null;
        }),
      );
      if (results.some((r) => r === null)) {
        return Response.json({ error: "no_data" }, { status: 502, headers: CORS });
      }
      return Response.json(results, { headers: CORS });
    }

    // 縮網址代理:只縮 stock-pk 自己的分享連結(防當公開短網址濫用),
    // 用 CREATE_TOKEN(secret)呼叫 devbox /api/links,回短網址。
    if (req.method === "GET" && path === "/api/share") {
      const target = url.searchParams.get("u") ?? "";
      if (!target.startsWith(SHARE_PREFIX) || target.length > 2048) {
        return Response.json({ error: "bad_url" }, { status: 400, headers: CORS });
      }
      // 速率煞車:限制建短網址的頻率(會在 devbox D1 建列)。
      const shareIp = req.headers.get("cf-connecting-ip") ?? "0.0.0.0";
      if (!(await rlOk(env, "share:" + shareIp))) {
        return Response.json({ error: "rate_limit" }, { status: 429, headers: CORS });
      }
      if (!env.CREATE_TOKEN || !env.DEVBOX) {
        return Response.json({ error: "unavailable" }, { status: 503, headers: CORS });
      }
      try {
        // 經 service binding 呼叫 devbox(host 隨意,binding 直接路由到 devbox-api)。
        const r = await env.DEVBOX.fetch(SHORTEN_API, {
          method: "POST",
          headers: { authorization: `Bearer ${env.CREATE_TOKEN}`, "content-type": "application/json" },
          body: JSON.stringify({ url: target }),
        });
        if (!r.ok) return Response.json({ error: "upstream" }, { status: 502, headers: CORS });
        const data = (await r.json()) as { shortUrl?: string };
        if (!data.shortUrl) return Response.json({ error: "upstream" }, { status: 502, headers: CORS });
        return Response.json({ shortUrl: data.shortUrl }, { headers: CORS });
      } catch {
        return Response.json({ error: "upstream" }, { status: 502, headers: CORS });
      }
    }

    return new Response("stock-pk api", { status: 200, headers: CORS });
  },
};
