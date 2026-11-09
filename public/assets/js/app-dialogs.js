/* نوافذ إشعارات المشروع (بدل نوافذ المتصفح الافتراضية) - بنفس ثيم التطبيق الزجاجي */
(function (g) {
  var SWAL_JS = "https://cdn.jsdelivr.net/npm/sweetalert2@11";
  var SWAL_CSS = "https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.css";
  var ready = null;

  var THEME = ".swal2-popup{background:rgba(20,24,30,.92)!important;color:#f4f6f9!important;border:1px solid rgba(255,255,255,.12)!important;border-radius:24px!important;backdrop-filter:blur(20px)!important;-webkit-backdrop-filter:blur(20px)!important;font-family:Cairo,'Segoe UI',Tahoma,sans-serif!important}" +
    ".swal2-title{color:#e8b44a!important;font-weight:800!important}" +
    ".swal2-html-container,.swal2-content{color:#f4f6f9!important}" +
    ".swal2-confirm{background:linear-gradient(180deg,#f0c25e,#c99534)!important;color:#14110a!important;border-radius:14px!important;font-weight:700!important}" +
    ".swal2-cancel{background:rgba(255,255,255,.08)!important;color:#f4f6f9!important;border:1px solid rgba(255,255,255,.14)!important;border-radius:14px!important}" +
    ".swal2-input,.swal2-textarea{background:rgba(255,255,255,.06)!important;color:#f4f6f9!important;border:1px solid rgba(255,255,255,.18)!important;border-radius:14px!important}";

  function loadSwal() {
    if (g.Swal) return Promise.resolve();
    if (ready) return ready;
    ready = new Promise(function (res, rej) {
      var l = document.createElement("link");
      l.rel = "stylesheet"; l.href = SWAL_CSS; document.head.appendChild(l);
      var st = document.createElement("style"); st.textContent = THEME; document.head.appendChild(st);
      var s = document.createElement("script");
      s.src = SWAL_JS; s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
    return ready;
  }

  function iconFor(msg) {
    msg = String(msg == null ? "" : msg);
    if (/❌|خطأ|فشل|تعذر|غير صحيح|غير موجود/.test(msg)) return "error";
    if (/✅|تم\s/.test(msg)) return "success";
    if (/⚠️|تنبيه|يجب|الرجاء|اختر|لا يمكن|لا توجد|غير/.test(msg)) return "warning";
    return "info";
  }

  // تنبيه (غير مانع): يعمل كبديل مباشر لـ alert
  g.appAlert = function (msg, opts) {
    return loadSwal().then(function () {
      return g.Swal.fire(Object.assign({ text: String(msg == null ? "" : msg), icon: iconFor(msg), confirmButtonText: "حسناً" }, opts || {}));
    });
  };
  g.alert = function (msg) { g.appAlert(msg); };

  // تأكيد: يُعيد Promise بالقيمة true/false - استخدمه بـ await
  g.appConfirm = function (msg, opts) {
    return loadSwal().then(function () {
      return g.Swal.fire(Object.assign({ title: "تأكيد", text: String(msg == null ? "" : msg), icon: "question",
        showCancelButton: true, confirmButtonText: "نعم", cancelButtonText: "إلغاء" }, opts || {}));
    }).then(function (r) { return !!(r && r.isConfirmed); });
  };

  // إدخال نص: يُعيد Promise بالنص أو null عند الإلغاء
  g.appPrompt = function (msg, def, opts) {
    return loadSwal().then(function () {
      return g.Swal.fire(Object.assign({ title: String(msg == null ? "" : msg), input: "text",
        inputValue: def == null ? "" : String(def), showCancelButton: true, confirmButtonText: "حفظ", cancelButtonText: "إلغاء" }, opts || {}));
    }).then(function (r) { return r && r.isConfirmed ? r.value : null; });
  };
})(window);
