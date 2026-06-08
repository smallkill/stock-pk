// 股票輸入槽位的 DOM 互動邏輯(client 端)。
// index.astro 與 StockSlots.astro 共用:initSlots() 綁定行為,getSelectedTickers() 取已選 ticker。
import { filterStocks, tickerOf, type Stock } from "./autocomplete";

const MIN_SLOTS = 2;
const MAX_SLOTS = 5;

let stocks: Stock[] = [];
let slotsEl: HTMLElement | null = null;
let addBtn: HTMLButtonElement | null = null;

/** 取目前所有「已從候選選定」的 ticker(dataset.ticker 有值者)。 */
export function getSelectedTickers(): string[] {
  if (!slotsEl) return [];
  const out: string[] = [];
  slotsEl.querySelectorAll<HTMLInputElement>("input.stk").forEach((inp) => {
    const t = inp.dataset.ticker;
    if (t) out.push(t);
  });
  return out;
}

/** 取已選股票的 ticker → 中文名(來自 stocks.json,優於 Yahoo 英文名)。 */
export function getSelectedNames(): Record<string, string> {
  const map: Record<string, string> = {};
  if (!slotsEl) return map;
  slotsEl.querySelectorAll<HTMLInputElement>("input.stk").forEach((inp) => {
    if (inp.dataset.ticker && inp.dataset.name) map[inp.dataset.ticker] = inp.dataset.name;
  });
  return map;
}

/** 目前槽位數。 */
function slotCount(): number {
  return slotsEl ? slotsEl.querySelectorAll(".slot").length : 0;
}

/** 依槽位數更新移除鈕可見性與新增鈕 disable 狀態。 */
function refreshControls(): void {
  if (!slotsEl) return;
  const n = slotCount();
  slotsEl.querySelectorAll<HTMLButtonElement>(".rm").forEach((btn) => {
    btn.style.visibility = n > MIN_SLOTS ? "visible" : "hidden";
  });
  if (addBtn) addBtn.disabled = n >= MAX_SLOTS;
}

/** 建立一個槽位 DOM。prefill 為「0050」這類代號(可選)。 */
function makeSlot(prefill?: string): HTMLElement {
  const slot = document.createElement("div");
  slot.className = "slot";

  const field = document.createElement("div");
  field.className = "field";

  const input = document.createElement("input");
  input.className = "stk";
  input.type = "text";
  input.autocomplete = "off";
  input.placeholder = "輸入代號或股名,例:2330";
  input.dataset.ticker = "";

  const cands = document.createElement("ul");
  cands.className = "cands";
  cands.hidden = true;

  field.append(input, cands);

  const rm = document.createElement("button");
  rm.className = "rm";
  rm.type = "button";
  rm.setAttribute("aria-label", "移除此股票");
  rm.textContent = "✕";
  rm.addEventListener("click", () => {
    if (slotCount() > MIN_SLOTS) {
      slot.remove();
      refreshControls();
    }
  });

  slot.append(field, rm);

  // input 事件 → 重設 ticker(因為內容變了就不再是「已選」)+ 顯示候選
  input.addEventListener("input", () => {
    input.dataset.ticker = "";
    input.dataset.name = "";
    renderCands(input, cands);
  });
  input.addEventListener("focus", () => renderCands(input, cands));
  input.addEventListener("blur", () => {
    // 延遲關閉,讓 mousedown 選取先觸發
    window.setTimeout(() => { cands.hidden = true; }, 120);
  });

  if (prefill) {
    const s = stocks.find((x) => x.code === prefill);
    if (s) {
      input.value = `${s.code} ${s.name}`;
      input.dataset.ticker = tickerOf(s);
      input.dataset.name = s.name;
    } else {
      input.value = prefill;
    }
  }
  return slot;
}

/** 渲染某 input 的候選清單。點選 → 填入並設 dataset.ticker。 */
function renderCands(input: HTMLInputElement, cands: HTMLUListElement): void {
  const matches = filterStocks(stocks, input.value, 8);
  cands.replaceChildren();
  if (matches.length === 0) {
    cands.hidden = true;
    return;
  }
  for (const s of matches) {
    const li = document.createElement("li");
    const code = document.createElement("span");
    code.className = "c-code";
    code.textContent = s.code;
    const name = document.createElement("span");
    name.className = "c-name";
    name.textContent = s.name;
    li.append(code, name);
    // mousedown(早於 blur)避免清單先被關掉
    li.addEventListener("mousedown", (e) => {
      e.preventDefault();
      input.value = `${s.code} ${s.name}`;
      input.dataset.ticker = tickerOf(s);
      input.dataset.name = s.name;
      cands.hidden = true;
    });
    cands.appendChild(li);
  }
  cands.hidden = false;
}

/**
 * 初始化槽位區。讀 /stocks.json、建初始槽位、綁定新增鈕。
 * @param slotsSelector 槽位容器
 * @param addSelector 新增鈕
 * @param prefillCodes 預填代號陣列(如 ["2330","0050"]),用於網址分享帶入;
 *        給定時建這些槽(限 2~5),否則維持預設(第一槽空、第二槽 0050)。
 */
export async function initSlots(
  slotsSelector: string,
  addSelector: string,
  prefillCodes?: string[],
): Promise<void> {
  slotsEl = document.querySelector<HTMLElement>(slotsSelector);
  addBtn = document.querySelector<HTMLButtonElement>(addSelector);
  if (!slotsEl) return;

  try {
    const res = await fetch("/stocks.json");
    stocks = (await res.json()) as Stock[];
  } catch {
    stocks = [];
  }

  if (prefillCodes && prefillCodes.length > 0) {
    // 預填:每個代號一槽,限 MAX_SLOTS;不足 MIN_SLOTS 補空槽。
    const codes = prefillCodes.slice(0, MAX_SLOTS);
    const slots = codes.map((c) => makeSlot(c));
    while (slots.length < MIN_SLOTS) slots.push(makeSlot());
    slotsEl.replaceChildren(...slots);
  } else {
    // 初始兩槽:第一槽空、第二槽預設 0050
    slotsEl.replaceChildren(makeSlot(), makeSlot("0050"));
  }

  if (addBtn) {
    addBtn.addEventListener("click", () => {
      if (slotCount() < MAX_SLOTS) {
        slotsEl!.appendChild(makeSlot());
        refreshControls();
      }
    });
  }
  refreshControls();
}
