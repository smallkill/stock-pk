import { describe, it, expect } from "vitest";
import { encodeState, parseState, type ShareState } from "../src/lib/share";

const sample: ShareState = {
  tickers: ["2330.TW", "0050.TW"],
  from: "2025-06-08",
  to: "2026-06-08",
  amount: 100000,
  base: "0050.TW",
};

function parse(qs: string) {
  return parseState(new URLSearchParams(qs));
}

describe("encodeState / parseState round-trip", () => {
  it("同狀態進出一致", () => {
    const qs = encodeState(sample);
    const back = parse(qs);
    expect(back).toEqual(sample);
  });

  it("encode 用約定參數名 t/f/e/amt/b", () => {
    const p = new URLSearchParams(encodeState(sample));
    expect(p.get("t")).toBe("2330.TW,0050.TW");
    expect(p.get("f")).toBe("2025-06-08");
    expect(p.get("e")).toBe("2026-06-08");
    expect(p.get("amt")).toBe("100000");
    expect(p.get("b")).toBe("0050.TW");
  });
});

describe("parseState 驗證", () => {
  it("無 t → null", () => {
    expect(parse("f=2025-06-08&e=2026-06-08&amt=100000&b=0050.TW")).toBeNull();
    expect(parse("")).toBeNull();
  });

  it("超過 5 檔截到 5", () => {
    const tickers = ["1101.TW", "1102.TW", "1103.TW", "2330.TW", "2317.TW", "0050.TW"];
    const st = parse("t=" + tickers.join(","));
    expect(st?.tickers).toEqual(tickers.slice(0, 5));
  });

  it("非法 amt 回退預設 100000", () => {
    expect(parse("t=2330.TW&amt=abc")?.amount).toBe(100000);
    expect(parse("t=2330.TW&amt=-5")?.amount).toBe(100000);
    expect(parse("t=2330.TW&amt=0")?.amount).toBe(100000);
    expect(parse("t=2330.TW&amt=12.5")?.amount).toBe(100000);
    expect(parse("t=2330.TW")?.amount).toBe(100000);
  });

  it("合法 amt 保留", () => {
    expect(parse("t=2330.TW&amt=250000")?.amount).toBe(250000);
  });

  it("非法 ticker 被濾掉", () => {
    const st = parse("t=2330.TW,GOOG,abcdefg.TW,6488.TWO,,123");
    expect(st?.tickers).toEqual(["2330.TW", "6488.TWO"]);
  });

  it("全部 ticker 非法 → null(沒有有效標的)", () => {
    expect(parse("t=GOOG,XYZ")).toBeNull();
  });

  it("非法日期 → 該欄空字串", () => {
    const st = parse("t=2330.TW&f=2025/06/08&e=bad");
    expect(st?.from).toBe("");
    expect(st?.to).toBe("");
  });

  it("合法日期保留", () => {
    const st = parse("t=2330.TW&f=2025-06-08&e=2026-06-08");
    expect(st?.from).toBe("2025-06-08");
    expect(st?.to).toBe("2026-06-08");
  });

  it("base 預設用第一檔(無 b 或 b 不在清單)", () => {
    expect(parse("t=2330.TW,0050.TW")?.base).toBe("2330.TW");
    expect(parse("t=2330.TW,0050.TW&b=9999.TW")?.base).toBe("2330.TW");
    expect(parse("t=2330.TW,0050.TW&b=0050.TW")?.base).toBe("0050.TW");
  });
});
