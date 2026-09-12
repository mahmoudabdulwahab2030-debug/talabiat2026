document.addEventListener('DOMContentLoaded', () => {
  const runBtn = document.getElementById('runReportBtn');
  const reportType = document.getElementById('reportType');
  const reportFrom = document.getElementById('reportFrom');
  const reportTo = document.getElementById('reportTo');
  const resultEl = document.getElementById('reportResult');

  function showLoading() { resultEl.innerHTML = '<div class="text-center py-4">جاري التحميل...</div>'; }
  function showEmpty(msg = 'لا توجد نتائج') { resultEl.innerHTML = `<div class="text-muted py-3">${msg}</div>`; }

  async function runMovementReport(fromISO, toISO) {
    showLoading();
    try {
      const q = window.firebaseHelpers.collectionRef('movements').where('date', '>=', fromISO).where('date', '<=', toISO).orderBy('date', 'desc');
      const snapshot = await q.get();
      if (snapshot.empty) return showEmpty('لا توجد حركات في النطاق الزمني المحدد');
      let html = `<table class="table table-sm">
        <thead><tr><th>التاريخ</th><th>النوع</th><th>باركود</th><th>الصنف</th><th>كمية</th><th>سعر</th><th>مرجع</th></tr></thead><tbody>`;
      snapshot.forEach(doc => {
        const d = doc.data();
        html += `<tr><td>${d.date ? new Date(d.date).toLocaleString() : ''}</td><td>${d.type || ''}</td><td>${d.productBarcode || ''}</td><td>${d.productName || ''}</td><td>${d.qty || ''}</td><td>${d.price || ''}</td><td>${d.invoiceId || d.issueId || ''}</td></tr>`;
      });
      html += '</tbody></table>';
      resultEl.innerHTML = html;
    } catch (err) {
      console.error(err); showEmpty('حدث خطأ أثناء تشغيل التقرير');
    }
  }

  async function runUnderReorderReport() {
    showLoading();
    try {
      const snapshot = await window.firebaseHelpers.collectionRef('products').get();
      const rows = [];
      snapshot.forEach(doc => {
        const d = doc.data();
        const qty = Number(d.quantity) || 0;
        const reorder = Number(d.reorderLevel) || 0;
        if (qty <= reorder) rows.push({ id: doc.id, ...d });
      });
      if (!rows.length) return showEmpty('لا توجد أصناف تحت حد الطلب');
      let html = `<table class="table table-sm">
        <thead><tr><th>الصنف</th><th>الرصيد</th><th>حد إعادة الطلب</th><th>وحدة</th><th>الموقع</th></tr></thead><tbody>`;
      rows.forEach(r => html += `<tr><td>${r.name}</td><td>${r.quantity}</td><td>${r.reorderLevel || 0}</td><td>${r.unit || ''}</td><td>${r.location || ''}</td></tr>`);
      html += '</tbody></table>';
      resultEl.innerHTML = html;
    } catch (err) { console.error(err); showEmpty('حدث خطأ أثناء تشغيل التقرير'); }
  }

  async function runStockValueReport() {
    showLoading();
    try {
      const snapshot = await window.firebaseHelpers.collectionRef('products').get();
      const rows = [];
      let total = 0;
      snapshot.forEach(doc => {
        const d = doc.data();
        const qty = Number(d.quantity) || 0;
        const price = Number(d.salePrice) || 0;
        const value = qty * price;
        total += value;
        if (value > 0) rows.push({ name: d.name, qty, price, value });
      });
      if (!rows.length) return showEmpty('لا توجد قيمة مادية للمخازن');
      rows.sort((a,b) => b.value - a.value);
      let html = `<div class="mb-3"><strong>قيمة المخازن الإجمالية:</strong> ${total.toFixed(2)}</div>`;
      html += `<table class="table table-sm"><thead><tr><th>الصنف</th><th>الرصيد</th><th>سعر الوحدة</th><th>القيمة</th></tr></thead><tbody>`;
      rows.forEach(r => html += `<tr><td>${r.name}</td><td>${r.qty}</td><td>${r.price}</td><td>${r.value.toFixed(2)}</td></tr>`);
      html += '</tbody></table>';
      resultEl.innerHTML = html;
    } catch (err) { console.error(err); showEmpty('حدث خطأ أثناء تشغيل التقرير'); }
  }

  async function runSectionsBalanceReport() {
    showLoading();
    try {
      const snapshot = await window.firebaseHelpers.collectionRef('products').get();
      if (!snapshot || snapshot.empty) return showEmpty('لا توجد بيانات أصناف');
      const sectionTotals = {}; // sectionName -> total qty
      snapshot.forEach(doc => {
        const d = doc.data() || {};
        if (d.sectionBalances && typeof d.sectionBalances === 'object') {
          Object.keys(d.sectionBalances).forEach(s => {
            sectionTotals[s] = (sectionTotals[s] || 0) + (Number(d.sectionBalances[s]) || 0);
          });
        } else if (d.section) {
          sectionTotals[d.section] = (sectionTotals[d.section] || 0) + (Number(d.quantity) || 0);
        }
      });
      const rows = Object.keys(sectionTotals).map(k => ({ section: k, qty: sectionTotals[k] }));
      if (!rows.length) return showEmpty('لا توجد أرصدة للأقسام');
      let html = `<table class="table table-sm"><thead><tr><th>القسم</th><th>الكمية الإجمالية</th></tr></thead><tbody>`;
      rows.forEach(r => html += `<tr><td>${r.section}</td><td>${r.qty}</td></tr>`);
      html += '</tbody></table>';
      resultEl.innerHTML = html;
    } catch (err) { console.error(err); showEmpty('حدث خطأ أثناء تشغيل التقرير'); }
  }

  runBtn.addEventListener('click', () => {
    const type = reportType.value;
    const from = reportFrom.value ? new Date(reportFrom.value) : null;
    const to = reportTo.value ? new Date(reportTo.value) : null;
    const fromISO = from ? new Date(from.setHours(0,0,0,0)).toISOString() : '0000-01-01T00:00:00.000Z';
    const toISO = to ? new Date(to.setHours(23,59,59,999)).toISOString() : new Date().toISOString();

    if (type === 'movement') runMovementReport(fromISO, toISO);
    else if (type === 'under_reorder') runUnderReorderReport();
    else if (type === 'stock_value') runStockValueReport();
    else if (type === 'sections_balance') runSectionsBalanceReport();
  });

});