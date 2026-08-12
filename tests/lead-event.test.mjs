import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function importSource(relativePath) {
  const source = await readFile(new URL(relativePath, import.meta.url), "utf8");
  return import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
}

const leadEventApi = await importSource("../functions/api/lead-event.js");

function databaseCapture(rows) {
  return {
    prepare() {
      return {
        async run() {
          return { success: true };
        },
        bind(...values) {
          return {
            async run() {
              rows.push(values);
            }
          };
        }
      };
    }
  };
}

function eventContext(eventName, rows) {
  return {
    env: { LEADS_DB: databaseCapture(rows) },
    request: new Request("https://example.test/api/lead-event", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        event_name: eventName,
        page: "https://example.test/contact",
        source: "website"
      })
    })
  };
}

test("all lead and chat journey events are accepted", async () => {
  const supportedEvents = [
    "page_view",
    "quote_cta_click",
    "phone_click",
    "whatsapp_click",
    "email_click",
    "chat_open",
    "chat_question",
    "chat_lead",
    "chat_lead_error",
    "lead_form_submit_attempt",
    "lead_form_error",
    "lead_delivery_failed",
    "generate_lead",
    "lead_thank_you_view"
  ];

  for (const eventName of supportedEvents) {
    const rows = [];
    const response = await leadEventApi.onRequestPost(eventContext(eventName, rows));
    assert.equal(response.status, 200, `${eventName} should be accepted`);
    assert.equal(rows.length, 1, `${eventName} should be stored once`);
    assert.equal(rows[0][1], eventName);
  }
});

test("plain-domain Facebook events keep Facebook attribution", async () => {
  const rows = [];
  const context = eventContext("page_view", rows);
  context.request = new Request("https://example.test/api/lead-event", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      event_name: "page_view",
      page: "https://example.test/",
      referrer: "https://m.facebook.com/",
      source: "website"
    })
  });

  const response = await leadEventApi.onRequestPost(context);
  assert.equal(response.status, 200);
  assert.equal(rows[0][5], "facebook");
});

test("unknown events are rejected and not stored", async () => {
  const rows = [];
  const response = await leadEventApi.onRequestPost(eventContext("unknown_event", rows));

  assert.equal(response.status, 400);
  assert.equal(rows.length, 0);
});

test("a missing database is reported", async () => {
  const response = await leadEventApi.onRequestPost({
    env: {},
    request: new Request("https://example.test/api/lead-event", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event_name: "phone_click" })
    })
  });

  assert.equal(response.status, 503);
});
