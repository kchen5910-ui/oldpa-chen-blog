# 我的獨立部落格（indie-blog）

一個**完全獨立**於其他專案的靜態部落格：自由撰寫、隨心發布、無平台審核、可部署到任何靜態主機。

> 此專案與診所官網（`F:\網頁構想`）**完全分離**，擁有獨立的程式碼庫、內容與部署環境。

> 📋 **接手或久未回來？先看 [`PROJECT_STATUS.md`](PROJECT_STATUS.md)**
> 裡面有目前進度、文章清單、維護 SOP、待辦清單與已知的環境地雷。

## 目錄結構

```
indie-blog/
├─ source/              ← 你寫作的地方（唯一需要動的資料夾）
│  ├─ site.json         ← 站台設定（標題、作者、描述…）
│  ├─ posts/            ← 文章（每篇一個 .md）
│  └─ pages/            ← 獨立頁面（如 about.md → about.html）
├─ assets/              ← 樣式與腳本（可改）
│  ├─ css/style.css
│  └─ js/main.js
├─ build.js             ← 編譯器（不用改）
├─ serve.js             ← 本地預覽伺服器（不用改）
├─ package.json
└─ public/              ← 「編譯產出」，這就是要上傳部署的資料夾（自動生成）
```

## 如何新增一篇文章

1. 在 `source/posts/` 新建一個 `.md` 檔，例如 `my-post.md`。
2. 檔案開頭寫 frontmatter：

   ```markdown
   ---
   title: 文章標題
   date: 2026-08-15
   category: 隨筆          # 分類（單一）
   tags: [想法, 自由]      # 標籤（可多個，用逗號或 YAML 陣列）
   excerpt: 選填，摘要；不填會自動擷取正文前 140 字
   draft: false            # 設 true 則不會發布
   ---

   這裡開始寫正文，支援完整 Markdown。
   ```

3. 存檔後執行編譯：

   ```bash
   npm run build
   ```

4. 本地預覽：

   ```bash
   npm run serve      # 開 http://localhost:4321/
   ```

## 功能

- **文章發布**：寫 Markdown → 編譯成靜態頁面，零後端。
- **分類 / 標籤**：frontmatter 設定；`topics.html` 提供點擊篩選介面。
- **基本排版**：Markdown 全功能（標題、清單、引用、程式碼、表格、圖片、連結）。
- **閱讀介面**：閱讀導向排版、響應式、深色模式切換、上一篇/下一篇導覽、RSS。
- **無審核**：內容完全由你掌控，不經任何第三方平台。
- **SEO 與分享**：每頁自動產生 `canonical`、Open Graph / Twitter Card meta；編譯時一併產出 `sitemap.xml`、`robots.txt`、`404.html`，並內嵌 SVG favicon，便於搜尋引擎收錄與社群分享。

## 部署

`public/` 資料夾就是整個網站，把它上傳到任何靜態主機即可。本機已附 `netlify.toml`（建置指令 `node build.js`、發布目錄 `public`、並以 `404.html` 處理未知路由），連結 Git 倉庫即可一鍵部署。

- **Netlify**：連結 Git 倉庫即自動套用 `netlify.toml`；或手動拖放 `public/` 資料夾。
- **Vercel**：建置指令 `node build.js`、輸出目錄 `public`。
- **GitHub Pages**：把 `public/` 內容推到 `gh-pages` 分支。
- **自己的空間 / 任意靜態主機**：FTP 上傳 `public/` 即可。

### 上線前兩件事

1. **設定 `baseUrl`**：在 `source/site.json` 填入你的網域。目前已設為 `https://oldpa-chen.netlify.app`。
   `canonical`、RSS、sitemap 與 OG 網址都靠它變成絕對路徑，**換網域時一定要改**。
2. ~~替換示範內容~~ ✅ **已完成**：`welcome.md` / `markdown-demo.md` / `free-writing.md`
   三篇示範文早已刪除，目前 20 篇全是正式文章。

> 選填：在 `site.json` 加 `"socialImage": "assets/img/cover.png"` 可讓分享到社群時顯示預覽圖（圖片請放在 `assets/` 下，編譯時會一併複製到 `public/`）。目前留白。

## 系列的寫法

`category` 就是「系列名」。同一個 category 有 2 篇以上時，build.js 會自動：

- 在文章頁頂端產生「系列閱讀路徑」（第 n / 共 m 篇，含全部系列文章連結）
- 上一篇／下一篇**只在同系列內**導覽，不會被別的系列插隊
- 在 `archive.html` 產生「系列總覽」區塊

排序規則：同系列若**過半數**文章有 `order` 欄位，就用 `order` 排序；否則用 `date`。
（顱薦骨系列 8 篇已全部標好 `order: 1..8`。）

## 下架（封存）文章

把 `.md` 從 `source/posts/` 移到 `source/_archive/`，再 `node build.js` 即可。
build.js 會自動把 `public/posts/` 裡對應的舊 HTML 清掉（搬到 `.build-trash/` 備份），
所以拖放部署也不會把已下架的文章帶上線。

> ⚠️ 首頁只顯示最新 12 篇（`site.json` 的 `postsPerHome`）。
> 第 13 篇以後的文章不會出現在首頁，但仍會進 `archive.html`、`sitemap.xml` 與 RSS。

## 擴充建議

- 想要「草稿預覽」：建一個 `npm run build:all` 暫時把 `draft` 視為發布。
- 想要網站搜尋：在 `main.js` 加一個針對 `archive.html` 的客戶端篩選。
- 想要留言：見 `PROJECT_STATUS.md` §6。`comments/` 已有自託管後端，
  但靜態託管跑不了；改用 giscus / utterances 會更省事。
- 想要多作者：在 frontmatter 加 `author` 欄位並於版面顯示。
