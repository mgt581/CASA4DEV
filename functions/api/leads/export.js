function clean(value) {
  return String(value || "").trim();
}

function hasConfiguredAccessAuth(request, env) {
  if (clean(env.CLOUDFLARE_ACCESS_ENABLED).toLowerCase() !== "true") return false;

  var headers = request.headers;
  var accessJwt = clean(headers.get("cf-access-jwt-assertion"));
  if (accessJwt) return true;

  var cookieHeader = clean(headers.get("cookie")).toLowerCase();
  if (cookieHeader.indexOf("cf_authorization=") !== -1) return true;

  return false;
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
    "submitted_at",
    "name",
    "phone",
    "email",
    "postcode",
    "service",
    "timeframe",
    "message",
    "page",
    "source",
    "landing_page",
    "referrer",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "gclid",
    "fbclid",
    "msclkid",
    "session_id",
    "client_id",
    "marketing_consent",
    "delivery_status",
    "delivery_errors",
    "lead_status",
    "quote_value_pence",
    "won_revenue_pence",
    "status_updated_at"
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
      "content-disposition": 'attachment; filename="casa4-leads.csv"',
      "cache-control": "no-store"
    }
  });
}

export async function onRequestGet(context) {
  var env = context.env || {};
  var token = clean(env.LEADS_EXPORT_TOKEN);
  var authHeader = clean(context.request.headers.get("authorization"));
  var bearerToken = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
  var requestToken = bearerToken;

  if (hasConfiguredAccessAuth(context.request, env)) {
    requestToken = token;
  }

  if (!token) {
    return textResponse("Lead export is not configured.", 503);
  }

  if (!requestToken || requestToken !== token) {
    return textResponse("Unauthorized.", 401);
  }

  if (!env.LEADS_DB) {
    return textResponse("Lead database is not configured.", 503);
  }

  var schema = await env.LEADS_DB.prepare("PRAGMA table_info(leads)").all();
  var columns = new Set((schema.results || []).map(function(item) { return item.name; }));
  var additions = [
    ["lead_status", "TEXT NOT NULL DEFAULT 'NEW'"],
    ["quote_value_pence", "INTEGER NOT NULL DEFAULT 0"],
    ["won_revenue_pence", "INTEGER NOT NULL DEFAULT 0"],
    ["status_updated_at", "TEXT"]
  ];
  for (var index = 0; index < additions.length; index += 1) {
    if (!columns.has(additions[index][0])) {
      await env.LEADS_DB.prepare("ALTER TABLE leads ADD COLUMN " + additions[index][0] + " " + additions[index][1]).run();
    }
  }

  var result = await env.LEADS_DB.prepare(
    `SELECT
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
      client_id,
      marketing_consent,
      delivery_status,
      delivery_errors,
      lead_status,
      quote_value_pence,
      won_revenue_pence,
      status_updated_at
    FROM leads
    ORDER BY submitted_at DESC
    LIMIT 1000`
  ).all();

  return csvResponse(result.results || []);
}
