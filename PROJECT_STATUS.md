# 專案現狀與交接說明（indie-blog）

> 這份文件**納入 Git 版控**，隨專案一起保存。換人接手、換電腦、或隔一陣子回來，
> 先看這份就知道現在做到哪、接下來該做什麼。
> 最後更新：2026-09-05

---

## 1. 這是什麼

個人獨立部落格「**陳老叟的筆記**」，純靜態、無後台、無審核、無演算法。

- **線上網址**：https://oldpa-chen.netlify.app
- **GitHub 倉庫**：https://github.com/kchen5910-ui/oldpa-chen-blog
- **本機路徑**：`F:\indie-blog`
- **相關專案**：官網「老師傅工作室」在 `F:\網頁構想`（**兩者完全獨立，各自部署**）

### 技術選擇：為什麼不用 Hugo / Hexo / Astro

整站只有一個 `build.js`（約 800 行，依賴僅 `marked`），自己寫的靜態產生器。
好處是零框架升級風險、行為完全可控；代價是功能要自己加。**不要輕易換框架**，
除非明確願意重寫所有模板。

---

## 2. 目錄結構

```
indie-blog/
├─ source/                  ← 你唯一需要動的資料夾
│  ├─ site.json             ← 站台設定（title / author / baseUrl / 官網交叉連結）
│  ├─ posts/                ← 已發布文章（每篇一個 .md）
│  ├─ pages/                ← 獨立頁面（about.md → about.html）
│  └─ _archive/             ← 封存區（不發布，但永久保留原文）
├─ assets/                  ← css / js 來源（建置時複製到 public/）
├─ comments/                ← 留言後端（零依賴 Node；目前未啟用，見 §6）
├─ build.js                 ← 編譯器
├─ serve.js                 ← 本地預覽（port 4321）
├─ netlify.toml             ← 部署設定（build: node build.js / publish: public）
├─ public/                  ← 建置產出（要上線的就是這個資料夾）
└─ .build-trash/            ← 建置時被清掉的殘檔（已 gitignore）
```

**重要**：`public/` 是自動產生的，**不要手動編輯**（下次建置會被覆蓋）。
要改內容一律改 `source/` 或 `assets/`，再跑 `node build.js`。

---

## 3. 目前狀態（2026-09-05）

### 文章：已發布 20 篇

| 分類（= 系列） | 篇數 | 說明 |
|---|---|---|
| 顱薦骨系列 | 8 | CST A–G＋總結，`order: 1..8` 控制順序 |
| 遠絡筆記 | 7 | 緣起→學習→病例→困境→改進→未竟，日期 08-18～08-24 依序 |
| AMCT 筆記 | 1 | `amct-genesis`（2026-09-02） |
| 緣起 | 1 | `origin` |
| 整骨傳統 | 1 | `european-osteopathy` |
| 臨床科普 | 1 | `cervicogenic-headache` |
| 膝蓋筆記 | 1 | `knee-clicking` |

- 首頁顯示最新 **12** 篇（`site.json` 的 `postsPerHome`）；全部文章在 `archive.html`。
- 單一系列 ≥2 篇時，文章頁會自動產生「系列閱讀路徑」與「上一篇/下一篇（限同系列）」。

### 封存中（未發布，10 篇）

放在 `source/_archive/`，build.js 不會讀取這個資料夾：

- **髖膝足系列 5 篇**：`hip-knee-foot-preface` / `hip-joint` / `knee-joint` / `foot-ankle` / `kinetic-chain-oa`
- **腰及骨盆系列 5 篇**：`low-back-pelvis-preface` / `lumbar-spine` / `pelvis-sij` / `lumbo-pelvic-core` / `kinetic-chain`

> **只封存、不刪除**。這 10 篇是 2026-08-19 因「教科書味太重、未脫離官網氣質」而下架，
> 改走「單篇單篇寫、寫細、寫讀者真正關心的事」的新方向。原稿完整保留，隨時可改寫後重新發布。

### Git 狀態

本地 main = `7101bc8`。遠端 GitHub 的同步狀態請自行確認：

```bash
cd F:/indie-blog
git log --oneline -1                  # 本地最新
git ls-remote origin HEAD             # 遠端最新（需網路）
```

兩者一致代表已同步。

---

## 4. 日常維護 SOP

### 4.1 寫一篇新文章

1. 在 `source/posts/` 新增 `my-topic.md`
2. 檔頭寫 frontmatter：

```markdown
---
title: 文章標題
date: 2026-09-05
category: 膝蓋筆記        # = 系列名；同系列會出現系列導覽
order: 1                  # 選填，同系列多數文章有 order 時，用它排序而非日期
tags: [膝蓋, 關節聲音]     # 可多個
excerpt: 選填，不填自動抓前 140 字
draft: false              # true 則不發布
---
```

3. 內文第一行**不要再寫 `# 大標題`**（build.js 會自己產生 h1，重複會出現兩個標題）

### 4.2 建置與預覽

```bash
cd F:/indie-blog
npm run build      # 等同 node build.js，產出到 public/
npm run serve      # 開 http://localhost:4321 預覽
npm run dev        # 建置 + 預覽一次做完
```

建置約 1 秒。若出現「清除殘檔 N 個」是正常的：代表有文章被下架或改了 slug，
舊 HTML 已從 `public/` 移除（舊檔會備份到 `.build-trash/`）。

### 4.3 暫時下架一篇文章

```bash
git mv source/posts/xxx.md source/_archive/
node build.js
```

`public/posts/xxx.html` 會被自動清除，拖放部署也不會帶上去。
移回 `source/posts/` 即重新上線。

