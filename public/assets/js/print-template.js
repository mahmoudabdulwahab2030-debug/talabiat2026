/* قالب ورقة الطباعة لتجميع الطلبيات: يبني الترويسة والملخص وخانات التوقيع قبل الطباعة فقط
   ولا يغيّر أي بيانات أو وظائف في الصفحة، ويعيد كل شيء كما كان بعد الطباعة */
(function () {
  var added = [];

  function num(t) { var v = parseFloat(String(t || "").replace(/[^\d.\-]/g, "")); return isNaN(v) ? 0 : v; }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

  function build() {
    var ps = document.getElementById("printSection");
    if (!ps || ps.getAttribute("data-pr") === "1") return;
    var table = ps.querySelector("table");
    if (!table) return;

    var h3 = ps.querySelector("h3");
    var headers = Array.prototype.slice.call(table.querySelectorAll("thead th"));
    var rows = Array.prototype.slice.call(table.querySelectorAll("tbody tr"));
    var totalIdx = headers.findIndex(function (th) { return th.classList.contains("col-total"); });
    var branchCols = headers.filter(function (th) {
      return !th.classList.contains("col-code") && !th.classList.contains("col-name") && !th.classList.contains("col-total");
    }).length;

    var grand = 0;
    rows.forEach(function (tr) { if (totalIdx > -1 && tr.cells[totalIdx]) grand += num(tr.cells[totalIdx].textContent); });

    // حذف صف إجمالي موجود داخل الجدول حتى لا يتكرر مع الملخص
    rows.forEach(function (tr) {
      var first = tr.cells[0] ? tr.cells[0].textContent.trim() : "";
      if (/الإجمالي|اجمالي|مجموع/.test(first) || /الإجمالي|اجمالي|مجموع/.test(tr.textContent.slice(0, 40))) {
        tr.setAttribute("data-pr-hide", "1");
      }
    });
    var dataRows = rows.filter(function (tr) { return tr.getAttribute("data-pr-hide") !== "1"; });
    dataRows.forEach(function (tr) { if (totalIdx > -1 && tr.cells[totalIdx]) grand = grand; });
    rows.forEach(function (tr) { if (tr.getAttribute("data-pr-hide") === "1") tr.style.display = "none"; });

    var title = h3 ? h3.textContent.replace(/\s+/g, " ").trim() : "تقرير تجميع الطلبيات";
    var head = el("header", "pr-head",
      '<div class="pr-brand"><b>بيست سويت</b><span>Best Sweet</span></div>' +
      '<div class="pr-title"></div>');
    head.querySelector(".pr-title").textContent = title;
    ps.insertBefore(head, ps.firstChild);
    added.push(head);
    if (h3) { h3.setAttribute("data-pr-hide", "1"); h3.style.display = "none"; }

    ps.setAttribute("data-pr", "1");
  }

  function restore() {
    var ps = document.getElementById("printSection");
    added.forEach(function (n) { if (n && n.parentNode) n.parentNode.removeChild(n); });
    added = [];
    if (ps) {
      ps.removeAttribute("data-pr");
      Array.prototype.slice.call(ps.querySelectorAll("[data-pr-hide]")).forEach(function (n) {
        n.removeAttribute("data-pr-hide");
        n.style.display = "";
      });
    }
  }

  window.addEventListener("beforeprint", function () { try { build(); } catch (e) { console.warn("print template", e); } });
  window.addEventListener("afterprint", restore);
})();
