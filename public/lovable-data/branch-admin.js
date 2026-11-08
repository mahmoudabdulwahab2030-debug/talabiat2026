/* إدارة الفروع الديناميكية من لوحة الإدارة */
(function () {
  "use strict";
  var BRANDS = { ledoux: "ليدو LE DOUX", bestsweet: "بيست سويت Best Sweet" };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  var AR = { "ا": "a", "أ": "a", "إ": "e", "آ": "a", "ب": "b", "ت": "t", "ث": "th", "ج": "g", "ح": "h", "خ": "kh", "د": "d", "ذ": "z", "ر": "r", "ز": "z", "س": "s", "ش": "sh", "ص": "s", "ض": "d", "ط": "t", "ظ": "z", "ع": "a", "غ": "gh", "ف": "f", "ق": "k", "ك": "k", "ل": "l", "م": "m", "ن": "n", "ه": "h", "ة": "a", "و": "w", "ي": "y", "ى": "a", "ئ": "e", "ؤ": "o", "ء": "" };
  function slug(name, brand) {
    var t = String(name || "").replace(/^فرع\s+/, "").trim().toLowerCase();
    var out = ""; for (var i = 0; i < t.length; i++) { var c = t[i]; out += AR[c] != null ? AR[c] : /[a-z0-9]/.test(c) ? c : /\s|-|_/.test(c) ? "_" : ""; }
    out = out.replace(/_+/g, "_").replace(/^_|_$/g, "");
    if (brand === "bestsweet") out = "best_sweet_" + out;
    if (!/^[a-z]/.test(out)) out = "br_" + out;
    return out.slice(0, 30);
  }

  async function loadList() {
    var snap = await db.collection("branches").get();
    var arr = [];
    snap.forEach(function (d) { var x = d.data(); if (x && x.dynamic) arr.push(Object.assign({ _doc: d.id }, x)); });
    arr.sort(function (a, b) { return (a.brand > b.brand ? 1 : -1) || (a.order || 0) - (b.order || 0); });
    return arr;
  }

  var OVR_MAP = {};
  async function loadOverrides() {
    var snap = await db.collection("branches").get();
    var m = {};
    snap.forEach(function (d) { var x = d.data() || {}; if (x.builtin === true) m[d.id] = x; });
    return m;
  }
  function bState(id) {
    var o = OVR_MAP[id] || {};
    var deleted = o.deleted === true;
    var active = o.active !== false && !deleted;
    return { name: o.name || null, deleted: deleted, active: active };
  }

  var BRAND_TABS = [["ledoux", "ليدو LE DOUX"], ["bestsweet", "بيست سويت Best Sweet"]];
  var STYLE =
    "<style>" +
    ".ba-t{width:100%;border-collapse:collapse;font-size:13px;direction:rtl}" +
    ".ba-t th{background:#ffd166;color:#23232a;padding:8px}" +
    ".ba-t td{border-bottom:1px solid #ddd;padding:6px;text-align:center}" +
    ".ba-b{border:none;background:#23232a;color:#ffd166;border-radius:8px;padding:5px 9px;cursor:pointer;text-decoration:none;display:inline-block}" +
    ".ba-tabs{display:flex;gap:6px;flex-wrap:wrap;border-bottom:2px solid #ffd166;padding-bottom:0;margin-bottom:12px}" +
    ".ba-tab{border:none;background:#eee;color:#23232a;padding:9px 16px;border-radius:10px 10px 0 0;cursor:pointer;font-weight:700;font-size:14px}" +
    ".ba-tab.on{background:#ffd166}" +
    ".ba-tab span{opacity:.7;font-weight:400}" +
    ".ba-tag{font-size:12px;background:#eee;border-radius:6px;padding:2px 6px;white-space:nowrap}" +
    "</style>";

  function brandPanel(brand, arr) {
    var rows = [];
    (BranchRegistry.BUILTIN[brand] || []).forEach(function (b) {
      var st = bState(b.id);
      var nm = st.name || b.name;
      var status = st.deleted ? "🗑️ محذوف" : (st.active ? "🟢 ظاهر" : "⚪ مخفي");
      rows.push("<tr" + (st.deleted ? ' style="opacity:.5"' : "") + "><td>" + esc(nm) + "</td><td><code>" + esc(b.id) + '</code></td><td><span class="ba-tag">🔒 أصلي</span></td><td>—</td><td>' + status + '</td><td style="white-space:nowrap">' +
        '<a class="ba-b" href="' + esc(b.page) + '" target="_blank" title="فتح الصفحة">🔗</a> ' +
        '<button class="ba-b" data-act="bedit" data-bid="' + esc(b.id) + '" title="تعديل الاسم">✏️</button> ' +
        (st.deleted
          ? '<button class="ba-b" data-act="brestore" data-bid="' + esc(b.id) + '" title="استعادة">♻️</button>'
          : '<button class="ba-b" data-act="btoggle" data-bid="' + esc(b.id) + '" title="إخفاء/إظهار">' + (st.active ? "👁️" : "🙈") + '</button> ' +
            '<button class="ba-b" data-act="bdel" data-bid="' + esc(b.id) + '" title="حذف">🗑️</button>') +
        "</td></tr>");
    });
    arr.filter(function (b) { return b.brand === brand; }).forEach(function (b) {
      rows.push("<tr><td>" + esc(b.name) + "</td><td><code>" + esc(b.id) + '</code></td><td><span class="ba-tag">➕ مُضاف</span></td><td>' + (b.order || 0) + "</td><td>" +
        (b.active !== false ? "🟢 ظاهر" : "⚪ مخفي") + '</td><td style="white-space:nowrap">' +
        '<a class="ba-b" href="' + esc(BranchRegistry.page(b)) + '" target="_blank" title="فتح الصفحة">🔗</a> ' +
        '<button class="ba-b" data-act="edit" data-id="' + esc(b._doc) + '" title="تعديل">✏️</button> ' +
        '<button class="ba-b" data-act="toggle" data-id="' + esc(b._doc) + '" title="إخفاء/إظهار">' + (b.active !== false ? "🙈" : "👁️") + '</button> ' +
        '<button class="ba-b" data-act="del" data-id="' + esc(b._doc) + '" title="حذف">🗑️</button></td></tr>');
    });
    if (!rows.length) return '<div style="opacity:.7;padding:14px;text-align:center">لا توجد فروع لهذا البراند بعد.</div>';
    return '<table class="ba-t"><thead><tr><th>الفرع</th><th>المعرف</th><th>النوع</th><th>الترتيب</th><th>الحالة</th><th>إجراءات</th></tr></thead><tbody>' +
      rows.join("") + "</tbody></table>";
  }

  function tabsHtml(arr, active) {
    var tabs = BRAND_TABS.map(function (t) {
      var n = (BranchRegistry.BUILTIN[t[0]] || []).length + arr.filter(function (b) { return b.brand === t[0]; }).length;
      return '<button type="button" class="ba-tab' + (t[0] === active ? " on" : "") + '" data-tab="' + t[0] + '">' + esc(t[1]) + ' <span>(' + n + ")</span></button>";
    }).join("");
    var panels = BRAND_TABS.map(function (t) {
      return '<div class="ba-panel" data-panel="' + t[0] + '"' + (t[0] === active ? "" : ' style="display:none"') + ">" + brandPanel(t[0], arr) + "</div>";
    }).join("");
    return '<div class="ba-tabs">' + tabs + "</div>" + panels;
  }

  async function open(startBrand) {
    var active = startBrand || "ledoux";
    Swal.fire({ title: "جاري التحميل...", didOpen: function () { Swal.showLoading(); } });
    var arr = [];
    try { arr = await loadList(); } catch (e) { return Swal.fire("خطأ", "تعذر تحميل الفروع", "error"); }
    try { OVR_MAP = await loadOverrides(); } catch (e) { OVR_MAP = {}; }
    await Swal.fire({
      title: "🏬 إدارة الفروع",
      width: "min(960px,96vw)",
      html:
        STYLE +
        '<div style="direction:rtl;text-align:right">' +
        '<button id="baNew" class="swal2-confirm swal2-styled" style="margin:0 0 12px">➕ إنشاء فرع جديد</button>' +
        '<div id="baTabs">' + tabsHtml(arr, active) + "</div>" +
        '<p style="font-size:12px;opacity:.75;margin-top:10px">💡 الفروع 🔒 الأصلية تُدار من صفحاتها نفسها ولا تُعدَّل أو تُحذف من هنا. أما الفروع ➕ المضافة فيمكن تعديلها أو إخفاؤها أو حذفها، والطلبيات المرفوعة لها تبقى محفوظة.</p></div>',
      showConfirmButton: true, confirmButtonText: "إغلاق",
      didOpen: function () {
        document.getElementById("baNew").onclick = function () {
          var cur = document.querySelector(".ba-tab.on");
          form(null, arr, cur ? cur.dataset.tab : active);
        };
        document.querySelectorAll(".ba-tab").forEach(function (tab) {
          tab.onclick = function () {
            document.querySelectorAll(".ba-tab").forEach(function (x) { x.classList.toggle("on", x === tab); });
            document.querySelectorAll(".ba-panel").forEach(function (pn) {
              pn.style.display = pn.dataset.panel === tab.dataset.tab ? "" : "none";
            });
          };
        });
        document.querySelectorAll(".ba-b[data-act]").forEach(function (b) {
          b.onclick = function () {
            var cur = document.querySelector(".ba-tab.on");
            var brandNow = cur ? cur.dataset.tab : active;
            if (b.dataset.bid) return builtinAction(b.dataset.act, b.dataset.bid, brandNow);
            var item = arr.filter(function (x) { return x._doc === b.dataset.id; })[0];
            if (b.dataset.act === "edit") form(item, arr, brandNow);
            else if (b.dataset.act === "toggle") toggle(item);
            else del(item);
          };
        });
      },
    });
  }

  async function form(item, arr, brand) {
    var isEdit = !!item;
    var startBrand = isEdit ? item.brand : (brand || "ledoux");
    var res = await Swal.fire({
      title: isEdit ? "✏️ تعديل الفرع" : "➕ إنشاء فرع جديد",
      html:
        '<div style="direction:rtl;text-align:right;display:grid;gap:10px">' +
        '<label>اسم الفرع بالعربي<input id="baName" class="swal2-input" style="width:100%;margin:4px 0 0;box-sizing:border-box" placeholder="مثال: مدينة نصر" value="' + esc(isEdit ? item.name : "") + '"></label>' +
        '<label>البراند<select id="baBrand" class="swal2-select" style="width:100%;margin:4px 0 0" ' + (isEdit ? "disabled" : "") + ">" +
        Object.keys(BRANDS).map(function (k) { return '<option value="' + k + '"' + (startBrand === k ? " selected" : "") + ">" + BRANDS[k] + "</option>"; }).join("") + "</select></label>" +
        '<label>المعرف بالإنجليزي (يُقترح تلقائيًا)<input id="baId" class="swal2-input" dir="ltr" style="width:100%;margin:4px 0 0;box-sizing:border-box" value="' + esc(isEdit ? item.id : "") + '" ' + (isEdit ? "disabled" : "") + "></label>" +
        '<label>الترتيب بين الأزرار<input id="baOrder" type="number" class="swal2-input" style="width:100%;margin:4px 0 0;box-sizing:border-box" value="' + (isEdit ? item.order || 0 : arr.length + 1) + '"></label>' +
        '<label style="display:flex;gap:8px;align-items:center"><input id="baActive" type="checkbox" ' + (!isEdit || item.active !== false ? "checked" : "") + "> ظاهر في الصفحات</label>" +
        (isEdit ? '<small style="opacity:.7">لا يمكن تغيير البراند أو المعرف بعد الإنشاء حتى لا تنفصل الطلبيات المرفوعة.</small>' : "") + "</div>",
      showCancelButton: true, confirmButtonText: isEdit ? "حفظ" : "إنشاء الفرع", cancelButtonText: "إلغاء",
      didOpen: function () {
        if (isEdit) return;
        var n = document.getElementById("baName"), id = document.getElementById("baId"), br = document.getElementById("baBrand"), touched = false;
        id.addEventListener("input", function () { touched = true; });
        function sug() { if (!touched) id.value = slug(n.value, br.value); }
        n.addEventListener("input", sug); br.addEventListener("change", sug);
      },
      preConfirm: async function () {
        var name = document.getElementById("baName").value.trim().replace(/^فرع\s+/, "");
        var brand = document.getElementById("baBrand").value;
        var id = document.getElementById("baId").value.trim().toLowerCase();
        var order = Number(document.getElementById("baOrder").value) || 0;
        var active = document.getElementById("baActive").checked;
        if (!name) return Swal.showValidationMessage("اكتب اسم الفرع");
        if (!isEdit) {
          if (!/^[a-z][a-z0-9_]{1,30}$/.test(id)) return Swal.showValidationMessage("المعرف: حروف إنجليزية صغيرة وأرقام و _ فقط ويبدأ بحرف");
          if (BranchRegistry.isReserved(id)) return Swal.showValidationMessage("هذا المعرف مستخدم لفرع أصلي");
          if (arr.some(function (x) { return x.id === id; })) return Swal.showValidationMessage("هذا المعرف مستخدم بالفعل");
        }
        if (arr.some(function (x) { return x.name === name && x.brand === brand && (!isEdit || x.id !== item.id); })) return Swal.showValidationMessage("يوجد فرع بنفس الاسم في هذا البراند");
        try {
          if (isEdit) await db.collection("branches").doc(item._doc).update({ name: name, order: order, active: active, updatedAt: new Date().toISOString() });
          else await db.collection("branches").doc(id).set({ id: id, name: name, brand: brand, order: order, active: active, dynamic: true, createdAt: new Date().toISOString(), createdBy: localStorage.getItem("username") || "" });
        } catch (e) { return Swal.showValidationMessage("تعذر الحفظ: " + (e.message || e)); }
        return { id: isEdit ? item.id : id, brand: isEdit ? item.brand : brand };
      },
    });
    if (!res.isConfirmed) return open(startBrand);
    try { localStorage.removeItem("lovable_dynamic_branches"); } catch (e) {}
    var b = res.value;
    await Swal.fire({
      icon: "success", title: isEdit ? "تم حفظ التعديل" : "✅ تم إنشاء الفرع",
      html: isEdit ? "" : "سيظهر زر الفرع في " + (b.brand === "bestsweet" ? "صفحة بيست سويت" : "الصفحة الرئيسية") + ' وفي صفحات التجميع والمتابعة وإدارة المرفوعات.<br><br><a href="' + BranchRegistry.page(b) + '" target="_blank">🔗 فتح صفحة الفرع</a><br><small>لا تنسَ إعطاء المستخدمين صلاحية الفرع من «عرض المستخدمين».</small>',
      confirmButtonText: "تمام",
    });
    location.reload();
  }

  async function toggle(item) {
    await db.collection("branches").doc(item._doc).update({ active: item.active === false });
    try { localStorage.removeItem("lovable_dynamic_branches"); } catch (e) {}
    location.reload();
  }

  async function del(item) {
    var r = await Swal.fire({ icon: "warning", title: "حذف فرع " + esc(item.name) + "؟", html: "سيختفي زر الفرع وأعمدته من كل الصفحات.<br>الطلبيات المرفوعة له <b>لن تُحذف</b> وتعود للظهور إذا أنشأت الفرع بنفس المعرف <code>" + esc(item.id) + "</code>.", showCancelButton: true, confirmButtonText: "نعم، احذف", cancelButtonText: "إلغاء", confirmButtonColor: "#d33" });
    if (!r.isConfirmed) return open();
    await db.collection("branches").doc(item._doc).delete();
    try { localStorage.removeItem("lovable_dynamic_branches"); } catch (e) {}
    location.reload();
  }

  async function saveOverride(id, patch) {
    await db.collection("branches").doc(id).set(Object.assign({ id: id, builtin: true, updatedAt: new Date().toISOString(), updatedBy: localStorage.getItem("username") || "" }, patch), { merge: true });
    try { localStorage.removeItem("lovable_builtin_overrides"); localStorage.removeItem("lovable_dynamic_branches"); } catch (e) {}
  }
  function findBuiltin(id) {
    var out = null;
    Object.keys(BranchRegistry.BUILTIN).forEach(function (k) {
      BranchRegistry.BUILTIN[k].forEach(function (b) { if (b.id === id) out = Object.assign({ brand: k }, b); });
    });
    return out;
  }
  async function builtinAction(act, id, brand) {
    var b = findBuiltin(id);
    if (!b) return;
    var st = bState(id);
    try {
      if (act === "bedit") {
        var r = await Swal.fire({
          title: "✏️ تعديل اسم الفرع", input: "text", inputValue: st.name || b.name,
          inputLabel: "الاسم الظاهر في الأزرار والصفحات", showCancelButton: true,
          confirmButtonText: "حفظ", cancelButtonText: "إلغاء",
          inputValidator: function (v) { if (!String(v || "").trim()) return "اكتب اسم الفرع"; },
        });
        if (!r.isConfirmed) return open(brand);
        await saveOverride(id, { name: r.value.trim() });
      } else if (act === "btoggle") {
        await saveOverride(id, { active: !st.active });
      } else if (act === "bdel") {
        var d = await Swal.fire({ icon: "warning", title: "حذف فرع " + esc(st.name || b.name) + "؟", html: "سيختفي زر الفرع من كل الصفحات، وتُمنع صفحته من الفتح.<br>يمكنك استعادته لاحقاً بزر ♻️.", showCancelButton: true, confirmButtonText: "نعم، احذف", cancelButtonText: "إلغاء", confirmButtonColor: "#d33" });
        if (!d.isConfirmed) return open(brand);
        await saveOverride(id, { deleted: true, active: false });
      } else if (act === "brestore") {
        await saveOverride(id, { deleted: false, active: true });
      }
    } catch (e) {
      await Swal.fire("خطأ", "تعذر الحفظ: " + (e.message || e), "error");
      return open(brand);
    }
    location.reload();
  }

  window.BranchAdmin = { open: open, slug: slug };
})();
