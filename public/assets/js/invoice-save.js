/* حفظ الفواتير: فاتورة لكل قسم + فاتورة شاملة مرتبطة بها دائماً (لا تكرار ولا تعارض أرقام) */
(function (global) {
  var COL = "invoices", CTR = "counters";

  function sectionDocId(branch, orderDate, section) { return branch + "_" + orderDate + "_" + section; }

  // ترقيم عام متسلسل بمعاملة (Transaction) لمنع تكرار الرقم عند الحفظ من أكثر من جهاز
  async function maxInvoiceNumber(db) {
    var snap = await db.collection(COL).get();
    var m = 0;
    snap.forEach(function (d) { var n = Number((d.data() || {}).invoiceNumber) || 0; if (n > m) m = n; });
    return m;
  }
  async function nextNumber(db) {
    var ref = db.collection(CTR).doc("invoices");
    var first = await ref.get();
    var base = first.exists ? 0 : await maxInvoiceNumber(db);
    return db.runTransaction(async function (tx) {
      var c = await tx.get(ref);
      var cur = c.exists ? (Number((c.data() || {}).value) || 0) : base;
      var next = Math.max(cur, base) + 1;
      tx.set(ref, { value: next });
      return next;
    });
  }

  // قراءة صفوف الجدول بشكل موحد (تُعيد القسم لكل صف)
  function readRows(tbody, fallbackSection) {
    return Array.from(tbody.querySelectorAll("tr")).filter(function (r) { return !!r.querySelector(".sent-qty"); }).map(function (row) {
      var cells = row.querySelectorAll("td");
      var val = function (i) {
        var c = cells[i]; if (!c) return "";
        var f = c.querySelector("input,select,textarea");
        return f ? String(f.value).trim() : c.textContent.trim();
      };
      var reqEl = row.querySelector(".requested-qty");
      var sentEl = row.querySelector(".sent-qty");
      return {
        sheet: String(row.dataset.sheet || fallbackSection || "غير محدد").trim(),
        code: val(0),
        name: val(1),
        requestedQuantity: parseFloat(reqEl ? reqEl.value : val(2)) || 0,
        sentQuantity: parseFloat(sentEl ? sentEl.value : 0) || 0
      };
    });
  }

  function diffs(products) {
    var shortages = [], excesses = [];
    products.forEach(function (p) {
      var d = (Number(p.sentQuantity) || 0) - (Number(p.requestedQuantity) || 0);
      if (d < 0) shortages.push({ code: p.code, name: p.name, sheet: p.sheet, qty: Math.abs(d) });
      else if (d > 0) excesses.push({ code: p.code, name: p.name, sheet: p.sheet, qty: d });
    });
    return { shortages: shortages, excesses: excesses };
  }

  function clean(p, section) {
    return { code: p.code, name: p.name, sheet: p.sheet || section, requestedQuantity: p.requestedQuantity, sentQuantity: p.sentQuantity };
  }

  async function upsertSection(db, ctx, section, products, existedSet) {
    var docId = sectionDocId(ctx.branch, ctx.orderDate, section);
    var ref = db.collection(COL).doc(docId);
    var snap = await ref.get();
    if (snap.exists) existedSet.push(section);
    var old = snap.exists ? (snap.data() || {}) : null;
    var number = old && old.invoiceNumber != null ? old.invoiceNumber : await nextNumber(db);
    var now = new Date().toISOString();
    var list = products.map(function (p) { return clean(p, section); });
    var data = Object.assign({
      branch: ctx.branch, orderDate: ctx.orderDate, section: section, brandKey: ctx.brandKey,
      invoiceNumber: number, products: list, createdAt: old ? old.createdAt : now, updatedAt: now
    }, diffs(list));
    await ref.set(data);
    return { docId: docId, invoice: data };
  }

  // الفاتورة الشاملة = اتحاد كل فواتير الأقسام لنفس الفرع والتاريخ (تُحدَّث دائماً بعد أي حفظ)
  async function rebuildAggregate(db, branch, orderDate, brandKey) {
    var docId = sectionDocId(branch, orderDate, "all");
    var ref = db.collection(COL).doc(docId);
    var snap = await db.collection(COL).where("branch", "==", branch).where("orderDate", "==", orderDate).get();
    var parts = [];
    snap.forEach(function (d) { var x = d.data() || {}; if (x.section && x.section !== "all") parts.push(x); });
    if (!parts.length) { try { await ref.delete(); } catch (e) {} return null; }
    parts.sort(function (a, b) { return String(a.section).localeCompare(String(b.section)); });
    var products = [], shortages = [], excesses = [];
    parts.forEach(function (x) {
      (x.products || []).forEach(function (p) { products.push(clean(p, x.section)); });
      (x.shortages || []).forEach(function (s) { shortages.push(s); });
      (x.excesses || []).forEach(function (s) { excesses.push(s); });
    });
    var prev = await ref.get();
    var pv = prev.exists ? (prev.data() || {}) : null;
    var now = new Date().toISOString();
    var number = pv && pv.invoiceNumber != null ? pv.invoiceNumber : await nextNumber(db);
    var data = {
      branch: branch, orderDate: orderDate, section: "all", brandKey: brandKey,
      sections: parts.map(function (x) { return x.section; }),
      invoiceNumber: number, products: products, shortages: shortages, excesses: excesses,
      createdAt: pv ? pv.createdAt : now, updatedAt: now
    };
    await ref.set(data);
    return { docId: docId, invoice: data };
  }

  // الحفظ الموحد: section = "all" يحفظ كل الأقسام ثم الشاملة، وغيره يحفظ القسم ثم يحدّث الشاملة
  async function send(db, opts) {
    var ctx = { branch: opts.branch, orderDate: opts.orderDate, brandKey: opts.brandKey };
    var groups = {};
    if (opts.section === "all") {
      opts.products.forEach(function (p) {
        var k = p.sheet || "غير محدد";
        (groups[k] = groups[k] || []).push(p);
      });
    } else {
      groups[opts.section] = opts.products;
    }
    // تحقق مسبق: هل توجد فواتير محفوظة لهذه الأقسام؟
    var existing = [];
    for (var sec of Object.keys(groups)) {
      var s = await db.collection(COL).doc(sectionDocId(ctx.branch, ctx.orderDate, sec)).get();
      if (s.exists) existing.push(sec);
    }
    if (existing.length && opts.confirm) {
      var ok = await opts.confirm(existing);
      if (!ok) return null;
    }
    var existedSet = [];
    var sections = [];
    for (var name of Object.keys(groups)) {
      sections.push(await upsertSection(db, ctx, name, groups[name], existedSet));
    }
    var aggregate = await rebuildAggregate(db, ctx.branch, ctx.orderDate, ctx.brandKey);
    var primary = opts.section === "all" && aggregate ? aggregate.invoice : (sections[0] || {}).invoice;
    return { sections: sections, aggregate: aggregate, primary: primary, existed: existedSet };
  }

  global.InvoiceSave = { send: send, readRows: readRows, rebuildAggregate: rebuildAggregate, sectionDocId: sectionDocId };
})(window);
