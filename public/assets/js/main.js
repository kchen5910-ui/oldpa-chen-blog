/* indie-blog 前端互動：深色模式 + 分類/標籤篩選 */
(function () {
  'use strict';

  /* ---------- 深色模式 ---------- */
  var root = document.documentElement;
  var KEY = 'indie-blog-theme';
  try {
    var saved = localStorage.getItem(KEY);
    if (saved) {
      root.setAttribute('data-theme', saved);
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      root.setAttribute('data-theme', 'dark');
    }
  } catch (e) {}

  var toggle = document.getElementById('theme-toggle');
  if (toggle) {
    toggle.addEventListener('click', function () {
      var cur = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', cur);
      try { localStorage.setItem(KEY, cur); } catch (e) {}
    });
  }

  /* ---------- 分類 / 標籤篩選（topics.html） ---------- */
  var filters = { cat: null, tag: null };
  var statusEl = document.getElementById('filter-status');
  var listEl = document.getElementById('topic-list');

  function applyFilter() {
    if (!listEl) return;
    var items = listEl.querySelectorAll('.post-item');
    var shown = 0;
    items.forEach(function (el) {
      var okCat = !filters.cat || el.getAttribute('data-cat') === filters.cat;
      var okTag = !filters.tag || el.getAttribute('data-tag') === filters.tag;
      var visible = okCat && okTag;
      el.style.display = visible ? '' : 'none';
      if (visible) shown++;
    });
    if (statusEl) {
      var parts = [];
      if (filters.cat) parts.push('分類：' + filters.cat);
      if (filters.tag) parts.push('標籤：' + filters.tag);
      statusEl.textContent = parts.length
        ? '篩選中（' + parts.join(' · ') + '）— 顯示 ' + shown + ' 篇'
        : '';
    }
  }

  function bindChip(btn) {
    btn.addEventListener('click', function () {
      var kind = btn.getAttribute('data-filter'); // cat / tag
      var val = btn.getAttribute('data-value');
      if (filters[kind] === val) {
        filters[kind] = null;
        btn.classList.remove('active');
      } else {
        filters[kind] = val;
        // 同類別只允許單選
        document.querySelectorAll('.chip.filter[data-filter="' + kind + '"]').forEach(function (b) {
          b.classList.remove('active');
        });
        btn.classList.add('active');
      }
      applyFilter();
    });
  }

  document.querySelectorAll('.chip.filter').forEach(bindChip);

  // 從網址錨點預設篩選（例如 topics.html#cat-生活）
  if (location.hash) {
    var m = location.hash.match(/^#(cat|tag)-(.+)$/);
    if (m) {
      var kind = m[1];
      var val = decodeURIComponent(m[2]);
      var btn = document.getElementById(kind + '-' + val) ||
        document.querySelector('.chip.filter[data-filter="' + kind + '"][data-value="' + CSS.escape(val) + '"]');
      if (btn) {
        filters[kind] = val;
        btn.classList.add('active');
        applyFilter();
      }
    }
  }
})();
