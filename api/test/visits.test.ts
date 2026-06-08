import { env } from "cloudflare:test";
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { utcDay, hashIp, recordVisit, fetchVisitStats } from "../src/visits";

describe("utcDay", () => {
  it("毫秒 ts → YYYY-MM-DD(UTC)", () => {
    expect(utcDay(Date.UTC(2026, 5, 8, 23, 0, 0))).toBe("2026-06-08");
    expect(utcDay(0)).toBe("1970-01-01");
  });
});

describe("hashIp", () => {
  it("回 64 字元 hex(SHA-256)", async () => {
    const h = await hashIp("1.2.3.4", "salt", "2026-06-08");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });
  it("同輸入 → 同 hash", async () => {
    const a = await hashIp("1.2.3.4", "salt", "2026-06-08");
    const b = await hashIp("1.2.3.4", "salt", "2026-06-08");
    expect(a).toBe(b);
  });
  it("不同 ip → 不同 hash", async () => {
    const a = await hashIp("1.2.3.4", "salt", "2026-06-08");
    const b = await hashIp("5.6.7.8", "salt", "2026-06-08");
    expect(a).not.toBe(b);
  });
  it("不同 salt → 不同 hash", async () => {
    const a = await hashIp("1.2.3.4", "salt-a", "2026-06-08");
    const b = await hashIp("1.2.3.4", "salt-b", "2026-06-08");
    expect(a).not.toBe(b);
  });
});

describe("recordVisit / fetchVisitStats (D1)", () => {
  beforeAll(async () => {
    await env.DB.exec("CREATE TABLE IF NOT EXISTS visits (ts INTEGER NOT NULL, day TEXT NOT NULL, ip_hash TEXT NOT NULL, country TEXT, path TEXT)");
  });
  beforeEach(async () => {
    await env.DB.exec("DELETE FROM visits");
  });

  it("空表 → views=0 / uniqueToday=0", async () => {
    const s = await fetchVisitStats(env);
    expect(s).not.toBeNull();
    expect(s!.views).toBe(0);
    expect(s!.uniqueToday).toBe(0);
  });

  it("同 ip 兩次 → views=2、uniqueToday=1", async () => {
    await recordVisit(env, "1.2.3.4", "TW", "/");
    await recordVisit(env, "1.2.3.4", "TW", "/");
    const s = await fetchVisitStats(env);
    expect(s!.views).toBe(2);
    expect(s!.uniqueToday).toBe(1);
  });

  it("兩個不同 ip → views=2、uniqueToday=2", async () => {
    await recordVisit(env, "1.2.3.4", "TW", "/");
    await recordVisit(env, "5.6.7.8", "US", "/");
    const s = await fetchVisitStats(env);
    expect(s!.views).toBe(2);
    expect(s!.uniqueToday).toBe(2);
  });

  it("country/path 為空字串時存 null", async () => {
    await recordVisit(env, "1.2.3.4", "", "");
    const row = await env.DB.prepare("SELECT country, path FROM visits LIMIT 1").first<{ country: string | null; path: string | null }>();
    expect(row!.country).toBeNull();
    expect(row!.path).toBeNull();
  });
});
