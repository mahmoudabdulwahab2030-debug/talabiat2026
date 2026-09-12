```javascript
// مركزي: تهيئة خاطفة (إذا لم تكن مُهيأة) ودالة logActivity
(function(){
	// ...existing code...
	const firebaseConfig = {
	  apiKey: "AIzaSyA5nOr7oPJQydnZTUULmf2YxE33ppYz2Gw",
	  authDomain: "ledoux-80b46.firebaseapp.com",
	  projectId: "ledoux-80b46",
	  storageBucket: "ledoux-80b46.appspot.com",
	  messagingSenderId: "1020769543389",
	  appId: "1:1020769543389:web:fc083525fd9675d9f86734",
	  measurementId: "G-VJTW1W3D8D"
	};
	try {
	  if (!window.firebase || !firebase.firestore) {
	    console.warn('Firebase not loaded before activity-logger.js');
	  } else {
	    if (!firebase.apps || firebase.apps.length === 0) {
	      firebase.initializeApp(firebaseConfig);
	    }
	    window.__activity_db = firebase.firestore();
	  }
	} catch(e){ console.error('activity-logger init error', e); }

	// user helper: حاول قراءة اسم المستخدم من localStorage أو query param
	function getCurrentUser() {
	  try {
	    const u = localStorage.getItem('username') || localStorage.getItem('user') || new URLSearchParams(window.location.search).get('user');
	    return u || 'anonymous';
	  } catch(e){ return 'anonymous'; }
	}

	// دالة عامة لتسجيل حدث
	window.logActivity = async function(action, details){
	  try {
	    if (!window.__activity_db) {
	      console.warn('No firestore DB available for activity logs');
	      return;
	    }
	    const entry = {
	      user: getCurrentUser(),
	      action: action || '',
	      page: location.pathname || location.href,
	      details: details || {},
	      createdAt: firebase.firestore.FieldValue.serverTimestamp()
	    };
	    await window.__activity_db.collection('activity_logs').add(entry);
	  } catch(err) {
	    console.error('logActivity error', err);
	  }
	};
	// ...existing code...
})();
```