/* حماية الجدول: تنبيه قبل تغيير الفرع أو التاريخ أو القسم إذا كان هناك أصناف معروضة */
(function () {
  var IDS = ["branch", "orderDate", "section"];
  var committed = {};
  var bypass = {};

  function hasRows() {
    return document.querySelectorAll("#orderDataTable tbody tr .sent-qty").length > 0;
  }
  function el(id) { return document.getElementById(id); }

  IDS.forEach(function (id) {
    var e = el(id);
    if (e) committed[id] = e.value;
  });
  // نحدّث القيمة المعتمدة عند فتح الحقل حتى تعرف الصفحة آخر اختيار صحيح
  document.addEventListener("focusin", function (ev) {
    if (ev.target && IDS.indexOf(ev.target.id) !== -1) committed[ev.target.id] = ev.target.value;
  }, true);

  document.addEventListener("change", function (ev) {
    var id = ev.target && ev.target.id;
    if (IDS.indexOf(id) === -1) return;
    if (bypass[id]) { bypass[id] = false; committed[id] = ev.target.value; return; }   // تغيير تمت الموافقة عليه
    if (!hasRows()) { committed[id] = ev.target.value; return; }                       // لا توجد بيانات: التغيير مباشر

    // إيقاف التغيير قبل أن يبدأ أي شيء في الصفحة، ثم السؤال
    ev.stopImmediatePropagation();
    ev.preventDefault();
    var target = ev.target;
    var newVal = target.value;
    target.value = committed[id];
    if (window.appConfirm) {
      window.appConfirm("سيتم إخفاء الجدول الحالي، وأي أصناف غير محفوظة ستفقد.\nاحفظ مؤقتاً أولاً إن أردت الاحتفاظ بها. هل تريد المتابعة؟",
        { title: "تنبيه قبل التغيير", okText: "متابعة", cancelText: "بقاء", danger: true })
        .then(function (ok) {
          if (!ok) return;
          target.value = newVal;
          bypass[id] = true;
          target.dispatchEvent(new Event("change", { bubbles: true }));
        });
    }
  }, true);
})();
