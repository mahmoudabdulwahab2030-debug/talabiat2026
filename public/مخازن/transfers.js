document.addEventListener('DOMContentLoaded', () => {
  const prodInput = document.getElementById('transferProduct');
  const fromSelect = document.getElementById('transferFrom');
  const toSelect = document.getElementById('transferTo');
  const qtyInput = document.getElementById('transferQty');
  const btn = document.getElementById('doTransfer');
  const result = document.getElementById('transferResult');
  // product picker will be provided by central component
  const summary = document.getElementById('transferSummary');
  const summaryBody = document.getElementById('transferSummaryBody');

  function show(msg, type='success') { result.innerHTML = `<div class="alert alert-${type}">${msg}</div>`; }

  async function findProductByNameOrBarcode(q) {
    if (!q) return null;
    let snapshot = await window.firebaseHelpers.collectionRef('products').where('barcode','==',q).limit(1).get();
    if (snapshot.empty) snapshot = await window.firebaseHelpers.collectionRef('products').where('name','==',q).limit(1).get();
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0]; return { id: doc.id, data: doc.data() };
  }

  // Use central product picker
  async function openCentralPickerAndFill() {
    if (!window.productPicker || typeof window.productPicker.open !== 'function') return;
    const p = await window.productPicker.open();
    if (!p) return;
    prodInput.value = p.name || p.barcode || '';
    prodInput.dataset.productId = p.id;
    renderSummaryRow({ id: p.id, name: p.name||'', code: p.barcode||'' });
  }

  function renderSummaryRow(prod){
    if(!prod){ summary.style.display='none'; summaryBody.innerHTML=''; return; }
    const from = fromSelect.value || '';
    // fetch product doc to compute balance
    window.firebaseHelpers.collectionRef('products').doc(prod.id).get().then(snap=>{
      const d = snap.exists ? snap.data() : {};
      const sb = Object.assign({}, d.sectionBalances || {});
      const avail = from ? Number(sb[from]||0) : Number(d.quantity||0);
      summary.style.display = '';
      summaryBody.innerHTML = `<tr><td>${prod.name||''}</td><td>${prod.code||''}</td><td>${from||''}</td><td>${avail}</td><td>${toSelect.value||''}</td><td>${qtyInput.value||''}</td></tr>`;
    }).catch(()=>{ summary.style.display=''; summaryBody.innerHTML = `<tr><td>${prod.name||''}</td><td>${prod.code||''}</td><td>${from||''}</td><td>-</td><td>${toSelect.value||''}</td><td>${qtyInput.value||''}</td></tr>`; });
  }

  // open central picker on F1 when focused in product input
  document.addEventListener('keydown', (e) => {
    if (e.key === 'F1'){
      const active = document.activeElement;
      if (active && active.id === 'transferProduct'){
        e.preventDefault();
        openCentralPickerAndFill();
      }
    }
  });

  // update summary when from/to/qty change
  [fromSelect,toSelect,qtyInput].forEach(el=> el && el.addEventListener('change', ()=>{ const pid = prodInput.dataset.productId; if(pid) renderSummaryRow({ id: pid, name: prodInput.value, code: '' }); }));

  btn.addEventListener('click', async () => {
    const q = prodInput.value.trim();
    const from = fromSelect.value;
    const to = toSelect.value;
    const qty = Number(qtyInput.value) || 0;
    if (!q || !from || !to || from === to || qty <= 0) return show('تحقق من الحقول المدخلة', 'warning');
    btn.disabled = true;
    try {
      const found = await findProductByNameOrBarcode(q);
      if (!found) return show('لم يتم العثور على الصنف', 'warning');
      const pid = found.id; const data = found.data || {};
      const sb = Object.assign({}, data.sectionBalances || {});
      // decrement from
      const availFrom = Number(sb[from] || 0);
      if (availFrom < qty) return show(`الرصيد في القسم ${from} غير كافٍ (المتوفر ${availFrom})`, 'warning');
      sb[from] = availFrom - qty;
      sb[to] = (Number(sb[to]||0) + qty);
      // update product
      await window.firebaseHelpers.updateDocument('products', pid, { sectionBalances: sb });
      // create transfer record
      await window.firebaseHelpers.addDocument('transfers', { productId: pid, productName: data.name || '', productBarcode: data.barcode || '', from, to, qty, date: new Date().toISOString() });
      // also add movements for traceability
      await window.firebaseHelpers.addDocument('movements', { type: 'transfer_out', productId: pid, productBarcode: data.barcode||null, productName: data.name||'', qty, date: new Date().toISOString(), ref: 'transfer' });
      await window.firebaseHelpers.addDocument('movements', { type: 'transfer_in', productId: pid, productBarcode: data.barcode||null, productName: data.name||'', qty, date: new Date().toISOString(), ref: 'transfer' });
      show('تمت عملية التحويل بنجاح');
    } catch (err) { console.error(err); show('حدث خطأ أثناء التحويل','danger'); }
    finally { btn.disabled = false; }
  });
});
