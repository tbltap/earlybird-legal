// Early Bird booking: smooth pickers for the desktop search pill (meal, date, party, discount). Owner, 22 Nov 2026.
// It reads the pill's own <select>s, shows a panel with the same choices, and on a choice sets the <select> and fires
// "change", so app.js handles everything exactly as before. Phones keep their native pickers.
(function () {
  "use strict";
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var open = null; // { pop, backdrop, label }
  var KIND = { "f-meal": "meal", "f-date": "date", "f-diners": "party", "f-off": "discount" };
  var MEAL_HINT = { breakfast: "Morning tables", lunch: "Midday tables", dinner: "Early evening tables" };

  function esc(t) { return String(t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  function close(instant) {
    if (!open) return;
    var o = open; open = null;
    o.label.classList.remove("pk-on");
    document.documentElement.classList.remove("pk-open");
    if (instant || reduce) { o.pop.remove(); o.backdrop.remove(); return; }
    o.pop.classList.remove("in"); o.backdrop.classList.remove("in");
    setTimeout(function () { o.pop.remove(); o.backdrop.remove(); }, 260);
  }

  function choose(select, value) {
    close();
    if (select.value === value) return;
    select.value = value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function body(kind, select) {
    var opts = Array.prototype.map.call(select.options, function (o) { return { v: o.value, t: o.textContent, on: o.value === select.value }; });
    if (kind === "meal") {
      return '<p class="pk-h">Which meal?</p><div class="pk-meals">' + opts.map(function (o) {
        return '<button type="button" class="pk-opt pk-meal' + (o.on ? " on" : "") + '" data-v="' + esc(o.v) + '"><b>' + esc(o.t) + '</b><span>' + esc(MEAL_HINT[o.v] || "") + "</span></button>";
      }).join("") + "</div>";
    }
    if (kind === "party") {
      return '<p class="pk-h">How many diners?</p><div class="pk-party">' + opts.map(function (o) {
        return '<button type="button" class="pk-opt pk-num' + (o.on ? " on" : "") + '" data-v="' + esc(o.v) + '" aria-label="' + esc(o.t) + '">' + esc(o.v) + "</button>";
      }).join("") + "</div>";
    }
    if (kind === "discount") {
      return '<p class="pk-h">Discount</p><div class="pk-list">' + opts.map(function (o) {
        return '<button type="button" class="pk-opt pk-row' + (o.on ? " on" : "") + '" data-v="' + esc(o.v) + '">' + esc(o.t) + (o.v === "50" ? ' <i class="pk-gold">Most tables</i>' : "") + "</button>";
      }).join("") + "</div>";
    }
    // date: a calendar of the dates the select offers, plus "All dates"
    var dates = opts.filter(function (o) { return /^\d{4}-\d{2}-\d{2}$/.test(o.v); });
    var all = opts.filter(function (o) { return !o.v; })[0];
    var cells = "", lead = 0;
    if (dates.length) {
      var first = new Date(dates[0].v + "T12:00:00Z");
      lead = (first.getUTCDay() + 6) % 7; // Monday first
      for (var i = 0; i < lead; i++) cells += '<span class="pk-blank"></span>';
      dates.forEach(function (o, k) {
        var d = new Date(o.v + "T12:00:00Z");
        var mon = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
        var showMon = k === 0 || d.getUTCDate() === 1;
        cells += '<button type="button" class="pk-opt pk-day' + (o.on ? " on" : "") + (k === 0 ? " today" : "") + '" data-v="' + o.v + '" aria-label="' + esc(o.t) + '">' +
          (showMon ? "<small>" + mon + "</small>" : "<small>&nbsp;</small>") + "<b>" + d.getUTCDate() + "</b>" + (k === 0 ? "<em>Today</em>" : "<em>&nbsp;</em>") + "</button>";
      });
    }
    return '<p class="pk-h">When?</p>' +
      (all ? '<button type="button" class="pk-opt pk-all' + (all.on ? " on" : "") + '" data-v="">All dates <span>show every day</span></button>' : "") +
      '<div class="pk-week"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div>' +
      '<div class="pk-cal">' + cells + "</div>";
  }

  function openFor(label) {
    var select = label.querySelector("select");
    var kind = select && KIND[select.id];
    if (!kind) return false;
    if (open && open.label === label) { close(); return true; }
    close(true);

    var backdrop = document.createElement("div");
    backdrop.className = "pk-backdrop";
    var pop = document.createElement("div");
    pop.className = "pk-pop pk-kind-" + kind;
    pop.setAttribute("role", "dialog");
    pop.setAttribute("aria-label", select.getAttribute("aria-label") || kind);
    pop.innerHTML = body(kind, select);
    document.body.appendChild(backdrop);
    document.body.appendChild(pop);

    // place it under the pill, aligned to the chosen part, kept on screen
    var bar = label.closest(".fbar").getBoundingClientRect(), r = label.getBoundingClientRect();
    var w = pop.offsetWidth, left = Math.max(16, Math.min(r.left + r.width / 2 - w / 2, innerWidth - w - 16));
    pop.style.left = left + "px";
    pop.style.top = bar.bottom + 14 + "px";
    pop.style.setProperty("--ox", (r.left + r.width / 2 - left) + "px");

    label.classList.add("pk-on");
    document.documentElement.classList.add("pk-open");
    open = { pop: pop, backdrop: backdrop, label: label };
    requestAnimationFrame(function () { backdrop.classList.add("in"); pop.classList.add("in"); });

    pop.addEventListener("click", function (e) { var b = e.target.closest(".pk-opt"); if (b) choose(select, b.getAttribute("data-v")); });
    backdrop.addEventListener("click", function () { close(); });
    var firstOn = pop.querySelector(".pk-opt.on") || pop.querySelector(".pk-opt");
    if (firstOn) setTimeout(function () { firstOn.focus({ preventScroll: true }); }, reduce ? 0 : 120);
    return true;
  }

  // Desktop only: the pill sits under body.desk. Click (or Enter/Space) on a part opens its picker instead of the native list.
  document.addEventListener("mousedown", function (e) {
    var label = e.target.closest && e.target.closest("body.desk .fbar label");
    if (!label) return;
    e.preventDefault();
    openFor(label);
  }, true);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && open) { var l = open.label; close(); var s = l.querySelector("select"); if (s) s.focus(); return; }
    var sel = e.target && e.target.closest && e.target.closest("body.desk .fbar select");
    if (sel && (e.key === "Enter" || e.key === " " || e.key === "ArrowDown")) { e.preventDefault(); openFor(sel.closest("label")); }
  }, true);
  addEventListener("resize", function () { close(true); });
  var y0 = 0; addEventListener("scroll", function () { if (!open) { y0 = scrollY; return; } if (Math.abs(scrollY - y0) > 60) close(); }, { passive: true });
  document.addEventListener("mousedown", function () { y0 = scrollY; }, true);
  addEventListener("hashchange", function () { close(true); });
})();
