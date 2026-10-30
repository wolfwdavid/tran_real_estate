---
status: superseded
superseded_by: .planning/HUMAN-UAT.md
phase: 10-launch-hardening-go-to-market
source: [docs/LAUNCH-AUDIT.md]
started: 2026-10-14T05:50:00Z
updated: 2026-10-14T05:50:00Z
---
> Superseded on 2026-10-30 by `.planning/HUMAN-UAT.md` (Phase 13 ledger). This file is kept as history; record results in the ledger.

## Current Test

[awaiting owner accounts and the deployed origin: the GitHub org `tranrealestate` with Pages enabled, an Umami website, a Web3Forms access key and (optionally) a contact address. Steps are in docs/DEPLOY-CHECKLIST.md Steps 7 and 8. Test 8 is an owner decision that needs no account.]

## Tests

### 1. Umami usage counts arrive from the deployed origin
expected: with `PUBLIC_ANALYTICS_HOST` and `PUBLIC_ANALYTICS_WEBSITE_ID` set and deployed, opening two different pages in a normal browser (GPC and Do Not Track off) records two pageviews in the Umami dashboard; repeating in a browser with Global Privacy Control on records none; Umami's settings confirm IP addresses are not stored (record the answer here). The cut line (DEPLOY-CHECKLIST Step 8.1.8): if no pageviews arrive from the deployed origin, remove both variables and redeploy (the beacon becomes a no-op and the privacy page says Tran doesn't count visits), move GTM-04 to v2 in `.planning/REQUIREMENTS.md`, and record the decision in `.planning/PROJECT.md` under Key Decisions.
result: [pending — needs an Umami website, the two repository variables and the live origin]

### 2. Web3Forms waitlist and feedback emails arrive
expected: with `PUBLIC_WEB3FORMS_KEY` set and deployed, one waitlist entry on `/for-renters/` and one message on `/feedback/` each arrive in the owner's inbox, with the subjects "Tran waitlist: Renter" and "Tran feedback: <topic picked>"; captcha is OFF in the Web3Forms dashboard (the CSP forbids third-party captcha scripts; the forms use a hidden trap field and a 3-second check instead).
result: [pending — needs the owner's Web3Forms access key and the live origin]

### 3. Contact email mailto fallbacks
expected: only if the owner sets `PUBLIC_CONTACT_EMAIL`: the forms' error and "isn't open yet" states show a mailto link to that address, the link opens a message to it, and the mailbox receives it. With the variable unset, the forms show "check back later" text and no address (already verified locally).
result: [pending — optional; needs the owner to choose and set a contact address]

### 4. Share cards in a link-preview debugger
expected: pasting `https://tranrealestate.github.io/` and `https://tranrealestate.github.io/tools/cap-rate/` into a link-preview debugger (LinkedIn Post Inspector or the Facebook Sharing Debugger) shows the right title, description and the 1200 x 630 card image for each.
result: [pending — needs the live origin; the six cards and their tags pass assert-seo locally]

### 5. Sitemap in Search Console, robots.txt at the org root
expected: a Google Search Console property for `https://tranrealestate.github.io/` is verified, `https://tranrealestate.github.io/sitemap.xml` is submitted and read with 14 URLs and no errors, and `https://tranrealestate.github.io/robots.txt` is served with the `Sitemap:` line.
result: [pending — needs the live origin and a Search Console account]

### 6. Live-origin checks (DEPLOY-CHECKLIST Step 7)
expected: on the deployed URL, a deep portal route (for example `/investor/deals/`) survives a hard refresh; `/renter` redirects to `/renter/`; a bogus path shows the branded not-found page; Test connection succeeds from the deployed URL for real Anthropic, OpenAI and Gemini keys and "Forget all keys" removes them all; on a real device with Safari 17 or later, Settings shows the storage persistence result (granted or not granted).
result: [pending — needs the live origin, the owner's provider keys and a Safari 17+ device]

### 7. Dependabot alerts and secret scanning push protection
expected: under Settings → Code security, Dependabot alerts and Dependabot security updates are on, secret scanning and push protection are on, and the throwaway-branch probe in DEPLOY-CHECKLIST Step 7.7 is rejected at push time (`pnpm audit` in CI stays the authoritative dependency gate).
result: [pending — server-side GitHub settings; needs the remote repository]

### 8. Report-only pages over the 60 KB JS budget (owner decision)
expected: the owner decides, per page, to ship as is or to schedule the recommended trim, using the measured numbers in docs/LAUNCH-AUDIT.md "Performance budget" → "Report-only pages over the tool budget". Measured 2026-10-14 (initial JS, gzip -9, build/ and build-configured/): `/feedback/` 102.5 / 102.7 KB; `/for-renters/`, `/for-investors/`, `/for-agents/` 96.5 / 96.6-96.7 KB, against the 60 KB budget that gates the tool pages (UI-SPEC makes these pages report-only, so they do not fail the gate). Cause measured in 10-23: the shadcn Button (tailwind-variants + tailwind-merge, 13.0 + 8.6 KB), zod (9.2 KB) and, on /feedback/, the bits-ui RadioGroup runtime (about 3 KB) ship in the initial JS. Recommendation: plain `<button>`s and native radio inputs with static classes (as the tool pages already do) and zod (or the whole form) loaded with a dynamic import on first focus or submit; roughly 31-34 KB of each overage sits in those chunks.
result: [pending — owner decision: ship as is (record "accepted") or schedule the trim as a follow-up plan]

## Summary

total: 8
passed: 0
issues: 0
pending: 8
skipped: 0
blocked: 0

## Gaps

None. These are deferred owner actions; every locally verifiable behavior behind them passed in docs/LAUNCH-AUDIT.md.
