import { describe, it, expect } from "vitest";
import { filterStocks, tickerOf, type Stock } from "../src/lib/autocomplete";

const LIST: Stock[] = [
  { code: "2330", name: "台積電", suffix: "TW" },
  { code: "2317", name: "鴻海", suffix: "TW" },
  { code: "0050", name: "元大台灣50", suffix: "TW" },
  { code: "6488", name: "環球晶", suffix: "TWO" },
];

describe("filterStocks", () => {
  it("代號前綴", () => {
    expect(filterStocks(LIST, "23").map((s) => s.code)).toEqual(["2330", "2317"]);
  });
  it("中文名子字串", () => {
    expect(filterStocks(LIST, "台").map((s) => s.code)).toEqual(["2330", "0050"]);
  });
  it("空輸入回空", () => {
    expect(filterStocks(LIST, "")).toEqual([]);
  });
  it("取前 N(limit)", () => {
    expect(filterStocks(LIST, "", 0)).toEqual([]);
    expect(filterStocks(LIST, "2", 1).length).toBe(1);
  });
});
describe("tickerOf", () => {
  it("組 Yahoo ticker", () => {
    expect(tickerOf({ code: "2330", name: "台積電", suffix: "TW" })).toBe("2330.TW");
    expect(tickerOf({ code: "6488", name: "環球晶", suffix: "TWO" })).toBe("6488.TWO");
  });
});
