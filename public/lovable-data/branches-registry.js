/*
 * سجل الفروع الديناميكية — الفروع التي تُنشأ من لوحة الإدارة (إدارة الفروع)
 * يُحمَّل بشكل متزامن قبل سكربتات الصفحة حتى تتمكن من دمج الفروع الجديدة
 * مع القوائم الثابتة. إذا لم توجد فروع مضافة تبقى الصفحات كما هي تمامًا.
 */
(function () {
  "use strict";
  var URL_ = "https://hhsavgucqgzehardjzdc.supabase.co/rest/v1/branches?select=id,data";
  var KEY = "sb_publishable_wPW5HF0EXuODlOSv_vy9kA_PSG-yozM";
  var CACHE = "lovable_dynamic_branches";

  /* المعرفات المحجوزة للفروع الأصلية */
  var BUILTIN = {
    ledoux: [
      { id: "korba", name: "الكوربة", page: "korba.html" },
      { id: "dokki", name: "الدقي", page: "dokki.html" },
      { id: "tagamo3", name: "التجمع", page: "tagamo3.html" },
      { id: "obour", name: "العبور", page: "obour.html" },
    ],
    bestsweet: [
      { id: "best_sweet_1", name: "اول اجمال", page: "best-sweet-branch1.html" },
      { id: "best_sweet_abbassia", name: "العباسيه", page: "best-sweet-abbassia.html" },
      { id: "best_sweet_helw_zaytoun", name: "حلو منه فيه الزيتون", page: "best-sweet-helw-zaytoun.html" },
      { id: "best_sweet_market_zaytoun", name: "فيصل", page: "best-sweet-market-zaytoun.html" },
      { id: "best_sweet_helwan", name: "حلوان", page: "best-sweet-helwan.html" },
      { id: "best_sweet_obour_market", name: "العبور ماركت", page: "best-sweet-obour-market.html" },
    ],
  };

  function normalize(rows) {
    return (rows || [])
      .map(function (r) {
        var d = r.data || {};
        return {
          id: String(d.id || r.id || ""),
          name: String(d.name || ""),
          brand: d.brand === "bestsweet" ? "bestsweet" : "ledoux",
          order: Number(d.order) || 0,
          active: d.active !== false,
          dynamic: d.dynamic === true,
          createdAt: d.createdAt || "",
          createdBy: d.createdBy || "",
          _rowId: r.id,
        };
      })
      .filter(function (b) { return b.dynamic && /^[a-z][a-z0-9_]{1,30}$/.test(b.id) && b.name; })
      .sort(function (a, b) { return a.order - b.order || a.name.localeCompare(b.name, "ar"); });
  }

  var CACHE_OVR = "lovable_builtin_overrides";
  var OVR = {};
  /* إعدادات الفروع الأصلية: وثائق في مجموعة branches بحقل builtin: true */
  function collectOverrides(rows) {
    var o = {};
    (rows || []).forEach(function (r) {
      var d = r.data || {};
      if (d.builtin === true) o[String(d.id || r.id || "")] = d;
    });
    return o;
  }

  var all = [];
  try {
    var x = new XMLHttpRequest();
    x.open("GET", URL_, false); // متزامن عن قصد (جدول صغير جدًا)
    x.setRequestHeader("apikey", KEY);
    x.send(null);
    if (x.status >= 200 && x.status < 300) {
      var raw = JSON.parse(x.responseText);
      all = normalize(raw);
      OVR = collectOverrides(raw);
      try { localStorage.setItem(CACHE, JSON.stringify(all)); localStorage.setItem(CACHE_OVR, JSON.stringify(OVR)); } catch (e) {}
    } else throw new Error("status " + x.status);
  } catch (e) {
    try { all = JSON.parse(localStorage.getItem(CACHE) || "[]"); } catch (e2) { all = []; }
    try { OVR = JSON.parse(localStorage.getItem(CACHE_OVR) || "{}"); } catch (e3) { OVR = {}; }
  }

  function pageFor(b) { return (b.brand === "bestsweet" ? "branch-bestsweet.html" : "branch-ledoux.html") + "?id=" + encodeURIComponent(b.id); }

  /* ===== تطبيق إعدادات الفروع الأصلية على الصفحات ===== */
  var BUILTIN_BY_ID = {};
  Object.keys(BUILTIN).forEach(function (k) {
    BUILTIN[k].forEach(function (b) { BUILTIN_BY_ID[b.id] = Object.assign({ brand: k }, b); });
  });
  function hiddenBuiltin(id) {
    var o = OVR[id];
    return !!(o && (o.deleted === true || o.active === false));
  }
  function applyBuiltinOverrides() {
    Object.keys(BUILTIN_BY_ID).forEach(function (id) {
      var o = OVR[id];
      if (!o) return;
      var b = BUILTIN_BY_ID[id];
      var hidden = hiddenBuiltin(id);
      var sel = 'a[href="' + b.page + '"], a[href^="' + b.page + '?"], a[href*="id=' + id + '"], option[value="' + id + '"]';
      document.querySelectorAll(sel).forEach(function (el) {
        if (el.tagName === "OPTION") {
          if (hidden) el.remove(); else if (o.name) el.textContent = o.name;
          return;
        }
        if (hidden) {
          var box = el.closest(".icon-card, li, .card, .btn, .branch-card") || el;
          box.style.display = "none";
          return;
        }
        if (o.name) {
          el.title = o.name;
          el.setAttribute("aria-label", o.name);
          var txt = Array.prototype.filter.call(el.childNodes, function (n) { return n.nodeType === 3 && n.textContent.trim(); });
          if (txt.length) txt[0].textContent = o.name;
          else if (!el.children.length) el.textContent = o.name;
          el.querySelectorAll(".label, .name, .title").forEach(function (x) { x.textContent = o.name; });
        }
      });
    });
  }
  function pageGate() {
    var path = decodeURIComponent(location.pathname).replace(/^\//, "");
    Object.keys(BUILTIN_BY_ID).forEach(function (id) {
      if (BUILTIN_BY_ID[id].page === path && hiddenBuiltin(id)) {
        document.body.innerHTML = '<div dir="rtl" style="font-family:Cairo,sans-serif;text-align:center;padding:80px 20px;color:#eee;background:#111;min-height:100vh"><div style="font-size:48px">🔒</div><h2>هذا الفرع غير متاح حالياً</h2><p style="opacity:.7">تواصل مع الإدارة لمزيد من المعلومات.</p></div>';
      }
    });
  }
  document.addEventListener("DOMContentLoaded", function () {
    try { applyBuiltinOverrides(); pageGate(); } catch (e) { console.warn("branch overrides", e); }
  });

  var R = {
    BUILTIN: BUILTIN,
    all: function (includeHidden) { return all.filter(function (b) { return includeHidden || b.active; }); },
    extra: function (brand) { return R.all().filter(function (b) { return b.brand === brand; }); },
    override: function (id) { return OVR[id] || null; },
    isHiddenBuiltin: function (id) { return hiddenBuiltin(id); },
    get: function (id) { for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i]; return null; },
    names: function (brand) { var o = {}; R.extra(brand).forEach(function (b) { o[b.id] = b.name; }); return o; },
    /* خريطة الاسم العربي → المعرف (لصفحات تطبيع اسم الفرع) */
    nameMap: function (brand) { var o = {}; R.extra(brand).forEach(function (b) { o[b.name] = b.id; o["فرع " + b.name] = b.id; }); return o; },
    page: pageFor,
    isReserved: function (id) {
      return Object.keys(BUILTIN).some(function (k) { return BUILTIN[k].some(function (b) { return b.id === id; }); });
    },
    /* إضافة <option> للقوائم المنسدلة */
    addOptions: function (select, brand, prefix) {
      if (!select) return;
      R.extra(brand).forEach(function (b) {
        if (select.querySelector('option[value="' + b.id + '"]')) return;
        var o = document.createElement("option"); o.value = b.id; o.textContent = (prefix || "") + b.name; select.appendChild(o);
      });
    },
    /* إضافة مدخلات إلى كائن أسماء الفروع */
    extendNames: function (obj, brand, prefix) { R.extra(brand).forEach(function (b) { if (!obj[b.id]) obj[b.id] = (prefix || "") + b.name; }); return obj; },
  };
  window.BranchRegistry = R;
})();
