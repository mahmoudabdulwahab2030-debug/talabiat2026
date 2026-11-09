/* محرر شرح الصفحات — يُفتح من لوحة التحكم عبر GuideAdmin.open() */
(function () {
  var PAGES = ["Dashboard.html", "Moled.html", "add-news.html", "add-product.html", "admin-dashboard.html", "admin.html", "all-orders.html", "all-reservations.html", "best-sweet-abbassia.html", "best-sweet-all-orders.html", "best-sweet-branch1.html", "best-sweet-execution-tracking.html", "best-sweet-helw-zaytoun.html", "best-sweet-helwan.html", "best-sweet-market-zaytoun.html", "best-sweet-obour-market.html", "best-sweet.html", "branch-bestsweet.html", "branch-ledoux.html", "branch.html", "chat-safe.html", "chat.html", "compare.html", "conversation.html", "dashboard-orders.html", "data-browser.html", "delivery-orders.html", "dokki.html", "execution-tracking.html", "korba.html", "main.html", "manage-invoices.html", "manage-uploads-best-sweet.html", "manage-uploads.html", "obour.html", "order-builder.html", "orders-management.html", "product-notes.html", "production-plan.html", "quality.html", "qualitydata.html", "query.html", "range-orders.html", "report.html", "reservation.html", "reservations-summary.html", "send-branches-unified.html", "send-to-best-sweet.html", "send-to-branches.html", "suggestions.html", "summary.html", "tagamo3.html", "upload-catalog.html", "user-activity-report.html", "view-file.html", "view-invoices.html"];
  var TPLS = [['standard','قياسي'],['split','صورة جانبية'],['hero','ترحيبي'],['tip','نصيحة']];
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function ensureCss(){ if(!document.getElementById('gtCss')){var l=document.createElement('link');l.id='gtCss';l.rel='stylesheet';l.href='/lovable-data/guide-glass.css?v=1';document.head.appendChild(l);} }
  function shrink(file){return new Promise(function(res,rej){var r=new FileReader();r.onload=function(){var im=new Image();im.onload=function(){var m=1100,s=Math.min(1,m/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=im.width*s;c.height=im.height*s;c.getContext('2d').drawImage(im,0,0,c.width,c.height);res(c.toDataURL('image/jpeg',0.78));};im.onerror=rej;im.src=r.result;};r.onerror=rej;r.readAsDataURL(file);});}
  var root, g, cur=0, page;
  function blank(){return{title:'',body:'',image:'',target:'',layout:'standard'};}
  function close(){ if(root){root.remove();root=null;} }
  function open(){
    ensureCss(); close();
    root=document.createElement('div'); root.className='gt-root';
    root.innerHTML='<div class="gt-overlay"></div><div class="gt-card gt-wide" style="width:min(980px,calc(100vw - 20px))"></div>';
    document.body.appendChild(root);
    root.firstChild.onclick=close;
    page=PAGES[0]; loadPage();
  }
  function loadPage(){
    var card=root.children[1]; card.innerHTML='<div class="gt-body">⏳ جاري التحميل...</div>';
    db.collection('settings').doc('guide__'+page.toLowerCase()).get().then(function(d){
      g=d.exists?d.data():{title:'',enabled:true,autoShow:true,version:0,steps:[]};
      if(!g.steps||!g.steps.length) g.steps=[blank()];
      cur=0; render();
    }).catch(function(e){card.innerHTML='<div class="gt-body">تعذر التحميل: '+esc(e.message)+'</div>';});
  }
  function render(){
    var card=root.children[1], s=g.steps[cur];
    var opts=PAGES.map(function(p){return '<option'+(p===page?' selected':'')+'>'+esc(p)+'</option>';}).join('');
    card.innerHTML='<div class="gt-head"><div class="gt-badge">📘</div><div><div class="gt-kicker">لوحة التحكم</div><h3 class="gt-title">إعدادات شرح الصفحات</h3></div><button class="gt-x" data-a="close">✕</button></div>'+
    '<div class="gt-row" style="margin-bottom:12px"><label class="gt-field" style="flex:1;min-width:200px">الصفحة<select class="gt-in" id="gaPage">'+opts+'</select></label>'+
    '<label class="gt-field" style="flex:1;min-width:200px">عنوان الشرح<input class="gt-in" id="gaTitle" value="'+esc(g.title)+'" placeholder="مثال: كيف تستخدم صفحة التجميع"></label></div>'+
    '<div class="gt-row" style="margin-bottom:12px"><label class="gt-switch"><input type="checkbox" id="gaEn"'+(g.enabled!==false?' checked':'')+'> الشرح مفعّل</label><label class="gt-switch"><input type="checkbox" id="gaAuto"'+(g.autoShow!==false?' checked':'')+'> يظهر تلقائياً أول مرة</label></div>'+
    '<div class="gt-ed"><div><div class="gt-list">'+g.steps.map(function(x,k){return '<div class="gt-item'+(k===cur?' on':'')+'" data-k="'+k+'"><b>'+(k+1)+'</b><span>'+esc(x.title||'خطوة بدون عنوان')+'</span><button class="gt-mini" data-up="'+k+'" title="أعلى">▲</button><button class="gt-mini" data-dn="'+k+'" title="أسفل">▼</button></div>';}).join('')+'</div>'+
    '<div class="gt-row" style="margin-top:8px"><button class="gt-btn" data-a="add">➕ خطوة</button><button class="gt-btn gt-danger" data-a="del">🗑 حذف</button></div></div>'+
    '<div><div class="gt-field">القالب<div class="gt-tpls">'+TPLS.map(function(t){return '<div class="gt-tpl'+((s.layout||'standard')===t[0]?' on':'')+'" data-t="'+t[0]+'">'+t[1]+'</div>';}).join('')+'</div></div>'+
    '<label class="gt-field">عنوان الخطوة<input class="gt-in" data-f="title" value="'+esc(s.title)+'"></label>'+
    '<label class="gt-field">نص الشرح<textarea class="gt-in" data-f="body">'+esc(s.body)+'</textarea></label>'+
    '<label class="gt-field">الإشارة لزر أو عنصر في الصفحة (اختياري) — اكتب نص الزر كما يظهر<input class="gt-in" data-f="target" value="'+esc(s.target)+'" placeholder="مثال: تجميع الطلبات"></label>'+
    '<div class="gt-field">صورة (اختياري)<div class="gt-row"><label class="gt-btn">🖼 اختيار صورة<input type="file" accept="image/*" id="gaImg" hidden></label>'+(s.image?'<button class="gt-btn gt-danger" data-a="rmimg">إزالة الصورة</button>':'')+'</div>'+(s.image?'<img class="gt-thumb" src="'+esc(s.image)+'">':'')+'</div></div></div>'+
    '<div class="gt-foot" style="margin-top:14px"><span class="gt-kicker" style="margin-inline-end:auto">'+g.steps.length+' خطوة'+(g.version?' • الإصدار '+g.version:'')+'</span><button class="gt-btn gt-danger" data-a="wipe">حذف شرح الصفحة</button><button class="gt-btn" data-a="preview">👁 معاينة</button><button class="gt-btn gt-primary" data-a="save">💾 حفظ ونشر</button></div>';
    card.querySelector('#gaPage').onchange=function(e){page=e.target.value;loadPage();};
    card.querySelector('#gaTitle').oninput=function(e){g.title=e.target.value;};
    card.querySelector('#gaEn').onchange=function(e){g.enabled=e.target.checked;};
    card.querySelector('#gaAuto').onchange=function(e){g.autoShow=e.target.checked;};
    card.querySelectorAll('[data-f]').forEach(function(el){el.oninput=function(){s[el.dataset.f]=el.value; if(el.dataset.f==='title'){var sp=card.querySelector('.gt-item.on span'); if(sp) sp.textContent=el.value||'خطوة بدون عنوان';}};});
    card.querySelectorAll('[data-t]').forEach(function(el){el.onclick=function(){s.layout=el.dataset.t;render();};});
    card.querySelectorAll('.gt-item').forEach(function(el){el.onclick=function(e){var u=e.target.dataset.up,d=e.target.dataset.dn;if(u!=null||d!=null){var a=+(u!=null?u:d),b=u!=null?a-1:a+1;if(b<0||b>=g.steps.length)return;var t=g.steps[a];g.steps[a]=g.steps[b];g.steps[b]=t;cur=b;}else cur=+el.dataset.k;render();};});
    card.querySelector('#gaImg').onchange=function(e){var f=e.target.files[0];if(!f)return;shrink(f).then(function(d){s.image=d;render();});};
    card.querySelectorAll('[data-a]').forEach(function(b){b.onclick=act[b.dataset.a];});
  }
  var act={
    close:close,
    add:function(){g.steps.splice(cur+1,0,blank());cur++;render();},
    del:function(){if(g.steps.length<=1){g.steps=[blank()];}else{g.steps.splice(cur,1);cur=Math.max(0,cur-1);}render();},
    rmimg:function(){g.steps[cur].image='';render();},
    preview:function(){ if(!window.GuideTour) return alert('العارض غير محمّل'); var p=JSON.parse(JSON.stringify(g)); p.page=page; root.style.display='none'; window.GuideTour.play(p,{preview:true,onClose:function(){ if(root) root.style.display=''; }}); },
    save:function(){
      var steps=g.steps.filter(function(x){return x.title||x.body||x.image;});
      if(!steps.length) return alert('أضف خطوة واحدة على الأقل');
      var data={page:page.toLowerCase(),title:g.title||'',enabled:g.enabled!==false,autoShow:g.autoShow!==false,steps:steps,version:(+g.version||0)+1,updatedBy:localStorage.getItem('username')||'',updatedAt:new Date().toISOString()};
      db.collection('settings').doc('guide__'+data.page).set(data).then(function(){g=data;render();if(window.Swal)Swal.fire({icon:'success',title:'تم الحفظ',text:'سيظهر الشرح للمستخدمين عند فتح الصفحة',timer:1800,showConfirmButton:false});}).catch(function(e){alert('تعذر الحفظ: '+e.message);});
    },
    wipe:async function(){ if(!await appConfirm('حذف شرح هذه الصفحة نهائياً؟'))return; db.collection('settings').doc('guide__'+page.toLowerCase()).delete().then(loadPage); }
  };
  window.GuideAdmin={open:open};
})();
