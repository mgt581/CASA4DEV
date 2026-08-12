# Lead Generation Setup

This site is now wired for direct lead capture and ad conversion tracking, but the live accounts still need to be connected.

## Cloudflare Pages Environment Variables

Set these in the `casa4dev` Cloudflare Pages project:

- `RESEND_API_KEY`: API key from Resend for sending lead emails.
- `LEAD_TO_EMAIL`: where quote requests should go. Set this to `casa4developments@outlook.com,ajbryantsleads@gmail.com` (multiple recipients are comma-separated).
- `LEAD_FROM_EMAIL`: verified sender. Use a verified domain sender such as `Casa4 Developments <info@casa4developments.co.uk>` once the domain is verified.
- `LEAD_WEBHOOK_URL`: optional CRM/Zapier/Make webhook. Use this instead of, or alongside, email delivery.
- `LEADS_EXPORT_TOKEN`: secret admin fallback for CSV exports and private dashboard access.
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

Download the latest 1,000 leads as CSV through the private admin route. The dashboard and exports are intended to be opened through Cloudflare Access, not a public token link. That dashboard shows recent leads, delivery status, top source clues and the main call / WhatsApp / email engagement events.

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

If neither `RESEND_API_KEY` nor `LEAD_WEBHOOK_URL` is configured, or if delivery fails, the frontend clearly says that the enquiry was not submitted and presents tracked Call and WhatsApp alternatives. It does not open the visitor's email application or imply that the enquiry was received.

Resend will reject unverified senders such as `casa4developments@outlook.com`. Add and verify `casa4developments.co.uk` in Resend, add the DNS records it provides, then use a sender on that domain.

If you are using Cloudflare Email Routing for `info@casa4developments.co.uk`, configure forwarding destinations for both `casa4developments@outlook.com` and `ajbryantsleads@gmail.com`. Email Routing does not by itself make Outlook or Gmail send mail "as" `info@casa4developments.co.uk`; for replies to show that sender address, the mailbox you reply from must support a verified `send as` alias, or you need to send through the verified domain sender configured above.

## Google Ads / GA4

The frontend pushes these events into `dataLayer` and `gtag` when available:

- `quote_cta_click`
- `phone_click`
- `whatsapp_click`
- `email_click`
- `chat_open`
- `chat_question`
- `chat_lead`
- `chat_lead_error`
- `lead_form_submit_attempt`
- `lead_form_error`
- `generate_lead`
- `lead_thank_you_view`

Set `GTM_CONTAINER_ID` or `GA_MEASUREMENT_ID` in Cloudflare Pages to load Google tracking. The production site currently uses Google Tag Manager, so each relevant `dataLayer` event needs a matching Custom Event trigger and GA4 Event tag in the live GTM container. Do not add a second GA4 loader alongside GTM, as that can duplicate page views and conversions.

The server stores a successful form delivery as `generate_lead`. The browser sends the same event to GA4 but deliberately does not store a second copy in D1. This keeps the internal event export from double-counting successful forms.

Recommended conversions:

- Primary: `generate_lead`
- Primary: `chat_lead`
- Primary: phone call from ads or website call tracking
- Secondary: `whatsapp_click`
- Secondary: `quote_cta_click`
- Secondary: `chat_open`

After publishing GTM changes, verify the journey in GTM Preview and GA4 DebugView:

1. Open a page with test UTM parameters.
2. Navigate to the contact page and confirm the original UTM values remain attached.
3. Click each displayed phone number and confirm `phone_click`.
4. Click WhatsApp and confirm `whatsapp_click`.
5. Submit a labelled test form and confirm one `generate_lead` event, one lead database row, one notification email and the thank-you page.
6. Submit a labelled chat request and confirm `chat_lead` plus one delivered lead.
7. Temporarily test a failed delivery route in preview and confirm `lead_form_error` or `chat_lead_error` without exposing internal configuration details.

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
