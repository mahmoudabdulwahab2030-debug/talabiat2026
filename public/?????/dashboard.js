document.addEventListener('DOMContentLoaded', async () => {
  const totalProductsEl = document.getElementById('totalProducts');
  const inboundTodayEl = document.getElementById('inboundToday');
  const expiredCountEl = document.getElementById('expiredCount');
  const stockValueEl = document.getElementById('stockValue');

  // Simple live counts
  window.firebaseHelpers.onCollection('products', snapshot => {
    const count = snapshot.size;
    totalProductsEl.innerText = count;

    // approximate stock value: sum of (quantity * salePrice)
    let totalValue = 0;
    snapshot.forEach(d => {
      const data = d.data();
      totalValue += (Number(data.quantity) || 0) * (Number(data.salePrice) || 0);
    });
    stockValueEl.innerText = totalValue ? totalValue.toFixed(2) : '0.00';
  });

  // product cache for name lookup
  const productMap = {};
  window.firebaseHelpers.onCollection('products', snapshot => {
    snapshot.forEach(d => {
      productMap[d.id] = d.data();
    });

    // expiredCount calculation (depends on products)
    let expired = 0;
    snapshot.forEach(d => {
      const p = d.data();
      if (p.expiryDate) {
        const exp = new Date(p.expiryDate);
        if (exp < new Date()) expired += 1;
      }
    });
    expiredCountEl.innerText = expired;
  });

  // inbound today: sum quantities of movements with type == 'in' and today date
  try {
    const todayISO = new Date().toISOString().slice(0,10);
    const q = window.firebaseHelpers.collectionRef('movements').where('date', '>=', todayISO).where('date', '<=', todayISO + 'T23:59:59');
    q.onSnapshot(snapshot => {
      let inboundQty = 0;
      snapshot.forEach(d => {
        const m = d.data();
        if (m.type !== 'in') return;
        if (typeof m.qty === 'number') inboundQty += m.qty;
        else if (m.qty) inboundQty += Number(m.qty) || 0;
        else if (Array.isArray(m.items)) inboundQty += m.items.reduce((s,it)=> s + (Number(it.qty)||0), 0);
      });
      inboundTodayEl.innerText = inboundQty;
    });
  } catch (err) {
    // fallback to scanning all movements if query fails
    window.firebaseHelpers.onCollection('movements', snapshot => {
      const today = new Date().toISOString().slice(0,10);
      let inbound = 0;
      snapshot.forEach(d => {
        const m = d.data();
        if ((m.type === 'in') && m.date && m.date.slice(0,10) === today) {
          if (typeof m.qty === 'number') inbound += m.qty;
          else if (m.qty) inbound += Number(m.qty) || 0;
        }
      });
      inboundTodayEl.innerText = inbound;
    });
  }

  // recent movements (last 10)
  try {
    const movementsQuery = window.firebaseHelpers.collectionRef('movements').orderBy('date', 'desc').limit(10);
    movementsQuery.onSnapshot(snapshot => {
      const tbody = document.getElementById('recentMovements');
      if (!tbody) return;
      tbody.innerHTML = '';
      if (snapshot.empty) return tbody.innerHTML = '<tr><td colspan="4" class="text-muted">لا توجد تحركات بعد</td></tr>';
      snapshot.forEach(doc => {
        const m = doc.data();
        // allow admin to hide specific movements from dashboard with showOnDashboard=false
        if (m && m.showOnDashboard === false) return;
        const dateText = m.date ? new Date(m.date).toLocaleString() : '';
        const typeBadge = m.type === 'in' ? '<span class="badge bg-success">وارد</span>' : (m.type === 'out' ? '<span class="badge bg-danger">صادر</span>' : `<span class="badge bg-secondary">${m.type||''}</span>`);
        let productName = m.productName || m.name || '';
        if (m.productId && productMap[m.productId]) productName = productMap[m.productId].name || productName;
        // quantity
        let qty = '';
        if (typeof m.qty === 'number') qty = m.qty;
        else if (m.qty) qty = Number(m.qty) || m.qty;
        else if (Array.isArray(m.items)) qty = m.items.reduce((s,it) => s + (Number(it.qty)||0), 0);

        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${dateText}</td><td>${typeBadge}</td><td>${productName}</td><td>${qty}</td>`;
        tbody.appendChild(tr);
      });
    });
  } catch (err) {
    console.error('failed to listen to movements', err);
  }

  // Overview modal helpers: show table for cards
  const overviewModalEl = document.getElementById('overviewModal');
  const overviewModal = overviewModalEl ? new bootstrap.Modal(overviewModalEl) : null;
  const overviewTitle = document.getElementById('overviewModalTitle');
  const overviewSubtitle = document.getElementById('overviewSubtitle');
  const overviewHead = document.getElementById('overviewHead');
  const overviewBody = document.getElementById('overviewBody');
  const exportOverviewExcel = document.getElementById('exportOverviewExcel');
  const exportOverviewPdf = document.getElementById('exportOverviewPdf');
  const printOverview = document.getElementById('printOverview');

  function getOverviewTable() {
    const tbl = document.createElement('table'); tbl.className = 'table table-sm table-striped';
    tbl.innerHTML = '<thead>' + overviewHead.innerHTML + '</thead>' + '<tbody>' + overviewBody.innerHTML + '</tbody>';
    return tbl;
  }

  // Helper function to create print-friendly page
  function createPrintPage(title, table) {
    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) {
      alert('فشل فتح نافذة الطباعة');
      return null;
    }
    const doc = w.document;
    const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map(l => l.href);
    const styles = links.map(h => `<link rel="stylesheet" href="${h}">`).join('\n');
    
    const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  ${styles}
  <style>
    body { margin: 20px; direction: rtl; }
    .print-header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
    .print-header h2 { margin: 0; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: right; }
    th { background-color: #f2f2f2; font-weight: bold; }
    @media print {
      body { margin: 0; }
      .print-header { page-break-after: avoid; }
    }
  </style>
</head>
<body>
  <div class="print-header">
    <h2>${title}</h2>
    <p>تاريخ الطباعة: ${new Date().toLocaleString('ar-SA')}</p>
  </div>
  ${table.outerHTML}
</body>
</html>`;
    
    doc.open();
    doc.write(html);
    doc.close();
    w.focus();
    setTimeout(() => {
      w.print();
      setTimeout(() => w.close(), 200);
    }, 500);
    return w;
  }

  async function showOverview(kind) {
    overviewHead.innerHTML = '';
    overviewBody.innerHTML = '<tr><td colspan="6" class="text-muted">تحميل...</td></tr>';
    if (kind === 'products') {
      overviewTitle.innerText = 'قائمة الأصناف'; overviewSubtitle.innerText = 'عرض كامل للأصناف الموجودة في المخزون';
      const docs = await window.firebaseHelpers.getAll('products');
      if (!docs.length) { overviewBody.innerHTML = '<tr><td colspan="6" class="text-muted">لا توجد أصناف</td></tr>'; if (overviewModal) overviewModal.show(); return; }
      overviewHead.innerHTML = '<tr><th>الكود</th><th>الاسم</th><th class="text-center">الكمية</th><th>الوحدة</th><th>سعر بيع</th><th>موقع</th></tr>';
      overviewBody.innerHTML = '';
      docs.forEach(d => { const row = document.createElement('tr'); row.innerHTML = `<td>${d.barcode||''}</td><td>${d.name||''}</td><td class="text-center">${d.quantity||0}</td><td>${d.unit||''}</td><td>${(d.salePrice||0).toFixed(2)}</td><td>${d.location||''}</td>`; overviewBody.appendChild(row); });
      if (overviewModal) overviewModal.show(); return;
    }

    if (kind === 'inboundToday') {
      overviewTitle.innerText = 'حركات الوارد (اليوم)'; overviewSubtitle.innerText = 'قائمة الحركات الواردة لليوم';
      const todayISO = new Date().toISOString().slice(0,10);
      try {
        const q = window.firebaseHelpers.collectionRef('movements').where('date', '>=', todayISO).where('date', '<=', todayISO + 'T23:59:59');
        const snap = await q.get();
        const docs = snap.docs.map(s => s.data());
        if (!docs.length) { overviewBody.innerHTML = '<tr><td colspan="6" class="text-muted">لا توجد حركات وارد لليوم</td></tr>'; if (overviewModal) overviewModal.show(); return; }
        overviewHead.innerHTML = '<tr><th>التاريخ</th><th>الصنف</th><th>الكمية</th><th>ملاحظات</th></tr>';
        overviewBody.innerHTML = '';
        docs.forEach(m => {
          const dateText = m.date ? new Date(m.date).toLocaleString() : '';
          let productName = m.productName || m.name || '';
          if (m.productId && productMap[m.productId]) productName = productMap[m.productId].name || productName;
          const qty = (typeof m.qty === 'number') ? m.qty : (m.qty ? Number(m.qty)||m.qty : (Array.isArray(m.items)? m.items.reduce((s,it)=> s+(Number(it.qty)||0),0): ''));
          const tr = document.createElement('tr'); tr.innerHTML = `<td>${dateText}</td><td>${productName}</td><td class="text-center">${qty}</td><td>${m.note||''}</td>`; overviewBody.appendChild(tr);
        });
        if (overviewModal) overviewModal.show(); return;
      } catch (err) { console.error(err); }
    }

    if (kind === 'expired') {
      overviewTitle.innerText = 'أصناف منتهية'; overviewSubtitle.innerText = 'قائمة الأصناف التي انتهت صلاحيتها';
      const docs = await window.firebaseHelpers.getAll('products');
      const now = new Date(); const expired = docs.filter(d => d.expiryDate && new Date(d.expiryDate) < now);
      if (!expired.length) { overviewBody.innerHTML = '<tr><td colspan="6" class="text-muted">لا توجد أصناف منتهية</td></tr>'; if (overviewModal) overviewModal.show(); return; }
      overviewHead.innerHTML = '<tr><th>الكود</th><th>الاسم</th><th>تاريخ الانتهاء</th><th>أيام منذ الانتهاء</th></tr>';
      overviewBody.innerHTML = '';
      expired.forEach(d => {
        const exp = new Date(d.expiryDate);
        const days = Math.floor((now - exp)/(24*3600*1000));
        const tr = document.createElement('tr'); tr.innerHTML = `<td>${d.barcode||''}</td><td>${d.name||''}</td><td>${exp.toLocaleDateString()}</td><td class="text-center">${days}</td>`; overviewBody.appendChild(tr);
      });
      if (overviewModal) overviewModal.show(); return;
    }

    if (kind === 'stockValue') {
      overviewTitle.innerText = 'تفاصيل قيمة المخزون'; overviewSubtitle.innerText = 'قائمة الأصناف مع القيمة (كمية × سعر)';
      const docs = await window.firebaseHelpers.getAll('products');
      if (!docs.length) { overviewBody.innerHTML = '<tr><td colspan="6" class="text-muted">لا توجد أصناف</td></tr>'; if (overviewModal) overviewModal.show(); return; }
      const rows = docs.map(d => ({ barcode: d.barcode, name: d.name, qty: Number(d.quantity)||0, price: Number(d.salePrice)||0, subtotal: (Number(d.quantity)||0)*(Number(d.salePrice)||0) }));
      rows.sort((a,b)=> b.subtotal - a.subtotal);
      overviewHead.innerHTML = '<tr><th>الكود</th><th>الاسم</th><th class="text-end">الكمية</th><th class="text-end">سعر البيع</th><th class="text-end">الإجمالي</th></tr>';
      overviewBody.innerHTML = '';
      rows.forEach(r => { const tr = document.createElement('tr'); tr.innerHTML = `<td>${r.barcode||''}</td><td>${r.name||''}</td><td class="text-end">${r.qty}</td><td class="text-end">${r.price.toFixed(2)}</td><td class="text-end">${r.subtotal.toFixed(2)}</td>`; overviewBody.appendChild(tr); });
      if (overviewModal) overviewModal.show(); return;
    }
  }

  // wire card clicks
  const cTotal = document.getElementById('cardTotalProducts'); if (cTotal) cTotal.addEventListener('click', ()=> showOverview('products'));
  const cInbound = document.getElementById('cardInboundToday'); if (cInbound) cInbound.addEventListener('click', ()=> showOverview('inboundToday'));
  const cExpired = document.getElementById('cardExpiredCount'); if (cExpired) cExpired.addEventListener('click', ()=> showOverview('expired'));
  const cStock = document.getElementById('cardStockValue'); if (cStock) cStock.addEventListener('click', ()=> showOverview('stockValue'));

  // export/print for current modal (use window.exports when available)
  exportOverviewExcel && exportOverviewExcel.addEventListener('click', async () => {
    const tbl = getOverviewTable();
    if (window.exports && window.exports.exportTableToExcel) {
      try {
        exportOverviewExcel.disabled = true;
        await window.exports.exportTableToExcel(tbl, `تقرير_${overviewTitle.innerText}_${new Date().toISOString().slice(0,10)}.xlsx`);
      } catch (err) {
        console.error('Excel export failed:', err);
        alert('فشل تصدير الملف');
      } finally {
        exportOverviewExcel.disabled = false;
      }
    } else {
      alert('خاصية Excel غير متاحة');
    }
  });

  exportOverviewPdf && exportOverviewPdf.addEventListener('click', async () => {
    const tbl = getOverviewTable();
    if (window.exports && window.exports.exportElementToPDF) {
      try {
        exportOverviewPdf.disabled = true;
        const options = {
          margin: [15, 10, 15, 10],
          filename: `تقرير_${overviewTitle.innerText}_${new Date().toISOString().slice(0,10)}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, backgroundColor: '#ffffff' },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        await window.exports.exportElementToPDF(tbl, options.filename, options);
      } catch (err) {
        console.error('PDF export failed:', err);
        alert('فشل تصدير الملف');
      } finally {
        exportOverviewPdf.disabled = false;
      }
    } else {
      alert('خاصية PDF غير متاحة');
    }
  });

  printOverview && printOverview.addEventListener('click', () => {
    const tbl = getOverviewTable();
    const title = overviewTitle ? overviewTitle.innerText : 'تقرير';
    createPrintPage(title, tbl);
  });
});

// Handle recent movements table export/print
document.addEventListener('DOMContentLoaded', () => {
  const printRecentMovementsBtn = document.getElementById('printRecentMovements');
  const exportRecentMovementsPdfBtn = document.getElementById('exportRecentMovementsPdf');
  const exportRecentMovementsExcelBtn = document.getElementById('exportRecentMovementsExcel');

  if (printRecentMovementsBtn) {
    printRecentMovementsBtn.addEventListener('click', () => {
      const tbody = document.getElementById('recentMovements');
      if (!tbody || tbody.querySelectorAll('tr').length === 0) {
        alert('لا توجد بيانات للطباعة');
        return;
      }
      
      // Create table for printing
      const table = document.createElement('table');
      table.className = 'table table-sm table-striped';
      
      // Add headers
      const thead = document.createElement('thead');
      thead.innerHTML = '<tr><th>التاريخ</th><th>نوع العملية</th><th>اسم الصنف</th><th>الكمية</th></tr>';
      table.appendChild(thead);
      
      // Add body
      const newTbody = document.createElement('tbody');
      newTbody.innerHTML = tbody.innerHTML;
      table.appendChild(newTbody);
      
      const w = window.open('', '_blank', 'width=900,height=700');
      if (!w) {
        alert('فشل فتح نافذة الطباعة');
        return;
      }
      
      const doc = w.document;
      const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map(l => l.href);
      const styles = links.map(h => `<link rel="stylesheet" href="${h}">`).join('\n');
      
      const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>آخر التحركات</title>
  ${styles}
  <style>
    body { margin: 20px; direction: rtl; }
    .print-header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
    .print-header h2 { margin: 0; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: right; }
    th { background-color: #f2f2f2; font-weight: bold; }
    @media print {
      body { margin: 0; }
      .print-header { page-break-after: avoid; }
    }
  </style>
</head>
<body>
  <div class="print-header">
    <h2>آخر التحركات</h2>
    <p>تاريخ الطباعة: ${new Date().toLocaleString('ar-SA')}</p>
  </div>
  ${table.outerHTML}
</body>
</html>`;
      
      doc.open();
      doc.write(html);
      doc.close();
      w.focus();
      setTimeout(() => {
        w.print();
        setTimeout(() => w.close(), 200);
      }, 500);
    });
  }

  if (exportRecentMovementsPdfBtn) {
    exportRecentMovementsPdfBtn.addEventListener('click', async () => {
      const tbody = document.getElementById('recentMovements');
      if (!tbody || tbody.querySelectorAll('tr').length === 0) {
        alert('لا توجد بيانات للتصدير');
        return;
      }

      const table = document.createElement('table');
      table.className = 'table table-sm table-striped';
      const thead = document.createElement('thead');
      thead.innerHTML = '<tr><th>التاريخ</th><th>نوع العملية</th><th>اسم الصنف</th><th>الكمية</th></tr>';
      table.appendChild(thead);
      const newTbody = document.createElement('tbody');
      newTbody.innerHTML = tbody.innerHTML;
      table.appendChild(newTbody);

      if (window.html2pdf) {
        try {
          exportRecentMovementsPdfBtn.disabled = true;
          const opt = {
            margin: [15, 10, 15, 10],
            filename: `آخر_التحركات_${new Date().toISOString().slice(0,10)}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, backgroundColor: '#ffffff' },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
          };
          await html2pdf().set(opt).from(table).save();
        } catch (err) {
          console.error('PDF export failed:', err);
          alert('فشل تصدير الملف');
        } finally {
          exportRecentMovementsPdfBtn.disabled = false;
        }
      } else {
        alert('خاصية PDF غير متاحة');
      }
    });
  }

  if (exportRecentMovementsExcelBtn) {
    exportRecentMovementsExcelBtn.addEventListener('click', async () => {
      const tbody = document.getElementById('recentMovements');
      if (!tbody || tbody.querySelectorAll('tr').length === 0) {
        alert('لا توجد بيانات للتصدير');
        return;
      }

      const table = document.createElement('table');
      table.className = 'table table-sm table-striped';
      const thead = document.createElement('thead');
      thead.innerHTML = '<tr><th>التاريخ</th><th>نوع العملية</th><th>اسم الصنف</th><th>الكمية</th></tr>';
      table.appendChild(thead);
      const newTbody = document.createElement('tbody');
      newTbody.innerHTML = tbody.innerHTML;
      table.appendChild(newTbody);

      if (window.XLSX) {
        try {
          exportRecentMovementsExcelBtn.disabled = true;
          
          const rows = Array.from(table.querySelectorAll('tr'));
          const data = rows.map(r => Array.from(r.querySelectorAll('th,td')).map(td => td.innerText.trim()));
          
          const wb = XLSX.utils.book_new();
          const ws = XLSX.utils.aoa_to_sheet(data);
          
          const colWidths = Array(data[0].length).fill(20);
          ws['!cols'] = colWidths.map(w => ({ wch: w }));
          
          const headerRange = XLSX.utils.decode_range(ws['!ref']);
          for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
            const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
            if (!ws[cellAddress]) continue;
            ws[cellAddress].s = {
              font: { bold: true, color: { rgb: 'FFFFFF' } },
              fill: { fgColor: { rgb: '366092' } },
              alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
              border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }
            };
          }
          
          for (let row = 1; row < data.length; row++) {
            for (let col = 0; col < data[row].length; col++) {
              const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
              if (!ws[cellAddress]) continue;
              ws[cellAddress].s = {
                alignment: { horizontal: 'right', vertical: 'center', wrapText: true },
                border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } },
                fill: { fgColor: { rgb: row % 2 === 0 ? 'F0F0F0' : 'FFFFFF' } }
              };
            }
          }
          
          XLSX.utils.book_append_sheet(wb, ws, 'البيانات');
          XLSX.writeFile(wb, `آخر_التحركات_${new Date().toISOString().slice(0,10)}.xlsx`);
        } catch (err) {
          console.error('Excel export failed:', err);
          alert('فشل تصدير الملف');
        } finally {
          exportRecentMovementsExcelBtn.disabled = false;
        }
      } else {
        alert('خاصية Excel غير متاحة');
      }
    });
  }
});