import { env, SELF } from "cloudflare:test";
import { describe, it, expect, beforeAll } from "vitest";

beforeAll(async () => {
  await env.DB.exec("CREATE TABLE IF NOT EXISTS visits (ts INTEGER NOT NULL, day TEXT NOT NULL, ip_hash TEXT NOT NULL, country TEXT, path TEXT)");
});

describe("guardrails", () => {
  it("/api/visit 回 204 + CORS", async () => {
    const r = await SELF.fetch("https://x/api/visit");
    expect(r.status).toBe(204);
    expect(r.headers.get("access-control-allow-origin")).toBe("*");
  });
  it("/api/stats 回 views/uniqueToday", async () => {
    await SELF.fetch("https://x/api/visit");
    const r = await SELF.fetch("https://x/api/stats");
    const b = await r.json<{ views: number }>();
    expect(typeof b.views).toBe("number");
  });
  it("/api/compare 缺 tickers 回 400", async () => {
    const r = await SELF.fetch("https://x/api/compare?from=1&to=2");
    expect(r.status).toBe(400);
  });
  it("/api/compare 超過 5 檔回 400", async () => {
    const r = await SELF.fetch("https://x/api/compare?tickers=a,b,c,d,e,f&from=1&to=2");
    expect(r.status).toBe(400);
  });
});

describe("GET /api/share", () => {
  it("非 stock-pk 網址 → 400", async () => {
    const r = await SELF.fetch("https://x/api/share?u=" + encodeURIComponent("https://evil.com/"));
    expect(r.status).toBe(400);
  });
  it("缺 u → 400", async () => {
    const r = await SELF.fetch("https://x/api/share");
    expect(r.status).toBe(400);
  });
  it("合法 stock-pk 網址但測試環境無 CREATE_TOKEN → 503", async () => {
    const r = await SELF.fetch("https://x/api/share?u=" + encodeURIComponent("https://derek-stock-pk.pages.dev/?t=2330.TW"));
    expect(r.status).toBe(503);
  });
});
