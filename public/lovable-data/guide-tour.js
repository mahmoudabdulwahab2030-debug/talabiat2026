/*
 * عارض شرح الصفحات — يُحمَّل تلقائياً من session-guard.js.
 * يقرأ الشرح من settings/guide__<اسم الصفحة> ويعرضه بثيم زجاجي مع تنقل يدوي وتخطٍ.
 * window.GuideTour.play(guide) يعرض أي شرح (يستخدمه المحرر للمعاينة).
 */
(function () {
  if (window.GuideTour) return;
  var css = document.createElement('link'); css.rel = 'stylesheet'; css.href = '/lovable-data/guide-glass.css?v=1';
  document.head.appendChild(css);

  function pageKey(p) { try { p = decodeURIComponent(p || location.pathname); } catch (e) {} return (p.split('/').pop() || 'index.html').toLowerCase(); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function findTarget(t) {
    if (!t) return null; t = String(t).trim(); if (!t) return null;
    try { if (/^[#.\[]/.test(t)) { var el = document.querySelector(t); if (el) return el; } } catch (e) {}
    var all = document.querySelectorAll('button, a, h1, h2, h3, label, th, .btn, [role=button], input[type=button]');
    for (var i = 0; i < all.length; i++) { var x = all[i]; if (x.offsetParent !== null && (x.textContent || x.value || '').indexOf(t) > -1) return x; }
    return null;
  }

  var root = null, onCloseCb = null;
  function close() { if (root) { root.remove(); root = null; } if (onCloseCb) { var c = onCloseCb; onCloseCb = null; c(); } document.removeEventListener('keydown', onKey, true); }
  var api = {};
  function onKey(e) { if (!root) return; if (e.key === 'Escape') { api._skip && api._skip(); } else if (e.key === 'ArrowLeft') api._next && api._next(); else if (e.key === 'ArrowRight') api._prev && api._prev(); }

  function play(guide, opts) {
    opts = opts || {};
    var steps = (guide && guide.steps || []).filter(function (s) { return s && (s.title || s.body || s.image); });
    if (!steps.length) return;
    close(); onCloseCb = opts.onClose || null;
    var i = 0;
    root = document.createElement('div'); root.className = 'gt-root';
    root.innerHTML = '<div class="gt-overlay"></div><div class="gt-hole" style="display:none"></div><div class="gt-card" role="dialog" aria-modal="true"></div>';
    document.body.appendChild(root);
    var ov = root.children[0], hole = root.children[1], card = root.children[2];
    function finish(never) {
      if (!opts.preview) { try { localStorage.setItem('gt_seen_' + pageKey(guide.page), String(guide.version || 1)); if (never) localStorage.setItem('gt_never_' + pageKey(guide.page), '1'); } catch (e) {} }
      close();
    }
    function render() {
      var s = steps[i], n = steps.length, tpl = s.layout || 'standard';
      var img = s.image ? '<div class="gt-media"><img src="' + esc(s.image) + '" alt=""></div>' : '';
      var bodyHtml = s.body ? '<div class="gt-body' + (tpl === 'tip' ? ' gt-tip' : '') + '">' + esc(s.body) + '</div>' : '';
      var content = tpl === 'split' && img ? '<div class="gt-split">' + img + bodyHtml + '</div>' : img + bodyHtml;
      card.className = 'gt-card' + (tpl === 'split' && img ? ' gt-wide' : '') + (tpl === 'hero' ? ' gt-hero' : '');
      card.innerHTML =
        '<div class="gt-head"><div class="gt-badge">' + (tpl === 'hero' ? '✨' : tpl === 'tip' ? '💡' : (i + 1)) + '</div><div><div class="gt-kicker">' + esc(guide.title || 'شرح الصفحة') + ' • خطوة ' + (i + 1) + ' من ' + n + '</div><h3 class="gt-title">' + esc(s.title || '') + '</h3></div><button class="gt-x" aria-label="إغلاق">✕</button></div>' +
        content +
        '<div class="gt-progress"><i style="width:' + ((i + 1) / n * 100) + '%"></i></div>' +
        '<div class="gt-foot"><div class="gt-dots">' + steps.map(function (_, k) { return '<b class="' + (k === i ? 'on' : '') + '" data-k="' + k + '"></b>'; }).join('') + '</div>' +
        '<button class="gt-btn gt-ghost" data-a="skip">تخطي</button>' +
        '<button class="gt-btn" data-a="prev"' + (i === 0 ? ' disabled' : '') + '>السابق</button>' +
        '<button class="gt-btn gt-primary" data-a="next">' + (i === n - 1 ? 'إنهاء ✓' : 'التالي ←') + '</button></div>' +
        (opts.preview ? '' : '<label class="gt-never"><input type="checkbox"> عدم إظهار هذا الشرح تلقائياً مرة أخرى</label>');
      card.querySelector('.gt-x').onclick = api._skip;
      card.querySelectorAll('[data-a]').forEach(function (b) { b.onclick = api['_' + b.dataset.a]; });
      card.querySelectorAll('.gt-dots b').forEach(function (b) { b.onclick = function () { i = +b.dataset.k; render(); }; });
      // إبراز عنصر في الصفحة
      var el = findTarget(s.target);
      card.style.left = card.style.top = card.style.transform = '';
      if (el) {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        ov.classList.add('gt-spot'); hole.style.display = 'block';
        setTimeout(function () {
          var r = el.getBoundingClientRect(), pad = 6;
          hole.style.left = (r.left - pad) + 'px'; hole.style.top = (r.top - pad) + 'px'; hole.style.width = (r.width + pad * 2) + 'px'; hole.style.height = (r.height + pad * 2) + 'px';
          var ch = card.offsetHeight, vh = window.innerHeight;
          if (window.innerWidth > 620) {
            var top = r.bottom + 16 + ch < vh ? r.bottom + 16 : Math.max(12, r.top - 16 - ch);
            card.style.top = top + 'px'; card.style.transform = 'translateX(-50%)';
          } else { card.style.top = 'auto'; card.style.bottom = '12px'; card.style.transform = 'translateX(-50%)'; }
        }, 380);
      } else { ov.classList.remove('gt-spot'); hole.style.display = 'none'; card.style.bottom = ''; }
    }
    api._next = function () { if (i < steps.length - 1) { i++; render(); } else finish(neverChecked()); };
    api._prev = function () { if (i > 0) { i--; render(); } };
    api._skip = function () { finish(neverChecked()); };
    function neverChecked() { var c = card.querySelector('.gt-never input'); return !!(c && c.checked); }
    document.addEventListener('keydown', onKey, true);
    render();
  }

  function getDb() { try { return window.db || (window.firebase && firebase.firestore && firebase.firestore()); } catch (e) { return null; } }
  function load(page) {
    var db = getDb();
    if (!db || !db.collection) return Promise.resolve(null);
    return db.collection('settings').doc('guide__' + page).get().then(function (d) { return d.exists ? d.data() : null; }).catch(function () { return null; });
  }

  function boot() {
    var page = pageKey();
    load(page).then(function (g) {
      if (!g || g.enabled === false || !(g.steps || []).length) return;
      g.page = page;
      var fab = document.createElement('button'); fab.className = 'gt-fab gt-root'; fab.title = 'شرح الصفحة'; fab.textContent = '؟';
      fab.onclick = function () { play(g); };
      document.body.appendChild(fab);
      var seen = null, never = null;
      try { seen = localStorage.getItem('gt_seen_' + page); never = localStorage.getItem('gt_never_' + page); } catch (e) {}
      var newer = String(g.version || 1) !== String(seen);
      if (g.autoShow !== false && newer && (!never || newer && seen)) setTimeout(function () { play(g); }, 900);
    });
  }

  window.GuideTour = { play: play, load: load, pageKey: pageKey };
  if (document.readyState === 'complete') setTimeout(boot, 600); else window.addEventListener('load', function () { setTimeout(boot, 600); });
})();
