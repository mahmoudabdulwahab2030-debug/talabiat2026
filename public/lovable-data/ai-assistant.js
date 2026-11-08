/* مساعد "محمود عبدالوهاب" - زر عائم ونافذة محادثة فوق الصفحة */
(function () {
  var ENDPOINT = "https://us-central1-ledoux-80b46.cloudfunctions.net/aiAssistant";
  var NAME = "محمود عبدالوهاب";

  var css = [
    "#mkAiBtn{position:fixed;bottom:20px;left:20px;z-index:9998;display:flex;align-items:center;gap:8px;padding:12px 16px;border-radius:999px;border:1px solid rgba(255,255,255,.2);background:linear-gradient(135deg,rgba(232,180,74,.9),rgba(201,149,52,.9));color:#111;font:700 14px Cairo,Segoe UI,Tahoma,sans-serif;cursor:pointer;box-shadow:0 10px 30px rgba(0,0,0,.35);backdrop-filter:blur(10px)}",
    "#mkAiBtn:hover{transform:translateY(-2px)}",
    "#mkAiPanel{position:fixed;bottom:86px;left:20px;z-index:9999;width:min(380px,calc(100vw - 40px));height:min(540px,calc(100vh - 120px));display:none;flex-direction:column;border-radius:20px;overflow:hidden;background:rgba(18,22,28,.72);border:1px solid rgba(255,255,255,.16);backdrop-filter:blur(20px) saturate(140%);-webkit-backdrop-filter:blur(20px) saturate(140%);box-shadow:0 20px 60px rgba(0,0,0,.45);color:#f4f6f9;font-family:Cairo,Segoe UI,Tahoma,sans-serif}",
    "#mkAiPanel.open{display:flex;animation:mkIn .25s ease both}",
    "@keyframes mkIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}",
    "#mkAiHead{display:flex;justify-content:space-between;align-items:center;padding:14px 16px;background:rgba(255,255,255,.06);border-bottom:1px solid rgba(255,255,255,.12)}",
    "#mkAiHead b{color:#e8b44a;font-size:15px}#mkAiHead small{display:block;color:#a3acb8;font-size:11px;margin-top:2px}",
    "#mkAiClose{background:transparent;border:none;color:#f4f6f9;font-size:20px;cursor:pointer;padding:4px 8px}",
    "#mkAiMsgs{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px}",
    ".mkMsg{max-width:85%;padding:10px 13px;border-radius:14px;font-size:14px;line-height:1.7;white-space:pre-wrap;word-wrap:break-word}",
    ".mkMsg.user{align-self:flex-start;background:rgba(232,180,74,.22);border:1px solid rgba(232,180,74,.35)}",
    ".mkMsg.bot{align-self:flex-end;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12)}",
    ".mkMsg.err{align-self:flex-end;background:rgba(255,107,107,.15);border:1px solid rgba(255,107,107,.35);color:#ffb3b3}",
    "#mkAiForm{display:flex;gap:8px;padding:12px;border-top:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04)}",
    "#mkAiInput{flex:1;resize:none;height:44px;max-height:110px;padding:10px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.06);color:#f4f6f9;font:14px Cairo,Segoe UI,Tahoma,sans-serif;outline:none}",
    "#mkAiInput:focus{border-color:#e8b44a}",
    "#mkAiSend{padding:0 16px;border-radius:12px;border:none;background:linear-gradient(180deg,#e8b44a,#c99534);color:#111;font:700 14px Cairo,sans-serif;cursor:pointer}",
    "#mkAiSend:disabled{opacity:.5;cursor:not-allowed}",
    ".mkTyping{opacity:.7;font-style:italic}"
  ].join("");

  var style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  var btn = document.createElement("button");
  btn.id = "mkAiBtn";
  btn.type = "button";
  btn.setAttribute("aria-label", "فتح مساعد " + NAME);
  btn.innerHTML = "🤖 <span>" + NAME + "</span>";

  var panel = document.createElement("div");
  panel.id = "mkAiPanel";
  panel.innerHTML =
    '<div id="mkAiHead"><div><b>' + NAME + '</b><small>مساعد ذكي لبيانات المشروع وأي سؤال عام</small></div>' +
    '<button id="mkAiClose" type="button" aria-label="إغلاق">✕</button></div>' +
    '<div id="mkAiMsgs"></div>' +
    '<form id="mkAiForm"><textarea id="mkAiInput" placeholder="اكتب سؤالك هنا..." rows="1"></textarea>' +
    '<button id="mkAiSend" type="submit">إرسال</button></form>';

  document.body.appendChild(btn);
  document.body.appendChild(panel);

  var msgs = panel.querySelector("#mkAiMsgs");
  var input = panel.querySelector("#mkAiInput");
  var sendBtn = panel.querySelector("#mkAiSend");
  var form = panel.querySelector("#mkAiForm");

  function addMsg(text, cls) {
    var d = document.createElement("div");
    d.className = "mkMsg " + cls;
    d.textContent = text; // نص فقط لتجنب حقن HTML
    msgs.appendChild(d);
    msgs.scrollTop = msgs.scrollHeight;
    return d;
  }

  if (!msgs.children.length) {
    addMsg("مرحباً 👋 أنا " + NAME + ". اسألني عن الفروع أو الطلبيات أو المخازن أو المنتجات، أو أي سؤال عام.", "bot");
  }

  btn.onclick = function () {
    panel.classList.toggle("open");
    if (panel.classList.contains("open")) input.focus();
  };
  panel.querySelector("#mkAiClose").onclick = function () { panel.classList.remove("open"); };

  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); }
  });

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    var text = input.value.trim();
    if (!text) return;
    var userCode = localStorage.getItem("userCode") || "";
    if (!userCode) { addMsg("يجب تسجيل الدخول أولاً لاستخدام المساعد.", "err"); return; }

    addMsg(text, "user");
    input.value = "";
    sendBtn.disabled = true;
    var typing = addMsg("جاري التفكير...", "bot mkTyping");

    try {
      var res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, userCode: userCode })
      });
      var data = await res.json().catch(function () { return {}; });
      typing.remove();
      if (!res.ok) addMsg(data.error || "تعذر الحصول على إجابة.", "err");
      else addMsg(data.answer || "لم أتمكن من توليد إجابة.", "bot");
    } catch (err) {
      typing.remove();
      addMsg("تعذر الاتصال بالمساعد. تحقق من الاتصال وحاول مرة أخرى.", "err");
    } finally {
      sendBtn.disabled = false;
      input.focus();
    }
  });
})();
