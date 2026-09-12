// exports.js — shared export/print utilities (client-side)
(function(){
  function ensureScript(url, globalName) {
    return new Promise((resolve, reject) => {
      if (globalName && window[globalName]) return resolve(window[globalName]);
      const existing = Array.from(document.scripts).find(s => s.src && s.src.indexOf(url) !== -1);
      if (existing) {
        existing.addEventListener('load', () => resolve(window[globalName]));
        existing.addEventListener('error', reject);
        return;
      }
      const s = document.createElement('script'); s.src = url; s.async = true;
      s.onload = () => resolve(globalName ? window[globalName] : true);
      s.onerror = reject;
      document.body.appendChild(s);
    });
  }

  async function ensureSheet() {
    return ensureScript('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js','XLSX');
  }
  async function ensureHtml2pdf() {
    return ensureScript('https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.9.3/html2pdf.bundle.min.js','html2pdf');
  }

  // wait for a global variable to appear (polling) with timeout
  function waitForGlobal(name, timeout = 4000) {
    return new Promise((resolve, reject) => {
      if (window[name]) return resolve(window[name]);
      const start = Date.now();
      const iv = setInterval(() => {
        if (window[name]) { clearInterval(iv); return resolve(window[name]); }
        if (Date.now() - start > timeout) { clearInterval(iv); return reject(new Error(name + ' not available')); }
      }, 50);
    });
  }

  // try loading XLSX from several CDNs and detect various global shapes
  async function tryEnsureXLSX() {
    // quick checks
    if (window.XLSX && window.XLSX.utils && typeof window.XLSX.utils.book_new === 'function') return window.XLSX;
    if (window.XLSX && window.XLSX.default && window.XLSX.default.utils && typeof window.XLSX.default.utils.book_new === 'function') return window.XLSX.default;
    if (window.XLS && window.XLS.utils && typeof window.XLS.utils.book_new === 'function') return window.XLS;

    const candidates = [
      'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
      'https://unpkg.com/xlsx@0.18.5/dist/xlsx.full.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
    ];

    for (const url of candidates) {
      try {
        console.debug('exports: attempting load XLSX from', url);
        await ensureScript(url, 'XLSX');
        try { await waitForGlobal('XLSX', 3000); } catch(e) { /* keep going */ }
        if (window.XLSX && window.XLSX.utils && typeof window.XLSX.utils.book_new === 'function') return window.XLSX;
        if (window.XLSX && window.XLSX.default && window.XLSX.default.utils && typeof window.XLSX.default.utils.book_new === 'function') return window.XLSX.default;
      } catch (err) {
        console.warn('exports: failed loading xlsx from', url, err);
      }
    }

    // final check
    if (window.XLS && window.XLS.utils && typeof window.XLS.utils.book_new === 'function') return window.XLS;

    console.warn('exports: XLSX not found after trying candidates. Scripts present:', Array.from(document.scripts).filter(s=>s.src && s.src.toLowerCase().includes('xlsx')).map(s=>s.src));
    return null;
  }

  function tableToCSV(table) {
    const rows = Array.from(table.querySelectorAll('tr'));
    const data = rows.map(r => Array.from(r.querySelectorAll('th,td')).map(td => td.innerText.replace(/\n+/g,' ').trim()));
    return data.map(cols => cols.map(c => '"' + (c||'').replace(/"/g,'""') + '"').join(',')).join('\n');
  }

  function exportTableToCSV(table, filename = 'export.csv') {
    const csv = '\uFEFF' + tableToCSV(table); // add BOM for Excel
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
  }

  async function exportTableToExcel(table, filename = 'export.xlsx') {
    // try to ensure sheet lib (may add script tag if missing)
    await ensureSheet();
    try {
      const XL = await tryEnsureXLSX();
      if (!XL) {
        console.warn('exports: XLSX library not available — falling back to CSV export');
        // fallback: export as CSV so user still gets data
        try { exportTableToCSV(table, filename.replace(/\.xlsx?$/i, '.csv')); } catch(e) { console.error('CSV fallback failed', e); }
        return;
      }

      const rows = Array.from(table.querySelectorAll('tr'));
      const data = rows.map(r => Array.from(r.querySelectorAll('th,td')).map(td => td.innerText.trim()));

      const wb = XL.utils.book_new();
      const ws = XL.utils.aoa_to_sheet(data);

      // تنسيق الخلايا والأعمدة
      const colWidths = Array(data[0].length).fill(20);
      ws['!cols'] = colWidths.map(w => ({ wch: w }));

      // تنسيق الرأس
      const headerRange = XL.utils.decode_range(ws['!ref']);
      for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
        const cellAddress = XL.utils.encode_cell({ r: 0, c: col });
        if (!ws[cellAddress]) continue;
        ws[cellAddress].s = {
          font: { bold: true, color: { rgb: 'FFFFFF' } },
          fill: { fgColor: { rgb: '366092' } },
          alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
          border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }
        };
      }

      // تنسيق البيانات
      for (let row = 1; row < data.length; row++) {
        for (let col = 0; col < data[row].length; col++) {
          const cellAddress = XL.utils.encode_cell({ r: row, c: col });
          if (!ws[cellAddress]) continue;
          ws[cellAddress].s = {
            alignment: { horizontal: 'right', vertical: 'center', wrapText: true },
            border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } },
            fill: { fgColor: { rgb: row % 2 === 0 ? 'F0F0F0' : 'FFFFFF' } }
          };
        }
      }

      XL.utils.book_append_sheet(wb, ws, 'البيانات');
      if (typeof XL.writeFile === 'function') XL.writeFile(wb, filename);
      else if (typeof XL.utils.writeFile === 'function') XL.utils.writeFile(wb, filename);
      else throw new Error('دالة حفظ ملف Excel غير متاحة في المكتبة');
    } catch (err) {
      console.error('exportTableToExcel Error:', err);
      try { if (window && window.alert) window.alert('فشل تصدير ملف Excel: ' + (err && err.message ? err.message : err)); } catch(e){}
      throw err;
    }
  }

  async function exportElementToPDF(element, filename = 'export.pdf', options = {}) {
    await ensureHtml2pdf();
    try { await waitForGlobal('html2pdf', 5000); } catch(e) { /* continue and let html2pdf call fail with clearer error */ }
    const opt = Object.assign({ margin: 10, filename, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } }, options);
    try {
      await html2pdf().set(opt).from(element).save();
    } catch (err) { console.error('exportElementToPDF', err); throw err; }
  }

  // Helpers that replicate the manual dashboard button behaviors
  function _buildPrintableWrapper(element, title) {
    const wrapper = document.createElement('div');
    const header = document.createElement('div'); header.className = 'print-header';
    const h2 = document.createElement('h2'); h2.innerText = title || document.title || '';
    const p = document.createElement('p'); p.innerText = `تاريخ الطباعة: ${new Date().toLocaleString('ar-SA')}`;
    header.appendChild(h2); header.appendChild(p);
    wrapper.appendChild(header);
    const cloned = element.cloneNode(true);
    // remove interactive elements in clone
    try { cloned.querySelectorAll && cloned.querySelectorAll('button,input,select,textarea,.btn').forEach(n => n.remove()); } catch(e){}
    wrapper.appendChild(cloned);
    return wrapper;
  }

  function printTableLikeDashboard(element, title) {
    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) { try { if (window && window.alert) window.alert('فشل فتح نافذة الطباعة'); } catch(e){}; return; }
    const doc = w.document;
    const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map(l => l.href);
    const styles = links.map(h => `<link rel="stylesheet" href="${h}">`).join('\n');
    const wrapper = _buildPrintableWrapper(element, title);
    const html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${title||''}</title>${styles}<style>body{margin:20px;direction:rtl}.print-header{text-align:center;margin-bottom:20px;border-bottom:2px solid #000;padding-bottom:10px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px;text-align:right}th{background:#f2f2f2;font-weight:bold}@media print{body{-webkit-print-color-adjust:exact;margin:0}.print-header{page-break-after:avoid}}</style></head><body>${wrapper.outerHTML}</body></html>`;
    doc.open(); doc.write(html); doc.close(); w.focus(); setTimeout(()=>{ w.print(); setTimeout(()=>w.close(),200); }, 500);
  }

  async function exportTablePdfLikeDashboard(element, filename) {
    await ensureHtml2pdf();
    const wrapper = _buildPrintableWrapper(element, filename.replace(/\.[^.]+$/, '').replace(/_/g,' '));
    const opt = {
      margin: [15,10,15,10],
      filename: filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, backgroundColor: '#ffffff' },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    try {
      await html2pdf().set(opt).from(wrapper).save();
    } catch (err) { console.error('exportTablePdfLikeDashboard', err); throw err; }
  }

  function printElement(element, title) {
    const w = window.open('', '_blank', 'noopener,width=900,height=700');
    if (!w) {
      try {
        if (typeof showAlert === 'function') showAlert('فشل فتح نافذة الطباعة', 'danger');
        else if (window && window.alert) window.alert('فشل فتح نافذة الطباعة');
      } catch(e) { console.warn('alert failed', e); }
      return;
    }
    const doc = w.document;
    doc.open();
    // include same stylesheet(s)
    const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map(l => l.href);
    const styles = links.map(h => `<link rel="stylesheet" href="${h}">`).join('\n');
    const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <title>${title||''}</title>
  ${styles}
  <style>
    body { margin: 20px; direction: rtl; }
    .print-header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
    .print-header h2 { margin: 0; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: right; }
    th { background-color: #f2f2f2; font-weight: bold; }
    @media print { 
      body { -webkit-print-color-adjust: exact; margin: 0; }
      .print-header { page-break-after: avoid; }
    }
  </style>
</head>
<body>
  <div class="print-header">
    <h2>${title}</h2>
    <p>تاريخ الطباعة: ${new Date().toLocaleString('ar-SA')}</p>
  </div>
  ${element.outerHTML}
</body>
</html>`;
    doc.write(html);
    doc.close();
    w.focus();
    setTimeout(()=>{ w.print(); setTimeout(()=>w.close(), 200); }, 500);
  }

  function createToolbarForTable(table) {
    const wrapper = document.createElement('div'); wrapper.className = 'export-toolbar d-flex gap-2 mb-2';
    wrapper.style.justifyContent = 'flex-start';
    const btnPrint = document.createElement('button'); btnPrint.className = 'btn btn-sm btn-outline-secondary'; btnPrint.innerHTML = '<i class="bi bi-printer"></i> طباعة';
    const btnPdf = document.createElement('button'); btnPdf.className = 'btn btn-sm btn-outline-primary'; btnPdf.innerHTML = '<i class="bi bi-file-earmark-pdf"></i> PDF';
    const btnExcel = document.createElement('button'); btnExcel.className = 'btn btn-sm btn-outline-success'; btnExcel.innerHTML = '<i class="bi bi-file-earmark-spreadsheet"></i> Excel';

    function deriveTitle(t) {
      if (!t) return document.title || 'تقرير';
      if (t.dataset && t.dataset.exportTitle) return t.dataset.exportTitle.trim();
      const card = t.closest('.card');
      if (card) {
        const hdr = card.querySelector('.card-header strong') || card.querySelector('.card-header');
        if (hdr && hdr.innerText && hdr.innerText.trim()) return hdr.innerText.trim();
      }
      const cap = t.querySelector('caption');
      if (cap && cap.innerText && cap.innerText.trim()) return cap.innerText.trim();
      return document.title || 'تقرير';
    }

    function makeSafeFilename(s) {
      const base = (s || '').replace(/\s+/g,'_').replace(/[^\w\-\u0600-\u06FF_]/g,'');
      return base || 'report';
    }

    const elementForExport = () => table.closest('.table-responsive') ? table.closest('.table-responsive') : table;

    // attempt to find manual control buttons in the same card/modal to reuse their handlers
    function findManualButtons(t) {
      const container = t.closest('.card') || t.closest('.modal') || t.closest('.table-responsive') || t.parentElement || document.body;
      if (!container) return {};
      const manualPrint = container.querySelector('button[id^="print"]');
      const manualPdf = container.querySelector('button[id*="Pdf"], button[id*="pdf"]');
      const manualExcel = container.querySelector('button[id*="Excel"], button[id*="excel"]');
      return { manualPrint, manualPdf, manualExcel };
    }

    const manual = findManualButtons(table);

    // Use the same implementations as the manual dashboard buttons (printTableLikeDashboard, exportTablePdfLikeDashboard, exportTableToExcel)
    btnPrint.addEventListener('click', () => {
      const title = deriveTitle(table);
      printTableLikeDashboard(elementForExport(), title);
    });

    btnPdf.addEventListener('click', async () => {
      btnPdf.disabled = true;
      try {
        const title = deriveTitle(table);
        const base = makeSafeFilename(title);
        const filename = `تقرير_${base}_${new Date().toISOString().slice(0,10)}.pdf`;
        await exportTablePdfLikeDashboard(elementForExport(), filename);
      } catch (err) {
        console.error('auto PDF export failed', err);
        try { if (window && window.alert) window.alert('فشل تصدير الملف'); } catch(e){}
      } finally { btnPdf.disabled = false; }
    });

    btnExcel.addEventListener('click', async () => {
      btnExcel.disabled = true;
      try {
        const title = deriveTitle(table);
        const base = makeSafeFilename(title);
        const filename = `تقرير_${base}_${new Date().toISOString().slice(0,10)}.xlsx`;
        await exportTableToExcel(table, filename);
      } catch (err) {
        console.error('auto Excel export failed', err);
        try { if (window && window.alert) window.alert('فشل تصدير الملف'); } catch(e){}
      } finally { btnExcel.disabled = false; }
    });

    wrapper.appendChild(btnPrint); wrapper.appendChild(btnPdf); wrapper.appendChild(btnExcel);
    return wrapper;
  }

  function autoAttachExportToolbar(selector = '.exportable-table') {
    const attachToolbarToTable = (t) => {
      if (!t || t.__hasExportToolbar) return;
      // if this table has nearby manual export buttons, prefer them and do not create an auto toolbar
      try {
        const container = t.closest('.card') || t.closest('.modal') || t.closest('.table-responsive') || t.parentElement || document.body;
        if (container) {
          const hasManual = !!(container.querySelector('button[id^="print"], button[id*="print"], button[id*="export"], button[id*="Pdf"], button[id*="pdf"], button[id*="Excel"], button[id*="excel"]'));
          if (hasManual) { t.__hasExportToolbar = true; return; }
        }
      } catch (e) { /* ignore and proceed to attach toolbar */ }

      const parent = t.parentElement || t.closest('.table-responsive') || document.body;
      const toolbar = createToolbarForTable(t);
      parent.insertBefore(toolbar, t);
      t.__hasExportToolbar = true;
    };

    const tables = Array.from(document.querySelectorAll(selector));
    tables.forEach(attachToolbarToTable);

    // observe DOM for tables added later (works for pages that load data asynchronously)
    if (!window.__exportsObserverInitialized) {
      try {
        const mo = new MutationObserver(mutations => {
          for (const m of mutations) {
            for (const node of m.addedNodes) {
              if (node.nodeType !== 1) continue;
              if (node.matches && node.matches(selector)) attachToolbarToTable(node);
              const nested = node.querySelectorAll && node.querySelectorAll(selector);
              if (nested && nested.length) nested.forEach(attachToolbarToTable);
            }
          }
        });
        mo.observe(document.body, { childList: true, subtree: true });
        window.__exportsObserverInitialized = true;
        window.__exportsObserver = mo;
      } catch (e) {
        console.warn('exports: observer init failed', e);
      }
    }
  }

  // auto-init on DOM ready so pages that don't explicitly call autoAttach still get toolbars
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { try { autoAttachExportToolbar(); } catch(e){} });
  } else {
    try { autoAttachExportToolbar(); } catch(e){}
  }

  // Bind manual Excel-like buttons across the project to export the nearest table.
  function bindManualExcelButtons() {
    try {
      const candidates = Array.from(document.querySelectorAll('button, a'));
      candidates.forEach(el => {
        if (el.__exportsBound) return;
        const icon = el.querySelector && (el.querySelector('i.bi-file-earmark-spreadsheet') || el.querySelector('i.bi-file-earmark-excel') || el.querySelector('i.bi-file-earmark-excel-fill'));
        const txt = (el.textContent || '').trim().toLowerCase();
        if (!icon && !(/excel|اكسيل|اكسل/.test(txt))) return;
        el.addEventListener('click', async (ev) => {
          try {
            ev && ev.preventDefault();
            // prefer table inside same card/modal/table-responsive
            const container = el.closest('.card') || el.closest('.modal') || el.closest('.table-responsive') || document.body;
            let table = container && container.querySelector('table.exportable-table') || container && container.querySelector('table');
            if (!table) table = document.querySelector('table.exportable-table') || document.querySelector('table');
            if (!table) { try { alert('لم يتم العثور على جدول للتصدير'); } catch(e){}; return; }
            const hdr = (container && (container.querySelector('.card-header strong') || container.querySelector('h2'))) || document.title || '';
            const base = (hdr && hdr.textContent ? hdr.textContent : String(document.title || 'تقرير')).replace(/\s+/g,'_').replace(/[^\w\-\u0600-\u06FF_]/g,'');
            const filename = `تقرير_${base}_${new Date().toISOString().slice(0,10)}.xlsx`;
            await exportTableToExcel(table, filename);
          } catch (err) { console.error('manual excel export failed', err); try { alert('فشل تصدير Excel'); } catch(e){} }
        });
        el.__exportsBound = true;
      });
    } catch (e) { console.warn('bindManualExcelButtons failed', e); }
  }

  // run on load and watch for future buttons added dynamically
  try {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindManualExcelButtons);
    else bindManualExcelButtons();
    // observe additions to bind dynamically created buttons
    const mb = new MutationObserver((mutations) => { for (const m of mutations) for (const n of m.addedNodes) if (n && n.querySelector) { try { if (n.matches && (n.matches('button') || n.matches('a'))) bindManualExcelButtons(); const nested = n.querySelectorAll && n.querySelectorAll('button, a'); if (nested && nested.length) bindManualExcelButtons(); } catch(e){} } });
    mb.observe(document.body, { childList: true, subtree: true });
  } catch(e) { /* ignore */ }

  window.exports = {
    exportTableToExcel,
    exportElementToPDF,
    printElement,
    autoAttachExportToolbar
  };
})();