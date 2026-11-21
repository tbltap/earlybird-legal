// Early Bird for restaurants on the web (eatearlybird.com/restaurants → /book/#/biz).
// Owner, 21 Nov 2026: restaurants make their whole listing online: find or add the restaurant, prove they run it,
// set the early tables, add photos, the menu and their links, agree to the fair-deal promise and send it. It goes live
// only once the ownership document checks out; Early Bird then calls them.
// Same api as the app (backend/API.md → "Restaurant web guide"), called with the signed-in person's own token.
const EB = window.EB;
const { CFG, Auth, rpc, esc, ic, showPage, toast, go, navigate, setTitle, friendly, viewSignIn, time12 } = EB;

const TERMS_VERSION = "2026-11-21.earlybird-restaurant-v4"; // setting restaurant.terms_version (API.md, Shape: Venue claim)
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY1 = ["S", "M", "T", "W", "T", "F", "S"];
const MEALS = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner" };
const TIMES = Array.from({ length: 36 }, (_, i) => { const m = 6 * 60 + i * 30; return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`; });

// The app's wording for every error (Features/Admin/ListRestaurantView.swift, ListingError).
const ERRS = {
  already_claimed: "This restaurant already has an owner on Early Bird. Ask them to add you.",
  already_yours: "You already manage this restaurant.",
  too_many_claims: "You have several claims waiting. Wait for those to be checked first.",
  not_signed_in: "Sign in first.",
  invalid_venue_name: "Add the restaurant's name.",
  invalid_address: "Add the restaurant's address.",
  invalid_name: "Add your name.",
  invalid_role: "Choose owner or manager.",
  venue_not_found: "We couldn't find that restaurant.",
  claim_not_pending: "This claim was already decided.",
  owners_only: "Only the owner can accept the terms.",
  terms_required: "Accept the Restaurant Terms first.",
  location_needed: "We couldn't place your address on the map, so it can't go live yet. Early Bird will fix the location and tell you.",
  too_many_documents: "That's the most documents you can send for one claim.",
  claim_not_found: "This claim is no longer open.",
  document_not_found: "That document is no longer there.",
  invalid_path: "The photo didn't upload properly. Try again.",
  bad_requirements: "Check what each diner orders: up to 4 rules, each with a short name.",
  bad_conditions: "Up to 8 conditions.",
  too_many_photos: "That's the most photos you can add. Remove one first.",
  already_added: "That photo is already on your page.",
  invalid_website: "That website doesn't look right.",
  invalid_url: "One of the links doesn't look right. Check it starts with the site's address, like https://…",
  invalid_reservation_system: "Keep the reservations system name short, like Resy or OpenTable.",
  bad_menu_item: "Check that dish: it needs a name (up to 120 letters) and a price under $1,000.",
  bad_menu: "Up to 40 sections and 500 dishes.",
  menu_item_not_found: "That dish is no longer on the menu.",
  invalid_phone: "That phone number doesn't look right.",
  invalid_instagram: "That Instagram name doesn't look right.",
  description_too_long: "Shorten the description a little.",
  file_not_found: "The photo didn't upload. Try again.",
  bad_meals: "Check the times: each meal needs at least one day, and the last booking can't be before the first.",
  bad_closed_days: "A day marked closed can't also have tables.",
  no_open_days: "Open at least one day.",
  page_needed: "Add a photo and a short description on your page first.",
  listing_not_approved: "Early Bird hasn't approved your listing yet. Set up your deal and send it for review first.",
  not_submitted: "This listing isn't waiting for review any more.",
  listing_not_found: "This restaurant hasn't set up its listing yet.",
  pledge_required: "Tick the fair-deal promise first.",
  bad_pledge: "The fair-deal promise has changed. Read it again and tick it.",
  photo_not_found: "That photo is no longer there.",
  bad_setup: "Something in the deal didn't look right. Check it and try again.",
  not_allowed: "Only the restaurant's owner or manager can do this.",
  too_many_checks: "That's a lot of documents in a short time. Try again later.",
};
function errText(e) {
  const raw = `${e?.code || ""} ${e?.message || ""}`;
  const m = /day_without_tables: ([A-Za-z, ]+)/.exec(raw);
  if (m) { const d = m[1].trim(); return `Add at least one table on ${d}, or mark ${d.includes(",") ? "those days" : "it"} closed.`; }
  const k = Object.keys(ERRS).find((c) => raw.includes(c));
  return k ? ERRS[k] : friendly(e);
}
const note = (m, k = "err") => (m ? `<div class="msg ${k}" role="${k === "err" ? "alert" : "status"}">${esc(m)}</div>` : "");
const uid = () => Auth.session()?.user?.id;
const fname = (ext = "jpg") => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

// Pictures: about 2,000 px on the long side as JPEG (what the automated document read and the photo rules ask for).
async function prepareImage(file, max = 2000) {
  if (!/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type) && !/\.(jpe?g|png|webp|heic)$/i.test(file.name)) throw new Error("Choose a photo (JPEG, PNG or WebP).");
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("That picture couldn't be opened. Try a JPEG or PNG.")); i.src = url; });
    const w0 = img.naturalWidth, h0 = img.naturalHeight, k = Math.min(1, max / Math.max(w0, h0));
    // A JPEG that is already small enough is sent as it is (its camera details help the document check).
    if (k === 1 && file.type === "image/jpeg" && file.size < 3.4e6 && file.size > 20e3) return { blob: file, w: w0, h: h0 };
    const c = document.createElement("canvas"); c.width = Math.round(w0 * k); c.height = Math.round(h0 * k);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    let q = 0.88, blob = await new Promise((r) => c.toBlob(r, "image/jpeg", q));
    while (blob && blob.size > 3.4e6 && q > 0.5) { q -= 0.1; blob = await new Promise((r) => c.toBlob(r, "image/jpeg", q)); }
    return { blob, w: c.width, h: c.height };
  } finally { URL.revokeObjectURL(url); }
}
async function upload(bucket, path, blob) {
  const token = await Auth.token();
  const res = await fetch(`${CFG.url}/storage/v1/object/${bucket}/${path}`, {
    method: "POST", headers: { apikey: CFG.key, Authorization: `Bearer ${token}`, "Content-Type": blob.type || "image/jpeg" }, body: blob,
  }).catch(() => { throw new EB.ApiError("offline", "No connection. Check your internet and try again."); });
  if (!res.ok) { const j = await res.json().catch(() => ({})); throw new EB.ApiError("upload_failed", j.message || j.error || "The upload didn't work. Try again.", res.status); }
}

/* ───────────────────────────── entry ───────────────────────────── */
export default async function bizRoute(path, q) {
  if (path === "/biz") return viewBizHome();
  if (path === "/biz/why") return viewWhy();
  if (!Auth.session()) return viewSignIn({ next: location.hash });
  if (path === "/biz/find") return viewFind(q);
  if (path === "/biz/new") return viewNew();
  if (path.startsWith("/biz/claim/")) return viewClaim(path.slice(11));
  if (path.startsWith("/biz/v/")) return viewVenue(path.slice(7), q);
  return viewBizHome();
}
const page = (inner) => showPage(`<div class="biz">${inner}</div>`, { wash: false, size: "bizwide" });
const back = (href, label) => `<a class="bizback" href="${href}">${ic("back")}${esc(label)}</a>`;
async function myClaims() { return (await rpc("my_venue_claims")) || []; }
const claimFor = (claims, venueId) => claims.find((c) => c.venue_id === venueId && c.status !== "withdrawn" && c.status !== "rejected");

/* ───────────────────────────── home: pitch, or your restaurants ───────────────────────────── */
async function viewBizHome() {
  setTitle("List your restaurant");
  const steps = `<ol class="bizsteps">
      <li><b>Find or add your restaurant</b><span>Search for it, or add it if it's not on Early Bird yet.</span></li>
      <li><b>Show that you run it</b><span>A photo of a business licence, permit, or a utility bill or lease in the business name.</span></li>
      <li><b>Set your early tables</b><span>The days, the times and how many tables. You can change them any time.</span></li>
      <li><b>Add your photos, menu and links</b><span>Pictures of the place and the food, your menu as a file or a link, your ordering and reservations sites.</span></li>
      <li><b>Send it</b><span>It goes live once your document checks out. We'll then give you a call.</span></li></ol>`;
  if (!Auth.session()) {
    page(`<section class="bizhero"><h1 class="display">List your restaurant on Early Bird</h1>
      <ul class="bizpoints"><li>${ic("check")}Listing is free.</li><li>${ic("check")}You choose the days, the early times and how many tables.</li><li>${ic("check")}Diners get 50% off the food bill at those times, and your quiet hours fill up.</li></ul>
      <a class="btn" href="#/signin?next=${encodeURIComponent("#/biz")}">Get started</a>
      <p class="small muted">Sign in with your phone number or email. It takes about 15 minutes, all online.</p></section>
      ${econHtml()}
      <h2 class="bizh">How you sign up</h2>${steps}
      <a class="btn" href="#/signin?next=${encodeURIComponent("#/biz")}">Get started</a>
      <p class="small muted"><a href="../restaurant-terms.html">Restaurant Terms</a> · Questions? <a href="../support.html">Support</a></p>`);
    return wireEcon();
  }
  page(`<p class="loading">Loading your restaurants…</p>`);
  const claims = (await myClaims()).filter((c) => c.status !== "withdrawn");
  const row = (c) => {
    const st = c.status === "pending" && !c.is_new_venue ? "Waiting for your document" : c.status === "rejected" ? "Not approved" : c.listing_status === "approved" ? "Live" : c.listing_status === "submitted" ? "Being checked" : c.listing_status === "sent_back" ? "Needs changes" : "Setting up";
    const href = c.venue_id && (c.status === "approved" || c.is_new_venue) ? `#/biz/v/${c.venue_id}` : `#/biz/claim/${c.id}`;
    return `<a class="bizrow" href="${href}"><div><b>${esc(c.venue_name || "Your restaurant")}</b><span>${esc(c.venue_address || "")}</span></div><span class="bizpill ${st === "Live" ? "ok" : st === "Not approved" ? "bad" : ""}">${esc(st)}</span></a>`;
  };
  page(`<h1 class="display bizt">Your restaurants</h1>
    ${claims.length ? `<div class="bizlist">${claims.map(row).join("")}</div>` : `<p class="muted">You haven't added a restaurant yet.</p>`}
    <a class="btn" href="#/biz/find">${claims.length ? "Add another restaurant" : "Find your restaurant"}</a>
    <p><a class="btn pale" href="#/biz/why">How Early Bird makes you money</a></p>
    <h2 class="bizh">The steps</h2>${steps}`);
}
function viewWhy() {
  setTitle("How Early Bird makes you money");
  page(`${back("#/biz", Auth.session() ? "Your restaurants" : "List your restaurant")}<h1 class="display bizt">How Early Bird makes you money</h1>${econHtml()}
    <a class="btn" href="${Auth.session() ? "#/biz/find" : `#/signin?next=${encodeURIComponent("#/biz")}`}">${Auth.session() ? "Find your restaurant" : "Get started"}</a>`);
  wireEcon();
}

/* ───────────────────────────── what we offer restaurants, with the maths ───────────────────────────── */
// Owner, 21 Nov: show restaurants visually how a table that would sit empty still makes money: full-price drinks and
// sides, the main at half price, staff they pay anyway, a month of extra money from averages, the guest list they own,
// and that they choose the slow times while Early Bird does the marketing. Example numbers only; never the booking fee.
const EX = { tables: 2, perTable: 2, nights: 26, full: 75, main: 24, drink: 9, side: 11, foodPct: 30, drinkPct: 22, card: 3 };
const usd = (n) => (n < 0 ? "−" : "") + "$" + Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: n !== 0 && Math.abs(n) < 100 ? 2 : 0, minimumFractionDigits: n !== 0 && Math.abs(n) < 100 ? 2 : 0 });
function guestMaths(x) {
  const pays = x.main / 2 + x.drink + x.side;
  const ingredients = x.main * x.foodPct / 100 + x.drink * x.drinkPct / 100 + x.side * x.foodPct / 100;
  const fees = pays * x.card / 100, keep = pays - ingredients - fees;
  const guests = Math.round(x.tables * x.perTable * x.nights * x.full / 100);
  return { pays, ingredients, fees, keep, guests, sales: guests * pays, cost: guests * (ingredients + fees), net: guests * keep };
}
function econHtml() {
  const g = guestMaths(EX);
  const slot = (t, k) => `<span class="eslot ${k}">${t}</span>`;
  return `<section class="econ">
    <div class="ecard">
      <h2 class="eh">Your quiet hours, filled</h2>
      <p>Most restaurants have tables that sit empty early in the evening, while the kitchen and the floor are already staffed. You pick those times. We fill them.</p>
      <div class="etimeline" aria-label="An evening at your restaurant">
        <div><span class="elabel">5:00</span>${slot("Early Bird", "eb")}</div><div><span class="elabel">5:30</span>${slot("Early Bird", "eb")}</div><div><span class="elabel">6:00</span>${slot("Early Bird", "eb")}</div>
        <div><span class="elabel">6:30</span>${slot("Filling up", "mid")}</div><div><span class="elabel">7:00</span>${slot("Full price", "full")}</div><div><span class="elabel">8:00</span>${slot("Full price", "full")}</div></div>
      <p class="small muted">Early Bird tables only go at the times you choose. Your busy hours stay full price.</p>
    </div>

    <div class="ecard">
      <h2 class="eh">What one Early Bird guest orders</h2>
      <p>Each diner orders a drink and a side or dessert at full price. The 50% covers the dishes you put on your deal, for example the mains.</p>
      <div class="ebill">
        <div class="ebill-h"><span class="badge">50% off mains</span><span class="small muted">Example, per guest</span></div>
        <div><span>Drink</span><span>${usd(EX.drink)} <i>full price</i></span></div>
        <div><span>Starter or dessert</span><span>${usd(EX.side)} <i>full price</i></span></div>
        <div><span>Main</span><span><s>${usd(EX.main)}</s> ${usd(EX.main / 2)}</span></div>
        <div class="tot"><span>The guest pays you</span><span>${usd(g.pays)}</span></div>
        <div class="minus"><span>Ingredients (about ${EX.foodPct}% food, ${EX.drinkPct}% drinks)</span><span>−${usd(g.ingredients)}</span></div>
        <div class="minus"><span>Card fees (about ${EX.card}%)</span><span>−${usd(g.fees)}</span></div>
        <div class="keep"><span>You keep, per guest</span><span>${usd(g.keep)}</span></div>
      </div>
      <p class="small">Drinks and sides are your best-margin items, so a half-price main still leaves money on the table for you. Not on it.</p>
    </div>

    <div class="ecard">
      <h2 class="eh">Your staff are paid either way</h2>
      <div class="estaff"><div class="ecol empty"><b>An empty table</b><span>Staff, rent and power still cost you</span><strong>$0 in</strong></div>
        <div class="ecol eb"><b>An Early Bird table of 2</b><span>The same staff serve it</span><strong>about ${usd(g.keep * 2)} kept</strong></div></div>
      <p class="small muted">The money from early tables helps pay costs you have anyway. Listing on Early Bird is free: the diner pays us a small booking fee, not you.</p>
    </div>

    <div class="ecard" id="ecalc">
      <h2 class="eh">A month, worked out</h2>
      <p class="small">Change the numbers to match your restaurant.</p>
      <div class="ecalc-in">
        ${[["tables", "Early tables each evening", 1, 10, 1, ""], ["perTable", "Diners per table", 1, 6, 1, ""], ["nights", "Evenings a month", 4, 31, 1, ""], ["full", "How often they're booked", 20, 100, 5, "%"],
           ["main", "Average main", 10, 60, 1, "$"], ["drink", "Average drink", 3, 25, 1, "$"], ["side", "Average starter or dessert", 4, 25, 1, "$"], ["foodPct", "Food cost", 20, 45, 1, "%"], ["drinkPct", "Drink cost", 10, 40, 1, "%"]]
          .map(([k, l, mn, mx, st, u]) => `<label class="erange"><span>${l}</span><output id="o-${k}">${u === "$" ? "$" + EX[k] : EX[k] + u}</output><input type="range" id="e-${k}" min="${mn}" max="${mx}" step="${st}" value="${EX[k]}" data-u="${u}"></label>`).join("")}
      </div>
      <div class="eresult" aria-live="polite">
        <div><span>Early Bird guests a month</span><b id="r-guests">${g.guests}</b></div>
        <div><span>Extra sales</span><b id="r-sales">${usd(g.sales)}</b></div>
        <div><span>Ingredients and card fees</span><b id="r-cost">−${usd(g.cost)}</b></div>
        <div class="big"><span>Extra money each month</span><b id="r-net">${usd(g.net)}</b></div>
        <div><span>Over a year</span><b id="r-year">${usd(g.net * 12)}</b></div>
      </div>
      <p class="small muted">An estimate from the averages above, before tips and before anything they spend when they come back. Your prices and costs will differ.</p>
    </div>

    <div class="ecard">
      <h2 class="eh">Your guests, your relationship</h2>
      <p>Guests who agree to share their details join your guest list on Early Bird. Send them an offer to come back, and next time they're full-paying regulars.</p>
      <div class="eguests">
        <div class="eguest"><span class="ava">M</span><div><b>Maya R.</b><span>Visited twice · Dinner for 2</span></div><span class="bizpill ok">Shared contact</span></div>
        <div class="eguest"><span class="ava">J</span><div><b>James T.</b><span>Visited Friday · Dinner for 4</span></div><span class="bizpill ok">Shared contact</span></div>
        <div class="eoffer"><b>Your offer</b><span>“Come back for our new tasting menu this weekend.”</span><em>Sent through Early Bird</em></div>
      </div>
    </div>

    <div class="ecard">
      <h2 class="eh">You set the times. We bring the diners.</h2>
      <p>Choose the days, the early window and how many tables. Change them any time. We put your restaurant in front of diners in the Early Bird app and on eatearlybird.com, with your photos, your dishes and your times.</p>
      <div class="ephone"><div class="ephone-card"><div class="ephone-top"><span class="ephone-img">${ic("fork")}</span><div><b>Your restaurant</b><span>Your area · Your cuisine</span></div></div>
        <div class="days ephone-days">${["Today", "Sat", "Sun", "Mon"].map((d, i) => `<div class="dcol ${i % 2 ? "alt" : ""}"><div class="dh"><span>${d}</span></div><span class="badge">50% off</span><span class="slot">5:00PM</span><span class="slot">5:30PM</span><span class="slot">6:00PM</span></div>`).join("")}</div></div>
        <p class="small muted center">How diners see your early tables in the app.</p></div>
    </div>
  </section>`;
}
function wireEcon() {
  const box = document.getElementById("ecalc"); if (!box) return;
  const calc = () => {
    const x = { ...EX };
    box.querySelectorAll("input[type=range]").forEach((r) => { const k = r.id.slice(2); x[k] = +r.value; const u = r.dataset.u; document.getElementById("o-" + k).textContent = u === "$" ? "$" + r.value : r.value + u; });
    const g = guestMaths(x);
    document.getElementById("r-guests").textContent = g.guests.toLocaleString("en-US");
    document.getElementById("r-sales").textContent = usd(g.sales);
    document.getElementById("r-cost").textContent = "−" + usd(g.cost);
    document.getElementById("r-net").textContent = usd(g.net);
    document.getElementById("r-year").textContent = usd(g.net * 12);
  };
  box.querySelectorAll("input[type=range]").forEach((r) => { r.oninput = calc; });
}

