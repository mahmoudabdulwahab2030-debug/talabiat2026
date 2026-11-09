/* تصغير المحتوى ليتسع لعرض شاشة الموبايل (iPhone وAndroid) دون تشويه أو قص */
(function () {
  var mq = window.matchMedia("(max-width: 900px)");
  var MIN = 0.5;
  var raf = 0;

  function fit() {
    var c = document.querySelector(".container");
    if (!c) return;
    c.style.zoom = "";                       // نقيس الحجم الطبيعي أولاً
    if (!mq.matches) return;
    var avail = document.documentElement.clientWidth - 12;
    var natural = c.scrollWidth;
    if (natural <= avail || avail <= 0) return;
    var s = Math.max(MIN, avail / natural);
    c.style.zoom = s.toFixed(3);
  }
  function schedule() { cancelAnimationFrame(raf); raf = requestAnimationFrame(fit); }

  window.addEventListener("resize", schedule);
  window.addEventListener("orientationchange", function () { setTimeout(schedule, 250); });
  window.addEventListener("load", schedule);
  var target = document.getElementById("resultArea") || document.body;
  new MutationObserver(schedule).observe(target, { childList: true, subtree: true, characterData: true });
  if (document.readyState !== "loading") schedule();
})();
