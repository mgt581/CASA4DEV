function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
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

function clean(value) {
  return String(value || "").trim();
}

function countValue(rows, key) {
  if (!rows.length) return 0;
  var value = rows[0][key];
  return Number(value || 0);
}

function normalizedOriginSql(columnName) {
  return [
    "CASE",
    "  WHEN COALESCE(NULLIF(" + columnName + ", ''), '') <> '' AND LOWER(" + columnName + ") LIKE '%facebook.com%' THEN 'facebook'",
    "  WHEN COALESCE(NULLIF(" + columnName + ", ''), '') <> '' AND LOWER(" + columnName + ") LIKE '%fb.com%' THEN 'facebook'",
    "  WHEN COALESCE(NULLIF(" + columnName + ", ''), '') <> '' AND LOWER(" + columnName + ") LIKE '%instagram.com%' THEN 'instagram'",
    "  WHEN COALESCE(NULLIF(" + columnName + ", ''), '') <> '' AND (LOWER(" + columnName + ") LIKE '%google.%' OR LOWER(" + columnName + ") LIKE '%google.com%' OR LOWER(" + columnName + ") LIKE '%g.co%') THEN 'google'",
    "  WHEN COALESCE(NULLIF(" + columnName + ", ''), '') <> '' AND LOWER(" + columnName + ") LIKE '%bing.com%' THEN 'bing'",
    "  WHEN COALESCE(NULLIF(" + columnName + ", ''), '') <> '' AND LOWER(" + columnName + ") LIKE '%linkedin.com%' THEN 'linkedin'",
    "  WHEN COALESCE(NULLIF(" + columnName + ", ''), '') <> '' AND (LOWER(" + columnName + ") LIKE '%twitter.com%' OR LOWER(" + columnName + ") LIKE '%x.com%') THEN 'x / twitter'",
    "  WHEN COALESCE(NULLIF(" + columnName + ", ''), '') <> '' AND (LOWER(" + columnName + ") LIKE '%whatsapp.com%' OR LOWER(" + columnName + ") LIKE '%wa.me%') THEN 'whatsapp'",
    "  WHEN COALESCE(NULLIF(" + columnName + ", ''), '') <> '' AND (LOWER(" + columnName + ") LIKE '%youtube.com%' OR LOWER(" + columnName + ") LIKE '%youtu.be%') THEN 'youtube'",
    "  ELSE " + columnName,
    "END"
  ].join("\n");
}

async function queryAll(db, sql) {
  var result = await db.prepare(sql).all();
  return result.results || [];
}

function requireToken(context) {
  var env = context.env || {};
  var configured = clean(env.LEADS_EXPORT_TOKEN);
  var authHeader = clean(context.request.headers.get("authorization"));
  var bearerToken = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
  var requestToken = bearerToken || clean(new URL(context.request.url).searchParams.get("token"));

  if (!configured) {
    return { ok: false, status: 503, error: "Dashboard access is not configured." };
  }

  if (!requestToken || requestToken !== configured) {
    return { ok: false, status: 401, error: "Unauthorized." };
  }

  return { ok: true };
}

