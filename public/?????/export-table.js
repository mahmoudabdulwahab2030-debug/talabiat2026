(function(){
  function exportTableToExcel(tableSelector, filename) {
    const table = document.querySelector(tableSelector) || document.querySelector('table.exportable-table');
    if (!table) {
      alert('لم يتم العثور على جدول للتصدير');
      return;
    }

    // Use SheetJS to convert table to worksheet
    try {
      const ws = XLSX.utils.table_to_sheet(table, {raw: true});
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');

      const now = new Date();
      const datePart = now.toISOString().slice(0,10).replace(/-/g,'');
      const page = (document.title || 'export').replace(/\s+/g,'_').replace(/[^\w\-]/g,'');
      const fname = filename || `${page}-${datePart}.xlsx`;

      XLSX.writeFile(wb, fname);
    } catch (err) {
      console.error('Export failed', err);
      alert('فشل التصدير إلى Excel — راجع الكونسول للمزيد');
    }
  }

  document.addEventListener('DOMContentLoaded', function(){
    // Find any button or link that visually represents an Excel export in the project.
    const candidates = Array.from(document.querySelectorAll('button, a'));
    const matches = candidates.filter(el => {
      // contains an <i> with spreadsheet/excel icon
      const icon = el.querySelector && (el.querySelector('i.bi-file-earmark-spreadsheet') || el.querySelector('i.bi-file-earmark-excel') || el.querySelector('i.bi-file-earmark-excel-fill'));
      if (icon) return true;
      // or text indicates Excel (English or Arabic)
      const txt = (el.textContent || '').trim().toLowerCase();
      if (txt.includes('excel') || txt.includes('اكسيل') || txt.includes('اكسل')) return true;
      return false;
    });

    matches.forEach(function(el){
      el.addEventListener('click', function(e){
        e.preventDefault();
        // Prefer a table inside the same card or container as the button
        let table = null;
        const card = el.closest('.card');
        if (card) table = card.querySelector('table.exportable-table');
        if (!table) table = document.querySelector('table.exportable-table');

        if (!table) {
          alert('لم يتم العثور على جدول للتصدير');
          return;
        }

        // derive filename from nearby heading or table caption
        let filename;
        const heading = el.closest('.container') && el.closest('.container').querySelector('h2');
        if (heading && heading.textContent.trim()) filename = `${heading.textContent.trim()}.xlsx`;
        else if (table.caption && table.caption.textContent.trim()) filename = `${table.caption.textContent.trim()}.xlsx`;

        exportTableToExcel('#' + (table.id || table.className.split(' ').join('.')), filename);
      });
    });
  });

  // expose for other pages/scripts to reuse
  window.exportTableToExcel = exportTableToExcel;
})();
