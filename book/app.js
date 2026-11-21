// Early Bird web booking. A static single-page app: no build step, no framework, no secrets.
// It calls the same `api.*` database functions and the same `pay` Edge Function as the iPhone app
// (see ~/earlybird/backend/API.md), so prices, fees, holds, cancellation credit and codes are decided by the server.
// Look and wording follow the app (EarlyBird/Theme/Theme.swift, BookingSheet.swift).
// Everything except the sign-in screen needs a signed-in diner: a signed-out visitor only ever sees "Sign in to book".
const CFG = window.EB_CONFIG;
const APP = document.getElementById("app");

/* ───────────────────────────── helpers ───────────────────────────── */
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = (cents) => (Number(cents || 0) / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
const m0 = (cents) => (cents % 100 === 0 ? `$${cents / 100}` : money(cents)); // "$24", "$2.50" like the app
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* private mode */ } },
};
const sstore = {
  get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); } catch { /* ignore */ } },
};
const deviceId = (() => {
  let id = store.get("eb.web.device");
  if (!id) { id = (crypto.randomUUID ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx".replace(/x/g, () => ((Math.random() * 16) | 0).toString(16))).toLowerCase(); store.set("eb.web.device", id); }
  return id;
})();
const CREDIT = CFG.creditName || "Early Bird credit";

const time12 = (t) => { // "17:30" → "5:30PM" (the app's style)
  const [h, m] = String(t).split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")}${h < 12 ? "AM" : "PM"}`;
};
const dateObj = (d) => new Date(d + "T12:00:00Z");
const fmtDate = (d, o) => dateObj(d).toLocaleDateString("en-GB", { timeZone: "UTC", ...o });
const fmtLong = (d) => fmtDate(d, { weekday: "long", day: "numeric", month: "long", year: "numeric" }).replace(/,/g, "");
const todayAt = (tz) => new Intl.DateTimeFormat("en-CA", { timeZone: tz || "America/New_York" }).format(new Date());
const fmtStamp = (iso) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const cuisineText = (v) => (v.cuisines || []).slice(0, 3).join(", ");
const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const val = (id) => (document.getElementById(id)?.value || "").trim();

const ICONS = {
  pin: '<path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  fork: '<path d="M7 3v8M4.5 3v5a2.5 2.5 0 0 0 5 0V3M7 11v10M17 21V3c-2.3 1-3.5 3.6-3.5 7 0 1.6 1.2 2.5 3.5 2.5"/>',
  person: '<circle cx="12" cy="8" r="3.8"/><path d="M4.5 20.5c1-4 4-5.5 7.5-5.5s6.5 1.5 7.5 5.5"/>',
  card: '<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3 10h18M6.5 15h3"/>',
  bird: '<path d="M4 15c3 1 6 .5 8-2 2.200-2.800 1.500-6.500 5-8 .500 2-.300 3.500-1.500 4.500 2.500.300 4.500 1.500 5 3-2-.500-3.500 0-4.500 1.500C14 17.500 9 19 4 15z"/>',
  tag: '<path d="M3.500 12.500V4.500a1 1 0 0 1 1-1h8l8 8-9 9-8-8z"/><circle cx="8" cy="8" r="1.300"/>',
  book: '<path d="M12 6.500C10 5 7 4.500 3.500 5v13c3.500-.5 6.500 0 8.500 1.500 2-1.500 5-2 8.500-1.500V5C17 4.500 14 5 12 6.500zM12 6.500v13"/>',
  home: '<path d="M3.500 11.500L12 4l8.500 7.500M6 10v10h4.500v-6h3v6H18V10"/>',
  cal: '<rect x="3.500" y="5" width="17" height="15.500" rx="2.500"/><path d="M3.500 10h17M8 3v4M16 3v4"/>',
  back: '<path d="M19 12H5M11 5l-7 7 7 7"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M5 12.500l4.500 4.500L19 7.500"/>',
  seal: '<path d="M12 3l2.200 1.700 2.800-.1.900 2.600 2.300 1.600-.9 2.700.9 2.700-2.300 1.600-.9 2.600-2.800-.1L12 21l-2.200-1.700-2.800.1-.9-2.600-2.300-1.600.9-2.700-.9-2.700 2.300-1.600.9-2.600 2.800.1z"/><path d="M8.500 12l2.500 2.500 4.500-5"/>',
  cancel: '<circle cx="12" cy="12" r="8.500"/><path d="M8.500 12.500l2.500 2.500 4.500-5"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.500 9.500a2.500 2.500 0 1 1 3.500 2.300c-.700.400-1 .900-1 1.700M12 17v.1"/>',
  clock: '<circle cx="12" cy="12" r="8.500"/><path d="M12 7.500V12l3 2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.500M12 7.500v.1"/>',
  share: '<path d="M12 15V4M8 8l4-4 4 4M5 12v7h14v-7"/>',
};
const ic = (n, cls = "") => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ""}</svg>`;

const ERR = {
  sold_out: "That table was just taken. Please pick another time.",
  slot_in_past: "That time is too soon to book. Please pick a later one.",
  slot_not_offered: "That time isn't available. Please pick another.",
  too_far_ahead: "That date is too far ahead. Please pick an earlier day.",
  party_too_big: "That's more diners than this time allows.",
  invalid_diners: "Please choose how many are dining.",
  deal_not_found: "This restaurant isn't taking bookings right now.",
  option_not_offered: "That option isn't offered here.",
  hold_expired: "Your table hold ran out. Please choose a time again.",
  payment_in_progress: "A payment has already started for this table.",
  payment_required: "A payment is needed to confirm this booking.",
  credit_changed: `Your ${CREDIT} changed. Please start the booking again.`,
  not_cancellable: "This booking can't be cancelled any more.",
  not_signed_in: "Please sign in to continue.",
  not_found: "We couldn't find that booking.",
  code_busy: "Please try again in a moment.",
  payments_not_configured: "Card payments aren't switched on yet. Please try again later.",
  config_unavailable: "Payments are temporarily unavailable. Please try again.",
};
class ApiError extends Error { constructor(code, message, status) { super(message || code); this.code = code; this.status = status; } }
const friendly = (e) => ERR[e?.code] || (e?.code && !/^http_|^\d+$|^PGRST|^\d{5}$/.test(e.code) && /\s/.test(e.message) ? e.message : null) || "Something went wrong. Please try again.";

/* ───────────────────────────── auth (Supabase Auth, same as the app) ───────────────────────────── */
const SKEY = "eb.web.session";
const Auth = {
  session() {
    try {
      const s = JSON.parse(store.get(SKEY) || "null");
      return s && s.url === CFG.url ? s : null;
    } catch { return null; }
  },
  save(s) { store.set(SKEY, s ? JSON.stringify({ ...s, url: CFG.url }) : null); },
  async token() {
    const s = this.session();
    if (!s) return null;
    if (s.expires_at * 1000 - Date.now() > 60000) return s.access_token;
    try {
      const n = await this.call("token?grant_type=refresh_token", { refresh_token: s.refresh_token });
      this.save(n);
      return n.access_token;
    } catch (e) {
      if (e.status && e.status < 500 && e.status !== 429) this.save(null);
      return e.status ? null : s.access_token; // offline: try the old token
    }
  },
  async call(path, body, { method = "POST", token } = {}) {
    const res = await fetch(`${CFG.url}/auth/v1/${path}`, {
      method, headers: { "Content-Type": "application/json", apikey: CFG.key, ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body),
    }).catch(() => { throw new ApiError("offline", "No connection. Check your internet and try again."); });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(j.error_code || j.error || "auth_failed", authMessage(j, res.status), res.status);
    return j;
  },
  // Phone sign-in: same two calls as the app (Auth.swift): text a code, then check it. The account is made the first time.
  async sendPhoneCode(phone) { await this.call("otp", { phone, create_user: true, channel: "sms" }); },
  async verifyPhoneCode(phone, code) { const j = await this.call("verify", { type: "sms", phone, token: code }); if (!j.access_token) throw new ApiError("otp_expired", "That code is wrong or has expired."); this.save(j); return j; },
  // The signed-in user's own sign-in details (email, phone, a pending new email).
  async user() { const t = await this.token(); if (!t) return null; const res = await fetch(`${CFG.url}/auth/v1/user`, { headers: { apikey: CFG.key, Authorization: `Bearer ${t}` } }); return res.ok ? res.json() : null; },
  // Add the other sign-in method to this account (Supabase Auth "update user"): the account stays the same person.
  async addEmail(email, password) { return this.call("user" + redirectQuery(), { email: email.toLowerCase(), password }, { method: "PUT", token: await this.token() }); },
  async addPhone(phone) { return this.call("user", { phone }, { method: "PUT", token: await this.token() }); },
  async confirmPhoneChange(phone, code) { const j = await this.call("verify", { type: "phone_change", phone, token: code }); if (j.access_token) this.save(j); return j; },
  async signIn(email, password) { const j = await this.call("token?grant_type=password", { email: email.toLowerCase(), password }); this.save(j); return j; },
  async signUp(email, password, first, last) {
    const j = await this.call("signup" + redirectQuery(), { email: email.toLowerCase(), password, data: { first_name: first, last_name: last } });
    if (!j.access_token) throw new ApiError("confirm_email", "Check your email to confirm your account, then sign in.");
    this.save(j);
    return j;
  },
  async reset(email) { await this.call("recover" + redirectQuery(), { email: email.toLowerCase() }); },
  async signOut() {
    const s = this.session();
    this.save(null);
    if (s) fetch(`${CFG.url}/auth/v1/logout`, { method: "POST", headers: { apikey: CFG.key, Authorization: `Bearer ${s.access_token}` } }).catch(() => {});
  },
};
const redirectQuery = () => (CFG.env === "production" ? `?redirect_to=${encodeURIComponent(CFG.siteUrl + "/reset-password.html")}` : "");
function authMessage(j, status) {
  const code = j.error_code || j.error || "";
  const m = String(j.msg || j.error_description || j.message || "").toLowerCase();
  if (code === "invalid_credentials" || m.includes("invalid login")) return "That email and password don't match.";
  if (code === "user_already_exists" || code === "email_exists" || m.includes("already registered")) return "There's already an account with this email. Sign in instead.";
  if (code === "weak_password") return "Choose a longer password (8+ characters).";
  if (code === "same_password") return "Choose a different password.";
  if (code === "otp_expired" || m.includes("expired or is invalid")) return "That code is wrong or has expired.";
  if (code === "phone_provider_disabled" || code === "sms_send_failed" || m.includes("unsupported phone")) return "Couldn't send a text right now. Use email instead.";
  if (code === "phone_exists") return "That number already belongs to another Early Bird account.";
  if (code === "validation_failed" && m.includes("phone")) return "Check your phone number and try again.";
  if (code.startsWith("over_") || status === 429 || m.includes("rate limit") || m.includes("security purposes")) return "Too many tries. Wait a minute and try again.";
  if (code === "validation_failed" || m.includes("valid email")) return "Check your email address and try again.";
  return j.msg || j.error_description || j.message || `Something went wrong (${status}).`;
}

/* ───────────────────────────── API (always with the diner's token) ───────────────────────────── */
async function rpc(fn, params = {}) {
  const token = await Auth.token();
  if (!token) throw new ApiError("not_signed_in", "Please sign in to continue.", 401);
  const res = await fetch(`${CFG.url}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: CFG.key, Authorization: `Bearer ${token}`, "Content-Type": "application/json", "Content-Profile": "api", "Accept-Profile": "api" },
    body: JSON.stringify(params),
  }).catch(() => { throw new ApiError("offline", "No connection. Check your internet and try again."); });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    const code = String(j.message || "").split(":")[0].trim();
    if (res.status === 401 || (res.status === 403 && j.code === "42501")) throw new ApiError("not_signed_in", "Please sign in to continue.", res.status);
    throw new ApiError(code || `http_${res.status}`, j.message, res.status);
  }
  return res.status === 204 ? null : res.json();
}
async function pay(action, body = {}) {
  const token = await Auth.token();
  const res = await fetch(CFG.payUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: CFG.key, Authorization: `Bearer ${token || CFG.key}` },
    body: JSON.stringify({ action, ...body }),
  }).catch(() => { throw new ApiError("offline", "No connection. Check your internet and try again."); });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(j.error || `http_${res.status}`, j.error, res.status);
  return j;
}

