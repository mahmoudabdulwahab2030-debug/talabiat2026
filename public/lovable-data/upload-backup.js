/* نسخ احتياطي واستيراد للملفات المرفوعة حسب فترة زمنية */
(function () {
  function sb() { return window.lovableDb; }
  function dOf(d) { return String((d && (d.orderDate || d.deliveryDate)) || '').slice(0, 10); }

  async function fetchRange(table, from, to) {
    const out = []; const size = 1000; let page = 0;
    while (true) {
      const q = sb().from(table).select('id,data,created_at,updated_at')
        .or(`and(data->>orderDate.gte.${from},data->>orderDate.lte.${to}T23:59:59),and(data->>orderDate.is.null,data->>deliveryDate.gte.${from},data->>deliveryDate.lte.${to}T23:59:59)`)
        .order('id').range(page * size, page * size + size - 1);
      const { data, error } = await q;
      if (error) throw error;
      out.push(...data.filter(r => { const x = dOf(r.data); return x >= from && x <= to; }));
      if (data.length < size) break;
      page++;
    }
    return out;
  }

  async function doExport(tables, brand) {
    const r = await Swal.fire({
      title: '💾 نسخة احتياطية', background: '#23232a', color: '#fff', confirmButtonColor: '#ffd166',
      html: `<div style="display:grid;gap:10px;text-align:right">
        <label>من تاريخ<input type="date" id="bkFrom" class="swal2-input" style="margin:4px 0;width:100%"></label>
        <label>إلى تاريخ<input type="date" id="bkTo" class="swal2-input" style="margin:4px 0;width:100%"></label></div>`,
      showCancelButton: true, confirmButtonText: 'تصدير', cancelButtonText: 'إلغاء',
      preConfirm: () => {
        const f = document.getElementById('bkFrom').value, t = document.getElementById('bkTo').value;
        if (!f || !t) return Swal.showValidationMessage('اختر التاريخين'), false;
        if (f > t) return Swal.showValidationMessage('تاريخ البداية بعد النهاية'), false;
        return { f, t };
      }
    });
    if (!r.isConfirmed) return;
    const { f, t } = r.value;
    Swal.fire({ title: 'جاري تجهيز النسخة...', allowOutsideClick: false, didOpen: () => Swal.showLoading(), background: '#23232a', color: '#fff' });
    try {
      const payload = { format: 'upload-backup-v1', brand, from: f, to: t, exportedAt: new Date().toISOString(), tables: {} };
      let total = 0;
      for (const tb of tables) { payload.tables[tb] = await fetchRange(tb, f, t); total += payload.tables[tb].length; }
      if (!total) return Swal.fire({ icon: 'info', title: 'لا توجد بيانات في هذه الفترة', background: '#23232a', color: '#fff' });
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = `backup-${brand}-${f}_to_${t}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      Swal.fire({ icon: 'success', title: 'تم التصدير', text: `${total} سجل. احتفظ بالملف في مكان آمن.`, background: '#23232a', color: '#fff' });
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'فشل التصدير', text: e.message || e, background: '#23232a', color: '#fff' });
    }
  }

  function doImport(tables, brand, onDone) {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json';
    inp.onchange = async () => {
      const file = inp.files[0]; if (!file) return;
      let p;
      try { p = JSON.parse(await file.text()); } catch (_) { p = null; }
      if (!p || p.format !== 'upload-backup-v1' || !p.tables) return Swal.fire({ icon: 'error', title: 'ملف غير صالح', background: '#23232a', color: '#fff' });
      if (p.brand !== brand) return Swal.fire({ icon: 'error', title: 'هذه النسخة تخص براند آخر', background: '#23232a', color: '#fff' });
      const valid = tables.filter(tb => Array.isArray(p.tables[tb]));
      const total = valid.reduce((s, tb) => s + p.tables[tb].length, 0);
      const c = await Swal.fire({ icon: 'question', title: 'استيراد النسخة؟', background: '#23232a', color: '#fff',
        html: `الفترة: <b>${p.from}</b> إلى <b>${p.to}</b><br>عدد السجلات: <b>${total}</b><br><small>السجلات الموجودة بنفس المعرّف سيتم تحديثها، ولن يتكرر شيء.</small>`,
        showCancelButton: true, confirmButtonText: 'استيراد', cancelButtonText: 'إلغاء', confirmButtonColor: '#ffd166' });
      if (!c.isConfirmed) return;
      Swal.fire({ title: 'جاري الاستيراد...', allowOutsideClick: false, didOpen: () => Swal.showLoading(), background: '#23232a', color: '#fff' });
      try {
        for (const tb of valid) {
          const rows = p.tables[tb].map(r => ({ id: r.id, data: r.data, created_at: r.created_at }));
          for (let i = 0; i < rows.length; i += 500) {
            const { error } = await sb().from(tb).upsert(rows.slice(i, i + 500), { onConflict: 'id' });
            if (error) throw error;
          }
        }
        await Swal.fire({ icon: 'success', title: 'تم الاستيراد', text: `${total} سجل`, background: '#23232a', color: '#fff' });
        if (onDone) onDone();
      } catch (e) {
        Swal.fire({ icon: 'error', title: 'فشل الاستيراد', text: e.message || e, background: '#23232a', color: '#fff' });
      }
    };
    inp.click();
  }

  window.UploadBackup = { export: doExport, import: doImport, _fetchRange: fetchRange };
})();
