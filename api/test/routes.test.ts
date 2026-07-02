import { env, SELF } from "cloudflare:test";
import { describe, it, expect, beforeAll } from "vitest";

beforeAll(async () => {
  await env.DB.exec("CREATE TABLE IF NOT EXISTS visits (ts INTEGER NOT NULL, day TEXT NOT NULL, ip_hash TEXT NOT NULL, country TEXT, path TEXT)");
});

describe("guardrails", () => {
  it("/api/visit 回 204;無 Origin 不帶 ACAO", async () => {
    const r = await SELF.fetch("https://x/api/visit");
    expect(r.status).toBe(204);
    expect(r.headers.get("access-control-allow-origin")).toBe(null);
  });
  it("CORS:允許來源被 echo、他站不帶 ACAO", async () => {
    const ok = await SELF.fetch("https://x/api/stats", {
      headers: { origin: "https://derek-stock-pk.pages.dev" },
    });
    expect(ok.headers.get("access-control-allow-origin")).toBe(
      "https://derek-stock-pk.pages.dev",
    );
    const preview = await SELF.fetch("https://x/api/stats", {
      headers: { origin: "https://abc123.derek-stock-pk.pages.dev" },
    });
    expect(preview.headers.get("access-control-allow-origin")).toBe(
      "https://abc123.derek-stock-pk.pages.dev",
    );
    const evil = await SELF.fetch("https://x/api/stats", {
      headers: { origin: "https://evil.com" },
    });
    expect(evil.headers.get("access-control-allow-origin")).toBe(null);
    // 釣魚 shape:尾綴攻擊不可被 echo
    const phish = await SELF.fetch("https://x/api/stats", {
      headers: { origin: "https://derek-stock-pk.pages.dev.evil.com" },
    });
    expect(phish.headers.get("access-control-allow-origin")).toBe(null);
    // 非 https scheme 的子網域不可被 echo
    const insecure = await SELF.fetch("https://x/api/stats", {
      headers: { origin: "http://abc.derek-stock-pk.pages.dev" },
    });
    expect(insecure.headers.get("access-control-allow-origin")).toBe(null);
  });
  it("/api/stats 回 views/uniqueToday", async () => {
    await SELF.fetch("https://x/api/visit");
    const r = await SELF.fetch("https://x/api/stats");
    const b = await r.json<{ views: number }>();
    expect(typeof b.views).toBe("number");
  });
  it("/api/visit 與 /api/stats 連續呼叫仍放行(測試環境無 RL binding → fail-open)", async () => {
    for (let i = 0; i < 5; i++) {
      const v = await SELF.fetch("https://x/api/visit");
      expect(v.status).toBe(204);
    }
    const s = await SELF.fetch("https://x/api/stats");
    expect(s.status).toBe(200);
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
  it("釣魚繞過 shape 被擋(尾斜線保護):dev.evil.com / dev@evil.com → 400", async () => {
    for (const u of [
      "https://derek-stock-pk.pages.dev.evil.com/phish",
      "https://derek-stock-pk.pages.dev@evil.com/",
    ]) {
      const r = await SELF.fetch("https://x/api/share?u=" + encodeURIComponent(u));
      expect(r.status).toBe(400);
    }
  });
  it("合法 stock-pk 網址但測試環境無 CREATE_TOKEN → 503", async () => {
    const r = await SELF.fetch("https://x/api/share?u=" + encodeURIComponent("https://derek-stock-pk.pages.dev/?t=2330.TW"));
    expect(r.status).toBe(503);
  });
});
