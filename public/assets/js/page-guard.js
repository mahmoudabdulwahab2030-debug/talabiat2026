/* حماية صفحات الإرسال: تنبيه قبل مغادرة الصفحة أو تحديثها إذا كانت هناك بيانات غير محفوظة،
   وتنبيه عند انقطاع الإنترنت وعودته */
(function () {
  var TABLE = "#orderDataTable";
  var SAVE_BUTTONS = ["saveDraftBtn", "saveDraftBtnBest", "sendQuantitiesBtn", "issueInvoiceBtn"];
  var dirty = false;

  function hasItems() {
    return document.querySelectorAll(TABLE + " tbody tr .sent-qty").length > 0;
  }

  // أي تعديل داخل الجدول يجعل البيانات غير محفوظة
  document.addEventListener("input", function (e) {
    if (e.target && e.target.closest && e.target.closest(TABLE)) dirty = true;
  }, true);
  document.addEventListener("change", function (e) {
    if (e.target && e.target.closest && e.target.closest(TABLE)) dirty = true;
  }, true);

  // عند الحفظ المؤقت أو الإرسال تعتبر البيانات محفوظة
  document.addEventListener("click", function (e) {
    var b = e.target && e.target.closest ? e.target.closest("button") : null;
    if (b && SAVE_BUTTONS.indexOf(b.id) !== -1) {
      setTimeout(function () { dirty = false; }, 2500);
    }
  }, true);

  function needsConfirm() { return dirty && hasItems(); }

  // تحديث الصفحة أو إغلاقها أو الخروج منها: تنبيه المتصفح الأصلي (لا يمكن تغيير نصه)
  window.addEventListener("beforeunload", function (e) {
    if (!needsConfirm()) return;
    e.preventDefault();
    e.returnValue = "";
    return "";
  });

  // الروابط داخل التطبيق: تنبيه بنافذة المشروع قبل الانتقال
  document.addEventListener("click", function (e) {
    var a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
    if (!a || a.target === "_blank" || !needsConfirm()) return;
    if (a.getAttribute("href").charAt(0) === "#") return;
    e.preventDefault();
    var href = a.href;
    if (!window.appConfirm) { location.href = href; return; }
    window.appConfirm("لديك أصناف غير محفوظة وستفقد عند الخروج.\nاحفظ مؤقتاً أولاً إن أردت الاحتفاظ بها. هل تريد المتابعة؟",
      { title: "تنبيه قبل الخروج", okText: "خروج", cancelText: "بقاء", danger: true })
      .then(function (ok) { if (ok) { dirty = false; location.href = href; } });
  }, false);

  // الاتصال بالإنترنت
  function alertUser(msg) { if (window.appAlert) window.appAlert(msg); }
  window.addEventListener("offline", function () {
    alertUser("⚠️ انقطع الاتصال بالإنترنت. لن تُحفظ البيانات حتى يعود الاتصال، ويمكنك الاستمرار في العمل وحفظها لاحقاً.");
  });
  window.addEventListener("online", function () {
    alertUser("✅ تم استعادة الاتصال بالإنترنت");
  });
  if (!navigator.onLine) {
    document.addEventListener("DOMContentLoaded", function () {
      alertUser("⚠️ لا يوجد اتصال بالإنترنت حالياً. تأكد من الاتصال قبل الحفظ أو الإرسال.");
    });
  }
})();
