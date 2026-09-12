document.addEventListener('DOMContentLoaded', () => {
  const openReqsBtn = document.getElementById('openReqsBtn');
  const openIssuesBtn = document.getElementById('openIssuesBtn');
  const openInboundBtn = document.getElementById('openInboundBtn');
  const manageModal = new bootstrap.Modal(document.getElementById('manageModal'));
  // modal stack to support nested modals with a Back button
  const modalStack = [];
  const modalInstances = {};
  let isClosingAll = false;

  function closeAllModals() {
    if (isClosingAll) return;
    isClosingAll = true;
    try {
      const copy = modalStack.slice().reverse();
      for (const id of copy) {
        const inst = getModalInstance(id);
        try { if (inst) inst.hide(); } catch(e){}
      }
      modalStack.length = 0;
    } finally {
      // small delay to allow Bootstrap events to settle
      setTimeout(() => { isClosingAll = false; }, 300);
    }
  }

  function getModalInstance(id) {
    if (!id) return null;
    if (modalInstances[id]) return modalInstances[id];
    const el = document.getElementById(id);
    if (!el) return null;
    modalInstances[id] = new bootstrap.Modal(el, { backdrop: 'static' });
    // ensure hidden event keeps stack consistent
    el.addEventListener('hidden.bs.modal', () => {
      if (isClosingAll) return; // when closing all, skip stack logic
      // if this modal was top, pop it
      const top = modalStack[modalStack.length-1];
      if (top === id) {
        modalStack.pop();
        const prev = modalStack[modalStack.length-1];
        if (prev) {
          const prevInst = getModalInstance(prev);
          if (prevInst) prevInst.show();
        }
      }
      // hide any back button on this modal
      try { const elFooter = document.getElementById(id); if (elFooter) { const b = elFooter.querySelector('.modal-back-btn'); if (b) b.classList.add('d-none'); } } catch(e){}
    });
    return modalInstances[id];
  }

  function openModal(id) {
    if (!id) return;
    const inst = getModalInstance(id);
    if (!inst) return;
    // hide current top
    const top = modalStack[modalStack.length-1];
    if (top && top !== id) {
      const topInst = getModalInstance(top);
      try { if (topInst) topInst.hide(); } catch(e){}
    }
    // push and show
    modalStack.push(id);
    // show back button when stack depth > 1
    try { const el = document.getElementById(id); const b = el && el.querySelector('.modal-back-btn'); if (b) { if (modalStack.length > 1) b.classList.remove('d-none'); else b.classList.add('d-none'); } } catch(e){}
    inst.show();
  }

  function goBackModal() {
    if (!modalStack.length) return;
    const top = modalStack.pop();
    const topInst = getModalInstance(top);
    try { if (topInst) topInst.hide(); } catch(e){}
    const prev = modalStack[modalStack.length-1];
    if (prev) {
      const prevInst = getModalInstance(prev);
      try { if (prevInst) prevInst.show(); } catch(e){}
    }
  }

  // delegate back button clicks
  document.addEventListener('click', (ev) => {
    const b = ev.target.closest && ev.target.closest('.modal-back-btn');
    if (b) {
      ev.preventDefault(); goBackModal();
    }
  });

  // When any modal begins to hide (user presses close/esc/backdrop), collapse all modals
  document.addEventListener('hide.bs.modal', (e) => {
    if (isClosingAll) return;
    // start a full close so no modals remain stacked
    closeAllModals();
  });
  const manageModalTitle = document.getElementById('manageModalTitle');
  const manageThead = document.getElementById('manageThead');
  const manageTbody = document.getElementById('manageTbody');
  const selectAllBtn = document.getElementById('selectAllBtn');
  const clearSelectionBtn = document.getElementById('clearSelectionBtn');
  const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
  const manageSearch = document.getElementById('manageSearch');
  const manageDateFrom = document.getElementById('manageDateFrom');
  const manageDateTo = document.getElementById('manageDateTo');
  const manageSectionFilter = document.getElementById('manageSectionFilter');
  const runFilterBtn = document.getElementById('runFilterBtn');
  const clearFilterBtn = document.getElementById('clearFilterBtn');

  let currentCollection = null;
  let currentDocs = [];
  let includeItemCols = true;

  function formatDate(d) {
    if (!d) return '';
    try { return new Date(d).toLocaleString('ar-EG'); } catch(e){return String(d);} 
  }

  // normalize various document shapes to a common structure used by the admin UI
  function normalizeDocData(raw) {
    if (!raw || typeof raw !== 'object') return { ...raw };
    const data = Object.assign({}, raw);
    // normalize supplier / recipient
    data.supplier = data.supplier || data.supplierName || data.vendor || (data.supplierObj && (data.supplierObj.name || data.supplierObj.displayName)) || data.party || '';
    data.recipient = data.recipient || data.recipientName || data.requestedBy || data.applicant || '';
    // normalize items array - check common keys
    const itemsCandidates = data.items || data.rows || data.lines || data.details || data.itemsList || data.products || null;
    if (Array.isArray(itemsCandidates)) {
      data.items = itemsCandidates.map(it => {
        if (!it) return { name: '', code: '', qty: 0, section: it && it.section };
        const name = it.name || it.productName || it.title || it.label || it.itemName || it.description || '';
        const code = it.code || it.barcode || it.productCode || it.sku || it.itemCode || '';
        const qty = Number(it.qty || it.quantity || it.amount || it.requestedQty || it.qtyRequested || 0) || 0;
        const section = it.section || '';
        return { name, code, qty, section };
      });
    } else {
      data.items = [];
    }
    // normalize number/date/applicant
    data.number = data.number || data.id || data.refNumber || data.invoiceNumber || data.issueNumber || '';
    data.date = data.date || data.createdAt || data.dateCreated || data.invoiceDate || data.requestDate || data.reqDate || '';
    data.applicant = data.applicant || data.requester || data.requestedBy || data.createdBy || data.user || data.employee || '';
    data.section = data.section || data.reqSection || '';
    return data;
  }

  function renderTableHeader(columns, withItemCols = true) {
    manageThead.innerHTML = '';
    // add checkbox column
    const thCheck = document.createElement('th'); thCheck.innerHTML = '';
    manageThead.appendChild(thCheck);
    columns.forEach(c => {
      const th = document.createElement('th'); th.textContent = c.label; manageThead.appendChild(th);
    });
    if (withItemCols) {
      const thNames = document.createElement('th'); thNames.textContent = 'اسم الصنف'; manageThead.appendChild(thNames);
      const thCodes = document.createElement('th'); thCodes.textContent = 'كود الصنف'; manageThead.appendChild(thCodes);
    }
    const thActions = document.createElement('th'); thActions.textContent = 'إجراءات'; manageThead.appendChild(thActions);
  }

  function sanitizeId(s) { return String(s).replace(/[^a-zA-Z0-9_-]/g,'_'); }

  function renderTableRows(columns, docsList = null, withItemCols = true) {
    manageTbody.innerHTML = '';
    const rows = docsList || currentDocs;
    rows.forEach(doc => {
      const tr = document.createElement('tr');
      const chkTd = document.createElement('td');
      const chk = document.createElement('input'); chk.type = 'checkbox'; chk.className = 'row-check form-check-input'; chk.dataset.id = doc.id;
      chkTd.appendChild(chk); tr.appendChild(chkTd);
      columns.forEach(c => {
        const td = document.createElement('td');
        const v = typeof c.key === 'function' ? c.key(doc.data) : (doc.data[c.key] || '');
        td.innerHTML = (c.isDate ? formatDate(v) : (v === null || v === undefined ? '' : String(v)));
        tr.appendChild(td);
      });
      if (withItemCols) {
        // اسم الصنف و كود الصنف columns (show items inline)
        const namesTd = document.createElement('td');
        const codesTd = document.createElement('td');
        if (doc.data && doc.data.items && Array.isArray(doc.data.items) && doc.data.items.length) {
          const nameParts = doc.data.items.map(i => i.name || '');
          const codeParts = doc.data.items.map(i => i.code || '');
          namesTd.innerHTML = nameParts.map(n => `<div>${n}</div>`).join('');
          codesTd.innerHTML = codeParts.map(c => `<div>${c}</div>`).join('');
        } else {
          namesTd.innerHTML = '<small class="text-muted">-</small>';
          codesTd.innerHTML = '<small class="text-muted">-</small>';
        }
        tr.appendChild(namesTd);
        tr.appendChild(codesTd);
      }
      const actTd = document.createElement('td');
      const delBtn = document.createElement('button'); delBtn.className = 'btn btn-sm btn-outline-danger'; delBtn.innerHTML = 'حذف';
      delBtn.addEventListener('click', () => deleteSingle(doc.id));
      actTd.appendChild(delBtn);
      tr.appendChild(actTd);
      manageTbody.appendChild(tr);
    });
  }

  async function fetchCollection(name) {
    currentCollection = name;
    manageTbody.innerHTML = '<tr><td colspan="6" class="text-muted">جارٍ التحميل...</td></tr>';
    try {
      const snap = await window.firebaseHelpers.collectionRef(name).get();
      // for products return raw product data (no normalization to items)
      if (name === 'products') {
        currentDocs = snap.docs.map(d => ({ id: d.id, data: (d.data() || {}) }));
      } else {
        currentDocs = snap.docs.map(d => ({ id: d.id, data: normalizeDocData(d.data()) }));
      }

      // If documents don't include embedded items (common for issues/invoices),
      // try to populate items from the movements collection linked by invoiceId/issueId.
      if (name === 'issues' || name === 'invoices') {
        // fetch movements once and group by linked id
        const mvSnap = await window.firebaseHelpers.collectionRef('movements').get();
        const mvByIssue = {};
        const mvByInvoice = {};
        mvSnap.docs.forEach(m => {
          const md = m.data() || {};
          if (md.issueId) {
            mvByIssue[md.issueId] = mvByIssue[md.issueId] || [];
            mvByIssue[md.issueId].push(md);
          }
          if (md.invoiceId) {
            mvByInvoice[md.invoiceId] = mvByInvoice[md.invoiceId] || [];
            mvByInvoice[md.invoiceId].push(md);
          }
        });

        // attach items from movements when missing
        currentDocs = currentDocs.map(d => {
          const copy = { id: d.id, data: Object.assign({}, d.data) };
          if ((!copy.data.items || !copy.data.items.length) && name === 'issues') {
            const mvs = mvByIssue[d.id] || [];
            if (mvs.length) {
              copy.data.items = mvs.map(m => ({ name: m.productName || '', code: m.productBarcode || m.productCode || '', qty: Number(m.qty || 0), section: m.section || '' }));
            }
          }
          if ((!copy.data.items || !copy.data.items.length) && name === 'invoices') {
            const mvs = mvByInvoice[d.id] || [];
            if (mvs.length) {
              copy.data.items = mvs.map(m => ({ name: m.productName || '', code: m.productBarcode || m.productCode || '', qty: Number(m.qty || 0), section: m.section || '' }));
            }
          }
          return copy;
        });
      }

      return currentDocs;
    } catch (err) {
      console.error('fetchCollection error', err);
      currentDocs = [];
      manageTbody.innerHTML = '<tr><td colspan="6" class="text-danger">خطأ في تحميل البيانات</td></tr>';
      return [];
    }
  }

  async function openManager(name) {
    let columns = [];
    if (name === 'requisition_requests') {
      manageModalTitle.textContent = 'طلبات الصرف';
      columns = [
        { label: 'رقم الطلب', key: 'number' },
        { label: 'التاريخ', key: 'date', isDate: true },
        { label: 'مقدم الطلب', key: 'applicant' }
      ];
    } else if (name === 'products') {
      manageModalTitle.textContent = 'الأصناف';
      columns = [
        { label: 'كود الصنف', key: (d)=> d.barcode || d.code || d.id },
        { label: 'اسم المنتج', key: 'name' },
        { label: 'القسم', key: 'section' },
        { label: 'التصنيف الفرعي', key: 'subsection' },
        { label: 'الكمية المتاحة', key: (d)=> `<span class="badge bg-primary">${d.quantity||0}</span>` },
        { label: 'وحدة', key: (d)=> d.unit ? d.unit + (d.unitWeight ? ' ('+d.unitWeight+' كجم)' : '') : '' },
        { label: 'شد الصنف', key: (d)=> { const p = d.pack || {}; return p.labelArabic ? (p.labelArabic + (p.quantity ? ' ×'+p.quantity : '') + (p.unit ? ' '+p.unit : '')) : ''; } },
        { label: 'سعر الشراء', key: (d)=> formatCurrency(d.purchasePrice || d.cost || d.buyPrice || 0) },
        { label: 'معامل التجهيز', key: 'processingFactor' }
      ];
    } else if (name === 'issues') {
      manageModalTitle.textContent = 'أذون الصرف';
      columns = [
        { label: 'رقم الإذن', key: 'number' },
        { label: 'التاريخ', key: 'date', isDate: true },
        { label: 'الجهة', key: 'recipient' }
      ];
    } else if (name === 'invoices' || name === 'inbound' ) {
      manageModalTitle.textContent = 'الوارد';
      columns = [
        { label: 'رقم الفاتورة', key: 'number' },
        { label: 'التاريخ', key: 'date', isDate: true },
        { label: 'المورد', key: 'supplier' }
      ];
    }

    // determine whether to show item columns
    includeItemCols = (name !== 'products');
    renderTableHeader(columns, includeItemCols);

    // hide date filters for products and attach section suggestions
    try {
      if (name === 'products') {
        if (manageDateFrom) manageDateFrom.style.display = 'none';
        if (manageDateTo) manageDateTo.style.display = 'none';
        // attach datalist for section suggestions
        let dl = document.getElementById('manageSectionList');
        if (!dl) { dl = document.createElement('datalist'); dl.id = 'manageSectionList'; document.body.appendChild(dl); }
        // populate sections
        try {
          const secs = await window.firebaseHelpers.collectionRef('sections').get();
          dl.innerHTML = secs.docs.map(s => `<option value="${(s.data() && s.data().name) ? s.data().name : s.id}"></option>`).join('');
          if (manageSectionFilter) manageSectionFilter.setAttribute('list','manageSectionList');
        } catch(e){ console.warn('failed to load sections for admin filter', e); }
      } else {
        if (manageDateFrom) manageDateFrom.style.display = '';
        if (manageDateTo) manageDateTo.style.display = '';
        if (manageSectionFilter) manageSectionFilter.removeAttribute('list');
      }
    } catch(e){ console.warn(e); }

    const docs = await fetchCollection(name);
    // transform docs to consistent shape
    currentDocs = docs.map(d => ({ id: d.id, data: d.data }));
    // initially show all
    renderTableRows(columns, null, includeItemCols);
    openModal('manageModal');
  }

  async function deleteSingle(id) {
    if (!confirm('هل أنت متأكد من الحذف؟')) return;
    try {
      await window.firebaseHelpers.deleteDocument(currentCollection, id);
      // remove from view
      currentDocs = currentDocs.filter(d => d.id !== id);
      Array.from(manageTbody.querySelectorAll('.row-check')).forEach(cb => { if (cb.dataset.id === id) cb.closest('tr').remove(); });
    } catch (err) { console.error(err); alert('خطأ أثناء الحذف'); }
  }

  async function deleteSelected() {
    const checks = Array.from(manageTbody.querySelectorAll('.row-check:checked'));
    if (!checks.length) return alert('لا يوجد عناصر محددة');
    if (!confirm(`هل تريد حذف ${checks.length} عنصر؟`)) return;
    try {
      for (const cb of checks) {
        await window.firebaseHelpers.deleteDocument(currentCollection, cb.dataset.id);
      }
      // refresh
      await openManager(currentCollection);
    } catch (err) { console.error(err); alert('خطأ أثناء حذف العناصر'); }
  }

  selectAllBtn.addEventListener('click', () => {
    Array.from(manageTbody.querySelectorAll('.row-check')).forEach(cb => cb.checked = true);
  });
  clearSelectionBtn.addEventListener('click', () => {
    Array.from(manageTbody.querySelectorAll('.row-check')).forEach(cb => cb.checked = false);
  });
  deleteSelectedBtn.addEventListener('click', deleteSelected);

  // filtering
  function docMatchesSearch(doc, term) {
    if (!term) return true;
    const t = term.toLowerCase();
    // products have different searchable fields
    if (currentCollection === 'products') {
      const d = doc.data || {};
      const candidates = [d.name, d.barcode, d.code, d.section, d.subsection, d.unit, d.processingFactor];
      for (const c of candidates) if (c && String(c).toLowerCase().includes(t)) return true;
      // pack labels
      if (d.pack && (d.pack.labelArabic || d.pack.label)) {
        const pl = (d.pack.labelArabic || d.pack.label).toLowerCase(); if (pl.includes(t)) return true;
      }
      return false;
    }
    // check common fields for non-products
    for (const k of ['number','applicant','supplier','recipient','section']) {
      const v = doc.data[k]; if (v && String(v).toLowerCase().includes(t)) return true;
    }
    // check items
    if (doc.data.items && Array.isArray(doc.data.items)) {
      for (const it of doc.data.items) {
        if ((it.name && it.name.toLowerCase().includes(t)) || (it.code && String(it.code).toLowerCase().includes(t))) return true;
      }
    }
    return false;
  }

  function docMatchesDate(doc, from, to) {
    // products don't use date filtering
    if (currentCollection === 'products') return true;
    if (!from && !to) return true;
    const d = doc.data.date ? new Date(doc.data.date) : null;
    if (!d) return true;
    if (from) {
      const f = new Date(from); if (d < f) return false;
    }
    if (to) {
      const t = new Date(to); t.setHours(23,59,59,999); if (d > t) return false;
    }
    return true;
  }

  function applyFilters() {
    const term = manageSearch ? manageSearch.value.trim() : '';
    const from = manageDateFrom ? manageDateFrom.value : '';
    const to = manageDateTo ? manageDateTo.value : '';
    const section = manageSectionFilter ? manageSectionFilter.value.trim().toLowerCase() : '';
    // filter currentDocs
    const filtered = currentDocs.filter(doc => {
      if (!docMatchesSearch(doc, term)) return false;
      if (!docMatchesDate(doc, from, to)) return false;
      if (section) {
        const sec = (doc.data.section || '').toLowerCase();
        if (sec.indexOf(section) === -1) {
          // maybe items have section
          if (!(doc.data.items && doc.data.items.some(i => (i.section||'').toLowerCase().includes(section)))) return false;
        }
      }
      return true;
    });
    // maintain columns for current collection
    let columns = [];
    if (currentCollection === 'requisition_requests') columns = [{ label: 'رقم الطلب', key: 'number' },{ label: 'التاريخ', key: 'date', isDate: true },{ label: 'مقدم الطلب', key: 'applicant' }];
    else if (currentCollection === 'issues') columns = [{ label: 'رقم الإذن', key: 'number' },{ label: 'التاريخ', key: 'date', isDate: true },{ label: 'الجهة', key: 'recipient' }];
    else if (currentCollection === 'products') columns = [
      { label: 'كود الصنف', key: (d)=> d.barcode || d.code || d.id },
      { label: 'اسم المنتج', key: 'name' },
      { label: 'القسم', key: 'section' },
      { label: 'التصنيف الفرعي', key: 'subsection' },
      { label: 'الكمية المتاحة', key: (d)=> `<span class="badge bg-primary">${d.quantity||0}</span>` },
      { label: 'وحدة', key: (d)=> d.unit ? d.unit + (d.unitWeight ? ' ('+d.unitWeight+' كجم)' : '') : '' },
      { label: 'شد الصنف', key: (d)=> { const p = d.pack || {}; return p.labelArabic ? (p.labelArabic + (p.quantity ? ' ×'+p.quantity : '') + (p.unit ? ' '+p.unit : '')) : ''; } },
      { label: 'سعر الشراء', key: (d)=> formatCurrency(d.purchasePrice || d.cost || d.buyPrice || 0) },
      { label: 'معامل التجهيز', key: 'processingFactor' }
    ];
    else columns = [{ label: 'الرقم', key: 'number' },{ label: 'التاريخ', key: 'date', isDate: true },{ label: 'الطرف', key: (d)=>d.supplier||d.recipient||'' }];
    renderTableRows(columns, filtered);
  }

  // debounce helper
  function debounce(fn, wait=250){ let t; return function(...a){ clearTimeout(t); t = setTimeout(()=>fn.apply(this,a), wait); }; }

  const debouncedApply = debounce(applyFilters, 250);
  manageSearch && manageSearch.addEventListener('input', debouncedApply);
  manageDateFrom && manageDateFrom.addEventListener('change', debouncedApply);
  manageDateTo && manageDateTo.addEventListener('change', debouncedApply);
  manageSectionFilter && manageSectionFilter.addEventListener('input', debouncedApply);
  runFilterBtn && runFilterBtn.addEventListener('click', applyFilters);
  clearFilterBtn && clearFilterBtn.addEventListener('click', () => { if (manageSearch) manageSearch.value=''; if (manageDateFrom) manageDateFrom.value=''; if (manageDateTo) manageDateTo.value=''; if (manageSectionFilter) manageSectionFilter.value=''; applyFilters(); });

  openReqsBtn && openReqsBtn.addEventListener('click', () => openManager('requisition_requests'));
  openIssuesBtn && openIssuesBtn.addEventListener('click', () => openManager('issues'));
  openInboundBtn && openInboundBtn.addEventListener('click', () => openManager('invoices'));
  const openProductsBtn = document.getElementById('openProductsBtn');
  openProductsBtn && openProductsBtn.addEventListener('click', () => openManager('products'));
   const openUsersBtn = document.getElementById('openUsersBtn');
   if (openUsersBtn) openUsersBtn.addEventListener('click', () => {
     // reset form
     try { document.getElementById('userForm').reset(); document.getElementById('userFormAlert').classList.add('d-none'); document.getElementById('userId').value = ''; } catch(e){}
     openModal('userModal');
   });
  // bind users form submission (ensure available immediately)
  try {
    const userForm = document.getElementById('userForm');
    if (userForm) {
      userForm.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const code = document.getElementById('userCode').value.trim();
        const name = document.getElementById('userName').value.trim();
        const password = document.getElementById('userPassword').value;
        const userId = document.getElementById('userId').value.trim();
        const alertEl = document.getElementById('userFormAlert');
        if (!code || !name) { alertEl.className = 'alert alert-danger'; alertEl.innerText = 'يرجى ملء الحقول الأساسية'; alertEl.classList.remove('d-none'); return; }
        try {
          const collectionName = 'users';
          if (!window.firebaseHelpers) throw new Error('firebaseHelpers unavailable');
          if (userId) {
            // update existing user
            const upd = { code, name };
            if (password) upd.password = btoa(password);
            await window.firebaseHelpers.updateDocument(collectionName, userId, upd);
            console.info('Updated user', userId);
            alertEl.className = 'alert alert-success'; alertEl.innerText = 'تم تحديث المستخدم'; alertEl.classList.remove('d-none');
          } else {
            const stored = { code, name, password: btoa(password), createdAt: new Date().toISOString() };
            const ref = await window.firebaseHelpers.addDocument(collectionName, stored);
            try { const fullName = (window.firebaseHelpers && window.firebaseHelpers._internal && typeof window.firebaseHelpers._internal.ensureName === 'function') ? window.firebaseHelpers._internal.ensureName(collectionName) : collectionName; console.info('Created user', ref && ref.id ? ref.id : ref, 'in collection', fullName); } catch(e){}
            alertEl.className = 'alert alert-success'; alertEl.innerText = 'تم إنشاء المستخدم بنجاح'; alertEl.classList.remove('d-none');
          }
          // refresh users list if visible
          try { if (typeof loadUsersList === 'function') loadUsersList(document.getElementById('usersSearch') ? document.getElementById('usersSearch').value.trim() : ''); } catch(e){}
          // reset form
          document.getElementById('userForm').reset(); document.getElementById('userId').value = '';
          setTimeout(() => { const m = bootstrap.Modal.getInstance(document.getElementById('userModal')); if (m) m.hide(); }, 800);
        } catch (err) {
          console.error('create/update user failed', err);
          alertEl.className = 'alert alert-danger'; alertEl.innerText = 'فشل إنشاء/تحديث المستخدم: ' + (err && err.message ? err.message : 'خطأ'); alertEl.classList.remove('d-none');
        }
      });
    }
  } catch (e) { console.warn('user form binding failed', e); }

  // helper: parse createdAt values (supports Firestore Timestamp and ISO)
  function parseDateValue(v) {
    if (!v) return '';
    try { if (typeof v.toDate === 'function') return v.toDate().toLocaleString('ar-EG'); } catch(e){}
    try { return new Date(v).toLocaleString('ar-EG'); } catch(e) { return String(v); }
  }

  // Load and render users list into the users list modal
  async function loadUsersList(filter = '') {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4" class="text-muted">جارٍ التحميل...</td></tr>';
    try {
      const docs = await window.firebaseHelpers.getAll('users');
      let list = Array.isArray(docs) ? docs : [];
      // optional filter
      if (filter) {
        const f = filter.toLowerCase();
        list = list.filter(u => (u.code||'').toLowerCase().includes(f) || (u.name||'').toLowerCase().includes(f));
      }
      if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-muted">لا يوجد مستخدمين</td></tr>';
        return;
      }
      // sort by createdAt desc if available
      list.sort((a,b) => { const ta = a.createdAt && a.createdAt.toDate ? a.createdAt.toDate().getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0); const tb = b.createdAt && b.createdAt.toDate ? b.createdAt.toDate().getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0); return tb - ta; });
      tbody.innerHTML = list.map(u => {
        const created = parseDateValue(u.createdAt) || '';
        return `<tr><td>${escapeHtml(u.code||'')}</td><td>${escapeHtml(u.name||'')}</td><td>${created}</td><td class="users-action"><button data-id="${u.id}" class="btn btn-sm btn-outline-primary edit-user-btn">تعديل</button><button data-id="${u.id}" class="btn btn-sm btn-outline-danger delete-user-btn">حذف</button></td></tr>`;
      }).join('');

      // attach handlers
      Array.from(tbody.querySelectorAll('.edit-user-btn')).forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const id = btn.dataset.id;
          try {
            const col = await window.firebaseHelpers.collectionRef('users').doc(id).get();
            const data = col && col.exists ? col.data() : null;
            if (!data) return alert('المستخدم غير موجود');
            document.getElementById('userId').value = id;
            document.getElementById('userCode').value = data.code || '';
            document.getElementById('userName').value = data.name || '';
            document.getElementById('userPassword').value = '';
            openModal('userModal');
          } catch (err) { console.error('failed to load user', err); alert('فشل تحميل بيانات المستخدم'); }
        });
      });
      Array.from(tbody.querySelectorAll('.delete-user-btn')).forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.id;
          if (!confirm('هل تريد حذف هذا المستخدم؟')) return;
          try {
            await window.firebaseHelpers.deleteDocument('users', id);
            loadUsersList(document.getElementById('usersSearch') ? document.getElementById('usersSearch').value.trim() : '');
          } catch (err) { console.error('delete user failed', err); alert('فشل حذف المستخدم'); }
        });
      });
    } catch (err) {
      console.error('loadUsersList failed', err);
      tbody.innerHTML = '<tr><td colspan="4" class="text-danger">فشل تحميل المستخدمين</td></tr>';
    }
  }

  // small HTML escaper
  function escapeHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  // bind open users-list buttons
  const openUsersListBtnMain = document.getElementById('openUsersListBtnMain');
  const openUsersListBtn = document.getElementById('openUsersListBtn');
  if (openUsersListBtnMain) openUsersListBtnMain.addEventListener('click', () => { openModal('usersListModal'); loadUsersList(); });
  if (openUsersListBtn) openUsersListBtn.addEventListener('click', () => { openModal('usersListModal'); loadUsersList(); });

  // bind search in users list
  const usersSearchEl = document.getElementById('usersSearch');
  if (usersSearchEl) usersSearchEl.addEventListener('input', debounce(() => loadUsersList(usersSearchEl.value.trim()), 250));
  const openSectionsBtn = document.getElementById('openSectionsBtn');
  if (openSectionsBtn) openSectionsBtn.addEventListener('click', () => { window.location.href = 'sections.html'; });
  // open recent movements (admin modal)
  const openRecentBtn = document.getElementById('openRecentBtn');
  if (openRecentBtn) openRecentBtn.addEventListener('click', async () => {
    try {
      const head = document.getElementById('adminRecentHead');
      const body = document.getElementById('adminRecentBody');
      const subtitle = document.getElementById('adminRecentSubtitle');
      head.innerHTML = '<tr><th><input id="adminRecentSelectAll" type="checkbox"></th><th>التاريخ</th><th>نوع الحركة</th><th>الصنف</th><th class="text-center">الكمية</th><th>المرجع</th><th>الطرف</th></tr>';
      body.innerHTML = '<tr><td colspan="7" class="text-muted">جارٍ التحميل...</td></tr>';
      // fetch last 50 movements
      const snaps = await window.firebaseHelpers.collectionRef('movements').orderBy('date','desc').limit(50).get();
      const rows = snaps.docs.map(d => ({ id: d.id, ...(d.data()||{}) }));
      if (!rows.length) { body.innerHTML = '<tr><td colspan="7" class="text-muted">لا توجد تحركات</td></tr>'; }
      // prepare product map for names
      const prodSnap = await window.firebaseHelpers.collectionRef('products').get();
      const prodMap = {}; prodSnap.docs.forEach(p => { const dt = p.data()||{}; prodMap[p.id] = dt.name || dt.barcode || ''; });
      // prepare supplier map
      const supSnap = await window.firebaseHelpers.collectionRef('suppliers').get();
      const supMap = {}; supSnap.docs.forEach(s => { const dt = s.data()||{}; supMap[s.id] = dt.name || dt.displayName || s.id; });
      body.innerHTML = '';
      rows.forEach(r => {
        const dateText = r.date ? new Date(r.date).toLocaleString() : '';
        const typeBadge = (r.type === 'in' ? '<span class="badge bg-success">وارد</span>' : (r.type === 'out' ? '<span class="badge bg-danger">صادر</span>' : (`<span class="badge bg-secondary">${r.type||''}</span>`)));
        let productName = r.productName || r.name || '';
        if (r.productId && prodMap[r.productId]) productName = prodMap[r.productId];
        let qty = '';
        if (typeof r.qty === 'number') qty = r.qty; else if (r.qty) qty = Number(r.qty) || r.qty; else if (Array.isArray(r.items)) qty = r.items.reduce((s,it)=> s+(Number(it.qty)||0),0);
        const ref = r.issueId || r.invoiceId || r.reference || r.ref || r.refNumber || r.invoiceNumber || r.note || '';
        const party = r.supplierId ? (supMap[r.supplierId]||r.supplierName||'') : (r.recipient||r.supplierName||r.party||'');
        const tr = document.createElement('tr');
        tr.innerHTML = `<td><input type="checkbox" class="admin-row-check form-check-input" data-id="${r.id}"></td><td>${dateText}</td><td>${typeBadge}</td><td>${productName}</td><td class="text-center">${qty}</td><td>${ref}</td><td>${party}</td>`;
        body.appendChild(tr);
      });
 
 
      subtitle.innerText = `عرض آخر ${rows.length} حركة`;
      const modalEl = document.getElementById('adminRecentModal');
      const modal = new bootstrap.Modal(modalEl); modal.show();

      // bind Excel export button for admin recent modal
      const adminExcelBtn = document.getElementById('adminExportRecentExcel');
      if (adminExcelBtn) {
        adminExcelBtn.onclick = async () => {
          try {
            const tbl = document.querySelector('#adminRecentModal table');
            const base = 'آخر_التحركات';
            const filename = `تقرير_${base}_${new Date().toISOString().slice(0,10)}.xlsx`;
            if (window.exports && typeof window.exports.exportTableToExcel === 'function') {
              await window.exports.exportTableToExcel(tbl, filename);
            } else {
              // fallback to CSV exporter
              if (window.exports && typeof window.exports.exportTableToCSV === 'function') {
                window.exports.exportTableToCSV(tbl, filename.replace(/\.xlsx$/, '.csv'));
              } else alert('أداة التصدير غير متاحة');
            }
          } catch (err) { console.error(err); alert('فشل تصدير Excel'); }
        };
      }

      // selection controls
      const selectAllInput = document.getElementById('adminRecentSelectAll');
      if (selectAllInput) selectAllInput.addEventListener('change', (e) => {
        document.querySelectorAll('#adminRecentBody .admin-row-check').forEach(cb => cb.checked = e.target.checked);
      });
      document.getElementById('adminRecentSelectAllBtn').onclick = () => { document.querySelectorAll('#adminRecentBody .admin-row-check').forEach(cb => cb.checked = true); };
      document.getElementById('adminRecentClearSelectionBtn').onclick = () => { document.querySelectorAll('#adminRecentBody .admin-row-check').forEach(cb => cb.checked = false); };

      async function getSelectedIds() {
        return Array.from(document.querySelectorAll('#adminRecentBody .admin-row-check:checked')).map(i => i.dataset.id);
      }

      document.getElementById('adminRecentDeleteSelected').onclick = async () => {
        const ids = await getSelectedIds();
        if (!ids.length) return alert('لا يوجد عناصر محددة');
        if (!confirm(`هل تريد حذف ${ids.length} عنصر؟`)) return;
        try {
          await Promise.all(ids.map(id => window.firebaseHelpers.deleteDocument('movements', id)));
          // refresh
          openRecentBtn.click();
        } catch (err) { console.error(err); alert('خطأ أثناء حذف التحركات'); }
      };

      document.getElementById('adminRecentShowBtn').onclick = async () => {
        const ids = await getSelectedIds();
        if (!ids.length) return alert('لا يوجد عناصر محددة');
        try {
          await Promise.all(ids.map(id => window.firebaseHelpers.updateDocument('movements', id, { showOnDashboard: true })));
          openRecentBtn.click();
        } catch (err) { console.error(err); alert('فشل عند وضع عنصر على اللوحة'); }
      };

      document.getElementById('adminRecentHideBtn').onclick = async () => {
        const ids = await getSelectedIds();
        if (!ids.length) return alert('لا يوجد عناصر محددة');
        try {
          await Promise.all(ids.map(id => window.firebaseHelpers.updateDocument('movements', id, { showOnDashboard: false })));
          openRecentBtn.click();
        } catch (err) { console.error(err); alert('فشل عند إخفاء عنصر من اللوحة'); }
      };

      // print/export handlers (simple)
      document.getElementById('adminPrintRecent').onclick = () => {
        const tbl = document.querySelector('#adminRecentModal table');
        const w = window.open('', '_blank');
        const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map(l=>`<link rel="stylesheet" href="${l.href}">`).join('\n');
        w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>آخر التحركات</title>${styles}</head><body class="p-3">${tbl.outerHTML}</body></html>`);
        w.document.close(); w.focus(); w.print(); setTimeout(()=>w.close(),500);
      };
    } catch (err) { console.error(err); alert('فشل جلب التحركات'); }
  });

});
