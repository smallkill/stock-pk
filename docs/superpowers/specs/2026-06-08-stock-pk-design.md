# 台股 A vs B 投報率 PK 設計文件

> 日期:2026-06-08 ・ 作者:Derek Chen(NOVA 協助) ・ 狀態:已核可,待轉實作計劃

## 目標

一個極簡的「台股兩檔 PK」小工具:選 A、B 兩檔股票、日期區間、投資金額,按計算 → 算出兩檔的**含息總報酬率**、最終金額、以及彼此的**差額($與%)**,並用一張成長曲線圖一眼看出勝負。

定位:**作品集 side project**,獨立部署、從履歷超連結過去(不嵌入)。重點是做得漂亮 + 完整部署上線。撞題不介意(YP指投網有較複雜的同類工具)。

## 設計決策(已確認)

- **獨立**:新 GitHub repo `stock-pk`,**自己的 CI/CD,完全不碰履歷 repo(devbox)**。
- **技術棧**:Cloudflare **Pages(前端)+ Worker(API)+ D1(訪客)**。延續 Derek 的 Cloudflare 作品集主線。
- **網域**:免費 `derek-stock-pk.pages.dev`(URL 帶名字)+ 兩站共用「Derek Chen」品牌字標 + 履歷↔工具互相連結,讓人明顯知道同一人。(日後可升級自訂網域。)
- **資料源**:Yahoo Finance chart API(已實測台股 `.TW`/`.TWO` 可用、含 `adjclose` 還原權值=含息總報酬、免 API key)。
- **報酬定義**:用 `adjclose`(還原權值,已含息與分割調整)→ 投報率 = `adjEnd/adjStart − 1`,即「買進持有 + 股息再投入」的總報酬。
- **股票清單**:build 時從台灣證交所(上市)+ 櫃買中心(上櫃)抓「代號 + 中文名 + 市場別」產生 `stocks.json`(~2000 檔)打包進前端。候選清單**純前端過濾**(支援代號前綴 + 中文名子字串),快、免額外 API。
- **成長圖**:手刻輕量 SVG 折線(無第三方依賴、完全控制外觀)。
- **訪客數**:沿用 devbox 的 visits 模式(Worker + D1 + `sha256(ip+VISIT_SALT+day)`,不存原始 IP),頁面顯示「N 人用過」。
- **日期**:快捷鈕 `1個月 / 半年 / 1年 / 3年 / 5年 / 10年`(點了自動設區間,結束=今天、起始=今天往前推)+ 保留自訂起訖日。

## 架構

```
前端(Astro on Cloudflare Pages)
  A 輸入(代號/中文名 → 即時候選清單)
  B 輸入(預設 0050,可改)
  日期快捷鈕 / 自訂區間(結束預設今天)
  金額(預設 100,000,可調)
  [計算]
        │ GET /api/compare?a=2330.TW&b=0050.TW&from=<unix>&to=<unix>
        ▼
Worker(Cloudflare)
  /api/compare:代理 Yahoo chart API(避 CORS)+ Cloudflare Cache(過去日資料不變,快取)
     回 { a:{series, adjStart, adjEnd, name, firstDate}, b:{...} }
  /api/visit:訪客埋點(visits 模式)
  /api/stats:回訪客彙整(至少 total uses)
        ▼
前端計算 + 渲染
  投報率 = adjEnd/adjStart − 1
  最終金額 = 本金 × adjEnd/adjStart
  成長序列[i] = 本金 × adj[i]/adj[0]
  差額 = finalA − finalB;差額% = (finalA − finalB)/finalB
  → 數字卡片(A、B 各自:投報率% / 最終金額;中間:差額 $ 與 %)
  → 成長曲線圖(兩條線:A vs B 從本金成長到結束)
```

## 元件(各自單一職責)