### 4.4 發布上線

```bash
git add .
git commit -m "簡述這次改了什麼"
git push origin main
```

Netlify 若有連接 GitHub，會自動重新建置並上線。
若沒有連接，就手動把 `public/` 拖到 https://app.netlify.com/drop 。

---

## 5. 部署設定

- **平台**：Netlify（站名 `oldpa-chen`）
- **建置指令**：`node build.js`
- **發布目錄**：`public`
- **設定檔**：`netlify.toml`（已含上述設定；404 由 Netlify 預設的 `public/404.html` 處理）
- **絕對網址**：`source/site.json` 的 `baseUrl` = `https://oldpa-chen.netlify.app`
  （影響 canonical / RSS / sitemap / Open Graph，**換網域時一定要改這裡**）

### ⚠️ 目前線上版本落後（待處理）

線上 `https://oldpa-chen.netlify.app` 目前跑的是**較舊的手動拖放版本**：

- 缺少 AMCT 那篇（`/posts/amct-genesis.html` → 404）
- 缺少遠絡筆記系列 7 篇
- 缺少系列閱讀路徑、本文目錄、系列總覽等新版版面

也就是說，官網 about 頁連到 AMCT 那篇的連結**目前是壞的**。
**解決辦法**：把 Netlify 站點連接 GitHub 倉庫（或重新拖放 `public/`），詳見 §7 待辦第 1 項。

---

## 6. 留言功能（已開發，尚未啟用）

`comments/server.js` ＋ `comments/manage.js` 是零依賴的 Node 留言後端，
具備 JSON 持久化、基礎防濫用，以及備份／列表／統計／匯出／還原等維運指令。

**但目前沒有啟用**，原因是它需要一台常駐的 Node 伺服器，而 Netlify 免費方案
只跑靜態檔、不能跑後端。`site.json` 的 `commentsApiBase` 目前是空字串，
前端 `assets/js/comments.js` 因而不會發出任何請求。

若要啟用，需：
1. 找一台可跑 Node 的主機（VPS / Render / Railway / Fly.io）
2. 部署 `comments/`，記下對外網址
3. 回填 `source/site.json` 的 `commentsApiBase`，重新建置

**替代方案**（純靜態、推薦）：改用 giscus 或 utterances，以 GitHub Issue/Discussion
當留言資料庫，不需要自己養後端，也符合本專案「無後台」的精神。

---

## 7. 待辦清單（依優先順序）

| # | 項目 | 說明 |
|---|---|---|
| 1 | **把 Netlify 連上 GitHub（或重新拖放部署）** | 目前線上版本落後，官網 AMCT 連結是 404。最高優先 |
| 2 | **把本地 commit 推上 GitHub** | 見 §8，需要本機執行 |
| 3 | 髖膝足／腰骨盆 10 篇封存稿的改寫 | 改走單篇單篇寫，寫細、寫讀者真正關心的事 |
| 4 | 決定留言功能走向 | 自託管後端 vs giscus/utterances，或維持不開放 |
| 5 | `socialImage` 分享預覽圖 | `site.json` 目前空白，社群分享沒有縮圖 |
| 6 | 首頁只顯示 12 篇 | 文章變多後可考慮提高 `postsPerHome` 或加分頁 |

---

## 8. 已知的環境限制

### 沙箱內無法 git push

本機的 Git Credential Manager 需要開啟瀏覽器做互動式驗證，
在自動化環境裡沒有瀏覽器，`git push` 會**卡住直到逾時**（不會報錯，也不會成功）。

**解法**：在本機的終端機（或 Git Bash）自己執行：

```bash
cd F:/indie-blog
git push origin main
```

第一次可能會跳出登入視窗，登入一次之後憑證會快取，之後就不需要了。

### Windows 檔名大小寫不敏感

`LOGO.png` 和 `logo.png` 在 Windows 是同一個檔案。**絕對不要**用
`rm LOGO.png` 去清來源檔——很可能把剛複製好的成品一起刪掉（官網 2026-09-04 發生過）。
清理檔案時，來源與目標務必放在不同目錄。

### 中文路徑與檔案刪除

`os.remove` / `rm` 對中文路徑有時會被安全機制攔截。
需要刪除時改用 PowerShell `Remove-Item -LiteralPath`，
或讓 `build.js` 自己處理（它已內建三層降級策略）。

---

## 9. 撰寫風格守則（延續既有決議）

- **Chiropractic 用英文**，不寫「美式整復」（那是官網用語；部落格要更個人）
- 不點名、不影射、不貶低同業
- 不寫個人政治立場
- 談到醫療紅旗時要「分級」：哪些可以調理、哪些該先就醫，兩欄對照，不可只給單一清單
- 紅旗必須加程度／伴隨徵象的限定詞（持續加重、範圍擴大、換姿勢無效…）
- 底線：不叫人放棄正規醫療；未經證實的說法不寫成確定有效
- 口氣要像「陳老叟」在跟讀者聊，不像機構在發公告

---

## 10. 變更紀錄（最近的提交）

```
7101bc8 build: 重新編譯 public/（20 篇）
1a3fe5f feat(build): 系列閱讀路徑、本文目錄、系列總覽與官網交叉連結
664e6e1 chore(archive): 腰及骨盆系列五篇封存，暫不發布
e57aa6e feat(posts): 新增〈膝蓋喀喀響，是不是軟骨磨光了？〉
e608ba3 feat(posts): 遠絡筆記系列七篇
e2a4eb0 feat(posts): add AMCT genesis article (source + built HTML)
```