/* ───────────────────────────── find and claim ───────────────────────────── */
async function viewFind(q) {
  setTitle("Find your restaurant");
  const p = await rpc("profile").catch(() => ({}));
  const myName = [p.first_name, p.last_name].filter(Boolean).join(" ").replace(/^Early Bird diner$/, "");
  page(`${back("#/biz", "Your restaurants")}<h1 class="display bizt">Find your restaurant</h1>
    <div class="textsearch">${ic("search")}<input id="bf-q" type="search" placeholder="Restaurant name" aria-label="Restaurant name" autocomplete="off" value="${esc(q.q || "")}"></div>
    <div id="bf-res" class="bizlist"></div>
    <p class="center" style="margin-top:18px"><a class="btn pale" href="#/biz/new">My restaurant isn't here</a></p>`);
  const inp = document.getElementById("bf-q"), out = document.getElementById("bf-res");
  let t = null, seq = 0;
  const search = async () => {
    const term = inp.value.trim(), my = ++seq;
    if (term.length < 2) { out.innerHTML = ""; return; }
    const rows = await rpc("claimable_venues", { p_query: term, p_limit: 20 }).catch(() => []);
    if (my !== seq) return;
    out.innerHTML = rows.length ? rows.map((r) => `<button class="bizrow" type="button" data-id="${esc(r.id)}" ${r.claimed ? "disabled" : ""}><div><b>${esc(r.name)}</b><span>${esc([r.address, r.area].filter(Boolean).join(" · "))}</span></div>
        <span class="bizpill">${r.claimed ? "Has an owner" : r.my_claim ? esc(r.my_claim === "pending" ? "Claim sent" : r.my_claim) : "Claim"}</span></button>`).join("")
      : `<p class="muted">No restaurant matches “${esc(term)}”. Check the name, or add it.</p>`;
    out.querySelectorAll("button[data-id]").forEach((b) => { b.onclick = () => claimSheet(rows.find((r) => r.id === b.dataset.id)); });
  };
  inp.oninput = () => { clearTimeout(t); t = setTimeout(search, 220); };
  inp.focus(); if (inp.value) search();
  function claimSheet(r) {
    if (r.claimed) return;
    out.innerHTML = `<form class="card bizform" id="bf-claim" novalidate><div class="title">${esc(r.name)}</div><div class="muted small">${esc(r.address || "")}</div>
      <label class="field">Your name<input id="bc-name" autocomplete="name" value="${esc(myName)}" maxlength="120" required></label>
      <fieldset class="bizseg"><legend>You are the</legend><label><input type="radio" name="bc-role" value="owner" checked> Owner</label><label><input type="radio" name="bc-role" value="manager"> Manager</label></fieldset>
      ${r.phone_hint ? `<p class="small muted">Signed in with the restaurant's own phone number (ending ${esc(r.phone_hint)})? You can start setting up straight away.</p>` : ""}
      <div id="bc-msg"></div><button class="btn" type="submit">Claim ${esc(r.name)}</button>
      <button class="btn grey" type="button" id="bc-cancel">Back to the search</button></form>`;
    document.getElementById("bc-cancel").onclick = search;
    document.getElementById("bf-claim").onsubmit = async (e) => {
      e.preventDefault();
      const name = document.getElementById("bc-name").value.trim(), role = document.querySelector('input[name="bc-role"]:checked').value, msg = document.getElementById("bc-msg");
      if (!name) { msg.innerHTML = note("Add your name."); return; }
      e.target.querySelector('button[type="submit"]').disabled = true;
      try {
        const c = await rpc("start_venue_claim", { p_venue: r.id, p_name: name, p_role: role });
        go(c.status === "approved" && c.venue_id ? `/biz/v/${c.venue_id}` : `/biz/claim/${c.id}`);
      } catch (err) { msg.innerHTML = note(errText(err)); e.target.querySelector('button[type="submit"]').disabled = false; }
    };
  }
}

// "My restaurant isn't here": the address is placed on the map (OpenStreetMap's search) so the restaurant gets its city.
async function geocode(address) {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q=${encodeURIComponent(address)}`, { headers: { Accept: "application/json" } });
    const j = await r.json();
    return j[0] ? { lat: Number(j[0].lat), lng: Number(j[0].lon) } : null;
  } catch { return null; }
}
async function viewNew() {
  setTitle("Add your restaurant");
  const p = await rpc("profile").catch(() => ({}));
  const myName = [p.first_name, p.last_name].filter(Boolean).join(" ").replace(/^Early Bird diner$/, "");
  page(`${back("#/biz/find", "Search")}<h1 class="display bizt">Add your restaurant</h1>
    <form class="card bizform" id="bn" novalidate>
      <label class="field">Restaurant name<input id="bn-v" maxlength="160" autocomplete="organization" required></label>
      <label class="field">Address<input id="bn-a" maxlength="400" autocomplete="street-address" placeholder="Street, city, state, ZIP" required></label>
      <label class="field">Restaurant phone<input id="bn-p" type="tel" maxlength="32" autocomplete="tel"></label>
      <label class="field">Website<input id="bn-w" type="url" maxlength="300" placeholder="https://"></label>
      <label class="field">Your name<input id="bn-n" maxlength="120" autocomplete="name" value="${esc(myName)}" required></label>
      <fieldset class="bizseg"><legend>You are the</legend><label><input type="radio" name="bn-role" value="owner" checked> Owner</label><label><input type="radio" name="bn-role" value="manager"> Manager</label></fieldset>
      <div id="bn-msg"></div><button class="btn" type="submit">Add the restaurant</button></form>`);
  document.getElementById("bn").onsubmit = async (e) => {
    e.preventDefault();
    const v = (id) => document.getElementById(id).value.trim(), msg = document.getElementById("bn-msg"), btn = e.target.querySelector("button");
    const miss = !v("bn-v") ? ["bn-v", "Add the restaurant's name."] : !v("bn-a") ? ["bn-a", "Add the restaurant's address."] : !v("bn-n") ? ["bn-n", "Add your name."] : null;
    if (miss) { msg.innerHTML = note(miss[1]); document.getElementById(miss[0]).focus(); return; }
    btn.disabled = true; msg.innerHTML = note("Adding it…", "info");
    const pos = await geocode(v("bn-a"));
    try {
      const c = await rpc("request_new_venue", { p_venue_name: v("bn-v"), p_address: v("bn-a"), p_phone: v("bn-p"), p_website: v("bn-w"), p_name: v("bn-n"),
        p_role: document.querySelector('input[name="bn-role"]:checked').value, p_lat: pos?.lat ?? null, p_lng: pos?.lng ?? null });
      go(c.venue_id ? `/biz/v/${c.venue_id}` : `/biz/claim/${c.id}`);
    } catch (err) { msg.innerHTML = note(errText(err)); btn.disabled = false; }
  };
}

