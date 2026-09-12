/* product-import.js
   Reads an Excel/CSV file in the browser (SheetJS), previews rows, validates and imports to Firestore
*/
(function(){
  // utilities
  function toNum(v){ const n = Number(v); return isNaN(n)?0:n; }

  function mapRow(raw){
    // map possible header names to canonical fields
    const get = (keys)=>{ for(const k of keys){ if(raw[k]!==undefined) return raw[k]; } return undefined; };
    const barcode = get(['barcode','باركود','code']);
    const name = get(['name','الاسم','productName']);
    const section = get(['section','القسم']);
    const subsection = get(['subsection','التصنيف الفرعي']);
    const unit = get(['unit','الوحدة']);
    const unitWeight = toNum(get(['unitWeight','وزن الوحدة']));
    const packLabel = get(['pack.labelArabic','pack.label','شد_الاسم','packLabel','شد']);
    const packQuantity = toNum(get(['pack.quantity','شد_الكمية','packNumber','packQuantity']));
    const packUnit = get(['pack.unit','شد_الوحدة','packUnit']);
    const purchasePrice = toNum(get(['purchasePrice','سعر_الشراء','price']));
    const reorderLevel = toNum(get(['reorderLevel','حد_الطلب']));
    const processingFactor = toNum(get(['processingFactor','معامل_التجهيز']));
    const location = get(['location','مكان_التخزين']);
    const description = get(['description','الوصف']);
    const quantity = toNum(get(['quantity','الرصيد','qty']));
    const out = {
      barcode: barcode || null,
      name: name || null,
      section: section || null,
      subsection: subsection || null,
      unit: unit || null,
      unitWeight: unitWeight || null,
      pack: { labelArabic: packLabel||'', quantity: packQuantity||null, unit: packUnit||'' },
      purchasePrice: purchasePrice||0,
      reorderLevel: reorderLevel||0,
      processingFactor: processingFactor||0,
      location: location||'',
      description: description||'',
      quantity: quantity||0
    };
    return out;
  }

  async function init(){
    const openBtn = document.getElementById('openImportBtn');
    const modalEl = document.getElementById('productImportModal');
    const previewBtn = document.getElementById('previewBtn');
    const fileInput = document.getElementById('productImportFile');
    const downloadTemplateBtn = document.getElementById('downloadTemplateBtn');
    const previewTable = document.getElementById('importPreviewTable');
    const errorsEl = document.getElementById('importErrors');
    const progressEl = document.getElementById('importProgress');
    const instructionsToggle = document.getElementById('toggleInstructions');
    const instructions = document.getElementById('importInstructions');
    const startImportBtn = document.getElementById('startImportBtn');
    let parsedRows = [];

    function showModal(){ try{ new bootstrap.Modal(modalEl).show(); }catch(e){console.warn(e);} }
    openBtn?.addEventListener('click', showModal);

    instructionsToggle?.addEventListener('click', ()=>{ instructions.style.display = (instructions.style.display === 'none') ? '' : 'none'; });

    // download template (XLSX) using SheetJS minimal workbook
    downloadTemplateBtn?.addEventListener('click', ()=>{
      const headers = ['barcode','name','section','subsection','unit','unitWeight','pack.labelArabic','pack.quantity','pack.unit','purchasePrice','reorderLevel','processingFactor','location','description','quantity'];
      const example = [['202020','زيت نباتي','مواد غذائية','اخري','كجم',1,'جركن',10,'كجم',30,0,1,'رف 1','وصف',0]];
      const wb = XLSX.utils.book_new();
      const ws_data = [headers[0] ? headers : []].concat(example);
      const ws = XLSX.utils.aoa_to_sheet(ws_data);
      XLSX.utils.book_append_sheet(wb, ws, 'Products');
      const wbout = XLSX.write(wb,{bookType:'xlsx',type:'array'});
      const blob = new Blob([wbout],{type:'application/octet-stream'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'products_template.xlsx'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    });

    previewBtn?.addEventListener('click', ()=>{
      errorsEl.innerHTML = '';
      progressEl.innerHTML = '';
      startImportBtn.disabled = true;
      const f = fileInput.files && fileInput.files[0];
      if(!f) return errorsEl.innerHTML = '<div class="alert alert-warning">اختر ملفاً أولاً</div>';
      const reader = new FileReader();
      reader.onload = (e)=>{
        try{
          const data = e.target.result;
          const wb = XLSX.read(data, {type:'binary'});
          const first = wb.SheetNames[0];
          const rows = XLSX.utils.sheet_to_json(wb.Sheets[first], {defval: ''});
          if(!rows || !rows.length) return errorsEl.innerHTML = '<div class="alert alert-warning">الملف لا يحتوي صفوفاً</div>';
          // map rows
          parsedRows = rows.map(r=>mapRow(r));
          // render preview (first 50 rows)
          const head = Object.keys(parsedRows[0]||{});
          previewTable.querySelector('thead').innerHTML = '<tr>'+ ['barcode','name','section','unit','pack.labelArabic','pack.quantity','quantity'].map(h=>`<th>${h}</th>`).join('') +'</tr>';
          const body = previewTable.querySelector('tbody'); body.innerHTML = '';
          const errors = [];
          parsedRows.slice(0,200).forEach((r,i)=>{
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${r.barcode||''}</td><td>${r.name||''}</td><td>${r.section||''}</td><td>${r.unit||''}</td><td>${r.pack.labelArabic||''}</td><td>${r.pack.quantity||''}</td><td>${r.quantity||0}</td>`;
            body.appendChild(tr);
            // validate
            if(!r.name && !r.barcode) errors.push({row:i+2, msg:'مفقود: barcode أو name'});
          });
          if(errors.length){
            errorsEl.innerHTML = '<div class="alert alert-danger"><ul>'+errors.map(e=>`<li>صف ${e.row}: ${e.msg}</li>`).join('')+'</ul></div>';
          } else {
            errorsEl.innerHTML = '<div class="alert alert-success">المعاينة ناجحة — جاهز للاستيراد</div>';
            startImportBtn.disabled = false;
          }
        } catch(err){ console.error(err); errorsEl.innerHTML = '<div class="alert alert-danger">خطأ عند قراءة الملف</div>'; }
      };
      // read as binary string for xlsx
      if(f.name.toLowerCase().endsWith('.csv')) reader.readAsText(f);
      else reader.readAsBinaryString(f);
    });

    startImportBtn?.addEventListener('click', async ()=>{
      if(!parsedRows || !parsedRows.length) return errorsEl.innerHTML = '<div class="alert alert-warning">لا بيانات للاستيراد</div>';
      startImportBtn.disabled = true; previewBtn.disabled = true; fileInput.disabled = true;
      errorsEl.innerHTML = '';
      progressEl.innerHTML = '<div class="progress"><div class="progress-bar" role="progressbar" style="width:0%">0%</div></div>';
      const bar = progressEl.querySelector('.progress-bar');
      const total = parsedRows.length; let done=0; const reportErrors = [];
      for(const r of parsedRows){
        try{
          // try find by barcode
          let existing = null;
          if(r.barcode){
            const snap = await window.firebaseHelpers.collectionRef('products').where('barcode','==',String(r.barcode)).limit(1).get();
            if(!snap.empty) existing = { id: snap.docs[0].id, data: snap.docs[0].data() };
          }
          if(existing){
            // update: merge non-empty fields
            const toUpdate = {};
            ['name','section','subsection','unit','unitWeight','purchasePrice','reorderLevel','processingFactor','location','description','quantity'].forEach(k=>{ if(r[k]!==null && r[k]!=='' && r[k]!==undefined) toUpdate[k]=r[k]; });
            // pack must be set as object
            toUpdate.pack = r.pack || {};
            await window.firebaseHelpers.updateDocument('products', existing.id, toUpdate);
          } else {
            // create new
            const doc = Object.assign({}, r);
            // ensure pack is object and quantity numeric
            doc.pack = r.pack || {};
            await window.firebaseHelpers.addDocument('products', doc);
          }
        } catch(err){ console.error(err); reportErrors.push(err.message || String(err)); }
        done++; const pct = Math.round((done/total)*100); if(bar) { bar.style.width = pct+'%'; bar.innerText = pct+'%'; }
      }
      // finished
      if(reportErrors.length) errorsEl.innerHTML = '<div class="alert alert-warning">انتهى الاستيراد مع أخطاء: '+reportErrors.length+'</div>';
      else errorsEl.innerHTML = '<div class="alert alert-success">تم الاستيراد بنجاح: '+total+' صف</div>';
      startImportBtn.disabled = false; previewBtn.disabled = false; fileInput.disabled = false;
      // reload products page or keep modal open
    });
  }

  // wait for SheetJS to be available
  function waitForXLSX(timeout=5000){ return new Promise((res,rej)=>{ const t0=Date.now(); (function check(){ if(window.XLSX) return res(); if(Date.now()-t0>timeout) return rej(new Error('XLSX not loaded')); setTimeout(check,100); })(); }); }
  // init after DOM
  document.addEventListener('DOMContentLoaded', async ()=>{ try{ await waitForXLSX(3000); init(); }catch(e){ console.warn('product-import: XLSX not available yet',e); init(); } });
})();
