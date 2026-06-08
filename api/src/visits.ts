export function utcDay(ts: number): string { return new Date(ts).toISOString().slice(0, 10); }

export async function hashIp(ip: string, salt: string, day: string): Promise<string> {
  const data = new TextEncoder().encode(`${ip}|${salt}|${day}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
export interface VisitEnv { DB: D1Database; VISIT_SALT?: string; }
export async function recordVisit(env: VisitEnv, ip: string, country: string, path: string): Promise<void> {
  const ts = Date.now(), day = utcDay(ts);
  const ipHash = await hashIp(ip, env.VISIT_SALT ?? "", day);
  await env.DB.prepare("INSERT INTO visits (ts, day, ip_hash, country, path) VALUES (?,?,?,?,?)")
    .bind(ts, day, ipHash, country || null, path || null).run();
}
export interface VisitStats { views: number; uniqueToday: number; }
export async function fetchVisitStats(env: VisitEnv): Promise<VisitStats | null> {
  try {
    const today = utcDay(Date.now());
    const [v, u] = await Promise.all([
      env.DB.prepare("SELECT count(*) AS n FROM visits").first<{ n: number }>(),
      env.DB.prepare("SELECT count(DISTINCT ip_hash) AS n FROM visits WHERE day = ?").bind(today).first<{ n: number }>(),
    ]);
    return { views: v?.n ?? 0, uniqueToday: u?.n ?? 0 };
  } catch (e) { console.error("fetchVisitStats failed:", e); return null; }
}
