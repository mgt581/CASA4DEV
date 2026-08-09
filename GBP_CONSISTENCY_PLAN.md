# Fix 4 — Google Business Profile consistency

Audit date: 10 August 2026

This is a staged, non-production repair plan. No Google Business Profile field was changed during Fix 4. The Google account available in the browser shows **Own this business?**, not owner/manager controls, and the wider project is under a production freeze.

## Verified public profile

The direct profile at `https://www.google.com/maps?cid=9735307698860179158` currently shows:

- Business name: **Casa 4 Developments Ltd**
- Primary category: **Paving contractor**
- Public address: **2A Torrington Road, Hilsea, Portsmouth, PO2 0TP**
- Public phone: **07900 281011**
- Website: **http://casa4developments.co.uk/**
- Hours: **Monday–Saturday 8am–5pm; Sunday closed**
- Service options: online estimates and on-site services

Companies House independently records **CASA 4 DEVELOPMENTS LTD**, company number **16465928**, with the registered office at **2A Torrington Road, Portsmouth, England, PO2 0TP**.

## Preview-safe changes completed

- Kept the customer-facing brand **Casa4 Developments**, matching the website logo.
- Added the verified legal name, Companies House number and registered office to the homepage, contact page and privacy page.
- Connected every `HomeAndConstructionBusiness` JSON-LD block to one stable business entity ID.
- Added the legal name and live-profile alternate name to the structured data.
- Added both published phone numbers to every business schema block.
- Replaced the unsupported Fareham-only schema address with the verified registered-office address.
- Kept Fareham, Portsmouth and the wider operating area in `areaServed`, so registered office and service coverage are not conflated.

## Live profile decisions held for approval

### Name

**RECOMMENDATION:** Change the profile to **Casa4 Developments** only if current signage, vehicles, invoices and stationery consistently use that exact trading name. Google requires the profile name to match the real-world brand; the legal suffix should not be retained merely for keyword or corporate-detail purposes. The website now preserves **CASA 4 DEVELOPMENTS LTD** separately as the legal name.

**DATA REQUIRED:** One current photograph of business signage or a vehicle, plus a current customer invoice or quotation header.

### Address and service area

**RECOMMENDATION:** If customers do not visit a permanently signed and staffed business location at 2A Torrington Road during the published hours, hide the street address and operate the profile as a service-area business. Keep the address privately for verification.

Set only areas genuinely served. The proposed starting set, subject to owner confirmation, is Fareham, Portchester, Stubbington, Lee-on-the-Solent, Gosport, Locks Heath, Park Gate, Whiteley, Portsmouth and Southampton. Do not add broad or distant areas solely to influence rankings.

**DATA REQUIRED:** Confirm whether customers can visit 2A Torrington Road and whether permanent Casa4 signage and staff are present there during the stated hours. Confirm the towns that can normally be served within approximately two hours.

### Phone

**RECOMMENDATION:** Keep **07900 281011** on the profile and add **01489 290012** as an additional number. Make the landline primary only after a live inbound-call test confirms it is consistently answered or forwarded. The website and structured data now publish both numbers.

**DATA REQUIRED:** One live call test to each number and confirmation of which number should receive most new enquiries.

### Website

**RECOMMENDATION:** After production approval, replace the profile's `http` URL with the canonical **https://casa4developments.co.uk/** URL. The current URL redirects correctly, but the direct canonical URL removes ambiguity.

### Hours

The profile says Monday–Saturday 8am–5pm. The website says Monday–Friday 8am–6pm and Saturday 9am–4pm.

**DATA REQUIRED:** Confirm the real customer-facing hours. Then update both sources together and add holiday special hours. Do not choose either set merely to force consistency.

### Categories and services

**RECOMMENDATION:** Retain **Paving contractor** as the primary category while driveways and patios remain the highest commercial priority. In the profile editor, add only available secondary categories that describe work Casa4 genuinely performs; do not add categories as keywords.

Review the services editor and include only current offerings, prioritising:

- Porcelain driveways
- Block-paving driveways
- Porcelain and natural-stone patios
- Garden landscaping
- Outdoor kitchens and BBQ areas
- Outdoor rooms, garden rooms and offices
- Pergolas, decking and fencing
- General building, extensions, kitchens and bathrooms where actively offered

**DATA REQUIRED:** Confirm which services are currently deliverable, insured and commercially wanted. Prices should remain omitted unless the business wants to maintain accurate published prices.

## Production activation checklist

Only after the final site regression and explicit owner approval:

1. Obtain owner or manager access to the verified profile.
2. Capture the current settings before editing.
3. Apply only the confirmed name, location/service-area, phone, HTTPS website, hours, category and service changes.
4. Save one field group at a time and record whether Google requires reverification.
5. Confirm the public profile after Google's review completes.
6. Re-run desktop/mobile calls, website clicks, directions/service-area display and review-link tests.
