# Lead Generation Setup

This site is now wired for direct lead capture and ad conversion tracking, but the live accounts still need to be connected.

## Cloudflare Pages Environment Variables

Set these in the `casa4dev` Cloudflare Pages project:

- `RESEND_API_KEY`: API key from Resend for sending lead emails.
- `LEAD_TO_EMAIL`: where quote requests should go. Multiple recipients can be comma-separated, for example `casa4developments@outlook.com,alex@bryantdigitalsolutions.com`.
- `LEAD_FROM_EMAIL`: verified sender, currently planned as `casa4developments@outlook.com`.
- `LEAD_WEBHOOK_URL`: optional CRM/Zapier/Make webhook. Use this instead of, or alongside, email delivery.

The form endpoint is:

```text
/api/lead
```

If neither `RESEND_API_KEY` nor `LEAD_WEBHOOK_URL` is configured, the frontend opens an email fallback instead of pretending the form was sent.

## Google Ads / GA4

The frontend pushes these events into `dataLayer` and `gtag` when available:

- `quote_cta_click`
- `phone_click`
- `whatsapp_click`
- `lead_form_submit_attempt`
- `generate_lead`
- `lead_thank_you_view`

Add Google Tag Manager or the Google tag to the site, then map these events in GA4 and Google Ads conversions.

Recommended conversions:

- Primary: `generate_lead`
- Primary: phone call from ads or website call tracking
- Secondary: `whatsapp_click`
- Secondary: `quote_cta_click`

## Call Tracking

Use a call tracking provider to replace visible phone numbers for paid traffic. Keep the original business number as the forwarding destination:

```text
01489 290012
07900 281011
```

Recommended campaign tracking:

- One number for Google Ads search.
- One number for organic/local SEO.
- Optional service-level numbers for high-spend campaigns.

## Campaign Landing Pages

Starter landing pages have been added for paid traffic:

- `campaign-block-paving.html`
- `campaign-patios.html`
- `campaign-landscaping.html`

Use these as Google Ads final URLs for focused campaigns.
