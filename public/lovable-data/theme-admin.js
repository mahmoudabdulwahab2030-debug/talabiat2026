/* محرر الثيم في إدارة المستخدمين */
(function () {
  "use strict";
  var FIELDS = [
    ["primary", "اللون الأساسي (أحمر غامق)", "color"], ["primary2", "اللون الأساسي الفاتح", "color"], ["accent", "لون التمييز", "color"],
    ["bg", "الخلفية العلوية", "color"], ["bg2", "الخلفية السفلية", "color"], ["surface", "لون الكروت الزجاجية", "color"], ["text", "لون النص", "color"],
    ["glass", "عتامة الزجاج", "range", 0.15, 1, 0.05], ["blur", "قوة الضبابية (px)", "range", 0, 30, 1],
    ["radius", "استدارة الحواف (px)", "range", 0, 28, 1], ["scale", "حجم الخط", "range", 0.85, 1.2, 0.05]
  ];
  function form(t) {
    var p = LTheme.PRESETS;
    var h = '<div style="text-align:right;direction:rtl"><div style="font-weight:800;margin-bottom:6px">🎨 القوالب الجاهزة</div><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px;margin-bottom:14px">';
    Object.keys(p).forEach(function (k) {
      var x = p[k];
      h += '<button type="button" class="t-preset" data-k="' + k + '" style="cursor:pointer;padding:10px;border-radius:12px;border:1px solid rgba(255,255,255,.15);background:linear-gradient(135deg,' + x.bg + ',' + x.surface + ');color:' + x.text + ';font:inherit;font-size:13px">' +
        '<span style="display:flex;gap:4px;justify-content:center;margin-bottom:6px"><i style="width:16px;height:16px;border-radius:50%;background:' + x.primary + '"></i><i style="width:16px;height:16px;border-radius:50%;background:' + x.primary2 + '"></i><i style="width:16px;height:16px;border-radius:50%;background:' + x.accent + '"></i></span>' + x.name + "</button>";
    });
    h += '</div><div style="font-weight:800;margin-bottom:6px">🛠️ تخصيص يدوي</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 12px">';
    FIELDS.forEach(function (f) {
      var v = t[f[0]];
      h += '<label style="display:flex;flex-direction:column;gap:4px;font-size:13px">' + f[1] +
        (f[2] === "color" ? '<input type="color" data-f="' + f[0] + '" value="' + v + '" style="width:100%;height:36px;border:none;border-radius:8px;background:none">'
          : '<span style="display:flex;gap:6px;align-items:center"><input type="range" data-f="' + f[0] + '" min="' + f[3] + '" max="' + f[4] + '" step="' + f[5] + '" value="' + v + '" style="flex:1"><output>' + v + "</output></span>") + "</label>";
    });
    h += '<label style="grid-column:1/-1;display:flex;gap:8px;align-items:center;font-size:13px"><input type="checkbox" data-f="motion" ' + (t.motion ? "checked" : "") + "> تفعيل الحركة والأنيميشن</label></div>" +
      '<p style="font-size:12px;opacity:.7;margin-top:10px">التغييرات تظهر فورًا للمعاينة، وتُطبق على كل الصفحات وكل المستخدمين بعد الحفظ. ورقة الطباعة لا تتأثر.</p></div>';
    return h;
  }
  function read(el, base) {
    var t = Object.assign({}, base);
    el.querySelectorAll("[data-f]").forEach(function (i) { var k = i.dataset.f; t[k] = i.type === "checkbox" ? i.checked : i.type === "range" ? parseFloat(i.value) : i.value; });
    return t;
  }
  function open() {
    var original = LTheme.current(), t = Object.assign({}, original);
    Swal.fire({
      title: "🎨 التحكم في الثيم والألوان", width: 720, html: form(t), showCancelButton: true, showDenyButton: true,
      confirmButtonText: "💾 حفظ للجميع", denyButtonText: "↺ استعادة الافتراضي", cancelButtonText: "إلغاء",
      didOpen: function (pop) {
        var c = pop.querySelector(".swal2-html-container");
        c.addEventListener("input", function (e) { var o = e.target.parentNode.querySelector("output"); if (o) o.textContent = e.target.value; t = read(c, t); LTheme.apply(t); });
        c.addEventListener("change", function () { t = read(c, t); LTheme.apply(t); });
        c.querySelectorAll(".t-preset").forEach(function (b) { b.onclick = function () { t = Object.assign({}, LTheme.PRESETS[b.dataset.k]); LTheme.apply(t); c.innerHTML = form(t).replace(/^<div[^>]*>|<\/div>$/g, ""); c.querySelectorAll(".t-preset").forEach(function (x) { x.onclick = b.onclick.bind(x); }); }; });
      }
    }).then(async function (r) {
      try {
        if (r.isConfirmed) { await LTheme.save(t); Swal.fire({ icon: "success", title: "تم حفظ الثيم", timer: 1400, showConfirmButton: false }); }
        else if (r.isDenied) { await LTheme.reset(); Swal.fire({ icon: "success", title: "تمت استعادة الثيم الافتراضي", timer: 1400, showConfirmButton: false }); }
        else LTheme.apply(original);
      } catch (e) { Swal.fire("خطأ", "تعذر حفظ الثيم في قاعدة البيانات، تم حفظه على هذا الجهاز فقط", "warning"); }
    });
  }
  window.openThemeEditor = open;
})();
