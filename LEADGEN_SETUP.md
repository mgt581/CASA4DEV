# Lead Generation Setup

This site is now wired for direct lead capture and ad conversion tracking, but the live accounts still need to be connected.

## Cloudflare Pages Environment Variables

Set these in the `casa4dev` Cloudflare Pages project:

- `RESEND_API_KEY`: API key from Resend for sending lead emails.
- `LEAD_TO_EMAIL`: where quote requests should go. Multiple recipients can be comma-separated, for example `casa4developments@outlook.com,alex@bryantdigitalsolutions.com`.
- `LEAD_FROM_EMAIL`: verified sender. Use a Resend-verified domain sender such as `Casa4 Developments <leads@casa4developments.co.uk>` once DNS verification is complete.
- `LEAD_WEBHOOK_URL`: optional CRM/Zapier/Make webhook. Use this instead of, or alongside, email delivery.
- `LEADS_EXPORT_TOKEN`: secret token used to download a CSV export from `/api/leads/export?token=...`.
- `GTM_CONTAINER_ID`: optional Google Tag Manager container ID, for example `GTM-XXXXXXX`.
- `GA_MEASUREMENT_ID`: optional GA4 measurement ID, for example `G-XXXXXXXXXX`.
- `CLARITY_PROJECT_ID`: optional Microsoft Clarity project ID for heatmaps and session recordings.

## Cloudflare D1 Lead Storage

The Pages project should have a D1 database binding named:

```text
LEADS_DB
```

The schema is stored in:

```text
migrations/0001_leads.sql
```

Every valid quote request is stored in D1 whether email delivery succeeds or fails. The table stores enquiry details, source page, form source, delivery status, delivery errors, user agent, a hashed IP address, and whether the visitor opted into marketing.

Download the latest 1,000 leads as CSV:

```text
/api/leads/export?token=YOUR_LEADS_EXPORT_TOKEN
```

You can also send the token as an Authorization header:

```text
Authorization: Bearer YOUR_LEADS_EXPORT_TOKEN
```

Only share the export token with people who should be allowed to download lead data.

## Mailing List Consent

Quote requests can be followed up as service enquiries. Marketing emails are separate.

The frontend injects an optional consent checkbox into every lead form:

```text
I agree to receive occasional updates and offers from Casa4 Developments.
```

Only leads with `marketing_consent = 1` should be imported into newsletters, offers, or remarketing email lists.

The form endpoint is:

```text
/api/lead
```

If neither `RESEND_API_KEY` nor `LEAD_WEBHOOK_URL` is configured, the frontend opens an email fallback instead of pretending the form was sent.

Resend will reject unverified senders such as `casa4developments@outlook.com`. Add and verify `casa4developments.co.uk` in Resend, add the DNS records it provides, then use a sender on that domain.

## Google Ads / GA4

The frontend pushes these events into `dataLayer` and `gtag` when available:

- `quote_cta_click`
- `phone_click`
- `whatsapp_click`
- `lead_form_submit_attempt`
- `generate_lead`
- `lead_thank_you_view`

Set `GTM_CONTAINER_ID` or `GA_MEASUREMENT_ID` in Cloudflare Pages to load Google tracking. Then map these events in GA4 and Google Ads conversions.

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

## Heatmaps

Set `CLARITY_PROJECT_ID` in Cloudflare Pages to load Microsoft Clarity for heatmaps and session recordings.
