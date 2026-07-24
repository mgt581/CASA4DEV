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
  return String(value || "").trim().slice(0, 1000);
}

async function hashIp(ip) {
  if (!ip || !crypto.subtle) return "";
  var data = new TextEncoder().encode(ip);
  var digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map(function(byte) {
    return byte.toString(16).padStart(2, "0");
  }).join("");
}

function allowedEventName(value) {
  var name = clean(value);
  return [
    "page_view",
    "quote_cta_click",
    "phone_click",
    "whatsapp_click",
    "lead_form_submit_attempt",
    "generate_lead",
    "lead_thank_you_view"
  ].indexOf(name) !== -1 ? name : "";
}

export async function onRequestPost(context) {
  try {
    var env = context.env || {};
    if (!env.LEADS_DB) {
      return jsonResponse({ ok: false, error: "Lead event database is not configured." }, 503);
    }

    var payload = await context.request.json();
    var eventName = allowedEventName(payload.event_name || payload.event);

    if (!eventName) {
      return jsonResponse({ ok: false, error: "Unsupported event." }, 400);
    }

    var ipHash = await hashIp(context.request.headers.get("cf-connecting-ip") || "");
    var userAgent = clean(context.request.headers.get("user-agent"));

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
        link_url,
        link_text,
        phone_number,
        whatsapp_number,
        session_id,
        client_id,
        user_agent,
        ip_hash
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      new Date().toISOString(),
      eventName,
      clean(payload.page),
      clean(payload.landing_page),
      clean(payload.referrer),
      clean(payload.utm_source || payload.source),
      clean(payload.utm_medium || payload.medium),
      clean(payload.utm_campaign || payload.campaign),
      clean(payload.utm_term || payload.term),
      clean(payload.utm_content || payload.content),
      clean(payload.gclid),
      clean(payload.fbclid),
      clean(payload.msclkid),
      clean(payload.service),
      clean(payload.link_url),
      clean(payload.link_text),
      clean(payload.phone_number),
      clean(payload.whatsapp_number),
      clean(payload.session_id),
      clean(payload.client_id),
      userAgent,
      ipHash
    ).run();

    return jsonResponse({ ok: true }, 200);
  } catch (error) {
    return jsonResponse({ ok: false, error: "Could not store lead event." }, 500);
  }
}

export function onRequestGet() {
  return jsonResponse({ ok: false, error: "Use POST to store a lead event." }, 405);
}
