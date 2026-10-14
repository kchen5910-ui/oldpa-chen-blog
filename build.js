#!/usr/bin/env node
/*
 * indie-blog 靜態部落格編譯器
 * ------------------------------------------------------------
 * 讀取 source/ 下的 Markdown 文章與頁面，編譯成 public/ 下的純靜態網站。
 * 不依賴任何平台、無後端、無資料庫、無審核。
 *
 * 用法：  node build.js
 * 新增文章：在 source/posts/ 放一個 .md（含 frontmatter），重新執行即可。
 */

const fs = require('fs');
const path = require('path');
const marked = require('marked');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'source');
const POSTS_DIR = path.join(SRC, 'posts');
const PAGES_DIR = path.join(SRC, 'pages');
const ASSETS_DIR = path.join(ROOT, 'assets');
const OUT = path.join(ROOT, 'public');

// 站台設定：來源 source/site.json（不存在則用預設值）
const siteDefaults = {
  title: '我的獨立部落格',
  description: '一個自由撰寫、隨心發布的地方。',
  author: '作者',
  baseUrl: '',
  socialImage: '',
  postsPerHome: 12,
  showDarkToggle: true,
  lang: 'zh-Hant',
};
let SITE = { ...siteDefaults };
const siteJsonPath = path.join(SRC, 'site.json');
if (fs.existsSync(siteJsonPath)) {
  try {
    SITE = { ...SITE, ...JSON.parse(fs.readFileSync(siteJsonPath, 'utf8')) };
  } catch (e) {
    console.warn('⚠️  site.json 解析失敗，改用預設值：', e.message);
  }
}

marked.setOptions({ gfm: true, breaks: false });

