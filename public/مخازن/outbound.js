document.addEventListener('DOMContentLoaded', () => {
  const rowsEl = document.getElementById('outboundRows');
  const addBtn = document.getElementById('addOutboundRowBtn');
  const postBtn = document.getElementById('postOutboundBtn');
  const issueNumber = document.getElementById('issueNumber');
  const issueDate = document.getElementById('issueDate');
  const issueRecipient = document.getElementById('issueRecipient');
  const issueKeeper = document.getElementById('issueKeeper');

  // helper to generate next formatted number e.g. OUT-2026-001 or REQ
  async function generateNextNumber(collection, prefix) {
    const year = new Date().getFullYear();
    const prefixStr = `${prefix}-${year}-`;
    const snap = await window.firebaseHelpers.collectionRef(collection).get();
    let max = 0;
    snap.docs.forEach(d => {
      const n = String(d.data().number || '');
      if (n.startsWith(prefixStr)) {
        const suffix = n.slice(prefixStr.length).replace(/\D+/g,'');
        const v = Number(suffix) || 0; if (v > max) max = v;
      }
    });
    return `${prefix}-${year}-${String(max+1).padStart(3,'0')}`;
  }
  function makeRow() {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="text" class="form-control product-search" placeholder="أدخل اسم الصنف أو الكود"></td>
      <td><span class="badge bg-secondary row-current">-</span></td>
      <td><input type="number" class="form-control text-center row-qty" value="1" min="0"></td>
      <td class="row-price">0.00</td>
      <td class="row-total">0.00</td>
      <td><button class="btn btn-outline-danger btn-sm remove-row"><i class="bi bi-trash"></i></button></td>
    `;
    tr.querySelector('.remove-row').addEventListener('click', () => tr.remove());
    tr.querySelector('.row-qty').addEventListener('input', () => updateRow(tr));
    tr.querySelector('.product-search').addEventListener('change', () => fillProductInfo(tr));
    // allow central product picker via F1
    tr.querySelector('.product-search').addEventListener('keydown', async (e) => {
      if (e.key === 'F1') {
        e.preventDefault();
        if (window.productPicker && typeof window.productPicker.open === 'function') {
          const p = await window.productPicker.open();
          if (!p) return;
          tr.querySelector('.product-search').value = p.name || p.barcode || '';
          const currentEl = tr.querySelector('.row-current'); if (currentEl) currentEl.innerText = (p.quantity || 0);
          const priceElInput = tr.querySelector('.row-price'); if (priceElInput && priceElInput.tagName === 'INPUT') priceElInput.value = (p.salePrice || 0).toFixed(2);
          tr.dataset.productId = p.id;
          updateRow(tr);
        }
      }
    });
    return tr;
  }

  async function fillProductInfo(tr) {
    const name = tr.querySelector('.product-search').value.trim();
    tr.querySelector('.row-current').innerText = '-';
    tr.querySelector('.row-price').innerText = '0.00';
    if (!name) return;
    // try find by barcode first
    let snapshot = await window.firebaseHelpers.collectionRef('products').where('barcode','==',name).limit(1).get();
    if (snapshot.empty) snapshot = await window.firebaseHelpers.collectionRef('products').where('name','==',name).limit(1).get();
    if (snapshot.empty) {
      showAlert('لم يتم العثور على الصنف: سيتم الإنشاء عند تأكيد الصرف', 'warning');
      return;
    }
    const doc = snapshot.docs[0];
    const data = doc.data();
    tr.dataset.productId = doc.id;
    tr.dataset.productBarcode = data.barcode || '';
    // set input to product name (even if user typed barcode)
    tr.querySelector('.product-search').value = data.name || name;
    tr.querySelector('.row-current').innerText = (data.quantity || 0);
    tr.querySelector('.row-price').innerText = (data.salePrice || 0).toFixed(2);
    updateRow(tr);
  }

  function updateRow(tr) {
    const qty = Number(tr.querySelector('.row-qty').value) || 0;
    const price = Number(tr.querySelector('.row-price').innerText) || 0;
    tr.querySelector('.row-total').innerText = (qty * price).toFixed(2);
  }

  addBtn.addEventListener('click', () => rowsEl.appendChild(makeRow()));

  // query requisition and populate rows
  const issueQueryBtn = document.getElementById('issueQueryBtn');
  async function loadRequisitionByNumber(number) {
    if (!number || !number.trim()) { showAlert('ادخل رقم الطلب للبحث', 'warning'); return; }
    try {
      // flexible match: exact or suffix match
      const all = await window.firebaseHelpers.collectionRef('requisition_requests').get();
      const docs = all.docs.map(d=>({ id: d.id, data: d.data()}));
      const q = number.trim();
      let found = docs.find(x => x.data.number === q) || docs.find(x => (x.data.number||'').endsWith(q));
      if (!found) { showAlert('لم يتم العثور على طلب مطابق بالرقم المعطى', 'warning'); return; }
      const data = found.data || {};
      // populate header fields
      if (data.applicant) issueRecipient.value = data.applicant;
      if (data.date) issueDate.value = data.date;
      // populate rows
      rowsEl.innerHTML = '';
      const items = Array.isArray(data.items) ? data.items : [];
      for (const it of items) {
        const tr = makeRow();
        rowsEl.appendChild(tr);
        // set product search input; prefer code if available
        const ps = tr.querySelector('.product-search');
        if (it.code) ps.value = it.code; else ps.value = it.name || '';
        // try to fill product info (will lookup by barcode or name)
        await fillProductInfo(tr);
        // set requested qty
        const qtyEl = tr.querySelector('.row-qty'); if (qtyEl) qtyEl.value = Number(it.qty) || 0;
        updateRow(tr);
      }
      const newIssueNumber = await generateNextNumber('issues','OUT');
      issueNumber.value = newIssueNumber;
      showAlert('تم تحميل طلب الصرف وملء بنود الإذن', 'success');
    } catch (err) {
      console.error(err); showAlert('خطأ أثناء جلب طلب الصرف', 'danger');
    }
  }

  if (issueQueryBtn) issueQueryBtn.addEventListener('click', () => loadRequisitionByNumber(issueNumber.value));

  // --- Requisition list modal and search ---
  const issueListBtn = document.getElementById('issueListBtn');
  const reqModalEl = document.getElementById('requisitionListModal');
  let reqModal = null;
  if (reqModalEl) reqModal = new bootstrap.Modal(reqModalEl);
  const reqSearchNumber = document.getElementById('reqSearchNumber');
  const reqSearchByNumberBtn = document.getElementById('reqSearchByNumberBtn');
  const reqSearchDate = document.getElementById('reqSearchDate');
  const reqSearchByDateBtn = document.getElementById('reqSearchByDateBtn');
  const reqSearchResults = document.getElementById('reqSearchResults');

  async function searchRequisitionsByNumber(number) {
    if (!number) return [];
    const all = await window.firebaseHelpers.collectionRef('requisition_requests').get();
    const docs = all.docs.map(d => ({ id: d.id, ...d.data() }));
    const q = String(number).trim();
    return docs.filter(it => it.number === q || (it.number||'').endsWith(q));
  }

  async function searchRequisitionsByDate(date) {
    if (!date) return [];
    const snap = await window.firebaseHelpers.collectionRef('requisition_requests').where('date','==',date).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  function renderReqSearchResults(items) {
    if (!reqSearchResults) return;
    reqSearchResults.innerHTML = items.map(it => `<tr><td>${it.number||''}</td><td>${it.applicant||''}</td><td>${it.date||''}</td><td>${(it.items&&it.items.length)||0}</td><td><button class="btn btn-sm btn-primary load-req" data-number="${it.number||''}">تحميل</button></td></tr>`).join('');
    Array.from(reqSearchResults.querySelectorAll('.load-req')).forEach(btn => btn.addEventListener('click', (e) => {
      const num = e.target.getAttribute('data-number');
      if (reqModal) reqModal.hide();
      loadRequisitionByNumber(num);
    }));
  }

  if (issueListBtn && reqModal) issueListBtn.addEventListener('click', () => {
    if (reqModal) reqModal.show();
  });
  if (reqSearchByNumberBtn) reqSearchByNumberBtn.addEventListener('click', async () => {
    try { const items = await searchRequisitionsByNumber(reqSearchNumber.value); renderReqSearchResults(items); } catch (err) { console.error(err); showAlert('خطأ أثناء البحث','danger'); }
  });
  if (reqSearchByDateBtn) reqSearchByDateBtn.addEventListener('click', async () => {
    try { const items = await searchRequisitionsByDate(reqSearchDate.value); renderReqSearchResults(items); } catch (err) { console.error(err); showAlert('خطأ أثناء البحث','danger'); }
  });

  postBtn.addEventListener('click', async () => {
    const trs = Array.from(rowsEl.querySelectorAll('tr'));
    if (!trs.length) { showAlert('لا توجد أصناف للصرف', 'warning'); return; }

    // basic validation
    if (!issueNumber.value.trim()) { showAlert('يرجى إدخال رقم الإذن', 'warning'); issueNumber.focus(); return; }
    if (!issueDate.value) { showAlert('يرجى إدخال تاريخ الإذن', 'warning'); issueDate.focus(); return; }

    postBtn.disabled = true;
    try {
      // build issue object
      const issueData = {
        number: issueNumber.value.trim(),
        date: issueDate.value,
        recipient: issueRecipient.value || null,
        keeper: issueKeeper.value || null,
        totalItems: 0,
        createdAt: new Date().toISOString()
      };

      const issueRows = [];

      for (const tr of trs) {
        const name = tr.querySelector('.product-search').value.trim();
        const qty = Number(tr.querySelector('.row-qty').value) || 0;
        const price = Number(tr.querySelector('.row-price').innerText) || 0;
        if (!name || qty <= 0) continue;
        issueData.totalItems += qty;
        issueRows.push({ name, qty, price, total: qty * price, barcode: tr.dataset.productBarcode || null });
      }

      if (!issueRows.length) { showAlert('الرجاء إضافة أصناف صحيحة في إذن الصرف', 'warning'); postBtn.disabled = false; return; }

      // ensure formatted OUT number
      const outPattern = /^OUT-\d{4}-\d{3}$/;
      if (!issueData.number || !outPattern.test(issueData.number)) {
        issueData.number = await generateNextNumber('issues','OUT');
        issueNumber.value = issueData.number;
      }
      const issueRef = await window.firebaseHelpers.addDocument('issues', issueData);

      for (const r of issueRows) {
        // try by barcode then name
        let snapshot = await window.firebaseHelpers.collectionRef('products').where('barcode','==',r.name).limit(1).get();
        if (snapshot.empty) snapshot = await window.firebaseHelpers.collectionRef('products').where('name','==',r.name).limit(1).get();
        let productId = null;
        let productBarcode = null;
        if (snapshot.empty) {
          showAlert(`الصنف ${r.name} غير موجود - سيتم إنشاؤه بكميات سالبة`, 'warning');
          const isBarcode = /^\d+$/.test(r.name);
          const newRef = await window.firebaseHelpers.addDocument('products', { name: r.name, barcode: isBarcode ? r.name : '', quantity: -r.qty, salePrice: r.price });
          productId = newRef.id;
          productBarcode = isBarcode ? r.name : '';
        } else {
          const doc = snapshot.docs[0];
          const data = doc.data();
          const newQty = (Number(data.quantity) || 0) - r.qty;
          await window.firebaseHelpers.updateDocument('products', doc.id, { quantity: newQty });
          productId = doc.id;
          productBarcode = data.barcode || '';
        }

        await window.firebaseHelpers.addDocument('movements', { type: 'out', productId, productBarcode: productBarcode || null, productName: r.name, qty: r.qty, date: new Date().toISOString(), issueId: issueRef.id, recipient: issueData.recipient });
      }

      showAlert('تم تأكيد الصرف وتحديث المخزن', 'success');
      // show printable issue summary
      try {
        const containerId = 'lastIssueSummary';
        let container = document.getElementById(containerId);
        if (!container) {
          container = document.createElement('div'); container.id = containerId; container.className = 'mt-3';
          postBtn.parentElement.parentElement.insertAdjacentElement('afterend', container);
        }
        const summaryHtml = `<div class="card"><div class="card-body"><h6>ملخص إذن الصرف: ${issueData.number || issueRef.id}</h6><div class="table-responsive"><table class="table table-sm table-striped exportable-table"><thead><tr><th>الكود</th><th>الاسم</th><th class="text-center">الكمية</th><th class="text-end">السعر</th><th class="text-end">الإجمالي</th></tr></thead><tbody>${issueRows.map(r=>`<tr><td>${r.barcode||''}</td><td>${r.name}</td><td class="text-center">${r.qty}</td><td class="text-end">${r.price.toFixed(2)}</td><td class="text-end">${r.total.toFixed(2)}</td></tr>`).join('')}</tbody></table></div></div></div>`;
        container.innerHTML = summaryHtml;
        if (window.exports && window.exports.autoAttachExportToolbar) window.exports.autoAttachExportToolbar();

        // Also populate and show success modal with print button
        const modalEl = document.getElementById('issueSuccessModal');
        const modalBody = document.getElementById('issueSuccessBody');
        if (modalEl && modalBody) {
          modalBody.innerHTML = summaryHtml;
          try {
            const bsModal = new bootstrap.Modal(modalEl);
            bsModal.show();
          } catch (err) { console.error('bootstrap modal show failed', err); }
        }
        // attach print handler
        const printBtn = document.getElementById('printIssueBtn');
        if (printBtn) {
          printBtn.onclick = () => {
            const content = modalBody ? modalBody.innerHTML : summaryHtml;
            const w = window.open('', '_blank');
            const style = '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css">';
            w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>طباعة ملخص إذن الصرف</title>${style}</head><body class="p-3">${content}</body></html>`);
            w.document.close();
            w.focus();
            w.print();
            setTimeout(() => w.close(), 500);
          };
        }
      } catch (err) { console.error('failed to render issue summary', err); }

      rowsEl.innerHTML = '';
      rowsEl.appendChild(makeRow());
    } catch (err) {
      console.error(err);
      showAlert('حدث خطأ أثناء تأكيد الصرف', 'danger');
    } finally {
      postBtn.disabled = false;
    }
  });

  // attach export toolbar if available
  if (window.exports && window.exports.autoAttachExportToolbar) window.exports.autoAttachExportToolbar();

});