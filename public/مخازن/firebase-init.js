// firebase-init.js — lightweight shim that creates a centralized firebase service
// It dynamically imports /src/services/firebase-service.js and exposes the
// same helpers on window.firebaseHelpers for backward compatibility.
const firebaseConfig = {
  apiKey: "AIzaSyA5nOr7oPJQydnZTUULmf2YxE33ppYz2Gw",
  authDomain: "ledoux-80b46.firebaseapp.com",
  projectId: "ledoux-80b46",
  storageBucket: "ledoux-80b46.appspot.com",
  messagingSenderId: "1020769543389",
  appId: "1:1020769543389:web:fc083525fd9675d9f86734",
  measurementId: "G-VJTW1W3D8D"
};

(async function init() {
  try {
    // Create a synchronous compatibility shim immediately so pages can use
    // `window.firebaseHelpers` before the async module import completes.
    if (!window.firebase) throw new Error('Firebase SDK not loaded');
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }

    // local prefix used by the shim; the async module will replace this when
    // it's loaded.
    let PREFIX = 'stock_';

    function ensureName(name) {
      if (!name) throw new Error('Collection name required');
      return name.startsWith(PREFIX) ? name : PREFIX + name;
    }

    function collectionRef(name) {
      return firebase.firestore().collection(ensureName(name));
    }

    // synchronous shim implementations using compat SDK
    window.firebaseHelpers = {
      addDocument(collectionName, data) {
        return collectionRef(collectionName).add({ ...data, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
      },
      updateDocument(collectionName, docId, data) {
        return collectionRef(collectionName).doc(docId).update(data);
      },
      deleteDocument(collectionName, docId) {
        return collectionRef(collectionName).doc(docId).delete();
      },
      async getAll(collectionName) {
        const snap = await collectionRef(collectionName).get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
      },
      onCollection(collectionName, cb) {
        return collectionRef(collectionName).onSnapshot(cb);
      },
      collectionRef(name) {
        return collectionRef(name);
      },
      setPrefix(newPrefix) {
        PREFIX = newPrefix || PREFIX;
      },
      _internal: { ensureName }
    };

    // Now dynamically import the centralized service and replace the shim with
    // the more fully-featured implementation when available.
    const module = await import('./src/services/firebase-service.js');
    const createService = module && module.default ? module.default : null;
    if (!createService) {
      console.warn('Firebase service module not found, keeping shim implementation');
      return;
    }
    const service = createService(firebaseConfig, PREFIX);

    // Replace shim with the centralized service methods (keeps same API).
    window.firebaseHelpers = {
      addDocument: service.addDocument,
      updateDocument: service.updateDocument,
      deleteDocument: service.deleteDocument,
      getAll: service.getAll,
      onCollection: service.onCollection,
      collectionRef: service.collectionRef,
      setPrefix: service.setPrefix,
      _internal: service._internal
    };
  } catch (err) {
    console.error('Failed to initialize centralized firebase service', err);
  }
})();
