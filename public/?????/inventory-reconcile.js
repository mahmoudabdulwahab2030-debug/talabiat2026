document.addEventListener('DOMContentLoaded', () => {
  const body = document.getElementById('reconcileBody');
  if (!body) return;

  // Load final audits and list differences
  window.firebaseHelpers.collectionRef('audits').where('status','==','final').get().then(snap => {
    body.innerHTML = '';
    snap.docs.forEach(auditDoc => {
      const audit = auditDoc.data();
      audit.items.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${item.productId || item.productBarcode || ''}</td>
          <td>${item.productName}</td>
          <td>${item.recorded}</td>
          <td>${item.actual}</td>
          <td>${item.diff}</td>
          <td><button class="btn btn-sm btn-primary apply">تسوية</button></td>
        `;
        tr.querySelector('.apply').addEventListener('click', async () => {
          // apply reconciliation: update product quantity and record movement & reconciliation
          try {
            // update product
            const prodRef = window.firebaseHelpers.collectionRef('products').doc(item.productId);
            const prodSnap = await prodRef.get();
            if (!prodSnap.exists) { showAlert('المنتج غير موجود', 'warning'); return; }
            await prodRef.update({ quantity: item.actual });
            // log reconciliation
            await window.firebaseHelpers.addDocument('reconciliations', { productId: item.productId, productBarcode: item.productBarcode || null, productName: item.productName, from: item.recorded, to: item.actual, diff: item.diff, date: new Date().toISOString() });
            // log movement / adjustment
            await window.firebaseHelpers.addDocument('movements', { type: 'adjust', productId: item.productId, productBarcode: item.productBarcode || null, productName: item.productName, qty: item.diff, date: new Date().toISOString() });
            showAlert('تم تطبيق التسوية', 'success');
            tr.remove();
          } catch (err) {
            console.error(err); showAlert('حدث خطأ أثناء التسوية', 'danger');
          }
        });

        body.appendChild(tr);
      });
    });
    // attach export toolbar if available
    if (window.exports && window.exports.autoAttachExportToolbar) window.exports.autoAttachExportToolbar();
  }).catch(err => console.error(err));
});