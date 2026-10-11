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

  var all = [];
  try {
    var x = new XMLHttpRequest();
    x.open("GET", URL_, false); // متزامن عن قصد (جدول صغير جدًا)
    x.setRequestHeader("apikey", KEY);
    x.send(null);
    if (x.status >= 200 && x.status < 300) {
      all = normalize(JSON.parse(x.responseText));
      try { localStorage.setItem(CACHE, JSON.stringify(all)); } catch (e) {}
    } else throw new Error("status " + x.status);
  } catch (e) {
    try { all = JSON.parse(localStorage.getItem(CACHE) || "[]"); } catch (e2) { all = []; }
  }

  function pageFor(b) { return (b.brand === "bestsweet" ? "branch-bestsweet.html" : "branch-ledoux.html") + "?id=" + encodeURIComponent(b.id); }

  var R = {
    BUILTIN: BUILTIN,
    all: function (includeHidden) { return all.filter(function (b) { return includeHidden || b.active; }); },
    extra: function (brand) { return R.all().filter(function (b) { return b.brand === brand; }); },
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