/* ───────────────────────────── shared state and chrome ───────────────────────────── */
const S = { config: null, cities: null, city: null };
async function loadConfig() { if (!S.config) S.config = await rpc("config"); return S.config; }
async function loadCities() {
  if (!S.cities) {
    S.cities = await rpc("cities");
    const saved = store.get("eb.web.city");
    S.city = S.cities.find((c) => c.slug === saved) || S.cities.find((c) => c.name === "New York") || S.cities[0];
  }
  return S.cities;
}
async function refreshTestBar() {
  const bar = document.getElementById("testbar");
  try {
    const st = await pay("status");
    if (CFG.env !== "production") {
      bar.innerHTML = "<b>Local test preview.</b> Test data and Stripe test mode: nothing real is booked or charged. Test card 4242 4242 4242 4242, any future date, any CVC.";
      bar.hidden = false;
    } else if (st.mode === "test" || !st.charging) {
      bar.innerHTML = "<b>Test mode.</b> No real charges. Test card 4242 4242 4242 4242, any future date, any CVC.";
      bar.hidden = false;
    } else bar.hidden = true;
  } catch { bar.hidden = CFG.env === "production"; }
}
function drawTabs(path) {
  const el = document.getElementById("tabs");
  const signedIn = !!Auth.session();
  el.hidden = !signedIn || path === "/book"; // the booking screen is a full-screen sheet in the app: no tab bar
  if (!signedIn) return;
  const on = path === "/" || path.startsWith("/r/") || path === "/book" ? "home" : path.startsWith("/booking") ? "bookings" : path === "/account" ? "account" : "";
  const tab = (k, href, icon, label) => `<a href="${href}" class="${on === k ? "on" : ""}" ${on === k ? 'aria-current="page"' : ""}>${ic(icon)}${label}</a>`;
  el.innerHTML = tab("home", "#/", "home", "Home") + tab("bookings", "#/bookings", "cal", "Bookings") + tab("account", "#/account", "person", "Profile");
}
const legalLinks = `<div class="legal"><a href="../terms.html">Terms</a><a href="../privacy.html">Privacy</a><a href="../credit-terms.html">${esc(CREDIT)} terms</a><a href="../support.html">Support</a></div>`;
const topbar = (right = "") => `<div class="wash"><div class="col"><div class="topbar"><a class="brand" href="../"><img src="../img/icon.png" alt="" width="30" height="30">Early Bird</a>${right}</div></div></div>`;
const showPage = (inner, { wash = true, right = "" } = {}) => { APP.innerHTML = (wash ? topbar(right) : "") + `<div class="col">${inner}${legalLinks}</div>`; };
const plainPage = (inner) => showPage(inner, { wash: false });

