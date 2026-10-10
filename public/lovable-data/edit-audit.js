/* تأكيد هوية المستخدم عند "استدعاء طلبية سابقة" وتسجيل التعديلات */
(function () {
  "use strict";
  var cfg = { collection: "orders", branch: "" };
  var session = null; // { enteredAt, date, logId, before }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function currentUser() {
    return {
      name: localStorage.getItem("username") || localStorage.getItem("userCode") || "",
      code: localStorage.getItem("userCode") || "",
    };
  }

  async function checkPassword(pw) {
    var u = currentUser();
    if (!u.code) return false;
    var q = await db.collection("users").where("code", "==", u.code).get();
    if (q.empty) return false;
    return String(q.docs[0].data().password || "") === pw;
  }

  async function verify() {
    var u = currentUser();
    if (!u.code) {
      await Swal.fire("تنبيه", "يجب تسجيل الدخول أولاً حتى يتم تسجيل التعديل باسمك", "warning");
      return false;
    }
    var res = await Swal.fire({
      title: "🔐 تأكيد الهوية",
      html:
        '<div style="direction:rtl;margin-bottom:12px;font-weight:700"><span style="color:#d4a017">' +
        esc(u.name) +
        "</span> اكتب الباسورد الخاص بيك علشان التعديل يتسجل بإسمك</div>" +
        '<div style="position:relative;direction:rtl">' +
        '<input id="eaPw" type="password" class="swal2-input" placeholder="كلمة المرور" autocomplete="current-password" style="width:100%;margin:0;box-sizing:border-box;padding-left:46px">' +
        '<button type="button" id="eaEye" aria-label="عرض كلمة المرور" style="position:absolute;left:8px;top:50%;transform:translateY(-50%);background:none;border:none;font-size:20px;cursor:pointer">👁️</button></div>',
      showCancelButton: true,
      confirmButtonText: "تأكيد",
      cancelButtonText: "إلغاء",
      showLoaderOnConfirm: true,
      allowOutsideClick: function () { return !Swal.isLoading(); },
      didOpen: function () {
        var pw = document.getElementById("eaPw");
        var eye = document.getElementById("eaEye");
        pw.focus();
        pw.addEventListener("keydown", function (e) { if (e.key === "Enter") Swal.clickConfirm(); });
        eye.onclick = function () {
          var show = pw.type === "password";
          pw.type = show ? "text" : "password";
          eye.textContent = show ? "🙈" : "👁️";
          eye.setAttribute("aria-label", show ? "إخفاء كلمة المرور" : "عرض كلمة المرور");
        };
      },
      preConfirm: async function () {
        var pw = document.getElementById("eaPw").value;
        if (!pw) { Swal.showValidationMessage("اكتب كلمة المرور"); return false; }
        try {
          if (!(await checkPassword(pw))) {
            Swal.showValidationMessage("❌ كلمة المرور غير صحيحة، حاول مرة أخرى");
            var el = document.getElementById("eaPw"); el.value = ""; el.focus();
            return false;
          }
        } catch (e) {
          Swal.showValidationMessage("تعذر التحقق، حاول مرة أخرى");
          return false;
        }
        return true;
      },
    });
    if (!res.isConfirmed) return false;
    session = { enteredAt: new Date().toISOString() };
    return true;
  }

  async function fetchItems(date) {
    var snap = await db.collection(cfg.collection).where("branch", "==", cfg.branch).where("orderDate", "==", date).get();
    var arr = [];
    snap.forEach(function (d) {
      var x = d.data();
      arr.push({ sheet: x.sheet || "", code: x.code || "", name: x.name || "", qty: Number(x.qty) || 0, notes: x.notes || "" });
    });
    return arr;
  }
  function keyOf(i) { return i.sheet + "|" + (i.code || i.name); }
  function diff(before, after) {
    var bm = {}, am = {}, out = [];
    before.forEach(function (i) { bm[keyOf(i)] = i; });
    after.forEach(function (i) { am[keyOf(i)] = i; });
    Object.keys(bm).forEach(function (k) {
      var b = bm[k], a = am[k];
      if (!a) out.push({ change: "حذف", sheet: b.sheet, code: b.code, name: b.name, beforeQty: b.qty, afterQty: 0, beforeNotes: b.notes, afterNotes: "" });
      else if (a.qty !== b.qty || a.notes !== b.notes)
        out.push({ change: "تعديل", sheet: b.sheet, code: b.code, name: b.name, beforeQty: b.qty, afterQty: a.qty, beforeNotes: b.notes, afterNotes: a.notes });
    });
    Object.keys(am).forEach(function (k) {
      if (!bm[k]) { var a = am[k]; out.push({ change: "إضافة", sheet: a.sheet, code: a.code, name: a.name, beforeQty: 0, afterQty: a.qty, beforeNotes: "", afterNotes: a.notes }); }
    });
    return out;
  }

  function wrap() {
    var origLoad = window.loadOrderForEdit;
    if (typeof origLoad === "function" && !origLoad.__ea) {
      window.loadOrderForEdit = async function (date) {
        var r = await origLoad.apply(this, arguments);
        try {
          if (!session) session = { enteredAt: new Date().toISOString() };
          session.date = date;
          session.before = await fetchItems(date);
          var u = currentUser();
          var ref = await db.collection("activity_logs").add({
            type: "order_edit", collection: cfg.collection, branch: cfg.branch, orderDate: date,
            user: u.name, userCode: u.code, enteredAt: session.enteredAt, saves: [],
          });
          session.logId = ref.id;
        } catch (e) { console.warn("[edit-audit] load", e); }
        return r;
      };
      window.loadOrderForEdit.__ea = true;
    }
    var origSave = window.saveChanges;
    if (typeof origSave === "function" && !origSave.__ea) {
      window.saveChanges = async function () {
        var r = await origSave.apply(this, arguments);
        try {
          if (session && session.date && session.logId) {
            var after = await fetchItems(session.date);
            var changes = diff(session.before || [], after);
            if (changes.length) {
              var ref = db.collection("activity_logs").doc(session.logId);
              var doc = await ref.get();
              var saves = (doc.exists && doc.data().saves) || [];
              saves.push({ savedAt: new Date().toISOString(), changes: changes });
              await ref.update({ saves: saves });
              session.before = after;
            }
          }
        } catch (e) { console.warn("[edit-audit] save", e); }
        return r;
      };
      window.saveChanges.__ea = true;
    }
  }

  window.EditAudit = {
    verify: verify,
    init: function (c) {
      cfg = Object.assign(cfg, c || {});
      wrap();
      window.addEventListener("load", wrap);
    },
    /* لصفحات إدارة الملفات */
    fetchLogs: async function (collection, branch, date) {
      var snap = await db.collection("activity_logs").where("type", "==", "order_edit").where("branch", "==", branch).where("orderDate", "==", date).get();
      var arr = [];
      snap.forEach(function (d) { var x = d.data(); if (!x.collection || x.collection === collection) arr.push(Object.assign({ id: d.id }, x)); });
      arr.sort(function (a, b) { return String(b.enteredAt).localeCompare(String(a.enteredAt)); });
      return arr;
    },
    showLogs: async function (collection, branch, date, branchLabel) {
      Swal.fire({ title: "جاري التحميل...", didOpen: function () { Swal.showLoading(); } });
      var logs;
      try { logs = await EditAudit.fetchLogs(collection, branch, date); } catch (e) { return Swal.fire("خطأ", "تعذر تحميل السجل", "error"); }
      var fmt = function (s) { try { return new Date(s).toLocaleString("ar-EG"); } catch (e) { return s; } };
      var rows = logs.map(function (l, i) {
        var n = (l.saves || []).reduce(function (s, x) { return s + x.changes.length; }, 0);
        return "<tr><td>" + fmt(l.enteredAt) + "</td><td>" + esc(l.user || l.userCode || "—") + "</td><td>" +
          (n ? '<button class="ea-det" data-i="' + i + '" title="التفاصيل">🔍 <small>(' + n + ")</small></button>" : '<span style="opacity:.6">بدون تعديل</span>') + "</td></tr>";
      }).join("");
      var html =
        '<style>.ea-wrap{display:flex;gap:12px;direction:rtl;text-align:right;flex-wrap:wrap}.ea-wrap>div{flex:1 1 300px;min-width:0;overflow:auto;max-height:60vh}' +
        ".ea-t{width:100%;border-collapse:collapse;font-size:13px}.ea-t th{background:#ffd166;color:#23232a;padding:8px;position:sticky;top:0}.ea-t td{border-bottom:1px solid #ddd;padding:6px;text-align:center}" +
        ".ea-det{background:#23232a;color:#ffd166;border:none;border-radius:8px;padding:5px 10px;cursor:pointer}.ea-sec{background:#f3f3f3;font-weight:700;text-align:right!important}</style>" +
        '<div class="ea-wrap"><div><table class="ea-t"><thead><tr><th>وقت الدخول</th><th>اسم المستخدم</th><th>تفاصيل</th></tr></thead><tbody>' +
        (rows || '<tr><td colspan="3">لا توجد عمليات تعديل مسجلة</td></tr>') +
        '</tbody></table></div><div id="eaSide" style="display:none"></div></div>';
      Swal.fire({
        title: "📝 سجل التعديلات — " + esc(branchLabel || branch) + " / " + esc(date),
        html: html, width: "min(1100px,96vw)", confirmButtonText: "إغلاق",
        didOpen: function () {
          document.querySelectorAll(".ea-det").forEach(function (b) {
            b.onclick = function () {
              var l = logs[+b.dataset.i], bySec = {};
              (l.saves || []).forEach(function (s) { s.changes.forEach(function (c) { (bySec[c.sheet || "بدون قسم"] = bySec[c.sheet || "بدون قسم"] || []).push(Object.assign({ at: s.savedAt }, c)); }); });
              var h = '<table class="ea-t"><thead><tr><th>الصنف</th><th>النوع</th><th>قبل</th><th>بعد</th><th>ملاحظات قبل/بعد</th></tr></thead><tbody>';
              Object.keys(bySec).forEach(function (sec) {
                h += '<tr><td colspan="5" class="ea-sec">📁 ' + esc(sec) + "</td></tr>";
                bySec[sec].forEach(function (c) {
                  h += "<tr><td>" + esc(c.name) + (c.code ? "<br><small>" + esc(c.code) + "</small>" : "") + "</td><td>" + c.change + "</td><td>" + c.beforeQty + '</td><td style="font-weight:700">' + c.afterQty + "</td><td>" +
                    (c.beforeNotes !== c.afterNotes ? esc(c.beforeNotes || "—") + " ← " + esc(c.afterNotes || "—") : esc(c.afterNotes || "")) + "</td></tr>";
                });
              });
              var side = document.getElementById("eaSide");
              side.innerHTML = '<div style="font-weight:700;margin-bottom:6px">' + esc(l.user || "") + " — " + fmt(l.enteredAt) + "</div>" + h + "</tbody></table>";
              side.style.display = "block";
            };
          });
        },
      });
    },
  };
})();
