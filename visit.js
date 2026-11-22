// Counts one website visit for Early Bird's own admin Traffic screen (backend 0206, api.visit).
// What is sent: the browser's random Early Bird id (the same `eb.web.device` the web booking uses), "web", a coarse
// platform (ios / android / desktop), the referring site's address (the server keeps the host only, e.g.
// l.instagram.com) and which part of the site (/, /book, /restaurants, /v). No cookies, no IP kept, no third parties.
// One count per browser per 30 minutes; a page reached from our own pages (or a /go/ link redirect) isn't counted again.
(function () {
  try {
    if (!/(^|\.)eatearlybird\.com$/.test(location.hostname)) return;            // live site only, not local tests
    var ref = document.referrer || "";
    var own = /^https?:\/\/([^\/]*\.)?eatearlybird\.com(\/|$)/i.test(ref);
    var last = Number(sessionStorage.getItem("eb.web.visit") || 0);
    if (own || Date.now() - last < 30 * 60 * 1000) return;
    var id = localStorage.getItem("eb.web.device");
    if (!id) {
      id = (crypto.randomUUID ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx".replace(/x/g, function () {
        return ((Math.random() * 16) | 0).toString(16); })).toLowerCase();
      localStorage.setItem("eb.web.device", id);
    }
    var ua = navigator.userAgent || "";
    var platform = /iPhone|iPad|iPod/.test(ua) ? "ios" : /Android/.test(ua) ? "android" : /Mobi/.test(ua) ? "other" : "desktop";
    var p = location.pathname;
    var path = p === "/" || p === "/index.html" ? "/" : p.indexOf("/book") === 0 ? "/book"
             : p.indexOf("/restaurants") === 0 ? "/restaurants" : p.indexOf("/v/") === 0 ? "/v" : "other";
    var KEY = "sb_publishable_TW9FPHv3ijsOZx4QPTIsdA_hSWFafW4";
    sessionStorage.setItem("eb.web.visit", String(Date.now()));
    fetch("https://xopcdblqmmrvyocqomqz.supabase.co/rest/v1/rpc/visit", {
      method: "POST", keepalive: true,
      headers: { apikey: KEY, Authorization: "Bearer " + KEY, "Content-Type": "application/json", "Content-Profile": "api", "Accept-Profile": "api" },
      body: JSON.stringify({ p_device: id, p_surface: "web", p_platform: platform, p_referrer: ref.slice(0, 300), p_path: path })
    }).catch(function () {});
  } catch (e) { /* private mode or old browser: no count */ }
})();
