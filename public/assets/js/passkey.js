/* الدخول بالبصمة / Face ID (Passkeys) - يظهر على الموبايل فقط، والكمبيوتر يبقى بكلمة المرور */
(function (global) {
  var API = "https://hhsavgucqgzehardjzdc.supabase.co/functions/v1/passkey";
  var isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  var DECLINE_DAYS = 14;

  function b64uToBuf(s) {
    var b = String(s).replace(/-/g, "+").replace(/_/g, "/");
    while (b.length % 4) b += "=";
    var bin = atob(b), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out.buffer;
  }
  function bufToB64u(buf) {
    var bytes = new Uint8Array(buf), bin = "";
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function supportedHere() {
    return !!(window.PublicKeyCredential && navigator.credentials && window.isSecureContext);
  }
  // المعاينة داخل المحرر تُعرض داخل إطار (iframe) وتمنع البصمة في الغالب
  function inFrame() {
    try { return window.self !== window.top; } catch (e) { return true; }
  }
  async function canUse() {
    if (!isMobile || !window.isSecureContext || !window.PublicKeyCredential || !navigator.credentials) return false;
    try { return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(); } catch (e) { return false; }
  }
  async function post(body) {
    var r = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    var d = await r.json().catch(function () { return {}; });
    if (!r.ok) throw new Error(d.error || "تعذر إتمام العملية");
    return d;
  }
  function prep(o) {
    o.challenge = b64uToBuf(o.challenge);
    if (o.user) o.user.id = b64uToBuf(o.user.id);
    (o.excludeCredentials || []).forEach(function (c) { c.id = b64uToBuf(c.id); });
    (o.allowCredentials || []).forEach(function (c) { c.id = b64uToBuf(c.id); });
    return o;
  }
  function serializeAtt(c) {
    return { id: c.id, rawId: bufToB64u(c.rawId), type: c.type,
      clientExtensionResults: c.getClientExtensionResults ? c.getClientExtensionResults() : {},
      response: { clientDataJSON: bufToB64u(c.response.clientDataJSON), attestationObject: bufToB64u(c.response.attestationObject),
        transports: c.response.getTransports ? c.response.getTransports() : [] } };
  }
  function serializeAss(c) {
    return { id: c.id, rawId: bufToB64u(c.rawId), type: c.type,
      clientExtensionResults: c.getClientExtensionResults ? c.getClientExtensionResults() : {},
      response: { clientDataJSON: bufToB64u(c.response.clientDataJSON), authenticatorData: bufToB64u(c.response.authenticatorData),
        signature: bufToB64u(c.response.signature), userHandle: c.response.userHandle ? bufToB64u(c.response.userHandle) : null } };
  }
  function saveSessionAndGo(r) {
    var code = r.userCode, roles = r.roles || [];
    try {
      localStorage.setItem("userCode", code);
      localStorage.setItem("username", r.name || code);
      localStorage.setItem("userUid", r.uid || code);
      localStorage.setItem("userRoles", JSON.stringify(roles));
    } catch (e) {}
    var redirect = new URLSearchParams(location.search).get("redirect");
    var enc = encodeURIComponent(roles.join(","));
    location.href = redirect
      ? redirect + "?user=" + encodeURIComponent(code) + "&roles=" + enc
      : "main.html?user=" + encodeURIComponent(code) + "&roles=" + enc;
  }

  // تفعيل البصمة بعد نجاح الدخول بكلمة المرور (يُرسل كلمة المرور للتحقق من الخادم)
  async function offerEnrollAfterPassword(code, password) {
    try {
      if (!(await canUse())) return;
      var key = "passkeyDeclined_" + code;
      var last = Number(localStorage.getItem(key) || 0);
      if (Date.now() - last < DECLINE_DAYS * 864e5) return;
      if (!await appConfirm("تفعيل الدخول بالبصمة أو Face ID على هذا الجهاز؟\nبعدها تدخل بلمسة واحدة.")) {
        localStorage.setItem(key, String(Date.now()));
        return;
      }
      var o = await post({ action: "reg-options", userCode: code, password: password });
      var cred = await navigator.credentials.create({ publicKey: prep(o.options) });
      await post({ action: "reg-verify", userCode: code, password: password, challengeId: o.challengeId, response: serializeAtt(cred) });
      alert("✅ تم تفعيل الدخول بالبصمة على هذا الجهاز");
    } catch (e) {
      console.warn("passkey enrollment", e);
      if (e && e.name !== "NotAllowedError") alert("تعذر تفعيل البصمة: " + (e.message || ""));
    }
  }

  function showMsg(text, color) {
    var msg = document.getElementById("message");
    if (msg) { msg.textContent = text; msg.style.color = color; }
  }
  async function loginWithPasskey() {
    var msg = document.getElementById("message");
    if (!supportedHere()) { showMsg("⚠️ هذا المتصفح لا يدعم الدخول بالبصمة. استخدم كلمة المرور.", "orange"); return; }
    if (inFrame()) { showMsg("⚠️ الدخول بالبصمة يعمل من الرابط الحي للموقع مباشرة، وليس من داخل المعاينة.", "orange"); return; }
    try {
      if (msg) { msg.textContent = "⏳ جاري التحقق من البصمة..."; msg.style.color = "lightgray"; }
      var o = await post({ action: "login-options" });
      var cred = await navigator.credentials.get({ publicKey: prep(o.options) });
      var r = await post({ action: "login-verify", challengeId: o.challengeId, response: serializeAss(cred) });
      if (msg) { msg.textContent = "✅ تم التحقق، جاري التوجيه..."; msg.style.color = "lightgreen"; }
      saveSessionAndGo(r);
    } catch (e) {
      if (msg) {
        msg.textContent = e && e.name === "NotAllowedError" ? "تم إلغاء التحقق من البصمة" : "❌ " + (e.message || "تعذر الدخول بالبصمة");
        msg.style.color = "orange";
      }
    }
  }

  document.addEventListener("DOMContentLoaded", async function () {
    var btn = document.getElementById("passkeyBtn");
    if (btn && isMobile && supportedHere()) btn.style.display = "";
  });

  global.PasskeyAuth = { canUse: canUse, loginWithPasskey: loginWithPasskey, offerEnrollAfterPassword: offerEnrollAfterPassword };
})(window);
