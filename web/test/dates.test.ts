import { describe, it, expect } from "vitest";
import {
  presetRange, clampEnd, validRange, toYmd, PRESETS,
  detailRange, DETAIL_RANGES, MAX_FROM_MS,
} from "../src/lib/dates";

const NOW = Date.UTC(2026, 5, 8); // 2026-06-08

describe("PRESETS", () => {
  it("含 1m/6m/ytd/1y/3y/5y/10y/max", () => {
    expect(PRESETS.map((p) => p.key)).toEqual(["1m", "6m", "ytd", "1y", "3y", "5y", "10y", "max"]);
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
  it("ytd → 起 = 當年 1/1、訖 = 今天", () => {
    const { from, to } = presetRange("ytd", NOW);
    expect(toYmd(from)).toBe("2026-01-01");
    expect(to).toBe(NOW);
  });
  it("max → 起 = MAX_FROM_MS(1990)、訖 = 今天", () => {
    const { from, to } = presetRange("max", NOW);
    expect(from).toBe(MAX_FROM_MS);
    expect(toYmd(from)).toBe("1990-01-01");
    expect(to).toBe(NOW);
  });
});
describe("detailRange", () => {
  it("DETAIL_RANGES key 順序", () => {
    expect(DETAIL_RANGES.map((r) => r.key)).toEqual(["5d", "1m", "6m", "ytd", "1y", "5y", "max"]);
  });
  it("ytd → 起 = 當年 1/1", () => {
    expect(toYmd(detailRange("ytd", NOW).from)).toBe("2026-01-01");
  });
  it("5d → 起 = 21 天前(抓寬,確保 ≥5 交易日)", () => {
    expect(toYmd(detailRange("5d", NOW).from)).toBe("2026-05-18");
  });
  it("6m → 半年前", () => {
    expect(toYmd(detailRange("6m", NOW).from)).toBe("2025-12-08");
  });
  it("max → MAX_FROM_MS", () => {
    expect(detailRange("max", NOW).from).toBe(MAX_FROM_MS);
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
