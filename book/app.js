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
function loadDeviceId() {
  let id = store.get("eb.web.device");
  if (!id) { id = (crypto.randomUUID ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx".replace(/x/g, () => ((Math.random() * 16) | 0).toString(16))).toLowerCase(); store.set("eb.web.device", id); }
  return id;
}
let deviceId = loadDeviceId();
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
  store: '<path d="M4 10v9h16v-9M3 10l1.500-5h15L21 10c0 1.400-1.100 2.500-2.500 2.500S16 11.400 16 10c0 1.400-1.100 2.500-2.500 2.500h-3C9.100 12.500 8 11.400 8 10c0 1.400-1.100 2.500-2.500 2.500S3 11.400 3 10z"/><path d="M10 19v-4h4v4"/>',
  locate: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.500"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
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
  // Stay signed in (owner, 21 Nov: "have cookies so they stay signed in"): the session lives in this browser's local storage
  // until the diner signs out. The short-lived access token is renewed quietly with the refresh token whenever it is near
  // its end; one tab renews at a time (Web Locks) and every tab re-reads the stored session, so two tabs never spend the
  // same refresh token. The sign-in screen only shows once Supabase has refused the refresh token itself.
  async token() {
    const s = this.session();
    if (!s) return null;
    if (s.expires_at * 1000 - Date.now() > 60000) return s.access_token;
    if (!this._renewing) {
      const renew = () => this._renew().finally(() => { this._renewing = null; });
      this._renewing = navigator.locks?.request ? navigator.locks.request("eb.web.renew", renew) : renew();
    }
    return this._renewing;
  },
  async _renew() {
    const s = this.session(); // re-read: another tab may have renewed it while this one waited for the lock
    if (!s) return null;
    if (s.expires_at * 1000 - Date.now() > 60000) return s.access_token;
    try {
      const n = await this.call("token?grant_type=refresh_token", { refresh_token: s.refresh_token });
      this.save(n);
      return n.access_token;
    } catch (e) {
      if (!e.status || e.status >= 500 || e.status === 429) return s.access_token; // offline or busy: keep the session, try later
      if (this.session()?.refresh_token === s.refresh_token) this.save(null); // refused for good: signed out
      return this.session()?.access_token || null;
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
  // Sign out leaves nothing of this diner in the browser: the session, any half-finished payment and the device id
  // (a new one is made on the next booking) are removed, and the refresh token is revoked on the server.
  async signOut() {
    const s = this.session();
    this.save(null);
    sstore.set("eb.web.pending", null);
    store.set("eb.web.device", null); deviceId = loadDeviceId();
    store.set("eb.web.invite", null);
    if (s) fetch(`${CFG.url}/auth/v1/logout`, { method: "POST", headers: { apikey: CFG.key, Authorization: `Bearer ${s.access_token}` } }).catch(() => {});
  },
};
// Other tabs: signing in or out in one tab updates the others; a renewed token alone changes nothing on screen.
addEventListener("storage", (e) => {
  if (e.key !== SKEY && e.key !== null) return;
  const who = (v) => { try { return JSON.parse(v || "null")?.user?.id || null; } catch { return null; } };
  if (e.key === null || who(e.oldValue) !== who(e.newValue)) route();
});
// Coming back to a tab: renew the session quietly so the next tap doesn't wait on it.
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && Auth.session()) Auth.token(); });
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
  const token = await Auth.token(); // visitors (not signed in) browse with the publishable key
  const res = await fetch(`${CFG.url}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: CFG.key, Authorization: `Bearer ${token || CFG.key}`, "Content-Type": "application/json", "Content-Profile": "api", "Accept-Profile": "api" },
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
    // No guessed city (owner, 21 Nov: "the website auto goes to nyc but i need it to be asking for location or select where
    // you are looking for"): the saved choice, else none, and Home asks.
    S.city = S.cities.find((c) => c.slug === saved) || null;
  }
  return S.cities;
}
const setCity = (c) => {
  S.city = c || null; store.set("eb.web.city", c ? c.slug : null);
  const sel = document.getElementById("hcity"); // the desktop header box, drawn before the page knew the city
  if (sel && c) { [...sel.options].forEach((o) => { if (!o.value) o.remove(); }); sel.value = c.slug; }
};
const kmBetween = (a, b, c, d) => { const r = (x) => (x * Math.PI) / 180, h = Math.sin(r(c - a) / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(r(d - b) / 2) ** 2; return 12742 * Math.asin(Math.sqrt(h)); };
const nearestCity = (lat, lng) => (S.cities || []).reduce((best, c) => (!best || kmBetween(lat, lng, c.lat, c.lng) < kmBetween(lat, lng, best.lat, best.lng) ? c : best), null);
// One blurred photo per city behind the header (img/areas/CREDITS.md has each photo's source, author and licence).
const AREA_PHOTOS = { "new-york": { by: "Kidfly182", lic: "CC0" }, "los-angeles": { by: "Michael Chusid", lic: "CC0" } };
const areaPhoto = (c) => (c && AREA_PHOTOS[c.slug] ? { url: `../img/areas/${c.slug}.jpg`, ...AREA_PHOTOS[c.slug] } : null);
const heroAttrs = (c) => { const p = areaPhoto(c); return p ? ` hasphoto" style="--areaimg:url('${p.url}')` : ""; };
const photoCredit = (c) => { const p = areaPhoto(c); return p ? `<a class="photocredit" href="../img/areas/CREDITS.md" target="_blank" rel="noopener">Photo: ${esc(p.by)}, ${esc(p.lic)}</a>` : ""; };
// The offer, for both audiences, in a few words (no fee basis: the diner sees the actual fee when booking).
const offerHtml = () => `<ul class="offer">
  <li>${ic("fork")}<span><b>Diners</b> get 50% off the food bill and pay a small booking fee per diner.</span></li>
  <li>${ic("store")}<span><b>Restaurants</b> list for free. <a href="../#restaurants">How it works</a></span></li></ul>`;
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
  el.hidden = path === "/book" || path === "/signin" || path.startsWith("/r/"); // the booking sheet and the restaurant page are pushed screens in the app: no tab bar
  const on = path === "/" || path.startsWith("/r/") || path === "/book" ? "home" : path.startsWith("/booking") ? "bookings" : path === "/account" ? "account" : "";
  const tab = (k, href, icon, label) => `<a href="${href}" class="${on === k ? "on" : ""}" ${on === k ? 'aria-current="page"' : ""}>${ic(icon)}${label}</a>`;
  el.innerHTML = tab("home", "#/", "home", "Home") + tab("bookings", "#/bookings", "cal", "Bookings") + (signedIn ? tab("account", "#/account", "person", "Profile") : tab("account", "#/signin", "person", "Sign in"));
}
// Desktop (1024 px and wider) follows the First Table-style website layout (FIRST_TABLE_WEB_FLOW.md): a white header with
// search and city, a navy footer, wide pages. Phones keep the app-style layout and the floating tab bar.
// Phones get the app's own screens (owner, 21 Nov: "the ui needs to feel exact same"): no logo header, the app's floating
// Home / Bookings / Profile pill bar, the app's restaurant page and booking sheet. Desktop (1024 px+) keeps the wide
// website layout with the app's pill-style nav buttons.
const DESK_MQ = matchMedia("(min-width: 1024px)");
const isDesk = () => DESK_MQ.matches;
DESK_MQ.addEventListener?.("change", () => route());
async function drawChrome(path) {
  const desk = isDesk(), signedIn = !!Auth.session(), minimal = path === "/book";
  document.body.classList.toggle("desk", desk);
  const head = document.getElementById("dhead"), foot = document.getElementById("dfoot");
  head.hidden = foot.hidden = !desk;
  if (!desk) return;
  const legal = `<div class="df-legal"><a href="../terms.html">Terms</a><a href="../privacy.html">Privacy</a><a href="../credit-terms.html">${esc(CREDIT)} terms</a><a href="../support.html">Support</a><span>© 2026 Early Bird</span></div>`;
  if (minimal) {
    head.innerHTML = ""; head.hidden = true; // the booking page is a sheet, like the app: no header
    foot.innerHTML = `<div class="df-in df-min">${legal}</div>`;
    return;
  }
  const on = (k) => ((k === "home" && (path === "/" || path.startsWith("/r/"))) || (k === "bookings" && path.startsWith("/booking")) || (k === "account" && path === "/account") ? ' class="on"' : "");
  const pill = (k, href, icon, label, cls = "") => `<a href="${href}" class="hpill ${cls}"${on(k)}>${ic(icon)}<span>${label}</span></a>`;
  head.innerHTML = `<div class="dh-in">
    ${`<div class="hsearch" id="hsearch">${ic("search")}<input id="hs" type="search" placeholder="Search restaurants" autocomplete="off" aria-label="Search restaurants"><div id="hs-list" class="hs-list" role="listbox" hidden></div></div>
      <label class="hcity">${ic("pin")}<select id="hcity" aria-label="City"><option>City</option></select></label>`}
    <nav class="hnav" aria-label="Main">${pill("home", "#/", "home", "Home")}${pill("bookings", signedIn ? "#/bookings" : "#/signin", "cal", "Bookings")}${signedIn ? pill("account", "#/account", "person", "Profile") : pill("account", "#/signin", "person", "Sign in")}
      <a class="hpill ghost" href="../#how">${ic("help")}<span>How it works</span></a></nav></div>`;
  foot.innerHTML = `<div class="df-in"><div class="df-cols">
      <div><h3>Diners</h3><p>Book an early table and get 50% off the food bill. A small booking fee holds it.</p><a class="dbtn" href="#/">Find a table</a></div>
      <div><h3>Restaurants</h3><p>List your early tables on Early Bird for free and fill your quiet hours.</p><a class="dbtn ghost" href="../restaurant-terms.html">Restaurant terms</a></div>
      <div><h3>Get the app</h3><p>Early Bird for iPhone: your bookings, codes and ${esc(CREDIT)} in your pocket.</p><a class="dbtn ghost" href="../?about#get">Learn more</a></div>
    </div>${legal}</div>`;
  // city picker
  loadCities().then(() => {
    const sel = document.getElementById("hcity"); if (!sel) return;
    sel.innerHTML = (S.city ? "" : '<option value="" selected>Choose a city</option>') + S.cities.map((c) => `<option value="${esc(c.slug)}" ${c.slug === S.city?.slug ? "selected" : ""}>${esc(c.name)}</option>`).join("");
    sel.onchange = () => { const c = S.cities.find((x) => x.slug === sel.value); if (!c) return; setCity(c); go("/", { city: c.slug }); };
  }).catch(() => {});
  // type-ahead search: restaurant names (api.suggest), opens the restaurant page
  const hs = document.getElementById("hs"), list = document.getElementById("hs-list");
  let t = null, seq = 0;
  const close = () => { list.hidden = true; };
  hs.addEventListener("input", () => {
    clearTimeout(t);
    const q = hs.value.trim();
    if (q.length < 2) return close();
    t = setTimeout(async () => {
      const my = ++seq;
      const rows = await rpc("suggest", { p_q: q, p_lat: S.city?.lat ?? null, p_lng: S.city?.lng ?? null }).catch(() => []);
      if (my !== seq) return;
      const re = new RegExp("(" + q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "ig");
      list.innerHTML = rows.length ? rows.map((r) => `<a role="option" href="#/r/id:${esc(r.id)}"><b>${esc(r.name).replace(re, "<mark>$1</mark>")}</b><span>${esc(r.area || "")}</span></a>`).join("")
        : `<div class="hs-empty">No restaurants match “${esc(q)}”.</div>`;
      list.hidden = false;
    }, 180);
  });
  hs.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { close(); hs.blur(); }
    if (e.key === "Enter") { e.preventDefault(); const first = list.querySelector("a"); if (first) location.hash = first.getAttribute("href"); else go("/", { city: S.city?.slug || "", q: hs.value.trim() }); close(); }
  });
  list.addEventListener("click", () => { close(); hs.value = ""; });
  document.addEventListener("click", (e) => { if (!e.target.closest("#hsearch")) close(); });
}
const legalLinks = `<div class="legal"><a href="../terms.html">Terms</a><a href="../privacy.html">Privacy</a><a href="../credit-terms.html">${esc(CREDIT)} terms</a><a href="../support.html">Support</a></div>`;
const topbar = (right = "") => `<div class="wash"><div class="col"><div class="topbar${right ? "" : " empty"}">${right}</div></div></div>`;
const showPage = (inner, { wash = true, right = "", size = "" } = {}) => {
  if (isDesk()) { APP.innerHTML = `<div class="col ${size || (Auth.session() ? "" : "narrow")}">${inner}</div>`; return; }
  APP.innerHTML = (wash ? topbar(right) : "") + `<div class="col">${inner}${legalLinks}</div>`;
};
// A desktop page that brings its own full-width sections (hero, gallery): no wrapping column.
const showRaw = (html) => { APP.innerHTML = html; };
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
/* ───────────────────────────── invites and codes (0131_codes_and_referrals) ───────────────────────────── */
// A friend's invite link (https://eatearlybird.com/r/<code>, mapped by 404.html to #/invite/<code>) keeps the code in this
// browser through sign-up or sign-in, then redeems it once the diner is signed in; the stored code is then removed.
const IKEY = "eb.web.invite";
let claiming = null;
function claimInvite(quiet = false) {
  const code = store.get(IKEY);
  if (!code || claiming || !Auth.session()) return claiming;
  claiming = rpc("redeem_code", { p_code: code, p_device: deviceId })
    .then((r) => { store.set(IKEY, null); if (r?.message && !quiet) toast(r.message); return r; })
    .catch((e) => { if (e.code !== "offline") store.set(IKEY, null); return null; })
    .finally(() => { claiming = null; });
  return claiming;
}
async function viewInvite(raw) {
  setTitle("You're invited");
  const code = String(raw || "").trim();
  const p = await rpc("code_preview", { p_code: code }).catch(() => ({ valid: false }));
  const app = `<a class="btn grey" href="earlybird://r/${encodeURIComponent(code)}">Open in the Early Bird app</a><p class="small muted center">If you have the app on this phone.</p>`;
  if (!p?.valid) {
    store.set(IKEY, null);
    return plainPage(`<div class="gate"><h1 class="display">This invite link isn't valid</h1><p class="muted">Check the link with the friend who sent it. You can still find an early table at half price.</p></div>
      <div class="invite-actions"><a class="btn" href="#/">Find a table</a></div>`);
  }
  store.set(IKEY, p.code || code);
  const head = `<div class="gate"><div class="invite-bird">${ic("bird")}</div><h1 class="display">${esc(p.from_name || "A friend")} invited you</h1>
    <p class="invite-msg">${esc(p.message || (p.friend_fee_cap_cents ? `Your first booking fee is on us (up to ${money(p.friend_fee_cap_cents)})` : "Your first booking fee is on us"))}</p>
    <p class="muted">Book an early table and get 50% off the food bill.</p></div>`;
  if (Auth.session()) {
    plainPage(`${head}<p class="loading center">Adding it to your account…</p>`);
    const r = await claimInvite(true);
    const k = r?.ok ? "ok" : "err";
    return plainPage(`${head}${r?.message ? `<div class="msg ${k}" role="status">${esc(r.message)}</div>` : ""}<div class="invite-actions"><a class="btn" href="#/">Find a table</a>${app}</div>`);
  }
  plainPage(`${head}<div class="invite-actions"><a class="btn" href="#/signin?next=${encodeURIComponent("#/")}">Sign up to claim it</a><a class="btn pale" href="#/">Look around first</a>${app}</div>
    <p class="small muted center">It's added when you sign in or create your account on this browser. For new Early Bird accounts.</p>`);
}
async function route() {
  if (view.cleanup) { try { await view.cleanup(); } catch { /* ignore */ } view = { cleanup: null }; }
  const { path, q } = parseHash();
  window.scrollTo(0, 0);
  drawTabs(path);
  drawChrome(path);
  APP.innerHTML = '<div class="col"><p class="loading">Loading…</p></div>';
  try {
    // Visitors can browse and open restaurant pages without an account. Booking, "My bookings" and Profile need one:
    // those addresses show the sign-in screen and open again after sign-in.
    if (path.startsWith("/invite/")) return await viewInvite(decodeURIComponent(path.slice(8)));
    if (Auth.session() && store.get(IKEY)) claimInvite();
    const needsAccount = path === "/book" || path === "/bookings" || path.startsWith("/booking/") || path === "/account" || new URLSearchParams(location.search).get("pay");
    if (!Auth.session() && (needsAccount || path === "/signin")) {
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
    if (e.code === "not_signed_in") {
      if (Auth.session()) { Auth.save(null); return route(); } // the session ran out
      return viewSignIn({ next: location.hash || "#/" });      // the server only lets signed-in people see this
    }
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
async function loadAvail(ids, meal, diners, from = null) {
  const out = {};
  const rows = await rpc("availability", { p_venues: ids, p_meal: meal, p_days: 8, p_diners: diners, ...(from ? { p_from: from } : {}) });
  rows.forEach((r) => (out[r.venue_id] = r));
  return out;
}
const dayLabel = (d, tz) => `${d === todayAt(tz) ? "Today" : fmtDate(d, { weekday: "short" })}<b>${fmtDate(d, { day: "numeric", month: "short" })}</b>`;
function checkoutHref(v, deal, date, time, meal, diners) {
  return `#/book?${new URLSearchParams({ v: v.slug, deal, date, time, meal, diners }).toString()}`;
}

/* ───────────────────────────── Home: search, quick search, results ───────────────────────────── */
const H = { q: "", near: null, cuisines: [], areas: [], prices: [], sort: "featured", date: "", map: false, meal: "dinner", diners: 2, rows: [], offset: 0, more: false, loading: false };
const SORTS = [["featured", "Featured first"], ["distance", "Nearest first"], ["highest_rated", "Highest rated"], ["new", "Newest"], ["alphabetical", "A to Z"]];
const list = (v) => String(v || "").split("|").filter(Boolean);
function homeParams(extra = {}) {
  const p = { city: S.city.slug, meal: H.meal, diners: H.diners, ...(H.q ? { q: H.q } : {}), ...(H.cuisines.length ? { c: H.cuisines.join("|") } : {}),
    ...(H.areas.length ? { a: H.areas.join("|") } : {}), ...(H.prices.length ? { p: H.prices.join("|") } : {}), ...(H.sort !== "featured" ? { sort: H.sort } : {}),
    ...(H.date ? { date: H.date } : {}), ...(H.map ? { map: 1 } : {}), ...(H.near ? { near: `${H.near.lat},${H.near.lng}` } : {}), ...extra };
  Object.keys(p).forEach((k) => (p[k] === "" || p[k] == null) && delete p[k]);
  return p;
}
// "Near me": the browser's location (asked only when the button is pressed), rounded to about 100 m, kept in the address.
function useNearMe() {
  if (H.near) return go("/", homeParams({ near: "" }));
  if (!navigator.geolocation) return toast("Your browser can't share your location. Pick a city instead.");
  toast("Finding restaurants near you…");
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude, lng = pos.coords.longitude;
      loadCities().then(() => { if (!S.city || kmBetween(lat, lng, S.city.lat, S.city.lng) > 80) setCity(nearestCity(lat, lng)); go("/", homeParams({ near: `${lat.toFixed(3)},${lng.toFixed(3)}` })); });
    },
    () => toast("Location is off for this site. Allow it in your browser, or pick a city."),
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
}
function toast(text) {
  let t = document.getElementById("toast");
  if (!t) { t = document.createElement("div"); t.id = "toast"; t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
  t.textContent = text; t.classList.add("on"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("on"), 3500);
}
const distTxt = (v) => (H.near && v.distance_km != null ? `${(v.distance_km * 0.621).toFixed(v.distance_km < 16 ? 1 : 0)} mi` : "");
const nearChip = () => `<button class="pill near" type="button" id="nearme" aria-pressed="${!!H.near}">${ic("pin")}${H.near ? "Near me ✓" : "Near me"}</button>`;
// First visit, or no city chosen: ask where they're looking. "Use my location" asks the browser only when pressed;
// the cities (and their neighbourhoods) come from the backend.
function viewPickArea() {
  setTitle("Choose a city");
  const cities = (S.cities || []).filter((c) => (c.venues ?? 1) > 0);
  showPage(`<section class="pickhero"><h1 class="display">Where are you looking?</h1>
      <p class="muted">See restaurants with early tables near you, or pick a city.</p>
      <button class="btn" type="button" id="pick-near">${ic("locate")}Use my location</button></section>
    <div class="picklist" role="list">${cities.map((c) => `<a role="listitem" class="pickcity${heroAttrs(c)}" href="#/?city=${esc(c.slug)}"><b>${esc(c.name)}</b><span>${esc((c.areas || []).slice(0, 4).map((a) => a.name).join(" · "))}</span></a>`).join("")}</div>
    ${offerHtml()}`, { wash: false, size: "pick" });
  document.getElementById("pick-near").onclick = useNearMe;
}
async function viewHome(q) {
  setTitle("");
  await Promise.all([loadCities(), loadConfig()]);
  if (q.city) { const c = S.cities.find((x) => x.slug === q.city); if (c) setCity(c); }
  const nm = /^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/.exec(q.near || ""); H.near = nm ? { lat: +nm[1], lng: +nm[2] } : null;
  if (!S.city && H.near) setCity(nearestCity(H.near.lat, H.near.lng));
  if (!S.city) return viewPickArea();
  H.q = q.q || ""; H.cuisines = list(q.c); H.areas = list(q.a); H.prices = list(q.p).map(Number).filter((n) => n >= 1 && n <= 4);
  H.sort = SORTS.some(([k]) => k === q.sort) ? q.sort : "featured"; H.date = /^\d{4}-\d{2}-\d{2}$/.test(q.date || "") ? q.date : ""; H.map = q.map === "1";
  H.meal = ["breakfast", "lunch", "dinner"].includes(q.meal) ? q.meal : H.meal;
  H.diners = Math.min(Math.max(Number(q.diners) || H.diners, 1), S.config.max_party || 12);
  if (isDesk()) return viewHomeDesk();
  H.cuisine = H.cuisines[0] || "";
  const params = () => ({ city: S.city.slug, meal: H.meal, diners: H.diners, ...(H.q ? { q: H.q } : {}), ...(H.cuisine ? { c: H.cuisine } : {}), ...(H.near ? { near: `${H.near.lat},${H.near.lng}` } : {}) });
  const maxD = Math.min(S.config.max_party || 12, 12);
  showPage(`
    <section class="mhero${heroAttrs(S.city)}"><div class="mtop"><label class="pinsel">${ic("pin")}<select id="f-city" aria-label="City">${S.cities.map((c) => `<option value="${esc(c.slug)}" ${c.slug === S.city.slug ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></label><button class="iconbtn" type="button" id="focus-q" aria-label="Search">${ic("search")}</button></div>
      <h1 class="display">Ready to get <span class="gold">50% off</span> your food bill?</h1>${offerHtml()}${photoCredit(S.city)}</section>
    <form id="findform" role="search">
      <div class="searchbar">
        <label>${ic("fork")}<select id="f-meal" aria-label="Meal">${["breakfast", "lunch", "dinner"].map((m) => `<option value="${m}" ${m === H.meal ? "selected" : ""}>${m[0].toUpperCase() + m.slice(1)}</option>`).join("")}</select>
          <span class="sep">•</span><select id="f-diners" aria-label="Diners">${Array.from({ length: maxD }, (_, i) => i + 1).map((n) => `<option value="${n}" ${n === H.diners ? "selected" : ""}>${n} ${n === 1 ? "diner" : "diners"}</option>`).join("")}</select></label>
        <button type="submit" aria-label="Search">${ic("arrow")}</button>
      </div>
      <div class="textsearch">${ic("search")}<input id="f-q" type="search" placeholder="Search restaurants or cuisines" aria-label="Search" value="${esc(H.q)}" autocomplete="off"></div>
    </form>
    <div class="chiprow scrollx" id="chips" role="group" aria-label="Near me and cuisine" style="margin:4px 0 16px">${nearChip()}</div>
    <div class="sec"><h2 id="reshead">${H.cuisine ? esc(H.cuisine) + (H.near ? " near you" : " in " + esc(S.city.name)) : H.near ? "Near you" : "Most popular in " + esc(S.city.name)}</h2></div>
    <div id="grid"></div>
    <div style="margin-top:8px"><button class="btn pale" id="more" hidden>Show more</button></div>
    <div class="card help" style="margin-top:18px"><div>${ic("help")}</div><div><div class="title">How do I get 50% off?</div><div class="muted">See how Early Bird works</div><a class="learn" href="../#how">Learn more</a></div></div>`,
  { wash: false });
  document.getElementById("focus-q").onclick = () => { const i = document.getElementById("f-q"); i.scrollIntoView({ block: "center", behavior: "smooth" }); i.focus({ preventScroll: true }); };
  document.getElementById("findform").onsubmit = (e) => { e.preventDefault(); H.q = val("f-q"); go("/", { ...params(), meal: val("f-meal"), diners: val("f-diners"), ...(val("f-q") ? { q: val("f-q") } : { q: "" }) }); };
  document.getElementById("f-city").onchange = (e) => { const { near, ...rest } = params(); go("/", { ...rest, city: e.target.value }); };
  document.getElementById("f-meal").onchange = (e) => go("/", { ...params(), meal: e.target.value });
  document.getElementById("f-diners").onchange = (e) => go("/", { ...params(), diners: e.target.value });
  document.getElementById("more").onclick = () => loadResults(true);
  document.getElementById("nearme").onclick = useNearMe;
  const chipsP = rpc("cuisines", { p_lat: S.city.lat, p_lng: S.city.lng, p_radius_km: S.city.radius_km || 25 }).catch(() => []);
  await loadResults(false);
  chipsP.then((cs) => {
    const el = document.getElementById("chips");
    if (!el) return;
    let names = cs.map((c) => c.name);
    if (!names.length) names = [...new Set(H.rows.flatMap((r) => r.cuisines || []))].sort(); // no cuisine list yet: use what the results show
    if (H.cuisine && !names.includes(H.cuisine)) names.unshift(H.cuisine);
    el.innerHTML = nearChip() + names.slice(0, 14).map((n) => `<button class="pill" type="button" aria-pressed="${n === H.cuisine}" data-c="${esc(n)}">${esc(n)}</button>`).join("");
    document.getElementById("nearme").onclick = useNearMe;
    el.onclick = (e) => {
      const b = e.target.closest("[data-c]"); if (!b) return;
      const p = params(); if (b.dataset.c === H.cuisine) delete p.c; else p.c = b.dataset.c;
      go("/", p);
    };
  }).catch(() => {});
}
async function loadResults(append) {
  const grid = document.getElementById("grid");
  if (!grid || (append && (H.loading || !H.more))) return;
  H.loading = true;
  const seq = append ? H.seq : (H.seq = (H.seq || 0) + 1); // a newer search wins over an older one still loading
  if (!append) { H.rows = []; H.offset = 0; grid.innerHTML = '<p class="loading">Finding tables…</p>'; }
  try {
    const rows = await rpc("search_venues", {
      p_query: H.q || null, p_lat: H.near ? H.near.lat : S.city.lat, p_lng: H.near ? H.near.lng : S.city.lng, p_radius_km: H.near ? 15 : S.city.radius_km || 25,
      p_cuisines: H.cuisines.length ? H.cuisines : null, p_areas: H.areas.length ? H.areas : null, p_price: H.prices.length ? H.prices : null,
      p_limit: 24, p_offset: H.offset, p_sort: H.near && H.sort === "featured" ? "distance" : H.sort || "featured",
    });
    const avail = rows.length ? await loadAvail(rows.map((r) => r.id), H.meal, H.diners, H.date || null).catch(() => ({})) : {};
    if (!document.getElementById("grid") || seq !== H.seq) return;
    rows.forEach((r) => (r._avail = avail[r.id]));
    H.rows = H.rows.concat(rows);
    H.offset += rows.length;
    H.more = rows.length === 24;
    const desk = isDesk();
    grid.innerHTML = H.rows.length ? H.rows.map(desk ? resultHtmlDesk : resultHtml).join("")
      : H.near ? `<div class="card center"><b>No Early Bird restaurants near you yet.</b><p class="muted" style="margin:6px 0 12px">We're in ${esc(S.cities.map((c) => c.name).join(" and "))} for now.</p><a class="btn pale" href="#/?${new URLSearchParams(homeParams({ near: "" }))}">Show all of ${esc(S.city.name)}</a></div>`
      : `<div class="card center muted">No restaurants found${H.q ? ` for “${esc(H.q)}”` : ""}. Try fewer filters, another search or another city.</div>`;
    const more = document.getElementById("more"); if (more) more.hidden = !H.more;
    const cnt = document.getElementById("count"); if (cnt) cnt.textContent = H.rows.length ? `${H.rows.length}${H.more ? "+" : ""} restaurant${H.rows.length === 1 && !H.more ? "" : "s"}` : "";
    if (H.map) drawMap();
  } finally { H.loading = false; }
}
function thumbHtml(v) {
  const img = v.photo || (v.dish_photos || [])[0];
  return `<div class="thumb">${esc((v.name || "?").charAt(0))}${img ? `<img src="${esc(img)}" alt="" loading="lazy" onerror="this.remove()">` : ""}</div>`;
}
function resultHtml(v) {
  const d = v.deal, a = v._avail;
  const href = `#/r/${esc(v.slug)}?meal=${H.meal}&diners=${H.diners}`;
  const sub = [distTxt(v), v.area, cuisineText(v)].filter(Boolean).join(" • ");
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
    ${d ? `<div class="chips chiprow"><span class="pill">${ic("card")}${m0(d.fee_per_diner_cents)} booking fee</span><span class="pill">${ic("bird")}+${m0(S.config.reward_per_booking_cents || 0)} credit</span></div>` : ""}
    ${cols ? `<div class="days">${cols}</div>` : d ? `<p class="muted small" style="padding:12px 18px 0">No ${H.meal} tables listed.</p>` : ""}</article>`;
}


/* ───────────────────────────── desktop list (the First Table-style region page) ───────────────────────────── */
// Ratings (0105_ratings): v.rating / v.review_count count verified visits only, one per person; the reviews list can be
// longer (unverified reviews too) and can exist while v.rating is null.
const visitsTxt = (n) => `${n} verified visit${n === 1 ? "" : "s"}`;
const revExtras = (r, v) => `${r.dish ? `<div class="muted small">Had the ${esc(r.dish)}</div>` : ""}${r.reply?.text ? `<div class="revreply"><b>Reply from ${esc(v.name)}</b><p>${esc(r.reply.text)}</p></div>` : ""}`;
const stars5 = (r) => { const n = Math.round(Number(r) || 0); return `<span class="stars" aria-label="${Number(r).toFixed(1)} out of 5">${"★".repeat(n)}<span class="off">${"★".repeat(5 - n)}</span></span>`; };
const MEALS = ["breakfast", "lunch", "dinner"];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
async function viewHomeDesk() {
  const city = S.city, maxD = Math.min(S.config.max_party || 12, 12);
  const today = todayAt(city.timezone);
  const dates = Array.from({ length: Math.min(S.config.max_days_ahead || 14, 14) }, (_, i) => { const d = dateObj(today); d.setUTCDate(d.getUTCDate() + i); return d.toISOString().slice(0, 10); });
  const filterOn = H.cuisines.length || H.areas.length || H.prices.length || H.q;
  showRaw(`
    <section class="dhero${heroAttrs(city)}"><div class="wide dhero-in">
      <div><div class="crumbs"><a href="#/">Early Bird</a><span>/</span>${esc(city.name)}</div>
        <h1>${H.near ? "Restaurants near you" : `${esc(city.name)} restaurants`}</h1><p>Dine early and save 50% on your food bill</p></div>
      <div class="offerbox">${offerHtml()}</div>
    </div>${photoCredit(city)}</section>
    <div class="wide">
      <div class="fbar" id="fbar">
        <label>${ic("fork")}<select id="f-meal" aria-label="Meal">${MEALS.map((m) => `<option value="${m}" ${m === H.meal ? "selected" : ""}>${cap(m)}</option>`).join("")}</select></label>
        <label>${ic("cal")}<select id="f-date" aria-label="Date"><option value="">All dates</option>${dates.map((d) => `<option value="${d}" ${d === H.date ? "selected" : ""}>${d === today ? "Today, " : ""}${esc(fmtDate(d, { weekday: "short", day: "numeric", month: "short" }))}</option>`).join("")}</select></label>
        <label>${ic("person")}<select id="f-diners" aria-label="Diners">${Array.from({ length: maxD }, (_, i) => i + 1).map((n) => `<option value="${n}" ${n === H.diners ? "selected" : ""}>${n} ${n === 1 ? "diner" : "diners"}</option>`).join("")}</select></label>
      </div>
      <div class="lcols">
        <div class="lmain">
          <div class="qchips" id="qchips" role="group" aria-label="Near me and cuisine">${nearChip()}</div>
          <div class="sortrow"><span id="count" class="muted"></span>${H.q ? `<span class="qchip">“${esc(H.q)}” <a href="#/?${new URLSearchParams(homeParams({ q: "" }))}" aria-label="Clear search">×</a></span>` : ""}
            <label>Sort by <select id="f-sort">${SORTS.map(([k, l]) => `<option value="${k}" ${k === H.sort ? "selected" : ""}>${l}</option>`).join("")}</select></label></div>
          ${H.map ? `<div id="map" class="mapbox"><p class="loading" style="padding:20px">Loading the map…</p></div><div id="grid" hidden></div>` : `${filterOn || H.near ? "" : '<div id="newarr" class="newarr"></div>'}<div id="grid"></div><div id="sentinel"></div><button class="btn pale" id="more" hidden style="margin-top:10px">Show more</button>`}
          <section class="howband"><h2>Enjoy 50% off your food bill</h2><ol>
            <li><b>Find a restaurant</b><span>Pick an early time that suits you.</span></li>
            <li><b>Book the early table</b><span>Pay a small booking fee per diner to hold it.</span></li>
            <li><b>Enjoy 50% off food</b><span>Show your code when you order. Drinks are full price.</span></li></ol></section>
        </div>
        <aside class="lside">
          <button class="btn outline" id="mapbtn" type="button">${ic(H.map ? "book" : "pin")} ${H.map ? "View list" : "View map"}</button>
          <div class="fgroup" id="g-cuisine"><h3>Cuisine</h3><div class="fl" id="fl-cuisine"><p class="loading">…</p></div></div>
          <div class="fgroup"><h3>Area</h3><input type="search" id="area-q" placeholder="Search areas" aria-label="Search areas"><div class="fl" id="fl-area">${(city.areas || []).map((a) => `<label class="ck"><span>${esc(a.name)}</span><input type="checkbox" data-area="${esc(a.name)}" ${H.areas.includes(a.name) ? "checked" : ""}></label>`).join("") || '<p class="muted small">No areas yet.</p>'}</div></div>
          <div class="fgroup"><h3>Price</h3><div class="fl">${[1, 2, 3, 4].map((n) => `<label class="ck"><span>${"$".repeat(n)}</span><input type="checkbox" data-price="${n}" ${H.prices.includes(n) ? "checked" : ""}></label>`).join("")}</div></div>
          ${filterOn ? `<button class="linklike" id="clear" type="button">Clear filters</button>` : ""}
        </aside>
      </div>
      ${(city.areas || []).length ? `<section class="areas"><h2>Areas in ${esc(city.name)}</h2><div class="areacols">${city.areas.map((a) => `<a href="#/?${new URLSearchParams({ city: city.slug, a: a.name })}">${esc(a.name)}</a>`).join("")}</div></section>` : ""}
    </div>`);
  const nav = (extra) => go("/", homeParams(extra));
  document.getElementById("f-meal").onchange = (e) => nav({ meal: e.target.value });
  document.getElementById("f-date").onchange = (e) => nav({ date: e.target.value });
  document.getElementById("f-diners").onchange = (e) => nav({ diners: e.target.value });
  document.getElementById("f-sort").onchange = (e) => nav({ sort: e.target.value });
  document.getElementById("mapbtn").onclick = () => nav({ map: H.map ? "" : 1 });
  document.getElementById("nearme").onclick = useNearMe;
  const clr = document.getElementById("clear"); if (clr) clr.onclick = () => go("/", { city: city.slug, meal: H.meal, diners: H.diners });
  document.querySelectorAll("[data-area]").forEach((c) => (c.onchange = () => nav({ a: [...document.querySelectorAll("[data-area]:checked")].map((x) => x.dataset.area).join("|") })));
  document.querySelectorAll("[data-price]").forEach((c) => (c.onchange = () => nav({ p: [...document.querySelectorAll("[data-price]:checked")].map((x) => x.dataset.price).join("|") })));
  document.getElementById("area-q").oninput = (e) => { const t = e.target.value.toLowerCase(); document.querySelectorAll("#fl-area .ck").forEach((l) => (l.hidden = !l.textContent.toLowerCase().includes(t))); };
  const cuisinesP = rpc("cuisines", { p_lat: city.lat, p_lng: city.lng, p_radius_km: city.radius_km || 25 }).catch(() => []);
  const drawCuisines = (cs) => {
    const el = document.getElementById("fl-cuisine"); if (!el) return;
    let names = cs.map((c) => c.name);
    if (!names.length) names = [...new Set(H.rows.flatMap((r) => r.cuisines || []))].sort(); // no cuisine list yet: use what the results show
    H.cuisines.forEach((c) => names.includes(c) || names.unshift(c));
    // one-tap cuisine chips above the list (the sidebar keeps the full list)
    const qc = document.getElementById("qchips");
    if (qc) {
      qc.innerHTML = nearChip() + names.slice(0, 9).map((n) => `<button class="pill" type="button" data-qc="${esc(n)}" aria-pressed="${H.cuisines.includes(n)}">${esc(n)}</button>`).join("");
      document.getElementById("nearme").onclick = useNearMe;
      qc.querySelectorAll("[data-qc]").forEach((b) => (b.onclick = () => { const n = b.dataset.qc; const set = H.cuisines.includes(n) ? H.cuisines.filter((x) => x !== n) : [...H.cuisines, n]; nav({ c: set.join("|") }); }));
    }
    el.innerHTML = names.map((n, i) => `<label class="ck" ${i >= 10 && !H.cuisines.includes(n) ? "data-extra hidden" : ""}><span>${esc(n)}</span><input type="checkbox" data-cuisine="${esc(n)}" ${H.cuisines.includes(n) ? "checked" : ""}></label>`).join("")
      + (names.length > 10 ? `<button class="linklike small" type="button" id="cu-more">Show all ${names.length}</button>` : "");
    el.querySelectorAll("[data-cuisine]").forEach((c) => (c.onchange = () => nav({ c: [...el.querySelectorAll("[data-cuisine]:checked")].map((x) => x.dataset.cuisine).join("|") })));
    const m = document.getElementById("cu-more"); if (m) m.onclick = () => { el.querySelectorAll("[data-extra]").forEach((x) => (x.hidden = false)); m.remove(); };
    if (!names.length) el.innerHTML = '<p class="muted small">No cuisines to filter yet.</p>';
  };
  if (!H.map && !filterOn && !H.near) rpc("search_venues", { p_lat: city.lat, p_lng: city.lng, p_radius_km: city.radius_km || 25, p_sort: "new", p_limit: 4 }).then((rows) => {
    const el = document.getElementById("newarr"); if (!el || !rows.length) return;
    el.innerHTML = `<div class="sechead"><h2>New on Early Bird</h2><a href="#/?${new URLSearchParams(homeParams({ sort: "new" }))}">See all</a></div><div class="ncards">${rows.map((v) => `
      <a class="ncard" href="#/r/${esc(v.slug)}?meal=${H.meal}&diners=${H.diners}"><div class="nph">${esc(v.name.charAt(0))}${(v.photo || v.dish_photos?.[0]) ? `<img src="${esc(v.photo || v.dish_photos[0])}" alt="" loading="lazy" onerror="this.remove()">` : ""}</div>
        <b>${esc(v.name)}</b><span>${esc([v.area, (v.cuisines || [])[0]].filter(Boolean).join(" • "))}</span>${v.rating != null ? `<span>${stars5(v.rating)} ${Number(v.rating).toFixed(1)} (${v.review_count})</span>` : `<span class="muted">New</span>`}</a>`).join("")}</div>`;
  }).catch(() => {});
  await loadResults(false);
  drawCuisines(await cuisinesP);
  const sentinel = document.getElementById("sentinel");
  if (sentinel && "IntersectionObserver" in window) {
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) loadResults(true); }, { rootMargin: "600px" });
    io.observe(sentinel);
    view.cleanup = () => io.disconnect();
  }
  const more = document.getElementById("more"); if (more) more.onclick = () => loadResults(true);
}
function resultHtmlDesk(v) {
  const d = v.deal, a = v._avail;
  const href = `#/r/${esc(v.slug)}?meal=${H.meal}&diners=${H.diners}`;
  let cols = "";
  if (d && a) {
    cols = (a.days || []).slice(0, 7).map((day) => {
      const slots = (day.slots || []).filter((s) => s.left > 0);
      const head = `<div class="dh ${slots.length && day.open ? "" : "off"}">${d && day.date === todayAt(v.timezone) ? "Today" : esc(fmtDate(day.date, { weekday: "short" }))} ${esc(fmtDate(day.date, { day: "numeric" }))}</div>`;
      if (!day.open || !slots.length) return `<div class="dcol">${head}<span class="badge ghost">–</span><div class="none">No tables</div></div>`;
      const shown = slots.slice(0, 2), rest = slots.length - shown.length;
      return `<div class="dcol">${head}<span class="badge">${slots[0].discount}% off</span>
        ${shown.map((s) => `<a class="slot" href="${checkoutHref(v, d.id, day.date, s.time, H.meal, H.diners)}">${time12(s.time)}</a>`).join("")}
        ${rest > 0 ? `<a class="more-t" href="${href}&date=${day.date}">More times</a>` : ""}</div>`;
    }).join("");
  }
  const where = [distTxt(v) && `<b class="dist">${distTxt(v)}</b>`, v.area && `${ic("pin")}${esc(v.area)}`, cuisineText(v) && `${ic("fork")}${esc(cuisineText(v))}`, priceTxt(v)].filter(Boolean).join("");
  return `<article class="drow"><a class="dthumb" href="${href}">${esc((v.name || "?").charAt(0))}${(v.photo || v.dish_photos?.[0]) ? `<img src="${esc(v.photo || v.dish_photos[0])}" alt="" loading="lazy" onerror="this.remove()">` : ""}${v.rating >= 4.7 && v.review_count >= 20 ? '<span class="ribbon">Top rated</span>' : ""}</a>
    <div class="dbody"><div class="dtop"><a class="dname" href="${href}">${esc(v.name)} <span aria-hidden="true">›</span></a>${v.rating != null ? `<span class="drate">${Number(v.rating).toFixed(1)} ${stars5(v.rating)} <span class="muted">(${v.review_count})</span></span>` : '<span class="drate muted">New on Early Bird</span>'}</div>
      <div class="dwhere">${where}</div>
      ${d ? `<div class="dfacts"><span>${ic("card")}${m0(d.fee_per_diner_cents)} booking fee per diner</span><span>${ic("bird")}+${m0(S.config.reward_per_booking_cents || 0)} ${esc(CREDIT)}</span></div>` : ""}
      ${cols ? `<div class="ddays">${cols}</div>` : d ? `<p class="muted small">No ${H.meal} tables in these days.</p>` : ""}</div></article>`;
}
const priceTxt = (v) => (v.price_tier ? `<span class="price">${"$".repeat(v.price_tier)}</span>` : "");
// Map of the current results: Leaflet + OpenStreetMap tiles, loaded only when the map is opened.
let leafletReady = null;
function loadLeaflet() {
  if (window.L) return Promise.resolve();
  if (leafletReady) return leafletReady;
  leafletReady = new Promise((res, rej) => {
    const css = document.createElement("link"); css.rel = "stylesheet"; css.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"; document.head.appendChild(css);
    const js = document.createElement("script"); js.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"; js.onload = res; js.onerror = rej; document.head.appendChild(js);
  });
  return leafletReady;
}
async function drawMap() {
  const box = document.getElementById("map"); if (!box) return;
  try { await loadLeaflet(); } catch { box.innerHTML = '<p class="muted" style="padding:20px">The map could not load. Use the list instead.</p>'; return; }
  box.innerHTML = "";
  const pts = H.rows.filter((v) => v.lat && v.lng);
  const map = L.map(box, { scrollWheelZoom: true }).setView(H.near ? [H.near.lat, H.near.lng] : [S.city.lat, S.city.lng], 12);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap contributors" }).addTo(map);
  const pin = L.divIcon({ className: "ebpin", html: "<span></span>", iconSize: [22, 22], iconAnchor: [11, 22] });
  pts.forEach((v) => L.marker([v.lat, v.lng], { icon: pin }).addTo(map).bindPopup(`<a href="#/r/${esc(v.slug)}?meal=${H.meal}&diners=${H.diners}"><b>${esc(v.name)}</b></a><br>${esc(v.area || "")}${v.deal ? `<br>${v.deal.max_discount || v.deal.discount}% off food · ${m0(v.deal.fee_per_diner_cents)} fee` : ""}`));
  if (pts.length > 1) map.fitBounds(pts.map((v) => [v.lat, v.lng]), { padding: [40, 40] });
}

/* ───────────────────────────── restaurant page ───────────────────────────── */
async function viewVenue(slug, q) {
  const byId = slug.startsWith("id:") ? slug.slice(3) : null; // header search links by id
  const [page] = await Promise.all([rpc("venue_page", byId ? { p_id: byId } : { p_slug: slug }), loadConfig()]);
  if (!page || !page.venue) {
    showPage(`<div class="gate"><h1 class="display">We couldn't find that restaurant</h1><p><a class="btn" href="#/">Back to Home</a></p></div>`);
    return;
  }
  const v = page.venue, deal = v.deal;
  setTitle(v.name);
  if (isDesk()) return viewVenueDesk(v, q);
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
    ${v.rating != null ? `<div class="info"><span class="stars">★</span><span>${Number(v.rating).toFixed(1)}${v.review_count ? ` (${visitsTxt(v.review_count)})` : ""}</span></div>` : `<div class="info">${ic("bird")}<span>New on Early Bird</span></div>`}
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
      <div class="chiprow"><span class="pill">${ic("card")}${m0(deal.fee_per_diner_cents)} booking fee</span><span class="pill">${ic("bird")}+${m0(S.config.reward_per_booking_cents || 0)} credit</span></div>
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
    ${(v.reviews || []).length ? `<hr class="rule"><h2 class="title" style="margin-bottom:6px">Reviews</h2>${v.reviews.map((r) => `<div class="review"><div><span class="stars">${"★".repeat(r.rating)}</span> <b>${esc(r.author)}</b> ${r.verified ? '<span class="status ok">Verified visit</span>' : ""}${r.edited ? ' <span class="muted small">· Edited</span>' : ""}</div>${r.text ? `<div>${esc(r.text)}</div>` : ""}${revExtras(r, v)}</div>`).join("")}` : ""}
    ${deal ? `<div class="stickybook"><div class="in"><button class="btn" id="b-go">Book</button></div></div>` : ""}`, { wash: false });
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
  goBtn.onclick = () => { if (!B.time) { const y = scrollY; slotsEl.scrollIntoView({ behavior: "smooth", block: "center" }); setTimeout(() => { if (scrollY === y) slotsEl.scrollIntoView({ block: "center" }); }, 400); toast("Pick a time first."); return; } go("/book", { v: v.slug, deal: deal.id, date: B.date, time: B.time, meal: B.meal, diners: B.diners }); };
  await fetchAvail();
  if (q.date) document.querySelector(`[data-date="${q.date}"]`)?.scrollIntoView({ inline: "center", block: "nearest" });
}


/* ───────────────────────────── desktop restaurant page ───────────────────────────── */
async function viewVenueDesk(v, q) {
  const deal = v.deal;
  await loadCities().catch(() => {});
  const city = (S.cities || []).find((c) => c.name === v.city);
  const meals = deal?.meals?.length ? deal.meals : ["dinner"];
  const maxD = Math.min(deal?.max_diners || 6, S.config.max_party || 12);
  const B = { diners: Math.min(Number(q.diners) || 2, maxD), meal: meals.includes(q.meal) ? q.meal : meals.includes("dinner") ? "dinner" : meals[0], avail: null, loading: true };
  const photos = [...new Set([v.photo, ...(v.dish_photos || []), ...(v.photos || [])].filter(Boolean))];
  const today = todayAt(v.timezone), dow = dateObj(today).getUTCDay();
  const hoursRows = [1, 2, 3, 4, 5, 6, 0].map((d) => {
    const h = (v.hours || []).filter((x) => x.d === d);
    return `<tr class="${d === dow ? "today" : ""}"><td>${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d]}</td><td>${h.length ? h.map((x) => `${time12(x.o)} – ${time12(x.c)}`).join(", ") : "Closed"}</td></tr>`;
  }).join("");
  const menu = (v.menu || []).filter((s) => (s.items || []).length);
  const reviews = v.reviews || [];
  const rules = [...(deal?.requirements || []).map((r) => `Order ${r.per_person} ${r.label.toLowerCase()} per person`), ...(deal?.conditions || [])];
  const about = v.description || `${v.name}${cuisineText(v) ? ` serves ${cuisineText(v)}` : " is a restaurant"}${v.area ? ` in ${v.area}` : ""}. Book an early table on Early Bird and get ${deal ? deal.max_discount || deal.discount : 50}% off your food bill.`;
  const tile = (src, i) => `<button type="button" class="gtile" data-ph="${i}">${src ? `<img src="${esc(src)}" alt="" loading="lazy" onerror="this.remove()">` : ""}</button>`;
  showRaw(`<div class="wide">
    <div class="crumbs vcrumbs"><a href="#/">${esc(v.city || "Restaurants")}</a>${v.area ? `<span>/</span><a href="#/?${new URLSearchParams({ city: city?.slug || "", a: v.area })}">${esc(v.area)}</a>` : ""}<span>/</span>${esc(v.name)}</div>
    <div class="vhead"><div><h1>${esc(v.name)}</h1>
      <div class="vrate">${v.rating != null ? `${stars5(v.rating)} <a href="#reviews" id="to-rev">${visitsTxt(v.review_count)}</a>` : `${ic("bird")} New on Early Bird`}</div></div>
      <div class="vlinks">${v.website ? `<a href="${esc(v.website)}" target="_blank" rel="noopener" aria-label="Website">${ic("share")}</a>` : ""}${v.phone ? `<a href="tel:${esc(v.phone)}" aria-label="Phone">${ic("info")}</a>` : ""}</div></div>
  </div>
  <div class="gallery ${photos.length > 1 ? "" : "one"}">
    <button type="button" class="gbig" data-ph="0">${photos[0] ? `<img src="${esc(photos[0])}" alt="" onerror="this.remove()">` : `<span>${esc(v.name.charAt(0))}</span>`}</button>
    ${photos.length > 1 ? `<div class="ggrid n${Math.min(photos.length - 1, 4)}">${photos.slice(1, 5).map((p, i) => tile(p, i + 1)).join("")}${photos.length > 5 ? `<button type="button" class="gmore" data-ph="5">+${photos.length - 5} photos</button>` : ""}</div>` : ""}
  </div>
  <div class="wide vcols">
    <div class="vleft">
      <h2 class="serif">Overview</h2>
      <div class="vinline">${cuisineText(v) ? `<span>${ic("fork")}${esc(cuisineText(v))}</span>` : ""}${v.address ? `<button type="button" class="linklike" id="loc-btn">${ic("pin")}Location</button>` : ""}${menu.length ? `<a href="#menu" id="to-menu">${ic("book")}Menu</a>` : ""}<a href="#contact" id="to-contact">${ic("info")}Contact</a></div>
      <div class="about" id="about"><p>${esc(about)}</p></div>
      ${deal ? `<h3 class="vh3">The deal</h3><p><b>${deal.max_discount || deal.discount}% off your food bill</b>${deal.nodrink_discount ? `, or ${deal.nodrink_discount}% off with nothing extra to order` : ""}. A booking fee of ${m0(deal.fee_per_diner_cents)} per diner holds the table.</p>` : ""}
      ${menu.length ? `<div class="menu" id="menu"><h2 class="serif">Menu</h2>${v.deal_menu ? '<p class="muted small">Items marked “On the deal” are covered by the discount.</p>' : ""}
        ${menu.map((s, i) => `<details ${i < 2 ? "open" : ""}><summary>${esc(s.title)}</summary>${s.items.map((it) => `
          <div class="item"><div><span>${esc(it.name)}</span>${v.deal_menu && it.on_deal ? ' <span class="badge">On the deal</span>' : ""}${it.description ? `<div class="d">${esc(it.description)}</div>` : ""}</div><div class="p">${it.price_cents != null ? money(it.price_cents) : ""}</div></div>`).join("")}</details>`).join("")}</div>` : ""}
      <div id="reviews"><h2 class="serif">What people say</h2>
        ${reviews.length ? `${v.rating != null ? `<div class="revsum">${stars5(v.rating)} <b>${Number(v.rating).toFixed(1)}</b> <span class="muted">from ${visitsTxt(v.review_count)}</span></div>` : `<div class="revsum">${ic("bird")} <span class="muted">New on Early Bird</span></div>`}
          ${reviews.map((r) => `<div class="drev"><span class="ava">${esc((r.author || "?").charAt(0))}</span><div><b>${esc(r.author)}</b><div class="muted small">${r.verified ? `Dined at ${esc(v.name)}` : "Reviewed"}${r.date ? ` on ${esc(fmtStamp(r.date))}` : ""}${r.edited ? " · Edited" : ""}</div><div>${stars5(r.rating)}</div>${r.text ? `<p>${esc(r.text)}</p>` : ""}${revExtras(r, v)}</div></div>`).join("")}`
        : `<p class="muted">No reviews yet. Diners can review after their visit.</p>`}</div>
      <div id="contact"><h2 class="serif">Opening hours and contact</h2>
        <div class="contact"><table class="hours">${hoursRows}</table>
          <dl class="kv">${v.address ? `<dt>Address</dt><dd><a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(v.name + " " + v.address)}" target="_blank" rel="noopener">${esc(v.address)}</a></dd>` : ""}${v.phone ? `<dt>Phone</dt><dd><a href="tel:${esc(v.phone)}">${esc(v.phone)}</a></dd>` : ""}${v.website ? `<dt>Website</dt><dd><a href="${esc(v.website)}" target="_blank" rel="noopener">${esc(v.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""))}</a></dd>` : ""}</dl></div></div>
    </div>
    <aside class="vbook" id="vbook">
      ${deal ? `<h2 class="serif">Book early and save ${deal.max_discount || deal.discount}% on food</h2>
        <div class="assure"><span>${ic("check")}Guaranteed booking</span><span>${ic("cancel")}Flexible cancellation</span></div>
        <div class="vsel"><label>${ic("fork")}<select id="b-meal" aria-label="Meal">${meals.map((m) => `<option value="${m}" ${m === B.meal ? "selected" : ""}>${cap(m)}</option>`).join("")}</select></label>
          <label>${ic("person")}<select id="b-diners" aria-label="Diners">${Array.from({ length: maxD }, (_, i) => i + 1).map((n) => `<option ${n === B.diners ? "selected" : ""} value="${n}">${n} ${n === 1 ? "diner" : "diners"}</option>`).join("")}</select></label></div>
        <div class="dfacts"><span>${ic("card")}${m0(deal.fee_per_diner_cents)} booking fee per diner</span><span>${ic("bird")}+${m0(S.config.reward_per_booking_cents || 0)} ${esc(CREDIT)}</span></div>
        <div id="slots"></div>
        <div class="spc"><span>${ic("info")}Special conditions</span><button type="button" class="linklike" id="spc-btn">View</button></div>
        <ul class="rules" id="spc" hidden>${rules.map((c) => `<li>${ic("check")}<span>${esc(c)}</span></li>`).join("")}</ul>
        <p class="tiny muted" style="margin:10px 0 0">${deal.booking_type === "walk_in" ? "Walk-in deal: arrive at your time and show your code." : `Pick a time to start booking. We hold the table for ${S.config.hold_minutes || 7} minutes while you check out.`}</p>`
      : `<h2 class="serif">No early tables right now</h2><p class="muted">This restaurant doesn't have early tables listed at the moment.</p>`}
    </aside>
  </div>
  <div class="wide"><section class="nearby" id="nearby"></section></div>`);
  const jump = (id, sel) => { const a = document.getElementById(id); if (a) a.onclick = (e) => { e.preventDefault(); document.querySelector(sel).scrollIntoView({ behavior: "smooth" }); }; };
  jump("to-menu", "#menu"); jump("to-contact", "#contact"); jump("to-rev", "#reviews");
  document.querySelectorAll("[data-ph]").forEach((b) => (b.onclick = () => photoDialog(photos, +b.dataset.ph)));
  const lb = document.getElementById("loc-btn"); if (lb) lb.onclick = () => mapDialog(v);
  const sb = document.getElementById("spc-btn"); if (sb) sb.onclick = () => { const u = document.getElementById("spc"); u.hidden = !u.hidden; sb.textContent = u.hidden ? "View" : "Hide"; };
  // nearby restaurants
  if (v.lat && v.lng) rpc("search_venues", { p_lat: v.lat, p_lng: v.lng, p_radius_km: 8, p_limit: 9, p_sort: "distance" }).then((rows) => {
    rows = rows.filter((r) => r.id !== v.id).slice(0, 8);
    const el = document.getElementById("nearby"); if (!el || !rows.length) return;
    el.innerHTML = `<h2 class="serif">Nearby${v.area ? ` ${esc(v.area)}` : ""} restaurants</h2><div class="ncards scroll">${rows.map((r) => `
      <a class="ncard" href="#/r/${esc(r.slug)}?meal=${B.meal}&diners=${B.diners}"><div class="nph">${esc(r.name.charAt(0))}${(r.photo || r.dish_photos?.[0]) ? `<img src="${esc(r.photo || r.dish_photos[0])}" alt="" loading="lazy" onerror="this.remove()">` : ""}</div>
        <b>${esc(r.name)}</b><span>${esc([r.area, (r.cuisines || [])[0]].filter(Boolean).join(" • "))}</span>${r.rating != null ? `<span>${stars5(r.rating)} ${Number(r.rating).toFixed(1)}</span>` : ""}</a>`).join("")}</div>`;
  }).catch(() => {});
  if (!deal) return;
  const slotsEl = document.getElementById("slots");
  async function fetchAvail() {
    slotsEl.innerHTML = '<p class="loading">Checking tables…</p>';
    const r = await loadAvail([v.id], B.meal, B.diners).catch(() => ({}));
    B.avail = (r[v.id] || {}).days || [];
    const days = B.avail.slice(0, 7);
    if (!days.some((d) => d.open && d.slots.some((s) => s.left > 0))) { slotsEl.innerHTML = `<p class="muted" style="margin:12px 0">No ${B.meal} tables in the next days. Try another meal or number of diners.</p>`; return; }
    slotsEl.innerHTML = `<div class="ddays">${days.map((day) => {
      const slots = day.slots || [], open = day.open && slots.some((s) => s.left > 0);
      const head = `<div class="dh ${open ? "" : "off"}">${day.date === today ? "Today" : esc(fmtDate(day.date, { weekday: "short" }))} ${esc(fmtDate(day.date, { day: "numeric" }))}</div>`;
      if (!open) return `<div class="dcol">${head}<span class="badge ghost">–</span><div class="none">No tables</div></div>`;
      return `<div class="dcol">${head}<span class="badge">${slots.find((s) => s.left > 0).discount}% off</span>${slots.map((s) => s.left > 0
        ? `<a class="slot" href="${checkoutHref(v, deal.id, day.date, s.time, B.meal, B.diners)}">${time12(s.time)}${s.discount !== deal.discount ? `<small>${s.discount}% off</small>` : ""}</a>`
        : `<span class="slot off">${time12(s.time)}</span>`).join("")}</div>`;
    }).join("")}</div>`;
  }
  document.getElementById("b-meal").onchange = (e) => { B.meal = e.target.value; fetchAvail(); };
  document.getElementById("b-diners").onchange = (e) => { B.diners = +e.target.value; fetchAvail(); };
  await fetchAvail();
}
function photoDialog(photos, start) {
  if (!photos.length) return;
  const d = document.getElementById("dlg");
  d.classList.add("wide-dlg");
  let i = Math.min(start, photos.length - 1);
  const draw = () => { d.innerHTML = `<div class="phv"><img src="${esc(photos[i])}" alt=""><div class="phbar"><button class="btn grey" type="button" id="ph-p">‹ Previous</button><span>${i + 1} / ${photos.length}</span><button class="btn grey" type="button" id="ph-n">Next ›</button><button class="btn" type="button" id="ph-x">Close</button></div></div>`;
    d.querySelector("#ph-p").onclick = () => { i = (i - 1 + photos.length) % photos.length; draw(); };
    d.querySelector("#ph-n").onclick = () => { i = (i + 1) % photos.length; draw(); };
    d.querySelector("#ph-x").onclick = () => d.close(); };
  d.onclose = () => d.classList.remove("wide-dlg");
  draw(); d.showModal();
}
async function mapDialog(v) {
  const d = document.getElementById("dlg");
  d.classList.add("wide-dlg");
  d.innerHTML = `<h2>${esc(v.name)}</h2><p class="muted">${esc(v.address || "")}</p><div id="vmap" class="mapbox small"></div><div class="actions"><a class="btn grey" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(v.name + " " + (v.address || ""))}">Open in Google Maps</a><button class="btn" type="button" id="mx">Close</button></div>`;
  d.querySelector("#mx").onclick = () => d.close();
  d.onclose = () => d.classList.remove("wide-dlg");
  d.showModal();
  try {
    await loadLeaflet();
    const m = L.map("vmap").setView([v.lat, v.lng], 16);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap contributors" }).addTo(m);
    L.marker([v.lat, v.lng], { icon: L.divIcon({ className: "ebpin", html: "<span></span>", iconSize: [22, 22], iconAnchor: [11, 22] }) }).addTo(m);
  } catch { document.getElementById("vmap").innerHTML = '<p class="muted" style="padding:16px">The map could not load.</p>'; }
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
  // One page: party, details, payment and one "Pay and book" button (like Apple Pay checkouts). If something is
  // missing, that field is marked, scrolled to and focused, with a line saying what to add.
  const C = { hold: null, venue: null, profile: null, intent: null, timer: null, done: false, paying: false, details: null, cardComplete: false, busy: false };
  const slug = q.v, wanted = { deal: q.deal, date: q.date, time: q.time, meal: q.meal || "dinner", diners: Number(q.diners) || 2, option: q.opt === "nodrink" ? "nodrink" : "standard" };
  if (!slug || !wanted.deal || !wanted.date || !wanted.time) return go("/");
  const [page, profile] = await Promise.all([rpc("venue_page", { p_slug: slug }), rpc("profile"), loadConfig()]);
  if (!page?.venue) return go("/");
  C.venue = page.venue; C.profile = profile;
  const v = C.venue;
  const out = (msg) => showPage(`<div class="sheethead"><h1>Couldn't hold that table</h1><a class="x" href="#/r/${esc(v.slug)}" aria-label="Close">${ic("x")}</a></div><div class="msg err">${esc(msg)}</div><a class="btn" href="#/r/${esc(v.slug)}">Choose another time</a>`, { wash: false });
  const makeHold = async () => { C.hold = await rpc("hold", { p_device: deviceId, p_deal: wanted.deal, p_date: wanted.date, p_time: wanted.time, p_diners: wanted.diners, p_meal: wanted.meal, p_option: wanted.option }); };
  const hd = () => C.hold;
  const payNeeded = () => hd().payment_mode === "stripe" && hd().amount_due_cents > 0;
  const prepPayment = async () => { C.intent = payNeeded() ? await pay("intent", { claim_id: hd().booking_id }) : null; };
  try { await makeHold(); await prepPayment(); } catch (e) { if (e.code === "not_signed_in") throw e; return out(friendly(e)); }
  C.details = { name: [profile.first_name, profile.last_name].filter(Boolean).join(" ").replace(/^Early Bird diner$/, ""), phone: profile.phone || "", request: "", share: true, marketing: false, accepted: false, venueRef: "", bookedWithVenue: false };
  const unmount = () => { try { C.paymentEl?.destroy(); C.expressEl?.destroy(); } catch { /* ignore */ } C.paymentEl = C.expressEl = null; };
  view.cleanup = () => { clearInterval(C.timer); unmount(); if (C.hold && !C.intent && !C.done) rpc("release_hold", { p_device: deviceId, p_claim: C.hold.booking_id }).catch(() => {}); };

  function startTimer() {
    clearInterval(C.timer);
    const tick = () => {
      const el = document.getElementById("timer"); if (!el) return;
      const ms = new Date(C.hold.expires_at) - Date.now();
      if (ms <= 0) { clearInterval(C.timer); el.textContent = "0:00"; if (!C.done && !C.paying) { const b = document.getElementById("expired"); if (b) b.hidden = false; const g = document.getElementById("c-go"); if (g) g.disabled = true; } return; }
      const s = Math.floor(ms / 1000);
      el.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
      el.classList.toggle("low", s < 60);
    };
    tick(); C.timer = setInterval(tick, 1000);
  }
  const reqText = () => (hd().requirements || []).map((r) => `${r.per_person} ${r.label.toLowerCase()} per person`).join(", ");
  const rules = () => { const r = [...(v.deal?.conditions || [])]; if (reqText() && hd().option !== "nodrink") r.unshift(`Order ${reqText()}`); return r; };
  const cfg = S.config;
  const testBadge = (mode) => (mode === "test" ? '<span class="testbadge">TEST MODE · card 4242 4242 4242 4242</span>' : "");
  const due = () => (C.intent ? C.intent.amount_cents : hd().amount_due_cents);
  const goLabel = () => (payNeeded() ? `Pay ${money(due())} and book` : "Book now");

  const summaryMobile = () => {
    const h = hd();
    return `<div class="sheethead"><div><h1>Make a booking</h1><div class="green small" style="margin-top:6px;display:flex;gap:8px;align-items:center">${ic("seal")}Guaranteed booking • Flexible cancellation</div></div><a class="x" href="#/r/${esc(v.slug)}" aria-label="Close">${ic("x")}</a></div>
      <div class="sumrow">${thumbHtml(v)}<div><span class="deal-pill">${ic("tag")}${h.discount}% off food bill</span><div class="nm">${esc(v.name)}</div>
      <div class="muted">${time12(h.time)}, ${esc(fmtLong(h.date))}</div></div></div>
      <div class="holdpill">Table held for <span class="timer" id="timer">–</span></div>
      <div id="expired" class="msg err" hidden>Your hold ran out. <a href="#/r/${esc(v.slug)}">Choose a time again</a>.</div>`;
  };
  const summaryDesk = () => {
    const h = hd();
    return `<aside class="coright"><div class="holdbar"><span class="hb-l">We're holding this table for you for the next</span><span class="hb-s">Table held for</span> <b id="timer">–</b></div>
      <div id="expired" class="msg err" hidden>Your hold ran out. <a href="#/r/${esc(v.slug)}">Choose a time again</a>.</div>
      <div class="cowhen">${time12(h.time)}, ${esc(fmtDate(h.date, { weekday: "long", day: "numeric", month: "long" }))}</div>
      <span class="deal-pill">${ic("tag")}${h.discount}% off food bill</span>
      <div class="covenue">${thumbHtml(v)}<div><b>${esc(v.name)}</b>${v.rating != null ? `<div>${stars5(v.rating)} ${Number(v.rating).toFixed(1)} (${v.review_count})</div>` : ""}
        ${v.address ? `<div class="muted">${ic("pin")}${esc(v.address)}</div>` : ""}${cuisineText(v) ? `<div class="muted">${ic("fork")}${esc(cuisineText(v))}</div>` : ""}</div></div>
      ${linesHtml()}
      <div class="assure"><span>${ic("check")}Guaranteed booking</span><span>${ic("cancel")}Flexible cancellation</span></div></aside>`;
  };
  const linesHtml = () => {
    const h = hd();
    return `<div class="lines"><div><span>Booking fee${h.fee_per_diner_cents != null ? ` (${h.diners} × ${money(h.fee_per_diner_cents)})` : ""}</span><span>${money(h.fee_cents)}</span></div>
      ${h.promo_cents > 0 ? `<div class="g"><span>Free booking fee</span><span>−${money(h.promo_cents)}</span></div>` : ""}
      ${h.credit_cents - (h.promo_cents || 0) > 0 ? `<div class="g"><span>Paid from your ${esc(CREDIT)}</span><span>−${money(h.credit_cents - (h.promo_cents || 0))}</span></div>` : ""}
      ${h.credit_kept_cents > 0 && h.amount_due_cents > 0 ? `<div class="k"><span>${money(h.credit_kept_cents)} credit saved for a fee it covers in full</span></div>` : ""}
      <div class="tot"><span>To pay now</span><span>${money(due())}</span></div>
      <div class="g"><span>${ic("check")} Est. savings on food</span><span>${m0(h.saving_cents)}</span></div>
      ${cfg.reward_per_booking_cents > 0 ? `<div class="n"><span>${ic("bird")} ${esc(CREDIT)} you'll earn</span><span>+${money(cfg.reward_per_booking_cents)}</span></div>` : ""}</div>`;
  };
  const field = (id, label, input, hint = "") => `<div class="grow-f" id="w-${id}"><label for="${id}">${label}</label>${input}${hint ? `<div class="fhint">${hint}</div>` : ""}<div class="ferr" id="e-${id}" role="alert" hidden></div></div>`;

  function formHtml(msg) {
    const d = C.details, h = hd();
    return `${msg ? `<div class="msg err" role="alert">${esc(msg)}</div>` : ""}
      <section class="grp"><h2 class="grp-h">Your table</h2>
        <div class="grow"><span>Diners</span><div class="stepper"><button type="button" id="d-minus" aria-label="Fewer diners" ${h.diners <= 1 ? "disabled" : ""}>−</button><span id="d-n" aria-live="polite">${h.diners}</span><button type="button" id="d-plus" aria-label="More diners" ${h.diners >= h.max_diners ? "disabled" : ""}>+</button></div></div>
        ${h.nodrink_discount ? `<div class="grow col"><span>Discount</span><div class="seg" role="radiogroup" aria-label="Discount option">
          <button type="button" role="radio" data-opt="standard" aria-checked="${h.option === "standard"}"><b>${h.standard_discount}% off food</b><small>${reqText() ? esc(reqText()) : "Nothing extra"}</small></button>
          <button type="button" role="radio" data-opt="nodrink" aria-checked="${h.option === "nodrink"}"><b>${h.nodrink_discount}% off food</b><small>No drinks needed</small></button></div></div>` : ""}
      </section>
      ${h.reservation_url ? `<section class="grp"><h2 class="grp-h">Book with ${esc(v.name)} first</h2>
        <p class="small muted" style="margin:0 0 10px">This restaurant takes reservations on its own site. Book ${time12(h.time)}, ${esc(fmtLong(h.date))} for ${h.diners}, then come back to add your ${h.discount}% off.</p>
        <a class="btn pale" href="${esc(h.reservation_url)}" target="_blank" rel="noopener">Open ${esc(v.name)} booking</a>
        ${field("c-ref", "Reservation name or number <span class=\"optl\">optional</span>", `<input id="c-ref" type="text" maxlength="80" value="${esc(d.venueRef)}">`)}
        <div class="grow-f" id="w-c-bv"><label class="check" style="margin:0"><input type="checkbox" id="c-bv" ${d.bookedWithVenue ? "checked" : ""}><span>I've booked ${time12(h.time)} with ${esc(v.name)}</span></label><div class="ferr" id="e-c-bv" role="alert" hidden></div></div></section>` : ""}
      <section class="grp"><h2 class="grp-h">Your details</h2>
        ${field("c-name", "Name", `<input id="c-name" type="text" autocomplete="name" maxlength="80" value="${esc(d.name)}" placeholder="First and last name">`)}
        ${field("c-phone", "Mobile", `<input id="c-phone" type="tel" autocomplete="tel" inputmode="tel" maxlength="32" placeholder="(310) 555-0101" value="${esc(d.phone)}">`, "Only for this booking, if the restaurant needs to reach you.")}
        ${field("c-req", "Request <span class=\"optl\">optional</span>", `<input id="c-req" type="text" maxlength="500" value="${esc(d.request)}" placeholder="Allergies, a high chair, a window seat…">`)}
      </section>
      ${payNeeded() ? `<section class="grp"><h2 class="grp-h">Payment</h2><div id="express-element"></div><div id="pay-element"></div><div class="ferr" id="e-card" role="alert" hidden></div></section>` : ""}
      <details class="disc"><summary><b>Early Bird conditions</b><span>${esc(rules().slice(0, 2).join(" · "))}</span></summary><ul class="rules">${rules().map((c) => `<li>${ic("check")}<span>${esc(c)}</span></li>`).join("")}</ul></details>
      <details class="disc"><summary><b>Cancellation policy</b><span>All of the fee back as ${esc(CREDIT)} within ${cfg.cancel_full_credit_minutes} minutes</span></summary>
        <div class="policy">Cancellations come back as ${esc(CREDIT)} for booking fees on other Early Bird bookings, used first on your next one, for ${cfg.credit_valid_days} days.
        <table><tr><td>Within ${cfg.cancel_full_credit_minutes} minutes of booking</td><td>The whole fee</td></tr><tr><td>Later, before the day</td><td>${cfg.cancel_before_day_percent}% of the fee</td></tr><tr><td>On the day, or no-show</td><td>Nothing</td></tr></table></div></details>
      <div class="lines-m">${linesHtml()}</div>
      <div class="grow-f agree" id="w-c-ok"><label class="check"><input type="checkbox" id="c-ok" ${d.accepted ? "checked" : ""}><span>I agree to the Early Bird conditions, the cancellation policy and the <a href="../terms.html" target="_blank" rel="noopener">booking terms</a></span></label><div class="ferr" id="e-c-ok" role="alert" hidden></div></div>
      <label class="check small"><input type="checkbox" id="c-sh" ${d.share ? "checked" : ""}><span>Share my name, mobile number and email with ${esc(v.name)}, so they can contact me about my bookings</span></label>
      <label class="check small"><input type="checkbox" id="c-mk" ${d.marketing ? "checked" : ""}><span>Let ${esc(v.name)} send me offers through Early Bird</span></label>
      <div class="paybar"><div class="paysum"><b>${money(due())}</b><span>${payNeeded() ? "to pay now" : due() === 0 && h.credit_cents > 0 ? (h.promo_cents >= h.credit_cents ? "free booking fee" : "covered by credit") : "nothing to pay"}</span></div><button class="btn" id="c-go" type="button">${goLabel()}</button></div>
      ${testBadge(C.intent?.mode || h.stripe_mode)}`;
  }

  function draw(msg) {
    unmount();
    const body = formHtml(msg);
    if (isDesk()) showPage(`<div id="co"><div class="cotop"><a href="#/r/${esc(v.slug)}">‹ Back to ${esc(v.name)}</a></div><h1 class="cohead">Finalise your booking</h1><div class="cogrid"><div class="coleft">${body}</div>${summaryDesk()}</div></div>`, { size: "wide" });
    else showPage(`<div id="co">${summaryMobile()}${body}</div>`, { wash: false });
    startTimer();
    bind();
    if (C.intent) mountPayment();
  }
  const capture = () => {
    const d = C.details;
    d.name = val("c-name"); d.phone = val("c-phone"); d.request = val("c-req");
    d.share = !!document.getElementById("c-sh")?.checked; d.marketing = !!document.getElementById("c-mk")?.checked; d.accepted = !!document.getElementById("c-ok")?.checked;
    if (document.getElementById("c-ref")) { d.venueRef = val("c-ref"); d.bookedWithVenue = document.getElementById("c-bv").checked; }
  };
  // Change party size or discount option: take a fresh hold with the new choice (a started card payment can't be re-priced).
  async function rehold(change) {
    if (C.busy) return; C.busy = true;
    capture(); Object.assign(wanted, change);
    try { await makeHold(); await prepPayment(); C.busy = false; draw(); }
    catch (e) { C.busy = false; if (e.code === "not_signed_in") throw e; draw(friendly(e)); }
  }
  const clearErr = (id) => { document.getElementById("w-" + id)?.classList.remove("bad"); const e = document.getElementById("e-" + id); if (e) e.hidden = true; };
  const showErr = (id, text) => {
    const w = document.getElementById("w-" + id) || document.getElementById(id), e = document.getElementById("e-" + id);
    w?.classList.add("bad"); if (e) { e.textContent = text; e.hidden = false; }
    (w || e)?.scrollIntoView({ block: "center", behavior: "smooth" });
    const input = document.getElementById(id); if (input && input.focus) setTimeout(() => input.focus({ preventScroll: true }), 300);
  };
  // The first thing missing, in the order it appears on the page.
  function firstProblem({ skipCard = false } = {}) {
    capture();
    const d = C.details, h = hd();
    if (d.name.trim().length < 2) return ["c-name", "Add your name for the booking."];
    if (!normalisePhone(d.phone)) return ["c-phone", d.phone ? "That doesn't look like a mobile number. Use 10 digits, or + and your country code." : "Add your mobile number."];
    if (h.reservation_url && !d.bookedWithVenue) return ["c-bv", `Book with ${v.name} first, then tick this.`];
    if (!skipCard && payNeeded() && !C.cardComplete) return ["card", "Add your card details, or use Apple Pay / Google Pay above."];
    if (!d.accepted) return ["c-ok", "Tick to agree to the conditions."];
    return null;
  }
  function bind() {
    const h = hd();
    document.getElementById("d-minus").onclick = () => h.diners > 1 && rehold({ diners: h.diners - 1 });
    document.getElementById("d-plus").onclick = () => h.diners < h.max_diners && rehold({ diners: h.diners + 1 });
    document.querySelectorAll("[data-opt]").forEach((b) => (b.onclick = () => b.dataset.opt !== h.option && rehold({ option: b.dataset.opt })));
    ["c-name", "c-phone", "c-ref"].forEach((id) => document.getElementById(id)?.addEventListener("input", () => clearErr(id)));
    document.getElementById("c-ok").addEventListener("change", () => clearErr("c-ok"));
    document.getElementById("c-bv")?.addEventListener("change", () => clearErr("c-bv"));
    document.getElementById("c-go").onclick = submit;
  }
  async function submit() {
    if (C.busy || C.paying) return;
    const p = firstProblem();
    if (p) return showErr(p[0], p[1]);
    C.details.phone = normalisePhone(C.details.phone);
    const btn = document.getElementById("c-go");
    if (!payNeeded()) {
      btn.disabled = true; btn.textContent = "Booking…";
      try { const b = await rpc("confirm", confirmParams(hd().booking_id)); C.done = true; after(b); }
      catch (e) { if (e.code === "hold_expired") { clearInterval(C.timer); C.done = true; return out(friendly(e)); } btn.disabled = false; btn.textContent = goLabel(); draw(friendly(e)); }
      return;
    }
    btn.disabled = true; btn.textContent = "Paying…"; C.paying = true; clearErr("card");
    sstore.set("eb.web.pending", JSON.stringify({ id: hd().booking_id, details: C.details }));
    const { error } = await C.stripe.confirmPayment({ elements: C.elements, confirmParams: { return_url: returnUrl(), payment_method_data: { billing_details: { name: C.details.name, email: C.profile.email || undefined, phone: C.details.phone } } }, redirect: "if_required" });
    if (error) { C.paying = false; btn.disabled = false; btn.textContent = goLabel(); return showErr("card", error.message || "The payment didn't go through. Try another card."); }
    await finishPayment();
  }
  const returnUrl = () => `${location.origin}${location.pathname}?pay=${hd().booking_id}`;
  function mountPayment() {
    const info = C.intent;
    C.cardComplete = false;
    C.stripe = C.stripe && C.stripeKey === info.publishable_key ? C.stripe : Stripe(info.publishable_key); C.stripeKey = info.publishable_key;
    const elements = (C.elements = C.stripe.elements({ clientSecret: info.client_secret, appearance: { theme: "stripe", variables: { colorPrimary: "#34548A", colorText: "#14171F", colorDanger: "#C8402F", fontFamily: "-apple-system, BlinkMacSystemFont, system-ui, sans-serif", borderRadius: "12px", fontSizeBase: "16px", spacingUnit: "4px" } } }));
    let express = null;
    try {
      express = C.expressEl = elements.create("expressCheckout", { buttonHeight: 50, buttonType: { applePay: "book", googlePay: "book" }, paymentMethods: { applePay: "auto", googlePay: "auto", link: "never", amazonPay: "never", paypal: "never", klarna: "never" } });
      express.mount("#express-element");
      express.on("ready", (e) => {
        const any = e.availablePaymentMethods && Object.values(e.availablePaymentMethods).some(Boolean);
        const box = document.getElementById("express-element");
        if (!any) box?.remove(); else box?.insertAdjacentHTML("afterend", '<div class="ordiv"><span>or pay by card</span></div>');
      });
      // Apple Pay / Google Pay: check the form first; the wallet sheet only opens when nothing is missing.
      express.on("click", (event) => { const p = firstProblem({ skipCard: true }); if (p) { showErr(p[0], p[1]); return; } C.details.phone = normalisePhone(C.details.phone); event.resolve(); });
      express.on("confirm", async () => {
        C.paying = true; clearErr("card");
        sstore.set("eb.web.pending", JSON.stringify({ id: hd().booking_id, details: C.details }));
        const { error } = await C.stripe.confirmPayment({ elements, clientSecret: info.client_secret, confirmParams: { return_url: returnUrl() }, redirect: "if_required" });
        if (error) { C.paying = false; showErr("card", error.message); return; }
        await finishPayment();
      });
    } catch { /* express checkout unavailable: the card form still works */ }
    const pe = (C.paymentEl = elements.create("payment", { layout: "tabs", wallets: { applePay: express ? "never" : "auto", googlePay: express ? "never" : "auto" } }));
    pe.mount("#pay-element");
    pe.on("change", (e) => { C.cardComplete = !!e.complete; if (e.complete) clearErr("card"); });
  }
  const confirmParams = (id) => ({ p_device: deviceId, p_claim: id, p_name: C.details.name.trim(), p_phone: C.details.phone, p_request: C.details.request || null, p_external_ref: C.details.venueRef || null, p_share_contact: C.details.share ? true : null, p_marketing: C.details.marketing ? true : null });
  function after(b) {
    const n = C.details.name.trim().split(/\s+/);
    rpc("save_profile", { p_first: n[0], p_last: n.slice(1).join(" ") || null, p_phone: C.details.phone }).catch(() => {});
    sstore.set("eb.web.pending", null);
    go("/booking/" + b.id, { new: 1 });
  }
  async function finishPayment() {
    unmount();
    showPage(`<div class="gate"><h1 class="display">Finishing your booking…</h1><p class="muted">Confirming your payment. Please don't close this page.</p></div>`, { wash: false });
    clearInterval(C.timer);
    try { const b = await settleBooking(hd().booking_id, C.details); C.done = true; if (b) after(b); }
    catch (e) {
      showPage(`<div class="gate"><h1 class="display">We're still confirming</h1></div><div class="msg err">${esc(e.message || friendly(e))}</div>
        <p>If you were charged, don't pay again: your booking will appear under <a href="#/bookings">Bookings</a> as soon as the payment is confirmed, or contact <a href="../support.html">support</a>.</p>`, { wash: false });
    }
  }
  draw();
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
  return rpc("confirm", { p_device: deviceId, p_claim: id, p_name: d.name.trim(), p_phone: d.phone, p_request: d.request || null, p_external_ref: d.venueRef || null, p_share_contact: d.share ? true : null, p_marketing: d.marketing ? true : null });
}
// Stripe sends the diner back here after a redirect-based payment method (?pay=<booking id>).
async function viewReturn(q) {
  setTitle("Booking");
  const id = q.pay;
  showPage(`<div class="gate"><h1 class="display">Finishing your booking…</h1><p class="muted">Confirming your payment.</p></div>`, { wash: false });
  let pending = null;
  try { pending = JSON.parse(sstore.get("eb.web.pending") || "null"); } catch { /* ignore */ }
  const d = pending?.id === id ? pending.details : { name: "", phone: "", request: "", share: false, marketing: false, venueRef: "" };
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
        <dt>Booking fee</dt><dd>${money(b.fee_cents)}${b.promo_cents > 0 ? ` (${money(b.promo_cents)} free booking fee)` : ""}${b.credit_used_cents - (b.promo_cents || 0) > 0 ? ` (${money(b.credit_used_cents - (b.promo_cents || 0))} from your ${esc(CREDIT)})` : ""}${b.amount_paid_cents ? ` · ${money(b.amount_paid_cents)} paid by card` : ""}</dd>
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
  const [p, cr, au, ps] = await Promise.all([rpc("profile"), rpc("my_credit", { p_device: deviceId }), Auth.user(), rpc("my_passes", { p_device: deviceId }).catch(() => null)]);
  const passes = (ps?.passes || []).filter((x) => x.status === "available");
  const passCard = passes.length ? `<div class="card"><div class="title">Free booking fees</div>${passes.map((x) => `<div class="item"><div><span>${esc(x.title)}</span>${x.expires_at ? `<div class="d">Use by ${esc(fmtStamp(x.expires_at))}</div>` : ""}</div><b>Up to ${money(x.cap_cents)}</b></div>`).join("")}
    <p class="small muted" style="margin-top:6px">Taken off your next booking fee automatically, before any credit.</p></div>` : "";
  const codeCard = `<div class="card"><div class="title">Have a code?</div><form id="codef" class="codef" novalidate><input id="code-in" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="Code or invite link" aria-label="Code or invite link"><button class="btn" type="submit">Apply</button></form><div id="code-msg"></div></div>`;
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
      <p class="small muted" style="margin-top:8px">Credit from a cancellation is used first on your next booking fee. Credit you earn is used only when it covers a whole booking fee. It's for booking fees only and has no cash value. <a href="../credit-terms.html">${esc(CREDIT)} terms</a></p>
      ${(cr.credits || []).length ? `<div class="title" style="font-size:16px;margin:14px 0 4px">Expiring soonest</div>${cr.credits.slice(0, 6).map((c) => `<div class="item"><div><span>${esc(c.title)}</span><div class="d">${c.pending ? "Pending" : c.expires_at ? "Use by " + esc(fmtStamp(c.expires_at)) : ""}</div></div><div class="p">${money(c.cents)}</div></div>`).join("")}` : ""}</div>
    ${passCard}${codeCard}
    <div class="actions"><a class="btn pale" href="#/bookings">Bookings</a><button class="btn grey" id="so" type="button">Sign out</button></div>
    <p class="center small muted" style="margin-top:20px"><a href="../account-deletion.html" style="color:inherit">Delete my account</a></p>`);
  document.getElementById("so").onclick = async () => { await Auth.signOut(); navigate("#/"); };
  document.getElementById("codef").onsubmit = async (e) => {
    e.preventDefault();
    const inp = document.getElementById("code-in"), out = document.getElementById("code-msg"), btn = e.target.querySelector("button");
    const code = inp.value.trim();
    if (!code) { out.innerHTML = '<div class="msg err" role="alert">Type or paste your code.</div>'; inp.focus(); return; }
    btn.disabled = true;
    try {
      const r = await rpc("redeem_code", { p_code: code, p_device: deviceId });
      if (r.ok) { toast(r.message || "Code added."); return route(); }
      out.innerHTML = `<div class="msg err" role="alert">${esc(r.message || "That code didn't work.")}</div>`;
    } catch (err) { out.innerHTML = `<div class="msg err" role="alert">${esc(friendly(err))}</div>`; }
    btn.disabled = false;
  };
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
