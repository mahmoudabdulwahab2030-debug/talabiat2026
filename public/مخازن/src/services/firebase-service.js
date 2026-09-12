// Centralized Firebase service for the stock application
// Usage: import createFirebaseService from '/src/services/firebase-service.js';
export default function createFirebaseService(config = {}, prefix = 'stock_') {
  if (!window.firebase) throw new Error('Firebase SDK not loaded');

  if (!firebase.apps.length) {
    firebase.initializeApp(config);
  }

  const db = firebase.firestore();
  let PREFIX = prefix || 'stock_';

  function ensureName(name) {
    if (!name) throw new Error('Collection name required');
    return name.startsWith(PREFIX) ? name : PREFIX + name;
  }

  function collectionRef(name) {
    return db.collection(ensureName(name));
  }

  async function addDocument(collectionName, data) {
    const docRef = await collectionRef(collectionName).add({ ...data, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    return docRef;
  }

  async function updateDocument(collectionName, docId, data) {
    await collectionRef(collectionName).doc(docId).update(data);
  }

  async function deleteDocument(collectionName, docId) {
    await collectionRef(collectionName).doc(docId).delete();
  }

  async function getAll(collectionName) {
    const snap = await collectionRef(collectionName).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  function onCollection(collectionName, cb) {
    return collectionRef(collectionName).onSnapshot(cb);
  }

  function setPrefix(newPrefix) {
    PREFIX = newPrefix || PREFIX;
  }

  return {
    addDocument,
    updateDocument,
    deleteDocument,
    getAll,
    onCollection,
    collectionRef,
    setPrefix,
    _internal: { db, ensureName }
  };
}