/* ───────────────────────────── proof: ownership documents ───────────────────────────── */
const DOC_KINDS = "a business licence or business tax registration, a state LLC or corporation filing, an IRS EIN letter, a seller's or health permit, a liquor licence, or a utility bill or lease in the business name at the restaurant's address";
function docsHtml(c) {
  const docs = c.documents || [];
  const row = (d) => `<div class="bizdoc"><span class="bizpill ${d.verdict === "accepted" && d.match?.overall === "match" ? "ok" : ""}">${d.verdict === "accepted" ? (d.match?.overall === "match" ? "Checks out" : "Received") : d.verdict === "unclear" ? "We'll look at it" : "Checking…"}</span>
    <div><b>${esc(d.kind ? d.kind.charAt(0).toUpperCase() + d.kind.slice(1) : "Document")}</b><p class="small muted">${esc(d.message || "")}</p>
    ${d.verdict === "accepted" && d.match?.missing?.length ? `<p class="small muted">This one doesn't show your ${esc(d.match.missing.join(" or ").replace("business ", ""))}. Add another that does if you have one.</p>` : ""}</div></div>`;
  return `${docs.length ? docs.map(row).join("") : ""}
    ${c.status === "pending" && docs.length < 4 ? `<label class="btn ${docs.length ? "pale" : ""} bizupload">${ic("share")}${docs.length ? "Add another document" : "Add a photo of your document"}<input type="file" id="doc-file" accept="image/jpeg,image/png,image/webp,image/*" hidden></label>
      <p class="small muted">Take a clear photo of the whole page, flat and in good light. It should show the restaurant's name and address.</p>` : ""}
    <div id="doc-msg"></div>`;
}
function wireDocUpload(c, after) {
  const inp = document.getElementById("doc-file"), msg = document.getElementById("doc-msg");
  if (!inp) return;
  inp.onchange = async () => {
    const file = inp.files?.[0]; if (!file) return;
    msg.innerHTML = note("Uploading and checking your document… this takes a few seconds.", "info");
    try {
      const { blob } = await prepareImage(file);
      const path = `${uid()}/${c.id}/${fname()}`;
      await upload("claim-docs", path, blob);
      const d = await rpc("add_claim_document", { p_claim: c.id, p_path: path });
      const token = await Auth.token();
      const r = await fetch(`${CFG.functionsUrl || CFG.url + "/functions/v1"}/claim-doc-check`, { method: "POST", headers: { apikey: CFG.key, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ doc_id: d.id, tz_offset_minutes: new Date().getTimezoneOffset() }) }).then((x) => x.json().catch(() => ({}))).catch(() => ({}));
      msg.innerHTML = note(r.message || "Thanks. We've got your document.", r.verdict === "rejected" || r.error ? "err" : "ok");
      setTimeout(after, r.verdict === "rejected" ? 2500 : 1200);
    } catch (err) { msg.innerHTML = note(err instanceof EB.ApiError ? errText(err) : err.message); }
    inp.value = "";
  };
}
async function viewClaim(id) {
  setTitle("Your claim");
  page(`<p class="loading">Loading…</p>`);
  const c = (await myClaims()).find((x) => x.id === id);
  if (!c) return page(`${back("#/biz", "Your restaurants")}${note("This claim is no longer open.")}`);
  if (c.venue_id && (c.status === "approved" || c.is_new_venue)) return navigate(`#/biz/v/${c.venue_id}`);
  const head = `${back("#/biz", "Your restaurants")}<h1 class="display bizt">${esc(c.venue_name || "Your restaurant")}</h1><p class="muted">${esc(c.venue_address || "")}</p>`;
  if (c.status === "rejected") return page(`${head}${note(c.decision_note || "Early Bird couldn't confirm that you run this restaurant. Contact support if you think this is wrong.")}`);
  page(`${head}
    <section class="card"><div class="title">Show that you run it</div>
      <p class="small">Add a photo of ${DOC_KINDS}.</p>${docsHtml(c)}</section>
    ${c.is_new_venue ? `<section class="card"><div class="title">Next</div><p class="small muted">Early Bird is adding ${esc(c.venue_name)} to the map. You can set up your tables, photos and menu as soon as that's done; we'll text you.</p></section>`
      : `<section class="card"><div class="title">Next</div><p class="small muted">Once your document checks out you can set up everything else. Usually that's within a minute; if we need to look ourselves, it's within a working day.</p></section>`}
    <p class="center small"><button class="linkbtn" type="button" id="wd">Withdraw this claim</button></p>`);
  wireDocUpload(c, () => viewClaim(id));
  document.getElementById("wd").onclick = async () => {
    if (!confirmInline("wd", "Tap again to withdraw")) return;
    await rpc("withdraw_venue_claim", { p_claim: c.id }).catch(() => {}); navigate("#/biz");
  };
}
function confirmInline(id, text) { const b = document.getElementById(id); if (b.dataset.armed) return true; b.dataset.armed = "1"; b.textContent = text; return false; }

