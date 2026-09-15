/* whatsapp-autoload.js
   عند فتح صفحة فرع بالرابط ?wa=<id>&date=<yyyy-mm-dd>
   يقوم بتحميل ملف الإكسيل الوارد من واتساب ووضعه في نفس حقل الملف الحالي
   وتحديد التاريخ، بدون تغيير أي منطق موجود في الصفحة.
*/
(function () {
  var BUCKET = 'whatsapp-inbox';

  function toast(msg, type) {
    if (window.Swal) {
      Swal.fire({ toast: true, position: 'top', timer: 3500, showConfirmButton: false, icon: type || 'success', title: msg });
    } else {
      console.log('[whatsapp]', msg);
    }
  }

  function waitFor(check, timeout) {
    return new Promise(function (resolve, reject) {
      var t0 = Date.now();
      (function loop() {
        if (check()) return resolve();
        if (Date.now() - t0 > (timeout || 8000)) return reject(new Error('timeout'));
        setTimeout(loop, 100);
      })();
    });
  }

  async function run() {
    var params = new URLSearchParams(location.search);
    var waId = params.get('wa');
    if (!waId) return;
    var date = params.get('date') || '';

    try {
      await waitFor(function () { return window.lovableDb && document.getElementById('excelFile'); });
    } catch (e) { return; }

    var db = window.lovableDb;
    var res = await db.from('whatsapp_files').select('*').eq('id', waId).limit(1);
    var row = res.data && res.data[0];
    if (!row) return toast('لم يتم العثور على الملف الوارد', 'error');
    var info = row.data || {};
    if (!info.storagePath) return toast('مسار الملف غير متوفر', 'error');

    var dl = await db.storage.from(BUCKET).download(info.storagePath);
    if (dl.error || !dl.data) return toast('تعذر تحميل الملف من واتساب', 'error');

    var file = new File([dl.data], info.filename || 'whatsapp.xlsx', {
      type: info.mime || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    var dateInput = document.getElementById('orderDate');
    if (dateInput && date) {
      dateInput.value = date;
      dateInput.dispatchEvent(new Event('change', { bubbles: true }));
    }

    var input = document.getElementById('excelFile');
    var dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));

    toast('تم تحميل ملف واتساب: ' + (info.filename || '') + ' — اضغط زر الرفع', 'success');

    ['uploadBtn', 'uploadAllBtn'].forEach(function (id) {
      var btn = document.getElementById(id);
      if (!btn) return;
      btn.addEventListener('click', function () {
        setTimeout(function () {
          var next = Object.assign({}, info, { status: 'uploaded', orderDate: date, uploadedAt: new Date().toISOString() });
          db.from('whatsapp_files').update({ data: next }).eq('id', waId).then(function () {});
        }, 4000);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
