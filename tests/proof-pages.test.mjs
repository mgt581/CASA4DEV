import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const siteRoot = new URL("../", import.meta.url);
const googleProfileUrl = "https://www.google.com/maps?cid=9735307698860179158";

test("case studies page presents project detail and verified review access", async () => {
  const html = await readFile(new URL("case-studies.html", siteRoot), "utf8");

  assert.match(html, /<link rel="canonical" href="https:\/\/casa4developments\.co\.uk\/case-studies"/i);
  assert.match(html, /Read Our Google Reviews/i);
  assert.match(html, new RegExp(googleProfileUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(html, /Porcelain Driveway With Landscaped Borders/i);
  assert.match(html, /Block Paving Courtyard And Driveway Area/i);
  assert.match(html, /Outdoor Living Space With Kitchen And Pergola/i);
});

test("homepage, services and gallery surface the case studies page", async () => {
  for (const file of ["index.html", "services.html", "gallery.html"]) {
    const html = await readFile(new URL(file, siteRoot), "utf8");
    assert.match(html, /case-studies\.html/i, `${file} should link to the case studies page`);
  }
});
