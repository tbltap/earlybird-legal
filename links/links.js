// Early Bird link-in-bio pages (/links/<account>/) and their story pages (/stories/<slug>/), built by tools/links/build.py.
// The pages work without this file. It does three things:
//  1. Carries the source tag on: ?src=<account>_bio (or whatever src the visitor came in with) is added to every link on
//     the page, and a story's "Back to editorial" returns to the page named in src.
//  2. Counts a page view and each tap for Early Bird's own admin (api.link_page_event, migration 0288): page, src, which
//     tile, what it opens, the browser's random Early Bird id (eb.web.device, the same one /go/ links and the web booking
//     use), a coarse platform (ios / android / desktop / other) and the referring site's host only. No cookies, no IP
//     kept, no third parties. Only on eatearlybird.com, never on local tests or previews.
//  3. Shows the account's own recent posts from Studio (api.link_page, 0288) when it has any; each goes through the
//     post's /go/ link, so the tap counts for the post too. Otherwise the built-in tiles stay.
(function () {
  var URL_ = "https://xopcdblqmmrvyocqomqz.supabase.co", KEY = "sb_publishable_TW9FPHv3ijsOZx4QPTIsdA_hSWFafW4";
  var PAGES = ["app", "la", "nyc", "business", "dinnerat530"];
  var main = document.querySelector("main[data-page]");
  if (!main) return;
  var page = main.getAttribute("data-page"), story = main.getAttribute("data-story");
  var live = /(^|\.)eatearlybird\.com$/.test(location.hostname) && location.hostname.indexOf("preview.") !== 0;
  var q = {}; try { q = Object.fromEntries(new URLSearchParams(location.search)); } catch (e) { q = {}; }
  var src = String(q.src || (page !== "story" ? page + "_bio" : "")).toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40);
  var from = (src.match(/^([a-z0-9]+)_/) || [])[1];
  var acc = PAGES.indexOf(page) >= 0 ? page : (PAGES.indexOf(from) >= 0 ? from : "app");

  function tag(href) {   // add src to our own links (not to the app link, which isn't ours to tag)
    if (!src || !href || /^(mailto:|tel:|#)/.test(href)) return href;
    try {
      var u = new URL(href, location.href);
      if (u.host !== location.host && !/(^|\.)eatearlybird\.com$/.test(u.host)) return href;
      if (/\/privacy\.html$/.test(u.pathname)) return href;
      u.searchParams.set("src", src);
      return u.host === location.host ? u.pathname + u.search + u.hash : u.href;
    } catch (e) { return href; }
  }
  function retag(root) { Array.prototype.forEach.call((root || document).querySelectorAll("a[href]"), function (a) { a.setAttribute("href", tag(a.getAttribute("href"))); }); }

  // a story's "Back to editorial": the link page the visitor came from
  var back = document.querySelector('[data-tile="back"]');
  if (back) back.setAttribute("href", /\.html$/.test(location.pathname) ? "links-" + acc + ".html" : "/links/" + acc + "/");   // .html: the flat preview
  retag();

  var dev = null;
  try {
    dev = localStorage.getItem("eb.web.device");
    if (!dev && window.crypto && crypto.randomUUID) { dev = crypto.randomUUID().toLowerCase(); localStorage.setItem("eb.web.device", dev); }
  } catch (e) { /* private mode: count without a device id */ }
  var ua = navigator.userAgent || "";
  var platform = /iPhone|iPad|iPod/.test(ua) ? "ios" : /Android/.test(ua) ? "android" : /Mobi/.test(ua) ? "other" : "desktop";
  var ref = ""; try { ref = document.referrer ? new URL(document.referrer).host : ""; } catch (e) { ref = ""; }

  function rpc(fn, body) {
    return fetch(URL_ + "/rest/v1/rpc/" + fn, {
      method: "POST", keepalive: true,
      headers: { apikey: KEY, Authorization: "Bearer " + KEY, "Content-Type": "application/json", "Content-Profile": "api", "Accept-Profile": "api" },
      body: JSON.stringify(body)
    });
  }
  function count(event, tile, target) {
    var body = { p_page: page, p_event: event, p_src: src || null, p_tile: tile || story || null, p_target: target || null,
                 p_device: dev, p_platform: platform, p_referrer: ref || null };
    if (!live) { if (window.console) console.log("[links] would count", body); return; }
    try { rpc("link_page_event", body).catch(function () {}); } catch (e) { /* old browser: no count */ }
  }

  count("view");
  document.addEventListener("click", function (ev) {
    var a = ev.target.closest && ev.target.closest("a[data-tile]");
    if (a) count("tap", a.getAttribute("data-tile"), a.getAttribute("data-kind"));
  }, true);

  // the account's own posts from Studio, when it has any
  var grid = document.getElementById("grid");
  if (grid && live && PAGES.indexOf(page) >= 0) {
    rpc("link_page", { p_page: page }).then(function (r) { return r.ok ? r.json() : null; }).then(function (tiles) {
      if (!tiles || !tiles.length) return;
      var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
      grid.innerHTML = tiles.map(function (t) {
        return '<a class="tile" href="' + esc(t.url) + '" data-tile="post-' + esc(t.code) + '" data-kind="post"><img src="' + esc(t.photo) +
          '" alt="' + esc(t.title) + '" loading="lazy"><span>' + esc(t.title) + "</span></a>";
      }).join("");
      retag(grid);
    }).catch(function () { /* keep the built-in tiles */ });
  }
})();
