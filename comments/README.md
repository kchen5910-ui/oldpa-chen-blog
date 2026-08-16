# 留言後端（comments）

部落格 `F:\indie-blog` 的訪客留言 API。零依賴 Node（僅用內建模組），
把留言以 JSON 檔持久化，並提供基礎防濫用。

## 本機預覽（含留言）
在 `F:\indie-blog` 根目錄執行：
```
node comments/server.js
```
預設監聽 `http://localhost:8787`，同時靜態託管 `public/`，
所以開 `http://localhost:8787/posts/<slug>.html` 即可看到可互動的留言區。

## 自託管上線（讓 live 站啟用留言）
靜態站（Netlify 拖放）跑不了後端，因此把本資料夾部署到一處 Node 主機
（Render / Railway / Fly.io / 自有 VPS 等），再由前端跨域呼叫。

1. 把 `comments/` 這個資料夾部署為 Node 服務（start command：`node server.js`）。
   package.json 已備好 `engines.node >= 18` 與 `npm start`。
2. 在平台上設定環境變數：
   - `PORT`：平台通常自動給，不用設。
   - `COMMENTS_CORS_ORIGIN`：設為你的網站網域，例如
     `https://oldpa-chen.netlify.app`（限定來源，避免被任意網站呼叫）。
3. 部署後取得後端網址，例如 `https://oldpa-comments.onrender.com`。
4. 編輯 `source/site.json`，把 `commentsApiBase` 設為該網址：
   ```json
   "commentsApiBase": "https://oldpa-comments.onrender.com"
   ```
5. 回到 `F:\indie-blog` 執行 `node build.js` 重建，再把 `public/` 拖到
   Netlify 的 Deploys 頁更新。完成後 live 站的留言區即啟用。

## 環境變數
| 變數 | 預設 | 說明 |
|---|---|---|
| `PORT` | `8787` | 監聽埠 |
| `COMMENTS_CORS_ORIGIN` | `*` | 允許跨域的前端來源；自託管請設為網站網域 |

## API
- `GET  /api/comments?slug=<slug>` → `{ "comments": [ {name, body, createdAt}, ... ] }`（依時間升冪）
- `POST /api/comments`（JSON：`{ slug, name, body, hp }`）
  - 成功：`201 { "comment": {...} }`
  - 失敗：`400` 驗證錯誤 / `429` 留言過頻

## 防濫用
honeypot 蜜罐欄位、IP 限速（5 次/分、30 次/時）、名稱 ≤40 字、
內容 ≤2000 字且必填、slug 白名單、單則留言網址連結 ≤2。
所有留言輸出一律以 `textContent` 渲染，防止 XSS。

## 資料存放
留言存於 `comments/data/comments.json`（已加入 `.gitignore`，不納入版本控制）。
注意：多數 PaaS 的磁碟在 redeploy 時可能被清空，正式長期營運前可考慮
改用 SQLite 或外部資料庫以提升耐久性。

## 備份 / 匯出 / 還原（manage.js）
備份與遷移用的小工具（零依賴，`node manage.js <命令>`）：

| 命令 | 說明 |
|---|---|
| `node manage.js backup` | 快照備份 `data/comments.json` → `backups/comments-<時間戳>.json` |
| `node manage.js list` | 列出所有備份及其留言數 |
| `node manage.js stats` | 各文章留言數統計 |
| `node manage.js export --format csv` | 匯出 CSV（含 BOM，Excel 直接開）；可加 `--out <檔>` 指定路徑 |
| `node manage.js export --format md` | 匯出 Markdown（按文章分組，好讀） |
| `node manage.js restore --from <備份> --yes` | 從備份還原（會先自動備份現狀，需 `--yes` 確認） |

典型用法：
- **定期備份**：排程執行 `node manage.js backup`（例如每天一次），對抗 PaaS 重啟清盤。
- **搬遷**：先在舊主機 `backup` 並下載該備份檔，再到新主機 `restore --from <備份> --yes`。
- **留底閱讀 / 備查**：`export --format md` 產生人類可讀的純文字檔。

備份檔與資料檔同樣含訪客輸入，已列入 `.gitignore`，請勿提交進版本庫。
