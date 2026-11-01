/* محمل الثيم: يطبق الألوان المحفوظة فورًا (من الذاكرة المحلية) ثم يحدّثها من قاعدة البيانات */
(function () {
  "use strict";
  var KEY = "lt_theme_v1";
  var PRESETS = {
    crimson: { name: "قرمزي رصاصي (افتراضي)", primary: "#8e1b24", primary2: "#c8323e", accent: "#d9a441", bg: "#121316", bg2: "#1d1f24", surface: "#26282e", text: "#eceef2", glass: 0.55, blur: 14, radius: 14, scale: 1, motion: true },
    wine:    { name: "نبيذي ليلي", primary: "#5e0f1c", primary2: "#a3203a", accent: "#e6b980", bg: "#0e0b0d", bg2: "#1a1418", surface: "#2a2026", text: "#f2eaec", glass: 0.5, blur: 18, radius: 18, scale: 1, motion: true },
    steel:   { name: "رصاصي فولاذي", primary: "#7a1a22", primary2: "#b0303b", accent: "#9fb3c8", bg: "#1a1c20", bg2: "#2a2d33", surface: "#3a3e46", text: "#f0f2f5", glass: 0.6, blur: 10, radius: 10, scale: 1, motion: true },
    ruby:    { name: "ياقوتي زجاجي", primary: "#9b111e", primary2: "#e0115f", accent: "#f5c06a", bg: "#101014", bg2: "#1c1a22", surface: "#2b2730", text: "#f5f0f2", glass: 0.4, blur: 22, radius: 20, scale: 1, motion: true },
    calm:    { name: "هادئ بدون حركة", primary: "#7d1c24", primary2: "#a83440", accent: "#c9a25a", bg: "#16171a", bg2: "#202226", surface: "#2c2e33", text: "#e8eaee", glass: 0.75, blur: 6, radius: 10, scale: 1, motion: false }
  };
  function rgb(hex) { hex = String(hex || "").replace("#", ""); if (hex.length === 3) hex = hex.replace(/./g, "$&$&"); var n = parseInt(hex, 16) || 0; return [(n >> 16) & 255, (n >> 8) & 255, n & 255].join(", "); }
  function apply(t) {
    t = Object.assign({}, PRESETS.crimson, t || {});
    var s = document.documentElement.style;
    s.setProperty("--t-primary", t.primary); s.setProperty("--t-primary-2", t.primary2); s.setProperty("--t-accent", t.accent);
    s.setProperty("--t-bg", t.bg); s.setProperty("--t-bg-2", t.bg2); s.setProperty("--t-surface", rgb(t.surface));
    s.setProperty("--t-text", t.text); s.setProperty("--t-glass", t.glass); s.setProperty("--t-blur", t.blur + "px");
    s.setProperty("--t-radius", t.radius + "px"); s.setProperty("--t-scale", t.scale);
    document.documentElement.classList.toggle("t-nomotion", !t.motion);
    return t;
  }
  function cached() { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { return null; } }
  function save(t) { try { localStorage.setItem(KEY, JSON.stringify(t)); } catch (e) {} }
  apply(cached());

  function fx() {
    if (!document.body || document.querySelector(".t-fx")) return;
    var d = document.createElement("div"); d.className = "t-fx"; d.setAttribute("aria-hidden", "true");
    d.innerHTML = "<i></i><i></i><i></i><b></b>"; document.body.prepend(d);
    var bar = document.createElement("div"); bar.className = "t-topbar"; document.body.appendChild(bar);
    setTimeout(function () { bar.style.transition = "opacity .6s"; bar.style.opacity = "0"; }, 1400);
  }
  async function remote() {
    if (!window.db || !db.collection) return;
    try {
      var doc = await db.collection("settings").doc("theme").get();
      if (doc && doc.exists) { var t = doc.data() && doc.data().theme; if (t) { save(t); apply(t); } }
    } catch (e) {}
  }
  document.addEventListener("DOMContentLoaded", function () { fx(); setTimeout(remote, 300); });

  window.LTheme = {
    PRESETS: PRESETS, apply: apply, current: function () { return Object.assign({}, PRESETS.crimson, cached() || {}); },
    save: async function (t) { save(t); apply(t); if (window.db) await db.collection("settings").doc("theme").set({ theme: t }, { merge: true }); },
    reset: async function () { return this.save(Object.assign({}, PRESETS.crimson)); }
  };
})();
