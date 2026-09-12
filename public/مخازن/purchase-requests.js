document.addEventListener('DOMContentLoaded', () => {
  const addRowBtn = document.getElementById('addPrRow');
  const prRows = document.getElementById('prRows');
  const submitBtn = document.getElementById('submitPr');
  const prPreferredSupplier = document.getElementById('prPreferredSupplier');

  // supplier cache
  const supplierMap = {};
  window.firebaseHelpers.onCollection('suppliers', snapshot => {
    prPreferredSupplier.innerHTML = '<option value="">-- اختر مورد --</option>';
    snapshot.forEach(doc => {
      const d = doc.data();
      supplierMap[doc.id] = d.name || '(بدون اسم)';
      const opt = document.createElement('option'); opt.value = doc.id; opt.innerText = d.name || '(بدون اسم)';
      prPreferredSupplier.appendChild(opt);
    });
  });

  function renderPrRow(data) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="text" class="form-control product-search" placeholder="اضغط F1 للاختيار أو اكتب الباركود" value="${data && data.name ? data.name : ''}"></td>
      <td><input class="form-control form-control-sm product-code" readonly placeholder="الكود" value="${data && data.barcode ? data.barcode : ''}"></td>
      <td><input type="number" class="form-control pr-qty" value="${data && data.qty ? data.qty : 1}"></td>
      <td><input type="text" class="form-control pr-note" value="${data && data.note ? data.note : ''}"></td>
      <td><button class="btn btn-outline-danger btn-sm remove-row">حذف</button></td>`;

    tr.querySelector('.remove-row').addEventListener('click', () => tr.remove());

    // product-search change -> try to populate code and product id
    tr.querySelector('.product-search').addEventListener('change', async () => {
      const q = tr.querySelector('.product-search').value.trim();
      if (!q) return;
      let snapshot = await window.firebaseHelpers.collectionRef('products').where('barcode','==',q).limit(1).get();
      if (snapshot.empty) snapshot = await window.firebaseHelpers.collectionRef('products').where('name','==',q).limit(1).get();
      if (snapshot.empty) { showAlert('لم يتم العثور على الصنف الحالي. سيتم إنشاؤه عند الترحيل', 'warning'); return; }
      const pd = snapshot.docs[0].data();
      tr.querySelector('.product-search').value = pd.name || q;
      tr.querySelector('.product-code').value = pd.barcode || '';
      tr.dataset.productId = snapshot.docs[0].id;
      tr.dataset.productBarcode = pd.barcode || '';
    });

    return tr;
  }

  addRowBtn.addEventListener('click', () => {
    prRows.appendChild(renderPrRow());
  });

  // submit handled later (includes createdBy)

  // Notifications & quick query
  const prNotifications = document.getElementById('prNotifications');
  const prQueryBtn = document.getElementById('prQueryBtn');
  const prQueryNumber = document.getElementById('prQueryNumber');
  const prQuerySupplier = document.getElementById('prQuerySupplier');
  const prQueryResults = document.getElementById('prQueryResults');

  // Fill query supplier select
  window.firebaseHelpers.onCollection('suppliers', snapshot => {
    prQuerySupplier.innerHTML = '<option value="">-- اختر مورد --</option>';
    snapshot.forEach(doc => {
      const d = doc.data();
      const opt = document.createElement('option'); opt.value = doc.id; opt.innerText = d.name || '(بدون اسم)';
      prQuerySupplier.appendChild(opt);
    });
  });

  const lastStatusMap = {};
  window.firebaseHelpers.onCollection('purchase_requests', snapshot => {
    if (snapshot.docChanges) {
      snapshot.docChanges().forEach(change => {
        if (change.type === 'added') lastStatusMap[change.doc.id] = change.doc.data().status;
        if (change.type === 'modified') {
          const d = change.doc.data();
          const prev = lastStatusMap[change.doc.id];
          if (prev && prev !== d.status) {
            const el = document.createElement('div'); el.className = 'alert alert-info alert-dismissible fade show';
            el.innerHTML = `<strong>طلب ${d.number || ''}</strong> تم تغيير الحالة من <strong>${prev}</strong> إلى <strong>${d.status}</strong>. <button type="button" class="btn-close" data-bs-dismiss="alert"></button>`;
            prNotifications.prepend(el);
            showAlert(`تم تحديث حالة ${d.number || ''} إلى ${d.status}`, 'info');
          }
          lastStatusMap[change.doc.id] = d.status;
        }
      });
    }
  });

  prQueryBtn.addEventListener('click', async () => {
    prQueryResults.innerHTML = '';
    const number = prQueryNumber.value.trim();
    const supplier = prQuerySupplier.value;
    try {
      let q;
      if (number) q = await window.firebaseHelpers.collectionRef('purchase_requests').where('number','==',number).get();
      else if (supplier) q = await window.firebaseHelpers.collectionRef('purchase_requests').where('supplierId','==',supplier).get();
      else { showAlert('أدخل رقم طلب أو اختر مورد للاستعلام', 'warning'); return; }
      if (!q || q.empty) { prQueryResults.innerHTML = '<div class="text-muted">لا توجد نتائج.</div>'; return; }
      q.forEach(doc => {
        const d = doc.data();
        const div = document.createElement('div');
        div.className = 'card mb-2';
        div.innerHTML = `<div class="card-body"><div><strong>رقم:</strong> ${d.number||''} — <strong>التاريخ:</strong> ${d.date||''} — <strong>المورد:</strong> ${d.supplierId || ''}</div><div class="mt-2">${(d.items||[]).map(i => `<div>${i.barcode||''} <strong>${i.name}</strong> x${i.qty}</div>`).join('')}</div><div class="mt-2 small text-muted">الحالة: ${d.status || ''} ${d.expectedDate ? ' — موعد التوريد: '+d.expectedDate : ''}</div></div>`;
        prQueryResults.appendChild(div);
      });
    } catch (err) { console.error(err); showAlert('خطأ في الاستعلام', 'danger'); }
  });

  // Creator (department/user) control: save to localStorage and attach to created PRs
  const prCreator = document.getElementById('prCreator');
  const savePrCreator = document.getElementById('savePrCreator');
  const prAllBtn = document.getElementById('prAllBtn');

  // initialize creator from localStorage
  prCreator.value = localStorage.getItem('prCreator') || '';
  savePrCreator.addEventListener('click', () => {
    const v = prCreator.value.trim();
    if (!v) { showAlert('أدخل اسم الإدارة أو المستخدم', 'warning'); return; }
    localStorage.setItem('prCreator', v);
    showAlert('تم حفظ اسم الإدارة', 'success');
  });

  // ensure new requests include createdBy
  const originalSubmit = submitBtn.onclick;
  // override submit handler to include createdBy
  submitBtn.addEventListener('click', async () => {
    const rows = Array.from(prRows.querySelectorAll('tr'));
    const items = rows.map(r => ({ name: r.querySelector('.product-search').value.trim(), barcode: r.querySelector('.product-code').value.trim(), qty: Number(r.querySelector('.pr-qty').value) || 0, note: r.querySelector('.pr-note').value }));
    const pr = { number: document.getElementById('prNumber').value, supplierId: document.getElementById('prPreferredSupplier').value, date: document.getElementById('prDate').value, items, status: 'pending', createdAt: new Date().toISOString(), createdBy: localStorage.getItem('prCreator') || null };
    try {
      const docRef = await window.firebaseHelpers.addDocument('purchase_requests', pr);
      showAlert('تم إرسال طلب الشراء', 'success');
      // render printable receipt under the form
      try {
        const containerId = 'lastPrSummary';
        let container = document.getElementById(containerId);
        if (!container) { container = document.createElement('div'); container.id = containerId; container.className = 'mt-3'; prRows.parentElement.insertAdjacentElement('afterend', container); }
        container.innerHTML = `<div class="card"><div class="card-body"><h6>إيصال طلب شراء: ${docRef.id || ''} — ${pr.number || ''}</h6><div class="table-responsive"><table class="table table-sm table-striped exportable-table"><thead><tr><th>الكود</th><th>الاسم</th><th class="text-center">الكمية</th><th>ملاحظات</th></tr></thead><tbody>${pr.items.map(i=>`<tr><td>${i.barcode||''}</td><td>${i.name||''}</td><td class="text-center">${i.qty||0}</td><td>${i.note||''}</td></tr>`).join('')}</tbody></table></div></div></div>`;
        if (window.exports && window.exports.autoAttachExportToolbar) window.exports.autoAttachExportToolbar();
      } catch (err) { console.error('failed to render PR summary', err); }

      prRows.innerHTML = '';
      prRows.appendChild(renderPrRow());
    } catch (err) { console.error(err); showAlert('خطأ أثناء الإرسال','danger'); }
  });

  // Modal: populate suppliers for the modal filter
  const prAllFrom = document.getElementById('prAllFrom');
  const prAllTo = document.getElementById('prAllTo');
  const prAllSupplier = document.getElementById('prAllSupplier');
  const prAllQuery = document.getElementById('prAllQuery');
  const prAllResults = document.getElementById('prAllResults');
  const prAllModalEl = document.getElementById('prAllModal');
  const prAllModal = new bootstrap.Modal(prAllModalEl);

  // supplier cache for the modal
  const prSupplierMap = {};
  window.firebaseHelpers.onCollection('suppliers', snapshot => {
    prAllSupplier.innerHTML = '<option value="">الكل</option>';
    snapshot.forEach(doc => {
      const d = doc.data();
      prSupplierMap[doc.id] = d.name || '(بدون اسم)';
      const opt = document.createElement('option'); opt.value = doc.id; opt.innerText = d.name || '(بدون اسم)';
      prAllSupplier.appendChild(opt);
    });
  });

  // product cache (barcode -> product fields like unit)
  const prProductMap = {};
  async function loadProductsCache() {
    try {
      const prods = await window.firebaseHelpers.getAll('products');
      prods.forEach(p => { if (p.barcode) prProductMap[p.barcode] = p; });
    } catch (err) { console.error('failed to load products cache', err); }
  }
  // preload once
  loadProductsCache();

  function statusBadge(s) {
    if (!s || s === 'pending') return '<span class="badge bg-secondary">قيد الانتظار</span>';
    if (s === 'rejected') return '<span class="badge bg-danger">مرفوض</span>';
    if (s === 'purchasing') return '<span class="badge bg-warning text-dark">قيد الشراء</span>';
    if (s === 'purchased') return '<span class="badge bg-success">تم الشراء</span>';
    if (s === 'scheduled') return '<span class="badge bg-info text-dark">سيتم التوفير</span>';
    return `<span class="badge bg-secondary">${s}</span>`;
  }

  prAllBtn.addEventListener('click', () => {
    prAllModal.show();
  });

  prAllQuery.addEventListener('click', async () => {
    prAllResults.innerHTML = '';
    const creator = localStorage.getItem('prCreator');
    if (!creator) { showAlert('حدد اسم الإدارة أولاً في حقل "تفاصيل قسم/مستخدم الإنشاء" ثم اضغط حفظ', 'warning'); return; }
    try {
      const q = await window.firebaseHelpers.collectionRef('purchase_requests').where('createdBy','==',creator).get();
      if (!q || q.empty) { prAllResults.innerHTML = '<tr><td colspan="10" class="text-muted">لا توجد نتائج</td></tr>'; return; }

      const from = prAllFrom.value ? new Date(prAllFrom.value) : null;
      const to = prAllTo.value ? new Date(prAllTo.value) : null;
      const supplierFilter = prAllSupplier.value;

      q.forEach(doc => {
        const d = doc.data();
        // apply date and supplier filters client-side
        if (supplierFilter && d.supplierId !== supplierFilter) return;
        if (from || to) {
          const dt = d.date ? new Date(d.date) : null;
          if (from && (!dt || dt < from)) return;
          if (to && (!dt || dt > to)) return;
        }

        (d.items || []).forEach(i => {
          const prod = prProductMap[i.barcode] || {};
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>${d.number||''}</td>
            <td>${d.date ? new Date(d.date).toLocaleDateString() : ''}</td>
            <td>${prSupplierMap[d.supplierId]||d.supplierId||''}</td>
            <td>${i.barcode||''}</td>
            <td>${i.name || prod.name || ''}</td>
            <td>${i.qty || ''}</td>
            <td>${prod.unit || i.unit || ''}</td>
            <td>${statusBadge(d.status)} ${d.finalized?'<span class="badge bg-dark ms-1">نهائي</span>':''}</td>
            <td>${i.note || ''}</td>
            <td>${d.expectedDate ? new Date(d.expectedDate).toLocaleDateString() : ''}</td>
          `;
          prAllResults.appendChild(tr);
        });
      });
      // attach export toolbar for the results table
      if (window.exports && window.exports.autoAttachExportToolbar) window.exports.autoAttachExportToolbar();
    } catch (err) { console.error(err); showAlert('حدث خطأ أثناء الاستعلام','danger'); }
  });

  // Purchase requests listing moved to `purchase-requests-list.js` to provide a dedicated management page

  // init
  prRows.innerHTML = '';
  prRows.appendChild(renderPrRow());
});