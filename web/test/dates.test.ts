import { describe, it, expect } from "vitest";
import { presetRange, clampEnd, validRange, toYmd, PRESETS } from "../src/lib/dates";

const NOW = Date.UTC(2026, 5, 8); // 2026-06-08

describe("PRESETS", () => {
  it("含 1m/6m/1y/3y/5y/10y", () => {
    expect(PRESETS.map((p) => p.key)).toEqual(["1m", "6m", "1y", "3y", "5y", "10y"]);
  });
});
describe("presetRange", () => {
  it("1y → 起 = 一年前、訖 = 今天", () => {
    const { from, to } = presetRange("1y", NOW);
    expect(toYmd(to)).toBe("2026-06-08");
    expect(toYmd(from)).toBe("2025-06-08");
  });
  it("1m → 一個月前", () => {
    expect(toYmd(presetRange("1m", NOW).from)).toBe("2026-05-08");
  });
});
describe("clampEnd", () => {
  it("未來日夾到今天", () => {
    expect(clampEnd(Date.UTC(2030, 0, 1), NOW)).toBe(NOW);
  });
  it("過去日不變", () => {
    const past = Date.UTC(2020, 0, 1);
    expect(clampEnd(past, NOW)).toBe(past);
  });
});
describe("validRange", () => {
  it("from < to → ok", () => {
    expect(validRange(Date.UTC(2020,0,1), Date.UTC(2021,0,1)).ok).toBe(true);
  });
  it("from >= to → 錯", () => {
    expect(validRange(Date.UTC(2021,0,1), Date.UTC(2021,0,1)).ok).toBe(false);
  });
});
