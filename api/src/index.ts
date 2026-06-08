import { recordVisit, fetchVisitStats } from "./visits";
import { fetchChart } from "./yahoo";

export interface Env { DB: D1Database; VISIT_SALT?: string; }

const CORS = { "access-control-allow-origin": "*" };
const MAX_TICKERS = 5;

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

    return new Response("stock-pk api", { status: 200, headers: CORS });
  },
};
