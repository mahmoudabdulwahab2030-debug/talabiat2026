/* نوافذ إشعارات المشروع (بدل نوافذ المتصفح) - مستقلة تماماً، لا تعتمد على أي مكتبة خارجية */
(function (g) {
  var CSS = "#appDlgOv{position:fixed;inset:0;z-index:2147483647;background:rgba(4,6,9,.55);" +
    "backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:center;" +
    "padding:16px;font-family:Cairo,'Segoe UI',Tahoma,sans-serif;direction:rtl;opacity:0;transition:opacity .25s ease}" +
    "#appDlgOv.on{opacity:1}" +
    "#appDlgBox{width:min(400px,94vw);border-radius:24px;padding:22px 20px 18px;background:rgba(20,24,30,.95);color:#f4f6f9;" +
    "border:1px solid rgba(255,255,255,.14);box-shadow:0 30px 80px rgba(0,0,0,.6);transform:translateY(14px) scale(.96);" +
    "transition:transform .35s cubic-bezier(.34,1.4,.64,1)}" +
    "#appDlgOv.on #appDlgBox{transform:none}" +
    "#appDlgIco{font-size:34px;text-align:center;margin-bottom:6px}" +
    "#appDlgTitle{font-size:18px;font-weight:800;color:#e8b44a;text-align:center;margin:0 0 8px}" +
    "#appDlgMsg{font-size:14px;line-height:1.7;text-align:center;white-space:pre-wrap;word-break:break-word;color:#e6e9ee;margin:0 0 12px}" +
    "#appDlgIn{width:100%;padding:12px 14px;border-radius:14px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.06);" +
    "color:#f4f6f9;font-family:inherit;font-size:14px;outline:none;margin-bottom:12px;box-sizing:border-box}" +
    "#appDlgIn:focus{border-color:#e8b44a;box-shadow:0 0 0 4px rgba(232,180,74,.22)}" +
    ".appDlgBtns{display:flex;gap:10px;justify-content:center}" +
    ".appDlgBtns button{flex:1;padding:12px 14px;border-radius:14px;font-family:inherit;font-size:14px;font-weight:700;cursor:pointer;" +
    "border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.08);color:#f4f6f9}" +
    ".appDlgBtns .pri{background:linear-gradient(180deg,#f0c25e,#c99534);color:#14110a;border-color:transparent}" +
    ".appDlgBtns .bad{background:rgba(255,107,107,.2);color:#ffc4c4;border-color:rgba(255,107,107,.45)}";

  function injectCss() {
    if (document.getElementById("appDlgCss")) return;
    var st = document.createElement("style"); st.id = "appDlgCss"; st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }
  function iconFor(type, msg) {
    if (type === "confirm") return "❓";
    if (type === "prompt") return "✏️";
    msg = String(msg || "");
    if (/❌|خطأ|فشل|تعذر|غير صحيح|غير موجود/.test(msg)) return "❌";
    if (/✅|تم\s/.test(msg)) return "✅";
    if (/⚠️|تنبيه|يجب|الرجاء|اختر|لا يمكن|لا توجد|غير/.test(msg)) return "⚠️";
    return "ℹ️";
  }
  function strip(msg) { return String(msg == null ? "" : msg).replace(/^(❌|✅|⚠️|ℹ️|❓|✏️)\s*/, ""); }

  // النافذة الأساسية: تُعيد Promise بالنتيجة {ok, value}
  function show(o) {
    injectCss();
    var old = document.getElementById("appDlgOv"); if (old) old.remove();
    return new Promise(function (resolve) {
      var ov = document.createElement("div"); ov.id = "appDlgOv"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true");
      var box = document.createElement("div"); box.id = "appDlgBox";
      var ico = document.createElement("div"); ico.id = "appDlgIco"; ico.textContent = iconFor(o.type, o.msg);
      var title = document.createElement("h3"); title.id = "appDlgTitle"; title.textContent = o.title || "تنبيه";
      var msg = document.createElement("div"); msg.id = "appDlgMsg"; msg.textContent = strip(o.msg);
      box.appendChild(ico); box.appendChild(title); box.appendChild(msg);

      var input = null;
      if (o.type === "prompt") {
        input = document.createElement("input"); input.id = "appDlgIn"; input.type = "text";
        input.value = o.def == null ? "" : String(o.def);
        box.appendChild(input);
      }

      var row = document.createElement("div"); row.className = "appDlgBtns";
      var finish = function (ok) {
        document.removeEventListener("keydown", onKey, true);
        ov.classList.remove("on");
        setTimeout(function () { ov.remove(); }, 250);
        resolve({ ok: ok, value: input ? input.value : null });
      };
      var okBtn = document.createElement("button"); okBtn.type = "button";
      okBtn.className = o.danger ? "bad" : "pri";
      okBtn.textContent = o.okText || "حسناً";
      okBtn.onclick = function () { finish(true); };
      if (o.type !== "alert") {
        var cancel = document.createElement("button"); cancel.type = "button";
        cancel.textContent = o.cancelText || "إلغاء";
        cancel.onclick = function () { finish(false); };
        row.appendChild(cancel);
      }
      row.appendChild(okBtn);
      box.appendChild(row);
      ov.appendChild(box);

      function onKey(e) {
        if (e.key === "Escape" && o.type !== "alert") { e.preventDefault(); finish(false); }
        else if (e.key === "Enter" && e.target.tagName !== "TEXTAREA") { e.preventDefault(); finish(true); }
      }
      document.addEventListener("keydown", onKey, true);
      if (o.type !== "alert") ov.addEventListener("click", function (e) { if (e.target === ov) finish(false); });

      (document.body || document.documentElement).appendChild(ov);
      requestAnimationFrame(function () {
        ov.classList.add("on");
        setTimeout(function () { (input || okBtn).focus(); }, 60);
      });
    });
  }

  var DANGER = /حذف|نهائي|مسح|إلغاء الطلب|reset/i;

  g.appAlert = function (msg, opts) {
    opts = opts || {};
    return show({ type: "alert", msg: msg, title: opts.title || (iconFor("alert", msg) === "❌" ? "خطأ" : "تنبيه"), okText: opts.okText });
  };
  g.alert = function (msg) { g.appAlert(msg); };

  // تأكيد: await appConfirm(...) تُعيد true/false
  g.appConfirm = function (msg, opts) {
    opts = opts || {};
    return show({ type: "confirm", msg: msg, title: opts.title || "تأكيد", okText: opts.okText || "نعم", cancelText: opts.cancelText,
      danger: opts.danger != null ? !!opts.danger : DANGER.test(String(msg)) }).then(function (r) { return !!r.ok; });
  };

  // إدخال نص: await appPrompt(...) تُعيد النص أو null عند الإلغاء
  g.appPrompt = function (msg, def, opts) {
    opts = opts || {};
    return show({ type: "prompt", msg: msg, def: def, title: opts.title || "إدخال", okText: opts.okText || "حفظ", cancelText: opts.cancelText })
      .then(function (r) { return r.ok ? r.value : null; });
  };
})(window);