/* ───────────────────────────── the restaurant's set-up ───────────────────────────── */
async function viewVenue(venueId, q) {
  setTitle("Set up your listing");
  page(`<p class="loading">Loading your restaurant…</p>`);
  let ls, prof, claims;
  try { [ls, prof, claims] = await Promise.all([rpc("listing_status", { p_venue: venueId }), rpc("venue_profile", { p_venue: venueId }), myClaims()]); }
  catch (e) { return page(`${back("#/biz", "Your restaurants")}${note(errText(e))}`); }
  const claim = claimFor(claims, venueId) || {};
  const S = { setup: normSetup(ls.setup), dirty: false };
  // A new restaurant can set everything up while its claim waits for the document (0153): don't show it as verified yet.
  if (claim.status === "pending") ls.checklist = (ls.checklist || []).map((c) => (c.key === "verified" ? { ...c, done: false, title: "Verified as the restaurant (your document does this)" } : c));
  const done = Object.fromEntries((ls.checklist || []).map((c) => [c.key, c.done]));
  const live = ls.live || ls.status === "approved";
  const statusLine = ls.status === "submitted" ? note(ls.checking?.message || "We're checking your listing now.", "info")
    : ls.status === "sent_back" ? note(`Early Bird asked for a change: ${ls.note || "see below."}`)
    : live ? note("Your listing is live for diners. Changes to days, times and tables apply at once.", "ok") : "";
  const sec = (key, n, title, body, open) => `<details class="card bizsec" id="s-${key}" ${open ? "open" : ""}><summary><span class="bizn ${done[key] ? "ok" : ""}">${done[key] ? ic("check") : n}</span><b>${title}</b></summary><div class="bizbody">${body}</div></details>`;
  const firstOpen = (ls.checklist || []).find((c) => !c.done)?.key;
  page(`${back("#/biz", "Your restaurants")}
    <h1 class="display bizt">${esc(ls.venue_name || prof.name)}</h1><p class="muted">${esc(prof.address || "")}</p>
    ${statusLine}
    <ol class="bizcheck">${(ls.checklist || []).map((c) => `<li class="${c.done ? "ok" : ""}">${c.done ? ic("check") : "<i></i>"}<span>${esc(c.title)}</span></li>`).join("")}</ol>
    ${sec("document", 1, "Show that you run it", verifiedHtml(claim, ls), firstOpen === "verified" || (firstOpen === "document"))}
    ${sec("terms", 2, "Restaurant Terms", termsHtml(claim), firstOpen === "terms")}
    ${sec("deal", 3, "Your early tables", dealHtml(S.setup, ls), firstOpen === "deal" || q.open === "deal")}
    ${sec("page", 4, "Your page: photos and description", pageHtml(prof), firstOpen === "page")}
    ${menuSection(prof)}
    ${sec("pledge", 6, "Agree and send", sendHtml(ls), firstOpen === "pledge" || firstOpen === "review")}
    ${live ? `<p class="center"><a class="btn pale" href="#/r/id:${esc(venueId)}">See your page as diners do</a></p>` : ""}`);
  wireDocUpload(claim, () => viewVenue(venueId, q));
  wireTerms(venueId, claim, () => viewVenue(venueId, q));
  wireDeal(venueId, S, ls);
  wirePage(venueId, prof, () => viewVenue(venueId, q));
  wireMenu(venueId);
  wireSend(venueId, S, ls, () => viewVenue(venueId, q));
  // While it's being checked, look again every 15 seconds for up to 3 minutes.
  if (ls.status === "submitted" && ls.checking?.state === "checking") {
    let n = 0; const t = setInterval(async () => {
      if (++n > 12) return clearInterval(t);
      const s2 = await rpc("listing_status", { p_venue: venueId }).catch(() => null);
      if (s2 && (s2.status !== ls.status || s2.checking?.state !== ls.checking?.state)) { clearInterval(t); viewVenue(venueId, q); }
    }, 15000);
    EB.setCleanup(() => clearInterval(t));
  }
}

