import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function importSource(relativePath) {
  const source = await readFile(new URL(relativePath, import.meta.url), "utf8");
  return import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
}

const leadUpdateApi = await importSource("../functions/api/leads/[id].js");

function updateRequest(body, authorization = "Bearer secret-token") {
  return new Request("https://example.test/api/leads/12", {
    method: "PATCH",
    headers: { "content-type": "application/json", authorization },
    body: JSON.stringify(body)
  });
}

function updateDb() {
  return {
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
        bind() {
          return {
            async run() { return { meta: { changes: sql.includes("UPDATE leads") ? 1 : 0 } }; }
          };
        },
        async run() { return { success: true }; }
      };
    }
  };
}

test("pipeline updates validate auth, status and revenue", async () => {
  const env = { LEADS_DB: updateDb(), LEADS_EXPORT_TOKEN: "secret-token" };
  const response = await leadUpdateApi.onRequestPatch({
    env,
    params: { id: "12" },
    request: updateRequest({
      lead_status: "WON",
      quote_value_pence: 125000,
      won_revenue_pence: 120000
    })
  });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.lead.lead_status, "WON");
  assert.equal(body.lead.won_revenue_pence, 120000);

  const invalid = await leadUpdateApi.onRequestPatch({
    env,
    params: { id: "12" },
    request: updateRequest({ lead_status: "INVALID", quote_value_pence: 0, won_revenue_pence: 0 })
  });
  assert.equal(invalid.status, 400);

  const unauthorized = await leadUpdateApi.onRequestPatch({
    env,
    params: { id: "12" },
    request: updateRequest({ lead_status: "NEW", quote_value_pence: 0, won_revenue_pence: 0 }, "")
  });
  assert.equal(unauthorized.status, 401);
});
