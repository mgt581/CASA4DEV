import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function importSource(relativePath) {
  const source = await readFile(new URL(relativePath, import.meta.url), "utf8");
  return import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
}

const dashboardApi = await importSource("../functions/api/dashboard.js");

function dashboardDb() {
  return {
    prepare(sql) {
      return {
        async all() {
          if (sql.includes("COUNT(*) AS total_leads")) {
            return { results: [{ total_leads: 5, delivered_leads: 4, failed_leads: 1 }] };
          }
          if (sql.includes("GROUP BY event_name")) {
            return { results: [
              { event_name: "phone_click", count: 3 },
              { event_name: "whatsapp_click", count: 2 },
              { event_name: "email_click", count: 1 },
              { event_name: "generate_lead", count: 4 }
            ] };
          }
          if (sql.includes("AS origin") && sql.includes("FROM leads")) {
            return { results: [
              { origin: "google", count: 3 },
              { origin: "facebook", count: 1 }
            ] };
          }
          if (sql.includes("AS service") && sql.includes("FROM leads")) {
            return { results: [
              { service: "Driveways", count: 3 },
              { service: "Patios", count: 2 }
            ] };
          }
          if (sql.includes("AS landing_page") && sql.includes("FROM lead_events")) {
            return { results: [
              { landing_page: "https://example.test/", count: 4 },
              { landing_page: "https://example.test/contact", count: 2 }
            ] };
          }
          if (sql.includes("SUBSTR(submitted_at, 1, 10)")) {
            return { results: [
              { day: "2026-08-10", count: 2 }
            ] };
          }
          if (sql.includes("FROM leads\n      ORDER BY submitted_at DESC\n      LIMIT 12")) {
            return { results: [
              {
                submitted_at: "2026-08-10T10:00:00.000Z",
                name: "Test Lead",
                phone: "07000000000",
                email: "lead@example.test",
                service: "Driveways",
                page: "https://example.test/contact",
                source: "website",
                landing_page: "https://example.test/",
                referrer: "https://www.google.com/",
                utm_source: "google",
                delivery_status: "delivered"
              }
            ] };
          }
          if (sql.includes("FROM lead_events\n      ORDER BY occurred_at DESC\n      LIMIT 20")) {
            return { results: [
              {
                occurred_at: "2026-08-10T09:55:00.000Z",
                event_name: "phone_click",
                page: "https://example.test/contact",
                link_text: "Call",
                link_url: "tel:01489290012"
              }
            ] };
          }
          return { results: [] };
        }
      };
    }
  };
}

test("dashboard api returns a safe summary for an authorized token", async () => {
  const response = await dashboardApi.onRequestGet({
    env: {
      LEADS_EXPORT_TOKEN: "secret-token",
      LEADS_DB: dashboardDb()
    },
    request: new Request("https://example.test/api/dashboard?token=secret-token")
  });

  const result = await response.json();

  assert.equal(response.status, 200);
  assert.equal(result.ok, true);
  assert.equal(result.totals.leads, 5);
  assert.equal(result.event_totals.phone_click, 3);
  assert.equal(result.origin_summary.length, 2);
  assert.equal(result.recent_leads.length, 1);
});

test("dashboard api refuses missing or invalid access tokens", async () => {
  const missing = await dashboardApi.onRequestGet({
    env: {
      LEADS_EXPORT_TOKEN: "secret-token",
      LEADS_DB: dashboardDb()
    },
    request: new Request("https://example.test/api/dashboard")
  });

  assert.equal(missing.status, 401);

  const invalid = await dashboardApi.onRequestGet({
    env: {
      LEADS_EXPORT_TOKEN: "secret-token",
      LEADS_DB: dashboardDb()
    },
    request: new Request("https://example.test/api/dashboard?token=wrong")
  });

  assert.equal(invalid.status, 401);
});

test("dashboard page is private and token based", async () => {
  const html = await readFile(new URL("../dashboard.html", import.meta.url), "utf8");

  assert.match(html, /noindex,nofollow/i);
  assert.match(html, /token=YOUR_LEADS_EXPORT_TOKEN/i);
  assert.match(html, /Download leads CSV/i);
  assert.match(html, /Lead Tracking/i);
});
