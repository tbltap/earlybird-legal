// Counts one website visit for Early Bird's own admin Traffic screen (backend 0206, api.visit).
// What is sent: the browser's random Early Bird id (the same `eb.web.device` the web booking uses), "web", a coarse
// platform (ios / android / desktop), the referring site's address (the server keeps the host only, e.g.
// l.instagram.com) and which part of the site (/, /book, /restaurants, /v). No cookies, no IP kept, no third parties.
// One count per browser per 30 minutes; a page reached through a /go/ link isn't counted again (the link tap was).
// The landing page with its query (0316): the server keeps only src, utm_*, l, meal and diners from it. A link tagged
// ?src=… (a story or post) always counts, even within the 30 minutes; the server counts the same tag once per 30 minutes.
(function () {
  try {
    if (!/(^|\.)eatearlybird\.com$/.test(location.hostname)) return;            // live site only, not local tests
    // The home page forwards to /book/ at once and leaves the original referrer here (index.html).
    var kept = sessionStorage.getItem("eb.web.ref");
    if (kept !== null) sessionStorage.removeItem("eb.web.ref");
    var ref = kept !== null ? kept : (document.referrer || "");
    var own = /^https?:\/\/([^\/]*\.)?eatearlybird\.com(\/|$)/i;
    if (own.test(ref) && /^https?:\/\/[^\/]+\/go\//i.test(ref)) return;    // came through one of our /go/ links: counted there
    if (own.test(ref)) ref = "";                                                   // our own pages: no outside referrer
    var landing = sessionStorage.getItem("eb.web.landing");
    if (landing !== null) sessionStorage.removeItem("eb.web.landing");
    landing = (landing || location.pathname + location.search).slice(0, 500);
    var tagged = /[?&](src|utm_[a-z]+)=/i.test(landing);
    var last = Number(sessionStorage.getItem("eb.web.visit") || 0);
    if (!tagged && Date.now() - last < 30 * 60 * 1000) return;
    var id = localStorage.getItem("eb.web.device");
    if (!id) {
      id = (crypto.randomUUID ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx".replace(/x/g, function () {
        return ((Math.random() * 16) | 0).toString(16); })).toLowerCase();
      localStorage.setItem("eb.web.device", id);
    }
    var ua = navigator.userAgent || "";
    var platform = /iPhone|iPad|iPod/.test(ua) ? "ios" : /Android/.test(ua) ? "android" : /Mobi/.test(ua) ? "other" : "desktop";
    var p = landing.split("?")[0];
    var path = p === "/" || p === "/index.html" ? "/" : p.indexOf("/book") === 0 ? "/book"
             : p.indexOf("/restaurants") === 0 ? "/restaurants" : p.indexOf("/v/") === 0 ? "/v" : "other";
    var KEY = "sb_publishable_TW9FPHv3ijsOZx4QPTIsdA_hSWFafW4";
    sessionStorage.setItem("eb.web.visit", String(Date.now()));
    fetch("https://xopcdblqmmrvyocqomqz.supabase.co/rest/v1/rpc/visit", {
      method: "POST", keepalive: true,
      headers: { apikey: KEY, Authorization: "Bearer " + KEY, "Content-Type": "application/json", "Content-Profile": "api", "Accept-Profile": "api" },
      body: JSON.stringify({ p_device: id, p_surface: "web", p_platform: platform, p_referrer: ref.slice(0, 300), p_path: path, p_landing: landing })
    }).catch(function () {});
  } catch (e) { /* private mode or old browser: no count */ }
})();