// Every listing needs an ownership document that checks out before it goes live (0153), even after a phone match.
function verifiedHtml(c, ls) {
  if (ls.document_checked) return `<p class="small">${ic("check")} Your ownership document checked out. Thank you.</p>`;
  const how = c.method === "phone_match" ? "You're verified with the restaurant's phone number, so you can set everything up now. " : "";
  return `<p class="small">${how}Before it goes live we need one document: a photo of ${DOC_KINDS}.</p>${docsHtml({ ...c, status: "pending" })}`;
}

function termsHtml(c) {
  if (c.terms_accepted && c.terms_current) return `<p class="small">Accepted. <a href="../restaurant-terms.html" target="_blank" rel="noopener">Read the Restaurant Terms</a></p>`;
  if (c.role === "manager") return `<p class="small">The restaurant's owner needs to accept the <a href="../restaurant-terms.html" target="_blank" rel="noopener">Restaurant Terms</a>. Ask them to sign in to Early Bird and accept them.</p>`;
  return `<p class="small">${c.terms_accepted ? "The Restaurant Terms have changed. Read the new version and accept it." : "Listing on Early Bird is free. Read how it works for your restaurant: the deal, cancellations and how you honour bookings."}</p>
    <p class="small"><a href="../restaurant-terms.html" target="_blank" rel="noopener">Read the Restaurant Terms</a></p>
    <label class="check"><input type="checkbox" id="t-ok"><span>I've read the Restaurant Terms and accept them for this restaurant</span></label>
    <div id="t-msg"></div><button class="btn" type="button" id="t-go">Accept the terms</button>`;
}
function wireTerms(venueId, c, after) {
  const b = document.getElementById("t-go"); if (!b) return;
  b.onclick = async () => {
    const msg = document.getElementById("t-msg");
    if (!document.getElementById("t-ok").checked) { msg.innerHTML = note("Tick the box to accept the terms."); return; }
    b.disabled = true;
    try { await rpc("accept_restaurant_terms", { p_venue: venueId, p_version: TERMS_VERSION }); toast("Terms accepted."); after(); }
    catch (e) { msg.innerHTML = note(errText(e)); b.disabled = false; }
  };
}