export async function onRequestGet(context) {
  try {
    var access = requireToken(context);
    if (!access.ok) {
      return textResponse(access.error, access.status);
    }

    var env = context.env || {};
    if (!env.LEADS_DB) {
      return textResponse("Lead database is not configured.", 503);
    }

    var totalsRows = await queryAll(
      env.LEADS_DB,
      `SELECT
        COUNT(*) AS total_leads,
        SUM(CASE WHEN delivery_status = 'delivered' THEN 1 ELSE 0 END) AS delivered_leads,
        SUM(CASE WHEN delivery_status = 'failed' THEN 1 ELSE 0 END) AS failed_leads
      FROM leads`
    );

    var eventTotalsRows = await queryAll(
      env.LEADS_DB,
      `SELECT event_name, COUNT(*) AS count
      FROM lead_events
      GROUP BY event_name
      ORDER BY count DESC, event_name ASC`
    );

    var originRows = await queryAll(
      env.LEADS_DB,
      `SELECT
        CASE
          WHEN COALESCE(NULLIF(utm_source, ''), '') <> '' THEN LOWER(utm_source)
          WHEN COALESCE(NULLIF(referrer, ''), '') <> '' THEN ${normalizedOriginSql("referrer")}
          ELSE 'direct / unknown'
        END AS origin,
        COUNT(*) AS count
      FROM leads
      GROUP BY
        CASE
          WHEN COALESCE(NULLIF(utm_source, ''), '') <> '' THEN LOWER(utm_source)
          WHEN COALESCE(NULLIF(referrer, ''), '') <> '' THEN ${normalizedOriginSql("referrer")}
          ELSE 'direct / unknown'
        END
      ORDER BY count DESC, origin ASC
      LIMIT 10`
    );

    var serviceRows = await queryAll(
      env.LEADS_DB,
      `SELECT
        COALESCE(NULLIF(service, ''), 'Website enquiry') AS service,
        COUNT(*) AS count
      FROM leads
      GROUP BY COALESCE(NULLIF(service, ''), 'Website enquiry')
      ORDER BY count DESC, service ASC
      LIMIT 10`
    );

    var landingPageRows = await queryAll(
      env.LEADS_DB,
      `SELECT
        COALESCE(NULLIF(landing_page, ''), COALESCE(NULLIF(page, ''), 'Unknown')) AS landing_page,
        COUNT(*) AS count
      FROM lead_events
      WHERE event_name IN ('page_view', 'quote_cta_click', 'phone_click', 'whatsapp_click', 'email_click', 'lead_form_submit_attempt', 'lead_form_error', 'generate_lead', 'chat_lead', 'chat_lead_error')
      GROUP BY COALESCE(NULLIF(landing_page, ''), COALESCE(NULLIF(page, ''), 'Unknown'))
      ORDER BY count DESC, landing_page ASC
      LIMIT 10`
    );

    var dailyRows = await queryAll(
      env.LEADS_DB,
      `SELECT
        SUBSTR(submitted_at, 1, 10) AS day,
        COUNT(*) AS count
      FROM leads
      GROUP BY day
      ORDER BY day DESC
      LIMIT 14`
    );

    var recentLeads = await queryAll(
      env.LEADS_DB,
      `SELECT
        submitted_at,
        name,
        phone,
        email,
        postcode,
        service,
        timeframe,
        page,
        source,
        landing_page,
        referrer,
        utm_source,
        utm_medium,
        utm_campaign,
        delivery_status,
        delivery_errors
      FROM leads
      ORDER BY submitted_at DESC
      LIMIT 12`
    );

    var recentEvents = await queryAll(
      env.LEADS_DB,
      `SELECT
        occurred_at,
        event_name,
        page,
        landing_page,
        link_text,
        link_url,
        source,
        medium,
        campaign,
        service
      FROM lead_events
      ORDER BY occurred_at DESC
      LIMIT 20`
    );

    var recentEventsWithCount = {};
    for (var i = 0; i < eventTotalsRows.length; i += 1) {
      recentEventsWithCount[eventTotalsRows[i].event_name] = Number(eventTotalsRows[i].count || 0);
    }

    return jsonResponse({
      ok: true,
      generated_at: new Date().toISOString(),
      totals: {
        leads: countValue(totalsRows, "total_leads"),
        delivered_leads: countValue(totalsRows, "delivered_leads"),
        failed_leads: countValue(totalsRows, "failed_leads")
      },
      event_totals: recentEventsWithCount,
      origin_summary: originRows,
      service_summary: serviceRows,
      landing_page_summary: landingPageRows,
      daily_leads: dailyRows,
      recent_leads: recentLeads,
      recent_events: recentEvents
    }, 200);
  } catch (error) {
    return textResponse("Could not load the dashboard.", 500);
  }
}
