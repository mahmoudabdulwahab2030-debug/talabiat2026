document.addEventListener('DOMContentLoaded', () => {
  const auditRows = document.getElementById('auditRows');
  const saveDraft = document.getElementById('saveAuditDraft');
  const finalizeBtn = document.getElementById('finalizeAudit');

  if (!auditRows) return;

  // Load products and create a row for each (simple audit selection)
  async function loadProducts() {
    const products = await window.firebaseHelpers.getAll('products');
    auditRows.innerHTML = '';
    const sectionFilter = (document.getElementById('auditSection') && document.getElementById('auditSection').value) || '';
    products.forEach(p => {
      const tr = document.createElement('tr');
      // if section filter is selected, prefer sectionBalances value
      const currentQty = sectionFilter ? (Number((p.sectionBalances||{})[sectionFilter] || 0)) : Number(p.quantity || 0);
      tr.innerHTML = `
        <td class="text-center">${p.barcode || ''}</td>
        <td>${p.name}</td>
        <td class="text-center fw-bold currentQty">${currentQty}</td>
        <td><input type="number" class="form-control actualQty" value="${currentQty}"></td>
        <td class="diff text-center">0</td>
        <td class="text-center"><span class="badge bg-secondary">مفتوح</span></td>
      `;
      tr.dataset.productId = p.id;
      tr.dataset.productBarcode = p.barcode || '';
      tr.querySelector('.actualQty').addEventListener('input', (e) => {
        const actual = Number(e.target.value) || 0;
        const current = Number(tr.querySelector('.currentQty').innerText) || 0;
        tr.querySelector('.diff').innerText = actual - current;
      });
      auditRows.appendChild(tr);
    });
  }

  // reload when section filter changes
  const auditSectionEl = document.getElementById('auditSection');
  if (auditSectionEl) auditSectionEl.addEventListener('change', () => loadProducts());

  loadProducts().then(()=>{ if (window.exports && window.exports.autoAttachExportToolbar) window.exports.autoAttachExportToolbar(); }).catch(()=>{ if (window.exports && window.exports.autoAttachExportToolbar) window.exports.autoAttachExportToolbar(); });

  saveDraft.addEventListener('click', async () => {
    const items = Array.from(auditRows.querySelectorAll('tr')).map(tr => {
      return {
        productId: tr.dataset.productId,
        productBarcode: tr.dataset.productBarcode || null,
        productName: tr.children[1].innerText,
        recorded: Number(tr.querySelector('.currentQty').innerText) || 0,
        actual: Number(tr.querySelector('.actualQty').value) || 0,
        diff: Number(tr.querySelector('.diff').innerText) || 0
      };
    }).filter(i => i.diff !== 0);

    if (!items.length) { showAlert('لا توجد فروق للحفظ', 'info'); return; }
    try {
      await window.firebaseHelpers.addDocument('audits', { date: new Date().toISOString(), items, status: 'draft' });
      showAlert('تم حفظ مسودة الجرد', 'success');
    } catch (err) {
      console.error(err); showAlert('خطأ أثناء الحفظ', 'danger');
    }
  });

  finalizeBtn.addEventListener('click', async () => {
    const items = Array.from(auditRows.querySelectorAll('tr')).map(tr => {
      return {
        productId: tr.dataset.productId,
        productBarcode: tr.dataset.productBarcode || null,
        productName: tr.children[1].innerText,
        recorded: Number(tr.querySelector('.currentQty').innerText) || 0,
        actual: Number(tr.querySelector('.actualQty').value) || 0,
        diff: Number(tr.querySelector('.diff').innerText) || 0
      };
    }).filter(i => i.diff !== 0);

    if (!items.length) { showAlert('لا توجد فروق للتسوية', 'info'); return; }
    try {
      await window.firebaseHelpers.addDocument('audits', { date: new Date().toISOString(), items, status: 'final' });
      showAlert('تم اعتماد الجرد. توجّه إلى شاشة التسوية لتطبيق الفروقات', 'success');
      setTimeout(() => location.href = 'inventory-reconcile.html', 1200);
    } catch (err) {
      console.error(err); showAlert('خطأ أثناء الاعتماد', 'danger');
    }
  });
});