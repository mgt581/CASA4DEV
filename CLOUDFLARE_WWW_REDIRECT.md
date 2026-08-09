# Canonical www redirect

This hostname-level redirect belongs in Cloudflare Redirect Rules, not the
Pages `_redirects` file. Cloudflare Pages does not support domain-level rules
in `_redirects`.

The current `www` CNAME points to `casa4dev.pages.dev` with **DNS only** proxy
status. Cloudflare correctly warns that a zone Redirect Rule will not receive
that traffic until the record is proxied.

Keep the DNS record unchanged and this rule undeployed until the complete
repair package has passed final regression testing and production deployment
is explicitly approved.

## Rule configuration

- Name: `Redirect Casa4 www to canonical domain`
- Match type: Wildcard pattern
- Request URL: `https://www.casa4developments.co.uk/*`
- Target URL: `https://casa4developments.co.uk/${1}`
- Status: `301`
- Preserve query string: `Enabled`

## Required verification before activation

1. Change only the existing `www` CNAME proxy status from **DNS only** to
   **Proxied**. Do not change its `casa4dev.pages.dev` target.
2. Deploy the redirect rule above.
3. `https://www.casa4developments.co.uk/` redirects in one hop to
   `https://casa4developments.co.uk/`.
4. `http://www.casa4developments.co.uk/` first uses the existing HTTP-to-HTTPS
   redirect and then reaches the canonical domain. This hostname rule must not
   replace or interfere with the existing HTTPS enforcement.
5. A nested path and query string are preserved, for example
   `https://www.casa4developments.co.uk/patios?utm_source=test` redirects to
   `https://casa4developments.co.uk/patios?utm_source=test`.
6. The canonical destination returns `200` and publishes the matching
   non-www canonical link.
7. Forms, telephone links, WhatsApp and analytics still work on the canonical
   destination.
