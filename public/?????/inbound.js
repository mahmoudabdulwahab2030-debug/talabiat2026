document.addEventListener('DOMContentLoaded', () => {
  const inboundRows = document.getElementById('inboundRows');
  const addRowBtn = document.getElementById('addInboundRowBtn');
  const postBtn = document.getElementById('postInboundBtn');
  const invoiceTotalEl = document.getElementById('invoiceTotal');
  const invoiceSupplier = document.getElementById('invoiceSupplier');
  const invoiceNumber = document.getElementById('invoiceNumber');
  const invoiceDate = document.getElementById('invoiceDate');
  const invoiceWarehouse = document.getElementById('invoiceWarehouse');
  const invoiceSection = document.getElementById('invoiceSection');
  const invoiceSubsection = document.getElementById('invoiceSubsection');

  // subsection population for 'مواد غذائية' (keep in sync with product-add.js)
  const foodSubsections = [
    'لحوم','اسماك','دجاج','الالبان ومشتقاتها','زيوت وسمن','مواد جافة','عطاره','خضروات'
  ];
  function updateInvoiceSubsectionVisibility() {
    if (!invoiceSection) return;
    if (invoiceSection.value === 'مواد غذائية') {
      if (invoiceSubsection) {
        invoiceSubsection.style.display = '';
        invoiceSubsection.innerHTML = '<option value="">اختر التصنيف الفرعي...</option>' + foodSubsections.map(s => `<option value="${s}">${s}</option>`).join('');
      }
    } else {
      if (invoiceSubsection) {
        invoiceSubsection.style.display = 'none';
        invoiceSubsection.value = '';
      }
    }
  }
  if (invoiceSection) invoiceSection.addEventListener('change', updateInvoiceSubsectionVisibility);
  updateInvoiceSubsectionVisibility();

  // populate suppliers select
  function populateSuppliers(snapshot) {
    invoiceSupplier.innerHTML = '<option value="">-- اختر مورد --</option>';
    snapshot.forEach(doc => {
      const data = doc.data();
      const opt = document.createElement('option');
      opt.value = doc.id;
      opt.innerText = data.name || '(بدون اسم)';
      invoiceSupplier.appendChild(opt);
    });
  }
  // subscribe to suppliers
  window.firebaseHelpers.onCollection('suppliers', snapshot => populateSuppliers(snapshot));

  // make invoiceNumber readonly and prepare next number on load
  if (invoiceNumber) invoiceNumber.readOnly = true;

  function pad(num, size) { let s = String(num); while (s.length < size) s = '0' + s; return s; }

  async function setNextInvoiceNumber() {
    try {
      const year = new Date().getFullYear();
      const snaps = await window.firebaseHelpers.collectionRef('invoices').orderBy('createdAt','desc').limit(1).get();
      let next = 1;
      if (!snaps.empty) {
        const last = snaps.docs[0].data() || {};
        const num = last.number || '';
        const m = (''+num).match(/INV-(\d{4})-(\d+)/);
        if (m && Number(m[1]) === year) next = Number(m[2]) + 1;
        else if (m && Number(m[1]) < year) next = 1;
        else next = 1;
      }
      if (invoiceNumber) invoiceNumber.value = `INV-${year}-${pad(next,3)}`;
    } catch (err) {
      console.warn('failed to set next invoice number', err);
      if (invoiceNumber && !invoiceNumber.value) invoiceNumber.value = `INV-${new Date().getFullYear()}-001`;
    }
  }

  // hide summary export/print buttons until a post occurs
  const printBtn = document.getElementById('printInboundSummary');
  const pdfBtn = document.getElementById('pdfInboundSummary');
  const excelBtn = document.getElementById('excelInboundSummary');
  if (printBtn) printBtn.style.display = 'none';
  if (pdfBtn) pdfBtn.style.display = 'none';
  if (excelBtn) excelBtn.style.display = 'none';

  // prepare invoice number on load
  setNextInvoiceNumber();

  // remove any auto-attached export toolbar for the inbound table (exports.js auto-init)
  try {
    const mainTable = document.querySelector('table.table-sm.table-bordered');
    if (mainTable) {
      // remove any toolbar inserted before the table
      const prev = mainTable.previousElementSibling;
      if (prev && prev.classList && prev.classList.contains('export-toolbar')) prev.remove();
      // also remove the exportable-table marker so exports.autoAttach won't target it later
      mainTable.classList.remove('exportable-table');
    }
  } catch (e) { console.warn('could not remove export toolbar', e); }

  // helper: normalize/format pack and unit from various product shapes
  function packStringForProduct(data) {
    if (!data) return '';
    const pack = data.pack || {};
    const label = (pack.labelArabic || pack.label || data.packArabic || data.packArabicLabel || '') || '';
    const qty = (pack.quantity || data.packNumber || data.packQuantity || '') || '';
    const unit = (pack.unit || data.packUnit || data.pack_unit || '') || '';
    let s = '';
    if (label) s += label;
    if (qty) s += (s ? ' ' : '') + '×' + qty + (unit ? ' ' + unit : '');
    return s;
  }

  function unitForProduct(data) {
    if (!data) return '';
    return data.unit || (data.pack && data.pack.unit) || data.packUnit || data.unitName || '';
  }

  function updateRowTotals() {
    let total = 0;
    inboundRows.querySelectorAll('tr').forEach(tr => {
      const qty = parseFloat(tr.querySelector('.row-qty').value) || 0;
      const price = parseFloat(tr.querySelector('.row-price').value) || 0;
      const rowTotal = qty * price;
      tr.querySelector('.row-total').innerText = rowTotal.toFixed(2);
      total += rowTotal;
    });
    invoiceTotalEl.innerText = `إجمالي الفاتورة: ${total.toFixed(2)} ج.م`;
  }

  function makeRow() {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="text" class="form-control product-search" placeholder="أدخل اسم الصنف أو الكود"></td>
      <td><input class="form-control form-control-sm product-code" readonly placeholder="الكود"></td>
      <td class="text-center"><span class="row-current">-</span></td>
      <td><input type="text" class="form-control form-control-sm row-pack" readonly placeholder="شد الصنف"></td>
      <td><input type="text" class="form-control form-control-sm row-unit" readonly placeholder="الوحدة"></td>
      <td><input type="number" class="form-control form-control-sm row-packs" value="0" min="0"></td>
      <td><input type="number" class="form-control row-qty" value="1" min="0"></td>
      <td><input type="number" class="form-control row-price" value="0.00" min="0" step="0.01"></td>
      <td class="align-middle row-total">0.00</td>
      <td><button class="btn btn-outline-danger btn-sm remove-row"><i class="bi bi-trash"></i></button></td>
    `;
    tr.querySelector('.remove-row').addEventListener('click', () => { tr.remove(); updateRowTotals(); });
    tr.querySelector('.row-qty').addEventListener('input', updateRowTotals);
    tr.querySelector('.row-packs').addEventListener('input', () => {
      // when packs changes, if packQuantity known on row, update units
      const packs = Number(tr.querySelector('.row-packs').value) || 0;
      const packQty = Number(tr.dataset.packQuantity) || 0;
      if (packQty && packs) {
        tr.querySelector('.row-qty').value = (packs * packQty);
      }
      updateRowTotals();
    });
    tr.querySelector('.row-price').addEventListener('input', updateRowTotals);
      // open central product picker on F1, also support Enter/blur to trigger lookup
      const prodSearch = tr.querySelector('.product-search');
      prodSearch.addEventListener('change', () => fillProductInfo(tr));
      prodSearch.addEventListener('blur', () => fillProductInfo(tr));
      prodSearch.addEventListener('keydown', async (e) => {
        if (e.key === 'F1') {
          e.preventDefault();
          if (window.productPicker && typeof window.productPicker.open === 'function') {
            const p = await window.productPicker.open();
            if (!p) return;
            tr.querySelector('.product-search').value = p.name || p.barcode || '';
            if (tr.querySelector('.product-code')) tr.querySelector('.product-code').value = p.barcode || '';
            const currentEl = tr.querySelector('.row-current'); if (currentEl) currentEl.innerText = (p.quantity || 0);
            // fill pack and unit when product selected
            const packField = tr.querySelector('.row-pack');
            const unitField = tr.querySelector('.row-unit');
            const packsInput = tr.querySelector('.row-packs');
            // store packQuantity for pack->units conversion
            const packObj = p.pack || {};
            tr.dataset.packQuantity = packObj.quantity || p.packNumber || p.packQuantity || '';
            if (packField) packField.value = packStringForProduct(p);
            if (unitField) unitField.value = unitForProduct(p);
            if (packsInput) packsInput.value = 0;
            // prefer purchasePrice/cost/buyPrice over salePrice, but leave editable
            const preferredPrice = p.purchasePrice || p.purchase_price || p.cost || p.buyPrice || p.salePrice || 0;
            if (tr.querySelector('.row-price')) tr.querySelector('.row-price').value = (preferredPrice).toFixed(2);
            tr.dataset.productId = p.id;
            updateRowTotals();
          }
        } else if (e.key === 'Enter') {
          e.preventDefault();
          fillProductInfo(tr);
        }
      });
    return tr;
  }

  addRowBtn.addEventListener('click', () => { inboundRows.appendChild(makeRow()); updateRowTotals(); });

  async function fillProductInfo(tr) {
    const name = tr.querySelector('.product-search').value.trim();
    const codeInput = tr.querySelector('.product-code');
    const currentEl = tr.querySelector('.row-current');
    tr.querySelector('.row-price').value = '0.00';
    if (!name) { if (codeInput) codeInput.value = ''; if (currentEl) currentEl.innerText = '-'; return; }
    // try barcode first
    let snapshot = await window.firebaseHelpers.collectionRef('products').where('barcode','==',name).limit(1).get();
    if (snapshot.empty) snapshot = await window.firebaseHelpers.collectionRef('products').where('name','==',name).limit(1).get();
    if (snapshot.empty) {
      if (codeInput) codeInput.value = '';
      if (currentEl) currentEl.innerText = '-';
      showAlert('لم يتم العثور على الصنف: سيتم إنشاؤه عند ترحيل الفاتورة', 'warning');
      return;
    }
    const doc = snapshot.docs[0];
    const data = doc.data();
    tr.dataset.productId = doc.id;
    tr.dataset.productBarcode = data.barcode || '';
    // ensure input shows product name (if barcode was typed, replace with name for clarity)
    tr.querySelector('.product-search').value = data.name || name;
    if (codeInput) codeInput.value = data.barcode || '';
    // fill unit and pack, and store pack quantity for conversions
    const unitField = tr.querySelector('.row-unit');
    const packField = tr.querySelector('.row-pack');
    const packsInput = tr.querySelector('.row-packs');
    const packObj = data.pack || {};
    tr.dataset.packQuantity = packObj.quantity || data.packNumber || data.packQuantity || '';
    if (unitField) unitField.value = unitForProduct(data);
    if (packField) packField.value = packStringForProduct(data);
    if (packsInput) packsInput.value = 0;
    // prefer purchasePrice/cost/buyPrice over salePrice but leave editable
    const preferred = data.purchasePrice || data.purchase_price || data.cost || data.buyPrice || data.salePrice || 0;
    tr.querySelector('.row-price').value = (preferred).toFixed(2);
    if (currentEl) currentEl.innerText = (data.quantity || 0);
    updateRowTotals();
  }
  inboundRows.addEventListener('input', updateRowTotals);
  updateRowTotals();

  // attach packs->units listeners for any pre-existing rows (static initial row)
  function attachPacksListeners() {
    inboundRows.querySelectorAll('tr').forEach(tr => {
      const packsEl = tr.querySelector('.row-packs');
      if (!packsEl) return;
      // avoid duplicate listeners
      if (packsEl.dataset.attached) return;
      packsEl.addEventListener('input', () => {
        const packs = Number(packsEl.value) || 0;
        const packQty = Number(tr.dataset.packQuantity) || 0;
        if (packQty && packs) {
          const qtyEl = tr.querySelector('.row-qty');
          if (qtyEl) qtyEl.value = (packs * packQty);
        }
        updateRowTotals();
      });
      packsEl.dataset.attached = '1';
    });
  }
  attachPacksListeners();

  postBtn.addEventListener('click', async () => {
    const rows = Array.from(inboundRows.querySelectorAll('tr'));
    if (!rows.length) { showAlert('لا توجد أصناف للإدخال', 'warning'); return; }

    // basic validation
    if (!invoiceNumber.value.trim()) { showAlert('يرجى إدخال رقم المستند', 'warning'); invoiceNumber.focus(); return; }
    if (!invoiceDate.value) { showAlert('يرجى إدخال تاريخ الفاتورة', 'warning'); invoiceDate.focus(); return; }

    postBtn.disabled = true;
    try {
      // build invoice object
      const invoiceData = {
        number: invoiceNumber.value.trim(),
        date: invoiceDate.value,
        supplierId: invoiceSupplier.value || null,
        supplierName: invoiceSupplier.selectedOptions[0] ? invoiceSupplier.selectedOptions[0].innerText : null,
        warehouse: invoiceWarehouse ? (invoiceWarehouse.value || null) : null,
        section: invoiceSection ? (invoiceSection.value || null) : null,
        subsection: invoiceSubsection ? (invoiceSubsection.value || null) : null,
        total: 0,
        createdAt: new Date().toISOString()
      };

      const invoiceRows = [];

      // build rows and validate that each has a selected product (barcode + product id)
      for (const tr of rows) {
        const code = tr.querySelector('.product-code')?.value.trim();
        // the row may contain packs and units; prefer units computed from packs when packs>0
        const packsCount = Number(tr.querySelector('.row-packs')?.value) || 0;
        const rawQty = Number(tr.querySelector('.row-qty')?.value) || 0;
        const price = Number(tr.querySelector('.row-price').value) || 0;
        if (!code) { showAlert('الزامي إدخال كود الصنف لكل صف', 'warning'); postBtn.disabled = false; return; }
        // attempt to find product by barcode
        let snapshot = await window.firebaseHelpers.collectionRef('products').where('barcode','==',code).limit(1).get();
        if (snapshot.empty) {
          showAlert('لم يتم العثور على الصنف بالباركود: '+code+' — الرجاء التأكد من اختيار صنف من قاعدة البيانات', 'danger');
          postBtn.disabled = false; return;
        }
        const doc = snapshot.docs[0];
        const data = doc.data() || {};
        const packVal = tr.querySelector('.row-pack') ? tr.querySelector('.row-pack').value : '';
        const unitVal = tr.querySelector('.row-unit') ? tr.querySelector('.row-unit').value : (data.unit || '');
        // determine final units to add: if packsCount and packQuantity exist use that, otherwise use rawQty
        const packQty = Number(tr.dataset.packQuantity) || 0;
        const finalUnits = (packsCount && packQty) ? (packsCount * packQty) : rawQty;
        const rowTotal = finalUnits * price;
        invoiceData.total += rowTotal;
        invoiceRows.push({ productId: doc.id, barcode: data.barcode || code, name: data.name || '', prevQty: Number(data.quantity)||0, qty: finalUnits, price, total: rowTotal, section: invoiceData.subsection || invoiceData.section || null, pack: packVal, unit: unitVal, packCount: packsCount });
      }

      if (!invoiceRows.length) { showAlert('الرجاء إضافة أصناف صحيحة في الفاتورة', 'warning'); postBtn.disabled = false; return; }

      // save invoice
      const invoiceRef = await window.firebaseHelpers.addDocument('invoices', invoiceData);

      // process rows and update products and add movements
      const summary = [];
      for (const r of invoiceRows) {
        const productDocId = r.productId;
        const prodSnap = await window.firebaseHelpers.collectionRef('products').doc(productDocId).get();
        const prodData = prodSnap.data() || {};
        const prev = Number(prodData.quantity) || 0;
        const newQty = prev + r.qty;
        // update sectionBalances map
        const sb = Object.assign({}, prodData.sectionBalances || {});
        if (r.section) sb[r.section] = (Number(sb[r.section]) || 0) + r.qty;
        await window.firebaseHelpers.updateDocument('products', productDocId, { quantity: newQty, sectionBalances: sb });
        await window.firebaseHelpers.addDocument('movements', { type: 'in', productId: productDocId, productBarcode: r.barcode || null, productName: r.name, qty: r.qty, price: r.price, date: new Date().toISOString(), invoiceId: invoiceRef.id, supplierId: invoiceData.supplierId || null, section: r.section || null, pack: r.pack || null, unit: r.unit || null, packCount: r.packCount || 0 });
        summary.push({ barcode: r.barcode, name: r.name, pack: r.pack || '', unit: r.unit || '', packCount: r.packCount || 0, prev, received: r.qty, newQty, price: r.price, total: r.total });
      }

      // store last summary for export
      lastInboundSummary = summary;

      // show summary modal with prev/received/new balances
      try {
        const content = document.getElementById('inboundSummaryContent');
          if (content) {
          content.innerHTML = `<div class="table-responsive"><table class="table table-sm table-striped"><thead><tr><th>الباركود</th><th>الاسم</th><th>شد الصنف</th><th>عدد الشد</th><th>الوحدة</th><th class="text-center">الرصيد قبل</th><th class="text-center">الوارد (وحدات)</th><th class="text-center">الرصيد بعد</th><th class="text-end">السعر</th><th class="text-end">الإجمالي</th></tr></thead><tbody>${summary.map(s=>`<tr><td>${s.barcode||''}</td><td>${s.name}</td><td>${s.pack||''}</td><td class="text-center">${s.packCount||0}</td><td>${s.unit||''}</td><td class="text-center">${s.prev}</td><td class="text-center">${s.received}</td><td class="text-center">${s.newQty}</td><td class="text-end">${s.price.toFixed(2)}</td><td class="text-end">${s.total.toFixed(2)}</td></tr>`).join('')}</tbody></table></div>`;
          // do not auto-attach export toolbar here; use the manual modal buttons (print/pdf/excel)
        }
        try { const m = new bootstrap.Modal(document.getElementById('inboundSummaryModal')); m.show(); } catch(e){}
      } catch (err) { console.error('failed to render inbound summary', err); }

      // show export/print controls now that post succeeded
      if (printBtn) printBtn.style.display = '';
      if (pdfBtn) pdfBtn.style.display = '';
      if (excelBtn) excelBtn.style.display = '';

      // reset form
      inboundRows.innerHTML = '';
      inboundRows.appendChild(makeRow());
      updateRowTotals();
      // set next invoice number for the following invoice
      await setNextInvoiceNumber();
    } catch (err) {
      console.error(err);
      showAlert('حدث خطأ أثناء الترحيل', 'danger');
    } finally {
      postBtn.disabled = false;
    }
  });

  // Do NOT auto-attach export toolbar on page load for inbound table — only attach in summary modal after post.

  // last summary for export actions
  let lastInboundSummary = null;

  // Export / print handlers for inbound summary modal
  document.getElementById('printInboundSummary')?.addEventListener('click', () => {
    const content = document.getElementById('inboundSummaryContent');
    if (!content) return;
    const w = window.open('', '_blank');
    w.document.write(`<html><head><title>ملخص الترحيل</title><link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet"></head><body dir="rtl">${content.innerHTML}</body></html>`);
    w.document.close();
    w.focus();
    w.print();
  });

  document.getElementById('pdfInboundSummary')?.addEventListener('click', () => {
    // rely on browser print-to-PDF
    document.getElementById('printInboundSummary')?.click();
  });

  document.getElementById('excelInboundSummary')?.addEventListener('click', () => {
    if (!lastInboundSummary) {
      // try to build from modal table
      const tbl = document.querySelector('#inboundSummaryContent table');
      if (!tbl) return showAlert('لا توجد بيانات للتصدير','warning');
      // fallback: trigger export toolbar if available
      if (window.exports && typeof window.exports.exportTable === 'function') return window.exports.exportTable(tbl);
      return showAlert('لا يوجد مكوّن تصدير متاح', 'warning');
    }
    // build CSV with Arabic headers (include pack, pack count & unit)
    const headers = ['الباركود','الاسم','شد الصنف','عدد الشد','الوحدة','الرصيد قبل','الوارد (وحدات)','الرصيد بعد','السعر','الإجمالي'];
    const rows = lastInboundSummary.map(r => [r.barcode||'', r.name||'', r.pack||'', r.packCount||0, r.unit||'', r.prev, r.received, r.newQty, Number(r.price).toFixed(2), Number(r.total).toFixed(2)]);
    const csv = [headers].concat(rows).map(r => r.map(cell => '"'+String(cell).replace(/"/g,'""')+'"').join(',')).join('\r\n');
    const bom = '\uFEFF';
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `inbound_summary_${new Date().toISOString().slice(0,10)}.csv`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  });
});