/* ── the deal: days, a window per meal with its tables, closed days, what each diner orders, conditions ── */
function normSetup(s) {
  s = s || {};
  return { meals: (s.meals || []).map((m) => ({ meal: m.meal || "dinner", start: (m.start || "17:00").slice(0, 5), end: (m.end || "18:30").slice(0, 5), weekdays: [...(m.weekdays || [])], tables: m.tables || 2 })),
    closed_days: [...(s.closed_days || [])], requirements: (s.requirements || []).map((r) => ({ label: r.label || "", per_person: r.per_person || 1, counts_as: [...(r.counts_as || [])], excludes: [...(r.excludes || [])] })),
    conditions: [...(s.conditions || [])] };
}
const timeOpts = (sel) => TIMES.map((t) => `<option value="${t}" ${t === sel ? "selected" : ""}>${time12(t)}</option>`).join("");
function mealRow(m, i) {
  return `<div class="dealrow" data-i="${i}">
    <div class="dealtop"><select class="d-meal" aria-label="Meal">${Object.entries(MEALS).map(([k, l]) => `<option value="${k}" ${k === m.meal ? "selected" : ""}>${l}</option>`).join("")}</select>
      <button class="linkbtn d-rm" type="button" aria-label="Remove this time window">Remove</button></div>
    <div class="dealgrid"><label>From<select class="d-start">${timeOpts(m.start)}</select></label><label>Last booking<select class="d-end">${timeOpts(m.end)}</select></label>
      <label>Tables<input class="d-tables" type="number" min="1" max="20" inputmode="numeric" value="${m.tables}"></label></div>
    <div class="daychips" role="group" aria-label="Days">${DAY1.map((d, k) => `<button type="button" class="daychip ${m.weekdays.includes(k) ? "on" : ""}" data-k="${k}" aria-pressed="${m.weekdays.includes(k)}" aria-label="${DAYS[k]}">${d}</button>`).join("")}</div>
    <p class="small muted d-sum"></p></div>`;
}
function reqRow(r, i) {
  return `<div class="reqrow" data-i="${i}"><div class="dealgrid"><label>What they order<input class="r-label" maxlength="40" placeholder="Drink" value="${esc(r.label)}"></label>
      <label>Per diner<select class="r-pp">${[1, 2, 3].map((n) => `<option ${n === r.per_person ? "selected" : ""}>${n}</option>`).join("")}</select></label></div>
    <label class="field">Counts as (optional)<input class="r-in" placeholder="Beer, wine, soft drink" value="${esc(r.counts_as.join(", "))}"></label>
    <label class="field">Doesn't count (optional)<input class="r-ex" placeholder="Tap water" value="${esc(r.excludes.join(", "))}"></label>
    <button class="linkbtn r-rm" type="button">Remove</button></div>`;
}
function dealHtml(s) {
  return `<p class="small">Choose when you'd like early diners and how many tables you'll hold for them. <b>Every open day needs at least one table.</b> Diners pick a time every 30 minutes; once they're booked, the rest show as sold out.</p>
    <div id="d-meals">${s.meals.map(mealRow).join("")}</div>
    <button class="btn pale" type="button" id="d-add">Add a time window</button>
    <div class="field" style="margin-top:14px">Closed on<div class="daychips" id="d-closed" role="group" aria-label="Closed days">${DAY1.map((d, k) => `<button type="button" class="daychip closed ${s.closed_days.includes(k) ? "on" : ""}" data-k="${k}" aria-pressed="${s.closed_days.includes(k)}" aria-label="Closed on ${DAYS[k]}">${d}</button>`).join("")}</div></div>
    <p class="small" id="d-days"></p>
    <h3 class="bizh3">What each diner orders</h3><p class="small muted">Optional, up to 4. For example, one drink per diner.</p>
    <div id="d-reqs">${s.requirements.map(reqRow).join("")}</div><button class="btn pale" type="button" id="d-addreq">Add an order rule</button>
    <h3 class="bizh3">Conditions</h3><p class="small muted">Optional, one per line, up to 8. For example: Not on public holidays.</p>
    <textarea id="d-cond" rows="3" maxlength="1400">${esc(s.conditions.join("\n"))}</textarea>
    <div id="d-msg"></div><button class="btn" type="button" id="d-save">Save your tables</button>`;
}
function readDeal(S) {
  const s = S.setup;
  s.meals = [...document.querySelectorAll("#d-meals .dealrow")].map((row) => ({ meal: row.querySelector(".d-meal").value, start: row.querySelector(".d-start").value, end: row.querySelector(".d-end").value,
    tables: Math.min(Math.max(parseInt(row.querySelector(".d-tables").value, 10) || 1, 1), 20), weekdays: [...row.querySelectorAll(".daychip.on")].map((b) => +b.dataset.k) }));
  s.closed_days = [...document.querySelectorAll("#d-closed .daychip.on")].map((b) => +b.dataset.k);
  const list = (v) => v.split(",").map((x) => x.trim()).filter(Boolean);
  s.requirements = [...document.querySelectorAll("#d-reqs .reqrow")].map((r) => ({ label: r.querySelector(".r-label").value.trim(), per_person: +r.querySelector(".r-pp").value, counts_as: list(r.querySelector(".r-in").value), excludes: list(r.querySelector(".r-ex").value) })).filter((r) => r.label);
  s.conditions = document.getElementById("d-cond").value.split("\n").map((x) => x.trim().slice(0, 160)).filter(Boolean).slice(0, 8);
  return s;
}
function dealProblem(s) {
  if (!s.meals.length) return "Add at least one time window.";
  if (s.meals.some((m) => !m.weekdays.length)) return "Each time window needs at least one day.";
  if (s.meals.some((m) => m.end < m.start)) return "The last booking can't be before the first.";
  const open = [0, 1, 2, 3, 4, 5, 6].filter((d) => !s.closed_days.includes(d));
  if (!open.length) return "Open at least one day.";
  if (s.meals.some((m) => m.weekdays.some((d) => s.closed_days.includes(d)))) return "A day marked closed can't also have tables.";
  const missing = open.filter((d) => !s.meals.some((m) => m.weekdays.includes(d))).map((d) => DAYS[d]);
  if (missing.length) return `Add at least one table on ${missing.join(" and ")}, or mark ${missing.length > 1 ? "those days" : "it"} closed.`;
  return null;
}
function wireDeal(venueId, S, ls) {
  const box = document.getElementById("d-meals"); if (!box) return;
  const refresh = () => {
    const s = readDeal(S);
    document.querySelectorAll("#d-meals .dealrow").forEach((row, i) => { const m = s.meals[i]; if (m) row.querySelector(".d-sum").textContent = `${m.tables} ${m.tables === 1 ? "table" : "tables"} between ${time12(m.start)} and ${time12(m.end)}, ${m.weekdays.length === 7 ? "every day" : m.weekdays.length ? m.weekdays.map((d) => DAYS[d].slice(0, 3)).join(", ") : "no days chosen yet"}.`; });
    const p = dealProblem(s); document.getElementById("d-days").innerHTML = p ? `<span class="warn">${esc(p)}</span>` : `<span class="okt">${ic("check")}Every open day has tables.</span>`;
  };
  const wireRows = () => {
    box.querySelectorAll(".daychip").forEach((b) => { b.onclick = () => { b.classList.toggle("on"); b.setAttribute("aria-pressed", b.classList.contains("on")); refresh(); }; });
    box.querySelectorAll("select,input").forEach((x) => { x.onchange = refresh; });
    box.querySelectorAll(".d-rm").forEach((b) => { b.onclick = () => { b.closest(".dealrow").remove(); refresh(); }; });
  };
  document.querySelectorAll("#d-closed .daychip").forEach((b) => { b.onclick = () => { b.classList.toggle("on"); b.setAttribute("aria-pressed", b.classList.contains("on")); refresh(); }; });
  document.getElementById("d-add").onclick = () => {
    readDeal(S); const used = new Set(S.setup.meals.flatMap((m) => m.weekdays));
    const days = [0, 1, 2, 3, 4, 5, 6].filter((d) => !S.setup.closed_days.includes(d) && !used.has(d));
    box.insertAdjacentHTML("beforeend", mealRow({ meal: "dinner", start: "17:00", end: "18:30", tables: 2, weekdays: days.length ? days : [] }, box.children.length));
    wireRows(); refresh();
  };
  const rq = document.getElementById("d-reqs");
  const wireReqs = () => rq.querySelectorAll(".r-rm").forEach((b) => { b.onclick = () => b.closest(".reqrow").remove(); });
  document.getElementById("d-addreq").onclick = () => { if (rq.children.length >= 4) return toast("Up to 4 order rules."); rq.insertAdjacentHTML("beforeend", reqRow({ label: "", per_person: 1, counts_as: [], excludes: [] }, rq.children.length)); wireReqs(); };
  wireRows(); wireReqs(); refresh();
  document.getElementById("d-save").onclick = async (e) => {
    const s = readDeal(S), msg = document.getElementById("d-msg"), p = dealProblem(s);
    if (p) { msg.innerHTML = note(p); return; }
    const pledge = document.getElementById("p-ok")?.checked ? ls.pledge?.version : undefined;
    e.target.disabled = true;
    try { await rpc("quick_deal", { p_venue: venueId, p_setup: { ...s, ...(pledge ? { pledge } : {}) } }); msg.innerHTML = note(ls.live ? "Saved. Diners see the change now." : "Saved.", "ok"); toast("Tables saved."); }
    catch (err) { msg.innerHTML = note(errText(err) + (/pledge/.test(err.code || "") ? " It's under “Agree and send”." : "")); }
    e.target.disabled = false;
  };
}

