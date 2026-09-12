// Simple cross-page activity logger
// Usage: include this script after firebase is initialized on the page.
(function(){
  function safe(fn){ try{ return fn(); } catch(e){ console.warn('activity-logger:', e); return null; } }

  const al = {};
  al.getDb = function(){
    if (window.db) return window.db;
    if (window.firebase && firebase.firestore) return firebase.firestore();
    return null;
  };

  al.getCurrentUser = function(){
    // prefer userCode, fall back to userUid
    const userCode = safe(()=>localStorage.getItem('userCode')) || null;
    const userUid = safe(()=>localStorage.getItem('userUid')) || null;
    const username = safe(()=>localStorage.getItem('username')) || null;
    return { id: userCode || userUid || null, code: userCode || null, uid: userUid || null, name: username || null };
  };

  al.logActivity = async function(action, page, details){
    try{
      const dbRef = al.getDb();
      if (!dbRef) return;
      const u = al.getCurrentUser();
      const payload = {
        user: u.id || 'anonymous',
        userCode: u.code || null,
        userUid: u.uid || null,
        username: u.name || null,
        action: action || '',
        page: page || (location.pathname + location.search),
        details: details || null,
        timestamp: (window.firebase && firebase.firestore && firebase.firestore.FieldValue) ? firebase.firestore.FieldValue.serverTimestamp() : Date.now()
      };
      // write without awaiting to avoid blocking navigation, but catch errors
      dbRef.collection('activity_logs').add(payload).catch(e=>console.warn('activity-log add failed', e));
    }catch(e){ console.warn('activity-logger.logActivity', e); }
  };

  // auto log page view on load (debounced to run after DOM ready)
  if (document && document.readyState !== 'complete'){
    window.addEventListener('load', ()=>{ setTimeout(()=> al.logActivity('page_view', location.pathname, {title: document.title}), 200); });
  } else {
    setTimeout(()=> al.logActivity('page_view', location.pathname, {title: document.title}), 200);
  }

  // expose globally
  window.activityLogger = al;
})();
