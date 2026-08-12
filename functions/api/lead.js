function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function clean(value) {
  return String(value || "").trim();
}

function emailList(value, fallback) {
  return clean(value || fallback)
    .split(",")
    .map(function(email) { return email.trim(); })
    .filter(Boolean);
}

function escapeHtml(value) {
  return clean(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function consentValue(value) {
  var text = clean(value).toLowerCase();
  return text === "1" || text === "true" || text === "yes" || text === "on";
}

function cleanOptional(value) {
  return clean(value).slice(0, 1000);
}

function inferredLeadSource(payload) {
  var utmSource = cleanOptional(payload.utm_source).toLowerCase();
  var suppliedSource = cleanOptional(payload.source).toLowerCase();
  var referrer = cleanOptional(payload.referrer).toLowerCase();

  if (utmSource) return utmSource;
  if (payload.fbclid || referrer.indexOf("facebook.com") !== -1 || referrer.indexOf("fb.com") !== -1) return "facebook";
  if (referrer.indexOf("instagram.com") !== -1) return "instagram";
  if (payload.gclid || referrer.indexOf("google.") !== -1 || referrer.indexOf("g.co") !== -1) return "google";
  if (payload.msclkid || referrer.indexOf("bing.com") !== -1) return "bing";
  if (referrer.indexOf("linkedin.com") !== -1) return "linkedin";
  if (referrer.indexOf("twitter.com") !== -1 || referrer.indexOf("x.com") !== -1) return "x / twitter";
  if (referrer.indexOf("whatsapp.com") !== -1 || referrer.indexOf("wa.me") !== -1) return "whatsapp";
  if (suppliedSource && suppliedSource !== "website") return suppliedSource;
  return "direct / unknown";
}

async function ensurePipelineColumns(db) {
  var result = await db.prepare("PRAGMA table_info(leads)").all();
  var columns = new Set((result.results || []).map(function(item) { return item.name; }));
  var additions = [
    ["lead_status", "TEXT NOT NULL DEFAULT 'NEW'"],
    ["quote_value_pence", "INTEGER NOT NULL DEFAULT 0"],
    ["won_revenue_pence", "INTEGER NOT NULL DEFAULT 0"],
    ["status_updated_at", "TEXT"]
  ];

  for (var index = 0; index < additions.length; index += 1) {
    if (!columns.has(additions[index][0])) {
      await db.prepare("ALTER TABLE leads ADD COLUMN " + additions[index][0] + " " + additions[index][1]).run();
    }
  }
}

function buildEmailHtml(lead) {
  return `
    <h2>New Casa4 Developments quote request</h2>
    <table cellpadding="8" cellspacing="0" style="border-collapse:collapse;font-family:Arial,sans-serif;">
      <tr><td><strong>Name</strong></td><td>${escapeHtml(lead.name)}</td></tr>
      <tr><td><strong>Phone</strong></td><td>${escapeHtml(lead.phone)}</td></tr>
      <tr><td><strong>Email</strong></td><td>${escapeHtml(lead.email || "Not provided")}</td></tr>
      <tr><td><strong>Postcode / Area</strong></td><td>${escapeHtml(lead.postcode || "Not provided")}</td></tr>
      <tr><td><strong>Service</strong></td><td>${escapeHtml(lead.service || "Website enquiry")}</td></tr>
      <tr><td><strong>Timeframe</strong></td><td>${escapeHtml(lead.timeframe || "Not provided")}</td></tr>
      <tr><td><strong>Marketing consent</strong></td><td>${lead.marketingConsent ? "Yes" : "No"}</td></tr>
      <tr><td><strong>Source</strong></td><td>${escapeHtml(lead.source || "website")}</td></tr>
      <tr><td><strong>Page</strong></td><td>${escapeHtml(lead.page || "Not provided")}</td></tr>
    </table>
    <h3>Project Details</h3>
    <p>${escapeHtml(lead.message || "Not provided").replace(/\n/g, "<br>")}</p>
  `;
}

async function sendWithResend(env, lead) {
  if (!env.RESEND_API_KEY) return false;

  var to = emailList(env.LEAD_TO_EMAIL, "casa4developments@outlook.com,ajbryantsleads@gmail.com");
  var from = env.LEAD_FROM_EMAIL || "Casa4 Developments <info@casa4developments.co.uk>";
  var subject = "New quote request - " + (lead.service || "Website enquiry");

  var response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "authorization": "Bearer " + env.RESEND_API_KEY,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      from,
      to,
      reply_to: lead.email || undefined,
      subject,
      html: buildEmailHtml(lead)
    })
  });

  if (!response.ok) {
    throw new Error("Resend rejected the lead email: " + response.status);
  }

  return true;
}

async function hashIp(ip) {
  if (!ip || !crypto.subtle) return "";
  var data = new TextEncoder().encode(ip);
  var digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map(function(byte) {
    return byte.toString(16).padStart(2, "0");
  }).join("");
}

