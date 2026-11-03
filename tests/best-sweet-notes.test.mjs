import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const pages = ['best-sweet-branch1', 'best-sweet-abbassia', 'best-sweet-market-zaytoun', 'best-sweet-helwan', 'best-sweet-helw-zaytoun', 'best-sweet-obour-market', 'branch-bestsweet'];

function setup(page) {
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, { value: '', textContent: '', innerHTML: '', style: {}, addEventListener() {}, appendChild() {} });
    return elements.get(id);
  };
  let stored = [];
  let serial = 0;
  const query = {
    where() { return this; },
    doc(id) { return { id: id || `row-${++serial}` }; },
    async get() {
      return { empty: !stored.length, forEach(callback) { stored.forEach(row => callback({ id: row.id, ref: { id: row.id }, data: () => row.data })); } };
    },
  };
  const db = {
    collection: () => query,
    batch() {
      const operations = [];
      return {
        set(ref, data) { operations.push(() => stored.push({ id: ref.id, data })); },
        delete(ref) { operations.push(() => { stored = stored.filter(row => row.id !== ref.id); }); },
        async commit() { operations.forEach(operation => operation()); },
      };
    },
  };
  const context = vm.createContext({
    document: { getElementById: element, addEventListener(event, callback) { if (event === 'DOMContentLoaded') callback(); } },
    firebase: { apps: [1], initializeApp() {}, firestore: Object.assign(() => db, { FieldValue: { serverTimestamp: () => 'timestamp' } }) },
    localStorage: { getItem: () => '' },
    Swal: { async fire() { return { isConfirmed: true }; }, close() {}, showLoading() {} },
    DYN_BRANCH: { id: 'dynamic_test' }, console,
  });
  context.window = context;
  const html = fs.readFileSync(`public/${page}.html`, 'utf8');
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(match => match[1]);
  const script = scripts.find(source => /const db\s*=/.test(source));
  assert.ok(script);
  vm.runInContext(script, context);
  return { context, element, rows: () => stored, run: code => vm.runInContext(code, context) };
}

for (const page of pages) {
  test(`${page}: Excel notes survive upload and an edit save`, async () => {
    const app = setup(page);
    app.element('orderDate').value = '2099-11-03';
    app.run(`workbookData = { section: [['code','name','qty','notes'], ['101','item',3,'Excel note']] };`);
    if (page === 'best-sweet-obour-market') {
      app.run(`renderRows(workbookData.section, 'section');`);
      await app.run(`uploadItems(currentData, '2099-11-03')`);
    } else {
      app.run(`handleSheetSelect('section');`);
      await app.run(`uploadAllSheets('2099-11-03')`);
    }
    assert.equal(app.rows()[0].data.notes, 'Excel note');
    await app.run(`loadOrderForEdit('2099-11-03')`);
    if (page === 'best-sweet-obour-market') app.run(`editingData[0].notes = 'Edited note'`);
    else app.run(`updateNotes(0, 'Edited note')`);
    await app.run(`saveChanges()`);
    assert.equal(app.rows().length, 1);
    assert.equal(app.rows()[0].data.notes, 'Edited note');
    assert.equal(app.rows()[0].data.qty, 3);
  });
}