# Human UAT ledger (all phases)

One file for every owner-run check from Phases 1-12, plus the Phase 13 live-origin checks.
Updated: 2026-10-31 (Phase 13 results, plan 13-19). Live origin: https://wolfwdavid.github.io/tran_real_estate/
(go-live 2026-10-30, GO_LIVE_SHA ad5fd08; deployed commit f169749 at the time of writing).

## Counting rule

One row = one `### ` heading under `## Tests` in a per-phase `??-HUMAN-UAT.md` file, or one
`| X<n> |` table row in files that use id tables (04 `U`, 05 `H`, 06 `R`, 07 `I` and `S`).
`### A.`-style headings in 04/05 are step recipes for rows, not rows. Count: 99 rows
(01=3, 02=3, 03=9, 04=14, 05=10, 06=12, 07=15, 08=7, 09=8, 10=8, 11=8, 12=2). The roadmap's
earlier "77" was a miscount: it counted the 06/07 owner lists as 8 rows instead of 27.
`scripts/human-uat-ledger.test.ts` enforces this rule and fails if any row is dropped.

## Classes and results

- Class `smoke`: closed by a live smoke spec; evidence is the `live-smoke` run link.
- Class `human`: done by the owner; evidence is a proof file under `docs/launch-proof/` or a note.
- Class `owner-decision`: a recorded decision (also in PROJECT.md Key Decisions when it changes scope).
- Class `cut`: out of v1.1, with the reason.
- Result vocabulary: `pending (<who>, target <date>)`, `passed <date>`, `failed <date>: <why>`,
  `carried (Phase NN <item>)`, `decided <date>: <decision>`, `cut: <reason>`, `not applicable: <why>`.
- The per-phase files are kept as history with `status: superseded`.
- Evidence `—` means nothing recorded yet; a `passed` result always needs evidence, and a `smoke`
  row that passed needs the `live-smoke` run link (`/actions/runs/`).

## Ledger

