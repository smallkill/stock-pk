# 台股多檔 PK

一個台股「最多 5 檔單筆投資 PK」工具:選 2~5 檔台股、設定日期區間與投入金額,計算每檔含息(adjusted close)總報酬、相對基準的差額、標示贏家,並繪製多線成長圖。含訪客數統計。

獨立部署於 Cloudflare(Pages + Worker + D1)。

## 技術棧

- **前端**:Astro 5(Cloudflare Pages),純前端計算與繪圖(SVG)。
- **API**:Cloudflare Worker,代理 Yahoo Finance chart API(取 adjclose)+ 訪客埋點(D1)。
- **股票清單**:build 時由 FinMind `TaiwanStockInfo` 產出 `web/public/stocks.json` 供前端候選。
- **語言/測試**:TypeScript、Vitest(web 用 node 環境測純函式;api 用 `@cloudflare/vitest-pool-workers`)。
- **Monorepo**:npm workspaces(`api`、`web`)。

## 本機開發

```bash
npm install
npm run build:stocks   # 產生 web/public/stocks.json(FinMind)
npm test               # 各 workspace 的單元測試
```

`web/public/stocks.json` 不進 git(由 build 產出);本機開發或 CI 部署前需先跑一次 `npm run build:stocks`。

## 部署

CI(GitHub Actions)於 `main` 分支自動 build stocks.json、部署 Worker(`wrangler deploy`)與 Pages(`wrangler pages deploy`)。

---

by Derek Chen — [作品集](https://derek-chen.pages.dev)
