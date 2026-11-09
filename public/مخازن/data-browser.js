document.addEventListener('DOMContentLoaded', () => {
  const collectionsList = document.getElementById('collectionsList');
  const collectionNameInput = document.getElementById('collectionName');
  const loadCollectionBtn = document.getElementById('loadCollection');
  const refreshCollectionsBtn = document.getElementById('refreshCollections');
  const activeCollectionTitle = document.getElementById('activeCollectionTitle');
  const docsTableHead = document.getElementById('docsTableHead');
  const docsTableBody = document.getElementById('docsTableBody');
  const searchBox = document.getElementById('searchBox');
  const refreshDocs = document.getElementById('refreshDocs');
  const addDocBtn = document.getElementById('addDocBtn');
  const exportJsonBtn = document.getElementById('exportJson');

  const localStorageList = document.getElementById('localStorageList');
  const refreshLocal = document.getElementById('refreshLocal');

  const docModalEl = document.getElementById('docModal');
  const docModal = docModalEl ? new bootstrap.Modal(docModalEl) : null;
  const docIdEl = document.getElementById('docId');
  const docJsonEl = document.getElementById('docJson');
  const saveDocBtn = document.getElementById('saveDocBtn');
  const deleteDocBtn = document.getElementById('deleteDocBtn');

  // known collections (you can add more names here)
  const knownCollections = [
    'products','suppliers','purchase_requests','movements','audits','sections','requisition_requests','inventory_audit','inventory_reconcile','settings'
  ];

  let activeCollection = null;
  let currentDocs = []; // array of {id, ...data}

  // supplier cache for display translations
  const supplierMap = {};
  window.firebaseHelpers.onCollection('suppliers', snapshot => {
    snapshot.forEach(d => { const data = d.data(); supplierMap[d.id] = data.name || d.id; });
  });

  // simple product cache (barcode -> product info) to translate items
  const productMap = {};
  window.firebaseHelpers.onCollection('products', snapshot => {
    snapshot.forEach(d => {
      const data = d.data();
      if (data && data.barcode) productMap[data.barcode] = data;
    });
  });

  // status translation helper
  function statusLabel(s) {
    if (!s || s === 'pending') return 'قيد الانتظار';
    if (s === 'rejected') return 'مرفوض';
    if (s === 'purchasing') return 'قيد الشراء';
    if (s === 'purchased') return 'تم الشراء';
    if (s === 'scheduled') return 'سيتم التوفير';
    return s;
  }

  // collection meta cache (displayName, fieldLabels)
  const collectionMeta = {};
  // load meta realtime
  window.firebaseHelpers.onCollection('collection_meta', snapshot => {
    snapshot.docs.forEach(d => collectionMeta[d.id] = d.data() || {});
    renderCollections();
  });

  function renderCollections() {
    collectionsList.innerHTML = '';
    knownCollections.forEach(async (name) => {
      try {
        // load docs for summary
        const docs = await window.firebaseHelpers.getAll(name);
        const hasData = (docs && docs.length > 0) || collectionMeta[name];
        if (!hasData) return;
        const meta = collectionMeta[name] || {};
        const sample = (docs && docs[0]) || {};
        const keys = Object.keys(sample).filter(k => k !== 'id');
        const sampleFields = keys.slice(0,4).join(', ');
        const sampleVals = keys.slice(0,4).map(k => {
          const v = sample[k];
          if (Array.isArray(v)) return `${k}: [${v.length}]`;
          if (typeof v === 'object' && v !== null) return `${k}: {object}`;
          return `${k}: ${String(v ?? '')}`.slice(0,40);
        }).join(' | ');

        const li = document.createElement('li'); li.className = 'list-group-item';
        li.innerHTML = `
          <div class="d-flex justify-content-between align-items-start">
            <div style="min-width:0">
              <div class="small text-muted">stock_${name}</div>
              <div class="d-flex gap-2 align-items-center mt-1">
                <strong>${meta.displayName || name}</strong>
                <input class="form-control form-control-sm trans-display" style="max-width:220px" value="${meta.displayName||''}" placeholder="اسم عرض">
                <button class="btn btn-sm btn-outline-primary save-display">حفظ</button>
                <button class="btn btn-sm btn-outline-secondary edit-trans">ترجمات الحقول</button>
              </div>
              <div class="mt-2 small text-muted">حقول عينة: ${sampleFields || '(لا توجد)'}</div>
              <div class="small text-muted">قيم عينة: ${sampleVals || '(لا توجد)'}</div>
            </div>
            <div class="text-end">
              <div><span class="badge bg-secondary rounded-pill">${docs.length}</span></div>
              <div class="mt-2 d-flex flex-column gap-2">
                <button class="btn btn-sm btn-success view-collection">عرض (ملخص)</button>
                <button class="btn btn-sm btn-outline-dark view-collection-full">عرض كامل</button>
              </div>
            </div>
          </div>
        `;

        // save display name
        const saveBtn = li.querySelector('.save-display');
        saveBtn.addEventListener('click', async () => {
          const v = li.querySelector('.trans-display').value.trim();
          try {
            await window.firebaseHelpers.collectionRef('collection_meta').doc(name).set({ displayName: v, fieldLabels: collectionMeta[name] ? collectionMeta[name].fieldLabels : {} });
            showAlert('تم حفظ اسم العرض', 'success');
          } catch (err) { console.error(err); showAlert('خطأ أثناء الحفظ', 'danger'); }
        });

        // edit translations
        const editBtn = li.querySelector('.edit-trans');
        if (editBtn) editBtn.addEventListener('click', () => openTranslationsModal(name));

        // view collection summary
        const viewBtn = li.querySelector('.view-collection');
        if (viewBtn) viewBtn.addEventListener('click', () => loadCollection(name, 'summary'));
        // view full/raw
        const viewFull = li.querySelector('.view-collection-full');
        if (viewFull) viewFull.addEventListener('click', () => loadCollection(name, 'raw'));

        collectionsList.appendChild(li);
      } catch (err) {
        console.error('failed to load', name, err);
      }
    });
  }

  async function loadCollection(name, mode = 'summary') {
    activeCollection = name;
    const meta = collectionMeta[name] || {};
    activeCollectionTitle.innerText = `المجموعة: ${meta.displayName || name} ${mode === 'summary' ? '(ملخص)' : '(تفصيلي)'}`;
    docsTableHead.innerHTML = '';
    docsTableBody.innerHTML = '<tr><td colspan="3" class="text-muted">تحميل...</td></tr>';

    try {
      const docs = await window.firebaseHelpers.getAll(name);
      currentDocs = docs;
      if (!docs.length) { docsTableBody.innerHTML = '<tr><td colspan="3" class="text-muted">لا توجد مستندات</td></tr>'; return; }

      // build header by collecting keys
      const keys = new Set();
      docs.forEach(d => Object.keys(d).forEach(k => keys.add(k)));
      // ensure id is first
      const allKeys = ['id', ...Array.from(keys).filter(k => k !== 'id')];

      // helper to get translated header for field
      function headerLabel(k) {
        if (k === 'id') return 'ID';
        if (meta.fieldLabels && meta.fieldLabels[k]) return meta.fieldLabels[k];
        // common fallback translations
        const fallback = {
          barcode: 'الكود', name: 'الاسم', quantity: 'الكمية', unit: 'الوحدة', salePrice: 'سعر البيع', date: 'التاريخ', number: 'الرقم', supplierId: 'المورد', items: 'العناصر', status: 'الحالة', expectedDate: 'تاريخ التوقع', createdBy: 'مقدم الطلب'
        };
        if (fallback[k]) return fallback[k];
        return k;
      }

      if (mode === 'summary') {
        // choose top N fields to display
        const displayKeys = allKeys.slice(0, 6);
        docsTableHead.innerHTML = '<th>ID</th>' + displayKeys.slice(1).map(k => `<th>${headerLabel(k)}</th>`).join('') + '<th style="width:120px">إجراءات</th>';

        docsTableBody.innerHTML = '';
        docs.forEach(d => {
          const tr = document.createElement('tr');
          const cells = [];
          cells.push(`<td>${d.id}</td>`);
          displayKeys.slice(1).forEach(k => {
            const v = d[k];
            let disp = '';
            if (k === 'supplierId' && v) disp = supplierMap[v] || v;
            else if (k === 'status' && v) disp = statusLabel(v);
            else if (Array.isArray(v)) disp = `(${v.length})`;
            else if (typeof v === 'object' && v !== null) disp = '{object}';
            else disp = v === undefined ? '' : `${String(v)}`;
            if (disp && disp.length > 80) disp = disp.slice(0,80) + '...';
            cells.push(`<td title="${disp}">${disp}</td>`);
          });
          cells.push(`<td><button class="btn btn-sm btn-outline-primary me-1 view-doc">عرض</button></td>`);
          tr.innerHTML = cells.join('');

          const viewBtn = tr.querySelector('.view-doc');
          if (viewBtn) viewBtn.addEventListener('click', () => openDocModal(d.id, d));
          docsTableBody.appendChild(tr);
        });
        // attach export toolbar if available
        if (window.exports && window.exports.autoAttachExportToolbar) window.exports.autoAttachExportToolbar();
        return;
      }

      // raw/detailed mode (keeps previous behavior)
      const keyList = allKeys;
      docsTableHead.innerHTML = '<th>ID</th>' + keyList.slice(1).map(k => `<th>${headerLabel(k)}</th>`).join('') + '<th style="width:200px">إجراءات</th>';
      docsTableBody.innerHTML = '';
      docs.forEach(d => {
        const tr = document.createElement('tr');
        const cells = [];
        cells.push(`<td>${d.id}</td>`);
        keyList.slice(1).forEach(k => {
          let disp = '';
          const v = d[k];
          // special handling for known types
          if (k === 'supplierId' && v) {
            disp = supplierMap[v] || v;
          } else if (k === 'status' && v) {
            disp = statusLabel(v);
          } else if (Array.isArray(v)) {
            // show summarized items
            disp = v.map(it => {
              if (it.barcode) {
                const pname = it.name || (productMap[it.barcode] && productMap[it.barcode].name) || '';
                const unit = it.unit || (productMap[it.barcode] && productMap[it.barcode].unit) || '';
                return `${it.barcode} ${pname} x${it.qty||0} ${unit ? '('+unit+')' : ''}`;
              }
              return JSON.stringify(it);
            }).join('<br>');
          } else if (typeof v === 'object' && v !== null) {
            disp = JSON.stringify(v);
          } else {
            disp = v === undefined ? '' : `${v}`;
          }
          cells.push(`<td title="${disp}">${disp}</td>`);
        });
        cells.push(`<td><button class="btn btn-sm btn-outline-primary me-1 view-doc">عرض/تعديل</button><button class="btn btn-sm btn-outline-danger delete-doc">حذف</button></td>`);
        tr.innerHTML = cells.join('');

        const viewBtn = tr.querySelector('.view-doc');
        if (viewBtn) viewBtn.addEventListener('click', () => openDocModal(d.id, d));
        const delBtn = tr.querySelector('.delete-doc');
        if (delBtn) delBtn.addEventListener('click', async () => {
          if (!await appConfirm('هل أنت متأكد من حذف هذا المستند نهائياً؟')) return;
          try { await window.firebaseHelpers.deleteDocument(activeCollection, d.id); showAlert('تم الحذف', 'success'); loadCollection(activeCollection); } catch (err) { console.error(err); showAlert('خطأ أثناء الحذف', 'danger'); }
        });

        docsTableBody.appendChild(tr);
      });
      // attach export toolbar if available
      if (window.exports && window.exports.autoAttachExportToolbar) window.exports.autoAttachExportToolbar();
    } catch (err) { console.error(err); showAlert('خطأ أثناء تحميل المستندات', 'danger'); docsTableBody.innerHTML = '<tr><td colspan="3" class="text-danger">خطأ أثناء التحميل</td></tr>'; }
  }

  function openDocModal(id, data) {
    docIdEl.innerText = id || 'new';
    docJsonEl.value = JSON.stringify(data || {}, null, 2);
    if (docModal) docModal.show();
  }

  saveDocBtn.addEventListener('click', async () => {
    const raw = docJsonEl.value.trim();
    let obj;
    try { obj = raw ? JSON.parse(raw) : {}; } catch (err) { showAlert('خطأ في JSON: ' + err.message, 'warning'); return; }
    const id = docIdEl.innerText;
    try {
      if (id === 'new') {
        await window.firebaseHelpers.addDocument(activeCollection, obj);
        showAlert('تم إنشاء المستند', 'success');
      } else {
        // remove id and do update
        delete obj.id;
        await window.firebaseHelpers.updateDocument(activeCollection, id, obj);
        showAlert('تم حفظ التغييرات', 'success');
      }
      if (docModal) docModal.hide();
      loadCollection(activeCollection);
    } catch (err) { console.error(err); showAlert('حدث خطأ أثناء الحفظ', 'danger'); }
  });

  deleteDocBtn.addEventListener('click', async () => {
    const id = docIdEl.innerText;
    if (!id || id === 'new') { showAlert('لا يوجد مستند للحذف', 'warning'); return; }
    if (!await appConfirm('هل أنت متأكد من حذف هذا المستند نهائياً؟')) return;
    try { await window.firebaseHelpers.deleteDocument(activeCollection, id); showAlert('تم الحذف', 'success'); if (docModal) docModal.hide(); loadCollection(activeCollection); } catch (err) { console.error(err); showAlert('خطأ أثناء الحذف', 'danger'); }
  });

  addDocBtn.addEventListener('click', () => { docIdEl.innerText = 'new'; docJsonEl.value = '{}'; if (docModal) docModal.show(); });

  // search
  searchBox.addEventListener('input', () => {
    const q = searchBox.value.trim().toLowerCase();
    Array.from(docsTableBody.querySelectorAll('tr')).forEach(tr => {
      const txt = tr.innerText.toLowerCase(); tr.style.display = q && !txt.includes(q) ? 'none' : '';
    });
  });

  exportJsonBtn.addEventListener('click', () => {
    if (!currentDocs.length) { showAlert('لا توجد مستندات للتصدير', 'warning'); return; }
    const data = JSON.stringify(currentDocs, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${activeCollection || 'collection'}.json`; a.click(); URL.revokeObjectURL(url);
  });

  // export summary of collections (name, displayName, count, sample fields)
  const exportSummaryBtn = document.getElementById('exportSummary');
  if (exportSummaryBtn) exportSummaryBtn.addEventListener('click', async () => {
    const out = [];
    for (const name of knownCollections) {
      try {
        const docs = await window.firebaseHelpers.getAll(name);
        if (!docs || docs.length === 0) continue;
        const meta = collectionMeta[name] || {};
        const sample = docs[0] || {};
        const keys = Object.keys(sample).filter(k => k !== 'id');
        out.push({ collection: `stock_${name}`, displayName: meta.displayName || '', count: docs.length, sampleFields: keys.slice(0,6) });
      } catch (err) { /* ignore */ }
    }
    if (!out.length) { showAlert('لا توجد بيانات للتصدير', 'warning'); return; }
    const csv = ['collection,displayName,count,sampleFields', ...out.map(r => `${r.collection},"${r.displayName}",${r.count},"${r.sampleFields.join('|')}"`) ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `collections_summary.csv`; a.click(); URL.revokeObjectURL(url);
  });

  // localStorage inspector
  function renderLocalStorage() {
    localStorageList.innerHTML = '';
    if (!localStorage.length) return localStorageList.innerHTML = '<div class="text-muted">لا توجد مفاتيح في localStorage</div>';
    for (let i=0;i<localStorage.length;i++) {
      const key = localStorage.key(i); const val = localStorage.getItem(key);
      const div = document.createElement('div'); div.className = 'd-flex justify-content-between align-items-start mb-2';
      div.innerHTML = `<div><strong>${key}</strong><div class="text-muted small">${val && val.length>200 ? val.slice(0,200)+ '...' : val}</div></div><div><button class="btn btn-sm btn-outline-primary edit-ls me-1">تعديل</button><button class="btn btn-sm btn-outline-danger del-ls">حذف</button></div>`;
      div.querySelector('.edit-ls').addEventListener('click', async () => {
        const newVal = await appPrompt('قيمة جديدة للمفتاح: ' + key, val);
        if (newVal === null) return; localStorage.setItem(key, newVal); renderLocalStorage(); showAlert('تم التحديث','success');
      });
      div.querySelector('.del-ls').addEventListener('click', async () => {
        if (!await appConfirm('هل تريد حذف المفتاح: '+key+' ؟')) return; localStorage.removeItem(key); renderLocalStorage(); showAlert('تم الحذف','success');
      });
      // add quick helper to show parsed JSON nicely
      const preview = div.querySelector('.text-muted small');
      try { const parsed = JSON.parse(val); preview.innerHTML = `<pre style="white-space:pre-wrap;max-height:120px;overflow:auto;">${JSON.stringify(parsed,null,2).slice(0,400)}</pre>`; } catch(e) { /* not JSON */ }
      localStorageList.appendChild(div);
    }
  }

  // translations modal handlers
  const translationsModalEl = document.getElementById('translationsModal');
  const translationsModal = translationsModalEl ? new bootstrap.Modal(translationsModalEl) : null;
  const transCollectionName = document.getElementById('transCollectionName');
  const transCollectionDisplay = document.getElementById('transCollectionDisplay');
  const transFieldJson = document.getElementById('transFieldJson');
  const saveTransBtn = document.getElementById('saveTransBtn');

  function openTranslationsModal(name) {
    const meta = collectionMeta[name] || {};
    transCollectionName.innerText = name;
    transCollectionDisplay.value = meta.displayName || '';
    transFieldJson.value = JSON.stringify(meta.fieldLabels || {}, null, 2);
    if (translationsModal) translationsModal.show();
    saveTransBtn.onclick = async () => {
      let obj;
      try { obj = transFieldJson.value ? JSON.parse(transFieldJson.value) : {}; } catch (err) { showAlert('JSON غير صالح', 'warning'); return; }
      try {
        await window.firebaseHelpers.collectionRef('collection_meta').doc(name).set({ displayName: transCollectionDisplay.value.trim(), fieldLabels: obj });
        showAlert('تم حفظ الترجمات', 'success');
        if (translationsModal) translationsModal.hide();
      } catch (err) { console.error(err); showAlert('خطأ أثناء الحفظ', 'danger'); }
    };
  }

  // wire top controls
  loadCollectionBtn.addEventListener('click', () => { const v = collectionNameInput.value.trim(); if (!v) { showAlert('أدخل اسم المجموعة (بدون prefix)','warning'); return; } if (!knownCollections.includes(v)) knownCollections.unshift(v); loadCollection(v); renderCollections(); });
  refreshCollectionsBtn.addEventListener('click', renderCollections);
  refreshDocs.addEventListener('click', () => { if (activeCollection) loadCollection(activeCollection); else showAlert('اختر مجموعة أولاً', 'warning'); });
  refreshLocal.addEventListener('click', renderLocalStorage);

  // initial load
  renderCollections(); renderLocalStorage();
  // initial load
  renderCollections(); renderLocalStorage();
});