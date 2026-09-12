document.addEventListener('DOMContentLoaded', () => {
  const tbody = document.getElementById('suppliersTableBody');
  const addBtn = document.getElementById('addSupplierBtn');
  if (!tbody) return;

  function esc(s) { return String(s || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function renderRow(doc) {
    const tr = document.createElement('tr');
    if (doc && doc.id) tr.dataset.id = doc.id;
    tr.innerHTML = `
      <td><input class="form-control form-control-sm supplier-code" value="${esc(doc && doc.code)}" placeholder="كود المورد"></td>
      <td><input class="form-control form-control-sm supplier-name" value="${esc(doc && doc.name)}" placeholder="الاسم"></td>
      <td><input class="form-control form-control-sm supplier-phone" value="${esc(doc && doc.phone)}" placeholder="الهاتف"></td>
      <td><input class="form-control form-control-sm supplier-email" value="${esc(doc && doc.email)}" placeholder="البريد الإلكتروني"></td>
      <td><input class="form-control form-control-sm supplier-address" value="${esc(doc && doc.address)}" placeholder="العنوان"></td>
      <td><input class="form-control form-control-sm supplier-notes" value="${esc(doc && doc.notes)}" placeholder="ملاحظات"></td>
      <td><input class="form-control form-control-sm supplier-tax" value="${esc(doc && doc.taxId)}" placeholder="رقم البطاقة الضريبية"></td>
      <td>
        <button class="btn btn-sm btn-success save-supplier"><i class="bi bi-save"></i> حفظ</button>
        <button class="btn btn-sm btn-danger delete-supplier"><i class="bi bi-trash"></i> حذف</button>
      </td>
    `;

    tbody.appendChild(tr);

    const saveBtn = tr.querySelector('.save-supplier');
    const delBtn = tr.querySelector('.delete-supplier');

    saveBtn.addEventListener('click', async () => {
      const name = tr.querySelector('.supplier-name').value.trim();
      if (!name) { showAlert('اسم المورد مطلوب','danger'); return; }
      const supplier = {
        code: tr.querySelector('.supplier-code').value.trim(),
        name,
        phone: tr.querySelector('.supplier-phone').value.trim(),
        email: tr.querySelector('.supplier-email').value.trim(),
        address: tr.querySelector('.supplier-address').value.trim(),
        notes: tr.querySelector('.supplier-notes').value.trim(),
        taxId: tr.querySelector('.supplier-tax').value.trim()
      };
      try {
        if (tr.dataset.id) {
          await window.firebaseHelpers.updateDocument('suppliers', tr.dataset.id, supplier);
          showAlert('تم حفظ التعديل','success');
        } else {
          const docRef = await window.firebaseHelpers.addDocument('suppliers', supplier);
          tr.dataset.id = docRef.id;
          showAlert('تم إضافة المورد','success');
        }
      } catch (err) {
        console.error(err);
        showAlert('حدث خطأ أثناء الحفظ','danger');
      }
    });

    delBtn.addEventListener('click', async () => {
      if (!tr.dataset.id) { tr.remove(); return; }
      if (!confirm('هل تريد حذف هذا المورد؟')) return;
      try {
        await window.firebaseHelpers.deleteDocument('suppliers', tr.dataset.id);
        showAlert('تم الحذف','secondary');
      } catch (err) {
        console.error(err);
        showAlert('حدث خطأ أثناء الحذف','danger');
      }
    });
  }

  addBtn.addEventListener('click', () => {
    renderRow({});
    const last = tbody.lastElementChild; if (last) last.querySelector('.supplier-name').focus();
  });

  // Realtime sync - keep unsaved rows
  window.firebaseHelpers.onCollection('suppliers', snapshot => {
    const unsaved = [];
    tbody.querySelectorAll('tr').forEach(tr => {
      if (!tr.dataset.id) {
        unsaved.push({
          code: tr.querySelector('.supplier-code')?.value,
          name: tr.querySelector('.supplier-name')?.value,
          phone: tr.querySelector('.supplier-phone')?.value,
          email: tr.querySelector('.supplier-email')?.value,
          address: tr.querySelector('.supplier-address')?.value,
          notes: tr.querySelector('.supplier-notes')?.value,
          taxId: tr.querySelector('.supplier-tax')?.value
        });
      }
    });

    tbody.innerHTML = '';
    if (snapshot.empty && !unsaved.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-muted">لا يوجد موردين مسجلين بعد</td></tr>';
      return;
    }
    snapshot.forEach(doc => renderRow({ id: doc.id, ...doc.data() }));
    unsaved.forEach(u => renderRow(u));
    // attach export toolbar if available
    if (window.exports && window.exports.autoAttachExportToolbar) window.exports.autoAttachExportToolbar();
  });
});