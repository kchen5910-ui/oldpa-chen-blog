#!/usr/bin/env node
/*
 * 留言後端 + 本地預覽伺服器（零依賴，僅用 Node 內建模組）
 * ------------------------------------------------------------
 * 用途：
 *   1) 提供留言 API（GET/POST /api/comments，按文章 slug 關聯）
 *   2) 同時靜態託管 public/，方便本地預覽「含留言的文章頁」
 *
 * 儲存：comments/data/comments.json（一個物件，按 slug 分組）
 * 防濫用：honeypot 蜜罐、IP 限速、長度上限、必填驗證、
 *         slug 白名單、超連結數限制、輸出一律 textContent（防 XSS）
 *
 * 環境變數：
 *   PORT                 監聽埠（預設 8787）
 *   COMMENTS_API_BASE    若前端跨域呼叫，設此值以便 CORS 放行（可留空）
 *
 * 啟動：  node comments/server.js
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, '..', 'public');
const DATA_DIR = path.join(ROOT, 'data');
const DATA_FILE = path.join(DATA_DIR, 'comments.json');
const PORT = process.env.PORT || 8787;
// 跨域時允許的前端來源（自託管請設為你的網站網域，例如 https://oldpa-chen.netlify.app）
const CORS_ORIGIN = process.env.COMMENTS_CORS_ORIGIN || '*';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

/* ---------- 儲存 ---------- */
function loadAll() {
  try {
    const obj = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    return obj && typeof obj === 'object' ? obj : {};
  } catch (e) {
    return {};
  }
}
function saveAll(obj) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(obj, null, 2));
}
let store = loadAll();

/* ---------- 防濫用：IP 限速 ---------- */
const RATE = { perMin: 5, perHour: 30, windowMs: 60 * 1000, hourMs: 60 * 60 * 1000 };
const hits = new Map(); // ip -> { min: [ts...], hour: [ts...] }
function rateLimited(ip) {
  const now = Date.now();
  const rec = hits.get(ip) || { min: [], hour: [] };
  rec.min = rec.min.filter((t) => now - t < RATE.windowMs);
  rec.hour = rec.hour.filter((t) => now - t < RATE.hourMs);
  if (rec.min.length >= RATE.perMin || rec.hour.length >= RATE.perHour) {
    hits.set(ip, rec);
    return true;
  }
  rec.min.push(now);
  rec.hour.push(now);
  hits.set(ip, rec);
  return false;
}

/* ---------- 驗證 ---------- */
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,79}$/i;
const NAME_MAX = 40;
const BODY_MAX = 2000;
const LINK_CAP = 2; // 單則留言最多 2 個網址，超過視為垃圾

function cleanText(s) {
  return String(s == null ? '' : s)
    .replace(/[\u0000-\u001f\u007f]/g, '') // 移除控制字元（保留 \n）
    .replace(/\r/g, '')
    .trim();
}
function linkCount(s) {
  return (s.match(/https?:\/\/|www\./gi) || []).length;
}

function validateComment(payload) {
  const slug = cleanText(payload.slug);
  let name = cleanText(payload.name);
  const body = cleanText(payload.body);
  const hp = cleanText(payload.hp); // 蜜罐：正常人絕不會填
  if (!SLUG_RE.test(slug)) return { ok: false, msg: '文章識別碼無效。' };
  if (hp) return { ok: false, msg: '驗證失敗。' }; // 蜜罐觸發
  if (!name) name = '訪客';
  if (name.length > NAME_MAX) return { ok: false, msg: '名稱過長（上限 ' + NAME_MAX + ' 字）。' };
  if (!body) return { ok: false, msg: '留言內容不可為空。' };
  if (body.length > BODY_MAX) return { ok: false, msg: '留言過長（上限 ' + BODY_MAX + ' 字）。' };
  if (linkCount(body) > LINK_CAP) return { ok: false, msg: '留言中的連結過多，疑似垃圾訊息。' };
  return { ok: true, value: { slug, name, body } };
}

function addComment(slug, name, body) {
  const comment = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    name,
    body,
    createdAt: new Date().toISOString(),
  };
  if (!store[slug]) store[slug] = [];
  store[slug].push(comment);
  store[slug].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  saveAll(store);
  // 只回傳安全欄位（不含內部 id 以外的雜項）
  return { name: comment.name, body: comment.body, createdAt: comment.createdAt };
}
function getComments(slug) {
  const list = store[slug] || [];
  return list.map((c) => ({ name: c.name, body: c.body, createdAt: c.createdAt }));
}

/* ---------- API ---------- */
function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': CORS_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function handleApi(req, res, url) {
  // CORS 預檢
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': CORS_ORIGIN,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  if (url.pathname === '/api/comments' && req.method === 'GET') {
    const slug = cleanText(url.searchParams.get('slug'));
    if (!SLUG_RE.test(slug)) return sendJson(res, 400, { error: '缺少有效的 slug。' });
    return sendJson(res, 200, { comments: getComments(slug) });
  }

  if (url.pathname === '/api/comments' && req.method === 'POST') {
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
    if (rateLimited(ip)) return sendJson(res, 429, { error: '留言太頻繁，請稍後再試。' });
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1e6) req.destroy(); // 防過大 payload
    });
    req.on('end', () => {
      let payload;
      try {
        payload = JSON.parse(raw || '{}');
      } catch (e) {
        return sendJson(res, 400, { error: '格式錯誤。' });
      }
      const v = validateComment(payload);
      if (!v.ok) return sendJson(res, 400, { error: v.msg });
      const created = addComment(v.value.slug, v.value.name, v.value.body);
      return sendJson(res, 201, { comment: created });
    });
    return;
  }

  return sendJson(res, 404, { error: 'Not found' });
}

/* ---------- 靜態託管 ---------- */
function serveStatic(req, res, url) {
  let urlPath = decodeURIComponent(url.pathname);
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.join(PUBLIC, urlPath);
  if (!filePath.startsWith(PUBLIC)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      const notFound = path.join(PUBLIC, '404.html');
      if (fs.existsSync(notFound)) {
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        return fs.createReadStream(notFound).pipe(res);
      }
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('404 Not Found');
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });
}

/* ---------- 主程式 ---------- */
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) return handleApi(req, res, url);
  return serveStatic(req, res, url);
});

server.listen(PORT, () => {
  console.log('▶ 留言後端 + 預覽伺服器： http://localhost:' + PORT + '/  (Ctrl+C 停止)');
  console.log('  留言 API： GET/POST ' + 'http://localhost:' + PORT + '/api/comments');
});
