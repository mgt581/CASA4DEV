import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const siteRoot = new URL("../", import.meta.url);
const canonicalOrigin = "https://casa4developments.co.uk";

test("every declared legacy route is a permanent redirect to a live replacement", async () => {
  const redirects = await readFile(new URL("_redirects", siteRoot), "utf8");
  const rules = redirects
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => line.split(/\s+/));
  const sources = rules.map(([source]) => source);

  assert.equal(new Set(sources).size, sources.length, "_redirects contains a duplicate source");

  for (const [legacyPath, targetPath, status] of rules) {
    assert.equal(status, "301", `${legacyPath} should redirect permanently`);
    assert.match(legacyPath, /^\//, `${legacyPath} must be a path-only Pages redirect`);
    assert.match(targetPath, /^\//, `${targetPath} must stay on the current preview or production host`);
    const targetFile = targetPath === "/" ? "index.html" : `${targetPath.slice(1)}.html`;
    const targetHtml = await readFile(new URL(targetFile, siteRoot), "utf8");
    assert.match(targetHtml, /<!DOCTYPE html>/i, `${targetPath} is not a live HTML replacement`);
  }

  for (const historicalPath of [
    "/about/",
    "/artificialgrass.html",
    "/block-paving/",
    "/block-paving-fareham/",
    "/block-paving-Locks-Heath/",
    "/driveways/",
    "/driveways-portsmouth/",
    "/indian-sandstone/",
    "/offers/",
    "/outdoor-kitchens/",
    "/privacy-policy-2/"
  ]) {
    assert.ok(sources.includes(historicalPath), `${historicalPath} is missing from the migration map`);
  }

  for (const currentPath of [
    "/block-paving-portsmouth",
    "/contact",
    "/gallery",
    "/patios",
    "/porcelain",
    "/services"
  ]) {
    assert.ok(!sources.includes(currentPath), `${currentPath} is a current page and must not be overridden`);
  }
});

test("the www hostname activation plan is staged but explicitly blocked from production", async () => {
  const plan = await readFile(new URL("CLOUDFLARE_WWW_REDIRECT.md", siteRoot), "utf8");

  assert.match(plan, /DNS only/i);
  assert.match(plan, /Keep the DNS record unchanged and this rule undeployed until/i);
  assert.match(plan, /CNAME proxy status from \*\*DNS only\*\* to\s+\*\*Proxied\*\*/i);
  assert.match(plan, /https:\/\/www\.casa4developments\.co\.uk\/\*/i);
  assert.match(plan, /https:\/\/casa4developments\.co\.uk\/\$\{1\}/i);
  assert.match(plan, /Status: `301`/i);
  assert.match(plan, /Preserve query string: `Enabled`/i);
});

test("the custom 404 is noindex and keeps useful lead paths", async () => {
  const html = await readFile(new URL("404.html", siteRoot), "utf8");

  assert.match(html, /<meta name="robots" content="noindex,follow/i);
  assert.doesNotMatch(html, /<link rel="canonical"/i);
  assert.match(html, /<h1[^>]*>Page not found<\/h1>/i);
  assert.match(html, /href="\/services"/i);
  assert.match(html, /href="\/contact"/i);
  assert.match(html, /href="tel:01489290012"/i);
  assert.match(html, /href="https:\/\/wa\.me\/447900281011"/i);
  assert.match(html, /src="\/assets\/lead-capture\.js"/i);
});

test("indexable pages use one self-referencing non-www canonical and appear in the sitemap", async () => {
  const htmlFiles = (await readdir(siteRoot, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".html"))
    .map((entry) => entry.name)
    .sort();
  const sitemap = await readFile(new URL("sitemap.xml", siteRoot), "utf8");
  const sitemapUrls = new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]));

  for (const file of htmlFiles) {
    const html = await readFile(new URL(file, siteRoot), "utf8");
    const robots = html.match(/<meta name="robots" content="([^"]+)"/i)?.[1] || "";
    const canonicals = [...html.matchAll(/<link rel="canonical" href="([^"]+)"/gi)].map((match) => match[1]);
    const isNoindex = /\bnoindex\b/i.test(robots);

    if (isNoindex) {
      assert.equal(canonicals.length, 0, `${file} should not publish a canonical`);
      continue;
    }

    const expectedPath = file === "index.html" ? "/" : `/${file.replace(/\.html$/, "")}`;
    const expectedCanonical = `${canonicalOrigin}${expectedPath}`;
    assert.deepEqual(canonicals, [expectedCanonical], `${file} has an inconsistent canonical`);
    assert.ok(sitemapUrls.has(expectedCanonical), `${file} is missing from sitemap.xml`);
  }
});

test("robots.txt advertises the canonical sitemap", async () => {
  const robots = await readFile(new URL("robots.txt", siteRoot), "utf8");
  assert.match(robots, /^User-agent: \*$/m);
  assert.match(robots, /^Allow: \/$/m);
  assert.match(robots, /^Sitemap: https:\/\/casa4developments\.co\.uk\/sitemap\.xml$/m);
});
