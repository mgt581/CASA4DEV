import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function importSource(relativePath) {
  const source = await readFile(new URL(relativePath, import.meta.url), "utf8");
  return import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
}

const leadApi = await importSource("../functions/api/lead.js");

function leadRequest(payload) {
  return new Request("https://example.test/api/lead", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
}

test("name and phone are required", async () => {
  const response = await leadApi.onRequestPost({
    env: {},
    request: leadRequest({ name: "", phone: "" })
  });

  assert.equal(response.status, 400);
});

test("an unconfigured delivery route returns a safe public error", async () => {
  const response = await leadApi.onRequestPost({
    env: {},
    request: leadRequest({ name: "Test Lead", phone: "07000000000" })
  });
  const result = await response.json();

  assert.equal(response.status, 503);
  assert.equal(result.ok, false);
  assert.match(result.error, /call or WhatsApp/i);
  assert.doesNotMatch(result.error, /RESEND|WEBHOOK|Cloudflare/i);
});

test("a successful email delivery returns the thank-you redirect", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("", { status: 200 });

  try {
    const response = await leadApi.onRequestPost({
      env: {
        RESEND_API_KEY: "test-key",
        LEAD_TO_EMAIL: "owner@example.test",
        LEAD_FROM_EMAIL: "Casa4 Developments <info@example.test>"
      },
      request: leadRequest({
        name: "Test Lead",
        phone: "07000000000",
        service: "Patios"
      })
    });
    const result = await response.json();

    assert.equal(response.status, 200);
    assert.equal(result.ok, true);
    assert.equal(result.redirect, "/thank-you.html?service=Patios");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("a rejected email delivery returns a safe public error", async () => {
  const originalFetch = globalThis.fetch;
  const originalConsoleError = console.error;
  globalThis.fetch = async () => new Response("Rejected", { status: 400 });
  console.error = () => {};

  try {
    const response = await leadApi.onRequestPost({
      env: {
        RESEND_API_KEY: "test-key",
        LEAD_TO_EMAIL: "owner@example.test"
      },
      request: leadRequest({ name: "Test Lead", phone: "07000000000" })
    });
    const result = await response.json();

    assert.equal(response.status, 502);
    assert.match(result.error, /call or WhatsApp/i);
    assert.doesNotMatch(result.error, /Resend|status|configured/i);
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalConsoleError;
  }
});

test("a plain-domain Facebook lead keeps Facebook attribution", async () => {
  const originalFetch = globalThis.fetch;
  const rows = [];
  const db = {
    prepare(sql) {
      return {
        async all() {
          return { results: [
            { name: "lead_status" },
            { name: "quote_value_pence" },
            { name: "won_revenue_pence" },
            { name: "status_updated_at" }
          ] };
        },
        async run() { return { success: true }; },
        bind(...values) {
          return {
            async run() {
              rows.push({ sql, values });
              return { success: true };
            }
          };
        }
      };
    }
  };
  globalThis.fetch = async () => new Response("", { status: 200 });

  try {
    const response = await leadApi.onRequestPost({
      env: {
        RESEND_API_KEY: "test-key",
        LEAD_TO_EMAIL: "owner@example.test",
        LEADS_DB: db
      },
      request: leadRequest({
        name: "Facebook Visitor",
        phone: "07000000000",
        service: "Driveways",
        source: "website",
        referrer: "https://m.facebook.com/",
        landing_page: "https://example.test/"
      })
    });

    assert.equal(response.status, 200);
    const leadInsert = rows.find((row) => row.sql.includes("INSERT INTO leads"));
    assert.equal(leadInsert.values[9], "facebook");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