/* ───────────────────────────── router ───────────────────────────── */
let view = { cleanup: null };
function parseHash() {
  const h = location.hash.replace(/^#/, "") || "/";
  const [path, qs] = h.split("?");
  return { path: path || "/", q: Object.fromEntries(new URLSearchParams(qs || "")) };
}
function go(path, q) {
  const qs = q && Object.keys(q).length ? "?" + new URLSearchParams(q).toString() : "";
  location.hash = "#" + path + qs;
}
const navigate = (hash) => { if (location.hash === hash) route(); else location.hash = hash; };
const setTitle = (t) => { document.title = t ? `${t} | Early Bird` : "Book an early table | Early Bird"; };
async function route() {
  if (view.cleanup) { try { await view.cleanup(); } catch { /* ignore */ } view = { cleanup: null }; }
  const { path, q } = parseHash();
  window.scrollTo(0, 0);
  drawTabs(path);
  APP.innerHTML = '<div class="col"><p class="loading">Loading…</p></div>';
  try {
    // Signed-out visitors get the sign-in screen for every address (a link to a restaurant or booking is kept and opened after sign-in).
    if (!Auth.session()) {
      const sq = new URLSearchParams(location.search);
      const next = sq.get("pay") ? "" : path === "/signin" ? q.next || "#/" : location.hash || "#/";
      return await viewSignIn({ ...q, next, mode: q.mode });
    }
    const sq = new URLSearchParams(location.search);
    if (sq.get("pay")) return await viewReturn(Object.fromEntries(sq)); // Stripe's redirect back (?pay=<booking id>)
    if (path === "/") return await viewHome(q);
    if (path.startsWith("/r/")) return await viewVenue(decodeURIComponent(path.slice(3)), q);
    if (path === "/book") return await viewCheckout(q);
    if (path === "/signin") return await viewSignIn(q);
    if (path === "/bookings") return await viewBookings();
    if (path.startsWith("/booking/")) return await viewBooking(path.slice(9), q);
    if (path === "/account") return await viewAccount();
    showPage(`<div class="gate"><h1 class="display">Page not found</h1><p><a class="btn" href="#/">Home</a></p></div>`);
  } catch (e) {
    if (e.code === "not_signed_in") { Auth.save(null); return route(); }
    showPage(`<div class="msg err">${esc(friendly(e))}</div><a class="btn" href="#/">Back to Home</a>`);
    console.error(e);
  }
}
function confirmDialog({ title, body, ok = "OK", cancel = "Cancel" }) {
  const d = document.getElementById("dlg");
  return new Promise((resolve) => {
    d.innerHTML = `<h2>${esc(title)}</h2><div>${body}</div><div class="actions"><button class="btn grey" value="no">${esc(cancel)}</button><button class="btn" value="yes">${esc(ok)}</button></div>`;
    d.querySelectorAll("button").forEach((b) => (b.onclick = () => { d.close(); resolve(b.value === "yes"); }));
    d.oncancel = () => resolve(false);
    d.showModal();
  });
}

/* ───────────────────────────── availability columns (results and restaurant page) ───────────────────────────── */
async function loadAvail(ids, meal, diners) {
  const out = {};
  const rows = await rpc("availability", { p_venues: ids, p_meal: meal, p_days: 8, p_diners: diners });
  rows.forEach((r) => (out[r.venue_id] = r));
  return out;
}
const dayLabel = (d, tz) => `${d === todayAt(tz) ? "Today" : fmtDate(d, { weekday: "short" })}<b>${fmtDate(d, { day: "numeric", month: "short" })}</b>`;
function checkoutHref(v, deal, date, time, meal, diners) {
  return `#/book?${new URLSearchParams({ v: v.slug, deal, date, time, meal, diners }).toString()}`;
}

/* ───────────────────────────── Home: search, quick search, results ───────────────────────────── */
const H = { q: "", cuisine: "", meal: "dinner", diners: 2, rows: [], offset: 0, more: false };
async function viewHome(q) {
  setTitle("");
  await Promise.all([loadCities(), loadConfig()]);
  if (q.city) { const c = S.cities.find((x) => x.slug === q.city); if (c) { S.city = c; store.set("eb.web.city", c.slug); } }
  H.q = q.q || ""; H.cuisine = q.c || "";
  H.meal = ["breakfast", "lunch", "dinner"].includes(q.meal) ? q.meal : H.meal;
  H.diners = Math.min(Math.max(Number(q.diners) || H.diners, 1), S.config.max_party || 12);
  const params = () => ({ city: S.city.slug, meal: H.meal, diners: H.diners, ...(H.q ? { q: H.q } : {}), ...(H.cuisine ? { c: H.cuisine } : {}) });
  const maxD = Math.min(S.config.max_party || 12, 12);
  showPage(`
    <h1 class="display" style="margin:14px 0 0">Ready to get <span class="gold">50% off</span> your food bill?</h1>
    <form id="findform" role="search">
      <div class="searchbar">
        <label>${ic("fork")}<select id="f-meal" aria-label="Meal">${["breakfast", "lunch", "dinner"].map((m) => `<option value="${m}" ${m === H.meal ? "selected" : ""}>${m[0].toUpperCase() + m.slice(1)}</option>`).join("")}</select>
          <span class="sep">•</span><select id="f-diners" aria-label="Diners">${Array.from({ length: maxD }, (_, i) => i + 1).map((n) => `<option value="${n}" ${n === H.diners ? "selected" : ""}>${n} ${n === 1 ? "diner" : "diners"}</option>`).join("")}</select></label>
        <button type="submit" aria-label="Search">${ic("arrow")}</button>
      </div>
      <div class="textsearch">${ic("search")}<input id="f-q" type="search" placeholder="Search restaurants or cuisines" aria-label="Search" value="${esc(H.q)}" autocomplete="off"></div>
    </form>
    <div class="chiprow" id="chips" role="group" aria-label="Cuisine" style="margin:4px 0 16px"></div>
    <div class="card help"><div>${ic("help")}</div><div><div class="title">How do I get 50% off?</div><div class="muted">See how Early Bird works</div><a class="learn" href="../#how">Learn more</a></div></div>
    <div class="sec"><h2 id="reshead">${H.cuisine ? esc(H.cuisine) + " in " : "Most popular in "}${esc(S.city.name)}</h2></div>
    <div id="grid"></div>
    <div style="margin-top:8px"><button class="btn pale" id="more" hidden>Show more</button></div>`,
  { right: `<label class="pinsel">${ic("pin")}<select id="f-city" aria-label="City">${S.cities.map((c) => `<option value="${esc(c.slug)}" ${c.slug === S.city.slug ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></label>` });
  document.getElementById("findform").onsubmit = (e) => { e.preventDefault(); H.q = val("f-q"); go("/", { ...params(), meal: val("f-meal"), diners: val("f-diners"), ...(val("f-q") ? { q: val("f-q") } : { q: "" }) }); };
  document.getElementById("f-city").onchange = (e) => go("/", { ...params(), city: e.target.value });
  document.getElementById("f-meal").onchange = (e) => go("/", { ...params(), meal: e.target.value });
  document.getElementById("f-diners").onchange = (e) => go("/", { ...params(), diners: e.target.value });
  document.getElementById("more").onclick = () => loadResults(true);
  rpc("cuisines", { p_lat: S.city.lat, p_lng: S.city.lng, p_radius_km: S.city.radius_km || 25 }).then((cs) => {
    const el = document.getElementById("chips");
    if (!el) return;
    el.innerHTML = cs.slice(0, 12).map((c) => `<button class="pill" type="button" aria-pressed="${c.name === H.cuisine}" data-c="${esc(c.name)}">${esc(c.name)}</button>`).join("");
    el.onclick = (e) => {
      const b = e.target.closest("[data-c]"); if (!b) return;
      const p = params(); if (b.dataset.c === H.cuisine) delete p.c; else p.c = b.dataset.c;
      go("/", p);
    };
  }).catch(() => {});
  await loadResults(false);
}
async function loadResults(append) {
  const grid = document.getElementById("grid");
  if (!append) { H.rows = []; H.offset = 0; grid.innerHTML = '<p class="loading">Finding tables…</p>'; }
  const rows = await rpc("search_venues", {
    p_query: H.q || null, p_lat: S.city.lat, p_lng: S.city.lng, p_radius_km: S.city.radius_km || 25,
    p_cuisines: H.cuisine ? [H.cuisine] : null, p_limit: 24, p_offset: H.offset, p_sort: "featured",
  });
  const avail = rows.length ? await loadAvail(rows.map((r) => r.id), H.meal, H.diners).catch(() => ({})) : {};
  if (!document.getElementById("grid")) return;
  rows.forEach((r) => (r._avail = avail[r.id]));
  H.rows = H.rows.concat(rows);
  H.offset += rows.length;
  H.more = rows.length === 24;
  grid.innerHTML = H.rows.length ? H.rows.map(resultHtml).join("") : `<div class="card center muted">No restaurants found${H.q ? ` for “${esc(H.q)}”` : ""}. Try another search or city.</div>`;
  document.getElementById("more").hidden = !H.more;
}
function thumbHtml(v) {
  const img = v.photo || (v.dish_photos || [])[0];
  return `<div class="thumb">${esc((v.name || "?").charAt(0))}${img ? `<img src="${esc(img)}" alt="" loading="lazy" onerror="this.remove()">` : ""}</div>`;
}
function resultHtml(v) {
  const d = v.deal, a = v._avail;
  const href = `#/r/${esc(v.slug)}?meal=${H.meal}&diners=${H.diners}`;
  const sub = [v.area, cuisineText(v)].filter(Boolean).join(" • ");
  let cols = "";
  if (d && a) {
    cols = (a.days || []).map((day, i) => {
      const slots = (day.slots || []).filter((s) => s.left > 0);
      const head = `<div class="dh">${dayLabel(day.date, v.timezone)}</div>`;
      if (!day.open || !slots.length) return `<div class="dcol ${i % 2 ? "alt" : ""}">${head}<div class="none">No tables</div></div>`;
      const shown = slots.slice(0, 3), rest = slots.length - shown.length;
      return `<div class="dcol ${i % 2 ? "alt" : ""}">${head}<span class="badge">${slots[0].discount}% off</span>
        ${shown.map((s) => `<a class="slot" href="${checkoutHref(v, d.id, day.date, s.time, H.meal, H.diners)}">${time12(s.time)}</a>`).join("")}
        ${rest > 0 ? `<a class="slot more" href="${href}&date=${day.date}">${rest} more</a>` : ""}</div>`;
    }).join("");
  }
  return `<article class="res"><a class="head" href="${href}">${thumbHtml(v)}<div><div class="nm">${esc(v.name)}</div><div class="meta">${esc(sub)}</div></div></a>
    ${d ? `<div class="chips chiprow"><span class="pill">${ic("card")}${m0(d.fee_per_diner_cents)} booking fee</span><span class="pill">${ic("bird")}+${m0(S.config.reward_per_booking_cents || 0)} ${esc(CREDIT)}</span></div>` : ""}
    ${cols ? `<div class="days">${cols}</div>` : d ? `<p class="muted small" style="padding:12px 18px 0">No ${H.meal} tables listed.</p>` : ""}</article>`;
}

/* ───────────────────────────── restaurant page ───────────────────────────── */
async function viewVenue(slug, q) {
  const [page] = await Promise.all([rpc("venue_page", { p_slug: slug }), loadConfig()]);
  if (!page || !page.venue) {
    showPage(`<div class="gate"><h1 class="display">We couldn't find that restaurant</h1><p><a class="btn" href="#/">Back to Home</a></p></div>`);
    return;
  }
  const v = page.venue, deal = v.deal;
  setTitle(v.name);
  const meals = deal?.meals?.length ? deal.meals : ["dinner"];
  const maxD = Math.min(deal?.max_diners || 6, S.config.max_party || 12);
  const B = { diners: Math.min(Number(q.diners) || 2, maxD), meal: meals.includes(q.meal) ? q.meal : meals.includes("dinner") ? "dinner" : meals[0], date: q.date || null, time: null, avail: null, loading: true };
  const img = v.photo || (v.dish_photos || [])[0];
  const today = todayAt(v.timezone), dow = dateObj(today).getUTCDay();
  const hoursRows = [1, 2, 3, 4, 5, 6, 0].map((d) => {
    const h = (v.hours || []).filter((x) => x.d === d);
    return `<tr class="${d === dow ? "today" : ""}"><td>${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d]}</td><td>${h.length ? h.map((x) => `${time12(x.o)} – ${time12(x.c)}`).join(", ") : "Closed"}</td></tr>`;
  }).join("");
  const menu = (v.menu || []).filter((s) => (s.items || []).length);
  showPage(`
    <div class="hero">${img ? `<img src="${esc(img)}" alt="" onerror="this.remove()">` : ""}<a class="round l" href="#/" aria-label="Back">${ic("back")}</a></div>
    <h1 class="vtitle">${esc(v.name)}</h1>
    ${v.rating != null ? `<div class="info"><span class="stars">★</span><span>${Number(v.rating).toFixed(1)}${v.review_count ? ` (${v.review_count} reviews)` : ""}</span></div>` : `<div class="info">${ic("bird")}<span>New on Early Bird</span></div>`}
    ${v.address ? `<div class="info">${ic("pin")}<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(v.name + " " + v.address)}" target="_blank" rel="noopener" style="color:inherit">${esc(v.address)}</a></div>` : ""}
    ${cuisineText(v) ? `<div class="info">${ic("fork")}<span>${esc(cuisineText(v))}</span></div>` : ""}
    ${v.description ? `<p style="margin:10px 0">${esc(v.description)}</p>` : ""}
    ${menu.length ? `<a class="btn pale" href="#menu" id="menu-btn" style="margin:14px 0">${ic("book")}&nbsp; Menu</a>` : ""}
    <hr class="rule">
    ${deal ? `<h2 class="title" style="font-size:26px">Availability</h2>
      <div class="assure"><span>${ic("cal")}Guaranteed booking</span><span>${ic("cancel")}Flexible cancellation</span></div>
      <div class="filters">
        <label>${ic("fork")}<select id="b-meal" aria-label="Meal">${meals.map((m) => `<option value="${m}" ${m === B.meal ? "selected" : ""}>${m[0].toUpperCase() + m.slice(1)}</option>`).join("")}</select></label>
        <label>${ic("person")}<select id="b-diners" aria-label="Diners">${Array.from({ length: maxD }, (_, i) => i + 1).map((n) => `<option ${n === B.diners ? "selected" : ""} value="${n}">${n} ${n === 1 ? "diner" : "diners"}</option>`).join("")}</select></label>
      </div>
      <div class="chiprow"><span class="pill">${ic("card")}${m0(deal.fee_per_diner_cents)} booking fee</span><span class="pill">${ic("bird")}+${m0(S.config.reward_per_booking_cents || 0)} ${esc(CREDIT)}</span></div>
      <div id="slots"></div>
      <p class="tiny muted" style="margin-top:10px">${deal.booking_type === "walk_in" ? "Walk-in deal: arrive at your time and show your code." : `Your table is held for ${S.config.hold_minutes || 7} minutes while you check out.`}</p>
      <hr class="rule">
      <h2 class="title">The deal</h2>
      <p style="margin:6px 0"><b>${deal.max_discount || deal.discount}% off your food bill</b>${deal.nodrink_discount ? `, or ${deal.nodrink_discount}% off with nothing extra to order` : ""}.</p>
      ${deal.requirements?.length ? `<p class="small muted">Order rules: ${deal.requirements.map((r) => `${r.per_person} ${esc(r.label.toLowerCase())} per person`).join(", ")}.</p>` : ""}
      <ul class="rules">${(deal.conditions || []).map((c) => `<li>${ic("check")}<span>${esc(c)}</span></li>`).join("")}</ul>` : `<p class="muted">This restaurant doesn't have early tables listed right now.</p>`}
    ${(v.dish_photos || []).length > 1 ? `<hr class="rule"><h2 class="title" style="margin-bottom:10px">Photos</h2><div class="photos">${v.dish_photos.map((p) => `<img src="${esc(p)}" alt="" loading="lazy" onerror="this.remove()">`).join("")}</div>` : ""}
    ${menu.length ? `<hr class="rule"><div class="menu" id="menu"><h2 class="title" style="margin-bottom:6px">Menu</h2>${v.deal_menu ? '<p class="muted small">Items marked “On the deal” are covered by the discount.</p>' : ""}
      ${menu.map((s, i) => `<details ${i === 0 ? "open" : ""}><summary>${esc(s.title)}</summary>${s.items.map((it) => `
        <div class="item"><div><span>${esc(it.name)}</span>${v.deal_menu && it.on_deal ? ' <span class="badge">On the deal</span>' : ""}${it.description ? `<div class="d">${esc(it.description)}</div>` : ""}</div><div class="p">${it.price_cents != null ? money(it.price_cents) : ""}</div></div>`).join("")}</details>`).join("")}</div>` : ""}
    <hr class="rule"><h2 class="title" style="margin-bottom:8px">Opening hours</h2><table class="hours">${hoursRows}</table>
    ${(v.reviews || []).length ? `<hr class="rule"><h2 class="title" style="margin-bottom:6px">Reviews</h2>${v.reviews.map((r) => `<div class="review"><div><span class="stars">${"★".repeat(r.rating)}</span> <b>${esc(r.author)}</b> ${r.verified ? '<span class="status ok">Verified visit</span>' : ""}</div>${r.text ? `<div>${esc(r.text)}</div>` : ""}</div>`).join("")}` : ""}
    ${deal ? `<div class="stickybook"><div class="in"><button class="btn" id="b-go" disabled>Book</button></div></div>` : ""}`, { wash: false });
  const mb = document.getElementById("menu-btn");
  if (mb) mb.onclick = (e) => { e.preventDefault(); document.getElementById("menu").scrollIntoView({ behavior: "smooth" }); };
  if (!deal) return;
  const slotsEl = document.getElementById("slots"), goBtn = document.getElementById("b-go");
  async function fetchAvail() {
    B.loading = true; B.time = null; drawSlots();
    const r = await loadAvail([v.id], B.meal, B.diners).catch(() => ({}));
    B.avail = (r[v.id] || {}).days || [];
    B.loading = false; drawSlots();
  }
  function drawSlots() {
    goBtn.disabled = !B.time;
    if (B.loading) { slotsEl.innerHTML = '<p class="loading">Checking tables…</p>'; return; }
    const days = B.avail || [];
    if (!days.some((d) => d.open && d.slots.some((s) => s.left > 0))) { slotsEl.innerHTML = `<p class="muted" style="margin-top:14px">No ${B.meal} tables in the next 8 days. Try another meal or number of diners.</p>`; return; }
    slotsEl.innerHTML = `<div class="days" style="padding-left:0;padding-right:0">${days.map((day, i) => {
      const head = `<div class="dh">${dayLabel(day.date, v.timezone)}</div>`;
      const slots = (day.slots || []);
      if (!day.open || !slots.some((s) => s.left > 0)) return `<div class="dcol ${i % 2 ? "alt" : ""}">${head}<div class="none">No tables</div></div>`;
      return `<div class="dcol ${i % 2 ? "alt" : ""}">${head}<span class="badge">${slots.find((s) => s.left > 0).discount}% off</span>${slots.map((s) => s.left > 0
        ? `<button type="button" class="slot" data-date="${day.date}" data-time="${s.time}" aria-pressed="${B.date === day.date && B.time === s.time}">${time12(s.time)}${s.discount !== deal.discount ? `<small>${s.discount}% off</small>` : ""}</button>`
        : `<button class="slot" disabled>${time12(s.time)}</button>`).join("")}</div>`;
    }).join("")}</div>`;
    slotsEl.querySelectorAll("[data-time]").forEach((b) => (b.onclick = () => { B.date = b.dataset.date; B.time = b.dataset.time; drawSlots(); }));
  }
  document.getElementById("b-meal").onchange = (e) => { B.meal = e.target.value; B.date = null; fetchAvail(); };
  document.getElementById("b-diners").onchange = (e) => { B.diners = +e.target.value; B.date = null; fetchAvail(); };
  goBtn.onclick = () => B.time && go("/book", { v: v.slug, deal: deal.id, date: B.date, time: B.time, meal: B.meal, diners: B.diners });
  await fetchAvail();
  if (q.date) document.querySelector(`[data-date="${q.date}"]`)?.scrollIntoView({ inline: "center", block: "nearest" });
}

/* ───────────────────────────── sign in: phone code (like the app) or email ───────────────────────────── */
const DIALS = [["🇺🇸", "+1"], ["🇳🇿", "+64"], ["🇦🇺", "+61"], ["🇬🇧", "+44"]];
function e164(dial, raw) {
  let d = String(raw || "").replace(/\D/g, "");
  if (String(raw || "").trim().startsWith("+")) return d.length >= 8 && d.length <= 15 ? "+" + d : null; // typed with its own country code
  if (dial === "+1" && d.length === 11 && d[0] === "1") d = d.slice(1);
  d = d.replace(/^0+/, "");
  const full = dial.replace("+", "") + d;
  return d.length >= 7 && full.length <= 15 ? "+" + full : null;
}
const prettyPhone = (p) => (p ? `+${String(p).replace(/^\+/, "")}`.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, "+1 ($1) $2-$3") : "");
// Six boxes over one invisible input: typing, paste and the phone's "From Messages" code suggestion (autocomplete=one-time-code) all fill it.
const codeBoxesHtml = () => `<div class="codebox" id="codebox"><div class="boxes" aria-hidden="true">${"<span></span>".repeat(6)}</div><input id="code-in" class="codein" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="40" aria-label="6-digit code"></div>`;
function bindCodeBoxes(onFull) {
  const inp = document.getElementById("code-in"), box = document.getElementById("codebox"), spans = [...box.querySelectorAll("span")];
  const render = () => { const v = inp.value; spans.forEach((sp, i) => { sp.textContent = v[i] || ""; sp.classList.toggle("cur", i === Math.min(v.length, 5)); }); };
  inp.addEventListener("input", () => { box.classList.remove("bad"); inp.value = inp.value.replace(/\D/g, "").slice(0, 6); render(); if (inp.value.length === 6) onFull(inp.value); });
  box.addEventListener("click", () => inp.focus());
  render(); inp.focus();
  return { value: () => inp.value, clear() { inp.value = ""; render(); inp.focus(); }, error() { box.classList.add("bad"); }, };
}

async function viewSignIn(q) {
  setTitle("Sign in");
  const next = q.next || "#/";
  const toLinked = /^#\/(r|book|booking)\b/.test(next);
  const done = async () => {
    rpc("link_device", { p_device: deviceId }).catch(() => {}); // moves anything made on this browser to the account
    if (location.search) history.replaceState(null, "", location.pathname);
    navigate(next.startsWith("#") ? next : "#/");
  };
  if (Auth.session() && (await Auth.token())) return done();
  const st = { method: q.mode === "up" ? "email" : "phone", mode: q.mode === "up" ? "up" : "in", step: 0, dial: "+1", phone: "", e164: "", email: "", first: "", last: "", resendAt: 0, busy: false };
  let tick = null;
  view.cleanup = () => clearInterval(tick);
  const head = () => `<div class="gate"><h1 class="display">${toLinked ? "Sign in to book your table" : "Sign in to book"}</h1>
    <p class="muted" style="font-size:18px">${st.method === "phone" ? "We'll text you a code. New here? An account is made for you." : st.mode === "in" ? "Use the email and password you use in the Early Bird app." : "Create a free account. It works in the Early Bird app too."}</p></div>`;
  const legal = `<p class="tiny muted center" style="margin:12px 0 0">By continuing you accept the <a href="../terms.html" target="_blank" rel="noopener">Terms</a> and <a href="../privacy.html" target="_blank" rel="noopener">Privacy Policy</a>.</p>`;
  const msgHtml = (m, k) => (m ? `<div class="msg ${k || "err"}" role="alert">${esc(m)}</div>` : "");

  function drawPhone(msg = "", kind = "err") {
    st.method = "phone"; st.step = 0;
    showPage(`${head()}${msgHtml(msg, kind)}
      <form id="pf" class="card" novalidate>
        <label class="field">Phone number</label>
        <div style="display:flex;gap:8px;margin-top:-6px"><select id="p-dial" aria-label="Country code" style="width:96px;margin:0;flex:none">${DIALS.map(([f, d]) => `<option value="${d}" ${d === st.dial ? "selected" : ""}>${f} ${d}</option>`).join("")}</select>
          <input id="p-num" type="tel" inputmode="tel" autocomplete="tel-national" placeholder="Phone number" style="margin:0" value="${esc(st.phone)}"></div>
        <button class="btn" id="p-go" type="submit" style="margin-top:14px">Next</button>
        ${legal}</form>
      <p class="center"><button class="linklike" type="button" id="use-email">Use email instead</button></p>`);
    document.getElementById("use-email").onclick = () => { st.method = "email"; drawEmail(); };
    document.getElementById("pf").onsubmit = async (e) => {
      e.preventDefault();
      st.dial = document.getElementById("p-dial").value; st.phone = val("p-num");
      const num = e164(st.dial, st.phone);
      if (!num) return drawPhone("Check your phone number and try again.");
      const btn = document.getElementById("p-go"); btn.disabled = true; btn.textContent = "Sending…";
      try { await Auth.sendPhoneCode(num); st.e164 = num; drawCode(); }
      catch (err) { drawPhone(err.message); }
    };
  }
  function drawCode(msg = "", kind = "err") {
    st.step = 1; st.resendAt = st.resendAt > Date.now() ? st.resendAt : Date.now() + 30000;
    showPage(`<div class="gate"><h1 class="display">Enter the code</h1><p class="muted" style="font-size:18px">We texted a 6-digit code to ${esc(prettyPhone(st.e164))}.</p></div>
      ${msgHtml(msg, kind)}
      <div class="card">${codeBoxesHtml()}
        <button class="btn" id="v-go" type="button" style="margin-top:14px" disabled>Verify</button>
        <div class="actions" style="margin-top:12px"><button class="btn grey" id="v-back" type="button">Back</button><button class="btn grey" id="v-resend" type="button" disabled>Resend</button></div></div>`);
    const verify = async (code) => {
      if (st.busy) return; st.busy = true;
      const go = document.getElementById("v-go"); go.disabled = true; go.textContent = "Checking…";
      try { await Auth.verifyPhoneCode(st.e164, code); await done(); }
      catch (err) { st.busy = false; ctl.error(); ctl.clear(); go.textContent = "Verify"; go.disabled = true; const m = document.querySelector(".msg"); if (m) m.remove(); document.getElementById("codebox").insertAdjacentHTML("beforebegin", msgHtml(err.message)); }
    };
    const ctl = bindCodeBoxes((c) => { document.getElementById("v-go").disabled = false; verify(c); });
    document.getElementById("code-in").addEventListener("input", (e) => { document.getElementById("v-go").disabled = e.target.value.length !== 6; });
    document.getElementById("v-go").onclick = () => ctl.value().length === 6 && verify(ctl.value());
    document.getElementById("v-back").onclick = () => { st.resendAt = 0; drawPhone(); };
    const rs = document.getElementById("v-resend");
    clearInterval(tick);
    tick = setInterval(() => { const left = Math.ceil((st.resendAt - Date.now()) / 1000); if (!rs.isConnected) return clearInterval(tick); rs.disabled = left > 0; rs.textContent = left > 0 ? `Resend in ${left}s` : "Resend"; }, 500);
    rs.onclick = async () => { rs.disabled = true; try { await Auth.sendPhoneCode(st.e164); st.resendAt = Date.now() + 30000; ctl.clear(); } catch (err) { drawCode(err.message); } };
  }
  function drawEmail(msg = "", kind = "err") {
    st.method = "email";
    showPage(`${head()}${msgHtml(msg, kind)}
      <form id="af" class="card" novalidate>
        ${st.mode === "up" ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><label class="field">First name<input id="a-first" type="text" autocomplete="given-name" value="${esc(st.first)}" required></label><label class="field">Last name<input id="a-last" type="text" autocomplete="family-name" value="${esc(st.last)}" required></label></div>` : ""}
        <label class="field">Email<input id="a-email" type="email" autocomplete="email" inputmode="email" value="${esc(st.email)}" required></label>
        <label class="field">Password<input id="a-pw" type="password" autocomplete="${st.mode === "in" ? "current-password" : "new-password"}" minlength="8" required></label>
        <button class="btn" id="a-go" type="submit">${st.mode === "in" ? "Sign in" : "Create account"}</button>
        ${st.mode === "in" ? `<p class="center small" style="margin:14px 0 0"><button class="linklike" type="button" id="a-forgot">Forgot password?</button></p>` : legal}
      </form>
      <p class="center">${st.mode === "in" ? `New to Early Bird? <button class="linklike" type="button" id="a-swap">Create an account</button>` : `Already have an account? <button class="linklike" type="button" id="a-swap">Sign in</button>`}<br><button class="linklike" type="button" id="use-phone" style="margin-top:10px">Use my phone number instead</button></p>`);
    document.getElementById("use-phone").onclick = () => drawPhone();
    document.getElementById("a-swap").onclick = () => { st.mode = st.mode === "in" ? "up" : "in"; drawEmail(); };
    const forgot = document.getElementById("a-forgot");
    if (forgot) forgot.onclick = async () => {
      const email = (st.email = val("a-email"));
      if (!/^\S+@\S+\.\S+$/.test(email)) return drawEmail("Type your email above first, then tap Forgot password.");
      try { await Auth.reset(email); drawEmail("Check your email for a link to set a new password.", "ok"); } catch (e) { drawEmail(e.message); }
    };
    document.getElementById("af").onsubmit = async (e) => {
      e.preventDefault();
      const email = (st.email = val("a-email")), pw = document.getElementById("a-pw").value;
      st.first = val("a-first"); st.last = val("a-last");
      if (!/^\S+@\S+\.\S+$/.test(email)) return drawEmail("Check your email address and try again.");
      if (pw.length < 8) return drawEmail("Choose a longer password (8+ characters).");
      const btn = document.getElementById("a-go"); btn.disabled = true; btn.textContent = "One moment…";
      try {
        if (st.mode === "in") await Auth.signIn(email, pw);
        else { if (!st.first) { btn.disabled = false; return drawEmail("Please add your first name."); } await Auth.signUp(email, pw, st.first, st.last); }
        await done();
      } catch (err) { drawEmail(err.message); }
    };
  }
  if (st.method === "email") drawEmail(q.reset ? "Your password was changed. Sign in with it." : "", "ok"); else drawPhone(q.reset ? "Your password was changed. Sign in with it." : "", "ok");
}

/* ───────────────────────────── checkout: "Make a booking" ───────────────────────────── */
function normalisePhone(raw) {
  const t = String(raw || "").trim(), digits = t.replace(/\D/g, "");
  if (t.startsWith("+")) return digits.length >= 8 && digits.length <= 15 ? "+" + digits : null;
  if (digits.length === 10) return "+1" + digits;
  if (digits.length === 11 && digits[0] === "1") return "+" + digits;
  return null;
}
async function viewCheckout(q) {
  setTitle("Make a booking");
  const C = { hold: null, venue: null, profile: null, intent: null, timer: null, done: false, paying: false, details: null };
  const slug = q.v, wanted = { deal: q.deal, date: q.date, time: q.time, meal: q.meal || "dinner", diners: Number(q.diners) || 2, option: q.opt === "nodrink" ? "nodrink" : "standard" };
  if (!slug || !wanted.deal || !wanted.date || !wanted.time) return go("/");
  const [page, profile] = await Promise.all([rpc("venue_page", { p_slug: slug }), rpc("profile"), loadConfig()]);
  if (!page?.venue) return go("/");
  C.venue = page.venue; C.profile = profile;
  const v = C.venue;
  const out = (msg) => showPage(`<div class="sheethead"><h1>Couldn't hold that table</h1><a class="x" href="#/r/${esc(v.slug)}" aria-label="Close">${ic("x")}</a></div><div class="msg err">${esc(msg)}</div><a class="btn" href="#/r/${esc(v.slug)}">Choose another time</a>`, { wash: false });
  const makeHold = async () => { C.hold = await rpc("hold", { p_device: deviceId, p_deal: wanted.deal, p_date: wanted.date, p_time: wanted.time, p_diners: wanted.diners, p_meal: wanted.meal, p_option: wanted.option }); };
  try { await makeHold(); } catch (e) { if (e.code === "not_signed_in") throw e; return out(friendly(e)); }
  C.details = { name: [profile.first_name, profile.last_name].filter(Boolean).join(" "), phone: profile.phone || "", request: "", marketing: false, accepted: false, venueRef: "", bookedWithVenue: false };
  view.cleanup = () => { clearInterval(C.timer); try { C.paymentEl?.destroy(); C.expressEl?.destroy(); } catch { /* ignore */ } if (C.hold && !C.intent && !C.done) rpc("release_hold", { p_device: deviceId, p_claim: C.hold.booking_id }).catch(() => {}); };

  function startTimer() {
    clearInterval(C.timer);
    const tick = () => {
      const el = document.getElementById("timer"); if (!el) return;
      const ms = new Date(C.hold.expires_at) - Date.now();
      if (ms <= 0) { clearInterval(C.timer); el.textContent = "0:00"; if (!C.done && !C.paying) { const b = document.getElementById("expired"); if (b) b.hidden = false; document.querySelectorAll("#co button.btn").forEach((x) => (x.disabled = true)); } return; }
      const s = Math.floor(ms / 1000);
      el.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
      el.classList.toggle("low", s < 60);
    };
    tick(); C.timer = setInterval(tick, 1000);
  }
  const hd = () => C.hold;
  const reqText = () => (hd().requirements || []).map((r) => `${r.per_person} ${r.label.toLowerCase()} per person`).join(", ");
  const summaryHtml = () => {
    const h = hd();
    return `<div class="sumrow">${thumbHtml(v)}<div><span class="deal-pill">${ic("tag")}${h.discount}% off food bill</span><div class="nm">${esc(v.name)}</div>
      <div class="muted">${time12(h.time)}, ${esc(fmtLong(h.date))}</div></div></div>
      <div class="savebox"><div><b>Estimated savings on food</b><span>Based on one main each. Results may vary.</span></div><div class="amt">${m0(h.saving_cents)}</div></div>`;
  };
  const conditionsHtml = () => {
    const rules = [...(v.deal?.conditions || [])];
    if (reqText()) rules.unshift(`Order ${reqText()}`);
    return rules.length ? `<div class="card flat" style="background:#F1F3F8"><div class="title" style="font-size:18px">Early Bird conditions</div><div class="muted small">To keep these ${hd().standard_discount || hd().discount}% deals alive, please follow a few house rules</div>
      <ul class="rules">${rules.map((c) => `<li>${ic("check")}<span>${esc(c)}</span></li>`).join("")}</ul></div>` : "";
  };
  const policyHtml = () => {
    const cfg = S.config;
    return `<div class="policy"><b>Cancellation policy</b><br>Plans change. This policy encourages you to cancel sooner rather than later so the restaurant has time to fill your table with another Early Bird booking. Cancellations are returned as ${esc(CREDIT)} you can use on other Early Bird bookings for ${cfg.credit_valid_days} days.
      <table><tr><td>Within ${cfg.cancel_full_credit_minutes} minutes of booking</td><td>The whole fee</td></tr>
      <tr><td>Later, before the day of your booking</td><td>${cfg.cancel_before_day_percent}% of the fee</td></tr>
      <tr><td>On the day, or no-show</td><td>Nothing</td></tr></table></div>`;
  };
  const breakdownHtml = () => {
    const h = hd();
    return `<div class="lines"><div><span>Booking fee${h.fee_per_diner_cents != null ? ` (${h.diners} × ${money(h.fee_per_diner_cents)})` : ""}</span><span>${money(h.fee_cents)}</span></div>
      ${h.credit_cents > 0 ? `<div class="g"><span>Paid from your ${esc(CREDIT)}</span><span>−${money(h.credit_cents)}</span></div>` : ""}
      <div class="g"><span>${ic("check")} Est. savings on food</span><span>${m0(h.saving_cents)}</span></div>
      ${S.config.reward_per_booking_cents > 0 ? `<div class="n"><span>${ic("bird")} ${esc(CREDIT)} you'll earn</span><span>+${money(S.config.reward_per_booking_cents)}</span></div>` : ""}</div>`;
  };
  const head = () => `<div class="sheethead"><div><h1>Make a booking</h1><div class="green small" style="margin-top:6px;display:flex;gap:8px;align-items:center">${ic("seal")}Guaranteed booking • Flexible cancellation</div></div><a class="x" href="#/r/${esc(v.slug)}" aria-label="Close">${ic("x")}</a></div>`;
  const holdLine = () => `<div class="holdline">Holding your table for <span class="timer" id="timer">–</span></div><div id="expired" class="msg err" hidden>Your hold ran out. <a href="#/r/${esc(v.slug)}">Choose a time again</a>.</div>`;
  const testBadge = (mode) => (mode === "test" ? '<span class="testbadge">TEST MODE</span>' : "");

  function drawDetails(msg) {
    const d = C.details, h = hd();
    showPage(`<div id="co">${head()}${summaryHtml()}
      ${msg ? `<div class="msg err" role="alert">${esc(msg)}</div>` : ""}
      <div class="row"><b style="font-size:18px">Diners</b><div class="stepper"><button type="button" id="d-minus" aria-label="Fewer diners">−</button><span id="d-n" aria-live="polite">${h.diners}</span><button type="button" id="d-plus" aria-label="More diners">+</button></div></div>
      ${h.nodrink_discount ? `<div role="radiogroup" aria-label="Drinks option">
        <label class="opt ${h.option === "standard" ? "on" : ""}"><input type="radio" name="opt" value="standard" ${h.option === "standard" ? "checked" : ""}><span><b>${h.standard_discount}% off food bill</b><span class="d">${reqText() ? `Order ${esc(reqText())}.` : "Nothing extra to order."}</span></span></label>
        <label class="opt ${h.option === "nodrink" ? "on" : ""}"><input type="radio" name="opt" value="nodrink" ${h.option === "nodrink" ? "checked" : ""}><span><b>${h.nodrink_discount}% off, no drinks needed</b><span class="d">Nothing extra to order. A smaller discount and a smaller fee.</span></span></label></div>` : ""}
      ${conditionsHtml()}
      ${h.reservation_url ? `<div class="card"><div class="title" style="font-size:18px">1. Book your table with ${esc(v.name)}</div><p class="small muted" style="margin:6px 0 12px">This venue takes reservations on its own website. Book for ${time12(h.time)}, ${esc(fmtLong(h.date))} for ${h.diners}, then come back here to add your ${h.discount}% off.</p>
        <a class="btn pale" href="${esc(h.reservation_url)}" target="_blank" rel="noopener">Open ${esc(v.name)} booking</a>
        <label class="field" style="margin-top:12px">Reservation name or number <span class="hint">(optional)</span><input id="c-ref" type="text" maxlength="80" value="${esc(d.venueRef)}"></label>
        <label class="check"><input type="checkbox" id="c-bv" ${d.bookedWithVenue ? "checked" : ""}><span>I've booked ${time12(h.time)} with ${esc(v.name)}</span></label></div>` : ""}
      <div class="card"><div class="title" style="margin-bottom:12px">Your details</div>
        <label class="field">Full name<input id="c-name" type="text" autocomplete="name" maxlength="80" value="${esc(d.name)}" required></label>
        <label class="field">Mobile number<input id="c-phone" type="tel" autocomplete="tel" inputmode="tel" maxlength="32" placeholder="(310) 555-0101" value="${esc(d.phone)}" required><span class="hint">The restaurant may use it to reach you about this table.</span></label>
        <label class="field">Special request <span class="hint" style="display:inline">(optional)</span><input id="c-req" type="text" maxlength="500" value="${esc(d.request)}" placeholder="Allergies, a window seat…"></label>
        <label class="check"><input type="checkbox" id="c-mk" ${d.marketing ? "checked" : ""}><span>Let ${esc(v.name)} send me offers</span></label>
      </div>
      ${policyHtml()}
      <label class="check"><input type="checkbox" id="c-ok" ${d.accepted ? "checked" : ""}><span>I accept Early Bird conditions and the <a href="../terms.html" target="_blank" rel="noopener">booking terms</a></span></label>
      ${breakdownHtml()}
      <div class="complete">Complete booking <span>${money(h.amount_due_cents)} to pay</span></div>
      <div id="c-err" class="msg err" role="alert" hidden></div>
      <button class="btn" id="c-go">${h.amount_due_cents > 0 && h.payment_mode === "stripe" ? "Continue to payment" : "Confirm booking"}</button>
      ${h.amount_due_cents === 0 ? `<p class="tiny muted center" style="margin:8px 0 0">Nothing to pay: your ${esc(CREDIT)} covers the fee.</p>` : ""}
      ${testBadge(h.stripe_mode)}${holdLine()}</div>`, { wash: false });
    startTimer();
    const capture = () => {
      d.name = val("c-name"); d.phone = val("c-phone"); d.request = val("c-req");
      d.marketing = document.getElementById("c-mk").checked; d.accepted = document.getElementById("c-ok").checked;
      if (document.getElementById("c-ref")) { d.venueRef = val("c-ref"); d.bookedWithVenue = document.getElementById("c-bv").checked; }
    };
    const reprice = async (fn) => { capture(); try { C.hold = await fn(); drawDetails(); } catch (e) { drawDetails(friendly(e)); } };
    document.getElementById("d-minus").onclick = () => { if (h.diners > 1) reprice(() => rpc("set_party", { p_device: deviceId, p_claim: h.booking_id, p_diners: h.diners - 1 })); };
    document.getElementById("d-plus").onclick = () => { if (h.diners < h.max_diners) reprice(() => rpc("set_party", { p_device: deviceId, p_claim: h.booking_id, p_diners: h.diners + 1 })); };
    document.querySelectorAll('input[name="opt"]').forEach((r) => (r.onchange = () => reprice(() => rpc("set_option", { p_device: deviceId, p_claim: h.booking_id, p_option: r.value }))));
    document.getElementById("c-go").onclick = async () => {
      capture();
      const err = (m) => { const e = document.getElementById("c-err"); e.textContent = m; e.hidden = false; e.scrollIntoView({ block: "center", behavior: "smooth" }); };
      const phone = normalisePhone(d.phone);
      if (d.name.trim().length < 2) return err("Please add your name for the reservation.");
      if (!phone) return err("Please add a mobile number (10 digits, or with + and your country code).");
      if (h.reservation_url && !d.bookedWithVenue) return err(`Book with ${v.name} first, then tick the box.`);
      if (!d.accepted) return err("Tick the box to accept the conditions.");
      d.phone = phone;
      const btn = document.getElementById("c-go"); btn.disabled = true; btn.textContent = "One moment…";
      try { if (h.payment_mode === "stripe" && h.amount_due_cents > 0) await drawPayment(); else await confirmWithoutCard(); }
      catch (e) {
        if (e.code === "hold_expired") { clearInterval(C.timer); C.done = true; return out(friendly(e)); }
        btn.disabled = false; drawDetails(friendly(e));
      }
    };
  }
  const confirmParams = (id) => ({ p_device: deviceId, p_claim: id, p_name: C.details.name.trim(), p_phone: C.details.phone, p_request: C.details.request || null, p_external_ref: C.details.venueRef || null, p_share_contact: null, p_marketing: C.details.marketing ? true : null });
  async function confirmWithoutCard() { const b = await rpc("confirm", confirmParams(hd().booking_id)); C.done = true; after(b); }
  function after(b) {
    const n = C.details.name.trim().split(/\s+/);
    rpc("save_profile", { p_first: n[0], p_last: n.slice(1).join(" ") || null, p_phone: C.details.phone }).catch(() => {});
    sstore.set("eb.web.pending", null);
    go("/booking/" + b.id, { new: 1 });
  }

  async function drawPayment() {
    const h = hd();
    const info = await pay("intent", { claim_id: h.booking_id });
    C.intent = info;
    sstore.set("eb.web.pending", JSON.stringify({ id: h.booking_id, details: C.details }));
    showPage(`<div id="co">${head()}${summaryHtml()}
      <div class="row"><span>Diners</span><b>${h.diners}</b></div>${breakdownHtml()}
      <div class="complete">Complete booking <span>${money(info.amount_cents)} to pay</span></div>
      <div id="express-element"></div><div id="pay-element"></div>
      <div id="p-err" class="msg err" role="alert" hidden></div>
      <button class="btn" id="p-go" type="button" disabled>Pay ${money(info.amount_cents)} and book</button>
      <p class="center"><button class="linklike" id="p-back" type="button" style="margin-top:12px">Change details</button></p>
      ${testBadge(info.mode)}${info.mode === "test" ? '<p class="tiny muted center" style="margin:6px 0 0">Test card 4242 4242 4242 4242, any future expiry, any CVC. No card is charged.</p>' : ""}
      <p class="tiny muted center" style="margin:10px 0 0">Secure payment by Stripe.</p>${holdLine()}</div>`, { wash: false });
    startTimer();
    document.getElementById("p-back").onclick = async () => {
      clearInterval(C.timer); C.intent = null; // a payment was started for this hold, so take a fresh hold with the new choices
      try { await makeHold(); drawDetails("Change your details, then continue."); } catch (e) { out(friendly(e)); }
    };
    const stripe = Stripe(info.publishable_key);
    const elements = stripe.elements({ clientSecret: info.client_secret, appearance: { theme: "stripe", variables: { colorPrimary: "#34548A", colorText: "#14171F", fontFamily: "-apple-system, system-ui, sans-serif", borderRadius: "12px", fontSizeBase: "16px" } } });
    const returnUrl = `${location.origin}${location.pathname}?pay=${h.booking_id}`;
    const errBox = (m) => { const e = document.getElementById("p-err"); if (e) { e.textContent = m || ""; e.hidden = !m; } };
    let express = null;
    try {
      express = C.expressEl = elements.create("expressCheckout", { buttonHeight: 50, buttonType: { applePay: "book", googlePay: "book" }, paymentMethods: { link: "never", amazonPay: "never", paypal: "never" } });
      express.mount("#express-element");
      express.on("ready", (e) => {
        const any = e.availablePaymentMethods && Object.values(e.availablePaymentMethods).some(Boolean);
        const box = document.getElementById("express-element");
        if (!any) box?.remove(); else box?.insertAdjacentHTML("afterend", '<p class="tiny muted center" style="margin:6px 0 10px">or pay by card</p>');
      });
      express.on("confirm", async () => {
        C.paying = true; errBox("");
        const { error } = await stripe.confirmPayment({ elements, clientSecret: info.client_secret, confirmParams: { return_url: returnUrl }, redirect: "if_required" });
        if (error) { C.paying = false; errBox(error.message); return; }
        await finishPayment();
      });
    } catch { /* express checkout unavailable: the card form below still works */ }
    const pe = (C.paymentEl = elements.create("payment", { layout: "tabs", wallets: { applePay: express ? "never" : "auto", googlePay: express ? "never" : "auto" } }));
    pe.mount("#pay-element");
    pe.on("ready", () => { const b = document.getElementById("p-go"); if (b) b.disabled = false; });
    document.getElementById("p-go").onclick = async () => {
      const b = document.getElementById("p-go"); b.disabled = true; b.textContent = "Processing…"; errBox(""); C.paying = true;
      const { error } = await stripe.confirmPayment({ elements, confirmParams: { return_url: returnUrl, payment_method_data: { billing_details: { name: C.details.name, email: C.profile.email || undefined, phone: C.details.phone } } }, redirect: "if_required" });
      if (error) { C.paying = false; b.disabled = false; b.textContent = `Pay ${money(info.amount_cents)} and book`; errBox(error.message || "The payment didn't go through. Try another card."); return; }
      await finishPayment();
    };
  }
  async function finishPayment() {
    showPage(`<div class="gate"><h1 class="display">Finishing your booking…</h1><p class="muted">Confirming your payment. Please don't close this page.</p></div>`, { wash: false });
    clearInterval(C.timer);
    try { const b = await settleBooking(hd().booking_id, C.details); C.done = true; if (b) after(b); }
    catch (e) {
      showPage(`<div class="gate"><h1 class="display">We're still confirming</h1></div><div class="msg err">${esc(e.message || friendly(e))}</div>
        <p>If you were charged, don't pay again: your booking will appear under <a href="#/bookings">Bookings</a> as soon as the payment is confirmed, or contact <a href="../support.html">support</a>.</p>`, { wash: false });
    }
  }
  drawDetails();
}

// Ask the server to check the payment with Stripe (it confirms the booking), then save the diner's details.
async function settleBooking(id, d) {
  let r = null;
  for (let i = 0; i < 12; i++) {
    r = await pay("verify", { claim_id: id });
    if (r.paid) break;
    if (r.status === "canceled" || r.status === "requires_payment_method") throw new ApiError("payment_failed", "The payment didn't go through. Please go back and try again.");
    await sleep(1500);
  }
  if (!r?.paid) throw new ApiError("pending", "Your payment is still processing.");
  if (r.payment_status === "credited") {
    showPage(`<div class="gate"><h1 class="display">That table was taken</h1></div><div class="msg info">Your payment arrived after your hold ran out and the table had gone, so we've kept your fee as ${esc(CREDIT)}. You can use it on your next booking.</div><a class="btn" href="#/">Find another table</a>`, { wash: false });
    return null;
  }
  return rpc("confirm", { p_device: deviceId, p_claim: id, p_name: d.name.trim(), p_phone: d.phone, p_request: d.request || null, p_external_ref: d.venueRef || null, p_share_contact: null, p_marketing: d.marketing ? true : null });
}
// Stripe sends the diner back here after a redirect-based payment method (?pay=<booking id>).
async function viewReturn(q) {
  setTitle("Booking");
  const id = q.pay;
  showPage(`<div class="gate"><h1 class="display">Finishing your booking…</h1><p class="muted">Confirming your payment.</p></div>`, { wash: false });
  let pending = null;
  try { pending = JSON.parse(sstore.get("eb.web.pending") || "null"); } catch { /* ignore */ }
  const d = pending?.id === id ? pending.details : { name: "", phone: "", request: "", marketing: false, venueRef: "" };
  history.replaceState(null, "", location.pathname + "#/");
  try {
    if (q.redirect_status === "failed") throw new ApiError("payment_failed", "The payment didn't go through. Please try booking again.");
    const b = await settleBooking(id, d);
    sstore.set("eb.web.pending", null);
    if (b) go("/booking/" + b.id, { new: 1 });
  } catch (e) {
    showPage(`<div class="gate"><h1 class="display">Booking not completed</h1></div><div class="msg err">${esc(e.message || friendly(e))}</div><a class="btn" href="#/bookings">Bookings</a>`, { wash: false });
  }
}

/* ───────────────────────────── bookings ───────────────────────────── */
const statusPill = (b) => { const m = { confirmed: ["ok", "Confirmed"], cancelled: ["", "Cancelled"], redeemed: ["ok", "Used"], no_show: ["bad", "No-show"] }[b.status] || ["", b.status]; return `<span class="status ${m[0]}">${m[1]}</span>`; };
async function viewBookings() {
  setTitle("Bookings");
  const list = await rpc("my_bookings", { p_device: deviceId });
  const today = (b) => todayAt(b.venue?.timezone);
  const upcoming = list.filter((b) => b.status === "confirmed" && b.date >= today(b)).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const past = list.filter((b) => !upcoming.includes(b)).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  const row = (b) => `<a class="brow" href="#/booking/${b.id}"><div><b>${esc(b.venue?.name || "Restaurant")}</b><span class="muted small">${esc(fmtDate(b.date, { weekday: "short", day: "numeric", month: "short" }))} • ${time12(b.time)} • ${b.diners} ${b.diners === 1 ? "diner" : "diners"}</span></div><div class="center">${statusPill(b)}${b.status === "confirmed" && b.code ? `<div class="small" style="font-family:ui-monospace,Menlo,monospace;letter-spacing:.1em;margin-top:4px">${esc(b.code)}</div>` : ""}</div></a>`;
  showPage(`<h1 class="display" style="margin:14px 0 16px">Bookings</h1>
    ${list.length ? "" : `<div class="card center muted">No bookings yet.<br><br><a class="btn" href="#/">Find a table</a></div>`}
    ${upcoming.length ? `<div class="sec"><h2>Upcoming</h2></div>${upcoming.map(row).join("")}` : ""}
    ${past.length ? `<div class="sec"><h2>Past and cancelled</h2></div>${past.map(row).join("")}` : ""}`);
}
function cancelPreview(b) {
  const cfg = S.config, minutes = (Date.now() - new Date(b.confirmed_at || b.created_at)) / 60000, today = todayAt(b.venue?.timezone);
  let pct = 0, why = `Cancelling on the day of your booking doesn't earn any ${CREDIT}.`;
  if (minutes <= cfg.cancel_full_credit_minutes) { pct = 100; why = `You're within ${cfg.cancel_full_credit_minutes} minutes of booking, so you get the whole fee back.`; }
  else if (today < b.date) { pct = cfg.cancel_before_day_percent; why = `You're cancelling before the day of the booking, so you get ${pct}% of the fee back.`; }
  return { pct, cents: Math.round((b.fee_cents * pct) / 100), why };
}
async function viewBooking(id, q) {
  await loadConfig();
  const b = await rpc("booking", { p_device: deviceId, p_booking: id });
  setTitle("Booking");
  if (b.status === "held" || b.status === "expired") {
    showPage(`<div class="gate"><h1 class="display">Not confirmed</h1></div><div class="msg info">This table was held but the booking wasn't completed.</div><a class="btn" href="#/bookings">Bookings</a>`, { wash: false });
    return;
  }
  const v = b.venue || {}, walkIn = b.booking_type === "walk_in";
  const isNew = q.new === "1" && b.status === "confirmed";
  const cancellable = b.status === "confirmed" && b.date >= todayAt(v.timezone);
  const cp = cancellable ? cancelPreview(b) : null;
  showPage(`
    ${isNew ? `<div class="center"><div class="tick" aria-hidden="true">${ic("check")}</div><h1 class="display">Booking successful</h1><p class="muted" style="margin-top:6px">Show this code to the staff when you order.</p></div>` : `<div class="sheethead"><h1>Your booking ${statusPill(b)}</h1></div>`}
    ${b.status === "confirmed" ? `<div class="card" style="margin-top:16px"><div class="center muted small">${walkIn ? "Walk-in deal" : "Table booking"}</div><div class="code" aria-label="Booking code ${esc(b.code)}">${esc(b.code)}</div>
      <p class="center small muted" style="margin:0">${walkIn ? `Arrive at ${time12(b.time)}. Show this code at the counter when you order.` : `Arrive within your booked time and show this code. ${b.discount}% off your food bill.`}</p></div>` : ""}
    ${b.status === "cancelled" ? `<div class="msg info">This booking was cancelled${b.cancelled_at ? " on " + esc(fmtStamp(b.cancelled_at)) : ""}.</div>` : ""}
    <div class="card"><div class="sumrow" style="margin-top:0">${thumbHtml(v)}<div><span class="deal-pill">${ic("tag")}${b.discount}% off food bill</span><div class="nm">${esc(v.name || "Restaurant")}</div><div class="muted">${time12(b.time)}, ${esc(fmtLong(b.date))}</div></div></div>
      <dl class="kv"><dt>Diners</dt><dd>${b.diners}${b.option === "nodrink" ? " (no drinks needed)" : ""}</dd>
        <dt>Booking fee</dt><dd>${money(b.fee_cents)}${b.credit_used_cents ? ` (${money(b.credit_used_cents)} from your ${esc(CREDIT)})` : ""}${b.amount_paid_cents ? ` · ${money(b.amount_paid_cents)} paid by card` : ""}</dd>
        ${b.saving_cents ? `<dt>Est. savings</dt><dd class="green">${m0(b.saving_cents)} on food</dd>` : ""}
        ${b.requirements?.length ? `<dt>Order rules</dt><dd>${b.requirements.map((r) => `${r.per_person} ${esc(r.label.toLowerCase())} per person`).join(", ")}</dd>` : ""}
        ${b.guest_name ? `<dt>Name</dt><dd>${esc(b.guest_name)}</dd>` : ""}${b.special_request ? `<dt>Request</dt><dd>${esc(b.special_request)}</dd>` : ""}
        ${v.address ? `<dt>Where</dt><dd><a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((v.name || "") + " " + v.address)}" target="_blank" rel="noopener">${esc(v.address)}</a></dd>` : ""}
        ${v.phone ? `<dt>Phone</dt><dd><a href="tel:${esc(v.phone)}">${esc(v.phone)}</a></dd>` : ""}</dl>
      ${b.reward_cents > 0 && b.status === "confirmed" ? `<p class="small" style="margin:12px 0 0;color:var(--slot)">+${money(b.reward_cents)} ${esc(CREDIT)} for this booking, available after your visit.</p>` : ""}</div>
    <div class="actions">${b.status === "confirmed" ? `<button class="btn pale" id="ics" type="button">Add to calendar</button>` : ""}${v.slug ? `<a class="btn pale" href="#/r/${esc(v.slug)}">Restaurant</a>` : ""}</div>
    ${cancellable ? `<div class="card" style="margin-top:14px"><div class="title">Cancel this booking</div><p class="small muted" style="margin:6px 0 12px">${esc(cp.why)} ${cp.cents ? `That's about <b>${money(cp.cents)}</b> as ${esc(CREDIT)}.` : ""}</p><button class="btn danger" id="cancel" type="button">Cancel booking</button></div>` : ""}`);
  const ics = document.getElementById("ics"); if (ics) ics.onclick = () => downloadIcs(b);
  const cb = document.getElementById("cancel");
  if (cb) cb.onclick = async () => {
    const p = cancelPreview(b);
    const ok = await confirmDialog({ title: "Cancel this booking?", ok: "Cancel booking", cancel: "Keep it",
      body: `<p>${esc(p.why)}</p><p>${p.cents ? `You'll get <b>${money(p.cents)}</b> as ${esc(CREDIT)}, valid for ${S.config.credit_valid_days} days.` : `You won't get any ${CREDIT} back.`}</p>${b.reward_cents ? `<p class="small muted">The ${money(b.reward_cents)} ${esc(CREDIT)} reward for this booking is taken back.</p>` : ""}` });
    if (!ok) return;
    cb.disabled = true; cb.textContent = "Cancelling…";
    try {
      const r = await rpc("cancel", { p_device: deviceId, p_claim: b.id });
      await viewBooking(b.id, {});
      const m = r.credited_cents > 0 ? `Booking cancelled. ${money(r.credited_cents)} ${CREDIT} added${r.credit_expires_at ? ", use it by " + fmtStamp(r.credit_expires_at) : ""}.` : "Booking cancelled.";
      APP.insertAdjacentHTML("afterbegin", `<div class="col"><div class="msg ok" role="status">${esc(m)}</div></div>`);
    } catch (e) { cb.disabled = false; cb.textContent = "Cancel booking"; alert(friendly(e)); }
  };
}
function downloadIcs(b) {
  const start = new Date(b.starts_at), end = new Date(start.getTime() + 90 * 60000), v = b.venue || {};
  const f = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const text = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Early Bird//Booking//EN", "BEGIN:VEVENT", `UID:${b.id}@eatearlybird.com`, `DTSTAMP:${f(new Date())}`, `DTSTART:${f(start)}`, `DTEND:${f(end)}`,
    `SUMMARY:Early Bird at ${v.name || "restaurant"}`, `DESCRIPTION:Booking code ${b.code}. ${b.discount}% off your food bill.`, `LOCATION:${(v.address || "").replace(/,/g, "\\,")}`, "END:VEVENT", "END:VCALENDAR"].join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "text/calendar" }));
  a.download = `early-bird-${slugify(v.name || "booking")}.ics`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* ───────────────────────────── profile ───────────────────────────── */
async function viewAccount() {
  setTitle("Profile");
  const [p, cr, au] = await Promise.all([rpc("profile"), rpc("my_credit", { p_device: deviceId }), Auth.user()]);
  const email = au?.email || "", phone = au?.phone || "", pendingEmail = au?.new_email || "";
  const sign = `<div class="card"><div class="title">How you sign in</div>
    <dl class="kv" style="margin:10px 0 4px"><dt>Phone</dt><dd>${phone ? esc(prettyPhone(phone)) : '<span class="muted">Not added</span>'}</dd>
      <dt>Email</dt><dd>${email ? esc(email) : pendingEmail ? `<span class="muted">Waiting for you to confirm ${esc(pendingEmail)}</span>` : '<span class="muted">Not added</span>'}</dd></dl>
    <p class="small muted" style="margin:6px 0 10px">${!email ? "Add an email and a password to sign in with them too, in the app or on the website. It stays the same account, with the same bookings and balance." : !phone ? "Add your phone number to sign in with a texted code too. It stays the same account." : "You can sign in either way. It is the same account."}</p>
    <div id="link-area">${!email && !pendingEmail ? '<button class="btn pale" id="add-email" type="button">Add email and password</button>' : !phone ? '<button class="btn pale" id="add-phone" type="button">Add phone number</button>' : ""}</div></div>`;
  showPage(`<h1 class="display" style="margin:14px 0 16px">Profile</h1>
    <div class="card"><b style="font-size:19px">${esc([p.first_name, p.last_name].filter(Boolean).join(" ") || "Early Bird diner")}</b><div class="muted">${esc(email || prettyPhone(phone) || p.email || "")}</div></div>
    ${sign}
    <div class="card"><div class="title">${esc(CREDIT)}</div><div class="balance">${money(cr.balance_cents)}</div>
      ${cr.pending_cents ? `<div class="muted small">${money(cr.pending_cents)} pending (available after your visit)</div>` : ""}
      <p class="small muted" style="margin-top:8px">It's used automatically on your next booking fee. ${esc(CREDIT)} has no cash value. <a href="../credit-terms.html">${esc(CREDIT)} terms</a></p>
      ${(cr.credits || []).length ? `<div class="title" style="font-size:16px;margin:14px 0 4px">Expiring soonest</div>${cr.credits.slice(0, 6).map((c) => `<div class="item"><div><span>${esc(c.title)}</span><div class="d">${c.pending ? "Pending" : c.expires_at ? "Use by " + esc(fmtStamp(c.expires_at)) : ""}</div></div><div class="p">${money(c.cents)}</div></div>`).join("")}` : ""}</div>
    <div class="actions"><a class="btn pale" href="#/bookings">Bookings</a><button class="btn grey" id="so" type="button">Sign out</button></div>
    <p class="center small muted" style="margin-top:20px"><a href="../account-deletion.html" style="color:inherit">Delete my account</a></p>`);
  document.getElementById("so").onclick = async () => { await Auth.signOut(); navigate("#/"); };
  const area = document.getElementById("link-area");
  const note = (m, k = "err") => `<div class="msg ${k}" role="alert">${esc(m)}</div>`;
  const ae = document.getElementById("add-email");
  if (ae) ae.onclick = () => {
    area.innerHTML = `<form id="ef" novalidate><label class="field">Email<input id="l-email" type="email" autocomplete="email" inputmode="email" required></label>
      <label class="field">Password<input id="l-pw" type="password" autocomplete="new-password" minlength="8" required><span class="hint">8 or more characters. You'll use it with this email to sign in.</span></label>
      <div id="l-msg"></div><button class="btn" id="l-go" type="submit">Add email</button></form>`;
    document.getElementById("ef").onsubmit = async (e) => {
      e.preventDefault();
      const em = val("l-email"), pw = document.getElementById("l-pw").value, m = document.getElementById("l-msg");
      if (!/^\S+@\S+\.\S+$/.test(em)) return (m.innerHTML = note("Check your email address and try again."));
      if (pw.length < 8) return (m.innerHTML = note("Choose a longer password (8+ characters)."));
      const b = document.getElementById("l-go"); b.disabled = true; b.textContent = "One moment…";
      try { await Auth.addEmail(em, pw); area.innerHTML = note(`We emailed a link to ${em}. Open it to finish: after that you can sign in with this email and password.`, "ok"); }
      catch (err) { b.disabled = false; b.textContent = "Add email"; m.innerHTML = note(err.code === "email_exists" ? "That email already belongs to another Early Bird account." : err.message); }
    };
  };
  const ap = document.getElementById("add-phone");
  if (ap) ap.onclick = () => {
    area.innerHTML = `<form id="pf2" novalidate><label class="field">Phone number</label><div style="display:flex;gap:8px;margin-top:-6px"><select id="l-dial" style="width:96px;margin:0;flex:none">${DIALS.map(([f, d]) => `<option value="${d}">${f} ${d}</option>`).join("")}</select><input id="l-num" type="tel" inputmode="tel" autocomplete="tel-national" placeholder="Phone number" style="margin:0"></div>
      <div id="l-msg" style="margin-top:10px"></div><button class="btn" id="l-go" type="submit" style="margin-top:6px">Send code</button></form>`;
    document.getElementById("pf2").onsubmit = async (e) => {
      e.preventDefault();
      const num = e164(document.getElementById("l-dial").value, val("l-num")), m = document.getElementById("l-msg");
      if (!num) return (m.innerHTML = note("Check your phone number and try again."));
      const b = document.getElementById("l-go"); b.disabled = true; b.textContent = "Sending…";
      try { await Auth.addPhone(num); } catch (err) { b.disabled = false; b.textContent = "Send code"; return (m.innerHTML = note(err.message)); }
      area.innerHTML = `<p class="small">We texted a 6-digit code to ${esc(prettyPhone(num))}.</p>${codeBoxesHtml()}<div id="l-msg" style="margin-top:10px"></div>`;
      let busy = false;
      const ctl = bindCodeBoxes(async (c) => {
        if (busy) return; busy = true;
        try { await Auth.confirmPhoneChange(num, c); await viewAccount(); }
        catch (err) { busy = false; ctl.error(); ctl.clear(); document.getElementById("l-msg").innerHTML = note(err.message); }
      });
    };
  };
}

/* ───────────────────────────── start ───────────────────────────── */
window.addEventListener("hashchange", route);
refreshTestBar();
route();