| Id | Origin | Title | Class | Result | Evidence |
|----|--------|-------|-------|--------|----------|
| L01 | 01-1 | Live origin routing and CSP on the real host | smoke | passed 2026-10-31 | live-smoke https://github.com/wolfwdavid/tran_real_estate/actions/runs/41149881068 (f070c74, 121 passed, 2026-10-31T00:24Z: `routing.smoke.ts` 4 tests + `csp.smoke.ts`); the same specs were green in the go-live run 41115004823 on ad5fd08 (2026-10-30; its one failure was the precache wait, fixed in 79f82bc); `docs/launch-proof/2026-10-30/` (01-05 PNGs + checks.json, README index); owner D-15 fresh-profile result "Fresh checks pass" (13-13-SUMMARY.md) |
| L02 | 01-2 | Gated Pages deploy runs; artifact has `.nojekyll` | smoke | passed 2026-10-30 | go-live ci https://github.com/wolfwdavid/tran_real_estate/actions/runs/41111039721 (hygiene + quality green, deploy job success 19:24:26Z, "Evaluated environment url: https://wolfwdavid.github.io/tran_real_estate/"); `curl -sI https://wolfwdavid.github.io/tran_real_estate/.nojekyll` -> HTTP/1.1 200 OK (13-13-SUMMARY.md D-13 table); `workflow-gate.test.ts` |
| L03 | 01-3 | Push protection rejects a token push | human | passed 2026-10-31 | 13-21-SUMMARY.md (status only: rejected by push protection; PAT revoked; probe branch never on the remote, deleted locally; `secret_scanning_push_protection.status` = enabled via the API) |
| L04 | 02-1 | 375px warm-editorial visual feel | human | pending (owner) | P13 owner glance on a phone, live origin; screenshot |
| L05 | 02-2 | Legal review of the four /legal/ pages | owner-decision | pending (owner) | owner records "counsel reviewed" or "launch without counsel review, accepted risk" |
| L06 | 02-3 | Fonts/assets same-origin on the live origin | smoke | passed 2026-10-31 | `third-party.smoke.ts` (every route, zero cross-origin) + `assets.smoke.ts` in live-smoke https://github.com/wolfwdavid/tran_real_estate/actions/runs/41149881068 (f070c74, 121 passed); re-confirmed on f169749 in run 41202355014 |
| L07 | 03-1 | Android Chrome install standalone | human | pending (owner) | device |
| L08 | 03-2 | Desktop Chrome/Edge install | human | pending (owner) | dev machine, live origin |
| L09 | 03-3 | iPhone Safari Add to Home Screen | human | pending (owner) | device |
| L10 | 03-4 | iPad desktop UA shows iOS steps | human | pending (owner) | device (if no iPad: `cut`, reason "no device") |
| L11 | 03-5 | Firefox persistent-storage prompt | human | pending (owner) | dev machine |
| L12 | 03-6 | Safari real persistence status | human | pending (owner) | device (same session as L09) |
| L13 | 03-7 | Offline launch on a real device | human | pending (owner) | device; precache contents already proven by `pwa.smoke.ts` |
| L14 | 03-8 | Firefox session restore of session keys | human | pending (owner) | record observation (accepted limitation) |
| L15 | 03-9 | Real-key card shows last 4 only (optional) | human | pending (owner) | fold into L18 (same session) |
| L16 | 04-U1 | Card required at RentCast sign-up? | human | pending (owner) | account creation |
| L17 | 04-U2 | Key format | human | pending (owner) | dashboard |
| L18 | 04-U3 | Test key valid | human | pending (owner) | live origin, 04-HUMAN-UAT steps A |
| L19 | 04-U4 | Test key invalid | human | pending (owner) | 04-HUMAN-UAT steps B |
| L20 | 04-U5 | Restricted key 403 | human | pending (owner) | 04-HUMAN-UAT steps C (optional second key) |
| L21 | 04-U6 | Empty listing search | human | pending (owner) | 1 call |
| L22 | 04-U7 | Does a 404 bill? | human | pending (owner) | dashboard before/after |
| L23 | 04-U8 | Page 2 billed separately | cut | cut: only observable with 500+ results; not reachable on the free tier without waste | re-open as `human` if a 500+ result search ever occurs |
| L24 | 04-U9 | 403 body on cancelled plan | cut | cut: optional; only observable if the owner cancels a paid plan | — |
| L25 | 04-U10 | Field coverage of a real listing | human | pending (owner) | after a billed search |
| L26 | 04-U11 | Browser fetch from the deployed origin (CORS) | human | passed 2026-10-31 | 13-21-SUMMARY.md (status/host/count only: RentCast key test from https://wolfwdavid.github.io/tran_real_estate/settings/ showed the accepted line with no CORS error; dashboard count not recorded, owner states unchanged) |
| L27 | 04-U12 | Open-ended range bounds | human | pending (owner) | 3 calls |
| L28 | 04-U13 | Highest bedroom bucket | human | pending (owner) | 1 call |
| L29 | 04-U14 | Listing in its own comparables | human | pending (owner) | 1 call |
| L30 | 05-H1 | Per-provider test, streaming, Stop, usage | human | pending (owner) | real keys, live origin |
| L31 | 05-H2 | Wrong key per provider | human | pending (owner) | — |
| L32 | 05-H3 | Gemini key types | human | pending (owner) | — |
| L33 | 05-H4 | Default-model extras accepted | human | pending (owner) | — |
| L34 | 05-H5 | OpenRouter privacy routing | human | pending (owner) | — |
| L35 | 05-H6 | Network hygiene in DevTools | human | pending (owner) | keyless half already proven by `third-party.smoke.ts` |
| L36 | 05-H7 | Launch-day CORS re-probe | human | passed 2026-10-31 (RentCast only); carried (Phase 14 AI-provider CORS re-probe: Anthropic, OpenAI, Gemini, OpenRouter, the owner's named target) | 13-21-SUMMARY.md (status/host/count only; RentCast accepted, no CORS error; the four AI providers declined by the owner, target Phase 14) |
| L37 | 05-H8 | Model IDs and prices re-verified | owner-decision | pending (owner) | record date checked + any registry change |
| L38 | 05-H9 | Legal review of the Fair Housing lexicon | owner-decision | pending (owner) | counsel or accepted risk |
| L39 | 05-H10 | Remembered key shows Test connection after reload | human | pending (owner) | — |
| L40 | 06-R1 | Real search (1 call) | human | pending (owner) | — |
| L41 | 06-R2 | Filters, sort, reload, shared URL (0 calls) | human | pending (owner) | — |
| L42 | 06-R3 | Real OSM tiles | human | pending (owner) | — |
| L43 | 06-R4 | Split view and pins | human | pending (owner) | layout covered by E2E; live glance |
| L44 | 06-R5 | Listing detail (0 calls) | human | pending (owner) | — |
| L45 | 06-R6 | Fair-rent check (2 calls) | human | pending (owner) | — |
| L46 | 06-R7 | Renter journey budget = 3 | human | pending (owner) | — |
| L47 | 06-R8 | Saved-search re-run over a day | human | pending (owner) | needs 24 h |
| L48 | 06-R9 | Outreach with a real AI key | human | pending (owner) | — |
| L49 | 06-R10 | Zillow/Google look-up links | human | pending (owner) | — |
| L50 | 06-R11 | Real phones, renter routes | human | pending (owner) | — |
| L51 | 06-R12 | Screen reader pass, renter | human | pending (owner) | — |
| L52 | 07-I1 | Manual analysis (0 calls) | human | pending (owner) | — |
| L53 | 07-I2 | Autofill rent estimate (1 call) | human | pending (owner) | — |
| L54 | 07-I3 | Autofill value estimate (1 call) | human | pending (owner) | — |
| L55 | 07-I4 | Save, reload, compare | human | pending (owner) | — |
| L56 | 07-I5 | Watch a real ZIP (1 call) | human | pending (owner) | — |
| L57 | 07-I6 | Buy box check (1 call) | human | pending (owner) | — |
| L58 | 07-I7 | Deep analyze (2 calls) | human | pending (owner) | — |
| L59 | 07-I8 | Investor journey budget = 6 | human | pending (owner) | — |
| L60 | 07-I9 | Memo with a real AI key | human | pending (owner) | — |
| L61 | 07-I10 | Print to PDF on real browsers | human | pending (owner) | — |
| L62 | 07-I11 | Real phones, investor routes | human | pending (owner) | — |
| L63 | 07-I12 | Screen reader pass, investor | human | pending (owner) | — |
| L64 | 07-I13 | Deployed CSP and hosts | smoke | passed 2026-10-31 | `csp.smoke.ts` + `third-party.smoke.ts` (keyless) in live-smoke https://github.com/wolfwdavid/tran_real_estate/actions/runs/41149881068 (f070c74); live connect-src = 'self' + the six provider/form hosts, no analytics host (13-14/13-15 curl checks); keyed provider hosts remain part of L30/L35 |
| L65 | 07-S1 | Unspecified save message wording | owner-decision | pending (owner) | approve or replace |
| L66 | 07-S2 | Notes-only numbers blocked at print | owner-decision | carried (Phase 14 DEBT-02) | Phase 14 DEBT-02 fixes the behaviour; close as "superseded by DEBT-02" |
| L67 | 08-UAT-1 | Real delivery via agent's Web3Forms key | human | pending (owner) | — |
| L68 | 08-UAT-2 | `tran_lead_v1` field visible | human | pending (owner) | with L67 |
| L69 | 08-UAT-3 | Paste-back from Gmail/Outlook/Apple Mail | human | pending (owner) | — |
| L70 | 08-UAT-4 | hCaptcha on shows the captcha-required state | human | pending (owner) | — |
| L71 | 08-UAT-5 | Spam and free-tier quota behaviour | cut | cut: needs abusive volume on a real key; "may stay unobserved" per the row | — |
| L72 | 08-UAT-6 | Follow-up draft in real email apps | human | pending (owner) | — |
| L73 | 08-UAT-7 | Counsel review (agent copy) | owner-decision | pending (owner) | — |
| L74 | 09-UAT-1 | Real-key snapshot printed in 3 browsers | human | pending (owner) | — |
| L75 | 09-UAT-2 | Social cards in IG/FB/LinkedIn composers | human | pending (owner) | — |
| L76 | 09-UAT-3 | NY/CA disclosures read-through | owner-decision | pending (owner) | counsel/owner |
| L77 | 09-UAT-4 | Equal Housing Opportunity logo | owner-decision | pending (owner) | — |
| L78 | 09-UAT-5 | Re-check NY GBL § 396-b and platform labels | owner-decision | pending (owner) | dated check |
| L79 | 09-UAT-6 | 6-page all-sections snapshot | owner-decision | carried (Phase 14 owner decisions) | ROADMAP Phase 14 "owner decisions riding along" |
| L80 | 09-UAT-7 | Studio license titles vs per-state titles | owner-decision | carried (Phase 14 owner decisions) | ROADMAP Phase 14 "owner decisions riding along" |
| L81 | 09-UAT-8 | Memo lists two block reasons | owner-decision | carried (Phase 14 owner decisions) | ROADMAP Phase 14 "duplicate memo block reason" |
| L82 | 10-1 | Umami counts arrive; GPC respected; IP not stored | cut | cut: GTM-04 moved to v2 by owner decision P13-4 (b) on 2026-10-30, taken before any Umami website, probe or analytics variable existed; no pageview data was ever collected | 13-14-SUMMARY.md (owner answers verbatim; no 10-/11- screenshot exists); live connect-src has no gateway.umami.is (0); REQUIREMENTS.md "### Analytics" future entry; `analytics.smoke.ts` stays in the suite for v2 |
| L83 | 10-2 | Web3Forms waitlist + feedback arrive | human | passed 2026-10-31 | `docs/launch-proof/2026-10-30/20-web3forms-inbox.png` (subjects "Tran waitlist: Renter" and "Tran feedback: Free calculators"; crop of the result rows, no addresses); deployed on f169749 (ci 41200919587, live-smoke 41202355014); 13-15-SUMMARY.md Task 3 ("forms + walk pass") |
| L84 | 10-3 | Contact email mailto fallbacks (optional) | owner-decision | pending (owner, target next owner session) | `PUBLIC_CONTACT_EMAIL` stayed unset through every Phase 13 deploy (variable lists in 13-13..13-18); unset state already E2E-verified; set it and verify, or record "unset" |
| L85 | 10-4 | Share cards in a link-preview debugger | human | passed 2026-10-31 | `docs/launch-proof/2026-10-30/30-linkedin-card.png` (LinkedIn Post Inspector, /tools/cap-rate/, redirect trail 206 Success, image + title) + `31-og-validator-card.png` (D-18 substitution: OpenGraph.xyz instead of the login-walled Facebook Sharing Debugger; 0 errors, og:image 1200x630 PNG 117 KB); tags by `seo.smoke.ts`; 13-16-SUMMARY.md |
| L86 | 10-5 | Sitemap in Search Console; robots at the org root | human | pending (owner, target next owner session): sitemap submitted 2026-10-31 12:54Z, Search Console processing pending ("Couldn't fetch" placeholder, 0 discovered); property verified 2026-10-31 by the HTML-tag method; robots at the host root not applicable on a project site (Pitfall 6) | `docs/launch-proof/2026-10-30/40-search-console-verified.png` + 13-17-SUMMARY.md; Googlebot-UA curl of sitemap.xml 200 with 14 `<loc>`; `41-search-console-sitemap.png` and "sitemap read: 14 URLs" are added when Success shows |
| L87 | 10-6 | Live-origin checks (Step 7): deep route, redirect, 404 / provider keys / Safari | smoke + human | passed 2026-10-31 | routing half: `routing.smoke.ts` in live-smoke https://github.com/wolfwdavid/tran_real_estate/actions/runs/41149881068 + the owner's five fresh-profile checks "Fresh checks pass" (13-13-SUMMARY.md, D-15); keys half = L30/L36 (RentCast passed, AI providers carried to Phase 14); Safari half = L12 (still pending) |
| L88 | 10-7 | Dependabot + push protection on; probe rejected | human | passed 2026-10-31 | 13-21-SUMMARY.md (status only: probe rejected by push protection; PAT revoked; branch never on the remote; `secret_scanning_push_protection.status` and `secret_scanning.status` = enabled via the API); Dependabot on and triaged per D-07 (13-11-SUMMARY.md: #1 merged, #2-#8 closed) |
| L89 | 10-8 | Report-only pages over the 60 KB budget | owner-decision | carried (Phase 14 DEBT-09) | Phase 14 DEBT-09 makes it a hard gate; close as "superseded by DEBT-09" |
| L90 | 11-1 | Live zillow.com smoke (Chrome + Edge) | human | carried (Phase 17) | — |
| L91 | 11-2 | Zero-network real session | human | carried (Phase 17) | — |
| L92 | 11-3 | Dim the "Showcase" badge? | owner-decision | decided 2026-10-29: Showcase stays excluded by default (REQUIREMENTS EXT-F3) | `.planning/REQUIREMENTS.md` EXT-F3 ("owner kept them excluded 2026-10-29") |
| L93 | 11-4 | Read current Zillow ToU | human | carried (Phase 17) | blocks public release only |
| L94 | 11-5 | Privacy URL is live | smoke | passed 2026-10-31 | `extension-link.smoke.ts` in live-smoke https://github.com/wolfwdavid/tran_real_estate/actions/runs/41149881068 (the /legal/privacy/#browser-extension anchor served from the live origin); the popup-click half from a BASE_PATH build (Pitfall 10) was not separately recorded and rides with the Phase 17 listing work (L95) |
| L95 | 11-6 | Edge Add-ons listing | human | carried (Phase 17) | — |
| L96 | 11-7 | Enable Releases, publish `ext-v0.1.0` | human | carried (Phase 17) | — |
| L97 | 11-8 | Firefox Add-ons listing | cut | cut: Firefox Add-ons out of v1 (ROADMAP cut line 2) | — |
| L98 | 12-1 | Owner go-live gate | human | passed 2026-10-29 | https://github.com/wolfwdavid/tran_real_estate/actions/runs/40961373692 (personal account; first `ci` run green, deploy skipped) |
| L99 | 12-2 | LIVE-05 live half | human | pending (owner, target next owner session): property verified 2026-10-31 (HTML tag, "You are a verified owner"); sitemap submitted 2026-10-31 12:54Z, Search Console processing pending | P13 = L86; `docs/launch-proof/2026-10-30/40-search-console-verified.png` + 13-17-SUMMARY.md |
| P13-1 | Phase 13 | GTM-01 fresh-profile walk: pick a portal, take the tour, Try sample data | human | passed 2026-10-31 | `docs/launch-proof/2026-10-30/21-gtm01-sample-data.png` (home -> Renter tour -> Try sample data -> /renter/?loc=74201 "10 rentals in 74201" with Sample data badges); performed by the orchestrator in the owner's signed-in browser under the owner's verbatim approval, in a signed-in tab rather than a private window (the new build was demonstrably served); 13-15-SUMMARY.md Task 3 |
| P13-2 | Phase 13 | First-deploy facts (D-13): 404 status, workflow_run head_sha, HTTPS redirect, propagation seconds | smoke + human | passed 2026-10-30 | go-live ci https://github.com/wolfwdavid/tran_real_estate/actions/runs/41111039721 (deploy success) + live-smoke https://github.com/wolfwdavid/tran_real_estate/actions/runs/41149881068 (green on f070c74); propagation 0 s in every live-smoke run (41115004823, 41149881068, 41202355014); unknown path HTTP 404 (body = SPA shell, branded title client-rendered), head_sha = deploy SHA each run, http -> https 301, /renter -> /renter/ 301; 13-13-SUMMARY.md D-13 table, `docs/launch-proof/2026-10-30/checks.json`, docs/RUNBOOK.md "First deploy facts" |
| P13-3 | Phase 13 | Shared-origin privacy copy decision (Pitfall 7) | owner-decision | decided 2026-10-30: decision C (C-approve), the privacy "Deleting your data" copy names the shared wolfwdavid.github.io storage origin and points to Forget all keys (second paragraph rendered only under a sub-path) | `.planning/phases/13-live-origin-first-ci-run-first-deploy-post-deploy-smoke-uat-burn-down/13-01-SUMMARY.md` (verbatim "A-approve, B-ignore, C-approve"); applied by plan 13-07 |
| P13-4 | Phase 13 | Umami "IP not stored" evidence (D-17) | owner-decision | decided 2026-10-30: owner answered "IPs not stored: proceed", then "Hold Umami for now", then chose "Cut Umami now (GTM-04 to v2)" (option b) | 13-14-SUMMARY.md (owner answers verbatim, in order; no 10-umami-ip-setting.png exists and none was created) |

## Tally (2026-10-31)

By class: smoke 5 (L01, L02, L06, L64, L94), smoke + human 1 (L87), human 73, owner-decision 15,
cut 5 (L23, L24, L71, L82, L97) = 99 origin rows, plus 4 Phase 13 rows.
By result: passed 13 (L01, L02, L03, L06, L26, L36 RentCast part, L64, L83, L85, L87, L88, L94, L98),
decided 1 (L92), cut 5, carried 10 (L66, L79-L81, L89, L90, L91, L93, L95, L96; L36's AI-provider
part is also carried to Phase 14), pending 70 origin rows (L86 and L99 wait on the Search Console
sitemap read; L84 waits on the contact-email decision). Phase 13 rows: passed 2 (P13-1, P13-2),
decided 2 (P13-3, P13-4).

Phase 13 evidence: the green live-smoke runs are 41149881068 (f070c74, the first green trio) and
41202355014 (f169749, the deployed commit audited by docs/LAUNCH-AUDIT.md); the proof bundle is
`docs/launch-proof/2026-10-30/` (README.md indexes every file and run).
