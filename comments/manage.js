#!/usr/bin/env node
/*
 * 留言備份 / 匯出 / 還原 工具（零依零依賴，僅用 Node 內建模組）
 * ------------------------------------------------------------------
 * 資料來源： comments/data/comments.json（與 server.js 同格式）
 * 用途：
 *   1) backup   快照備份（時間戳檔名，便於定期備份 / 搬遷前保全）
 *   2) list     列出所有備份
 *   3) stats    各文章留言數統計
 *   4) export   匯出為 CSV（Excel 友善，含 BOM）或 Markdown（按文章分組好讀）
 *   5) restore  從備份還原（會先自動備份現狀，需 --yes 確認）
 *
 * 用法：
 *   node manage.js backup
 *   node manage.js list
 *   node manage.js stats
 *   node manage.js export [--format csv|md] [--out <檔名>]
 *   node manage.js restore --from <備份檔> [--yes]
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, 'data', 'comments.json');
const BACKUP_DIR = path.join(ROOT, 'backups');

/* ---------- 基礎 ---------- */
function loadAll() {
  try {
    const obj = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    return obj && typeof obj === 'object' ? obj : {};
  } catch (e) {
    return {};
  }
}
function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}
function stamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return (
    d.getFullYear() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    '-' +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}
function count(store) {
  return Object.values(store).reduce((s, a) => s + (Array.isArray(a) ? a.length : 0), 0);
}

/* ---------- backup ---------- */
function cmdBackup() {
  const store = loadAll();
  ensureDir(BACKUP_DIR);
  const file = path.join(BACKUP_DIR, 'comments-' + stamp() + '.json');
  fs.writeFileSync(file, JSON.stringify(store, null, 2));
  console.log('✓ 已備份 ' + count(store) + ' 則留言 → ' + path.relative(ROOT, file));
}

/* ---------- list ---------- */
function cmdList() {
  ensureDir(BACKUP_DIR);
  const files = fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .reverse();
  if (!files.length) return console.log('（尚無備份）');
  console.log('備份清單（新→舊）：');
  files.forEach((f) => {
    const fp = path.join(BACKUP_DIR, f);
    let n = 0;
    try {
      n = count(JSON.parse(fs.readFileSync(fp, 'utf8')));
    } catch (e) {
      /* ignore */
    }
    console.log('  ' + f + '   (' + n + ' 則)');
  });
}

/* ---------- stats ---------- */
function cmdStats() {
  const store = loadAll();
  const slugs = Object.keys(store);
  if (!slugs.length) return console.log('（尚無留言）');
  console.log('共 ' + count(store) + ' 則留言，分布在 ' + slugs.length + ' 篇文章：');
  slugs.sort().forEach((s) => console.log('  ' + s + ': ' + store[s].length));
}

/* ---------- export ---------- */
function csvEscape(v) {
  const s = String(v == null ? '' : v);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}
function cmdExport(opts) {
  const store = loadAll();
  const format = (opts.format || 'csv').toLowerCase();
  ensureDir(BACKUP_DIR);
  const out =
    opts.out ||
    path.join(BACKUP_DIR, 'comments-export-' + stamp() + (format === 'md' ? '.md' : '.csv'));

  if (format === 'md') {
    let md = '# 留言匯出（' + new Date().toISOString() + '）\n\n';
    const slugs = Object.keys(store).sort();
    if (!slugs.length) md += '（尚無留言）\n';
    slugs.forEach((s) => {
      md += '## ' + s + '（' + store[s].length + ' 則）\n\n';
      store[s].forEach((c) => {
        md += '- **' + (c.name || '訪客') + '** · ' + c.createdAt + '\n';
        md += '  ' + String(c.body || '').replace(/\n/g, '\n  ') + '\n\n';
      });
    });
    fs.writeFileSync(out, md);
  } else {
    const rows = [['slug', 'name', 'body', 'createdAt', 'id']];
    Object.keys(store)
      .sort()
      .forEach((s) => {
        (store[s] || []).forEach((c) => rows.push([s, c.name, c.body, c.createdAt, c.id]));
      });
    const csv = rows.map((r) => r.map(csvEscape).join(',')).join('\r\n');
    fs.writeFileSync(out, '﻿' + csv); // 前面加 BOM，讓 Excel 正確顯示中文
  }
  console.log('✓ 已匯出 ' + count(store) + ' 則留言 → ' + path.relative(ROOT, out));
}

/* ---------- restore ---------- */
function cmdRestore(opts) {
  if (!opts.from) return console.error('✗ 請指定 --from <備份檔>');
  if (!fs.existsSync(opts.from)) return console.error('✗ 找不到檔案：' + opts.from);
  let incoming;
  try {
    incoming = JSON.parse(fs.readFileSync(opts.from, 'utf8'));
  } catch (e) {
    return console.error('✗ 備份檔無法解析為 JSON');
  }
  if (!opts.yes) {
    return console.error('⚠️ 此操作會以備份內容「覆寫」目前的留言資料。請加 --yes 確認執行。');
  }
  // 還原前先自動備份現狀，避免誤蓋後無法回復
  const store = loadAll();
  if (count(store) > 0) {
    ensureDir(BACKUP_DIR);
    const pre = path.join(BACKUP_DIR, 'comments-before-restore-' + stamp() + '.json');
    fs.writeFileSync(pre, JSON.stringify(store, null, 2));
    console.log('  （還原前已自動備份現狀 → ' + path.basename(pre) + '）');
  }
  ensureDir(path.dirname(DATA_FILE));
  fs.writeFileSync(DATA_FILE, JSON.stringify(incoming, null, 2));
  console.log('✓ 已從 ' + path.basename(opts.from) + ' 還原 ' + count(incoming) + ' 則留言');
}

/* ---------- 指令解析 ---------- */
function parseArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next != null && !next.startsWith('--')) {
      opts[key] = argv[++i];
    } else {
      opts[key] = true;
    }
  }
  return opts;
}

const [, , cmd, ...rest] = process.argv;
const opts = parseArgs(rest);

switch (cmd) {
  case 'backup':
    cmdBackup();
    break;
  case 'list':
    cmdList();
    break;
  case 'stats':
    cmdStats();
    break;
  case 'export':
    cmdExport(opts);
    break;
  case 'restore':
    cmdRestore(opts);
    break;
  default:
    console.log(
      '留言備份 / 匯出工具\n' +
        '用法：\n' +
        '  node manage.js backup                快照備份 data/comments.json → backups/\n' +
        '  node manage.js list                  列出所有備份\n' +
        '  node manage.js stats                 各文章留言數統計\n' +
        '  node manage.js export [--format csv|md] [--out <檔>]\n' +
        '  node manage.js restore --from <備份> [--yes]\n'
    );
}
