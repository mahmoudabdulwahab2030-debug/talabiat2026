document.addEventListener('DOMContentLoaded', () => {
  const prListBody = document.getElementById('prListBody');
  const prItemsModalEl = document.getElementById('prItemsModal');
  const prItemsModal = prItemsModalEl ? new bootstrap.Modal(prItemsModalEl) : null;
  const prItemsBody = document.getElementById('prItemsBody');

  // details modal (used for detailed view)
  const prDetailsModalEl = document.getElementById('prDetailsModal');
  const prDetailsModal = prDetailsModalEl ? new bootstrap.Modal(prDetailsModalEl) : null;

  // Filters & bulk controls
  const filterFrom = document.getElementById('filterFrom');
  const filterTo = document.getElementById('filterTo');
  const filterStatus = document.getElementById('filterStatus');
  const filterSupplier = document.getElementById('filterSupplier');
  const filterBtn = document.getElementById('filterBtn');
  const clearFilters = document.getElementById('clearFilters');
  const selectAllBox = document.getElementById('selectAll');
  const bulkAction = document.getElementById('bulkAction');
  const bulkExpectedDate = document.getElementById('bulkExpectedDate');
  const bulkApply = document.getElementById('bulkApply');

  // supplier cache
  const supplierMap = {};
  window.firebaseHelpers.onCollection('suppliers', snapshot => {
    filterSupplier.innerHTML = '<option value="">الكل</option>';
    snapshot.forEach(doc => {
      supplierMap[doc.id] = (doc.data().name || '(بدون اسم)');
      const opt = document.createElement('option'); opt.value = doc.id; opt.innerText = doc.data().name || '(بدون اسم)';
      filterSupplier.appendChild(opt);
    });
  });

  // local store for filtering
  let allRequests = [];

  function statusBadge(s) {
    if (!s || s === 'pending') return '<span class="badge bg-secondary">قيد الانتظار</span>';
    if (s === 'rejected') return '<span class="badge bg-danger">مرفوض</span>';
    if (s === 'purchasing') return '<span class="badge bg-warning text-dark">قيد الشراء</span>';
    if (s === 'purchased') return '<span class="badge bg-success">تم الشراء</span>';
    if (s === 'scheduled') return '<span class="badge bg-info text-dark">سيتم التوفير</span>';
    return `<span class="badge bg-secondary">${s}</span>`;
  }

  function statusLabel(s) {
    if (!s || s === 'pending') return 'قيد الانتظار';
    if (s === 'rejected') return 'مرفوض';
    if (s === 'purchasing') return 'قيد الشراء';
    if (s === 'purchased') return 'تم الشراء';
    if (s === 'scheduled') return 'سيتم التوفير';
    return s;
  }

  function renderFiltered() {
    prListBody.innerHTML = '';
    const from = filterFrom.value ? new Date(filterFrom.value) : null;
    const to = filterTo.value ? new Date(filterTo.value) : null;
    const st = filterStatus.value;
    const sup = filterSupplier.value;

    const filtered = allRequests.filter(r => {
      const d = r.data;
      if (st && d.status !== st) return false;
      if (sup && d.supplierId !== sup) return false;
      if (from || to) {
        const dt = d.date ? new Date(d.date) : null;
        if (from && (!dt || dt < from)) return false;
        if (to && (!dt || dt > to)) return false;
      }
      return true;
    });

    if (!filtered.length) { prListBody.innerHTML = '<tr><td colspan="7" class="text-muted">لا توجد نتائج</td></tr>'; return; }

    filtered.forEach(r => {
      const id = r.id; const d = r.data;
      const itemsSummary = (d.items || []).map(i => `${i.barcode||''} ${i.name} x${i.qty}`).join('<br>');
      const tr = document.createElement('tr');

      // visual mark for finalized requests
      const finalizedClass = d.finalized ? 'table-secondary' : '';
      tr.className = finalizedClass;

      tr.innerHTML = `
        <td>${d.finalized ? '<span class="text-muted small">-</span>' : `<input type="checkbox" class="select-pr" data-id="${id}">`}</td>
        <td>${d.number || ''}</td>
        <td>${d.date || ''}</td>
        <td>${supplierMap[d.supplierId] || d.supplierId || ''}</td>
        <td style="min-width:250px">${itemsSummary}${d.expectedDate ? `<div class="text-muted small mt-1">موعد التوريد: ${d.expectedDate}</div>` : ''}</td>
        <td>${statusBadge(d.status)} ${d.finalized ? '<span class="badge bg-dark ms-1">نهائي</span>' : ''}</td>
        <td>
          <button class="btn btn-sm btn-outline-primary view-btn me-1">عرض</button>
          <div class="d-inline-block">
            ${d.finalized ? '<span class="text-muted small">غير متاح</span>' : `<select class="form-select form-select-sm d-inline-block row-action" style="width:150px">
              <option value="">اختر إجراء</option>
              <option value="scheduled">جدولة</option>
              <option value="purchasing">قيد الشراء</option>
              <option value="purchased">تم الشراء</option>
              <option value="rejected">رفض</option>
            </select>
            <button class="btn btn-sm btn-outline-secondary apply-row-action ms-1">تطبيق</button>`}
          </div>
        </td>
      `;

      const viewBtn = tr.querySelector('.view-btn');
      if (viewBtn) viewBtn.addEventListener('click', () => {
        // populate details modal
        document.getElementById('detailNumber').innerText = d.number || '';
        document.getElementById('detailDate').innerText = d.date || '';
        document.getElementById('detailSupplier').innerText = supplierMap[d.supplierId] || d.supplierId || '';
        document.getElementById('detailCreator').innerText = d.createdBy || '-';
        document.getElementById('detailStatus').innerHTML = statusBadge(d.status);
        document.getElementById('detailExpected').innerText = d.expectedDate || '-';

        const tb = document.getElementById('detailItemsBody'); tb.innerHTML = '';
        (d.items || []).forEach(i => {
          const row = document.createElement('tr');
          row.innerHTML = `<td>${i.barcode||''}</td><td>${i.name||''}</td><td class="text-center">${i.qty||0}</td><td>${i.note? i.note : ''}</td>`;
          tb.appendChild(row);
        });

        // show modal (use pre-created instance if available)
        if (prDetailsModal) prDetailsModal.show();
        else {
          const el = document.getElementById('prDetailsModal');
          if (el) new bootstrap.Modal(el).show();
        }
      });

      const applyBtn = tr.querySelector('.apply-row-action');
      if (applyBtn) applyBtn.addEventListener('click', async (ev) => {
        const actionEl = tr.querySelector('.row-action');
        const action = actionEl ? actionEl.value : '';
        if (!action) { showAlert('اختر إجراءًا لتطبيقه', 'warning'); return; }
        // prevent changes on finalized requests
        if (d.finalized) { showAlert('هذا الطلب نهائي ولا يمكن تغييره', 'warning'); return; }

        if (action === 'rejected') {
          // open confirm modal for single reject
          pendingRejectIds = [id];
          confirmRejectReason.value = '';
          if (confirmRejectModal) confirmRejectModal.show();
          return;
        }

        let payload = { status: action, statusUpdatedAt: new Date().toISOString() };
        if (action === 'scheduled') {
          const date = await appPrompt('حدد تاريخ التوفير المتوقع (YYYY-MM-DD):', '');
          if (!date) { showAlert('لم يتم تحديد تاريخ', 'warning'); return; }
          payload.expectedDate = date; payload.status = 'scheduled';
        }
        try { await window.firebaseHelpers.updateDocument('purchase_requests', id, payload); showAlert('تم تطبيق الإجراء', 'success'); } catch (err) { console.error(err); showAlert('حدث خطأ','danger'); }
      });

      prListBody.appendChild(tr);
    });
    // attach export toolbar if available (for tables that render later)
    if (window.exports && window.exports.autoAttachExportToolbar) window.exports.autoAttachExportToolbar();
  }

  // handle select all
  if (selectAllBox) {
    selectAllBox.addEventListener('change', () => {
      const boxes = Array.from(document.querySelectorAll('.select-pr'));
      boxes.forEach(b => b.checked = selectAllBox.checked);
    });
  }

  // Confirm Reject modal elements
  const confirmRejectModalEl = document.getElementById('confirmRejectModal');
  const confirmRejectModal = confirmRejectModalEl ? new bootstrap.Modal(confirmRejectModalEl) : null;
  const confirmRejectBtn = document.getElementById('confirmRejectBtn');
  const confirmRejectReason = document.getElementById('confirmRejectReason');
  let pendingRejectIds = [];

  // bulk apply
  bulkApply.addEventListener('click', async () => {
    const action = bulkAction.value;
    if (!action) { showAlert('اختر إجراءًا مجمّعًا', 'warning'); return; }
    let selected = Array.from(document.querySelectorAll('.select-pr:checked')).map(ch => ch.dataset.id);
    if (!selected.length) { showAlert('اختر طلبًا واحدًا على الأقل', 'warning'); return; }

    // filter out finalized requests
    const allowed = selected.filter(id => {
      const rec = allRequests.find(r => r.id === id);
      return rec && !rec.data.finalized;
    });
    if (!allowed.length) { showAlert('الطلبات المحددة نهائية ولا يمكن تعديلها', 'warning'); return; }
    if (allowed.length !== selected.length) showAlert('بعض الطلبات تجاهلت لأنها نهائية', 'info');

    if (action === 'rejected') {
      // open confirm modal to collect reason and confirmation
      pendingRejectIds = allowed;
      confirmRejectReason.value = '';
      if (confirmRejectModal) confirmRejectModal.show();
      return;
    }

    const expectedDate = bulkExpectedDate.value || null;
    const updates = allowed.map(id => {
      const payload = { status: action, statusUpdatedAt: new Date().toISOString() };
      if (action === 'scheduled' && expectedDate) payload.expectedDate = expectedDate;
      return window.firebaseHelpers.updateDocument('purchase_requests', id, payload);
    });
    try { await Promise.all(updates); showAlert('تم تطبيق الإجراء على الطلبات المحددة', 'success'); } catch (err) { console.error(err); showAlert('حدث خطأ أثناء تحديث الطلبات','danger'); }
  });

  // handle confirm reject modal confirmation
  if (confirmRejectBtn) confirmRejectBtn.addEventListener('click', async () => {
    const reason = confirmRejectReason.value.trim() || null;
    if (!pendingRejectIds.length) { showAlert('لا توجد طلبات للرفض', 'warning'); if (confirmRejectModal) confirmRejectModal.hide(); return; }
    try {
      const updates = pendingRejectIds.map(id => window.firebaseHelpers.updateDocument('purchase_requests', id, { status: 'rejected', rejectedReason: reason, statusUpdatedAt: new Date().toISOString(), rejectedAt: new Date().toISOString(), finalized: true }));
      await Promise.all(updates);
      showAlert('تم رفض الطلبات المختارة نهائياً', 'success');
      pendingRejectIds = [];
      if (confirmRejectModal) confirmRejectModal.hide();
    } catch (err) { console.error(err); showAlert('حدث خطأ أثناء رفض الطلبات','danger'); }
  });

  filterBtn.addEventListener('click', renderFiltered);
  clearFilters.addEventListener('click', () => { filterFrom.value = ''; filterTo.value = ''; filterStatus.value = ''; filterSupplier.value = ''; renderFiltered(); });

  // Real-time source
  window.firebaseHelpers.onCollection('purchase_requests', snapshot => {
    allRequests = snapshot.docs.map(d => ({ id: d.id, data: d.data() }));
    renderFiltered();
  });
});