/* ── the page: description, contact, links, photos ── */
function pageHtml(p) {
  const photos = p.photos || [];
  return `<label class="field">Description<textarea id="pg-desc" rows="4" maxlength="4000" placeholder="What you cook, the feel of the place, what to try first">${esc(p.description)}</textarea></label>
    <div class="dealgrid"><label class="field">Restaurant phone<input id="pg-phone" type="tel" maxlength="32" value="${esc(p.phone)}"></label>
      <label class="field">Instagram<input id="pg-ig" maxlength="200" placeholder="@yourrestaurant" value="${esc(p.instagram)}"></label></div>
    <label class="field">Website<input id="pg-web" type="url" maxlength="300" placeholder="https://" value="${esc(p.website)}"></label>
    ${"ordering_url" in p ? `<label class="field">Online ordering link<input id="pg-order" type="url" maxlength="300" placeholder="https://" value="${esc(p.ordering_url)}"></label>` : ""}
    ${"reservation_url" in p ? `<div class="dealgrid"><label class="field">Reservations link<input id="pg-resv" type="url" maxlength="300" placeholder="https://" value="${esc(p.reservation_url)}"></label>
      <label class="field">Reservations system<input id="pg-rsys" maxlength="60" list="rsys" placeholder="OpenTable, Resy…" value="${esc(p.reservation_system)}"><datalist id="rsys"><option>OpenTable</option><option>Resy</option><option>Tock</option><option>SevenRooms</option><option>Yelp</option><option>Our own website</option></datalist></label></div>` : ""}
    <div id="pg-msg"></div><button class="btn" type="button" id="pg-save">Save your page</button>
    <h3 class="bizh3">Photos</h3><p class="small muted">Up to ${p.max_photos || 12}: the dining room, the front, the food. Your first one becomes the cover; tap a photo to make it the cover.</p>
    <div class="bizphotos">${photos.map((ph) => `<figure class="${ph.is_cover ? "cover" : ""}"><button type="button" class="ph-cover" data-id="${esc(ph.id)}" aria-label="Make this the cover"><img src="${esc(ph.url)}" alt="" loading="lazy"></button>
        ${ph.is_cover ? '<span class="bizpill ok">Cover</span>' : ""}${ph.mine ? `<button type="button" class="ph-rm" data-id="${esc(ph.id)}" aria-label="Remove this photo">${ic("x")}</button>` : ""}</figure>`).join("")}</div>
    <label class="btn pale bizupload">${ic("share")}Add photos<input type="file" id="ph-file" accept="image/jpeg,image/png,image/webp,image/*" multiple hidden></label><div id="ph-msg"></div>`;
}
function wirePage(venueId, p, after) {
  const save = document.getElementById("pg-save"); if (!save) return;
  save.onclick = async () => {
    const v = (id) => document.getElementById(id)?.value.trim(), msg = document.getElementById("pg-msg");
    save.disabled = true;
    try {
      await rpc("save_venue_profile", { p_venue: venueId, p_description: v("pg-desc") ?? null, p_phone: v("pg-phone") ?? null, p_website: v("pg-web") ?? null, p_instagram: v("pg-ig") ?? null,
        ...(document.getElementById("pg-order") ? { p_ordering_url: v("pg-order") } : {}), ...(document.getElementById("pg-resv") ? { p_reservation_url: v("pg-resv"), p_reservation_system: v("pg-rsys") } : {}) });
      msg.innerHTML = note("Saved.", "ok"); toast("Page saved.");
    } catch (e) { msg.innerHTML = note(errText(e)); }
    save.disabled = false;
  };
  document.querySelectorAll(".ph-cover").forEach((b) => { b.onclick = async () => { try { await rpc("set_venue_cover", { p_venue: venueId, p_media: b.dataset.id }); after(); } catch (e) { toast(errText(e)); } }; });
  document.querySelectorAll(".ph-rm").forEach((b) => { b.onclick = async () => { try { await rpc("remove_venue_photo", { p_venue: venueId, p_media: b.dataset.id }); after(); } catch (e) { toast(errText(e)); } }; });
  const inp = document.getElementById("ph-file"), msg = document.getElementById("ph-msg");
  inp.onchange = async () => {
    const files = [...(inp.files || [])]; if (!files.length) return;
    let ok = 0;
    for (const [i, f] of files.entries()) {
      msg.innerHTML = note(`Adding photo ${i + 1} of ${files.length}…`, "info");
      try { const { blob, w, h } = await prepareImage(f); const path = `venues/${venueId}/${fname()}`; await upload("media", path, blob); await rpc("add_venue_photo", { p_venue: venueId, p_path: path, p_width: w, p_height: h }); ok++; }
      catch (e) { msg.innerHTML = note(e instanceof EB.ApiError ? errText(e) : e.message); if (/too_many_photos/.test(e.code || "")) break; }
    }
    if (ok) { toast(`${ok} photo${ok === 1 ? "" : "s"} added.`); after(); }
  };
}

