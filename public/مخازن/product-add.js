document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('addProductForm');
  const unitSelect = document.getElementById('productUnit');
  const unitWeightGroup = document.getElementById('unitWeightGroup');
  const unitWeightInput = document.getElementById('productUnitWeight');
  const sectionSelect = document.getElementById('productSection');
  const subsectionSelect = document.getElementById('productSubsection');
  const packArabicInput = document.getElementById('productPackArabic');
  const packNumberInput = document.getElementById('productPackNumber');
  const packUnitSelect = document.getElementById('productPackUnit');
  const processingFactorInput = document.getElementById('productProcessingFactor');
  if (!form) return;
  let selectedProductId = null;
  const queryBtn = document.getElementById('productQueryBtn');
  const queryModal = document.getElementById('productQueryModal');
  const queryList = document.getElementById('productQueryList');
  const queryFilter = document.getElementById('productQueryFilter');
  const updateBtn = document.getElementById('updateBtn');
  const deleteBtn = document.getElementById('deleteBtn');
  const saveNewBtn = document.getElementById('saveNewBtn');

  // show weight input for units that require it
  const unitsWithWeight = ['جالون', 'بولة', 'شكارة', 'كرتونة'];
  function toggleUnitWeight() {
    const u = unitSelect.value;
    if (unitsWithWeight.includes(u)) unitWeightGroup.style.display = '';
    else unitWeightGroup.style.display = 'none';
  }
  unitSelect.addEventListener('change', toggleUnitWeight);
  toggleUnitWeight();

  // subsection population for 'مواد غذائية'
  const foodSubsections = [
    'لحوم','اسماك','دجاج','الالبان ومشتقاتها','زيوت وسمن','مواد جافة','عطاره','خضروات'
  ];
  function updateSubsectionVisibility() {
    if (!sectionSelect) return;
    if (sectionSelect.value === 'مواد غذائية') {
      if (subsectionSelect) {
        subsectionSelect.style.display = '';
        subsectionSelect.innerHTML = '<option value="">اختر التصنيف الفرعي...</option>' + foodSubsections.map(s => `<option value="${s}">${s}</option>`).join('');
      }
    } else {
      if (subsectionSelect) {
        subsectionSelect.style.display = 'none';
        subsectionSelect.value = '';
      }
    }
  }
  if (sectionSelect) sectionSelect.addEventListener('change', updateSubsectionVisibility);
  updateSubsectionVisibility();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      name: document.getElementById('productName').value.trim(),
      barcode: document.getElementById('productBarcode').value.trim(),
      section: sectionSelect ? sectionSelect.value : '',
      subsection: subsectionSelect && subsectionSelect.style.display !== 'none' ? subsectionSelect.value : '',
      unit: unitSelect.value,
      unitWeight: unitWeightInput.value ? parseFloat(unitWeightInput.value) : null,
      pack: {
        labelArabic: packArabicInput ? (packArabicInput.value || '').trim() : '',
        quantity: packNumberInput ? (parseFloat(packNumberInput.value) || null) : null,
        unit: packUnitSelect ? packUnitSelect.value : ''
      },
      purchasePrice: parseFloat(document.getElementById('productPurchasePrice').value) || 0,
      reorderLevel: parseFloat(document.getElementById('productReorder').value) || 0,
      processingFactor: processingFactorInput ? (parseFloat(processingFactorInput.value) || 0) : 0,
      location: document.getElementById('productLocation').value.trim(),
      description: document.getElementById('productDescription').value.trim(),
      quantity: 0
    };

    try {
      if (selectedProductId) {
        await window.firebaseHelpers.updateDocument('products', selectedProductId, data);
        showAlert('تم تحديث الصنف بنجاح', 'success');
      } else {
        await window.firebaseHelpers.addDocument('products', data);
        showAlert('تم حفظ الصنف بنجاح', 'success');
      }
      form.reset();
      selectedProductId = null;
      if (updateBtn) updateBtn.style.display = 'none';
      if (deleteBtn) deleteBtn.style.display = 'none';
      if (saveNewBtn) saveNewBtn.style.display = '';
      setTimeout(() => location.href = 'products.html', 800);
    } catch (err) {
      console.error(err);
      showAlert('حدث خطأ أثناء الحفظ', 'danger');
    }
  });

  // product query/modal handlers
  function openQueryModal(filterText = '') {
    if (!queryList) return;
    queryList.innerHTML = '<div class="text-muted small">جارٍ التحميل...</div>';
    try {
      if (!filterText) {
        window.firebaseHelpers.getAll('products').then(items => renderQueryList(items));
      } else {
        window.firebaseHelpers.collectionRef('products').where('barcode', '==', filterText).get().then(snap => {
          if (!snap.empty) return renderQueryList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
          return window.firebaseHelpers.getAll('products').then(items => renderQueryList(items.filter(i => (i.name||'').toLowerCase().includes(filterText.toLowerCase()) || (i.barcode||'').toLowerCase().includes(filterText.toLowerCase()))));
        }).catch(() => window.firebaseHelpers.getAll('products').then(items => renderQueryList(items)));
      }
    } catch (e) { console.error(e); }
    try { const m = new bootstrap.Modal(queryModal); m.show(); } catch(e){}
  }

  function renderQueryList(items) {
    if (!queryList) return;
    if (!items || !items.length) { queryList.innerHTML = '<div class="text-muted small">لا توجد نتائج</div>'; return; }
    queryList.innerHTML = items.map(it => `<button type="button" class="list-group-item list-group-item-action" data-id="${it.id}"><div><strong>${(it.name||'')}</strong> <small class="text-muted">${it.barcode||''}</small></div><div class="small text-muted">${it.section||''} ${it.subsection?'- '+it.subsection:''}</div></button>`).join('');
    Array.from(queryList.querySelectorAll('button')).forEach(btn => btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      if (!id) return;
      try {
        const doc = await window.firebaseHelpers.collectionRef('products').doc(id).get();
        const data = doc.data() || {};
        document.getElementById('productName').value = data.name || '';
        document.getElementById('productBarcode').value = data.barcode || '';
        if (sectionSelect) sectionSelect.value = data.section || '';
        updateSubsectionVisibility();
        if (subsectionSelect) subsectionSelect.value = data.subsection || '';
        if (unitSelect) unitSelect.value = data.unit || '';
        if (unitWeightInput) unitWeightInput.value = data.unitWeight || '';
        if (packArabicInput) packArabicInput.value = (data.pack && data.pack.labelArabic) || '';
        if (packNumberInput) packNumberInput.value = (data.pack && data.pack.quantity) || '';
        if (packUnitSelect) packUnitSelect.value = (data.pack && data.pack.unit) || '';
        document.getElementById('productPurchasePrice').value = data.purchasePrice || data.buyPrice || data.cost || '';
        document.getElementById('productReorder').value = data.reorderLevel || '';
        if (processingFactorInput) processingFactorInput.value = data.processingFactor || '';
        document.getElementById('productLocation').value = data.location || '';
        document.getElementById('productDescription').value = data.description || '';
        selectedProductId = id;
        if (updateBtn) updateBtn.style.display = '';
        if (deleteBtn) deleteBtn.style.display = '';
        if (saveNewBtn) saveNewBtn.style.display = 'none';
        try { bootstrap.Modal.getInstance(queryModal).hide(); } catch(e){}
      } catch (err) { console.error(err); }
    }));
  }

  if (queryBtn) queryBtn.addEventListener('click', () => openQueryModal(document.getElementById('productBarcode').value.trim()));
  if (queryFilter) queryFilter.addEventListener('input', () => openQueryModal(queryFilter.value.trim()));

  // F1 on barcode input opens the query modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'F1') {
      const active = document.activeElement;
      if (active && active.getAttribute && active.getAttribute('data-product-query') !== null) {
        e.preventDefault();
        openQueryModal(active.value.trim());
      }
    }
  });

  // update and delete handlers
  if (updateBtn) updateBtn.addEventListener('click', async () => {
    if (!selectedProductId) return showAlert('لم يتم اختيار صنف للتعديل', 'warning');
    const data = {
      name: document.getElementById('productName').value.trim(),
      barcode: document.getElementById('productBarcode').value.trim(),
      section: sectionSelect ? sectionSelect.value : '',
      subsection: subsectionSelect && subsectionSelect.style.display !== 'none' ? subsectionSelect.value : '',
      unit: unitSelect.value,
      unitWeight: unitWeightInput.value ? parseFloat(unitWeightInput.value) : null,
      pack: {
        labelArabic: packArabicInput ? (packArabicInput.value || '').trim() : '',
        quantity: packNumberInput ? (parseFloat(packNumberInput.value) || null) : null,
        unit: packUnitSelect ? packUnitSelect.value : ''
      },
      purchasePrice: parseFloat(document.getElementById('productPurchasePrice').value) || 0,
      reorderLevel: parseFloat(document.getElementById('productReorder').value) || 0,
      processingFactor: processingFactorInput ? (parseFloat(processingFactorInput.value) || 0) : 0,
      location: document.getElementById('productLocation').value.trim(),
      description: document.getElementById('productDescription').value.trim()
    };
    try {
      await window.firebaseHelpers.updateDocument('products', selectedProductId, data);
      showAlert('تم حفظ التعديلات', 'success');
      form.reset();
      selectedProductId = null;
      if (updateBtn) updateBtn.style.display = 'none';
      if (deleteBtn) deleteBtn.style.display = 'none';
      if (saveNewBtn) saveNewBtn.style.display = '';
      setTimeout(() => location.href = 'products.html', 400);
    } catch (err) { console.error(err); showAlert('خطأ أثناء الحفظ','danger'); }
  });

  if (deleteBtn) deleteBtn.addEventListener('click', async () => {
    if (!selectedProductId) return showAlert('لم يتم اختيار صنف للحذف', 'warning');
    if (!confirm('هل أنت متأكد من حذف هذا الصنف؟')) return;
    try {
      await window.firebaseHelpers.deleteDocument('products', selectedProductId);
      showAlert('تم الحذف', 'secondary');
      form.reset();
      selectedProductId = null;
      if (updateBtn) updateBtn.style.display = 'none';
      if (deleteBtn) deleteBtn.style.display = 'none';
      if (saveNewBtn) saveNewBtn.style.display = '';
      setTimeout(() => location.href = 'products.html', 400);
    } catch (err) { console.error(err); showAlert('خطأ أثناء الحذف','danger'); }
  });
});