/* ---------- 工具函式 ---------- */

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function parseFrontmatter(raw) {
  const m = raw.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: raw };
  const data = {};
  let curListKey = null; // 目前正接收區塊列表（tags: 下方 - 項目）的鍵
  m[1].split(/\r?\n/).forEach((line) => {
    // 區塊列表項目：以 "- " 開頭，歸入上一個空值鍵
    const listItem = line.match(/^\s*-\s+(.*)$/);
    if (listItem) {
      if (curListKey) {
        const item = listItem[1].trim().replace(/^["']|["']$/g, '').trim();
        if (item) {
          if (!Array.isArray(data[curListKey])) data[curListKey] = [];
          data[curListKey].push(item);
        }
      }
      return;
    }
    const idx = line.indexOf(':');
    if (idx === -1) {
      curListKey = null;
      return;
    }
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if (val.startsWith('[') && val.endsWith(']')) {
      // 單行陣列格式：[a, b, c]
      val = val
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);
      data[key] = val;
      curListKey = null;
    } else {
      val = val.replace(/^["']|["']$/g, '');
      // 整數值（如文章的 order 欄位）轉為數字，便於同日排序
      if (/^-?\d+$/.test(val)) {
        data[key] = Number(val);
      } else {
        data[key] = val;
      }
      // 值為空（如 "tags:"）時，後續 "- " 行視為其列表項目
      curListKey = val === '' ? key : null;
    }
  });
  return { data, body: m[2] };
}

function toArray(v) {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

function stripHtml(html) {
  return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function plainExcerpt(md, max = 140) {
  const text = stripHtml(marked.parse(md)).replace(/[#>*_`~-]/g, '').trim();
  return text.length > max ? text.slice(0, max) + '…' : text;
}

function formatDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt)) return String(d);
  const y = dt.getFullYear();
  const mo = String(dt.getMonth() + 1).padStart(2, '0');
  const da = String(dt.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

// 把分類 / 標籤做成可點擊的 chip，連回 topics.html 的錨點
function chips(items, kind) {
  if (!items || !items.length) return '';
  return items
    .map(
      (t) =>
        `<a class="chip" href="topics.html#${kind}-${encodeURIComponent(t)}" data-${kind}="${escapeAttr(
          t
        )}">${escapeHtml(t)}</a>`
    )
    .join('');
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
function escapeAttr(s) {
  return escapeHtml(s).replace(/"/g, '&quot;');
}

// 把相對路徑組成絕對網址（用於 canonical / sitemap / RSS / OG）。
// baseUrl 未設定時退回相對路徑，便於本地預覽。
function absUrl(rel) {
  const base = (SITE.baseUrl || '').replace(/\/+$/, '');
  if (!base) return String(rel);
  return base + '/' + String(rel).replace(/^\/+/, '');
}

// OG 語系：zh-Hant → zh_TW，zh-CN → zh_CN，其餘照轉
function ogLocale() {
  const l = (SITE.lang || '').toLowerCase();
  if (l.includes('hans')) return 'zh_CN';
  if (l.includes('hant')) return 'zh_TW';
  if (l.startsWith('en')) return 'en_US';
  return l.replace('-', '_') || 'zh_TW';
}

/* ---------- 版面（共用 header / footer） ---------- */

function layout({ title, description, bodyClass = '', main, url = 'index.html', ogType = 'website' }) {
  const darkToggle = SITE.showDarkToggle
    ? `<button id="theme-toggle" class="theme-toggle" aria-label="切換深色模式" title="切換深色模式">◐</button>`
    : '';
  const canonical = absUrl(url);
  const ogImage = SITE.socialImage
    ? `<meta property="og:image" content="${escapeAttr(absUrl(SITE.socialImage))}">
<meta name="twitter:image" content="${escapeAttr(absUrl(SITE.socialImage))}">`
    : '';
  return `<!DOCTYPE html>
<html lang="${SITE.lang || 'zh-Hant'}" prefix="og: http://ogp.me/ns#">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<base href="/">
<script>window.COMMENTS_API_BASE=${JSON.stringify(SITE.commentsApiBase || '')};</script>
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeAttr(description || SITE.description)}">
<link rel="canonical" href="${escapeAttr(canonical)}">
<meta property="og:type" content="${escapeAttr(ogType)}">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeAttr(description || SITE.description)}">
<meta property="og:url" content="${escapeAttr(canonical)}">
<meta property="og:site_name" content="${escapeAttr(SITE.title)}">
<meta property="og:locale" content="${ogLocale()}">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeAttr(description || SITE.description)}">
<meta name="theme-color" content="#2f6f6b">
${ogImage}<link rel="icon" href="data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20100%20100'%3E%3Crect%20width='100'%20height='100'%20rx='22'%20fill='%232f6f6b'/%3E%3Ctext%20x='50'%20y='71'%20font-size='58'%20text-anchor='middle'%20fill='%23ffffff'%20font-family='sans-serif'%3E%E9%99%B3%3C/text%3E%3C/svg%3E">
<link rel="stylesheet" href="assets/css/style.css">
<link rel="alternate" type="application/rss+xml" title="${escapeAttr(SITE.title)}" href="feed.xml">
</head>
<body class="${bodyClass}">
<header class="site-header">
  <div class="wrap header-inner">
    <a class="brand" href="index.html">${escapeHtml(SITE.title)}</a>
    <nav class="nav">
      <a href="index.html">首頁</a>
      <a href="archive.html">文章</a>
      <a href="topics.html">分類 / 標籤</a>
      ${fs.existsSync(path.join(PAGES_DIR, 'about.md')) ? '<a href="about.html">關於</a>' : ''}
      <a href="feed.xml" title="RSS">RSS</a>
      ${darkToggle}
    </nav>
  </div>
</header>
<main class="wrap ${bodyClass}">
${main}
</main>
<footer class="site-footer">
  <div class="wrap">
    <p>© ${new Date().getFullYear()} ${escapeHtml(SITE.author)} · ${escapeHtml(SITE.title)}</p>
    <p class="muted">本部落格由 Markdown 靜態生成，自由撰寫、獨立部署。</p>
    ${SITE.officialSite ? `<p class="footer-crosslink"><span class="muted">想預約或看服務項目？</span> <a href="${escapeAttr(SITE.officialSite)}">${escapeHtml(SITE.officialSiteLabel || SITE.officialSite)}</a></p>` : ''}
  </div>
</footer>
<script src="assets/js/main.js"></script>
<script src="assets/js/comments.js"></script>
</body>
</html>`;
}

/* ---------- 讀取文章 ---------- */

function loadPosts() {
  if (!fs.existsSync(POSTS_DIR)) return [];
  const files = fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith('.md'));
  const posts = files.map((file) => {
    const raw = fs.readFileSync(path.join(POSTS_DIR, file), 'utf8');
    const { data, body } = parseFrontmatter(raw);
    const slug = (data.slug || file.replace(/\.md$/i, '')).trim();
    const date = data.date ? new Date(data.date) : new Date(0);
    return {
      slug,
      file,
      title: data.title || slug,
      date,
      dateStr: formatDate(data.date),
      category: data.category || '未分類',
      tags: toArray(data.tags),
      excerpt: data.excerpt || plainExcerpt(body),
      bodyHtml: marked.parse(body),
      draft: data.draft === true || data.draft === 'true',
      order: typeof data.order === 'number' ? data.order : 9999,
    };
  });
  // 排除草稿，依日期新→舊；同日則依 order 由大到小（系列結尾/最新篇排前面，倒著數）
  return posts
    .filter((p) => !p.draft)
    .sort((a, b) => b.date - a.date || b.order - a.order);
}

/* ---------- 各頁面 ---------- */

function renderHome(posts) {
  const recent = posts.slice(0, SITE.postsPerHome || 12);
  const items = recent
    .map(
      (p) => `
<article class="post-item" data-cat="${escapeAttr(p.category)}" ${p.tags
        .map((t) => `data-tag="${escapeAttr(t)}"`)
        .join(' ')}>
  <div class="post-meta">
    <time>${p.dateStr}</time>
    <a class="chip cat" href="topics.html#cat-${encodeURIComponent(p.category)}">${escapeHtml(
        p.category
      )}</a>
  </div>
  <h2 class="post-title"><a href="posts/${p.slug}.html">${escapeHtml(p.title)}</a></h2>
  <p class="post-excerpt">${escapeHtml(p.excerpt)}</p>
  <div class="post-tags">${chips(p.tags, 'tag')}</div>
</article>`
    )
    .join('');

  const main = `
<section class="hero">
  <h1>${escapeHtml(SITE.title)}</h1>
  <p class="lede">${escapeHtml(SITE.description)}</p>
</section>
${
  SITE.officialSite
    ? `<aside class="cross-banner">
  <span class="cross-banner-text">想預約或看服務項目？</span>
  <a class="cross-banner-link" href="${escapeAttr(SITE.officialSite)}">${escapeHtml(SITE.officialSiteLabel || SITE.officialSite)} »</a>
</aside>`
    : ''
}
<section class="post-list">
  ${items || '<p class="muted">還沒有文章，到 source/posts/ 放一篇 .md 再執行 node build.js 即可。</p>'}
</section>
${
  posts.length > recent.length
    ? `<p class="more"><a href="archive.html">查看全部 ${posts.length} 篇文章 »</a></p>`
    : ''
}
`;
  return layout({ title: SITE.title, description: SITE.description, bodyClass: 'home', url: 'index.html', ogType: 'website', main });
}

function renderPost(p, allPosts) {
  // 同分類內做上一篇／下一篇導覽，讓系列文章能依序閱讀，不被其他系列插隊
  const series = allPosts.filter((x) => x.category === p.category);
  // 系列內若多數文章有 order，優先用 order；其餘沿用日期順序
  const orderByCount = series.filter((x) => x.order !== 9999).length;
  if (orderByCount > series.length / 2) {
    series.sort((a, b) => a.order - b.order || a.date - b.date);
  } else {
    series.sort((a, b) => a.date - b.date);
  }
  const idx = series.findIndex((x) => x.slug === p.slug);
  const prev = series[idx - 1]; // 較早（系列上一篇）
  const next = series[idx + 1]; // 較後（系列下一篇）
  const isSeries = series.length >= 2;
  const nav = `
<nav class="post-nav">
  <span>${prev ? `<a href="posts/${prev.slug}.html">« ${escapeHtml(prev.title)}</a>` : ''}</span>
  <span>${next ? `<a href="posts/${next.slug}.html">${escapeHtml(next.title)} »</a>` : ''}</span>
</nav>`;

  // 系列閱讀路徑塊：顯示這篇在系列中的位置與全部系列文章連結
  const seriesPath = isSeries
    ? `
<aside class="series-path" aria-label="系列閱讀路徑">
  <div class="series-path-head">
    <span class="series-path-label">系列閱讀路徑</span>
    <span class="series-path-title">${escapeHtml(p.category)}</span>
    <span class="series-path-progress">第 ${idx + 1} / ${series.length} 篇</span>
  </div>
  <ol class="series-path-list">
    ${series
      .map(
        (x, i) =>
          `<li class="${x.slug === p.slug ? 'current' : ''}"><a href="posts/${x.slug}.html"><span class="series-idx">${
            i + 1
          }</span><span>${escapeHtml(x.title)}</span></a></li>`
      )
      .join('')}
  </ol>
</aside>`
    : '';

  // 簡易 TOC：先 clone bodyHtml 並為每個 h2 加 id（toc-0、toc-1…），
  // 若 ≥3 個就生成側邊目錄
  let bodyWithIds = p.bodyHtml;
  let counter = 0;
  bodyWithIds = bodyWithIds.replace(
    /<h2([^>]*)>([\s\S]*?)<\/h2>/g,
    (m, attrs, inner) => {
      const id = `toc-${counter++}`;
      return `<h2${attrs} id="${id}">${inner}</h2>`;
    }
  );
  const h2s = [...bodyWithIds.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)];
  const toc =
    h2s.length >= 3
      ? `<aside class="toc" aria-label="本文目錄">
  <p class="toc-title">本文目錄</p>
  <ol class="toc-list">
    ${h2s
      .map((m, i) => {
        const txt = m[1].replace(/<[^>]+>/g, '').trim();
        return `<li><a href="#toc-${i}">${escapeHtml(txt)}</a></li>`;
      })
      .join('')}
  </ol>
</aside>`
      : '';

  const main = `
<article class="post">
  <header class="post-header">
    <div class="post-meta">
      <time>${p.dateStr}</time>
      <a class="chip cat" href="topics.html#cat-${encodeURIComponent(p.category)}">${escapeHtml(
    p.category
  )}</a>
    </div>
    <h1 class="post-heading">${escapeHtml(p.title)}</h1>
    <div class="post-tags">${chips(p.tags, 'tag')}</div>
  </header>
  ${seriesPath}
  <div class="post-body">
    ${toc}
    <div class="post-content">
${bodyWithIds}
    </div>
  </div>
  ${nav}
  <p class="back"><a href="index.html">« 回到首頁</a></p>
  <section class="comments" id="comments" data-slug="${escapeAttr(p.slug)}" aria-label="留言區">
    <h2 class="comments-title">留言</h2>
    <div class="comments-list" id="comments-list"><p class="comments-loading muted">讀取留言中…</p></div>
    <form class="comment-form" id="comment-form" method="post" novalidate>
      <div class="form-row">
        <label for="comment-name">名稱</label>
        <input type="text" id="comment-name" name="name" maxlength="40" placeholder="訪客" autocomplete="nickname">
      </div>
      <div class="form-row">
        <label for="comment-body">留言內容 <span class="req">*</span></label>
        <textarea id="comment-body" name="body" rows="4" maxlength="2000" placeholder="想說點什麼…（不可為空）" required></textarea>
        <p class="form-error" id="comment-error" role="alert"></p>
      </div>
      <div class="hp-field" aria-hidden="true">
        <label>請勿填寫此欄<input type="text" name="hp" id="comment-hp" tabindex="-1" autocomplete="off"></label>
      </div>
      <div class="form-actions">
        <span class="chars-hint" id="comment-count">0 / 2000</span>
        <button type="submit" class="btn-primary">發表留言</button>
      </div>
    </form>
  </section>
</article>`;
  return layout({
    title: `${p.title} — ${SITE.title}`,
    description: p.excerpt,
    bodyClass: 'post-page',
    url: `posts/${p.slug}.html`,
    ogType: 'article',
    main,
  });
}

function renderArchive(posts) {
  // 依年份分組
  const byYear = {};
  posts.forEach((p) => {
    const y = p.date.getFullYear();
    (byYear[y] = byYear[y] || []).push(p);
  });
  const years = Object.keys(byYear).sort((a, b) => b - a);
  const blocks = years
    .map((y) => {
      const items = byYear[y]
        .map(
          (p) => `<li data-cat="${escapeAttr(p.category)}"><time>${p.dateStr}</time>
            <a href="posts/${p.slug}.html">${escapeHtml(p.title)}</a>
            <span class="chip cat">${escapeHtml(p.category)}</span></li>`
        )
        .join('');
      return `<section class="year-block"><h2>${y}</h2><ul class="archive-list">${items}</ul></section>`;
    })
    .join('');

  // 系列總覽：同 series 文章群組（>1 篇才算系列）
  const seriesMap = new Map();
  posts.forEach((p) => {
    const arr = seriesMap.get(p.category) || [];
    arr.push(p);
    seriesMap.set(p.category, arr);
  });
  const seriesCards = [...seriesMap.entries()]
    .filter(([, arr]) => arr.length >= 2)
    .map(([cat, arr]) => {
      const sorted = arr.slice().sort((a, b) => a.order - b.order || a.date - b.date);
      const items = sorted
        .map(
          (p) =>
            `<li><time>${p.dateStr}</time><a href="posts/${p.slug}.html">${escapeHtml(p.title)}</a></li>`
        )
        .join('');
      return `<section class="series-card">
  <h3>${escapeHtml(cat)}<span class="muted">（${arr.length} 篇）</span></h3>
  <ol class="archive-list series-list">${items}</ol>
</section>`;
    })
    .join('');

  const main = `
<h1 class="page-title">文章列表</h1>
<p class="muted">共 ${posts.length} 篇，依時間新→舊排列。</p>
${
  seriesCards
    ? `<section class="series-overview">
  <h2 class="series-overview-h">系列總覽</h2>
  <p class="muted">以下系列已展開全文路徑，建議照順序閱讀。</p>
  ${seriesCards}
</section>`
    : ''
}
${blocks}`;
  return layout({ title: `文章列表 — ${SITE.title}`, bodyClass: 'archive', url: 'archive.html', ogType: 'website', main });
}

function renderTopics(posts) {
  const catSet = new Map();
  const tagSet = new Map();
  posts.forEach((p) => {
    catSet.set(p.category, (catSet.get(p.category) || 0) + 1);
    p.tags.forEach((t) => tagSet.set(t, (tagSet.get(t) || 0) + 1));
  });
  const catChips = [...catSet.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(
      ([c, n]) =>
        `<button class="chip filter" data-filter="cat" data-value="${escapeAttr(
          c
        )}" id="cat-${escapeAttr(c)}">${escapeHtml(c)} <span class="count">${n}</span></button>`
    )
    .join('');
  const tagChips = [...tagSet.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(
      ([t, n]) =>
        `<button class="chip filter" data-filter="tag" data-value="${escapeAttr(
          t
        )}" id="tag-${escapeAttr(t)}">${escapeHtml(t)} <span class="count">${n}</span></button>`
    )
    .join('');
  const items = posts
    .map(
      (p) => `
<article class="post-item" data-cat="${escapeAttr(p.category)}" ${p.tags
        .map((t) => `data-tag="${escapeAttr(t)}"`)
        .join(' ')}>
  <div class="post-meta"><time>${p.dateStr}</time>
    <a class="chip cat" href="topics.html#cat-${encodeURIComponent(p.category)}">${escapeHtml(
        p.category
      )}</a></div>
  <h2 class="post-title"><a href="posts/${p.slug}.html">${escapeHtml(p.title)}</a></h2>
  <div class="post-tags">${chips(p.tags, 'tag')}</div>
</article>`
    )
    .join('');
  const main = `
<h1 class="page-title">分類 / 標籤</h1>
<p class="muted">點擊下方分類或標籤即可篩選；再次點擊取消。文章卡片上的分類／標籤也會連回這裡。</p>
<div class="filter-group">
  <h3>分類</h3><div class="chips" id="cat-group">${catChips}</div>
</div>
<div class="filter-group">
  <h3>標籤</h3><div class="chips" id="tag-group">${tagChips}</div>
</div>
<div class="filter-status" id="filter-status"></div>
<section class="post-list" id="topic-list">
  ${items}
</section>`;
  return layout({ title: `分類 / 標籤 — ${SITE.title}`, bodyClass: 'topics', url: 'topics.html', ogType: 'website', main });
}

function renderPage(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const { data, body } = parseFrontmatter(raw);
  const title = data.title || '關於';
  const outName = path.basename(file).replace(/\.md$/i, '.html');
  const main = `<article class="post page"><h1 class="page-title">${escapeHtml(
    title
  )}</h1><div class="post-content">${marked.parse(body)}</div></article>`;
  return layout({ title: `${title} — ${SITE.title}`, bodyClass: 'page', url: outName, ogType: 'website', main });
}

function renderRSS(posts) {
  const items = posts
    .map((p) => {
      const link = absUrl('posts/' + p.slug + '.html');
      return `    <item>
      <title>${escapeHtml(p.title)}</title>
      <link>${escapeHtml(link)}</link>
      <guid>${escapeHtml(link)}</guid>
      <pubDate>${new Date(p.date).toUTCString()}</pubDate>
      <category>${escapeHtml(p.category)}</category>
      <description>${escapeHtml(p.excerpt)}</description>
    </item>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeHtml(SITE.title)}</title>
    <link>${escapeHtml(absUrl('index.html'))}</link>
    <description>${escapeHtml(SITE.description)}</description>
    <language>${SITE.lang || 'zh-Hant'}</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>`;
}

/* ---------- sitemap / robots / 404 ---------- */

function renderSitemap(posts) {
  const urls = ['', 'archive.html', 'topics.html'];
  if (fs.existsSync(path.join(PAGES_DIR, 'about.md'))) urls.push('about.html');
  posts.forEach((p) => urls.push('posts/' + p.slug + '.html'));
  const items = urls
    .map((u) => {
      const loc = absUrl(u || 'index.html');
      return `  <url>\n    <loc>${escapeHtml(loc)}</loc>\n  </url>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${items}
</urlset>`;
}

function renderRobots() {
  const sitemap = absUrl('sitemap.xml');
  return `User-agent: *
Allow: /

Sitemap: ${sitemap}
`;
}

function render404() {
  const main = `
<section class="hero">
  <h1>404</h1>
  <p class="lede">找不到這個頁面。可能文章已經移動，或是網址打錯了。</p>
  <p class="more"><a href="index.html">« 回到首頁</a></p>
</section>`;
  return layout({
    title: `找不到頁面 — ${SITE.title}`,
    description: '404 頁面不存在',
    bodyClass: 'home',
    url: '404.html',
    ogType: 'website',
    main,
  });
}

/* ---------- 輸出目錄清理 ---------- */

/**
 * 移除 public/ 裡「已不存在的文章/頁面」殘留的 HTML。
 *
 * 為什麼需要這段：
 *   建置採「覆寫」而非「整包重建」。當你把某篇 .md 移進 source/_archive/
 *   （下架）或改了 slug，舊的 public/posts/xxx.html 不會被自動清掉。
 *   一旦用「拖放上傳」部署，這些已下架的文章會跟著上線，等於沒下架成功。
 *
 * 為什麼不整包 fs.rmSync(public, {recursive:true}) 再重建：
 *   本機的 safe-delete 防護會攔截遞迴刪除整個目錄並拋錯（實測），
 *   而且每次全砍會讓建置從 6 秒暴增到 50 秒。
 *   所以改成「只砍殘檔」：沒有殘檔時一個檔案都不動，建置速度不受影響。
 *
 * 刪除策略（由強到弱，確保一定下架）：
 *   1. fs.unlinkSync 直接刪
 *   2. 失敗 -> renameSync 搬到 .build-trash/<時間戳>/（搬出 public/ 即生效）
 *   3. 再失敗 -> 截斷為 0 位元組並警告，請使用者手動處理
 *
 * 安全邊界：只對 keep 集合中「沒有列出」的檔案動手，且僅限 public/ 之內。
 *
 * @param {Set<string>} keep  相對於 OUT、使用正斜線的路徑集合，例如 {'posts/origin.html','about.html'}
 */
function pruneStaleOutput(keep) {
  if (!fs.existsSync(OUT)) return;

  const trashRoot = path.join(ROOT, '.build-trash');
  let removed = 0;
  let moved = 0;
  const failed = [];

  // 收集 public/ 底下所有檔案（相對於 OUT、正斜線）
  const existing = [];
  const walk = (relDir) => {
    const absDir = relDir ? path.join(OUT, relDir) : OUT;
    for (const ent of fs.readdirSync(absDir, { withFileTypes: true })) {
      const rel = relDir ? `${relDir}/${ent.name}` : ent.name;
      if (ent.isDirectory()) {
        walk(rel);
      } else if (ent.isFile()) {
        existing.push(rel);
      }
    }
  };
  walk('');

  const stale = existing.filter((rel) => !keep.has(rel));
  if (stale.length === 0) return;

  for (const rel of stale) {
    const full = path.join(OUT, rel);
    try {
      fs.unlinkSync(full);
      removed += 1;
      continue;
    } catch (e) {
      /* 落到下一個策略 */
    }
    try {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const destDir = path.join(trashRoot, stamp);
      fs.mkdirSync(destDir, { recursive: true });
      fs.renameSync(full, path.join(destDir, rel.replace(/[/\\]/g, '__')));
      moved += 1;
    } catch (e) {
      try {
        fs.writeFileSync(full, '');
        failed.push(`${rel}（已清空為 0 位元組，請手動刪除）`);
      } catch (e2) {
        failed.push(`${rel}（無法處理：${e2.message}）`);
      }
    }
  }

  console.log(`  清除殘檔 ${stale.length} 個（刪除 ${removed}、移至 .build-trash ${moved}）：`);
  stale.forEach((rel) => console.log(`    - ${rel}`));
  if (failed.length) {
    console.warn('⚠️  以下項目無法自動清除，請手動處理：');
    failed.forEach((f) => console.warn(`    - ${f}`));
  }
}

/* ---------- 主流程 ---------- */

function main() {
  const t0 = Date.now();
  console.log('▶ 開始編譯 indie-blog ...');

  const posts = loadPosts();
  console.log(`  讀取文章：${posts.length} 篇`);

  const aboutPath = path.join(PAGES_DIR, 'about.md');
  const hasAbout = fs.existsSync(aboutPath);

  // 本次建置會產生（或保留）的全部檔案，用來判斷誰是殘檔
  const keep = new Set([
    'index.html',
    'archive.html',
    'topics.html',
    'feed.xml',
    'sitemap.xml',
    'robots.txt',
    '404.html',
    ...posts.map((p) => `posts/${p.slug}.html`),
  ]);
  if (hasAbout) keep.add('about.html');
  collectAssetPaths(ASSETS_DIR, 'assets', keep);

  // 先把已下架／已改 slug 的舊檔清掉，避免拖放部署時被一起帶上線
  pruneStaleOutput(keep);

  ensureDir(OUT);
  ensureDir(path.join(OUT, 'posts'));
  ensureDir(path.join(OUT, 'assets', 'css'));
  ensureDir(path.join(OUT, 'assets', 'js'));

  // 首頁
  fs.writeFileSync(path.join(OUT, 'index.html'), renderHome(posts));
  // 文章列表
  fs.writeFileSync(path.join(OUT, 'archive.html'), renderArchive(posts));
  // 分類 / 標籤
  fs.writeFileSync(path.join(OUT, 'topics.html'), renderTopics(posts));
  // 單篇文章
  posts.forEach((p) => {
    fs.writeFileSync(path.join(OUT, 'posts', `${p.slug}.html`), renderPost(p, posts));
  });
  // 關於頁（若有）
  if (hasAbout) {
    fs.writeFileSync(path.join(OUT, 'about.html'), renderPage(aboutPath));
  }
  // RSS
  fs.writeFileSync(path.join(OUT, 'feed.xml'), renderRSS(posts));
  // sitemap / robots / 404
  fs.writeFileSync(path.join(OUT, 'sitemap.xml'), renderSitemap(posts));
  fs.writeFileSync(path.join(OUT, 'robots.txt'), renderRobots());
  fs.writeFileSync(path.join(OUT, '404.html'), render404());

  // 複製 assets（css / js），已存在的由來源覆盖
  copyAssets(ASSETS_DIR, path.join(OUT, 'assets'));

  console.log(`✔ 完成，耗時 ${Date.now() - t0}ms。輸出位於 public/`);
}

/** 收集 assets/ 來源目錄下所有檔案，換算成相對於 OUT 的路徑後加進 keep 集合 */
function collectAssetPaths(srcDir, relDir, out) {
  if (!fs.existsSync(srcDir)) return;
  for (const ent of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const rel = `${relDir}/${ent.name}`;
    if (ent.isDirectory()) collectAssetPaths(path.join(srcDir, ent.name), rel, out);
    else if (ent.isFile()) out.add(rel);
  }
}

function copyAssets(src, dest) {
  if (!fs.existsSync(src)) return;
  ensureDir(dest);
  for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, ent.name);
    const d = path.join(dest, ent.name);
    if (ent.isDirectory()) copyAssets(s, d);
    else fs.copyFileSync(s, d);
  }
}

main();
