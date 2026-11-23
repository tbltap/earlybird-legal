// Early Bird for restaurants on the web: the guided "set your deal" (/book/#/biz/deal/<venue id>).
// Owner, 22 Nov 2026: one question per screen, no thought needed. The same steps and backend as the app
// (EarlyBird/Features/Admin/DealSetupFlow.swift; backend/API.md "Restaurant: deal setup, guided (0210)"):
//   0 what Early Bird is · 1 days open · 2 quiet times (same / per day / POS report) · 3 menu · 4 food cost ·
//   5 staff on shift → the tables that cover them (0211) · 6 our recommendation (3 options, an estimate) ·
//   7 review → quick_deal (as the old editor does).
// Answers are saved as they go (save_deal_setup). The booking fee is never shown or set here.
const EB = window.EB;
const { CFG, Auth, rpc, esc, toast, navigate, setTitle, time12 } = EB;

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SHORT = DAYS.map((d) => d.slice(0, 3));
const STEPS = 8;
const CONDITIONS = ["The discount is on food only. Drinks are full price.", "Arrive within your booked time and show your code.", "Can't be combined with other offers."];
// The quiet times to tap, as quick_deal windows (first and last booking). One per meal per day.
const CHIPS = [
  { id: "breakfast", title: "Breakfast", meal: "breakfast", start: "08:00", end: "10:00" },
  { id: "early-lunch", title: "Early lunch", meal: "lunch", start: "11:30", end: "12:00" },
  { id: "afternoon", title: "Mid-afternoon", meal: "lunch", start: "14:30", end: "15:30" },
  { id: "early-dinner", title: "Early dinner", meal: "dinner", start: "17:00", end: "18:30" },
  { id: "late", title: "Late", meal: "dinner", start: "21:00", end: "22:00" },
];
const SVG = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const IC = {
  same: SVG('<rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'),
  per_day: SVG('<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>'),
  pos: SVG('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  upload: SVG('<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>'),
  clock: SVG('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
  link: SVG('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
  photo: SVG('<rect x="3.5" y="5" width="17" height="14" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="m20.5 15-4.5-4.5L7 19.5"/>'),
  type: SVG('<path d="M5 6h14M12 6v13M9 19h6"/>'),
  back: SVG('<path d="M15 5 8 12l7 7"/>'),
  close: SVG('<path d="M6 6l12 12M18 6 6 18"/>'),
  tick: SVG('<path d="m5 12.5 4.5 4.5L19 7.5" stroke-width="2.4"/>'),
};
const POS_HELP = [["Toast", "Reports › Sales › Sales by time of day, or Orders › Export"], ["Square", "Reports › Sales trends › by hour, or Transactions › Export"],
  ["Clover", "Reports › Sales › Hourly sales"], ["Lightspeed", "Reports › Sales by hour"]];
const REQ = { drink: { label: "Drink", per_person: 1, counts_as: ["Soft drinks", "Juice", "Beer", "Wine", "Cocktails", "Coffee & tea"], excludes: ["Tap water"] },
  starter: { label: "Starter", per_person: 1, counts_as: [], excludes: [] }, dessert: { label: "Dessert", per_person: 1, counts_as: [], excludes: [] } };

const mins = (t) => { const [h, m] = String(t).split(":").map(Number); return h * 60 + (m || 0); };
const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const winLabel = (w) => `${time12(w.start)}–${time12(w.end)}`;
const usd = (n, cents) => `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 })}`;
function dayList(days) {
  if (!days.length) return "No days yet";
  if (days.length === 7) return "Every day";
  const m = days.map((d) => (d === 0 ? 7 : d)).sort((a, b) => a - b);
  if (m.length >= 3 && m[m.length - 1] - m[0] === m.length - 1) return `${SHORT[m[0] % 7]}–${SHORT[m[m.length - 1] % 7]}`;
  return m.map((d) => SHORT[d % 7]).join(", ");
}

const CSS = `
/* Paper & candlelight (brand.css tokens), restyled 22 Nov 2026 to match the booking site */
.dsw{max-width:560px;margin:0 auto;padding-bottom:8px}
.dsw .dshead{display:flex;align-items:center;gap:12px;margin:4px 0 6px}
.dsw .dsx,.dsw .dsb{flex:none;width:38px;height:38px;border-radius:50%;display:grid;place-items:center;background:var(--card,#FBF8F2);box-shadow:inset 0 0 0 1px var(--line,#E2DACE);color:var(--espresso,#1C1A17);border:0;cursor:pointer;text-decoration:none;transition:background .2s,box-shadow .2s}
.dsw .dsx:hover,.dsw .dsb:hover{background:#fff;box-shadow:inset 0 0 0 1px var(--espresso,#1C1A17)}
.dsw .dsx svg,.dsw .dsb svg{width:16px;height:16px}
.dsw .dsb[hidden]{visibility:hidden;display:grid}
.dsw .dsmid{flex:1;min-width:0;text-align:center}
.dsw .dsbrand{display:inline-flex;align-items:center;gap:7px;font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--muted,#6B645A)}
.dsw .dsbrand img{width:22px;height:auto}
.dsw .dsbar{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:4px;margin:8px 0 0}
.dsw .dsbar i{height:3px;border-radius:9px;background:var(--line,#E2DACE);transition:background .4s}
.dsw .dsbar i.on{background:var(--espresso,#1C1A17)}
.dsw .dsstep{font-size:12px;color:var(--muted,#6B645A);text-align:center;margin-top:7px;font-variant-numeric:tabular-nums}
.dsw h1.q{font-family:var(--serif);font-weight:400;font-size:40px;line-height:1.02;letter-spacing:-.015em;margin:22px 0 8px;text-wrap:balance}
.dsw .sub{color:var(--muted,#6B645A);margin:0 0 18px;font-size:16px;line-height:1.45}
.dsw .sub.small,.dsw p.small{font-size:13px;line-height:1.45}
.dsw .crd,.dsw .big,.dsw .opt{background:var(--card,#FBF8F2);border:0;box-shadow:inset 0 0 0 1px var(--line,#E2DACE),0 1px 2px rgba(60,45,30,.04),0 10px 30px rgba(60,45,30,.06);border-radius:20px}
.dsw .crd{padding:16px 18px;margin:12px 0}
.dsw .crd>b:first-child,.dsw .crd .ch{display:block;font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--muted,#6B645A);margin:0 0 8px}
.dsw .big{display:flex;gap:14px;align-items:center;width:100%;text-align:left;padding:16px;margin:10px 0;cursor:pointer;font:inherit;color:inherit;transition:box-shadow .2s,transform .2s}
.dsw .big:hover{box-shadow:inset 0 0 0 1px var(--espresso,#1C1A17),0 10px 30px rgba(60,45,30,.08)}
.dsw .big:active{transform:scale(.99)}
.dsw .big[aria-pressed=true]{box-shadow:inset 0 0 0 1.5px var(--espresso,#1C1A17),0 10px 30px rgba(60,45,30,.08)}
.dsw .big b{display:block;font-size:16px;font-weight:600;line-height:1.3}.dsw .big small{display:block;color:var(--muted,#6B645A);font-size:13px;margin-top:2px}
.dsw .big>span:nth-child(2){flex:1;min-width:0}
.dsw .big .ic{width:40px;height:40px;border-radius:50%;background:var(--well,#EEE8DE);color:var(--espresso,#1C1A17);display:grid;place-items:center;flex:none}
.dsw .big .ic svg{width:18px;height:18px}
.dsw .big[aria-pressed=true] .ic{background:var(--espresso,#1C1A17);color:var(--paper,#F3EEE5)}
.dsw .big .dtk{flex:none;width:22px;height:22px;border-radius:50%;box-shadow:inset 0 0 0 1.5px var(--line,#E2DACE);display:grid;place-items:center;color:transparent}
.dsw .big[aria-pressed=true] .dtk{background:var(--espresso,#1C1A17);box-shadow:none;color:var(--paper,#F3EEE5)}
.dsw .big .dtk svg{width:12px;height:12px}
.dsw .three{list-style:none;margin:0;padding:0;counter-reset:n}
.dsw .three li{display:grid;grid-template-columns:34px 1fr;gap:2px 12px;padding:12px 0;border-top:1px solid var(--line,#E2DACE);counter-increment:n}
.dsw .three li:first-child{border-top:0;padding-top:2px}
.dsw .three li::before{content:counter(n);grid-row:span 2;font-family:var(--serif);font-size:30px;line-height:1;color:var(--ember,#A8401C)}
.dsw .three b{font-size:16px;font-weight:600}.dsw .three small{color:var(--muted,#6B645A);font-size:13px}
.dsw .kv{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:8px 0;font-size:15px;font-variant-numeric:tabular-nums;border-top:1px solid var(--line,#E2DACE)}
.dsw .crd>.kv:first-child,.dsw .crd>b:first-child+.kv,.dsw .crd>.ch+.kv{border-top:0}
.dsw .kv>span:last-child{color:var(--muted,#6B645A);text-align:right}
.dsw .kv small{color:var(--muted,#6B645A);font-size:13px;font-weight:400}
.dsw .nw{white-space:nowrap}.dsw .kv b{font-weight:600}.dsw .kv>b:last-child{white-space:nowrap}
.dsw .kv.tot{border-top:1px solid var(--espresso,#1C1A17);margin-top:4px;padding-top:10px}
.dsw .days{display:grid;grid-template-columns:repeat(7,1fr);gap:6px;margin:4px 0 14px}
.dsw .dchip{aspect-ratio:1;max-height:46px;border:0;border-radius:999px;padding:0;font:500 14px var(--sans);background:transparent;box-shadow:inset 0 0 0 1px var(--line,#E2DACE);color:var(--muted,#6B645A);cursor:pointer;transition:background .2s,color .2s,box-shadow .2s}
.dsw .dchip:hover{box-shadow:inset 0 0 0 1px var(--espresso,#1C1A17);color:var(--espresso,#1C1A17)}
.dsw .dchip[aria-pressed=true]{background:var(--espresso,#1C1A17);color:var(--paper,#F3EEE5);box-shadow:none}
.dsw .hrs .kv{min-height:44px}
.dsw .hrs .kv>span:first-child{font-weight:500}
.dsw .hrs .kv>span:last-child{display:flex;align-items:center;gap:6px;white-space:nowrap}
.dsw .hrs .closed{color:#B3A999;font-size:14px}
.dsw select.hr{-webkit-appearance:none;appearance:none;border:0;box-shadow:inset 0 0 0 1px var(--line,#E2DACE);background:var(--paper,#F3EEE5);border-radius:999px;padding:8px 12px;font:500 14px var(--sans);color:var(--espresso,#1C1A17);text-transform:lowercase;cursor:pointer;width:auto;min-width:0}
.dsw select.hr:focus{box-shadow:inset 0 0 0 1px var(--espresso,#1C1A17);outline:0}
.dsw .pills{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0}
.dsw .pill{border:0;border-radius:99px;padding:9px 16px;font:500 14px var(--sans);cursor:pointer}
.dsw .heat{display:grid;gap:2px;font-size:10px;font-variant-numeric:tabular-nums;overflow-x:auto}
.dsw .heat span{height:22px;border-radius:4px}.dsw .heat .h{height:auto;color:var(--muted,#6B645A);text-align:center}
.dsw .heat .d{height:auto;align-self:center;font-weight:600;color:var(--muted,#6B645A)}
.dsw .heat .w{box-shadow:inset 0 0 0 2px var(--espresso,#1C1A17)}
.dsw .heat .x{background:repeating-linear-gradient(135deg,transparent 0 3px,#E6DFD3 3px 4px)}
.dsw .opt{display:block;width:100%;text-align:left;padding:16px 18px;margin:10px 0;cursor:pointer;font:inherit;color:inherit;transition:box-shadow .2s}
.dsw .opt[aria-pressed=true]{box-shadow:inset 0 0 0 1.5px var(--espresso,#1C1A17),0 10px 30px rgba(60,45,30,.08)}
.dsw .opt .t{display:flex;justify-content:space-between;align-items:baseline;gap:10px;flex-wrap:wrap}
.dsw .opt .t b{font-size:17px;font-weight:600}
.dsw .opt .n{font-family:var(--serif);font-size:24px;font-variant-numeric:tabular-nums;white-space:nowrap}
.dsw .opt p{margin:4px 0 0;font-size:13px;color:var(--muted,#6B645A)}
.dsw .est{display:inline-block;font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--muted,#6B645A);margin:0 0 4px}
.dsw .tag,.dsw .prev b{display:inline-block;background:linear-gradient(135deg,#F1D896,#D9B05A);color:#3B2A08;font-weight:600;font-size:11px;border-radius:99px;padding:3px 9px;letter-spacing:.01em}
.dsw .tag{margin-left:8px;vertical-align:2px}
.dsw .dish{display:flex;align-items:center;gap:12px;padding:11px 0;border-top:1px solid var(--line,#E2DACE);font:400 15px var(--sans);cursor:pointer}
.dsw .crd>b:first-child+.dish,.dsw .crd>p+.dish,.dsw .dish:first-child{border-top:0}
.dsw .dish input{flex:none;width:20px;height:20px;margin:0;accent-color:var(--espresso,#1C1A17)}
.dsw .dish .nm{flex:1;min-width:0;font:500 15px/1.3 var(--sans);letter-spacing:0}
.dsw .dish small{display:block;color:var(--muted,#6B645A);font:400 12px/1.4 var(--sans);margin-top:2px}
.dsw .dish small.thin{color:var(--ember,#A8401C)}
.dsw .dish>span:last-child{font-variant-numeric:tabular-nums;color:var(--muted,#6B645A)}
.dsw .big-n{font-family:var(--serif);font-size:44px;line-height:1;color:var(--espresso,#1C1A17);font-variant-numeric:tabular-nums}
.dsw .stat{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin:2px 0 6px}
.dsw .stat>span:last-child{color:var(--muted,#6B645A);font-size:14px;text-align:right}
.dsw .field{display:inline-flex;align-items:center;gap:2px;background:var(--paper,#F3EEE5);border-radius:12px;box-shadow:inset 0 0 0 1px var(--line,#E2DACE);padding:0 10px;transition:box-shadow .2s}
.dsw .field:focus-within{box-shadow:inset 0 0 0 1px var(--espresso,#1C1A17);background:#fff}
.dsw .field i{font-style:normal;color:var(--muted,#6B645A);font-size:15px}
.dsw .field input{-moz-appearance:textfield;appearance:textfield;border:0!important;background:transparent!important;box-shadow:none!important;outline:0;width:44px!important;padding:9px 0;font:500 17px var(--sans);text-align:center;color:var(--espresso,#1C1A17);font-variant-numeric:tabular-nums}
.dsw .field input::-webkit-outer-spin-button,.dsw .field input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
.dsw .foot{position:sticky;bottom:0;z-index:5;margin:18px -16px 0;padding:12px 16px calc(12px + env(safe-area-inset-bottom));background:rgba(243,238,229,.86);-webkit-backdrop-filter:saturate(160%) blur(16px);backdrop-filter:saturate(160%) blur(16px);border-top:1px solid var(--line,#E2DACE)}
.dsw .prev{font-size:12px;color:var(--muted,#6B645A);margin:0 0 10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dsw .prev b{margin-right:8px}
.dsw .foot .btn{transition:transform .15s,background .2s}.dsw .foot .btn:active{transform:scale(.99)}
.dsw .foot .btn[disabled]{opacity:.35;cursor:default}
.dsw .later{display:block;width:100%;background:none;border:0;font:500 14px var(--sans);padding:12px 10px 2px;cursor:pointer;color:var(--muted,#6B645A);text-decoration:underline;text-decoration-color:var(--line,#E2DACE);text-underline-offset:4px}
.dsw .later:hover{color:var(--espresso,#1C1A17);text-decoration-color:currentColor}
.dsw details{font-size:14px;color:var(--muted,#6B645A);margin:14px 2px}.dsw details summary{cursor:pointer;color:var(--ink,#1C1A17);font-weight:500}
.dsw textarea,.dsw input[type=url],.dsw input[type=text]{width:100%;box-sizing:border-box;font:inherit;font-size:16px;padding:14px;border-radius:14px;border:0;box-shadow:inset 0 0 0 1px var(--line,#E2DACE);background:var(--card,#FBF8F2)}
.dsw input[type=range]{width:100%;accent-color:var(--espresso,#1C1A17);margin:10px 0 4px}
.dsw .okt{color:var(--sage,#4F7350)}.dsw .warn{color:var(--ember,#A8401C)}
.dsw .busy{text-align:center;color:var(--muted,#6B645A);padding:60px 0;font-family:var(--serif);font-size:22px}
.dsw .q,.dsw .sub,.dsw .crd,.dsw .big,.dsw .opt,.dsw .days{animation:dsin .45s cubic-bezier(.2,.7,.2,1) both}
.dsw .sub{animation-delay:.04s}.dsw .crd,.dsw .big,.dsw .opt,.dsw .days{animation-delay:.08s}
@keyframes dsin{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.dsw *{animation:none!important;transition:none!important}}
@media (max-width:420px){.dsw h1.q{font-size:34px}.dsw .big-n{font-size:40px}}`;

export default async function dealSetup(venueId, q, h) {
  const { upload, note, errText, back } = h;
  if (!document.getElementById("dsw-css")) { const st = document.createElement("style"); st.id = "dsw-css"; st.textContent = CSS; document.head.appendChild(st); }
  setTitle("Set your deal");
  const show = (inner) => EB.showPage(`<div class="biz"><div class="dsw">${inner}</div></div>`, { wash: false, size: "bizwide" });
  show(`<p class="busy">Loading…</p>`);
  let data, ls;
  try { [data, ls] = await Promise.all([rpc("deal_setup", { p_venue: venueId }), rpc("listing_status", { p_venue: venueId })]); }
  catch (e) { return show(`${back(`#/biz/v/${venueId}`, "Your listing")}${note(errText(e))}`); }

  const S = { plan: { ...(data.plan || {}) }, rec: null, step: Math.min(Math.max(data.plan?.step || 0, 0), STEPS - 1), sub: null, menu: null, msg: "", busy: "" };
  const approved = ls.status === "approved";
  const hoursOf = (d) => { const x = (S.plan.hours || {})[d] || data.hours[d]; if (!x) return [660, 1320]; const o = mins(x[0]); let c = mins(x[1]); if (c <= o) c = 1439; return [o, c]; };
  if (!S.plan.open_days) S.plan.open_days = Object.keys(data.hours || {}).length ? Object.keys(data.hours).map(Number).sort() : [0, 1, 2, 3, 4, 5, 6];
  const open = () => [...S.plan.open_days].sort((a, b) => a - b);
  const windows = () => (S.plan.windows || []).map((w) => ({ ...w, weekdays: w.weekdays.filter((d) => open().includes(d)) })).filter((w) => w.weekdays.length);
  const dealDishes = () => (data.dishes || []).filter((d) => d.kind === "main" || d.kind === "starter");
  const option = () => S.rec?.options.find((o) => o.key === (S.plan.option || "balanced"));
  const items = () => S.plan.deal_items ?? option()?.deal_items ?? [];
  const tables = () => S.plan.tables ?? option()?.tables ?? 4;
  // staff (0211): what the quiet windows cost and how many tables cover it
  const staffN = () => S.plan.staff_count ?? S.rec?.staff?.count ?? 3;
  const wage = () => S.plan.staff_wage ?? S.rec?.staff?.wage ?? 20;
  const winDays = () => windows().reduce((a, w) => a + w.weekdays.length, 0);
  const hoursPer = () => { const n = winDays(); return n ? windows().reduce((a, w) => a + ((mins(w.end) - mins(w.start)) / 60 + 1) * w.weekdays.length, 0) / n : (S.rec?.staff?.hours_per_window ?? 2.5); };
  const staffWin = () => Math.round(staffN() * wage() * hoursPer());
  const quietMonth = () => Math.round(staffWin() * Math.max(1, winDays()) * 52 / 12);
  const perTable = () => option()?.kept_per_table ?? S.rec?.staff?.kept_per_table ?? (option() ? option().guest.keep * 2 : 33);
  const breakEven = () => Math.max(1, Math.ceil(staffWin() / Math.max(1, perTable())));
  const signed = (v) => `<span class="nw">${v < 0 ? "−" : "+"}${usd(Math.abs(v))}</span>`;
  const fits = (c, d) => { const [o, cl] = hoursOf(d); return mins(c.start) >= o && mins(c.end) <= cl - 30; };

  const save = async () => { S.plan.step = S.step; try { data = await rpc("save_deal_setup", { p_venue: venueId, p_plan: clean(S.plan) }); } catch (e) { S.msg = errText(e); } };
  const clean = (p) => ({ ...p, windows: p.windows?.map(({ share, ...w }) => w) });
  const loadRec = async () => {
    try { S.rec = await rpc("deal_recommendation", { p_venue: venueId, p_overrides: clean({ windows: windows().length ? windows() : undefined, open_days: open(), food_cost_pct: S.plan.food_cost_pct, required_item: S.plan.required_item, staff_count: S.plan.staff_count, staff_wage: S.plan.staff_wage }) }); }
    catch (e) { S.msg = errText(e); }
  };
  const next = async () => { S.msg = ""; await save(); S.step = Math.min(STEPS - 1, S.step + 1); S.sub = null; if (S.step >= 5) await loadRec(); draw(); };
  const fn = async (body) => {
    const token = await Auth.token();
    const res = await fetch(`${CFG.functionsUrl || CFG.url + "/functions/v1"}/deal-setup`, { method: "POST", headers: { apikey: CFG.key, Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new EB.ApiError(j.error || "server_error", j.error || "That didn't work. Try again.", res.status);
    return j;
  };
  const addFile = async (file, kind) => {
    if (file.size > 15 * 1024 * 1024) throw new Error("That file is over 15 MB.");
    const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5);
    const path = `venues/${venueId}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const type = file.type || (ext === "csv" ? "text/csv" : ext === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/octet-stream");
    await upload("deal-setup", path, new Blob([file], { type }));
    return (await rpc("add_setup_file", { p_venue: venueId, p_kind: kind, p_path: path, p_file_name: file.name.slice(0, 120), p_mime: type })).id;
  };
  const busy = async (text, work) => { S.busy = text; draw(); try { await work(); } catch (e) { S.msg = e instanceof EB.ApiError ? errText(e) : e.message; } S.busy = ""; draw(); };

  function preview() {
    if (S.step === 0) return "";
    const bits = [dayList(open())], ws = windows();
    if (ws.length) bits.push(ws.slice(0, 2).map(winLabel).join(" & ") + (ws.length > 2 ? ` +${ws.length - 2}` : ""));
    if (S.step >= 6) { const n = items().length || dealDishes().length; if (n) bits.push(`${n} dishes`); bits.push(`${tables()} tables`); }
    return `<p class="prev"><b>50% off food</b>${esc(bits.join(" · "))}</p>`;
  }
  const big = (id, icon, title, detail, on) => `<button type="button" class="big" data-a="${id}" ${on !== undefined ? `aria-pressed="${!!on}"` : ""}><span class="ic">${IC[icon] || icon}</span><span><b>${esc(title)}</b>${detail ? `<small>${esc(detail)}</small>` : ""}</span>${on !== undefined ? `<span class="dtk">${IC.tick}</span>` : ""}</button>`;
  const foot = (primary, later, enabled = true) => `<div class="foot">${preview()}${S.msg ? note(S.msg) : ""}
    ${primary ? `<button class="btn" type="button" id="ds-go" ${enabled ? "" : "disabled"}>${esc(primary)}</button>` : ""}${later ? `<button class="later" type="button" id="ds-later">${esc(later)}</button>` : ""}</div>`;

  function body() {
    if (S.busy) return `<p class="busy">${esc(S.busy)}</p>`;
    switch (S.step) {
      case 0: return `<h1 class="q">Fill your quiet hours</h1><p class="sub">Here's the whole idea, in three lines.</p>
        <div class="crd"><ol class="three"><li><b>Guests get 50% off food</b><small>Only in the quiet times you pick. Drinks stay full price.</small></li>
        <li><b>They pay us a small booking fee</b><small>So they turn up. You pay nothing per booking.</small></li>
        <li><b>Listing is free</b><small>Pause or change your deal any time.</small></li></ol></div>
        <p class="sub">We'll ask a few quick questions and suggest a deal. About 3 minutes. You can skip anything and come back.</p>${foot("Let's set it up")}`;
      case 1: return `<h1 class="q">Which days are you open?</h1><p class="sub">Click a day to switch it. Hours are from your listing.</p>
        <div class="days" role="group" aria-label="Open days">${SHORT.map((d, k) => `<button type="button" class="dchip" data-day="${k}" aria-pressed="${open().includes(k)}" aria-label="${DAYS[k]}">${d[0]}</button>`).join("")}</div>
        <div class="crd hrs">${DAYS.map((d, k) => { const on = open().includes(k), [o, c] = hoursOf(k); return `<div class="kv"><span>${d}</span><span>${on ? `<select class="hr" data-day="${k}" data-w="0" aria-label="${d} opens">${opts(o, 300, 840)}</select>–<select class="hr" data-day="${k}" data-w="1" aria-label="${d} closes">${opts(c, o + 60, 1410)}</select>` : `<span class="closed">Closed</span>`}</span></div>`; }).join("")}</div>
        ${foot("Next", null, open().length > 0)}`;
      case 2: return quietBody();
      case 3: return menuBody();
      case 4: return costBody();
      case 5: return staffBody();
      case 6: return recBody();
      default: return reviewBody();
    }
  }
  const opts = (sel, lo, hi) => { let s = ""; for (let m = lo; m <= hi; m += 30) s += `<option value="${m}" ${m === sel ? "selected" : ""}>${time12(hhmm(m))}</option>`; return s; };

  function quietBody() {
    const mode = S.plan.busy_mode;
    if (!mode) return `<h1 class="q">Are your quiet times the same every day?</h1><p class="sub">The deal only runs when you'd have empty tables anyway.</p>
      ${big("same", "same", "Yes, about the same", "Pick them once")}${big("per_day", "per_day", "No, it changes by day", "Pick them for each day")}
      ${big("pos", "pos", "Work it out from my sales", "Upload a report from Toast, Square, Clover, Lightspeed…")}${foot(null, "I'm not sure: suggest something")}`;
    if (mode === "pos") {
      const sp = data.sales_profile;
      if (!sp) return `<h1 class="q">Upload a sales report</h1><p class="sub">Any export with sales by hour or by order time: CSV, Excel or PDF. Four weeks or more is best.</p>
        <div class="crd"><b>Where to find it</b>${POS_HELP.map(([k, v]) => `<div class="kv"><span>${k}</span><span>${v}</span></div>`).join("")}</div>
        <label class="big"><span class="ic">${IC.upload}</span><span><b>Choose a file</b><small>CSV, Excel (.xlsx) or PDF</small></span><input type="file" id="ds-pos" accept=".csv,.xlsx,.xls,.pdf,image/*" hidden></label>
        <p class="sub small">We only use it to find your quiet hours. It stays private to your restaurant.</p>${foot(null, "Pick times myself instead")}`;
      const sug = S.rec?.windows_source === "sales" ? S.rec.windows : [];
      return `<h1 class="q">Here's when you're quiet</h1><p class="sub">From ${sp.weeks ? `${sp.weeks} week${sp.weeks === 1 ? "" : "s"} of ` : ""}your sales. Outlined: quiet enough for the deal.</p>
        ${heat(sp.hourly)}
        <div class="crd"><b>Suggested deal times</b>${sug.length ? sug.map((w, i) => `<label class="dish"><input type="checkbox" class="sugw" data-i="${i}" ${windows().some((x) => x.meal === w.meal && x.start === w.start && x.end === w.end) ? "checked" : ""}><span class="nm">${winLabel(w)}<small>${dayList(w.weekdays)}</small></span></label>`).join("")
          : `<p class="sub">We couldn't find a quiet stretch of 2 hours or more. Pick times yourself instead.</p>`}</div>
        <p class="sub small">Your busy hours stay full price.</p>${foot("Use these times", "Pick times myself", windows().length > 0)}`;
    }
    const perDay = mode === "per_day", day = S.sub ?? open()[0];
    const days = perDay ? [day] : open();
    return `<h1 class="q">When is it quiet?</h1><p class="sub">${perDay ? "Pick a day, then click its quiet times." : "Click all that apply, for every day you're open."}</p>
      ${perDay ? `<div class="days">${open().map((d) => `<button type="button" class="dchip pd" data-day="${d}" aria-pressed="${d === day}">${SHORT[d]}</button>`).join("")}</div>` : ""}
      ${CHIPS.filter((c) => days.some((d) => fits(c, d))).map((c) => big("chip:" + c.id, "clock", `${c.title}, ${time12(c.start)}–${time12(c.end)}`, `First booking ${time12(c.start)}, last ${time12(c.end)}`, chipOn(c, days))).join("")}
      ${perDay ? `<div class="crd">${open().map((d) => { const ws = windows().filter((w) => w.weekdays.includes(d)).map(winLabel); return `<div class="kv"><span>${DAYS[d]}</span><span>${ws.length ? ws.join(", ") : "None yet"}</span></div>`; }).join("")}</div>` : ""}
      ${foot("Next", "Work it out from my sales instead", windows().length > 0)}`;
  }
  const chipOn = (c, days) => windows().some((w) => w.meal === c.meal && w.start === c.start && w.end === c.end && w.weekdays.some((d) => days.includes(d)));
  function setChip(c, on, days) {
    const fit = days.filter((d) => fits(c, d));
    let ws = (S.plan.windows || []).map((w) => (w.meal === c.meal ? { ...w, weekdays: w.weekdays.filter((d) => !fit.includes(d)) } : w)).filter((w) => w.weekdays.length);
    if (on) { const i = ws.findIndex((w) => w.meal === c.meal && w.start === c.start && w.end === c.end); if (i >= 0) ws[i].weekdays = [...new Set([...ws[i].weekdays, ...fit])].sort(); else ws.push({ meal: c.meal, start: c.start, end: c.end, weekdays: fit }); }
    S.plan.windows = ws;
  }
  function heat(hourly) {
    const lo = Math.max(5, Math.min(...open().map((d) => Math.floor(hoursOf(d)[0] / 60)))), hi = Math.min(24, Math.max(...open().map((d) => Math.ceil(hoursOf(d)[1] / 60))));
    const hrs = []; for (let x = lo; x < hi; x++) hrs.push(x);
    let g = `<div class="heat" style="grid-template-columns:30px repeat(${hrs.length},minmax(14px,1fr))"><span class="h"></span>${hrs.map((x) => `<span class="h">${x % 2 ? "" : x % 12 || 12}</span>`).join("")}`;
    for (const d of [1, 2, 3, 4, 5, 6, 0]) {
      const peak = Math.max(1, ...(hourly[d] || [])), [o, c] = hoursOf(d);
      g += `<span class="d">${SHORT[d].slice(0, 2)}</span>`;
      for (const x of hrs) {
        const isOpen = open().includes(d) && x * 60 >= o - 30 && x * 60 < c;
        const inW = windows().some((w) => w.weekdays.includes(d) && x * 60 >= mins(w.start) - 30 && x * 60 <= mins(w.end));
        const v = (hourly[d] || [])[x] || 0;
        g += isOpen ? `<span class="${inW ? "w" : ""}" style="background:rgba(156,116,18,${(0.1 + 0.9 * Math.min(1, v / peak)).toFixed(2)})" title="${DAYS[d]} ${time12(hhmm(x * 60))}"></span>` : `<span class="x"></span>`;
      }
    }
    return `<div class="crd">${g}</div></div><p class="sub small" style="margin-top:-4px">Darker = busier. Outlined = deal time. Striped = closed.</p>`;
  }

  function menuBody() {
    if (S.sub === "confirm" && S.menu) {
      const m = S.menu, n = m.sections.reduce((a, s) => a + s.items.length, 0);
      return `<h1 class="q">Is this your menu?</h1><p class="sub">${n} dishes. Untick anything that's wrong; you can fix prices later on your page.</p>
        ${m.name_matches === false && m.name_seen ? note(`This menu is for “${m.name_seen}”. Check it's your restaurant.`) : ""}
        ${m.sections.map((s, si) => `<div class="crd"><b>${esc(s.name)}</b>${s.items.map((it, ii) => `<label class="dish"><input type="checkbox" class="mi" data-s="${si}" data-i="${ii}" checked><span class="nm">${esc(it.name)}</span><span>${it.price != null ? usd(it.price, it.price % 1 !== 0) : "No price"}</span></label>`).join("")}</div>`).join("")}
        ${(data.dishes || []).length ? `<p class="sub small">This replaces the ${data.dishes.length} dishes on your Early Bird page.</p>` : ""}${foot("Looks right", "Start again")}`;
    }
    if (S.sub === "link") return `<h1 class="q">Paste your menu link</h1><p class="sub">The menu page of your website, or your restaurant on Toast, Square or another ordering site. We read that one page.</p>
      <input type="url" id="ds-link" placeholder="https://" aria-label="Menu link" value="${esc(S.plan.menu_source?.url || "")}">
      <p class="sub small">DoorDash and Uber Eats don't let websites read their pages. For those, use the Early Bird app (it opens your store for you), or upload screenshots or a PDF here.</p>${foot("Get my menu", "Back")}`;
    if (S.sub === "type") return `<h1 class="q">Type your menu</h1><p class="sub">One dish per line with its price, like “Margherita pizza 19”. A line without a price starts a new section.</p>
      <textarea id="ds-typed" rows="10" aria-label="Your menu"></textarea>${foot("Check it", "Back")}`;
    if ((data.dishes || []).length && S.sub !== "replace") return `<h1 class="q">We have your menu</h1><p class="sub">${data.dishes.length} dishes are on your Early Bird page. We'll use them to suggest your deal.</p>
      <div class="crd">${data.dishes.slice(0, 6).map((d) => `<div class="kv"><span>${esc(d.name)}</span><span>${usd(d.price)}</span></div>`).join("")}${data.dishes.length > 6 ? `<p class="sub small">and ${data.dishes.length - 6} more</p>` : ""}</div>${foot("Use this menu", "Replace it with my latest menu")}`;
    return `<h1 class="q">Add your menu</h1><p class="sub">So we can suggest which dishes go on the deal. You can skip this.</p>
      ${big("link", "link", "Import it from your website", "Your website's menu page, Toast, Square…")}
      <label class="big"><span class="ic">${IC.photo}</span><span><b>Upload a photo, screenshot or PDF</b><small>A paper menu, your DoorDash page as a screenshot, or a PDF</small></span><input type="file" id="ds-menu" accept="image/*,.pdf" hidden></label>
      ${big("type", "type", "Type it", "One dish per line, with its price")}${foot(null, "Do this later")}`;
  }
  function typedMenu(text) {
    const out = []; let cur = { name: "Menu", items: [] };
    for (const raw of text.split(/\n/)) {
      const line = raw.trim(); if (!line) continue;
      const m = /^(.+?)[\s\-–—:.]*\$?\s*(\d{1,4}(?:\.\d{1,2})?)\s*$/.exec(line);
      if (m && m[1].trim()) cur.items.push({ name: m[1].trim().slice(0, 120), price: +m[2], description: "" });
      else { if (cur.items.length) out.push(cur); cur = { name: line.replace(/:$/, "").slice(0, 80), items: [] }; }
    }
    if (cur.items.length) out.push(cur);
    return out;
  }

  function costBody() {
    const mode = S.plan.cost_mode || "overall", pct = S.plan.food_cost_pct ?? 30;
    const pill = (k, l, dis) => `<button type="button" class="pill cm" data-k="${k}" aria-pressed="${mode === k}" ${dis ? "disabled" : ""}>${l}</button>`;
    let inner;
    if (mode === "per_dish") inner = `<div class="crd">${dealDishes().map((d) => `<div class="kv"><span>${esc(d.name)}<br><small>${usd(d.price)}${d.cost_source === "invoice_estimate" ? " · from your invoices" : ""}</small></span><span><label class="field"><input type="number" class="dc" data-id="${esc(d.id)}" min="5" max="80" value="${Math.round(d.cost_pct)}" aria-label="${esc(d.name)} food cost %"><i>%</i></label></span></div>`).join("")}</div>`;
    else if (mode === "upload") inner = `<label class="big"><span class="ic">${IC.upload}</span><span><b>Choose a file</b><small>A cost sheet (dish and cost) or supplier invoices (Sysco, US Foods…). We work out each dish's cost.</small></span><input type="file" id="ds-cost" accept=".csv,.xlsx,.xls,.pdf,image/*" hidden></label>
      <p class="sub small">Invoices give an estimate per dish, marked as one. You can change any of them in Per dish.</p>`;
    else inner = `<div class="crd"><b>Food cost</b><div class="stat"><span class="big-n" id="ds-pct">${pct}%</span><span>of the menu price</span></div>
      <input type="range" id="ds-fc" min="15" max="45" step="1" value="${pct}" aria-label="Food cost percent"><p class="sub small">Not sure? Leave it at 30%.</p></div>`;
    return `<h1 class="q">What does your food cost you?</h1><p class="sub">Ingredients as a share of the menu price. Most restaurants are 28–32%.</p>
      <div class="pills">${pill("overall", "One number")}${pill("per_dish", "Per dish", !dealDishes().length)}${pill("upload", "Upload")}</div>${inner}${foot("Next", "Skip: use 30%")}`;
  }

  function staffBody() {
    const n = staffN(), be = breakEven();
    return `<h1 class="q">Who works your quiet hours?</h1><p class="sub">The people on shift while the deal runs. It shows how many tables pay for them.</p>
      <div class="crd"><div class="kv"><span><b>People on shift</b><br><small>A cook, a server and a dishwasher is typical</small></span><span><label class="field"><input type="number" id="ds-staff" min="1" max="30" value="${n}" inputmode="numeric" aria-label="People on shift"></label></span></div>
        <div class="kv"><span><b>Pay an hour, each</b><br><small>Average pay, with payroll taxes if you like</small></span><span><label class="field"><i>$</i><input type="number" id="ds-wage" min="10" max="80" step="1" value="${wage()}" inputmode="numeric" aria-label="Pay an hour"></label></span></div></div>
      <div class="crd"><b>What your quiet times cost now</b><div class="stat"><span class="big-n" id="ds-sw">${usd(staffWin())}</span><span>in staff each time</span></div>
        <p class="sub small" id="ds-sm">About ${usd(quietMonth())} a month for your ${Math.max(1, winDays())} quiet window${winDays() === 1 ? "" : "s"} a week, while those tables sit empty.</p></div>
      <div class="crd"><b>What covers it</b><div class="stat"><span class="big-n" id="ds-be">${be}</span><span id="ds-bel">${be === 1 ? "table pays" : "tables pay"} for your staff</span></div>
        <p class="sub small" id="ds-bet">Each Early Bird table keeps about ${usd(perTable())} after food cost (2 guests). Every table after ${be} is money you weren't making.</p>
        <p class="sub small">An estimate from your answers, not a promise of bookings.</p></div>
      ${foot("Next", "Skip: use 3 people at $20")}`;
  }
  function recBody() {
    const r = S.rec;
    if (!r) return `<h1 class="q">Here's what we'd do</h1>${foot("Try again")}`;
    const o = option();
    // 0224: a low–likely range from demand near the restaurant; older backends: half the tables to every table
    const range = (x) => (x.estimate ? `${usd(x.estimate.kept_per_month.low)}–${usd(x.estimate.kept_per_month.likely)}/mo` : `${usd(x.kept_per_month_half_full)}–${usd(x.kept_per_month)}/mo`);
    const pct = (f) => `${Math.round(f * 100)}%`;
    const est = o?.estimate;
    // the restaurants page talks about up to 5 early tables: never suggest more than that
    const offerLine = (e) => (e.offer_for_break_even <= 5
      ? `To cover your staff at a likely ${pct(e.fill.likely)} of tables booked, offer about ${e.offer_for_break_even} tables each time.`
      : `At a likely ${pct(e.fill.likely)} of tables booked, even 5 tables won't cover your staff on their own. Every table that books still brings in money those quiet hours aren't making.`);
    const list = r.dishes.filter((d) => d.kind === "main" || d.kind === "starter");
    const whole = o?.whole_menu && S.plan.deal_items == null, chosen = new Set(items());
    return `<h1 class="q">Here's what we'd do</h1><p class="sub">Pick one. You can change anything after.</p><span class="est">${esc(r.label)}</span>
      ${(r.based_on || []).length ? `<div class="crd"><b>Based on</b><ul class="sub small" style="margin:6px 0 0;padding-left:18px">${r.based_on.map((l) => `<li>${esc(l)}</li>`).join("")}</ul></div>` : ""}
      ${r.options.map((x) => `<button type="button" class="opt" data-o="${x.key}" aria-pressed="${(S.plan.option || "balanced") === x.key}"><div class="t"><b>${esc(x.title)}${x.recommended ? '<span class="tag">Our pick</span>' : ""}</b><span class="n">${range(x)}</span></div><p>${esc(x.line)}</p></button>`).join("")}
      ${o ? `<div class="crd"><b>${esc(o.title)}, in detail</b>
        <div class="kv"><span>Deal times</span><span>${(windows().length ? windows() : o.windows).map(winLabel).join(", ") || "5:00–6:30PM"}</span></div>
        <div class="kv"><span>Tables each time</span><span>${tables()}</span></div>
        ${est ? `<div class="kv"><span>Tables that book, likely</span><span>${pct(est.fill.likely)} (${pct(est.fill.low)}–${pct(est.fill.high)})</span></div>
          <div class="kv"><span>Guests a month, likely</span><span>${Math.round(est.guests_per_month.likely)} (${Math.round(est.guests_per_month.low)}–${Math.round(est.guests_per_month.high)})</span></div>
          <div class="kv"><span>Party size</span><span>${est.party_size}</span></div>`
          : `<div class="kv"><span>Guests a month, if every table books</span><span>${Math.round(o.guests_per_month)}</span></div>`}
        <div class="kv"><span>You keep per guest, after food cost</span><span>${usd(o.guest.keep, true)}</span></div>
        <div class="kv"><span>Kept per deal time${est ? ", likely" : ""}</span><span>${usd(est ? est.kept_per_month.likely / Math.max(1, o.windows_per_week * 52 / 12) : o.kept_per_window)}</span></div>
        <div class="kv"><span>Guests who come back at full price</span><span>+${usd(est ? est.come_back_per_month : o.come_back_per_month)}/mo</span></div>
        ${o.break_even_tables != null ? `<div class="kv"><span>Staff on each deal time</span><span>${usd(staffWin())}</span></div><div class="kv"><span>Tables that cover your staff, if every table books</span><span>${o.break_even_tables}</span></div>` : ""}
        <div class="kv tot"><b>Kept a month, after ingredients</b><b>${range(o)}</b></div>
        ${o.net_per_month != null ? `<div class="kv"><span>Quiet hours now (staff, empty tables)</span><span>${signed(-o.staff_cost_per_month)}/mo</span></div><div class="kv tot"><b>With Early Bird, after staff</b><b>${est ? `${signed(est.net_per_month.low)} to ${signed(est.net_per_month.likely)}` : `${signed(o.net_per_month_half_full)} to ${signed(o.net_per_month)}`}/mo</b></div>` : ""}
        ${est && est.offer_for_break_even ? `<p class="sub small">${offerLine(est)}</p>` : ""}
        <p class="sub small">${est ? "Estimate: a likely range from demand near you, not a promise of bookings." : "Estimate: half the tables booked to every table booked. Not a promise of bookings."}</p></div>` : ""}
      <div class="crd"><b>Each guest also orders, at full price</b><div class="pills">${[["drink", "A drink"], ["starter", "A starter"], ["dessert", "A dessert"], ["none", "Nothing"]].map(([k, l]) => `<button type="button" class="pill ri" data-k="${k}" aria-pressed="${(S.plan.required_item || "drink") === k}">${l}</button>`).join("")}</div>
        <p class="sub small">That's where most of your margin is. A drink is the usual choice.</p></div>
      <div class="crd"><b>On the deal menu</b><p class="sub small">${whole ? "Your whole food menu. Untick dishes to keep them off the deal." : "Best margin at 50% off, and your best sellers. Drinks and desserts stay off the deal."}</p>
        ${list.length ? list.map((d) => `<label class="dish"><input type="checkbox" class="di" data-id="${esc(d.id)}" ${whole || chosen.has(d.id) ? "checked" : ""}><span class="nm">${esc(d.name)}<small class="${d.note === "Thin at 50% off" ? "thin" : ""}">You keep ${usd(d.keep_at_half, true)} after food cost${d.note ? " · " + esc(d.note) : ""}</small></span><span>${usd(d.price, d.price % 1 !== 0)}</span></label>`).join("")
          : `<p class="sub small">Add your menu to pick dishes. Until then, the deal covers your whole food menu.</p>`}
        <div id="ds-check">${S.check && !S.check.ok ? note(S.check.errors.join(". ")) : ""}</div></div>
      <details><summary>How we worked this out</summary><ul>${r.assumptions.lines.map((l) => `<li>${esc(l)}</li>`).join("")}<li>The same averages as <a href="../restaurants/">our restaurants page</a>.</li></ul></details>
      ${foot(`Use ${(o?.title || "this").toLowerCase()}`, null, !(S.check && !S.check.ok))}`;
  }

  const req = () => REQ[S.plan.required_item || "drink"] || null;
  const uncovered = () => open().filter((d) => !(S.leave || []).includes(d) && !windows().some((w) => w.weekdays.includes(d)));
  const wordingChanged = () => approved && JSON.stringify((ls.setup?.requirements || []).map((r) => r.label)) !== JSON.stringify(req() ? [req().label] : []);
  const beLine = () => { const be = breakEven(), t = tables(); return t >= be ? `${be} ${be === 1 ? "table covers" : "tables cover"} your staff (${usd(staffWin())} each time). Every table after that is extra.` : `You need ${be} tables to cover your staff (${usd(staffWin())} each time). Add ${be - t} more.`; };
  function reviewBody() {
    const pl = ls.pledge || {};
    return `<h1 class="q">Your deal</h1><p class="sub">This is what diners will see.</p>
      <div class="crd"><div class="kv"><span>Days</span><span>${dayList(open().filter((d) => !(S.leave || []).includes(d)))}</span></div>
        <div class="kv"><span>When</span><span>${windows().map((w) => `${winLabel(w)} ${dayList(w.weekdays)}`).join("<br>") || "—"}</span></div>
        <div class="kv"><span>Tables each time</span><span><label class="field"><input type="number" id="ds-tables" min="1" max="20" value="${tables()}" inputmode="numeric" aria-label="Tables each time"></label></span></div>
        <p class="small ${tables() >= breakEven() ? "okt" : "warn"}" id="ds-ber">${beLine()}</p>
        <div class="kv"><span>Deal</span><span>${items().length ? `50% off ${items().length} dishes` : "50% off your food menu"}</span></div>
        <div class="kv"><span>Each guest also orders</span><span>${req() ? `1 ${req().label.toLowerCase()}, full price` : "Nothing"}</span></div></div>
      ${uncovered().map((d) => `<div class="msg info"><b>${DAYS[d]} has no deal time.</b> Early Bird needs at least one table each day you list.<div class="pills"><button type="button" class="pill fix" data-day="${d}">Add 1 table, 5:00–6:30PM</button><button type="button" class="pill leave" data-day="${d}">Leave ${SHORT[d]} out</button></div></div>`).join("")}
      ${wordingChanged() && pl.version ? `<div class="pledge"><div class="title">${esc(pl.title || "Our fair-deal promise")}</div><ul>${(pl.statements || []).map((s) => `<li>${esc(s)}</li>`).join("")}</ul><label class="check"><input type="checkbox" id="ds-pl"><span>You changed what each guest orders, so tick it again: ${esc((pl.checkbox || "We agree to all three, for <restaurant name>.").replace(/<restaurant name>/i, ls.venue_name || "our restaurant"))}</span></label></div>` : ""}
      <p class="sub small">${approved ? "Saving changes your live deal at once." : "Nothing goes to diners yet. Next you'll promise to honour it and send it, from your listing page."}</p>
      ${foot(approved ? "Save: diners see it now" : "Save my deal", null, windows().length > 0)}`;
  }
  function meals() {
    const used = new Set(), out = [], days = open().filter((d) => !(S.leave || []).includes(d));
    for (const w of [...windows()].sort((a, b) => (a.share ?? 1) - (b.share ?? 1))) {
      const wd = w.weekdays.filter((d) => days.includes(d) && !used.has(`${w.meal}-${d}`));
      if (!wd.length) continue;
      wd.forEach((d) => used.add(`${w.meal}-${d}`));
      out.push({ meal: w.meal, start: w.start, end: w.end, weekdays: wd.sort(), tables: tables() });
    }
    return out;
  }

  function draw() {
    show(`<div class="dshead"><button type="button" class="dsb" id="ds-back" aria-label="Back" ${S.step > 0 || S.sub || S.plan.busy_mode && S.step === 2 ? "" : "hidden"}>${IC.back}</button>
        <div class="dsmid"><span class="dsbrand"><img src="../img/bird-mark-gradient.png" alt="">Set your deal</span></div>
        <a class="dsx" href="#/biz/v/${esc(venueId)}" aria-label="Close and go back to your listing">${IC.close}</a></div>
      <div class="dsbar" role="progressbar" aria-valuemin="1" aria-valuemax="${STEPS}" aria-valuenow="${S.step + 1}">${Array.from({ length: STEPS }, (_, k) => `<i class="${k <= S.step ? "on" : ""}"></i>`).join("")}</div>
      <div class="dsstep">Step ${S.step + 1} of ${STEPS}</div>
      ${body()}`);
    if (!S.busy) wire();            // while busy only the "Working…" line is on screen: nothing to wire
  }

  function wire() {
    const $ = (id) => document.getElementById(id), all = (sel) => document.querySelectorAll(sel);
    const on = (id, f) => { const el = $(id); if (el) el.onclick = f; };
    on("ds-back", () => { S.msg = ""; if (S.sub) { S.sub = null; } else if (S.step === 2 && S.plan.busy_mode) { S.plan.busy_mode = null; } else S.step--; draw(); });
    const go = $("ds-go"), later = $("ds-later");
    if (S.step === 0) go.onclick = next;
    if (S.step === 1) {
      all(".dchip").forEach((b) => (b.onclick = () => { const d = +b.dataset.day, s = new Set(open()); s.has(d) ? s.delete(d) : s.add(d); S.plan.open_days = [...s].sort(); draw(); }));
      all(".hr").forEach((sel) => (sel.onchange = () => { const d = sel.dataset.day, [o, c] = hoursOf(+d), v = +sel.value; S.plan.hours = { ...(S.plan.hours || data.hours || {}), [d]: sel.dataset.w === "0" ? [hhmm(v), hhmm(Math.max(c, v + 60))] : [hhmm(o), hhmm(v)] }; draw(); }));
      go.onclick = next;
    }
    if (S.step === 2) {
      all(".big[data-a]").forEach((b) => (b.onclick = () => {
        const a = b.dataset.a;
        if (a.startsWith("chip:")) { const c = CHIPS.find((x) => x.id === a.slice(5)), days = S.plan.busy_mode === "per_day" ? [S.sub ?? open()[0]] : open(); setChip(c, !chipOn(c, days), days); }
        else { S.plan.busy_mode = a; if (a === "pos" && data.sales_profile) loadRec().then(draw); }
        draw();
      }));
      all(".pd").forEach((b) => (b.onclick = () => { S.sub = +b.dataset.day; draw(); }));
      all(".sugw").forEach((b) => (b.onchange = () => { const w = S.rec.windows[+b.dataset.i]; let ws = (S.plan.windows || []).filter((x) => !(x.meal === w.meal && x.start === w.start && x.end === w.end)); if (b.checked) ws.push(w); S.plan.windows = ws; draw(); }));
      const pf = $("ds-pos");
      if (pf) pf.onchange = () => { const f = pf.files?.[0]; if (!f) return; busy("Reading your report…", async () => {
        const id = await addFile(f, "pos"), r = await fn({ action: "read_pos", file_id: id });
        if (!r.ok) throw new Error(r.reason === "not_a_sales_report" ? "That doesn't look like a sales report. Try an export of sales by hour or by order time." : "We couldn't read that file. Try a CSV or Excel export.");
        data = r.setup; S.rec = r.recommendation; S.plan.busy_mode = "pos"; if (r.recommendation?.windows_source === "sales") S.plan.windows = r.recommendation.windows; S.msg = "";
      }); };
      if (later) later.onclick = () => {
        if (!S.plan.busy_mode) { S.plan.busy_mode = "same"; if (!windows().length) setChip(CHIPS[3], true, open()); }
        else S.plan.busy_mode = S.plan.busy_mode === "pos" ? "same" : "pos";
        if (S.plan.busy_mode === "pos" && data.sales_profile) loadRec().then(draw);
        draw();
      };
      if (go) go.onclick = next;
    }
    if (S.step === 3) {
      all(".big[data-a]").forEach((b) => (b.onclick = () => { S.sub = b.dataset.a; draw(); }));
      const mf = $("ds-menu");
      if (mf) mf.onchange = () => { const f = mf.files?.[0]; if (!f) return; S.plan.menu_source = { kind: "photo" }; busy("Reading your menu…", async () => {
        const id = await addFile(f, "menu"), r = await fn({ action: "read_menu_file", file_id: id });
        if (!r.ok) throw new Error(r.reason === "not_a_menu" ? "We couldn't find a menu in that. Try a clearer photo or a PDF." : "We couldn't read that. Try another photo.");
        S.menu = { ...r.menu, name_seen: r.name_seen, name_matches: r.name_matches }; S.sub = "confirm";
      }); };
      if (S.sub === "link") {
        go.onclick = () => { let u = $("ds-link").value.trim(); if (!u) return; if (!/^https?:/i.test(u)) u = "https://" + u;
          S.plan.menu_source = { kind: /doordash|order\.online/i.test(u) ? "doordash" : /ubereats/i.test(u) ? "ubereats" : "website", url: u };
          busy("Reading your menu…", async () => {
            const r = await fn({ action: "read_menu_url", venue_id: venueId, url: u });
            if (!r.ok) throw new Error(r.open_in_app ? "That page doesn't open for us. Upload screenshots or a PDF of your menu instead, or use the Early Bird app." : r.reason === "not_a_menu" ? "We couldn't find a menu there. Try the page that lists your dishes and prices." : "We couldn't open that page. Check the link.");
            S.menu = { ...r.menu, name_seen: r.name_seen, name_matches: r.name_matches }; S.sub = "confirm";
          }); };
        later.onclick = () => { S.sub = null; draw(); };
      } else if (S.sub === "type") {
        go.onclick = () => { const secs = typedMenu($("ds-typed").value); if (!secs.length) { S.msg = "Add at least one dish with a price."; return draw(); } S.menu = { sections: secs }; S.plan.menu_source = { kind: "typed" }; S.sub = "confirm"; S.msg = ""; draw(); };
        later.onclick = () => { S.sub = null; draw(); };
      } else if (S.sub === "confirm") {
        go.onclick = () => {
          // read the ticks before the "Saving…" screen replaces them
          const keep = S.menu.sections.map((s, si) => ({ name: s.name, items: s.items.filter((_, ii) => document.querySelector(`.mi[data-s="${si}"][data-i="${ii}"]`)?.checked !== false).map((i) => ({ name: i.name, description: i.description || "", price: i.price ?? 0 })) })).filter((s) => s.items.length);
          if (!keep.length) { S.msg = "Keep at least one dish, or go back."; return draw(); }
          busy("Saving your menu…", async () => {
          await rpc("save_menu", { p_venue: venueId, p_sections: keep });
          data = await rpc("deal_setup", { p_venue: venueId }); S.plan.deal_items = null; S.menu = null; S.sub = null;
          await save(); S.step = 4;
        }); };
        later.onclick = () => { S.sub = null; S.menu = null; draw(); };
      } else {
        if (go) go.onclick = next;
        if (later) later.onclick = () => { if ((data.dishes || []).length && S.sub !== "replace") { S.sub = "replace"; draw(); } else { S.plan.menu_source = { kind: "later" }; next(); } };
      }
    }
    if (S.step === 4) {
      all(".cm").forEach((b) => (b.onclick = () => { S.plan.cost_mode = b.dataset.k; draw(); }));
      const r = $("ds-fc"); if (r) r.oninput = () => { S.plan.food_cost_pct = +r.value; $("ds-pct").textContent = r.value + "%"; };
      const cf = $("ds-cost");
      if (cf) cf.onchange = () => { const f = cf.files?.[0]; if (!f) return; busy("Working out your costs…", async () => {
        const id = await addFile(f, /\.(csv|xlsx?)$/i.test(f.name) ? "costs" : "invoice"), res = await fn({ action: "read_costs", file_id: id });
        if (!res.ok) throw new Error(res.reason === "no_menu_yet" ? "Add your menu first, so we know which dishes to cost." : "We couldn't find dish costs in that file.");
        data = res.setup; S.plan.cost_mode = "per_dish"; toast(`${res.matched} dish${res.matched === 1 ? "" : "es"} costed${res.estimated ? " from your invoices (estimates)" : ""}.`);
      }); };
      go.onclick = () => {
        const mode = S.plan.cost_mode || "overall";
        const costs = [...all(".dc")].map((i) => ({ item_id: i.dataset.id, cost_pct: Math.min(80, Math.max(5, +i.value || 30)) }));   // before "Saving…" replaces them
        busy("Saving…", async () => {
          if (mode === "overall") data = await rpc("save_dish_costs", { p_venue: venueId, p_costs: [], p_overall: S.plan.food_cost_pct ?? 30 });
          if (mode === "per_dish" && costs.length) data = await rpc("save_dish_costs", { p_venue: venueId, p_costs: costs });
          await save(); S.step = 5; await loadRec();   // → staff
        });
      };
      later.onclick = () => { S.plan.food_cost_pct = S.plan.food_cost_pct ?? 30; next(); };
    }
    if (S.step === 5) {
      const upd = () => { $("ds-sw").textContent = usd(staffWin()); $("ds-sm").textContent = `About ${usd(quietMonth())} a month for your ${Math.max(1, winDays())} quiet window${winDays() === 1 ? "" : "s"} a week, while those tables sit empty.`;
        const be = breakEven(); $("ds-be").textContent = be; $("ds-bel").textContent = `${be === 1 ? "table pays" : "tables pay"} for your staff`;
        $("ds-bet").textContent = `Each Early Bird table keeps about ${usd(perTable())} after food cost (2 guests). Every table after ${be} is money you weren't making.`; };
      $("ds-staff").oninput = (e) => { S.plan.staff_count = Math.min(30, Math.max(1, Math.round(+e.target.value || 1))); upd(); };
      $("ds-wage").oninput = (e) => { S.plan.staff_wage = Math.min(80, Math.max(10, +e.target.value || 20)); upd(); };
      go.onclick = () => { S.plan.staff_count = staffN(); S.plan.staff_wage = wage(); next(); };
      later.onclick = () => { S.plan.staff_count = 3; S.plan.staff_wage = 20; next(); };
    }
    if (S.step === 6) {
      if (!S.rec) { go.onclick = () => busy("Working it out…", loadRec); return; }
      all(".opt").forEach((b) => (b.onclick = () => { const o = S.rec.options.find((x) => x.key === b.dataset.o); S.plan.option = o.key; S.plan.deal_items = null; S.plan.tables = null; S.check = null; if (o.key === "margin" || !windows().length) S.plan.windows = o.windows; draw(); }));
      all(".ri").forEach((b) => (b.onclick = () => { S.plan.required_item = b.dataset.k; busy("Working it out…", loadRec); }));
      all(".di").forEach((b) => (b.onchange = async () => {
        const list = [...all(".di")]; const chosen = list.filter((x) => x.checked).map((x) => x.dataset.id);
        S.plan.deal_items = chosen.length === list.length ? [] : chosen;
        S.check = await rpc("deal_menu_preview", { p_venue: venueId, p_items: S.plan.deal_items }).catch(() => null);
        $("ds-check").innerHTML = S.check && !S.check.ok ? note(S.check.errors.join(". ")) : ""; $("ds-go").disabled = !!(S.check && !S.check.ok);
      }));
      go.onclick = () => { const o = option(); if (o) { S.plan.option = o.key; S.plan.deal_items ??= o.deal_items; S.plan.tables ??= o.tables; if (!windows().length) S.plan.windows = o.windows; } next(); };
    }
    if (S.step === 7) {
      // came back straight to the review without times: use the recommendation's
      if (!windows().length && (option()?.windows?.length || S.rec?.windows?.length)) { S.plan.windows = option()?.windows?.length ? option().windows : S.rec.windows; return draw(); }
      const t = $("ds-tables"); if (t) t.oninput = () => { S.plan.tables = Math.min(20, Math.max(1, +t.value || 1)); const b = $("ds-ber"); b.textContent = beLine(); b.className = "small " + (tables() >= breakEven() ? "okt" : "warn"); };
      all(".fix").forEach((b) => (b.onclick = () => { S.plan.windows = [...(S.plan.windows || []), { meal: "dinner", start: "17:00", end: "18:30", weekdays: [+b.dataset.day] }]; draw(); }));
      all(".leave").forEach((b) => (b.onclick = () => { S.leave = [...(S.leave || []), +b.dataset.day]; draw(); }));
      go.onclick = () => {
        if (uncovered().length) { S.msg = `Add a table on ${uncovered().map((d) => DAYS[d]).join(" and ")}, or leave ${uncovered().length > 1 ? "those days" : "it"} out.`; return draw(); }
        if (wordingChanged() && !$("ds-pl")?.checked) { S.msg = "Tick the fair-deal promise first."; return draw(); }
        busy("Saving your deal…", async () => {
          const days = open().filter((d) => !(S.leave || []).includes(d));
          const setup = { meals: meals(), closed_days: [0, 1, 2, 3, 4, 5, 6].filter((d) => !days.includes(d)), requirements: req() ? [req()] : [],
            conditions: ls.setup?.conditions?.length ? ls.setup.conditions : CONDITIONS, ...(wordingChanged() ? { pledge: ls.pledge?.version } : {}) };
          S.plan.step = 6; await rpc("save_deal_setup", { p_venue: venueId, p_plan: clean(S.plan) });
          await rpc("quick_deal", { p_venue: venueId, p_setup: setup });
          if (approved && S.plan.deal_items) await rpc("save_deal_menu", { p_venue: venueId, p_items: S.plan.deal_items });
          toast(approved ? "Saved. Diners see it now." : "Deal saved.");
          navigate(`#/biz/v/${venueId}`);
        });
      };
    }
  }

  if (S.step >= 5) await loadRec();
  if (S.step === 2 && S.plan.busy_mode === "pos" && data.sales_profile) await loadRec();
  draw();
}
