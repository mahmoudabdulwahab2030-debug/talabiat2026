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
      <td><input type="number" class="form-control row-qty" value="1" min="0"></td>
      <td><input type="number" class="form-control row-price" value="0.00" min="0" step="0.01"></td>
      <td class="align-middle row-total">0.00</td>
      <td><button class="btn btn-outline-danger btn-sm remove-row"><i class="bi bi-trash"></i></button></td>
    `;
    tr.querySelector('.remove-row').addEventListener('click', () => { tr.remove(); updateRowTotals(); });
    tr.querySelector('.row-qty').addEventListener('input', updateRowTotals);
    tr.querySelector('.row-price').addEventListener('input', updateRowTotals);
    tr.querySelector('.product-search').addEventListener('change', () => fillProductInfo(tr));
    // open central product picker on F1
    tr.querySelector('.product-search').addEventListener('keydown', async (e) => {
      if (e.key === 'F1') {
        e.preventDefault();
        if (window.productPicker && typeof window.productPicker.open === 'function') {
          const p = await window.productPicker.open();
          if (!p) return;
          tr.querySelector('.product-search').value = p.name || p.barcode || '';
          if (tr.querySelector('.product-code')) tr.querySelector('.product-code').value = p.barcode || '';
          const currentEl = tr.querySelector('.row-current'); if (currentEl) currentEl.innerText = (p.quantity || 0);
          if (tr.querySelector('.row-price')) tr.querySelector('.row-price').value = (p.salePrice || 0).toFixed(2);
          tr.dataset.productId = p.id;
          updateRowTotals();
        }
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
    tr.querySelector('.row-price').value = (data.salePrice || 0).toFixed(2);
    if (currentEl) currentEl.innerText = (data.quantity || 0);
    updateRowTotals();
  }
  inboundRows.addEventListener('input', updateRowTotals);
  updateRowTotals();

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
        total: 0,
        createdAt: new Date().toISOString()
      };

      const invoiceRows = [];

      for (const tr of rows) {
        const name = tr.querySelector('.product-search').value.trim();
        const qty = Number(tr.querySelector('.row-qty').value) || 0;
        const price = Number(tr.querySelector('.row-price').value) || 0;
        if (!name || qty <= 0) continue;
        const rowTotal = qty * price;
        invoiceData.total += rowTotal;
        invoiceRows.push({ name, qty, price, total: rowTotal, barcode: tr.dataset.productBarcode || null });
      }

      if (!invoiceRows.length) { showAlert('الرجاء إضافة أصناف صحيحة في الفاتورة', 'warning'); postBtn.disabled = false; return; }

      // save invoice first
      const invoiceRef = await window.firebaseHelpers.addDocument('invoices', invoiceData);

      // process rows: update/create products and add movements linking to invoice
      for (const r of invoiceRows) {
        // try find product by barcode first, then by name
        let snapshot = await window.firebaseHelpers.collectionRef('products').where('barcode','==',r.name).limit(1).get();
        if (snapshot.empty) snapshot = await window.firebaseHelpers.collectionRef('products').where('name','==',r.name).limit(1).get();
        let productId = null;
        let productBarcode = null;
        if (snapshot.empty) {
          // if input looks numeric use it as barcode
          const isBarcode = /^\d+$/.test(r.name);
          // create product with initial sectionBalances map if section provided
          const initial = { name: r.name, barcode: isBarcode ? r.name : '', quantity: r.qty, salePrice: r.price, unit: 'قطعة' };
          if (invoiceData.section) initial.sectionBalances = { [invoiceData.section]: r.qty };
          const newProductRef = await window.firebaseHelpers.addDocument('products', initial);
          productId = newProductRef.id;
          productBarcode = isBarcode ? r.name : '';
        } else {
          const productDoc = snapshot.docs[0];
          const data = productDoc.data();
          const newQty = (Number(data.quantity) || 0) + r.qty;
          // update sectionBalances map if present
          const sb = Object.assign({}, data.sectionBalances || {});
          if (invoiceData.section) sb[invoiceData.section] = (Number(sb[invoiceData.section]) || 0) + r.qty;
          await window.firebaseHelpers.updateDocument('products', productDoc.id, { quantity: newQty, sectionBalances: sb });
          productId = productDoc.id;
          productBarcode = data.barcode || '';
        }

        await window.firebaseHelpers.addDocument('movements', { type: 'in', productId, productBarcode: productBarcode || null, productName: r.name, qty: r.qty, price: r.price, date: new Date().toISOString(), invoiceId: invoiceRef.id, supplierId: invoiceData.supplierId || null, section: invoiceData.section || null });
      }

      showAlert('تم ترحيل الفاتورة وتحديث المخازن', 'success');
      // show printable summary under the form
      try {
        const containerId = 'lastInvoiceSummary';
        let container = document.getElementById(containerId);
        if (!container) {
          container = document.createElement('div'); container.id = containerId; container.className = 'mt-3';
          postBtn.parentElement.parentElement.insertAdjacentElement('afterend', container);
        }
        container.innerHTML = `<div class="card"><div class="card-body"><h6>ملخص الفاتورة: ${invoiceRef.id}</h6><div class="table-responsive"><table class="table table-sm table-striped exportable-table"><thead><tr><th>الكود/الباركود</th><th>الاسم</th><th class="text-center">الكمية</th><th class="text-end">السعر</th><th class="text-end">الإجمالي</th></tr></thead><tbody>${invoiceRows.map(r=>`<tr><td>${r.barcode||''}</td><td>${r.name}</td><td class="text-center">${r.qty}</td><td class="text-end">${r.price.toFixed(2)}</td><td class="text-end">${r.total.toFixed(2)}</td></tr>`).join('')}</tbody></table></div></div></div>`;
        // attach export toolbar
        if (window.exports && window.exports.autoAttachExportToolbar) window.exports.autoAttachExportToolbar();
      } catch (err) { console.error('failed to render invoice summary', err); }

      // reset form
      inboundRows.innerHTML = '';
      inboundRows.appendChild(makeRow());
      updateRowTotals();
      invoiceNumber.value = `INV-${new Date().getFullYear()}-` + Math.floor(Math.random()*900+100);
    } catch (err) {
      console.error(err);
      showAlert('حدث خطأ أثناء الترحيل', 'danger');
    } finally {
      postBtn.disabled = false;
    }
  });

  // attach export toolbar if available (forms with tables)
  if (window.exports && window.exports.autoAttachExportToolbar) window.exports.autoAttachExportToolbar();
});