# 部署到 Netlify 步驟清單

本專案是純靜態部落格：`build.js` 把 `source/` 下的 Markdown 編譯成 `public/`，再把 `public/` 上傳即可。
Netlify 會自動執行 `npm install`（安裝 `marked`）後跑 `node build.js`，不需要你手動編譯。

---

## 方式 A：連接 Git（推薦，日後改文章會自動重建）

### 1. 把專案放進 GitHub
1. 在 GitHub 新建一個空倉庫（例如 `indie-blog`），**不要**勾選自動產生 README。
2. 在本機專案根目錄（`F:\indie-blog`）初始化並推送：

   ```bash
   cd F:/indie-blog
   git init
   git add .
   git commit -m "init blog"
   git branch -M main
   git remote add origin https://github.com/你的帳號/indie-blog.git
   git push -u origin main
   ```

### 2. 註冊並連接 Netlify
1. 開 https://app.netlify.com 用 GitHub 帳號登入（免費方案就夠）。
2. 點 **Add new site → Import an existing project → GitHub**。
3. 授權並選剛才的 `indie-blog` 倉庫。
4. **建置設定**（Netlify 會從 `netlify.toml` 自動帶入，若沒帶入就手動填）：
   - Build command：`node build.js`
   - Publish directory：`public`
5. 點 **Deploy site**。幾十秒後出現綠色 `Published`。

### 3. 拿到免費網址，回填 `baseUrl`
1. 部署成功後，Netlify 會給一個網址，長這樣：`https://隨機字串.netlify.app`（可在 Site settings → Site details → Change site name 改成好記的，例如 `chenlaosou.netlify.app`）。
2. 打開 `source/site.json`，把 `baseUrl` 改成你的網址（**含 https://，不含結尾斜線**）：

   ```json
   "baseUrl": "https://chenlaosou.netlify.app"
   ```

3. 存檔後 `git commit` 並 `git push`，Netlify 會自動重新部署。
   （此時 `canonical`、RSS、sitemap、Open Graph 才會是絕對網址，對 SEO 與訂閱正確性很重要。）

> **小提醒**：即使先不填 `baseUrl` 直接部署，網站照常能看能點，只是內部連結用相對路徑。等你確定網址再回填一次即可。

---

## 方式 B：直接拖曳上傳（不想用 Git 時）

1. 本機先編譯一次：`npm install` 再 `node build.js`（會產生 `public/`）。
2. 開 https://app.netlify.com/drop 把 `public/` 資料夾拖進去。
3. 立即得到 `*.netlify.app` 網址。
4. 缺點：日後改文章要**手動重編譯並重新拖曳上傳**，不會自動更新。建議認真經營時改用方式 A。

---

## 日後寫文章如何上線（方式 A）

1. 在 `source/posts/` 新增一個 `.md`（照現有文章填好 frontmatter：`title`/`date`/`category`/`tags`/`slug`/`excerpt`/`draft`）。
2. `git add . && git commit -m "新增文章" && git push`。
3. Netlify 偵測到推送 → 自動 `node build.js` → 自動上線。不用手動操作後台。

想先本地預覽再推送：`npm run dev`（會編譯並開 `http://localhost:4321`）。

---

## 選配：綁定專屬域名（想要好記名字才做）

1. 去域名商（Namecheap / Porkbun / Gandi / 亞太 / TWNIC 等）註冊購買，例如 `chenlaosou.com`。
2. 在 Netlify：**Site settings → Domain management → Add a custom domain**，輸入你的域名。
3. 按 Netlify 指示去域名商後台加 DNS 紀錄（通常是一筆 `CNAME` 指向 `你的站.netlify.app`，或用 Netlify 提供的 DNS 伺服器）。
4. 生效後，把 `source/site.json` 的 `baseUrl` 改成專屬域名（如 `https://chenlaosou.com`），`git push` 重新部署。

---

## 上線前清單

- [ ] 刪除或替換 `source/posts/` 裡的三篇示範文：`welcome.md`、`markdown-demo.md`、`free-writing.md`
- [ ] 確認 `source/site.json` 的 `title` / `author` / `description` 都是你要的
- [ ] 部署後回填 `baseUrl`（見方式 A 第 3 步）
- [ ] （選配）設定 `socialImage`（分享到社群時的預覽圖，留空則用站名）

---

## 附：系列文章排序慣例（一律倒序顯示）

**規則（2026-10-09 確立）**：凡是同一 `category` 有 2 篇以上的「系列文章」，每篇 frontmatter 都必須有 `order` 欄位，值按**發布／閱讀順序**編號（第 1 篇 = 1，最後 1 篇 = N）。

- `build.js` 主列表（首頁／archive）排序邏輯是「日期新→舊，同日則 `order` 降序」→ 因此 `order` 最大的（系列最後一篇）排在前面，主列表**一律倒序**（結尾篇在前）。
- 單篇系列（category 僅 1 篇）不需要 `order`。
- 系列總覽卡片（archive 裡的 series-list）與單篇內的「上一篇／下一篇」「系列路徑」仍按 `order` **升序**排列，作為閱讀引導，不動。

**怎麼加 `order`**：在每篇 md 的 frontmatter 的 `date:` 行下面加一行 `order: N` 即可，例如：

```yaml
---
title: 肘部筆記（一）：…
date: 2026-09-30
order: 1          # ← 系列第 1 篇
category: 肘部筆記
---
```

**為什麼要有這條**：曾發生「肘部筆記」「隨筆觀察」兩個同日期系列忘記加 `order`，導致主列表退化成依檔名排序、變成正序。2026-10-09 已補齊肘部筆記、隨筆觀察、遠絡筆記三個系列的 `order`。往後新增系列文章請直接帶 `order`，避免再犯。

> 注意：改完 `source/posts/` 後，本地 `public/` 與 `deploy-bundle.zip` 還是舊排序，要等下次 `node build.js` + 重包 zip + 上傳才會在線上生效。
