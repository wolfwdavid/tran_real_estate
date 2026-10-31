---
phase: 13-live-origin-first-ci-run-first-deploy-post-deploy-smoke-uat-burn-down
plan: 16
subsystem: seo
tags: [gtm-03, share-cards, open-graph, linkedin-post-inspector, search-console, google-site-verification, app-html, launch-proof, owner-checkpoint, d-14, d-16, d-18]

# Dependency graph
requires:
  - phase: 13-live-origin-first-ci-run-first-deploy-post-deploy-smoke-uat-burn-down
    provides: 13-13 go-live (site public at https://wolfwdavid.github.io/tran_real_estate/, green ci + deploy + live-smoke pair on f070c74); docs/launch-proof/2026-10-30/ bundle
  - phase: 12-go-live-readiness-local-smoke-suite
    provides: the pinned search-console slot in apps/web/src/app.html and scripts/app-html.test.ts (12-05); seo.smoke.ts share-tag checks; assert-csp.mjs and assert-seo.mjs oracles
provides:
  - "GTM-03 proven from the live origin: LinkedIn Post Inspector rendered image + title for /tools/cap-rate/ (redirect trail 206 Success); Facebook Sharing Debugger required a login, so the D-18 substitution applied: OpenGraph.xyz (login-free) reported 0 errors, image 1200x630 PNG 117 KB, title and site name present"
  - "docs/launch-proof/2026-10-30/30-linkedin-card.png and 31-og-validator-card.png committed in c963f61 (bundle 1072 KB)"
  - "Search Console URL-prefix property https://wolfwdavid.github.io/tran_real_estate/ exists (unverified) in the owner's account; HTML-tag method"
  - "apps/web/src/app.html carries the google-site-verification meta in the pinned slot (commit 9c16e6e, local, unpushed); the root build emits it on all 45 pages after the CSP meta"
affects: [13-17 push and Search Console Verify (LIVE-05 live half), 13-19 ledger row L85 (D-18 substitution) and runbook, 13-18 LAUNCH-AUDIT, 13-15 forms redeploy (same push)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A blocked owner tool (login wall) is substituted by a login-free public validator with the tool URL recorded, never by skipping the proof (D-18)"
    - "Source commits that need a deploy are batched onto one owner-approved push when two plans need a redeploy at the same time (D-16 deploy economy)"

key-files:
  created:
    - .planning/phases/13-live-origin-first-ci-run-first-deploy-post-deploy-smoke-uat-burn-down/13-16-SUMMARY.md
  modified:
    - apps/web/src/app.html

key-decisions:
  - "13-16: Facebook Sharing Debugger was behind a login wall; the D-18 substitution is OpenGraph.xyz (https://www.opengraph.xyz/url/https%3A%2F%2Fwolfwdavid.github.io%2Ftran_real_estate%2Ftools%2Fcap-rate%2F), recorded for ledger row L85 in plan 13-19"
  - "13-16: the Search Console token lives in the app.html slot as a meta tag (D-16); the HTML-file and DNS TXT methods Google offered are not used"
  - "13-16: the plan's literal `grep -c google-site-verification apps/web/build/index.html` prints 2 because the Phase 12 marker comment contains the phrase; the criterion (one tag in the built page) holds: exactly one `<meta name=\"google-site-verification\" ...>` and one token; the marker text was not changed"
  - "13-16: executed before plan 13-15 closed so the token commit and the forms redeploy ride one owner-approved push (one deploy instead of two)"

patterns-established:
  - "Owner-browser checkpoints: the orchestrator drives the owner's signed-in browser only under a verbatim approval, read-only, and the facts (tool URL, result lines, screenshot names) are written to a scratch file the executor copies into the SUMMARY"

requirements-completed: [LIVE-06, LIVE-05]

# Metrics
duration: 8 min (executor side, Task 3 and SUMMARY; Tasks 1 and 2 were completed by the orchestrator between about 03:58Z and 04:05Z)
completed: 2026-10-31
---

# Phase 13 Plan 16: Share cards and Search Console token Summary

**The cap-rate share card renders image and title in the LinkedIn Post Inspector from the live origin (redirect trail 206 Success) and in the login-free OpenGraph.xyz validator (0 errors, 1200x630 PNG, 117 KB; D-18 substitution for the login-walled Facebook Sharing Debugger), both screenshots committed in `c963f61`; the owner's Search Console URL-prefix property exists unverified and its HTML-tag token now sits on the line after the `search-console` marker in `apps/web/src/app.html` (commit `9c16e6e`), proven by the slot test, a `BASE_PATH=/tran_real_estate` root build that emits the tag once on all 45 pages after the CSP meta, and both oracles.**

## Performance

- **Duration:** 8 min of executor work. Tasks 1 and 2 were completed by the orchestrator in the owner's browser between about 03:58Z and 04:05Z under the approvals quoted below.
- **Started:** 2026-10-31T06:09:24Z (executor pre-flight)
- **Completed:** 2026-10-31T06:17Z
- **Tasks:** 3 (two owner checkpoints satisfied under verbatim approvals; one autonomous task)
- **Files modified:** 1 source file (`apps/web/src/app.html`, one line) + this SUMMARY

Every tool call stayed under 7 minutes (the root build took about 25 s of bundler time, 1-2 min wall). No `git push`, no `gh variable`, no settings change (D-14). `curl` was used read-only.

## Owner approvals/results (verbatim)

- **Task 1 (share cards, GTM-03).** Owner approval, in chat: **"run the card check in my browser"** and later **"browser ready"** / **"go"**. Under that approval the orchestrator drove the owner's signed-in browser, read-only, through the LinkedIn Post Inspector and then the Facebook Sharing Debugger; the latter answered "Log into Facebook to use this tool.", no login was performed, and the D-18 substitution (a login-free public validator) applied.
- **Task 2 (Search Console property).** The orchestrator offered: "Say 'create the Search Console property in my browser' and I will add the URL-prefix property for the live site in your signed-in Google account, pick the HTML-tag method, copy the tag, and stop before Verify." Owner approval, in chat: **"do it for me please"**. The property was created, the HTML-tag method expanded, the tag copied, Verify NOT pressed, and the dialog closed with Done (property exists, unverified).

The only value handed over is the `google-site-verification` content token, which is public by design (it ships in every page's `<head>`). No other key, token, account detail or e-mail address was requested, seen, or recorded.

## Task 1: share cards from the live origin (GTM-03, D-18)

Inspected URL: `https://wolfwdavid.github.io/tran_real_estate/tools/cap-rate/`.

| Tool | Outcome |
| --- | --- |
| LinkedIn Post Inspector (https://www.linkedin.com/post-inspector/) | Preview rendered the cap-rate card image and the title "Cap rate calculator: Tran Real Estate Tools", domain wolfwdavid.github.io. URL information: last scraped a few seconds ago; Fetched URL = Canonical URL = the inspected URL; redirect trail 1 step, **"206 Success"**. Metadata: Title "Cap rate calculator: Tran Real Estate Tools"; Type Article; Image (LinkedIn media CDN copy); Description "Free cap rate calculator. Enter price, rent, vacancy, and expenses to see net operating income and cap rate. Runs in your browser."; Author none; Publish date none. Screenshot `docs/launch-proof/2026-10-30/30-linkedin-card.png` (1287x650, converted from the capture's JPEG; the inspector page shows no profile element, so no account details are visible). |
| Facebook Sharing Debugger (https://developers.facebook.com/tools/debug/) | "Log into Facebook to use this tool." No login performed. **D-18 substitution applied** (below). |
| **Substitute: OpenGraph.xyz** (login-free), tool URL `https://www.opengraph.xyz/url/https%3A%2F%2Fwolfwdavid.github.io%2Ftran_real_estate%2Ftools%2Fcap-rate%2F` | Cookie banner: "Deny". Meta-tag inspector: **0 errors**, 2 warnings, 11 passes. Passes: title present ("Cap rate calculator: Tran Real Estate Tools", 43 chars) and within 60; page title present; meta description present (130 chars); **image loads cleanly (117 KB image/png)**; **image dimensions are perfect (1200x630)**; X card uses a large image (`summary_large_image`); site name set ("Tran Real Estate Tools"); `twitter:title` / `twitter:description` / `twitter:image` absent but "not strictly necessary" (fall back to `og:*`). Warnings (cosmetic): "Image is missing conversion text"; "Description is too long" (130 chars vs about 125 shown on mobile). The Facebook-tab preview rendered the image and the title. Screenshot `docs/launch-proof/2026-10-30/31-og-validator-card.png` (1416x715; the validator shows "Login", i.e. not signed in; no account details). |

**D-18 substitution for the ledger (plan 13-19, row L85):** Facebook Sharing Debugger replaced by OpenGraph.xyz at the tool URL above; LinkedIn Post Inspector used as planned.

### Executor-side checks (2026-10-31T06:09Z)

| Command | Output |
| --- | --- |
| `curl -s https://wolfwdavid.github.io/tran_real_estate/tools/cap-rate/ \| grep -c "og:image"` | `1` (also `1` when the orchestrator ran it before the card check) |
| `git show --stat c963f61` | `docs(launch-proof): share-card checks from the live origin`; `30-linkedin-card.png` 0 -> 164,629 bytes; `31-og-validator-card.png` 0 -> 413,434 bytes; 2 files changed |
| `ls docs/launch-proof/2026-10-30/` | `01-landing.png 02-renter.png 03-deep-route-refresh.png 04-not-found.png 05-version-json.png 30-linkedin-card.png 31-og-validator-card.png checks.json` |
| `du -sk docs/launch-proof/2026-10-30/` | `1072` (< 5120) |

Acceptance criteria: owner result "cards pass with substitute" (yes, with the tool URL recorded); `30-linkedin-card.png` and `31-og-validator-card.png` exist in the LAUNCH_DATE folder with no account details (yes); the verify curl prints at least 1 (yes, `1`).

## Task 2: Search Console property and HTML tag

- Property type **URL prefix**, `https://wolfwdavid.github.io/tran_real_estate/` (a Domain property is impossible on github.io), created in the owner's signed-in Google Search Console under the approval above.
- Verification method **HTML tag**; **Verify NOT pressed** (the tag is not deployed yet; plan 13-17 pushes and verifies). Google also offered an HTML-file method and a DNS TXT record; neither is used (D-16: meta tag in the pinned slot).
- Tag handed over: `<meta name="google-site-verification" content="Na8xN8OqMsgNO0mFdfe0C9mRnmBc7PuUpsPlyHdft_I" />`; token length 43, matches `[A-Za-z0-9_-]{20,}`; already in the plan's normalised form (two-tab indent added on insertion).
- `<verify>`: `grep -n "search-console" apps/web/src/app.html` -> line 6, the Phase 12 marker `<!-- search-console: the google-site-verification meta goes on the next line (docs/DEPLOY-CHECKLIST.md Step 8) -->` (before the edit; after the edit the tag is line 7).

Acceptance criteria: one tag with a 20+ char `[A-Za-z0-9_-]` token (yes, 43); URL-prefix property for the live site (yes).

## Task 3: token in the pinned slot, proven locally, committed

Edit: one line inserted after the marker with the Edit tool (real tabs; `git diff | cat -A` shows `+^I^I<meta name="google-site-verification" content="..." />$`), `1 file changed, 1 insertion(+)`.

| # | Command | Exit | Output |
| --- | --- | --- | --- |
| 1 | `grep -cP '^\t\t<meta name="google-site-verification" content="[A-Za-z0-9_-]{20,}" />$' apps/web/src/app.html` | 0 | `1` |
| 2 | `grep -A1 "search-console:" apps/web/src/app.html` | 0 | the marker line, then `\t\t<meta name="google-site-verification" content="Na8xN8OqMsgNO0mFdfe0C9mRnmBc7PuUpsPlyHdft_I" />` |
| 3 | `pnpm vitest run --project scripts scripts/app-html.test.ts` | 0 | `Test Files 1 passed (1)`, `Tests 11 passed (11)`, 691 ms |
| 4 | `MSYS_NO_PATHCONV=1 PUBLIC_SITE_URL=https://wolfwdavid.github.io BASE_PATH=/tran_real_estate pnpm build:root` | 0 | `build-web: pnpm 11.27.0 target=root BASE_PATH=/tran_real_estate BUILD_DIR=build BUILD_SHA=c963f618d8c0060e4ddc09f541137c87e618c570`; adapter `done`; bundler 24.5 s (writeBundle 17.1 s, svelte compile 3.2 s / 961 calls, tailwind 2.0 s / 71 calls) |
| 5 | same env, `node scripts/assert-csp.mjs apps/web/build --target root` | 0 | `CSP assertion passed for 45 pages in apps/web/build (analytics host: none)` |
| 6 | same env, `node scripts/assert-seo.mjs apps/web/build --target root` | 0 | `SEO assertion passed for 44 pages, 14 sitemap URLs, 6 share cards in apps/web/build` |
| 7 | `grep -c "google-site-verification" apps/web/build/index.html` | 0 | **`2`**: line 33 is the marker comment (its text contains the phrase), line 34 is the tag. `grep -o '<meta name="google-site-verification" content="[A-Za-z0-9_-]*" */>' ... \| wc -l` -> `1`; token occurrences -> `1`. The tag is present **once**; see Deviations item 3. |
| 8 | tag coverage and order | 0 | `grep -rl google-site-verification apps/web/build --include=*.html \| wc -l` -> `45` of 45 HTML files; in `index.html` the CSP meta is on line 5 and the verification meta on line 34 (after `%sveltekit.head%`, as the slot requires) |
| 9 | `pnpm lint` | 0 | `All matched files use Prettier code style!`; eslint silent |
| 10 | `git add apps/web/src/app.html && git commit -m "feat(seo): Search Console verification tag" ...` | 0 | gitleaks `0 commits scanned ... no leaks found`; `Real-data guard passed (1 staged files checked)`; `[main 9c16e6e] feat(seo): Search Console verification tag`, `1 file changed, 1 insertion(+)` |
| 11 | attribution grep from the plan's acceptance criteria (`git log -1 --format=%B \| grep -ciE <trailer and assistant-name pattern>`) | 1 (no match) | `0` |
| 12 | `git status -sb` | 0 | `## main...origin/main [ahead 7]`, tree clean |

Build lock: the repo has no lock file (the "build/Playwright lock" is the orchestrator's coordination rule for parallel-wave executors, 13-10 SUMMARY). This plan ran as the only executor, so the lock was held implicitly for the whole of Task 3; no `.tools/` lock artifact exists or was created.

Acceptance criteria: `grep -cP` prints 1 on the line after the marker (yes); app-html test, CSP oracle and SEO oracle exit 0 (yes); the built `index.html` contains the tag once (yes, one `<meta ...>` and one token; the literal phrase count is 2 because of the marker comment); attribution grep 0 (yes).

## Task Commits

1. **Task 1: share-card proof** - `c963f61` (`docs(launch-proof): share-card checks from the live origin`; committed by the orchestrator before this executor was spawned; two PNGs)
2. **Task 2: Search Console property** - no commit (owner-account action; the tag is consumed by Task 3)
3. **Task 3: verification tag** - `9c16e6e` (`feat(seo): Search Console verification tag`; `apps/web/src/app.html`, 1 line)

**Plan metadata:** `docs(13-16): complete share cards and Search Console token plan` (this SUMMARY; local). Both source commits are unpushed per D-14; plan 13-17 Task 1 carries them in the next owner-approved push, after which Search Console "Verify" can be pressed (LIVE-05 live half).

## Files Created/Modified

- `apps/web/src/app.html` - `<meta name="google-site-verification" content="..." />` on line 7, directly after the search-console marker, after `%sveltekit.head%` (so after the CSP meta) and before `frame-guard.js`
- `docs/launch-proof/2026-10-30/30-linkedin-card.png`, `31-og-validator-card.png` - share-card proofs (committed in `c963f61`)
- `.planning/phases/13-live-origin-first-ci-run-first-deploy-post-deploy-smoke-uat-burn-down/13-16-SUMMARY.md` - this record

STATE.md, ROADMAP.md and REQUIREMENTS.md are left to the orchestrator (session constraint: the executor does not run the state/roadmap advance commands).

## Decisions Made

- D-18 substitution: OpenGraph.xyz replaces the login-walled Facebook Sharing Debugger; the tool URL is recorded above for ledger row L85 (plan 13-19).
- The token goes into the app.html slot as a meta tag (D-16); the HTML-file and DNS methods are not used.
- The marker comment is left untouched even though it makes the plan's literal `grep -c` print 2: the slot test pins the marker text, and the criterion is the tag count, which is 1.
- Plan order: 13-16 before 13-15 closes, so one push carries both the token and the forms configuration (deploy economy).

## Deviations from Plan

### Owner-approved substitutions (no code change)

**1. The orchestrator drove the owner's signed-in browser for Tasks 1 and 2.** The plan has the owner run the debuggers and create the property; the owner instead approved the orchestrator doing it in the owner's browser ("run the card check in my browser", "do it for me please"; verbatim above). Read-only in the debuggers; one property created in Search Console; no login performed anywhere; Verify not pressed.

**2. [D-18] Facebook Sharing Debugger replaced by OpenGraph.xyz.** Facebook required a login. Allowed by the plan's own `<how-to-verify>` fallback; screenshot named `31-og-validator-card.png` as the plan specifies; tool URL recorded for the ledger.

### Plan expectation corrected by observation (no code change)

**3. `grep -c "google-site-verification" apps/web/build/index.html` prints 2, not 1.** The Phase 12 marker comment (`<!-- search-console: the google-site-verification meta goes on the next line ... -->`) is emitted into every built page and contains the phrase, so the literal line count is marker + tag. Verified the actual criterion: exactly one `<meta name="google-site-verification" ...>` tag and exactly one token in `index.html`, present on all 45 pages. Future greps should use the tag pattern (`grep -o '<meta name="google-site-verification"' ... | wc -l`), and plan 13-17's live checks should do the same.

### Scheduling

**4. Plan 13-16 ran before plan 13-15 closed.** 13-15 Tasks 2-3 are waiting on the owner's Web3Forms sign-in. Running 13-16's Task 3 now means the token commit (`9c16e6e`) and the forms configuration will ride the same owner-approved push, which plans 13-15 and 13-17 then observe (one ci + deploy + live-smoke pair instead of two). The GTM proof order change (D-16) was for deploy economy; `depends_on: ["13-15"]` is therefore satisfied at the push, not before this plan.

---

**Total deviations:** 0 auto-fixed, 2 owner-approved substitutions, 1 expectation correction, 1 scheduling change.
**Impact on plan:** GTM-03 is proven live with the D-18 substitution recorded. The token is committed in the slot and proven in a deploy-configuration build; LIVE-05's live half completes when 13-17 pushes and the owner presses Verify. No application behaviour changed beyond one `<meta>` in the head.

## Issues Encountered

None. Every command returned the expected result on the first attempt; the only surprise was the literal grep count (item 3), which investigation showed to be the marker comment.

## Known Stubs

None. The only source change is one static meta tag.

## Next Phase Readiness

- Local main is at `[ahead 7]` of origin (after the metadata commit, 8): 13-13 and 13-21 metadata, 13-14 cut docs, `c963f61`, `9c16e6e`, this SUMMARY. Nothing is pushed (D-14).
- **13-17 Task 1** (owner-approved push) deploys the token; then the owner presses Verify in Search Console on the URL-prefix property. Live check after deploy: `curl -s https://wolfwdavid.github.io/tran_real_estate/ | grep -o '<meta name="google-site-verification"' | wc -l` -> 1.
- **13-15** Tasks 2-3 (Web3Forms) can set their variables before that same push so one deploy covers both.
- **13-19** ledger: L85 = D-18 substitution (OpenGraph.xyz tool URL above); runbook "share cards" facts: LinkedIn redirect trail 206 Success, og:image 1200x630 PNG 117 KB, description 130 chars (validator warns above ~125).
- **13-18 LAUNCH-AUDIT**: `docs/launch-proof/2026-10-30/` now has 7 PNGs + checks.json, 1072 KB.

## Self-Check: PASSED

- FOUND `.planning/phases/13-live-origin-first-ci-run-first-deploy-post-deploy-smoke-uat-burn-down/13-16-SUMMARY.md`
- FOUND `apps/web/src/app.html` with exactly one `google-site-verification` meta on the line after the marker (`grep -cP` -> 1)
- FOUND commits `c963f61` (`docs(launch-proof): share-card checks from the live origin`) and `9c16e6e` (`feat(seo): Search Console verification tag`) on local main
- FOUND `docs/launch-proof/2026-10-30/30-linkedin-card.png` (164,629 B) and `31-og-validator-card.png` (413,434 B)
- Attribution grep on `9c16e6e` -> 0; `git status --short` empty before and after the commits
- `requirements-completed: [LIVE-06, LIVE-05]` copied verbatim from 13-16-PLAN.md
- No key, secret or e-mail address in this file; the only token is the public `google-site-verification` content

---
*Phase: 13-live-origin-first-ci-run-first-deploy-post-deploy-smoke-uat-burn-down*
*Completed: 2026-10-31*
