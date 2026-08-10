import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const siteRoot = new URL("../", import.meta.url);

async function readHtml(file) {
  return readFile(new URL(file, siteRoot), "utf8");
}

test("homepage messaging is focused on driveways patios and outdoor living", async () => {
  const html = await readHtml("index.html");

  assert.match(html, /Driveways, Patios &amp; Outdoor Living/i);
  assert.match(html, /Specialising in driveways, patios and outdoor living spaces in Fareham/i);
  assert.doesNotMatch(html, /family-run home improvement specialists in Fareham/i);
});

test("services page explains the core work and selective wider projects", async () => {
  const html = await readHtml("services.html");

  assert.match(html, /Driveways, Patios &amp; Outdoor Living Services Fareham/i);
  assert.match(html, /Our core work is driveways, patios and outdoor living spaces/i);
  assert.match(html, /selected home improvement projects when the fit is right/i);
});

test("contact and case studies pages reinforce the same positioning", async () => {
  const contact = await readHtml("contact.html");
  const caseStudies = await readHtml("case-studies.html");

  assert.match(contact, /Tell Us About Your Project/i);
  assert.match(contact, /Driveways, patios and outdoor living enquiries welcome/i);
  assert.match(caseStudies, /Case Studies &amp; Project Proof/i);
  assert.match(caseStudies, /project proof/i);
});

test("sitewide footers now use the refined brand line", async () => {
  for (const file of ["index.html", "services.html", "contact.html", "gallery.html", "case-studies.html", "driveways.html", "outdoorrooms.html"]) {
    const html = await readHtml(file);
    assert.match(html, /Fareham, Hampshire \| Driveways, Patios &amp; Outdoor Living/i, `${file} should use the refined footer line`);
  }
});
