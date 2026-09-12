document.addEventListener('DOMContentLoaded', () => {
  const tbody = document.getElementById('productsTableBody');
  const sectionFilter = document.getElementById('sectionFilter');
  const searchInput = document.getElementById('searchInput');
  if (!tbody) return;

  // keep latest inbound (purchase) price per product id
  const latestInboundByProduct = {};
  window.firebaseHelpers.onCollection('movements', snapshot => {
    snapshot.forEach(doc => {
      const d = doc.data();
      if (!d || d.type !== 'in' || !d.productId) return;
      let ts = 0;
      if (d.date) ts = Date.parse(d.date) || 0;
      if (!ts && d.createdAt && d.createdAt.seconds) ts = d.createdAt.seconds * 1000;
      const existing = latestInboundByProduct[d.productId];
      if (!existing || ts > existing.ts) latestInboundByProduct[d.productId] = { price: Number(d.price) || 0, ts };
    });
  }, err => console.error(err));

  // render products table
  window.firebaseHelpers.onCollection('products', snapshot => {
    tbody.innerHTML = '';
    snapshot.forEach(doc => {
      const data = doc.data() || {};
      const id = doc.id;
      const inferredPurchase = (latestInboundByProduct[id] && latestInboundByProduct[id].price) || data.purchasePrice || data.cost || data.buyPrice || 0;
      const tr = document.createElement('tr');
      const pack = data.pack || {};
      const packText = pack.labelArabic ? `${pack.labelArabic}${pack.quantity ? ' ×'+pack.quantity : ''}${pack.unit ? ' '+pack.unit : ''}` : '';
      tr.innerHTML = `
        <td>${data.barcode || data.code || id}</td>
        <td>${data.name || ''}</td>
        <td>${data.section || ''}</td>
        <td>${data.subsection || ''}</td>
        <td><span class="badge bg-primary">${(data.quantity||0)}</span></td>
        <td>${data.unit || ''}${data.unitWeight ? ' ('+data.unitWeight+' كجم)': ''}</td>
        <td>${packText}</td>
        <td>${formatCurrency(inferredPurchase)}</td>
        <td>${data.processingFactor ? data.processingFactor : ''}</td>
        <td><button class="btn btn-sm btn-outline-secondary trace-btn" data-id="${id}">تتبع</button></td>
      `;

      tbody.appendChild(tr);
    });

    if (window.exports && window.exports.autoAttachExportToolbar) window.exports.autoAttachExportToolbar();
  }, err => console.error(err));

  // trace button handler: open modal with movements for product
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest && e.target.closest('.trace-btn');
    if (!btn) return;
    const pid = btn.dataset.id;
    if (!pid) return;
    try {
      // fetch product and movements for product
      const prodDoc = await window.firebaseHelpers.collectionRef('products').doc(pid).get();
      const pData = prodDoc && prodDoc.exists ? prodDoc.data() : {};
      const snaps = await window.firebaseHelpers.collectionRef('movements').where('productId','==',pid).get();
      const moves = snaps.docs.map(d => ({ id: d.id, ...(d.data() || {}) }));
      // collect invoiceIds and supplierIds to resolve invoice numbers and suppliers
      const invoiceIds = Array.from(new Set(moves.map(m => m.invoiceId).filter(Boolean)));
      const issueIds = Array.from(new Set(moves.map(m => m.issueId).filter(Boolean)));
      const supplierIds = Array.from(new Set(moves.map(m => m.supplierId).filter(Boolean)));
      const invoiceMap = {};
      const issueMap = {};
      const supplierMap = {};
      // helper to extract a human-friendly document number from several possible keys
      function extractDocNumber(d) {
        if (!d) return null;
        return d.number || d.invoiceNumber || d.refNumber || d.reference || d.docNumber || d.id || null;
      }

      for (const iid of invoiceIds) {
        try {
          const invDoc = await window.firebaseHelpers.collectionRef('invoices').doc(iid).get();
          const invData = invDoc && invDoc.exists ? invDoc.data() : null;
          const n = extractDocNumber(invData) || iid;
          invoiceMap[iid] = n;
        } catch (e) {
          invoiceMap[iid] = iid;
        }
      }
      for (const sid of supplierIds) {
        try {
          const sdoc = await window.firebaseHelpers.collectionRef('suppliers').doc(sid).get();
          const sd = sdoc && sdoc.exists ? sdoc.data() : null;
          supplierMap[sid] = sd && (sd.name || sd.displayName) ? (sd.name || sd.displayName) : sid;
        } catch (e) {
          supplierMap[sid] = sid;
        }
      }
      // resolve issue numbers for issueId references
      for (const iid of issueIds) {
        try {
          const isDoc = await window.firebaseHelpers.collectionRef('issues').doc(iid).get();
          const idata = isDoc && isDoc.exists ? isDoc.data() : null;
          const n = extractDocNumber(idata) || iid;
          issueMap[iid] = n;
        } catch (e) {
          issueMap[iid] = iid;
        }
      }

      function translateType(t) {
        if (!t) return '';
        if (t === 'in') return 'وارد';
        if (t === 'out') return 'صرف';
        if (t === 'adjust') return 'تعديل';
        if (t === 'transfer_in' || t === 'transfer-in') return 'نقل وارد';
        if (t === 'transfer_out' || t === 'transfer-out') return 'نقل صرف';
        return t;
      }

      const rows = moves.sort((a,b) => { const ta = Date.parse(a.date)||0; const tb = Date.parse(b.date)||0; return tb - ta; });

      // build product summary (Arabic labels)
      const packText = (pData.pack && (pData.pack.labelArabic || pData.pack.label)) ? (pData.pack.labelArabic || pData.pack.label) + (pData.pack.quantity ? ' ×'+pData.pack.quantity : '') : '';
      const inferredPurchaseLocal = (latestInboundByProduct[pid] && latestInboundByProduct[pid].price) || pData.purchasePrice || pData.cost || pData.buyPrice || 0;

      const modalHtml = `
        <div class="modal fade" id="traceModal" tabindex="-1" aria-hidden="true">
          <div class="modal-dialog modal-xl modal-dialog-centered">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title">تتبع حركة الصنف</h5>
                <button type="button" class="btn btn-light btn-sm me-2" id="printTraceBtn"><i class="bi bi-printer"></i> طباعة</button>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
              </div>
              <div class="modal-body">
                <div class="row mb-3">
                  <div class="col-12">
                    <table class="table table-borderless mb-2" style="background:transparent">
                      <tbody>
                        <tr><th style="width:120px">الاسم</th><td>${pData.name||''}</td><th style="width:120px">الكود / الباركود</th><td>${pData.barcode||pData.code||''}</td></tr>
                        <tr><th>القسم</th><td>${pData.section||''}</td><th>التصنيف الفرعي</th><td>${pData.subsection||''}</td></tr>
                        <tr><th>الرصيد الحالي</th><td><span class="badge bg-primary">${pData.quantity||0}</span></td><th>سعر الشراء (أحدث)</th><td>${formatCurrency(inferredPurchaseLocal)}</td></tr>
                      </tbody>
                    </table>
                  </div>
                </div>
                        <div class="row mb-3">
                          <div class="col-md-4">
                            <div class="card p-2 mb-2"><div class="card-body p-2"><small class="text-muted">الوارد (إجمالي)</small><div class="h5 mt-1">${rows.filter(r=>r.type==='in').reduce((s,a)=>s+(Number(a.qty)||0),0)}</div></div></div>
                          </div>
                          <div class="col-md-4">
                            <div class="card p-2 mb-2"><div class="card-body p-2"><small class="text-muted">الصرف (إجمالي)</small><div class="h5 mt-1">${rows.filter(r=>r.type==='out').reduce((s,a)=>s+(Number(a.qty)||0),0)}</div></div></div>
                          </div>
                          <div class="col-md-4">
                            <div class="card p-2 mb-2"><div class="card-body p-2"><small class="text-muted">الرصيد الحالي</small><div class="h5 mt-1">${pData.quantity||0}</div></div></div>
                          </div>
                        </div>
                        <div class="table-responsive"><table class="table table-sm table-striped detail-table"><thead><tr><th>التاريخ</th><th>نوع الحركة</th><th class="text-center">الكمية</th><th class="text-end">السعر</th><th>المرجع</th><th>الطرف</th></tr></thead><tbody>${rows.map(r=>{
                          const refFromMaps = r.issueId ? (issueMap[r.issueId]||r.issueId) : (r.invoiceId ? (invoiceMap[r.invoiceId]||r.invoiceId) : null);
                          const ref = refFromMaps || r.reference || r.ref || r.refNumber || r.invoiceNumber || r.issueNumber || r.note || '';
                          const party = r.supplierId ? (supplierMap[r.supplierId] || (r.supplierName||'')) : (r.recipient || r.supplierName || r.party || '');
                          const typeBadge = (r.type==='in' ? '<span class="badge bg-success">وارد</span>' : (r.type==='out' ? '<span class="badge bg-danger">صادر</span>' : ('<span class="badge bg-secondary">'+translateType(r.type)+'</span>')));
                          return `<tr><td>${r.date||''}</td><td>${typeBadge}</td><td class="text-center">${r.qty||''}</td><td class="text-end">${r.price?Number(r.price).toFixed(2):''}</td><td>${ref}</td><td>${party}</td></tr>`;
                        }).join('')}</tbody></table></div>
              </div>
              <div class="modal-footer"><button class="btn btn-secondary" data-bs-dismiss="modal">إغلاق</button></div>
            </div>
          </div>
        </div>`;
      // ensure only one modal exists
      const existing = document.getElementById('traceModal'); if (existing) existing.remove();
      const tmp = document.createElement('div'); tmp.innerHTML = modalHtml; document.body.appendChild(tmp.firstElementChild);
      const mEl = document.getElementById('traceModal');
      const m = new bootstrap.Modal(mEl); m.show();

      // attach print handler
      const printBtn = document.getElementById('printTraceBtn');
      if (printBtn) {
        printBtn.addEventListener('click', () => {
          const modalBody = mEl.querySelector('.modal-body');
          if (!modalBody) return;
          const w = window.open('', '_blank');
          const style = '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css">';
          w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>طباعة تتبع الصنف</title>${style}</head><body class="p-3">${modalBody.innerHTML}</body></html>`);
          w.document.close(); w.focus(); w.print(); setTimeout(()=>w.close(),500);
        });
      }
    } catch (err) { console.error(err); showAlert('خطأ أثناء جلب بيانات التتبع','danger'); }
  });

  // search/filter
  document.getElementById('searchBtn')?.addEventListener('click', () => {
    const q = (searchInput.value || '').toLowerCase();
    const section = sectionFilter.value;
    document.querySelectorAll('#productsTableBody tr').forEach(tr => {
      const name = tr.children[1]?.innerText?.toLowerCase() || '';
      const sec = tr.children[2]?.innerText || '';
      const show = (!q || name.includes(q) || tr.children[0]?.innerText?.toLowerCase().includes(q)) && (!section || section === sec);
      tr.style.display = show ? '' : 'none';
    });
  });
});