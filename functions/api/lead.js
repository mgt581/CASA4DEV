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

function buildEmailHtml(lead) {
  return `
    <h2>New Casa4 Developments quote request</h2>
    <table cellpadding="8" cellspacing="0" style="border-collapse:collapse;font-family:Arial,sans-serif;">
      <tr><td><strong>Name</strong></td><td>${lead.name}</td></tr>
      <tr><td><strong>Phone</strong></td><td>${lead.phone}</td></tr>
      <tr><td><strong>Email</strong></td><td>${lead.email || "Not provided"}</td></tr>
      <tr><td><strong>Postcode / Area</strong></td><td>${lead.postcode || "Not provided"}</td></tr>
      <tr><td><strong>Service</strong></td><td>${lead.service || "Website enquiry"}</td></tr>
      <tr><td><strong>Timeframe</strong></td><td>${lead.timeframe || "Not provided"}</td></tr>
      <tr><td><strong>Page</strong></td><td>${lead.page || "Not provided"}</td></tr>
    </table>
    <h3>Project Details</h3>
    <p>${(lead.message || "Not provided").replace(/\n/g, "<br>")}</p>
  `;
}

async function sendWithResend(env, lead) {
  if (!env.RESEND_API_KEY) return false;

  var to = emailList(env.LEAD_TO_EMAIL, "info@casa4developments.co.uk");
  var from = env.LEAD_FROM_EMAIL || "Casa4 Developments <leads@casa4developments.co.uk>";
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
      source: clean(payload.source) || "website"
    };

    if (!lead.name || !lead.phone) {
      return jsonResponse({ ok: false, error: "Please enter your name and phone number." }, 400);
    }

    var delivered = await sendWithResend(env, lead);
    if (!delivered) delivered = await sendToWebhook(env, lead);

    if (!delivered) {
      return jsonResponse({
        ok: false,
        error: "Lead capture is not configured yet. Add RESEND_API_KEY or LEAD_WEBHOOK_URL in Cloudflare Pages."
      }, 503);
    }

    return jsonResponse({ ok: true, redirect: "/thank-you.html?service=" + encodeURIComponent(lead.service || "Website enquiry") }, 200);
  } catch (error) {
    return jsonResponse({ ok: false, error: "We could not send this enquiry. Please call or WhatsApp us." }, 500);
  }
}

export function onRequestGet() {
  return jsonResponse({ ok: false, error: "Use POST to submit an enquiry." }, 405);
}
