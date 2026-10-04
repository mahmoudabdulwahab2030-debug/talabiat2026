/*
 * طبقة بيانات Lovable — بديل متوافق مع Firebase Firestore (compat API)
 * ------------------------------------------------------------------
 * الهدف: تشغيل صفحات المشروع الحالية كما هي، مع تغيير مصدر البيانات
 * من Firestore إلى قاعدة بيانات Lovable، بدون تعديل منطق الصفحات.
 *
 * الاستخدام في أي صفحة: استبدل سكربتات Firebase بهذين السطرين:
 *   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
 *   <script src="/lovable-data/firestore-compat.js"></script>
 *
 * المدعوم: collection/doc/add/set/update/delete/get/where/orderBy/limit/
 *           startAfter/onSnapshot/batch/runTransaction/FieldValue/Timestamp
 */
(function () {
  "use strict";

  var SUPABASE_URL = "https://hhsavgucqgzehardjzdc.supabase.co";
  var SUPABASE_KEY = "sb_publishable_wPW5HF0EXuODlOSv_vy9kA_PSG-yozM";

  if (!window.supabase || !window.supabase.createClient) {
    console.error(
      "[lovable-data] مكتبة قاعدة البيانات غير محمّلة. أضف سكربت supabase-js قبل هذا الملف."
    );
    return;
  }

  var sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
  window.lovableDb = sb;

  /* ---------------- خريطة أسماء المجموعات إلى أسماء الجداول ---------------- */
  var TABLE_MAP = {
    orders: "orders",
    orders_best_sweet: "orders_best_sweet",
    "send-orders": "send_orders",
    send_orders: "send_orders",
    drafts: "drafts",
    catalog: "catalog",
    products: "products",
    materials: "materials",
    sections: "sections",
    suppliers: "suppliers",
    warehouses: "warehouses",
    transfers: "transfers",
    inbound: "inbound",
    outbound: "outbound",
    movements: "stock_movements",
    purchase_requests: "purchase_requests",
    purchaseRequests: "purchase_requests",
    "purchase-requests": "purchase_requests",
    requisitions: "requisitions",
    requisition_requests: "requisitions",
    inventory_audit: "inventory_audit",
    "inventory-audit": "inventory_audit",
    "moled-items": "moled_items",
    moled_items: "moled_items",
    "moled-invoices": "moled_invoices",
    moled_invoices: "moled_invoices",
    users: "app_users",
    app_users: "app_users",
    invoices: "invoices",
    reservations: "reservations",
    chat_messages: "chat_messages",
    chatusers: "chat_users",
    chat_users: "chat_users",
    settings: "settings",
    counters: "counters",
    urgentNews: "urgent_news",
    urgent_news: "urgent_news",
    sug: "suggestions",
    suggestions: "suggestions",
    activity_logs: "activity_logs",
    activityLogs: "activity_logs",
    reports: "reports",
    branches: "branches",
  };

  function tableFor(name) {
    if (!name) throw new Error("[lovable-data] اسم المجموعة مطلوب");
    var clean = String(name).trim();
    if (clean.indexOf("stock_") === 0) clean = clean.slice(6);
    if (TABLE_MAP[clean]) return TABLE_MAP[clean];
    var fallback = clean.replace(/[-\s]+/g, "_").toLowerCase();
    if (TABLE_MAP[fallback]) return TABLE_MAP[fallback];
    console.warn("[lovable-data] مجموعة غير معروفة: " + name + " -> " + fallback);
    return fallback;
  }

  /* ---------------- قيم خاصة (serverTimestamp / increment ...) ---------------- */
  var SENTINEL = "__lovable_sentinel__";
  function sentinel(type, value) {
    var o = {};
    o[SENTINEL] = type;
    o.value = value;
    return o;
  }
  function isSentinel(v) {
    return v && typeof v === "object" && Object.prototype.hasOwnProperty.call(v, SENTINEL);
  }

  function resolveSentinels(data, existing) {
    var out = {};
    existing = existing || {};
    Object.keys(data || {}).forEach(function (key) {
      var v = data[key];
      if (isSentinel(v)) {
        var kind = v[SENTINEL];
        if (kind === "serverTimestamp") {
          out[key] = new Date().toISOString();
        } else if (kind === "increment") {
          out[key] = (Number(existing[key]) || 0) + Number(v.value || 0);
        } else if (kind === "arrayUnion") {
          var cur = Array.isArray(existing[key]) ? existing[key].slice() : [];
          v.value.forEach(function (item) {
            if (cur.indexOf(item) === -1) cur.push(item);
          });
          out[key] = cur;
        } else if (kind === "arrayRemove") {
          var arr = Array.isArray(existing[key]) ? existing[key].slice() : [];
          out[key] = arr.filter(function (item) {
            return v.value.indexOf(item) === -1;
          });
        } else if (kind === "delete") {
          out[key] = undefined;
        }
      } else if (v && typeof v === "object" && v instanceof Date) {
        out[key] = v.toISOString();
      } else {
        out[key] = v;
      }
    });
    return out;
  }

  function mergeData(existing, patch) {
    var merged = Object.assign({}, existing || {});
    Object.keys(patch).forEach(function (key) {
      if (patch[key] === undefined) delete merged[key];
      else merged[key] = patch[key];
    });
    return merged;
  }

  // دعم المسارات المتداخلة مثل update({'a.b': 1})
  function applyDotted(target, patch) {
    var out = Object.assign({}, target || {});
    Object.keys(patch).forEach(function (key) {
      if (key.indexOf(".") === -1) {
        if (patch[key] === undefined) delete out[key];
        else out[key] = patch[key];
        return;
      }
      var parts = key.split(".");
      var node = out;
      for (var i = 0; i < parts.length - 1; i++) {
        node[parts[i]] = Object.assign({}, node[parts[i]] || {});
        node = node[parts[i]];
      }
      if (patch[key] === undefined) delete node[parts[parts.length - 1]];
      else node[parts[parts.length - 1]] = patch[key];
    });
    return out;
  }

  function newId() {
    var s = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    var out = "";
    for (var i = 0; i < 20; i++) out += s.charAt(Math.floor(Math.random() * s.length));
    return out;
  }

  /* ---------------- Snapshots ---------------- */
  function makeDocSnapshot(table, id, row) {
    var payload = row ? Object.assign({}, row.data || {}) : null;
    if (payload && row.created_at && payload.createdAt === undefined) {
      payload.createdAt = row.created_at;
    }
    return {
      id: id,
      exists: !!row,
      ref: docRef(table, id),
      data: function () {
        return payload ? Object.assign({}, payload) : undefined;
      },
      get: function (field) {
        if (!payload) return undefined;
        return String(field)
          .split(".")
          .reduce(function (acc, k) {
            return acc == null ? undefined : acc[k];
          }, payload);
      },
    };
  }

  function makeQuerySnapshot(table, rows) {
    var docs = rows.map(function (row) {
      return makeDocSnapshot(table, row.id, row);
    });
    return {
      docs: docs,
      size: docs.length,
      empty: docs.length === 0,
      forEach: function (cb) {
        docs.forEach(cb);
      },
      docChanges: function () {
        return docs.map(function (d) {
          return { type: "added", doc: d };
        });
      },
    };
  }

  /* ---------------- Document reference ---------------- */
  function docRef(table, id) {
    var ref = {
      id: id,
      path: table + "/" + id,
      _table: table,
      async get() {
        var res = await sb.from(table).select("*").eq("id", id).maybeSingle();
        if (res.error) throw res.error;
        return makeDocSnapshot(table, id, res.data);
      },
      async set(data, options) {
        var merge = !!(options && options.merge);
        var existing = null;
        if (merge || hasSentinels(data)) {
          var cur = await sb.from(table).select("data").eq("id", id).maybeSingle();
          existing = cur.data ? cur.data.data : null;
        }
        var patch = resolveSentinels(data, existing || {});
        var finalData = merge ? applyDotted(existing || {}, patch) : mergeData({}, patch);
        var res = await sb
          .from(table)
          .upsert({ id: id, data: finalData }, { onConflict: "id" });
        if (res.error) throw res.error;
        return ref;
      },
      async update(data) {
        var cur = await sb.from(table).select("data").eq("id", id).maybeSingle();
        if (cur.error) throw cur.error;
        if (!cur.data) throw new Error("[lovable-data] السجل غير موجود: " + table + "/" + id);
        var patch = resolveSentinels(data, cur.data.data || {});
        var finalData = applyDotted(cur.data.data || {}, patch);
        var res = await sb.from(table).update({ data: finalData }).eq("id", id);
        if (res.error) throw res.error;
        return ref;
      },
      async delete() {
        var res = await sb.from(table).delete().eq("id", id);
        if (res.error) throw res.error;
      },
      onSnapshot(onNext, onError) {
        return watch(
          function () {
            return ref.get();
          },
          onNext,
          onError
        );
      },
      collection(sub) {
        // مجموعات فرعية: تُخزَّن كجدول مستقل مع حقل يربطها بالسجل الأب
        var childTable = tableFor(sub);
        var q = query(childTable);
        return q.where("_parentId", "==", id);
      },
    };
    return ref;
  }

  // قيم خاصة تحتاج قراءة السجل الحالي أولًا (زيادة/إضافة لمصفوفة/حذف حقل)
  // serverTimestamp لا يحتاج قراءة، لذلك لا نضيّع طلبًا لكل صف
  var NEEDS_EXISTING = { increment: 1, arrayUnion: 1, arrayRemove: 1, delete: 1 };
  function hasSentinels(data) {
    return Object.keys(data || {}).some(function (k) {
      return isSentinel(data[k]) && NEEDS_EXISTING[data[k][SENTINEL]];
    });
  }

  /* ---------------- Query builder ---------------- */
  function query(table, filters, orders, limitCount, afterValue) {
    filters = filters || [];
    orders = orders || [];

    function clone(extra) {
      return query(
        table,
        extra.filters || filters,
        extra.orders || orders,
        extra.limitCount !== undefined ? extra.limitCount : limitCount,
        extra.afterValue !== undefined ? extra.afterValue : afterValue
      );
    }

    function build() {
      var q = sb.from(table).select("*");
      filters.forEach(function (f) {
        var col = f.field === "id" ? "id" : "data->>" + f.field;
        var jsonCol = "data->" + f.field;
        switch (f.op) {
          case "==":
            if (f.field === "id") q = q.eq("id", f.value);
            else if (typeof f.value === "boolean" || typeof f.value === "number")
              q = q.eq(jsonCol, f.value);
            else q = q.eq(col, f.value);
            break;
          case "!=":
            q = q.neq(col, f.value);
            break;
          case ">":
            q = q.gt(col, f.value);
            break;
          case ">=":
            q = q.gte(col, f.value);
            break;
          case "<":
            q = q.lt(col, f.value);
            break;
          case "<=":
            q = q.lte(col, f.value);
            break;
          case "in":
            q = q.in(f.field === "id" ? "id" : col, f.value);
            break;
          case "array-contains":
            q = q.contains(jsonCol, JSON.stringify([f.value]));
            break;
          case "array-contains-any":
            q = q.overlaps(jsonCol, JSON.stringify(f.value));
            break;
          default:
            console.warn("[lovable-data] عامل مقارنة غير مدعوم: " + f.op);
        }
      });
      orders.forEach(function (o) {
        var col = o.field === "id" ? "id" : "data->>" + o.field;
        q = q.order(col, { ascending: o.dir !== "desc", nullsFirst: false });
      });
      if (!orders.length) q = q.order("created_at", { ascending: false });
      q = q.order("id", { ascending: true }); // ترتيب ثابت لصفحات الجلب
      return q;
    }

    var api = {
      _table: table,
      where: function (field, op, value) {
        return clone({ filters: filters.concat([{ field: field, op: op, value: value }]) });
      },
      orderBy: function (field, dir) {
        return clone({ orders: orders.concat([{ field: field, dir: dir || "asc" }]) });
      },
      limit: function (n) {
        return clone({ limitCount: n });
      },
      startAfter: function (v) {
        return clone({ afterValue: v });
      },
      async get() {
        // قاعدة البيانات تُرجع 1000 صف كحد أقصى لكل طلب، لذلك نجلب على صفحات
        var PAGE = 1000;
        var rows = [];
        var from = 0;
        while (true) {
          var want = limitCount ? Math.min(PAGE, limitCount - rows.length) : PAGE;
          if (want <= 0) break;
          var res = await build().range(from, from + want - 1);
          if (res.error) throw res.error;
          var chunkRows = res.data || [];
          rows = rows.concat(chunkRows);
          if (chunkRows.length < want) break;
          from += chunkRows.length;
        }
        if (afterValue !== undefined && afterValue !== null && orders.length) {
          var key = orders[0].field;
          var pivot =
            afterValue && typeof afterValue.data === "function"
              ? (afterValue.data() || {})[key]
              : afterValue;
          var idx = rows.findIndex(function (r) {
            return (r.data || {})[key] === pivot;
          });
          if (idx > -1) rows = rows.slice(idx + 1);
        }
        return makeQuerySnapshot(table, rows);
      },
      onSnapshot: function (onNext, onError) {
        return watch(
          function () {
            return api.get();
          },
          onNext,
          onError
        );
      },
    };
    return api;
  }

  /* ---------------- متابعة التغييرات (بديل onSnapshot) ---------------- */
  var WATCH_INTERVAL = 5000;
  function watch(fetcher, onNext, onError) {
    var stopped = false;
    var timer = null;
    var lastJson = null;

    function handler(next) {
      if (typeof next === "function") return next;
      if (next && typeof next.next === "function") return next.next.bind(next);
      return function () {};
    }
    var emit = handler(onNext);
    var fail =
      typeof onError === "function"
        ? onError
        : onNext && typeof onNext.error === "function"
          ? onNext.error.bind(onNext)
          : function (e) {
              console.error("[lovable-data] خطأ في المتابعة", e);
            };

    async function tick() {
      if (stopped) return;
      try {
        var snap = await fetcher();
        var json = JSON.stringify(
          snap.docs
            ? snap.docs.map(function (d) {
                return [d.id, d.data()];
              })
            : [snap.id, snap.data()]
        );
        if (json !== lastJson) {
          lastJson = json;
          emit(snap);
        }
      } catch (e) {
        fail(e);
      }
      if (!stopped) timer = setTimeout(tick, WATCH_INTERVAL);
    }
    tick();
    return function unsubscribe() {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }

  /* ---------------- Collection reference ---------------- */
  function collectionRef(name) {
    var table = tableFor(name);
    var base = query(table);
    var ref = Object.assign({}, base, {
      id: name,
      path: table,
      doc: function (id) {
        return docRef(table, id || newId());
      },
      async add(data) {
        var payload = resolveSentinels(data, {});
        var clean = mergeData({}, payload);
        var id = newId();
        var res = await sb.from(table).insert({ id: id, data: clean }).select("id").single();
        if (res.error) throw res.error;
        return docRef(table, res.data.id);
      },
    });
    return ref;
  }

  /* ---------------- Batch & transactions ---------------- */
  // حجم الدفعة الواحدة عند الرفع/الحذف الجماعي
  var BULK_CHUNK = 500;

  function chunk(arr, size) {
    var out = [];
    for (var i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }

  function writeBatch() {
    var ops = [];
    return {
      set: function (ref, data, options) {
        var simple = !(options && options.merge) && !hasSentinels(data);
        if (simple) {
          ops.push({
            kind: "upsert",
            table: ref._table,
            row: { id: ref.id, data: mergeData({}, resolveSentinels(data, {})) },
          });
        } else {
          ops.push({
            kind: "single",
            run: function () {
              return ref.set(data, options);
            },
          });
        }
        return this;
      },
      update: function (ref, data) {
        ops.push({
          kind: "single",
          run: function () {
            return ref.update(data);
          },
        });
        return this;
      },
      delete: function (ref) {
        ops.push({ kind: "delete", table: ref._table, id: ref.id });
        return this;
      },
      commit: async function () {
        // تجميع العمليات المتشابهة المتتالية في طلب واحد لتسريع الرفع
        var i = 0;
        while (i < ops.length) {
          var op = ops[i];
          if (op.kind === "single") {
            await op.run();
            i++;
            continue;
          }
          var group = [op];
          var j = i + 1;
          while (j < ops.length && ops[j].kind === op.kind && ops[j].table === op.table) {
            group.push(ops[j]);
            j++;
          }
          if (op.kind === "upsert") {
            // إزالة التكرار داخل نفس الدفعة (آخر قيمة تفوز)
            var seen = {};
            var rows = [];
            group.forEach(function (o) {
              if (seen[o.row.id] !== undefined) rows[seen[o.row.id]] = o.row;
              else {
                seen[o.row.id] = rows.length;
                rows.push(o.row);
              }
            });
            var parts = chunk(rows, BULK_CHUNK);
            await Promise.all(
              parts.map(async function (part) {
                var res = await sb.from(op.table).upsert(part, { onConflict: "id" });
                if (res.error) throw res.error;
              })
            );
          } else {
            var ids = group.map(function (o) {
              return o.id;
            });
            var idParts = chunk(ids, BULK_CHUNK);
            await Promise.all(
              idParts.map(async function (part) {
                var res = await sb.from(op.table).delete().in("id", part);
                if (res.error) throw res.error;
              })
            );
          }
          i = j;
        }
      },
    };
  }

  /* ---------------- كائن firestore ---------------- */
  function firestoreInstance() {
    return {
      collection: collectionRef,
      doc: function (path) {
        var parts = String(path).split("/");
        return docRef(tableFor(parts[0]), parts[1] || newId());
      },
      batch: writeBatch,
      runTransaction: async function (fn) {
        return fn({
          get: function (ref) {
            return ref.get();
          },
          set: function (ref, data, options) {
            return ref.set(data, options);
          },
          update: function (ref, data) {
            return ref.update(data);
          },
          delete: function (ref) {
            return ref.delete();
          },
        });
      },
      collectionGroup: function (name) {
        return query(tableFor(name));
      },
      enablePersistence: function () {
        return Promise.resolve();
      },
      settings: function () {},
      waitForPendingWrites: function () {
        return Promise.resolve();
      },
    };
  }

  var FieldValue = {
    serverTimestamp: function () {
      return sentinel("serverTimestamp");
    },
    increment: function (n) {
      return sentinel("increment", n);
    },
    arrayUnion: function () {
      return sentinel("arrayUnion", Array.prototype.slice.call(arguments));
    },
    arrayRemove: function () {
      return sentinel("arrayRemove", Array.prototype.slice.call(arguments));
    },
    delete: function () {
      return sentinel("delete");
    },
  };

  function TimestampFromDate(date) {
    return {
      seconds: Math.floor(date.getTime() / 1000),
      nanoseconds: 0,
      toDate: function () {
        return date;
      },
      toMillis: function () {
        return date.getTime();
      },
      toISOString: function () {
        return date.toISOString();
      },
    };
  }

  var Timestamp = {
    now: function () {
      return TimestampFromDate(new Date());
    },
    fromDate: TimestampFromDate,
    fromMillis: function (ms) {
      return TimestampFromDate(new Date(ms));
    },
  };

  var singleton = firestoreInstance();
  function firestore() {
    return singleton;
  }
  firestore.FieldValue = FieldValue;
  firestore.Timestamp = Timestamp;
  firestore.FieldPath = { documentId: function () { return "id"; } };

  /* ---------------- الواجهة المتوافقة مع firebase ---------------- */
  window.firebase = window.firebase || {};
  window.firebase.apps = [];
  window.firebase.initializeApp = function () {
    var app = { name: "[DEFAULT]", firestore: firestore };
    window.firebase.apps = [app];
    return app;
  };
  window.firebase.app = function () {
    return window.firebase.apps[0] || window.firebase.initializeApp();
  };
  window.firebase.firestore = firestore;

  /* ---------------- التوافق مع window.firebaseHelpers ---------------- */
  window.firebaseHelpers = {
    addDocument: function (name, data) {
      return collectionRef(name).add(data);
    },
    updateDocument: function (name, id, data) {
      return docRef(tableFor(name), id).update(data);
    },
    deleteDocument: function (name, id) {
      return docRef(tableFor(name), id).delete();
    },
    getAll: async function (name) {
      var snap = await collectionRef(name).get();
      return snap.docs.map(function (d) {
        return Object.assign({ id: d.id }, d.data());
      });
    },
    onCollection: function (name, cb) {
      return collectionRef(name).onSnapshot(cb);
    },
    collectionRef: collectionRef,
    setPrefix: function () {},
  };

  console.info("[lovable-data] طبقة بيانات Lovable جاهزة");
})();