async function storeLead(env, request, lead, deliveryStatus, deliveryErrors) {
  if (!env.LEADS_DB) return false;

  await ensurePipelineColumns(env.LEADS_DB);

  var ipHash = await hashIp(request.headers.get("cf-connecting-ip") || "");
  var userAgent = clean(request.headers.get("user-agent"));

  await env.LEADS_DB.prepare(
    `INSERT INTO leads (
      submitted_at,
      name,
      phone,
      email,
      postcode,
      service,
      timeframe,
      message,
      page,
      source,
      marketing_consent,
      delivery_status,
      delivery_errors,
      user_agent,
      ip_hash,
      landing_page,
      referrer,
      utm_source,
      utm_medium,
      utm_campaign,
      utm_term,
      utm_content,
      gclid,
      fbclid,
      msclkid,
      session_id,
      client_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    lead.submittedAt,
    lead.name,
    lead.phone,
    lead.email,
    lead.postcode,
    lead.service,
    lead.timeframe,
    lead.message,
    lead.page,
    lead.source,
    lead.marketingConsent ? 1 : 0,
    deliveryStatus,
    deliveryErrors.join(" | "),
    userAgent,
    ipHash,
    lead.landingPage,
    lead.referrer,
    lead.utmSource,
    lead.utmMedium,
    lead.utmCampaign,
    lead.utmTerm,
    lead.utmContent,
    lead.gclid,
    lead.fbclid,
    lead.msclkid,
    lead.sessionId,
    lead.clientId
  ).run();

  return true;
}

async function storeLeadEvent(env, request, lead, eventName) {
  if (!env.LEADS_DB) return false;

  var ipHash = await hashIp(request.headers.get("cf-connecting-ip") || "");
  var userAgent = clean(request.headers.get("user-agent"));

  await env.LEADS_DB.prepare(
    `INSERT INTO lead_events (
      occurred_at,
      event_name,
      page,
      landing_page,
      referrer,
      source,
      medium,
      campaign,
      term,
      content,
      gclid,
      fbclid,
      msclkid,
      service,
      session_id,
      client_id,
      user_agent,
      ip_hash
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    new Date().toISOString(),
    eventName,
    lead.page,
    lead.landingPage,
    lead.referrer,
    lead.utmSource || lead.source,
    lead.utmMedium,
    lead.utmCampaign,
    lead.utmTerm,
    lead.utmContent,
    lead.gclid,
    lead.fbclid,
    lead.msclkid,
    lead.service,
    lead.sessionId,
    lead.clientId,
    userAgent,
    ipHash
  ).run();

  return true;
}

async function sendToWebhook(env, lead) {
  if (!env.LEAD_WEBHOOK_URL) return false;

  var response = await fetch(env.LEAD_WEBHOOK_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(lead)
  });

  if (!response.ok) {
    throw new Error("Lead webhook rejected the submission: " + response.status);
  }

  return true;
}

export async function onRequestPost(context) {
  try {
    var request = context.request;
    var env = context.env || {};
    var payload = await request.json();

    if (clean(payload.website)) {
      return jsonResponse({ ok: true }, 200);
    }

    var lead = {
      name: clean(payload.name),
      phone: clean(payload.phone),
      email: clean(payload.email),
      postcode: clean(payload.postcode),
      service: clean(payload.service),
      timeframe: clean(payload.timeframe),
      message: clean(payload.message),
      page: clean(payload.page),
      submittedAt: new Date().toISOString(),
      source: inferredLeadSource(payload),
      marketingConsent: consentValue(payload.marketing_consent),
      landingPage: cleanOptional(payload.landing_page),
      referrer: cleanOptional(payload.referrer),
      utmSource: cleanOptional(payload.utm_source),
      utmMedium: cleanOptional(payload.utm_medium),
      utmCampaign: cleanOptional(payload.utm_campaign),
      utmTerm: cleanOptional(payload.utm_term),
      utmContent: cleanOptional(payload.utm_content),
      gclid: cleanOptional(payload.gclid),
      fbclid: cleanOptional(payload.fbclid),
      msclkid: cleanOptional(payload.msclkid),
      sessionId: cleanOptional(payload.session_id),
      clientId: cleanOptional(payload.client_id)
    };

    if (!lead.name || !lead.phone) {
      return jsonResponse({ ok: false, error: "Please enter your name and phone number." }, 400);
    }

    var delivered = false;
    var deliveryErrors = [];

    try {
      delivered = await sendWithResend(env, lead);
    } catch (error) {
      deliveryErrors.push(error.message);
    }

    if (!delivered) {
      try {
        delivered = await sendToWebhook(env, lead);
      } catch (error) {
        deliveryErrors.push(error.message);
      }
    }

    try {
      await storeLead(env, request, lead, delivered ? "delivered" : "failed", deliveryErrors);
      await storeLeadEvent(env, request, lead, delivered ? "generate_lead" : "lead_delivery_failed");
    } catch (error) {
      console.error("Lead database storage failed:", error.message);
    }

    if (!delivered) {
      if (deliveryErrors.length) console.error("Lead delivery failed:", deliveryErrors.join(" | "));
      return jsonResponse({
        ok: false,
        error: "We couldn't send your enquiry online. Please call or WhatsApp us."
      }, deliveryErrors.length ? 502 : 503);
    }

    return jsonResponse({ ok: true, redirect: "/thank-you.html?service=" + encodeURIComponent(lead.service || "Website enquiry") }, 200);
  } catch (error) {
    return jsonResponse({ ok: false, error: "We could not send this enquiry. Please call or WhatsApp us." }, 500);
  }
}

export function onRequestGet() {
  return jsonResponse({ ok: false, error: "Use POST to submit an enquiry." }, 405);
}
