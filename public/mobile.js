/* ==========================================================
   LE DOUX — تشغيل المشروع على الموبايل (mobile runtime)
   يعمل تلقائيًا على كل الصفحات، ولا يغيّر شكل الديسكتوب.
   ========================================================== */
(function () {
  'use strict';
  if (window.__ledouxMobileReady) return;
  window.__ledouxMobileReady = true;

  var BREAKPOINT = 820;

  // 1) ضبط وسم العرض (viewport) على كل الصفحات
  function ensureMeta(name, content) {
    var el = document.querySelector('meta[name="' + name + '"]');
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute('name', name);
      (document.head || document.documentElement).appendChild(el);
    }
    el.setAttribute('content', content);
  }
  ensureMeta('viewport', 'width=device-width, initial-scale=1.0, viewport-fit=cover');
  ensureMeta('theme-color', '#0f0f10');
  ensureMeta('mobile-web-app-capable', 'yes');
  ensureMeta('apple-mobile-web-app-status-bar-style', 'black-translucent');

  // 2) تحميل تنسيقات الموبايل لو لم تكن مربوطة بالصفحة
  if (!document.querySelector('link[data-ledoux-mobile]')) {
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/mobile.css';
    link.setAttribute('data-ledoux-mobile', '1');
    (document.head || document.documentElement).appendChild(link);
  }

  // 3) علامة على العنصر الجذري تفيد الأكواد الأخرى
  function markMode() {
    var isMobile = window.innerWidth <= BREAKPOINT;
    document.documentElement.classList.toggle('m-mobile', isMobile);
    document.documentElement.classList.toggle('m-desktop', !isMobile);
    return isMobile;
  }
  markMode();
  window.addEventListener('resize', markMode, { passive: true });
  window.addEventListener('orientationchange', function () {
    setTimeout(markMode, 120);
  });

  function onReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  }

  // 4) تغليف الجداول للتمرير الأفقي (بدون تغيير محتواها)
  function isScrollable(el) {
    if (!el || el === document.body) return false;
    var ox = getComputedStyle(el).overflowX;
    return ox === 'auto' || ox === 'scroll';
  }

  function wrapTables(root) {
    var tables = (root || document).querySelectorAll('table:not([data-m-wrapped])');
    for (var i = 0; i < tables.length; i++) {
      var t = tables[i];
      t.setAttribute('data-m-wrapped', '1');
      var parent = t.parentElement;
      if (!parent) continue;
      if (parent.classList.contains('m-tablewrap')) continue;
      if (parent.children.length === 1 && isScrollable(parent)) continue;
      var wrap = document.createElement('div');
      wrap.className = 'm-tablewrap';
      parent.insertBefore(wrap, t);
      wrap.appendChild(t);
    }
  }

  onReady(function () {
    wrapTables(document);

    // الجداول التي تُبنى ديناميكيًا من قاعدة البيانات
    var pending = null;
    var mo = new MutationObserver(function () {
      if (pending) return;
      pending = setTimeout(function () {
        pending = null;
        wrapTables(document);
      }, 150);
    });
    mo.observe(document.body, { childList: true, subtree: true });

    // 5) زر الرجوع لأعلى الصفحة
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'm-totop';
    btn.setAttribute('aria-label', 'الرجوع لأعلى الصفحة');
    btn.innerHTML = '&#8593;';
    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    document.body.appendChild(btn);

    var ticking = false;
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        ticking = false;
        if (window.innerWidth > BREAKPOINT) { btn.classList.remove('show'); return; }
        btn.classList.toggle('show', window.scrollY > 320);
      });
    }, { passive: true });
  });
})();
