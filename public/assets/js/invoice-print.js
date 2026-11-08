/* طباعة الفاتورة: تُعرض في نافذة معزولة بتصميم احترافي ثم تُطبع (تعمل على الكمبيوتر والموبايل) */
(function (global) {
  var DEFAULT_SIG = {
    controllerName: "", controllerTitle: "كنترول مان",
    receiverName: "", receiverTitle: "المستلم",
    footerText: "يرجى الاستلام وإرجاع صورة موقعة من الفاتورة",
    defaultNotes: ""
  };

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function num(v) { var n = Number(v); return isNaN(n) ? 0 : n; }
  function fmtDate(d) {
    if (!d) return "—";
    var dt = new Date(d);
    return isNaN(dt) ? String(d) : dt.toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });
  }
  function branchLabel(id) {
    if (!id) return "—";
    try {
      var R = global.BranchRegistry;
      if (R) {
        var dyn = R.get(id);
        if (dyn && dyn.name) return "فرع " + dyn.name;
        var found = null;
        Object.keys(R.BUILTIN).forEach(function (k) {
          R.BUILTIN[k].forEach(function (b) { if (b.id === id) found = b; });
        });
        if (found) {
          var o = R.override(id);
          return "فرع " + ((o && o.name) || found.name);
        }
      }
    } catch (e) {}
    return String(id);
  }

  function loadSettings(db, brandKey) {
    var sig = Object.assign({}, DEFAULT_SIG);
    if (!db || !brandKey) return Promise.resolve(sig);
    return db.collection("settings").doc("invoice_" + brandKey).get().then(function (snap) {
      if (snap && snap.exists) Object.assign(sig, snap.data() || {});
      return sig;
    }).catch(function () { return sig; });
  }

  function askNotes(defaultNotes) {
    if (!global.Swal) return Promise.resolve(defaultNotes || "");
    return global.Swal.fire({
      title: "ملاحظات الفاتورة",
      input: "textarea",
      inputValue: defaultNotes || "",
      inputPlaceholder: "اكتب أي ملاحظات تظهر في الفاتورة (اختياري)",
      showCancelButton: true,
      confirmButtonText: "طباعة",
      cancelButtonText: "إلغاء"
    }).then(function (r) { return r.isConfirmed ? (r.value || "") : null; });
  }

  var CSS = [
    "@page{size:A4;margin:12mm}",
    "*{box-sizing:border-box}",
    "html,body{margin:0;padding:0;background:#fff;color:#1d1f24;font-family:'Cairo','Segoe UI',Tahoma,Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}",
    ".inv{padding:6mm 4mm}",
    ".inv-head{display:flex;justify-content:space-between;align-items:center;padding-bottom:12px;border-bottom:3px solid #b8862b}",
    ".brand-name{font-size:26px;font-weight:800;color:#14110a;letter-spacing:.5px}",
    ".brand-sub{font-size:12px;color:#8a6d2f;letter-spacing:2px;margin-top:2px}",
    ".inv-title{text-align:left}",
    ".t1{font-size:20px;font-weight:800;color:#14110a}",
    ".badge{display:inline-block;margin-top:6px;padding:4px 14px;border-radius:999px;background:#14110a;color:#f0c25e;font-weight:700;font-size:13px}",
    ".meta{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin:16px 0}",
    ".m{border:1px solid #e3d7bd;border-radius:8px;padding:8px 10px;background:#fbf8f1}",
    ".m span{display:block;font-size:11px;color:#8a6d2f;margin-bottom:3px}",
    ".m b{font-size:13px;color:#14110a}",
    "table{width:100%;border-collapse:collapse}",
    ".items{margin-top:6px}",
    ".items th{background:#14110a;color:#f0c25e;font-size:13px;padding:9px 8px;border:1px solid #14110a}",
    ".items td{border:1px solid #e3d7bd;padding:8px;font-size:13px;text-align:center}",
    ".items td.nm{text-align:right}",
    ".items tbody tr:nth-child(even){background:#fbf8f1}",
    ".items tfoot td{font-weight:800;background:#f3ead6;border:1px solid #d9c9a3;padding:9px}",
    ".empty{padding:18px;color:#8a8f99}",
    ".notes{margin-top:14px}",
    ".label{font-size:12px;font-weight:800;color:#8a6d2f;margin-bottom:4px}",
    ".box{min-height:56px;border:1px solid #e3d7bd;border-radius:8px;padding:10px;font-size:13px;white-space:pre-wrap;background:#fff}",
    ".sigs{display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-top:26px}",
    ".sig{text-align:center}",
    ".sig-title{font-size:14px;font-weight:800;color:#14110a}",
    ".sig-name{font-size:13px;color:#4b4f57;min-height:18px;margin-top:2px}",
    ".sig-line{height:46px;border-bottom:1.5px solid #14110a;margin:10px 16px 6px}",
    ".sig span{font-size:11px;color:#8a8f99}",
    ".inv-foot{display:flex;justify-content:space-between;margin-top:22px;padding-top:8px;border-top:1px solid #e3d7bd;font-size:11px;color:#6b7079}"
  ].join("\n");

  function buildHtml(invoice, brand, sig, notes) {
    var products = (invoice.products || []).filter(function (p) { return num(p.sentQuantity) > 0; });
    var totalReq = 0, totalSent = 0;
    var rows = products.map(function (p) {
      totalReq += num(p.requestedQuantity); totalSent += num(p.sentQuantity);
      return '<tr><td>' + esc(p.code) + '</td><td class="nm">' + esc(p.name) + '</td><td>' +
        num(p.requestedQuantity) + '</td><td>' + num(p.sentQuantity) + '</td></tr>';
    }).join("");
    if (!rows) rows = '<tr><td colspan="4" class="empty">لا توجد أصناف مرسلة في هذه الفاتورة</td></tr>';
    var sectionLabel = invoice.section === "all" ? "كل الأقسام" : (invoice.section || "—");
    var no = esc(invoice.invoiceNumber != null ? invoice.invoiceNumber : "—");

    return '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>فاتورة ' + no + '</title>' +
      '<link rel="stylesheet" href="' + location.origin + '/fonts/fonts.css"><style>' + CSS + '</style></head><body><div class="inv">' +
      '<header class="inv-head"><div><div class="brand-name">' + esc(brand.name) + '</div><div class="brand-sub">' + esc(brand.sub || "") + '</div></div>' +
      '<div class="inv-title"><div class="t1">فاتورة طلبية</div><span class="badge">رقم ' + no + '</span></div></header>' +
      '<section class="meta">' +
      '<div class="m"><span>رقم الفاتورة</span><b>' + no + '</b></div>' +
      '<div class="m"><span>البراند</span><b>' + esc(brand.name) + '</b></div>' +
      '<div class="m"><span>تاريخ الفاتورة</span><b>' + esc(fmtDate(invoice.orderDate)) + '</b></div>' +
      '<div class="m"><span>الفرع</span><b>' + esc(branchLabel(invoice.branch)) + '</b></div>' +
      '<div class="m"><span>القسم</span><b>' + esc(sectionLabel) + '</b></div>' +
      '</section>' +
      '<table class="items"><thead><tr><th>كود الصنف</th><th>المنتج</th><th>المطلوب</th><th>المرسل</th></tr></thead>' +
      '<tbody>' + rows + '</tbody>' +
      '<tfoot><tr><td colspan="2">الإجمالي</td><td>' + totalReq + '</td><td>' + totalSent + '</td></tr></tfoot></table>' +
      '<section class="notes"><div class="label">ملاحظات</div><div class="box">' + esc(notes) + '</div></section>' +
      '<section class="sigs">' +
      '<div class="sig"><div class="sig-title">' + esc(sig.controllerTitle) + '</div><div class="sig-name">' + esc(sig.controllerName) + '</div><div class="sig-line"></div><span>التوقيع</span></div>' +
      '<div class="sig"><div class="sig-title">' + esc(sig.receiverTitle) + '</div><div class="sig-name">' + esc(sig.receiverName) + '</div><div class="sig-line"></div><span>التوقيع</span></div>' +
      '</section>' +
      '<footer class="inv-foot"><span>' + esc(sig.footerText) + '</span><span>تاريخ الطباعة: ' + esc(new Date().toLocaleString("ar-EG")) + '</span></footer>' +
      '</div></body></html>';
  }

  function printHtml(html) {
    var frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
    document.body.appendChild(frame);
    var doc = frame.contentWindow.document;
    doc.open(); doc.write(html); doc.close();
    var go = function () {
      try {
        frame.contentWindow.focus();
        frame.contentWindow.print();
      } catch (e) { console.error("print failed", e); }
      setTimeout(function () { frame.remove(); }, 2000);
    };
    // انتظر تحميل الخط والمحتوى قبل الطباعة
    setTimeout(go, 500);
  }

  function print(invoice, opts) {
    opts = opts || {};
    var brand = { name: opts.brandName || "", sub: opts.brandSub || "" };
    return loadSettings(opts.db, opts.brandKey).then(function (sig) {
      return askNotes(sig.defaultNotes).then(function (notes) {
        if (notes === null) return; // أُلغيت الطباعة
        printHtml(buildHtml(invoice || {}, brand, sig, notes));
      });
    });
  }

  global.InvoicePrint = { print: print, buildHtml: buildHtml, DEFAULT_SIG: DEFAULT_SIG };
})(window);
