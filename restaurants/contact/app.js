(function (root, factory) {
  "use strict";
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.EarlyBirdRestaurantInquiry = api;
  if (root.document) api.bind(root.document, root);
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var ENDPOINT = "https://xopcdblqmmrvyocqomqz.supabase.co/functions/v1/restaurant-inquiry";
  // This is Supabase's public browser key. It identifies the project but grants no private database access.
  var PUBLIC_KEY = "sb_publishable_TW9FPHv3ijsOZx4QPTIsdA_hSWFafW4";
  var HELP = ["listing", "menu", "offers", "bookings", "photos", "owner_setup", "other"];
  var METHODS = ["phone", "sms", "email", "either"];
  var STEP_FIELDS = [
    ["restaurant_name", "city", "website_social"],
    ["submitter_name", "submitter_role", "phone", "email", "preferred_contact_method"],
    ["tables_per_day", "help_wanted", "consent", "confirmation_email_consent", "website", "elapsed_ms", "idempotency_key"]
  ];
  var startedAt = Date.now();
  var idempotencyKey = "";

  function text(value, max) {
    return String(value == null ? "" : value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim().slice(0, max);
  }

  function normalizePhone(value) {
    var raw = text(value, 30);
    var digits = raw.replace(/\D/g, "");
    if (digits.length === 10) return "+1" + digits;
    if (digits.length >= 8 && digits.length <= 15 && raw.charAt(0) === "+") return "+" + digits;
    if (digits.length === 11 && digits.charAt(0) === "1") return "+" + digits;
    return "";
  }

  function validEmail(value) {
    var email = text(value, 254).toLowerCase();
    return email.length >= 5 && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
  }

  function validLink(value) {
    var link = text(value, 300);
    if (!link) return true;
    if (/^@[A-Za-z0-9._-]{2,64}$/.test(link)) return true;
    try {
      var url = new URL(link);
      return (url.protocol === "https:" || url.protocol === "http:") && !!url.hostname && !/\s/.test(link);
    } catch (_) { return false; }
  }

  function wholeNumber(value) {
    var raw = String(value == null ? "" : value).trim();
    if (!/^-?\d+$/.test(raw)) return NaN;
    var parsed = Number(raw);
    return Number.isSafeInteger(parsed) ? parsed : NaN;
  }

  function tablesLabel(value) {
    var count = wholeNumber(value);
    if (!Number.isInteger(count) || count < 1) count = 1;
    return count + (count === 1 ? " table each day" : " tables each day");
  }

  function completionCopy(result) {
    var body = result && typeof result === "object" ? result : {};
    var duplicate = body.duplicate === true;
    var emailSent = body.customer_email === "sent";
    var smsSent = body.customer_sms === "sent";
    var neutral = "Your request is safely received. Someone from our team will review it and follow up by your selected method.";
    if (duplicate) {
      return {
        lede: "Your request was already safely received. Someone from our team will review it and follow up by your selected method.",
        next: "We won't send another confirmation, but our team will follow up by your selected method."
      };
    }
    if (body.customer_email === "pending" || body.customer_sms === "pending") {
      return {
        lede: neutral,
        next: "A person will review your listing and early-table offer, then follow up by your selected method."
      };
    }
    if (emailSent && smsSent) {
      return {
        lede: "Someone from our team will review your request immediately. Check your email and texts—we've sent your confirmation and next steps.",
        next: "We sent a confirmation by email and text. A person will review your listing and early-table offer with you."
      };
    }
    if (emailSent) {
      return {
        lede: "Someone from our team will review your request immediately. Check your email—we've sent your confirmation and next steps.",
        next: "We sent a confirmation by email. A person will review your listing and early-table offer with you."
      };
    }
    if (smsSent) {
      return {
        lede: "Someone from our team will review your request immediately. Check your texts—we've sent your confirmation and next steps.",
        next: "We sent a confirmation by text. A person will review your listing and early-table offer with you."
      };
    }
    return {
      lede: neutral,
      next: "A person will review your listing and early-table offer, then follow up by your selected method."
    };
  }

  function makeIdempotencyKey(cryptoObject) {
    if (cryptoObject && typeof cryptoObject.randomUUID === "function") return cryptoObject.randomUUID();
    var bytes = new Uint8Array(16);
    if (cryptoObject && typeof cryptoObject.getRandomValues === "function") cryptoObject.getRandomValues(bytes);
    else for (var i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    var hex = Array.prototype.map.call(bytes, function (b) { return b.toString(16).padStart(2, "0"); }).join("");
    return hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-" + hex.slice(12, 16) + "-" + hex.slice(16, 20) + "-" + hex.slice(20);
  }

  function buildPayload(values, now, formStartedAt, requestKey) {
    var help = Array.isArray(values.help_wanted) ? values.help_wanted.filter(function (v, i, a) { return HELP.indexOf(v) >= 0 && a.indexOf(v) === i; }) : [];
    var method = METHODS.indexOf(values.preferred_contact_method) >= 0 ? values.preferred_contact_method : "";
    var submittedAt = Number(now || Date.now());
    var beganAt = Number(formStartedAt || startedAt);
    return {
      restaurant_name: text(values.restaurant_name, 120),
      city: text(values.city, 100),
      address: text(values.address, 200),
      website_social: text(values.website_social, 300),
      owner_operator_name: text(values.owner_operator_name, 120),
      submitter_name: text(values.submitter_name, 120),
      submitter_role: text(values.submitter_role, 80),
      phone: normalizePhone(values.phone),
      email: text(values.email, 254).toLowerCase(),
      preferred_contact_method: method,
      preferred_contact_time: "",
      tables_per_day: wholeNumber(values.tables_per_day),
      help_wanted: help,
      notes: text(values.notes, 1200),
      consent: values.consent === true || values.consent === "true" || values.consent === "on",
      confirmation_email_consent: values.consent === true || values.consent === "true" || values.consent === "on",
      website: text(values.website, 200),
      elapsed_ms: Math.max(0, Math.round(submittedAt - beganAt)),
      idempotency_key: text(requestKey || idempotencyKey, 80)
    };
  }

  function validate(payload, now) {
    var errors = {};
    if (payload.restaurant_name.length < 2) errors.restaurant_name = "Enter the restaurant or business name.";
    if (payload.city.length < 2) errors.city = "Enter the city.";
    if (payload.website_social && !validLink(payload.website_social)) errors.website_social = "Enter a full web link or an @handle.";
    if (payload.submitter_name.length < 2) errors.submitter_name = "Enter your name.";
    if (payload.submitter_role.length < 2) errors.submitter_role = "Choose your role.";
    if (!payload.phone) errors.phone = "Enter a valid phone number, including country code outside the U.S. or Canada.";
    if (!validEmail(payload.email)) errors.email = "Enter a valid email address.";
    if (METHODS.indexOf(payload.preferred_contact_method) < 0) errors.preferred_contact_method = "Choose how you would like us to contact you.";
    if (!Number.isInteger(payload.tables_per_day) || payload.tables_per_day < 1 || payload.tables_per_day > 500) errors.tables_per_day = "Enter a whole number from 1 to 500.";
    if (!payload.help_wanted.length) errors.help_wanted = "Choose at least one way we can help.";
    if (!payload.consent) errors.consent = "Please agree so we can respond to your request.";
    if (!payload.confirmation_email_consent) errors.confirmation_email_consent = "Please agree so we can send your confirmation email.";
    if (payload.website) errors.website = "Invalid submission.";
    if (!Number.isFinite(payload.elapsed_ms) || payload.elapsed_ms < 3000 || payload.elapsed_ms > 24 * 60 * 60 * 1000) errors.elapsed_ms = "Please reload the page and try again.";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payload.idempotency_key)) errors.idempotency_key = "Please reload the page and try again.";
    return errors;
  }

  function validateStep(payload, step) {
    var all = validate(payload);
    var allowed = STEP_FIELDS[step] || [];
    var errors = {};
    allowed.forEach(function (field) { if (all[field]) errors[field] = all[field]; });
    return errors;
  }

  function valuesFromForm(form) {
    var data = new FormData(form), values = {};
    data.forEach(function (value, key) {
      if (key === "help_wanted") { (values.help_wanted || (values.help_wanted = [])).push(value); }
      else values[key] = value;
    });
    return values;
  }

  function firstError(errors) {
    var order = ["restaurant_name", "city", "website_social", "submitter_name", "submitter_role", "phone", "email", "preferred_contact_method", "tables_per_day", "help_wanted", "consent", "confirmation_email_consent", "elapsed_ms", "idempotency_key"];
    for (var i = 0; i < order.length; i++) if (errors[order[i]]) return { field: order[i], message: errors[order[i]] };
    return null;
  }

  function bind(document, window) {
    document.documentElement.classList.remove("no-js");
    var form = document.getElementById("inquiry-form");
    if (!form) return;
    var status = document.getElementById("form-status");
    var button = document.getElementById("submit-button");
    var nextButton = document.getElementById("next-button");
    var backButton = document.getElementById("back-button");
    var actions = document.getElementById("step-actions");
    var viewport = document.getElementById("step-viewport");
    var steps = Array.prototype.slice.call(form.querySelectorAll(".form-step"));
    var progress = form.querySelector("[role=progressbar]");
    var notes = document.getElementById("notes");
    var helpError = document.getElementById("help-error");
    var tablesError = document.getElementById("tables-error");
    var tablesInput = form.elements.tables_per_day;
    var tablesDecrement = document.getElementById("tables-decrement");
    var tablesIncrement = document.getElementById("tables-increment");
    var currentStep = 0;
    startedAt = Date.now();
    idempotencyKey = makeIdempotencyKey(window.crypto);

    function clearStatus() {
      status.className = "status";
      status.textContent = "";
      helpError.textContent = "";
      if (tablesError) tablesError.textContent = "";
    }

    function focusProblem(problem) {
      if (problem.field === "help_wanted") helpError.textContent = problem.message;
      if (problem.field === "tables_per_day" && tablesError) tablesError.textContent = problem.message;
      status.className = "status error";
      status.textContent = problem.message;
      var target = problem.field === "preferred_contact_method"
        ? form.querySelector('[name="preferred_contact_method"]')
        : problem.field === "help_wanted"
          ? form.querySelector('[name="help_wanted"]')
          : form.elements[problem.field];
      if (target && target.focus) target.focus(); else status.focus();
    }

    function syncTablesButtons() {
      if (!tablesInput) return;
      var value = wholeNumber(tablesInput.value);
      if (tablesDecrement) tablesDecrement.disabled = Number.isInteger(value) && value <= 1;
      if (tablesIncrement) tablesIncrement.disabled = Number.isInteger(value) && value >= 500;
    }

    function changeTablesBy(delta) {
      if (!tablesInput) return;
      var value = wholeNumber(tablesInput.value);
      if (!Number.isInteger(value)) value = 1;
      tablesInput.value = String(Math.min(500, Math.max(1, value + delta)));
      clearStatus();
      syncTablesButtons();
      tablesInput.focus();
    }

    function showStep(next, shouldFocus) {
      if (next < 0 || next >= steps.length || next === currentStep) return;
      var previous = steps[currentStep];
      var incoming = steps[next];
      var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      var fromHeight = viewport.getBoundingClientRect().height;
      if (!reduceMotion) viewport.style.height = fromHeight + "px";
      previous.hidden = true;
      incoming.hidden = false;
      incoming.classList.add("is-entering");
      currentStep = next;
      document.getElementById("step-number").textContent = String(currentStep + 1);
      document.getElementById("step-name").textContent = incoming.getAttribute("data-title") || "";
      document.getElementById("progress-fill").style.width = String(((currentStep + 1) / steps.length) * 100) + "%";
      progress.setAttribute("aria-valuenow", String(currentStep + 1));
      backButton.hidden = currentStep === 0;
      nextButton.hidden = currentStep === steps.length - 1;
      button.hidden = currentStep !== steps.length - 1;
      actions.classList.toggle("show-back", currentStep > 0);
      clearStatus();
      var finish = function () {
        incoming.classList.remove("is-entering");
        viewport.style.height = "auto";
      };
      if (reduceMotion) finish();
      else {
        var toHeight = incoming.offsetHeight;
        window.requestAnimationFrame(function () {
          viewport.style.height = toHeight + "px";
          window.requestAnimationFrame(function () { incoming.classList.remove("is-entering"); });
        });
        window.setTimeout(finish, 380);
      }
      if (shouldFocus) {
        var card = form.closest(".form-card");
        if (card && card.scrollIntoView) card.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
        var legend = incoming.querySelector("legend");
        if (legend) { legend.setAttribute("tabindex", "-1"); window.setTimeout(function () { legend.focus(); }, reduceMotion ? 0 : 260); }
      }
    }

    function advance() {
      clearStatus();
      var payload = buildPayload(valuesFromForm(form));
      var problem = firstError(validateStep(payload, currentStep));
      if (problem) { focusProblem(problem); return; }
      showStep(currentStep + 1, true);
    }

    notes.addEventListener("input", function () { document.getElementById("notes-count").textContent = String(notes.value.length); });
    if (tablesInput) {
      tablesInput.addEventListener("input", syncTablesButtons);
      syncTablesButtons();
    }
    if (tablesDecrement) tablesDecrement.addEventListener("click", function () { changeTablesBy(-1); });
    if (tablesIncrement) tablesIncrement.addEventListener("click", function () { changeTablesBy(1); });
    form.addEventListener("input", clearStatus);
    nextButton.addEventListener("click", advance);
    backButton.addEventListener("click", function () { showStep(currentStep - 1, true); });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (currentStep < steps.length - 1) { advance(); return; }
      clearStatus();
      var payload = buildPayload(valuesFromForm(form));
      var errors = validate(payload);
      var problem = firstError(errors);
      if (problem) {
        var stepWithProblem = STEP_FIELDS.findIndex(function (fields) { return fields.indexOf(problem.field) >= 0; });
        if (stepWithProblem >= 0 && stepWithProblem !== currentStep) showStep(stepWithProblem, false);
        focusProblem(problem);
        return;
      }
      if (!form.checkValidity()) { form.reportValidity(); return; }

      button.disabled = true;
      status.className = "status busy";
      status.textContent = "Sending your request…";
      var controller = window.AbortController ? new window.AbortController() : null;
      var timer = controller ? window.setTimeout(function () { controller.abort(); }, 12000) : null;
      window.fetch(ENDPOINT, {
        method: "POST",
        signal: controller && controller.signal,
        headers: { "Content-Type": "application/json", "apikey": PUBLIC_KEY },
        body: JSON.stringify(payload),
        credentials: "omit",
        referrerPolicy: "strict-origin-when-cross-origin"
      }).then(function (response) {
        return response.json().catch(function () { return {}; }).then(function (body) { return { response: response, body: body }; });
      }).then(function (result) {
        if (!result.response.ok || result.body.ok !== true || !result.body.reference_id) {
          var error = new Error(result.response.status === 429 ? "rate_limited" : "request_failed");
          error.status = result.response.status; throw error;
        }
        if (timer) window.clearTimeout(timer);
        var copy = completionCopy(result.body);
        document.getElementById("pitch-caps").textContent = "Request received";
        document.getElementById("pitch-title").textContent = "Thanks.";
        document.getElementById("pitch-emphasis").textContent = "We'll take it from here.";
        document.getElementById("pitch-lede").textContent = copy.lede;
        document.getElementById("success-restaurant").textContent = payload.restaurant_name;
        document.getElementById("success-tables").textContent = tablesLabel(payload.tables_per_day);
        document.getElementById("success-next").textContent = copy.next;
        document.getElementById("reference-id").textContent = text(result.body.reference_id, 80);
        form.hidden = true;
        var success = document.getElementById("success");
        success.hidden = false; success.focus();
      }).catch(function (error) {
        if (timer) window.clearTimeout(timer);
        status.className = "status error";
        status.textContent = error && (error.message === "rate_limited" || error.status === 429)
          ? "We've received several requests from this connection. Please wait and try again later."
          : "We couldn't send your request right now. Please try again in a moment.";
        status.focus();
      }).then(function () { button.disabled = false; });
    });
  }

  return { ENDPOINT: ENDPOINT, HELP: HELP.slice(), METHODS: METHODS.slice(), STEP_FIELDS: STEP_FIELDS.map(function (fields) { return fields.slice(); }), text: text, normalizePhone: normalizePhone, validEmail: validEmail, validLink: validLink, wholeNumber: wholeNumber, tablesLabel: tablesLabel, completionCopy: completionCopy, makeIdempotencyKey: makeIdempotencyKey, buildPayload: buildPayload, validate: validate, validateStep: validateStep, firstError: firstError, bind: bind };
});