/* ── the menu: a CSV file or typed in, a link to their online ordering page, and a photo per dish (0153) ── */
function menuSection() {
  return `<details class="card bizsec" id="s-menu"><summary><span class="bizn">5</span><b>Your menu and food photos</b></summary><div class="bizbody" id="mn-body"><p class="loading">Loading your menu…</p></div></details>`;
}
// A small CSV reader (quotes, commas and new lines inside quotes).
function parseCsv(text) {
  const rows = []; let row = [], f = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { f += '"'; i++; } else if (c === '"') q = false; else f += c; }
    else if (c === '"') q = true; else if (c === ",") { row.push(f); f = ""; } else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(f); rows.push(row); row = []; f = ""; } else f += c;
  }
  if (f !== "" || row.length) { row.push(f); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim()));
}
function menuFromCsv(text) {
  const rows = parseCsv(text.replace(/^﻿/, ""));
  if (rows.length < 2) throw new Error("That file has no dishes in it.");
  const head = rows[0].map((h) => h.trim().toLowerCase());
  const col = (...names) => head.findIndex((h) => names.includes(h));
  const ci = { section: col("section", "category", "course"), name: col("name", "item", "dish"), desc: col("description", "desc", "details"), price: col("price", "cost") };
  if (ci.name < 0 || ci.price < 0) throw new Error("The first row needs a “name” and a “price” column (section and description are optional).");
  const sections = new Map(), noPrice = [];
  rows.slice(1).forEach((r, k) => {
    const name = (r[ci.name] || "").trim(); if (!name) return;
    const price = String(r[ci.price] || "").replace(/[^0-9.]/g, "");
    if (!price || isNaN(+price)) { noPrice.push(k + 2); return; }
    const sec = (ci.section >= 0 ? r[ci.section] : "").trim() || "Menu";
    if (!sections.has(sec)) sections.set(sec, []);
    sections.get(sec).push({ name: name.slice(0, 120), description: ci.desc >= 0 ? (r[ci.desc] || "").trim().slice(0, 500) : "", price: (+price).toFixed(2) });
  });
  const out = [...sections].map(([name, items]) => ({ name: name.slice(0, 80), items }));
  if (!out.length) throw new Error("No dishes with a name and a price were found.");
  return { sections: out, noPrice };
}
async function wireMenu(venueId) {
  const body = document.getElementById("mn-body"); if (!body) return;
  let menu;
  try { menu = await rpc("venue_menu", { p_venue: venueId }); } catch (e) { body.innerHTML = note(errText(e)); return; }
  const count = (m) => (m.sections || []).reduce((a, s) => a + (s.items || []).length, 0);
  const draw = (pending, info) => {
    const m = pending || menu, n = count(m);
    body.innerHTML = `<p class="small">Upload your menu as a spreadsheet saved as CSV, or give us the link to your online ordering page. Add a photo to any dish: food photos are what diners look at most.</p>
      <label class="btn pale bizupload">${ic("share")}${count(menu) ? "Replace the menu with a file (CSV)" : "Upload a menu file (CSV)"}<input type="file" id="mn-file" accept=".csv,text/csv" hidden></label>
      <p class="small muted">Columns: section, name, description, price. One dish per row. <a href="#" id="mn-sample">Get an example file</a></p>
      ${info || ""}
      ${pending ? `<div class="msg info"><b>${n} dishes in ${m.sections.length} section${m.sections.length === 1 ? "" : "s"} from your file.</b> Saving replaces your current menu.<div class="actions" style="margin-top:8px"><button class="btn" type="button" id="mn-save">Save this menu</button><button class="btn grey" type="button" id="mn-cancel">Cancel</button></div></div>` : ""}
      ${n ? `<div class="menulist">${(m.sections || []).map((sct) => `<h4>${esc(sct.name)}</h4>${(sct.items || []).map((it) => `<div class="mitem">
          ${pending ? "" : `<label class="mphoto" title="Add a photo of this dish">${it.photo_url ? `<img src="${esc(it.photo_url)}" alt="">` : ic("share")}<input type="file" accept="image/*" data-item="${esc(it.id)}" hidden></label>`}
          <div><b>${esc(it.name)}</b>${it.description ? `<span>${esc(it.description)}</span>` : ""}</div><b>$${Number(it.price).toFixed(2)}</b></div>`).join("")}`).join("")}</div>` : `<p class="small muted">No dishes yet.</p>`}
      <label class="field" style="margin-top:14px">Online ordering link<input id="mn-link" type="url" maxlength="300" placeholder="https://" value="${esc(menu.ordering_url || "")}"></label>
      <p class="small muted">No file handy? Add your ordering page and Early Bird will put your menu together from it.</p>
      <div id="mn-msg"></div><button class="btn pale" type="button" id="mn-linksave">Save the link</button>`;
    wire(pending);
  };
  const wire = (pending) => {
    document.getElementById("mn-sample").onclick = (e) => {
      e.preventDefault();
      const csv = "section,name,description,price\nStarters,Burrata,Heirloom tomato and basil,16\nMains,Rigatoni,Pork ragu and parmesan,24\nDesserts,Tiramisu,,10\n";
      const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = "early-bird-menu-example.csv"; a.click();
    };
    const file = document.getElementById("mn-file");
    file.onchange = async () => {
      const f = file.files?.[0]; if (!f) return;
      try { const r = menuFromCsv(await f.text()); draw(r, r.noPrice.length ? note(`Left out row${r.noPrice.length === 1 ? "" : "s"} ${r.noPrice.slice(0, 8).join(", ")}${r.noPrice.length > 8 ? "…" : ""}: no price. Add a price and upload again to include ${r.noPrice.length === 1 ? "it" : "them"}.`, "info") : ""); }
      catch (e) { draw(null, note(e.message)); }
    };
    if (pending) {
      document.getElementById("mn-cancel").onclick = () => draw(null);
      document.getElementById("mn-save").onclick = async (e) => {
        e.target.disabled = true;
        try { menu = await rpc("save_menu", { p_venue: venueId, p_sections: pending.sections }); toast("Menu saved."); draw(null, note(`Saved ${count(menu)} dishes. Add photos of your best ones below.`, "ok")); }
        catch (err) { draw(pending, note(/bad_menu/.test(err.code || "") ? "Something in the file didn't look right: each dish needs a name (up to 120 letters) and a price under $1,000. Up to 40 sections and 500 dishes." : errText(err))); }
      };
    }
    document.getElementById("mn-linksave").onclick = async (e) => {
      const msg = document.getElementById("mn-msg"), link = document.getElementById("mn-link").value.trim();
      e.target.disabled = true;
      try { await rpc("save_venue_profile", { p_venue: venueId, p_ordering_url: link }); menu.ordering_url = link; msg.innerHTML = note(link ? "Saved." : "Link removed.", "ok"); }
      catch (err) { msg.innerHTML = note(errText(err)); }
      e.target.disabled = false;
    };
    body.querySelectorAll('input[type=file][data-item]').forEach((inp) => {
      inp.onchange = async () => {
        const f = inp.files?.[0]; if (!f) return;
        const lbl = inp.closest(".mphoto"); lbl.classList.add("busy");
        try {
          const { blob, w, h } = await prepareImage(f); const path = `venues/${venueId}/${fname()}`;
          await upload("media", path, blob);
          menu = await rpc("set_menu_item_photo", { p_venue: venueId, p_item: inp.dataset.item, p_path: path, p_width: w, p_height: h });
          toast("Dish photo added."); draw(null);
        } catch (e) { lbl.classList.remove("busy"); toast(e instanceof EB.ApiError ? errText(e) : e.message); }
      };
    });
  };
  draw(null);
}

/* ── the fair-deal promise and sending ── */
const BLOCK = { terms_required: "Accept the Restaurant Terms.", setup_needed: "Set your days, times and tables.", page_needed: "Add a photo and a short description on your page.",
  location_needed: ERRS.location_needed, document_needed: "Add a photo of your ownership document.", verified_needed: "Show that you run the restaurant." };
function sendHtml(ls) {
  const pl = ls.pledge || {};
  const blockers = (ls.blockers || []).filter((b) => b !== "pledge_required").map((b) => (b === "day_without_tables" ? ls.days?.message : BLOCK[b] || b)).filter(Boolean);
  if (ls.status === "submitted") return `<p class="small">${esc(ls.checking?.message || "Sent. We're checking it now.")}</p>`;
  if (ls.live || ls.status === "approved") return `<p class="small">Sent and approved. ${pl.agreed ? "Your fair-deal promise covers the deal as it is." : "If you change what each diner orders or the conditions, tick the promise again when you save."}</p>${pledgeBox(pl, ls.venue_name)}`;
  return `${pledgeBox(pl, ls.venue_name)}
    ${blockers.length ? `<div class="msg info"><b>Before you send it:</b><ul class="bizblock">${blockers.map((b) => `<li>${esc(b)}</li>`).join("")}</ul></div>` : ""}
    <div id="p-msg"></div><button class="btn" type="button" id="p-go" ${blockers.length ? "disabled" : ""}>Send to Early Bird</button>
    <p class="small muted">It goes live once your ownership document checks out, usually within a few minutes. We'll then give you a call.</p>`;
}
const pledgeBox = (pl, name) => (pl.version ? `<div class="pledge"><div class="title">${esc(pl.title || "Our fair-deal promise")}</div><ul>${(pl.statements || []).map((s) => `<li>${esc(s)}</li>`).join("")}</ul>
  <label class="check"><input type="checkbox" id="p-ok"><span>${esc((pl.checkbox || "We agree to all three, for <restaurant name>.").replace(/<restaurant name>/i, name || "our restaurant"))}</span></label>
  <p class="small"><a href="${esc(pl.terms_url || "../restaurant-terms.html")}" target="_blank" rel="noopener">Read it in the Restaurant Terms</a></p></div>` : "");
function wireSend(venueId, S, ls, after) {
  const b = document.getElementById("p-go"); if (!b) return;
  b.onclick = async () => {
    const msg = document.getElementById("p-msg");
    if (!document.getElementById("p-ok")?.checked) { msg.innerHTML = note("Tick the fair-deal promise first."); return; }
    const s = document.getElementById("d-meals") ? readDeal(S) : S.setup, p = dealProblem(s);
    if (p) { msg.innerHTML = note(p); document.getElementById("s-deal").open = true; return; }
    b.disabled = true; msg.innerHTML = note("Sending…", "info");
    try { await rpc("quick_deal", { p_venue: venueId, p_setup: { ...s, publish: true, pledge: ls.pledge.version } }); toast("Sent to Early Bird."); after(); }
    catch (e) { msg.innerHTML = note(errText(e)); b.disabled = false; }
  };
}
