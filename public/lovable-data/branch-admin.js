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

  function listHtml(arr) {
    if (!arr.length) return '<div style="opacity:.7;padding:12px;text-align:center">لا توجد فروع مضافة بعد — الفروع الأصلية لا تظهر هنا ولا تتأثر.</div>';
    return '<table class="ba-t"><thead><tr><th>الفرع</th><th>البراند</th><th>المعرف</th><th>الترتيب</th><th>الحالة</th><th>إجراءات</th></tr></thead><tbody>' +
      arr.map(function (b) {
        return "<tr><td><a href=\"" + esc(BranchRegistry.page(b)) + '" target="_blank" style="color:inherit">' + esc(b.name) + "</a></td><td>" + esc(BRANDS[b.brand] || b.brand) + "</td><td><code>" + esc(b.id) + "</code></td><td>" + (b.order || 0) + "</td><td>" +
          (b.active !== false ? "🟢 ظاهر" : "⚪ مخفي") + '</td><td style="white-space:nowrap">' +
          '<button class="ba-b" data-act="edit" data-id="' + esc(b._doc) + '" title="تعديل">✏️</button> ' +
          '<button class="ba-b" data-act="toggle" data-id="' + esc(b._doc) + '" title="إخفاء/إظهار">' + (b.active !== false ? "🙈" : "👁️") + "</button> " +
          '<button class="ba-b" data-act="del" data-id="' + esc(b._doc) + '" title="حذف">🗑️</button></td></tr>';
      }).join("") + "</tbody></table>";
  }

  async function open() {
    Swal.fire({ title: "جاري التحميل...", didOpen: function () { Swal.showLoading(); } });
    var arr = [];
    try { arr = await loadList(); } catch (e) { return Swal.fire("خطأ", "تعذر تحميل الفروع", "error"); }
    await Swal.fire({
      title: "🏬 إدارة الفروع",
      width: "min(900px,96vw)",
      html:
        "<style>.ba-t{width:100%;border-collapse:collapse;font-size:13px;direction:rtl}.ba-t th{background:#ffd166;color:#23232a;padding:8px}.ba-t td{border-bottom:1px solid #ddd;padding:6px;text-align:center}.ba-b{border:none;background:#23232a;color:#ffd166;border-radius:8px;padding:5px 9px;cursor:pointer}</style>" +
        '<div style="direction:rtl;text-align:right">' +
        '<button id="baNew" class="swal2-confirm swal2-styled" style="margin:0 0 12px">➕ إنشاء فرع جديد</button>' +
        '<div id="baList">' + listHtml(arr) + "</div>" +
        '<p style="font-size:12px;opacity:.75;margin-top:10px">💡 حذف الفرع أو إخفاؤه يزيل زره وأعمدته من الصفحات، والطلبيات المرفوعة له تبقى محفوظة.</p></div>',
      showConfirmButton: true, confirmButtonText: "إغلاق",
      didOpen: function () {
        document.getElementById("baNew").onclick = function () { form(null, arr); };
        document.querySelectorAll(".ba-b").forEach(function (b) {
          b.onclick = function () {
            var item = arr.filter(function (x) { return x._doc === b.dataset.id; })[0];
            if (b.dataset.act === "edit") form(item, arr);
            else if (b.dataset.act === "toggle") toggle(item);
            else del(item);
          };
        });
      },
    });
  }

  async function form(item, arr) {
    var isEdit = !!item;
    var res = await Swal.fire({
      title: isEdit ? "✏️ تعديل الفرع" : "➕ إنشاء فرع جديد",
      html:
        '<div style="direction:rtl;text-align:right;display:grid;gap:10px">' +
        '<label>اسم الفرع بالعربي<input id="baName" class="swal2-input" style="width:100%;margin:4px 0 0;box-sizing:border-box" placeholder="مثال: مدينة نصر" value="' + esc(isEdit ? item.name : "") + '"></label>' +
        '<label>البراند<select id="baBrand" class="swal2-select" style="width:100%;margin:4px 0 0" ' + (isEdit ? "disabled" : "") + ">" +
        Object.keys(BRANDS).map(function (k) { return '<option value="' + k + '"' + (isEdit && item.brand === k ? " selected" : "") + ">" + BRANDS[k] + "</option>"; }).join("") + "</select></label>" +
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
    if (!res.isConfirmed) return open();
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

  window.BranchAdmin = { open: open, slug: slug };
})();
