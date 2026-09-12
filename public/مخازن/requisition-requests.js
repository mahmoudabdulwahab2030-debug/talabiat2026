document.addEventListener('DOMContentLoaded', () => {
  const addRowBtn = document.getElementById('addReqRow');
  const reqRows = document.getElementById('reqRows');
  const submitBtn = document.getElementById('submitReq');

  // product picker handled by central component

  let productsCache = [];
  let lastFocusedInput = null;

  // helpers
  function findProductByValue(val) {
    if (!val) return null;
    const q = String(val).trim().toLowerCase();
    let p = productsCache.find(x => (x.barcode && String(x.barcode).toLowerCase() === q) || (x.code && String(x.code).toLowerCase() === q));
    if (p) return p;
    p = productsCache.find(x => x.name && String(x.name).toLowerCase() === q) || productsCache.find(x => x.name && String(x.name).toLowerCase().includes(q));
    return p || null;
  }

  function updateRowBalance(row) {
    if (!row) return;
    const prodNameInput = row.querySelector('.product-name-input');
    const prodCodeInput = row.querySelector('.product-code-input');
    const qtyInput = row.querySelector('.qty-input');
    const balInput = row.querySelector('.balance-input');
    if ((!prodNameInput && !prodCodeInput) || !qtyInput || !balInput) return;
    const lookupVal = (prodCodeInput && prodCodeInput.value) ? prodCodeInput.value : (prodNameInput ? prodNameInput.value : '');
    const p = findProductByValue(lookupVal || (prodNameInput ? prodNameInput.value : ''));
    // if product found, ensure both name and code reflect DB values
    if (p) {
      if (prodNameInput && p.name) prodNameInput.value = p.name;
      if (prodCodeInput && p.code) prodCodeInput.value = p.code;
    }
    const available = p ? Number(p.quantity || 0) : '';
    balInput.value = available === '' ? '' : String(available);
    const requested = Number(qtyInput.value || 0);
    // validation UI
    if (available !== '' && requested > available) {
      qtyInput.classList.add('is-invalid');
      qtyInput.classList.remove('is-valid');
      if (!row.querySelector('.qty-warning')) {
        const warn = document.createElement('div'); warn.className = 'text-danger small qty-warning'; warn.innerText = 'الرصيد غير كافٍ';
        qtyInput.insertAdjacentElement('afterend', warn);
      }
    } else {
      qtyInput.classList.remove('is-invalid');
      qtyInput.classList.add('is-valid');
      const warn = row.querySelector('.qty-warning'); if (warn) warn.remove();
    }
  }

  function attachRowHandlers(row) {
    const prodNameInput = row.querySelector('.product-name-input');
    const prodCodeInput = row.querySelector('.product-code-input');
    const qtyInput = row.querySelector('.qty-input');
    const removeBtn = row.querySelector('.remove-row');
    if (prodNameInput) {
      prodNameInput.addEventListener('change', () => updateRowBalance(row));
      prodNameInput.addEventListener('blur', () => updateRowBalance(row));
      prodNameInput.addEventListener('focus', (e) => { lastFocusedInput = e.target; });
    }
    if (prodCodeInput) {
      prodCodeInput.addEventListener('change', () => updateRowBalance(row));
      prodCodeInput.addEventListener('blur', () => updateRowBalance(row));
      prodCodeInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const p = findProductByValue(prodCodeInput.value);
          if (p && prodNameInput) prodNameInput.value = p.name || '';
          // ensure full sync using update
          updateRowBalance(row);
        }
      });
      prodCodeInput.addEventListener('focus', (e) => { lastFocusedInput = e.target; });
    }
    // picker button per row (if present)
    const pickerBtn = row.querySelector('.open-picker-btn');
    if (pickerBtn) pickerBtn.addEventListener('click', async (ev) => { ev.preventDefault(); lastFocusedInput = row.querySelector('.product-name-input') || row.querySelector('.product-code-input'); if (window.productPicker && typeof window.productPicker.open === 'function') {
      const p = await window.productPicker.open();
      if (p && lastFocusedInput) {
        const tr = lastFocusedInput.closest('tr');
        const nameEl = tr.querySelector('.product-name-input');
        const codeEl = tr.querySelector('.product-code-input');
        if (nameEl) nameEl.value = p.name || '';
        if (codeEl) codeEl.value = p.barcode || '';
        updateRowBalance(tr);
      }
    } });
    if (qtyInput) {
      qtyInput.addEventListener('input', () => updateRowBalance(row));
    }
    if (removeBtn) {
      removeBtn.addEventListener('click', () => { row.remove(); });
    }
  }

  // initial attach for any existing rows
  Array.from(reqRows.querySelectorAll('tr')).forEach(r => attachRowHandlers(r));

  addRowBtn.addEventListener('click', () => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="d-flex gap-2 align-items-center"><input type="text" class="form-control product-name-input" placeholder="اسم الصنف"><button type="button" class="btn btn-light btn-sm open-picker-btn" title="فتح منتقي"><i class="bi bi-search"></i></button></td>
      <td><input type="text" class="form-control product-code-input" placeholder="كود الصنف"></td>
      <td><input type="number" class="form-control qty-input" value="1" min="0"></td>
      <td><input type="text" class="form-control balance-input" readonly></td>
      <td><input type="text" class="form-control"></td>
      <td><button class="btn btn-outline-danger btn-sm remove-row">حذف</button></td>`;
    reqRows.appendChild(tr);
    attachRowHandlers(tr);
  });

  // open central picker and fill focused row/input
  async function openCentralPickerAndFill() {
    if (!window.productPicker || typeof window.productPicker.open !== 'function') return;
    const p = await window.productPicker.open();
    if (!p || !lastFocusedInput) return;
    const tr = lastFocusedInput.closest('tr');
    if (!tr) return;
    const nameEl = tr.querySelector('.product-name-input');
    const codeEl = tr.querySelector('.product-code-input');
    if (nameEl) nameEl.value = p.name || '';
    if (codeEl) codeEl.value = p.barcode || '';
    updateRowBalance(tr);
  }

  // listen to products collection to populate cache
  productsCache = [];
  if (window.firebaseHelpers && typeof window.firebaseHelpers.onCollection === 'function') {
    window.firebaseHelpers.onCollection('products', snapshot => {
      // reset cache on every snapshot to avoid stale/fallback doc.id values
      productsCache = [];
      snapshot.forEach(doc => {
        const d = doc.data();
        // prefer explicit code/barcode fields; do NOT use doc.id as the product code
        productsCache.push({
          id: doc.id,
          barcode: d.barcode || d.code || '',
          code: d.code || d.barcode || '',
          name: d.name || '',
          section: d.section || '',
          quantity: Number(d.quantity || 0)
        });
      });
      // central picker rendering not required here; avoid calling undefined global
      // update balances for existing rows
      Array.from(reqRows.querySelectorAll('tr')).forEach(r => updateRowBalance(r));
    }, err => console.error(err));
  }

  // track focused input inside reqRows
  document.addEventListener('focusin', (e) => {
    const el = e.target;
    if (el && el.tagName === 'INPUT' && el.closest && el.closest('#reqRows')) lastFocusedInput = el;
  });

  // preview next sequence number (does NOT reserve it) and show in the reqNumber input
  async function previewNextNumber() {
    try {
      const year = new Date().getFullYear();
      const counterRef = firebase.firestore().collection('counters').doc('requisition_requests');
      let next = null;
      try {
        const snap = await counterRef.get();
        if (snap.exists && snap.data() && Number(snap.data().last || 0) >= 0) {
          next = Number(snap.data().last || 0) + 1;
        }
      } catch (e) {
        console.warn('could not read counter doc', e);
      }
      if (next === null) {
        // fallback: scan existing requisition_requests for max suffix
        try {
          const prefixStr = `REQ-${year}-`;
          const snap = await window.firebaseHelpers.collectionRef('requisition_requests').get();
          let max = 0;
          snap.docs.forEach(d => {
            const n = String(d.data().number || '');
            if (n.startsWith(prefixStr)) {
              const suffix = n.slice(prefixStr.length).replace(/\D+/g,'');
              const v = Number(suffix) || 0; if (v > max) max = v;
            }
          });
          next = max + 1;
        } catch (e2) {
          // final fallback: use timestamp-based small counter
          next = (Date.now() % 1000) + 1;
        }
      }
      const num = `REQ-${year}-${String(next).padStart(3,'0')}`;
      const rn = document.getElementById('reqNumber'); if (rn) rn.value = num;
    } catch (err) { console.error('previewNextNumber failed', err); }
  }

  // call preview on load
  previewNextNumber();

  // open central picker on F1 when focused in a reqRows input
  document.addEventListener('keydown', (e) => {
    if (e.key === 'F1') {
      const active = document.activeElement;
      if (active && active.tagName === 'INPUT' && active.closest && active.closest('#reqRows')) {
        e.preventDefault();
        openCentralPickerAndFill();
      }
    }
  });

  submitBtn.addEventListener('click', async () => {
    const rows = Array.from(reqRows.querySelectorAll('tr'));
    // validate stock
    for (const r of rows) {
      const nameVal = r.querySelector('.product-name-input')?.value || '';
      const codeVal = r.querySelector('.product-code-input')?.value || '';
      const qty = Number(r.querySelector('.qty-input')?.value || 0);
      const lookup = codeVal || nameVal;
      const p = findProductByValue(lookup);
      const available = p ? Number(p.quantity || 0) : null;
      if (available !== null && qty > available) {
        if (typeof showAlert === 'function') showAlert(`الرصيد للصنف "${nameVal||codeVal}" غير كافٍ (المتوفر ${available})`, 'danger');
        updateRowBalance(r);
        return;
      }
    }

    // validate required header fields before building request
    const applicantEl = document.getElementById('reqApplicant');
    const dateEl = document.getElementById('reqDate');
    const sectionEl = document.getElementById('reqSection');
    if (!applicantEl || !String(applicantEl.value || '').trim()) { if (typeof showAlert === 'function') showAlert('الرجاء إدخال اسم مقدم الطلب', 'warning'); applicantEl && applicantEl.focus(); return; }
    if (!dateEl || !String(dateEl.value || '').trim()) { if (typeof showAlert === 'function') showAlert('الرجاء تحديد تاريخ الطلب', 'warning'); dateEl && dateEl.focus(); return; }
    if (!sectionEl || !String(sectionEl.value || '').trim()) { if (typeof showAlert === 'function') showAlert('الرجاء اختيار القسم', 'warning'); sectionEl && sectionEl.focus(); return; }

    const items = rows.map(r => ({
      name: r.children[0].querySelector('input')?.value || '',
      code: r.children[1].querySelector('input')?.value || '',
      qty: Number(r.children[2].querySelector('input')?.value) || 0
    })).filter(it => (it.name || it.code) && it.qty > 0);
    if (!items.length) { if (typeof showAlert === 'function') showAlert('الرجاء إضافة صنف واحد على الأقل برقم/اسم وكمية صحيحة', 'warning'); return; }
    // validate each item completeness
    for (const it of items) {
      if (!(it.name || it.code) || !(Number(it.qty) > 0)) { if (typeof showAlert === 'function') showAlert('تأكد من أن جميع البنود تحتوي على اسم/كود وكمية أكبر من صفر', 'warning'); return; }
    }
    const req = {
      number: document.getElementById('reqNumber')?.value || '',
      applicant: document.getElementById('reqApplicant')?.value || '',
      date: document.getElementById('reqDate')?.value || '',
      section: (document.getElementById('reqSection') && document.getElementById('reqSection').value) || '',
      items
    };
    try {
        if (!window.firebaseHelpers || typeof window.firebaseHelpers.addDocument !== 'function') throw new Error('firebaseHelpers.addDocument unavailable');
        // generate formatted request number REQ-YYYY-### if not provided or invalid
        // Prefer a transaction-backed counter document for uniqueness under concurrency,
        // fall back to scanning existing documents if transaction fails.
        async function generateNextNumber(prefix) {
          const year = new Date().getFullYear();
          const counterDocRef = firebase.firestore().collection('counters').doc('requisition_requests');
          try {
            const next = await firebase.firestore().runTransaction(async (tx) => {
              const snap = await tx.get(counterDocRef);
              let last = 0;
              if (snap.exists) last = Number(snap.data().last || 0);
              const newVal = last + 1;
              tx.set(counterDocRef, { last: newVal }, { merge: true });
              return newVal;
            });
            return `${prefix}-${year}-${String(next).padStart(3,'0')}`;
          } catch (err) {
            console.warn('counter transaction failed, falling back to scan', err);
            // fallback: scan existing collection for max suffix
            const prefixStr = `${prefix}-${year}-`;
            try {
              const snap = await window.firebaseHelpers.collectionRef('requisition_requests').get();
              let max = 0;
              snap.docs.forEach(d => {
                const n = String(d.data().number || '');
                if (n.startsWith(prefixStr)) {
                  const suffix = n.slice(prefixStr.length).replace(/\D+/g,'');
                  const v = Number(suffix) || 0; if (v > max) max = v;
                }
              });
              return `${prefix}-${year}-${String(max+1).padStart(3,'0')}`;
            } catch (e2) {
              // last resort: use timestamp-based suffix to avoid collisions
              const ts = Date.now() % 1000;
              return `${prefix}-${year}-${String(ts).padStart(3,'0')}`;
            }
          }
        }
        // Always generate a fresh unique request number to ensure uniqueness
        req.number = await generateNextNumber('REQ');
        const ref = await window.firebaseHelpers.addDocument('requisition_requests', req);
        // update the visible request number on page
        try { const rn = document.getElementById('reqNumber'); if (rn) rn.value = req.number; } catch(e){}
        // show SweetAlert2 popup with the request number and a print button
        try {
          const itemsHtml = (req.items||[]).map(i=>`<tr><td>${i.code||''}</td><td>${i.name||''}</td><td class="text-center">${i.qty||0}</td></tr>`).join('');
          const html = `<div style="text-align:right;">` +
            `<p>تم إنشاء طلب الصرف بالرقم: <strong>${req.number}</strong></p>` +
            `<div class="table-responsive"><table class="table table-sm"><thead><tr><th>الكود</th><th>الاسم</th><th class="text-center">الكمية</th></tr></thead><tbody>${itemsHtml}</tbody></table></div>` +
            `<div style="margin-top:8px;text-align:left;"><button id="swalPrintBtn" class="btn btn-sm btn-outline-secondary"><i class="bi bi-printer"></i> طباعة</button></div>` +
            `</div>`;

          if (window.Swal && typeof window.Swal.fire === 'function') {
            window.Swal.fire({
              title: 'تم إرسال طلب الصرف',
              html,
              width: '720px',
              showCloseButton: true,
              showConfirmButton: false,
              didOpen: () => {
                const printBtn = document.getElementById('swalPrintBtn');
                if (printBtn) printBtn.addEventListener('click', () => {
                  const w = window.open('','_blank');
                  const style = '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css">';
                  w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>طباعة ملخص طلب الصرف ${req.number}</title>${style}</head><body class="p-3">${html}</body></html>`);
                  w.document.close();
                  w.print();
                  setTimeout(()=>w.close(),500);
                });
              }
            });
          } else {
            // fallback to existing modal if SweetAlert not available
            const modalEl = document.getElementById('reqSuccessModal');
            const modalBody = document.getElementById('reqSuccessBody');
            if (modalEl && modalBody) {
              modalBody.innerHTML = html;
              const bs = new bootstrap.Modal(modalEl); bs.show();
              const printBtn = document.getElementById('printReqBtn');
              if (printBtn) printBtn.onclick = () => { const w = window.open('','_blank'); const style = '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css">'; w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>طباعة ملخص طلب الصرف ${req.number}</title>${style}</head><body class="p-3">${html}</body></html>`); w.document.close(); w.print(); setTimeout(()=>w.close(),500); };
            }
          }
        } catch (err) { console.error('failed to show req success', err); }
        // Do NOT redirect automatically — keep the page and the SweetAlert open
    } catch (err) { console.error(err); if (typeof showAlert === 'function') showAlert('خطأ أثناء الإرسال','danger'); }
  });
});