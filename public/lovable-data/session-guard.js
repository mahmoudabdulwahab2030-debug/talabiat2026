/*
 * حارس الجلسة والتحديثات — يُحمَّل تلقائياً من firestore-compat.js في كل الصفحات.
 * 1) يخرج المستخدم بعد فترة خمول (IDLE_MIN) أو بعد أقصى مدة للجلسة (MAX_HOURS) ويعيده لتسجيل الدخول ثم لنفس الصفحة.
 * 2) عند الرجوع لصفحة من ذاكرة المتصفح (زر الرجوع/إعادة فتح التبويب) يعيد التحقق والتحميل.
 * 3) يكتشف نشر نسخة جديدة من الصفحة ويحدّثها بهدوء عندما لا يكون المستخدم يكتب، أو يعرض شريطاً صغيراً.
 */
(function () {
  if (window.__sessionGuard) return; window.__sessionGuard = true;
  var IDLE_MIN = 30, MAX_HOURS = 12, CHECK_MS = 30000, UPDATE_MS = 5 * 60000;
  var LOGIN_PAGES = /(^|\/)(index|login)\.html$|^\/$/i;
  var path = location.pathname;
  var isLogin = LOGIN_PAGES.test(path);
  var now = function () { return Date.now(); };
  var get = function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } };
  var set = function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} };
  var hasSession = function () { return !!(get('username') || get('userCode') || get('userUid')); };

  function logout(reason) {
    ['userCode', 'username', 'userUid', 'userRoles', 'sg_lastActive', 'sg_loginAt'].forEach(function (k) { try { localStorage.removeItem(k); } catch (e) {} });
    try { sessionStorage.clear(); } catch (e) {}
    set('sg_reason', reason || 'idle');
    var back = path.replace(/^\//, '') + location.search.replace(/[?&](user|roles)=[^&]*/g, '').replace(/^&/, '?');
    location.replace('/index.html?redirect=' + encodeURIComponent(back.split('?')[0]));
  }

  if (isLogin) {
    // رسالة لطيفة توضح سبب الخروج
    var r = get('sg_reason');
    if (r) {
      try { localStorage.removeItem('sg_reason'); } catch (e) {}
      document.addEventListener('DOMContentLoaded', function () {
        var m = document.getElementById('message');
        if (m) { m.textContent = r === 'max' ? '🔒 انتهت مدة الجلسة، سجّل الدخول مرة أخرى' : '🔒 تم تسجيل الخروج تلقائياً بسبب عدم النشاط'; m.style.color = 'orange'; }
      });
    }
    // بدء جلسة جديدة عند تسجيل الدخول
    var orig = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      orig.apply(this, arguments);
      if (this === window.localStorage && k === 'userCode') { orig.call(this, 'sg_loginAt', String(now())); orig.call(this, 'sg_lastActive', String(now())); }
    };
    return;
  }

  function check() {
    if (!hasSession()) return;
    var t = now();
    var last = +get('sg_lastActive') || 0, start = +get('sg_loginAt') || 0;
    if (!start) { set('sg_loginAt', String(t)); start = t; }
    if (!last) { set('sg_lastActive', String(t)); last = t; }
    if (t - last > IDLE_MIN * 60000) return logout('idle');
    if (t - start > MAX_HOURS * 3600000) return logout('max');
  }
  check();

  var lastWrite = 0;
  function activity() {
    var t = now();
    if (t - lastWrite < 15000) return;
    check(); lastWrite = t; if (hasSession()) set('sg_lastActive', String(t));
  }
  ['click', 'keydown', 'pointerdown', 'touchstart', 'scroll', 'input'].forEach(function (e) { window.addEventListener(e, activity, { passive: true, capture: true }); });
  setInterval(check, CHECK_MS);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) { check(); checkUpdate(); } });
  // صفحة مستعادة من ذاكرة الرجوع: أعد التحميل لضمان أحدث نسخة وتحقق الجلسة
  window.addEventListener('pageshow', function (e) { if (e.persisted) location.reload(); });
  // خروج من تبويب ينعكس على باقي التبويبات
  window.addEventListener('storage', function (e) { if ((e.key === 'userCode' || e.key === 'username') && !e.newValue && !hasSession()) location.replace('/index.html'); });

  // ===== اكتشاف التحديثات =====
  var baseSig = null, pending = false;
  function sig(txt) { var h = 0; for (var i = 0; i < txt.length; i++) { h = (h * 31 + txt.charCodeAt(i)) | 0; } return h + ':' + txt.length; }
  function fetchSig() {
    return fetch(location.pathname, { cache: 'no-store', credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.text() : null; }).then(function (t) { return t ? sig(t) : null; }).catch(function () { return null; });
  }
  function busy() {
    var a = document.activeElement;
    if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return true;
    if (document.querySelector('.swal2-container, .modal.show')) return true;
    return false;
  }
  function showBar() {
    if (document.getElementById('sgUpdateBar')) return;
    var b = document.createElement('div');
    b.id = 'sgUpdateBar'; b.dir = 'rtl';
    b.style.cssText = 'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:99999;background:#1b1b1b;color:#f5d27a;border:1px solid #c9a646;border-radius:14px;padding:10px 14px;font-family:Cairo,sans-serif;font-size:14px;box-shadow:0 8px 24px rgba(0,0,0,.45);display:flex;gap:10px;align-items:center;max-width:92vw';
    b.innerHTML = '<span>✨ يوجد تحديث جديد للنظام</span><button style="background:#c9a646;color:#111;border:0;border-radius:10px;padding:6px 12px;font-weight:700;cursor:pointer;font-family:inherit">تحديث الآن</button><button aria-label="إغلاق" style="background:none;border:0;color:#aaa;cursor:pointer;font-size:16px">✕</button>';
    b.children[1].onclick = function () { location.reload(); };
    b.children[2].onclick = function () { b.remove(); };
    document.body.appendChild(b);
  }
  function checkUpdate() {
    if (pending || location.protocol === 'file:') return;
    fetchSig().then(function (s) {
      if (!s) return;
      if (baseSig === null) { baseSig = s; return; }
      if (s !== baseSig) {
        pending = true;
        // تحديث صامت فقط إذا كان المستخدم غائباً عن الصفحة ولا يعدّل شيئاً؛ وإلا شريط صغير
        if (document.hidden && !busy()) { document.addEventListener('visibilitychange', function () { location.reload(); }, { once: true }); }
        else showBar();
      }
    });
  }
  setTimeout(checkUpdate, 3000);
  setInterval(function () { if (!document.hidden) checkUpdate(); }, UPDATE_MS);
})();
