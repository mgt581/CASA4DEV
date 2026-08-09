import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const siteRoot = new URL("../", import.meta.url);
const businessId = "https://casa4developments.co.uk/#business";
const googleProfileUrl = "https://www.google.com/maps?cid=9735307698860179158";

const htmlFiles = (await readdir(siteRoot, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name.endsWith(".html"))
  .map((entry) => entry.name)
  .sort();

const businesses = [];
for (const file of htmlFiles) {
  const html = await readFile(new URL(file, siteRoot), "utf8");
  for (const match of html.matchAll(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/gi)) {
    const data = JSON.parse(match[1]);
    const entities = data["@graph"] || [data];
    for (const entity of entities) {
      if (entity["@type"] === "HomeAndConstructionBusiness") businesses.push({ file, entity });
    }
  }
}

test("every business schema block identifies the same verified legal entity", () => {
  assert.ok(businesses.length >= 22, "expected business schema across the main site pages");

  for (const { file, entity } of businesses) {
    assert.equal(entity["@id"], businessId, `${file} has a different business entity ID`);
    assert.equal(entity.name, "Casa4 Developments", `${file} has an inconsistent trading name`);
    assert.equal(entity.legalName, "CASA 4 DEVELOPMENTS LTD", `${file} is missing the legal name`);
    assert.equal(entity.alternateName, "Casa 4 Developments Ltd", `${file} is missing the live-profile name`);
    assert.deepEqual(entity.identifier, {
      "@type": "PropertyValue",
      propertyID: "Companies House",
      value: "16465928"
    }, `${file} has an inconsistent Companies House identifier`);
    assert.deepEqual(entity.sameAs, [googleProfileUrl], `${file} has a different Google profile`);
  }
});
test("business schema uses the verified registered office and both published phones", () => {
  for (const { file, entity } of businesses) {
    assert.deepEqual(entity.telephone, ["01489 290012", "07900 281011"], `${file} should publish both phones`);
    assert.deepEqual(entity.address, {
      "@type": "PostalAddress",
      streetAddress: "2A Torrington Road",
      addressLocality: "Portsmouth",
      addressRegion: "Hampshire",
      postalCode: "PO2 0TP",
      addressCountry: "GB"
    }, `${file} has an inconsistent registered-office address`);
    assert.ok(entity.areaServed.includes("Fareham"), `${file} must retain the Fareham service area`);
    assert.ok(entity.areaServed.includes("Portsmouth"), `${file} must identify Portsmouth in its service area`);
  }
});

test("key customer and legal pages disclose the verified company details", async () => {
  for (const file of ["index.html", "contact.html", "privacy.html"]) {
    const html = await readFile(new URL(file, siteRoot), "utf8");
    assert.match(html, /CASA 4 DEVELOPMENTS LTD/i, `${file} is missing the legal entity`);
    assert.match(html, /16465928/, `${file} is missing the company number`);
    assert.match(html, /2A Torrington Road, Portsmouth, England, PO2 0TP/i, `${file} is missing the registered office`);
  }
});

test("the live profile repair remains staged under the production freeze", async () => {
  const plan = await readFile(new URL("GBP_CONSISTENCY_PLAN.md", siteRoot), "utf8");

  assert.match(plan, /No Google Business Profile field was changed/i);
  assert.match(plan, /Own this business\?/i);
  assert.match(plan, /DATA REQUIRED/i);
  assert.match(plan, /explicit owner approval/i);
  assert.match(plan, /https:\/\/casa4developments\.co\.uk\//i);
  assert.match(plan, /Monday–Saturday 8am–5pm/i);
  assert.match(plan, /Monday–Friday 8am–6pm and Saturday 9am–4pm/i);
});
