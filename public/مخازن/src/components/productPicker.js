// Simple product picker component
// Provides a Promise-based API: window.productPicker.open(options)
(function(){
  function createModal() {
    if (document.getElementById('productPickerModal')) return;
    const div = document.createElement('div');
    div.innerHTML = `
      <div class="modal fade" id="productPickerModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
          <div class="modal-content">
            <div class="modal-header"><h5 class="modal-title">اختر صنف</h5><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="إغلاق"></button></div>
            <div class="modal-body">
              <div class="mb-3"><input id="productPickerSearch" class="form-control" placeholder="بحث باسم الصنف أو الكود"></div>
              <div style="max-height:50vh; overflow:auto;"><table class="table table-sm"><thead><tr><th>الكود</th><th>الاسم</th><th>الرصيد</th><th>الإجراء</th></tr></thead><tbody id="productPickerBody"></tbody></table></div>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(div);
  }

  function renderProducts(list) {
    const tbody = document.getElementById('productPickerBody');
    tbody.innerHTML = '';
    (list||[]).forEach(p => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${p.barcode||''}</td><td>${p.name||''}</td><td>${Number(p.quantity||0)}</td><td><button class="btn btn-sm btn-primary select-p">اختر</button></td>`;
      tr.querySelector('.select-p').addEventListener('click', ()=>{
        const evt = new CustomEvent('product-picked', { detail: p });
        document.getElementById('productPickerModal').dispatchEvent(evt);
      });
      tbody.appendChild(tr);
    });
  }

  createModal();

  // wait for window.firebaseHelpers to be ready (basic polling)
  function waitForFirebaseHelpers(timeout = 5000) {
    const start = Date.now();
    return new Promise((resolve, reject) => {
      function check() {
        if (window.firebaseHelpers && typeof window.firebaseHelpers.getAll === 'function') return resolve();
        if (Date.now() - start > timeout) return reject(new Error('firebaseHelpers not available'));
        setTimeout(check, 150);
      }
      check();
    });
  }

  window.productPicker = {
    open: async function(){
      try {
        await waitForFirebaseHelpers(5000);
      } catch (err) {
        console.warn('productPicker: firebaseHelpers not ready', err);
        throw err;
      }
      const products = await window.firebaseHelpers.getAll('products');
      renderProducts(products);
      const modalEl = document.getElementById('productPickerModal');
      const modal = new bootstrap.Modal(modalEl);
      const search = document.getElementById('productPickerSearch');
      search.value = '';
      search.oninput = function(){
        const q = search.value.trim().toLowerCase();
        const filtered = products.filter(p => (p.name||'').toLowerCase().includes(q) || (p.barcode||'').toLowerCase().includes(q));
        renderProducts(filtered);
      };
      return new Promise((resolve)=>{
        function onPick(e){
          modalEl.removeEventListener('product-picked', onPick);
          modal.hide();
          resolve(e.detail);
        }
        modalEl.addEventListener('product-picked', onPick);
        modal.show();
      });
    }
  };
})();
