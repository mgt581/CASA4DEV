import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const siteRoot = new URL("../", import.meta.url);
const googleProfileUrl = "https://www.google.com/maps?cid=9735307698860179158";
const forbiddenTrustClaims = [
  /checkatrade/i,
  /trustatrader/i,
  /trust\s*a\s*trader/i,
  /mybuilder/i,
  /rated\s*people/i,
  /g\.page\/r\/[^\s"']+\/review/i,
  /rated\s+5\s+stars/i,
  /verified\s+profiles/i,
  /images\/Google-Reviews\.png/i
];

const htmlFiles = (await readdir(siteRoot, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name.endsWith(".html"))
  .map((entry) => entry.name)
  .sort();

const imageFiles = await readdir(new URL("images/", siteRoot));

const htmlByFile = new Map();
for (const file of htmlFiles) {
  htmlByFile.set(file, await readFile(new URL(file, siteRoot), "utf8"));
}

test("unverified directory and rating claims are absent", () => {
  for (const [file, html] of htmlByFile) {
    for (const pattern of forbiddenTrustClaims) {
      assert.doesNotMatch(html, pattern, `${file} contains an unverified trust claim`);
    }
  }
});

test("unverified trust graphics are removed", () => {
  for (const image of imageFiles) {
    assert.doesNotMatch(
      image,
      /checkatrade|trustatrader|mybuilder|google-reviews/i,
      `${image} is an obsolete or unverified trust graphic`
    );
  }
});

test("all JSON-LD blocks remain valid and use only the verified Google profile", () => {
  for (const [file, html] of htmlByFile) {
    const blocks = html.matchAll(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/gi);
    for (const block of blocks) {
      const data = JSON.parse(block[1]);
      const entities = data["@graph"] || [data];
      for (const entity of entities) {
        if (!Array.isArray(entity.sameAs)) continue;
        assert.deepEqual(entity.sameAs, [googleProfileUrl], `${file} has an unverified sameAs destination`);
      }
    }
  }
});

test("visible Google review links are safe external links", () => {
  let visibleReviewLinkCount = 0;

  for (const [file, html] of htmlByFile) {
    const anchors = html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>/gi);
    for (const anchor of anchors) {
      if (anchor[1] !== googleProfileUrl) continue;
      visibleReviewLinkCount += 1;
      assert.match(anchor[0], /target="_blank"/i, `${file} review link should open separately`);
      assert.match(anchor[0], /rel="noopener noreferrer"/i, `${file} review link needs safe rel attributes`);
    }
  }

  assert.ok(visibleReviewLinkCount >= 16, "expected Google review links on homepage, contact, service and campaign pages");
});

test("homepage presents one verified review destination", () => {
  const homepage = htmlByFile.get("index.html");
  const trustSection = homepage.match(/<section class="trust-section">([\s\S]*?)<\/section>/i);

  assert.ok(trustSection, "homepage trust section is missing");
  assert.equal((trustSection[1].match(/class="trust-badge"/g) || []).length, 1);
  assert.match(trustSection[1], /Read Our Reviews/i);
  assert.match(trustSection[1], new RegExp(googleProfileUrl.replace(/[?]/g, "\\?")));
});
