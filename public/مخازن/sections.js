document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('sectionForm');
  const nameEl = document.getElementById('sectionName');
  const codeEl = document.getElementById('sectionCode');
  const groupEl = document.getElementById('sectionGroup');
  const tableBody = document.querySelector('#sectionsTable tbody');

  let sectionsCache = [];

  function renderTable() {
    if (!tableBody) return;
    if (!sectionsCache.length) { tableBody.innerHTML = '<tr class="text-muted"><td colspan="4">لا توجد أقسام</td></tr>'; return; }
    tableBody.innerHTML = sectionsCache.map(s => `<tr data-id="${s.id || ''}" data-code="${(s.code||'').replace(/"/g,'&quot;')}"><td>${s.code||''}</td><td>${s.name||''}</td><td>${s.group||''}</td><td><button class="btn btn-sm btn-outline-primary edit-section">تعديل</button> <button class="btn btn-sm btn-outline-danger delete-section">حذف</button></td></tr>`).join('');
    Array.from(tableBody.querySelectorAll('.edit-section')).forEach(btn => btn.addEventListener('click', (e) => {
      const tr = e.target.closest('tr');
      const code = tr.dataset.code || '';
      const s = sectionsCache.find(x => (x.code||'') === code) || {};
      nameEl.value = s.name || '';
      codeEl.value = s.code || '';
      groupEl.value = (s.group||'').replace(/^stock_/, '') || '';
    }));
    Array.from(tableBody.querySelectorAll('.delete-section')).forEach(btn => btn.addEventListener('click', async (e) => {
      const tr = e.target.closest('tr');
      const code = tr.dataset.code || '';
      if (!code) return alert('لا يمكن حذف قسم غير معروف');
      if (!await appConfirm('هل تريد حذف هذا القسم؟')) return;
      try {
        await window.firebaseHelpers.deleteDocument('sections', code);
        showAlert && showAlert('تم الحذف','secondary');
      } catch (err) { console.error(err); showAlert && showAlert('خطأ أثناء الحذف','danger'); }
    }));
  }

  // auto-populate selects across the app (product add, filters, etc.)
  function populateSectionSelects() {
    const opts = ['<option value="">اختر القسم...</option>'].concat(sectionsCache.map(s => `<option value="${(s.name||'').replace(/"/g,'&quot;')}">${s.name}</option>`)).join('');
    // selects that should receive section options
    Array.from(document.querySelectorAll('.section-select')).forEach(s => { if (s.getAttribute && s.getAttribute('data-static') === 'true') return; s.innerHTML = opts; });
    const sf = document.getElementById('sectionFilter'); if (sf) sf.innerHTML = '<option value="">كل الأقسام</option>' + sectionsCache.map(s => `<option value="${(s.name||'').replace(/"/g,'&quot;')}">${s.name}</option>`).join('');
  }

  // listen to sections collection
  if (window.firebaseHelpers && typeof window.firebaseHelpers.onCollection === 'function') {
    window.firebaseHelpers.onCollection('sections', snapshot => {
      sectionsCache = [];
      snapshot.forEach(doc => {
        const d = doc.data() || {};
        // try to use doc.id as stable id, but prefer explicit code field
        const code = d.code || doc.id || '';
        const group = d.group ? (d.group.startsWith('stock_') ? d.group : 'stock_' + d.group) : '';
        sectionsCache.push({ id: doc.id, code: code, name: d.name || '', group: group });
      });
      renderTable();
      populateSectionSelects();
    }, err => console.error(err));
  }

  // Auto-create sections from products' `section` field
  const autoBtn = document.getElementById('autoCreateSections');
  async function slugifyName(n) { return (n||'').toString().toLowerCase().trim().replace(/\s+/g,'_').replace(/[^a-z0-9_\-]/g,'').slice(0,50) || ('s'+Date.now()); }
  if (autoBtn) autoBtn.addEventListener('click', async () => {
    if (!await appConfirm('هل تريد إنشاء أقسام مفقودة تلقائياً اعتماداً على حقول `section` في المستندات؟')) return;
    try {
      const prods = await window.firebaseHelpers.getAll('products');
      const names = new Set();
      prods.forEach(p => { if (p && p.section) names.add(p.section); });
      const toCreate = [];
      names.forEach(n => {
        if (!sectionsCache.find(s => (s.name||'') === n)) toCreate.push(n);
      });
      if (!toCreate.length) { showAlert && showAlert('لا توجد أقسام جديدة لإنشائها', 'info'); return; }
      for (const name of toCreate) {
        const code = await slugifyName(name);
        const group = 'stock_' + (code.replace(/[^a-z0-9_]/g,'') || code);
        try {
          await window.firebaseHelpers.collectionRef('sections').doc(code).set({ name, code, group });
        } catch (err) { console.error('failed create section', name, err); }
      }
      showAlert && showAlert('تم إنشاء الأقسام الجديدة', 'success');
    } catch (err) { console.error(err); showAlert && showAlert('خطأ أثناء المسح/الإنشاء','danger'); }
  });

  // --- Section picker modal + F1 integration ---
  // create modal if not present
  function ensurePickerModal() {
    if (document.getElementById('sectionPickerModal')) return document.getElementById('sectionPickerModal');
    const modalHtml = `
      <div class="modal fade" id="sectionPickerModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered modal-sm">
          <div class="modal-content">
            <div class="modal-header"><h5 class="modal-title">اختر القسم</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
            <div class="modal-body">
              <div class="mb-2"><input id="sectionPickerFilter" class="form-control" placeholder="ابحث بالاسم..."></div>
              <div class="list-group" id="sectionPickerList"></div>
            </div>
            <div class="modal-footer"><button class="btn btn-secondary" data-bs-dismiss="modal">إغلاق</button></div>
          </div>
        </div>
      </div>`;
    const tmp = document.createElement('div'); tmp.innerHTML = modalHtml;
    document.body.appendChild(tmp.firstElementChild);
    return document.getElementById('sectionPickerModal');
  }

  function renderPickerList(filter = '') {
    const list = document.getElementById('sectionPickerList');
    if (!list) return;
    const q = (filter||'').toLowerCase().trim();
    const rows = sectionsCache.filter(s => !q || (s.name && s.name.toLowerCase().includes(q)) || (s.code && s.code.toLowerCase().includes(q)));
    list.innerHTML = rows.map(s => `<button type="button" class="list-group-item list-group-item-action" data-code="${(s.code||'').replace(/"/g,'&quot;')}" data-name="${(s.name||'').replace(/"/g,'&quot;')}">${s.name} <small class="text-muted">${s.code||''}</small></button>`).join('') || '<div class="text-muted small">لا توجد نتائج</div>';
    Array.from(list.querySelectorAll('button')).forEach(btn => btn.addEventListener('click', (e) => {
      const code = btn.dataset.code || '';
      const name = btn.dataset.name || '';
      if (lastFocusedSectionInput) {
        if (lastFocusedSectionInput.tagName === 'SELECT') {
          lastFocusedSectionInput.value = name; // selects are populated by name
          lastFocusedSectionInput.dispatchEvent(new Event('change'));
        } else {
          lastFocusedSectionInput.value = name;
          lastFocusedSectionInput.dispatchEvent(new Event('input'));
        }
      }
      try { const m = bootstrap.Modal.getInstance(document.getElementById('sectionPickerModal')) || new bootstrap.Modal(document.getElementById('sectionPickerModal')); m.hide(); } catch(e){}
    }));
  }

  let lastFocusedSectionInput = null;
  document.addEventListener('focusin', (e) => {
    const el = e.target;
    if (!el) return;
    if (el.classList && el.classList.contains('section-select')) lastFocusedSectionInput = el;
    // also allow any input with data-section-picker attribute
    if (el.getAttribute && el.getAttribute('data-section-picker') !== null) lastFocusedSectionInput = el;
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'F1') {
      const active = document.activeElement;
      if (!active) return;
      if ((active.classList && active.classList.contains('section-select')) || active.getAttribute('data-section-picker') !== null) {
        e.preventDefault();
        const modal = ensurePickerModal();
        renderPickerList('');
        try { const bs = new bootstrap.Modal(modal); bs.show(); setTimeout(()=>{ document.getElementById('sectionPickerFilter') && document.getElementById('sectionPickerFilter').focus(); },100); } catch(e){}
      }
    }
  });

  // filter inside modal
  document.addEventListener('input', (e) => {
    if (e.target && e.target.id === 'sectionPickerFilter') renderPickerList(e.target.value);
  });

  // form submit: create or update section by `code` as doc id
  if (form) form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const name = (nameEl.value || '').trim();
    const code = (codeEl.value || '').trim();
    const groupRaw = (groupEl.value || '').trim();
    if (!name || !code) return alert('الاسم والكود مطلوبان');
    const group = groupRaw ? (groupRaw.startsWith('stock_') ? groupRaw : 'stock_' + groupRaw) : 'stock_' + code;
    try {
      // use collectionRef to set document with stable id = code
      await window.firebaseHelpers.collectionRef('sections').doc(code).set({ name, code, group });
      showAlert && showAlert('تم حفظ القسم','success');
      form.reset();
    } catch (err) { console.error(err); showAlert && showAlert('خطأ أثناء الحفظ','danger'); }
  });
});
