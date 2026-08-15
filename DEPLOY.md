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