| 元件 | 職責 | 依賴 |
|---|---|---|
| **web/**(Astro on Pages) | 工具 UI:輸入、候選、日期快捷、結果卡片、成長圖、訪客數、品牌與互連 | Worker API、stocks.json |
| web `StockInput`(元件 + client TS) | 代號/中文名輸入 → 即時候選清單(純前端過濾 stocks.json) | stocks.json |
| web `compare.ts`(純函式) | ROI / 最終金額 / 成長序列 / 差額$與% 計算;日期貼齊 | — |
| web `chart.ts`(純函式 + DOM) | 把兩條成長序列畫成 SVG 折線 | — |
| web `dates.ts`(純函式) | 快捷鈕區間計算(today − N)、結束夾到今天、from>to 驗證 | — |
| **api/**(Worker) | `/api/compare` 代理+快取 Yahoo;`/api/visit`、`/api/stats` 訪客 | D1、VISIT_SALT |
| api `yahoo.ts`(純函式 + fetch) | 組 Yahoo URL、解析回應取 adjclose 序列、貼齊起訖、錯誤→null | — |
| api `visits.ts` | 訪客埋點/彙整(複用 devbox 模式) | D1 |
| **scripts/build-stocks.mjs** | 抓 TWSE+TPEx 清單 → 產生 `web/public/stocks.json` | — |
| **.github/workflows/ci.yml** | lint / typecheck / test → deploy Worker + Pages | GitHub Actions + Wrangler |

## 資料流細節

1. **股票清單(build/維護時)**:`scripts/build-stocks.mjs` 抓證交所 ISIN 清單(上市 `strMode=2`、上櫃 `strMode=4`)解析出 `{code, name, market}`(market 決定 `.TW`/`.TWO` 後綴),輸出 `web/public/stocks.json`。前端載入後做候選過濾。內容變動不頻繁,手動重跑即可。
2. **候選(輸入時)**:使用者在 A 欄輸入 → 前端過濾 stocks.json:代號以輸入開頭 OR 中文名含輸入字串,取前 ~8 筆顯示;選定後記住其 `code+suffix`(ticker)。
3. **計算(按鈕)**:前端把 A、B 的 ticker + 區間 unix 起訖 打給 `/api/compare`。Worker 代理 Yahoo `v8/finance/chart/<ticker>?period1=&period2=&interval=1d&events=div`,各取 `adjclose` 序列(濾掉 null);以 Cloudflare Cache 快取(key=ticker+from+to;過去日資料不可變)。回兩檔的序列 + 起訖 adjclose + 股名 + 該股最早可用日。
4. **算與畫**:前端用 `compare.ts` 算投報率/最終金額/差額,用 `chart.ts` 畫兩條成長線。
5. **訪客**:頁面載入 fire-and-forget `/api/visit`;頁面角落顯示「N 人用過」(讀 /api/stats)。

## 計算正確性 / 邊界

- **交易日貼齊**:Yahoo 只回交易日;起點取 ≥ from 的第一個交易日,終點取 ≤ to 的最後一個。
- **公平比較用「共同可用區間」**:PK 必須兩檔比**同一段期間**才公平。實際起點 = `max(from 貼齊, A 最早日, B 最早日)`、實際終點 = `min(to 貼齊, A 最末日, B 最末日)`。若因此被調整(例如某檔較晚上市)→ 明確提示「為公平比較,區間調整為 {實際起} ~ {實際終}(因 {股名} 該期間才有資料)」,兩檔都以此共同區間的起點本金為基準、圖以同一起點對齊本金線。
- **找不到股票 / Yahoo 逾時 / 無資料**:友善錯誤訊息,不裸露原始錯誤。
- **結束日 > 今天** → 夾到今天;**from > to** → 擋並提示;區間過短(同一天)→ 提示選長一點。
- **adjclose 含 null**(暫停交易日)→ 過濾後再算。

## 錯誤處理 / 降級

- `/api/compare`:Yahoo 失敗(逾時 3–5s / 非 200 / 空資料)→ 回結構化錯誤碼(`not_found` / `no_data` / `upstream`),前端顯示對應友善訊息 + 不阻擋其他輸入。
- `/api/visit`:fire-and-forget,一律 204(D1 失敗不報錯)。
- `/api/stats`:失敗回 null,前端訪客數顯示「—」。
- 前端:Worker 不可用 → 顯示「資料服務暫時無法使用,稍後再試」。

## 測試策略

- **純函式單元(vitest)**:
  - `compare.ts`:已知 adjStart/adjEnd → 投報率、最終金額;兩檔 → 差額$與%;成長序列首值=本金、末值=最終金額。
  - `dates.ts`:快捷鈕(1月/半年/1年/3年/5年/10年)算出正確起訖;結束夾今天;from>to 判錯。
  - `yahoo.ts`:組 URL 正確、解析範例回應取 adjclose、貼齊起訖、空資料→null。
  - autocomplete 過濾:代號前綴 + 中文名子字串、取前 N。
- **Worker 整合(@cloudflare/vitest-pool-workers)**:`/api/visit`→204+寫 D1;`/api/stats` 回彙整;`/api/compare` 對 mock/實測一檔回正確結構(或以可注入的 fetch 測解析路徑,避免測試打真 API)。
- **人工驗收**:實際比 2330 vs 0050 各區間、離譜輸入(找不到股票、未上市區間)、訪客數遞增。

## 部署 / Infra

- GitHub repo `stock-pk`(獨立;預設依 [[github-repos-default-private]] 為 private,但作品集要公開展示 → **建議 public**,實作時確認)。
- Cloudflare:Pages 專案 `derek-stock-pk`(→ `derek-stock-pk.pages.dev`);Worker `stock-pk-api`;D1 資料庫 `stockpk`;secret `VISIT_SALT`。
- CI:GitHub Actions(lint/typecheck/test 全綠 → `wrangler deploy` Worker + Pages),repo secret `CLOUDFLARE_API_TOKEN`(可重用既有 Edit Workers token)。
- 履歷站:在 devbox 的專案區或 nav 加一個連到此工具的超連結(獨立小改,屬 devbox repo,不在本 repo 範圍)。

## 非目標(YAGNI)

定期定額、股息再投入開關(adjclose 已含息)、多檔(>2)比較、年化/夏普/回撤等進階指標、美股、即時報價、登入、儲存歷史查詢。先把「A vs B 單筆 PK + 成長圖 + 訪客數」做到漂亮。

## 待實作時定

- `stocks.json` 是否含 ETF 與興櫃(先含上市+上櫃普通股+ETF;興櫃先不收)。
- 成長圖是否顯示 hover tooltip(先做靜態兩線 + 圖例;tooltip 視時間再加)。
- 數字卡片配色與「贏家」視覺強調樣式(實作時定,維持簡潔)。
