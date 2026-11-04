/* بحث بأيقونة عدسة في جداول صفحات التجميع (#resultArea) — اسم الصنف أو الكود */
(function () {
  var css = '\
#aggSearch{position:fixed;top:14px;left:14px;z-index:9990;display:flex;align-items:center;direction:rtl;font-family:Cairo,sans-serif}\
#aggSearch .as-btn{width:46px;height:46px;border-radius:50%;border:1px solid #c9a646;background:linear-gradient(145deg,#2a2a2a,#151515);color:#f5d27a;font-size:20px;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;transition:transform .2s}\
#aggSearch .as-btn:hover{transform:scale(1.07)}\
#aggSearch .as-box{width:0;opacity:0;overflow:hidden;transition:width .35s ease,opacity .25s;display:flex;align-items:center;background:#161616;border:1px solid #c9a646;border-radius:24px;margin-inline-start:8px;height:42px;box-shadow:0 6px 18px rgba(0,0,0,.45)}\
#aggSearch.open .as-box{width:min(320px,calc(100vw - 90px));opacity:1}\
#aggSearch input{flex:1;min-width:0;background:transparent;border:0;outline:0;color:#fff;padding:0 14px;font-family:inherit;font-size:15px}\
#aggSearch .as-count{color:#c9a646;font-size:12px;padding:0 8px;white-space:nowrap}\
#aggSearch .as-x{background:none;border:0;color:#aaa;font-size:16px;cursor:pointer;padding:0 12px}\
tr.as-hit td{background:rgba(201,166,70,.22)!important}\
@media print{#aggSearch{display:none!important}}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  function init() {
    var area = document.getElementById('resultArea'); if (!area) return;
    var w = document.createElement('div'); w.id = 'aggSearch';
    w.innerHTML = '<button class="as-btn" type="button" title="بحث" aria-label="بحث في الجدول">🔍</button><div class="as-box"><input type="search" placeholder="اسم الصنف أو الكود..." aria-label="بحث"><span class="as-count"></span><button class="as-x" type="button" aria-label="مسح">✕</button></div>';
    document.body.appendChild(w);
    var btn = w.querySelector('.as-btn'), input = w.querySelector('input'), cnt = w.querySelector('.as-count'), x = w.querySelector('.as-x');
    var norm = function (s) { return (s || '').toString().toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/\s+/g, ' ').trim(); };
    function apply() {
      var q = norm(input.value), n = 0, first = null;
      area.querySelectorAll('tbody tr').forEach(function (tr) {
        if (!q) { tr.style.display = ''; tr.classList.remove('as-hit'); return; }
        var ok = norm(tr.textContent).indexOf(q) !== -1;
        tr.style.display = ok ? '' : 'none'; tr.classList.toggle('as-hit', ok);
        if (ok) { n++; if (!first) first = tr; }
      });
      cnt.textContent = q ? n + ' نتيجة' : '';
      return first;
    }
    function open() { w.classList.add('open'); setTimeout(function () { input.focus(); }, 60); }
    function close() { input.value = ''; apply(); w.classList.remove('open'); }
    btn.onclick = function () { w.classList.contains('open') ? close() : open(); };
    x.onclick = close;
    input.addEventListener('input', apply);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') close();
      if (e.key === 'Enter') { var f = apply(); if (f) f.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    });
    // إعادة التطبيق عند إعادة رسم الجدول
    new MutationObserver(function () { if (input.value) apply(); }).observe(area, { childList: true, subtree: true });
  }
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();
})();
