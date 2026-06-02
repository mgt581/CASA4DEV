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
    "sms_click",
    "email_click",
    "whatsapp_click",
    "chat_open",
    "chat_question",
    "chat_lead",
    "lead_form_submit_attempt",
    "generate_lead",
    "lead_delivery_failed",
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
        traffic_source,
        traffic_medium,
        traffic_campaign,
        first_page,
        first_referrer,
        first_utm_source,
        first_utm_medium,
        first_utm_campaign,
        first_utm_term,
        first_utm_content,
        first_gclid,
        first_fbclid,
        first_msclkid,
        first_seen_at,
        service,
        event_source,
        form_source,
        chat_question,
        link_url,
        link_text,
        phone_number,
        sms_number,
        email_address,
        whatsapp_number,
        session_id,
        client_id,
        user_agent,
        ip_hash
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      new Date().toISOString(),
      eventName,
      clean(payload.page),
      clean(payload.landing_page),
      clean(payload.referrer),
      clean(payload.utm_source || payload.traffic_source || payload.first_utm_source || payload.source),
      clean(payload.utm_medium || payload.traffic_medium || payload.first_utm_medium || payload.medium),
      clean(payload.utm_campaign || payload.traffic_campaign || payload.first_utm_campaign || payload.campaign),
      clean(payload.utm_term || payload.term),
      clean(payload.utm_content || payload.content),
      clean(payload.gclid),
      clean(payload.fbclid),
      clean(payload.msclkid),
      clean(payload.traffic_source),
      clean(payload.traffic_medium),
      clean(payload.traffic_campaign),
      clean(payload.first_page),
      clean(payload.first_referrer),
      clean(payload.first_utm_source),
      clean(payload.first_utm_medium),
      clean(payload.first_utm_campaign),
      clean(payload.first_utm_term),
      clean(payload.first_utm_content),
      clean(payload.first_gclid),
      clean(payload.first_fbclid),
      clean(payload.first_msclkid),
      clean(payload.first_seen_at),
      clean(payload.service),
      clean(payload.event_source),
      clean(payload.form_source),
      clean(payload.chat_question),
      clean(payload.link_url),
      clean(payload.link_text),
      clean(payload.phone_number),
      clean(payload.sms_number),
      clean(payload.email_address),
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
