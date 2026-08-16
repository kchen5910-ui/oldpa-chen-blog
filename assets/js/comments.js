/* indie-blog 留言前端：抓取 / 渲染 / 表單驗證 / 提交
 * 依赖后端 /api/comments；若后端不可用（例如纯静态部署），
 * 会优雅降级显示「留言功能尚未启用」，不影响页面其余部分。
 */
(function () {
  'use strict';

  var root = document.getElementById('comments');
  if (!root) return; // 非文章页不执行

  var slug = root.getAttribute('data-slug') || '';
  var API = (window.COMMENTS_API_BASE || '') + '/api/comments';

  var listEl = document.getElementById('comments-list');
  var formEl = document.getElementById('comment-form');
  var nameEl = document.getElementById('comment-name');
  var bodyEl = document.getElementById('comment-body');
  var errorEl = document.getElementById('comment-error');
  var countEl = document.getElementById('comment-count');
  var titleEl = root.querySelector('.comments-title');

  /* ---------- 工具 ---------- */
  function fmtTime(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return '';
    var p = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
      ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function escAttr(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------- 渲染留言列表 ---------- */
  function renderList(comments) {
    listEl.textContent = '';
    if (!comments.length) {
      var empty = document.createElement('p');
      empty.className = 'muted';
      empty.textContent = '還沒有留言，來當第一個吧。';
      listEl.appendChild(empty);
    } else {
      comments.forEach(function (c) {
        var card = document.createElement('div');
        card.className = 'comment-card';

        var meta = document.createElement('div');
        meta.className = 'comment-meta';
        var name = document.createElement('span');
        name.className = 'comment-name';
        name.textContent = c.name || '訪客';
        var time = document.createElement('span');
        time.className = 'comment-time';
        time.textContent = fmtTime(c.createdAt);
        meta.appendChild(name);
        meta.appendChild(time);

        var bodyP = document.createElement('p');
        bodyP.className = 'comment-body';
        bodyP.textContent = c.body; // textContent 防止 XSS

        card.appendChild(meta);
        card.appendChild(bodyP);
        listEl.appendChild(card);
      });
    }
    if (titleEl) {
      titleEl.textContent = '留言 (' + comments.length + ')';
    }
  }

  function showDisabled() {
    listEl.textContent = '';
    var note = document.createElement('p');
    note.className = 'muted';
    note.textContent = '留言功能目前尚未啟用。';
    listEl.appendChild(note);
    if (formEl) formEl.style.display = 'none';
  }

  /* ---------- 載入 ---------- */
  function load() {
    if (!slug) { showDisabled(); return; }
    fetch(API + '?slug=' + encodeURIComponent(slug), { credentials: 'same-origin' })
      .then(function (r) {
        if (!r.ok) throw new Error('bad');
        return r.json();
      })
      .then(function (data) {
        renderList((data && data.comments) || []);
      })
      .catch(function () {
        showDisabled();
      });
  }

  /* ---------- 表單：字數計數 ---------- */
  if (bodyEl && countEl) {
    bodyEl.addEventListener('input', function () {
      countEl.textContent = bodyEl.value.length + ' / 2000';
    });
  }

  /* ---------- 表單：送出 ---------- */
  if (formEl) {
    formEl.addEventListener('submit', function (e) {
      e.preventDefault();
      if (errorEl) errorEl.textContent = '';
      var name = (nameEl.value || '').trim();
      var body = (bodyEl.value || '').trim();
      var hp = (document.getElementById('comment-hp') || {}).value || '';
      if (!body) {
        if (errorEl) errorEl.textContent = '留言內容不可為空。';
        bodyEl.focus();
        return;
      }
      if (body.length > 2000) {
        if (errorEl) errorEl.textContent = '留言過長（上限 2000 字）。';
        return;
      }
      var btn = formEl.querySelector('button[type="submit"]');
      if (btn) { btn.disabled = true; btn.textContent = '送出中…'; }

      fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ slug: slug, name: name, body: body, hp: hp }),
      })
        .then(function (r) {
          return r.json().then(function (d) { return { ok: r.ok, d: d }; });
        })
        .then(function (res) {
          if (!res.ok || !res.d.comment) {
            throw new Error((res.d && res.d.error) || '送出失敗');
          }
          // 本地預覽渲染：重新抓取以保證排序一致
          load();
          formEl.reset();
          if (countEl) countEl.textContent = '0 / 2000';
        })
        .catch(function (err) {
          if (errorEl) errorEl.textContent = (err && err.message) || '留言服務暫時無法連線，請稍後再試。';
        })
        .finally(function () {
          if (btn) { btn.disabled = false; btn.textContent = '發表留言'; }
        });
    });
  }

  load();
})();
