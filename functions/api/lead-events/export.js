function clean(value) {
  return String(value || "").trim();
}

function textResponse(body, status) {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function csvEscape(value) {
  var text = String(value == null ? "" : value);
  if (/[",\n\r]/.test(text)) {
    return '"' + text.replace(/"/g, '""') + '"';
  }
  return text;
}

function csvResponse(rows) {
  var headers = [
    "occurred_at",
    "event_name",
    "page",
    "landing_page",
    "referrer",
    "source",
    "medium",
    "campaign",
    "term",
    "content",
    "gclid",
    "fbclid",
    "msclkid",
    "service",
    "link_url",
    "link_text",
    "phone_number",
    "whatsapp_number",
    "session_id",
    "client_id"
  ];

  var lines = [headers.join(",")];
  rows.forEach(function(row) {
    lines.push(headers.map(function(header) {
      return csvEscape(row[header]);
    }).join(","));
  });

  return new Response(lines.join("\n") + "\n", {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="casa4-lead-events.csv"',
      "cache-control": "no-store"
    }
  });
}

export async function onRequestGet(context) {
  var env = context.env || {};
  var token = clean(env.LEADS_EXPORT_TOKEN);
  var authHeader = clean(context.request.headers.get("authorization"));
  var bearerToken = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
  var requestToken = bearerToken || clean(new URL(context.request.url).searchParams.get("token"));

  if (!token) {
    return textResponse("Lead event export is not configured.", 503);
  }

  if (!requestToken || requestToken !== token) {
    return textResponse("Unauthorized.", 401);
  }

  if (!env.LEADS_DB) {
    return textResponse("Lead database is not configured.", 503);
  }

  var result = await env.LEADS_DB.prepare(
    `SELECT
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
      client_id
    FROM lead_events
    ORDER BY occurred_at DESC
    LIMIT 5000`
  ).all();

  return csvResponse(result.results || []);
}
