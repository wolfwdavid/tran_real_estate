---
phase: 13-live-origin-first-ci-run-first-deploy-post-deploy-smoke-uat-burn-down
plan: 17
subsystem: seo
tags: [live-05, live-06, search-console, google-site-verification, sitemap, launch-proof, owner-checkpoint, deployed-sha, d-14, d-16]
wave: 11
depends_on: ["13-16"]

# Dependency graph
requires:
  - phase: 13-live-origin-first-ci-run-first-deploy-post-deploy-smoke-uat-burn-down
    provides: 13-16 token commit 9c16e6e in the app.html slot and the unverified URL-prefix property; 13-15 push of that commit inside the forms redeploy (green pair ci 41200919587 + live-smoke 41202355014 on f169749); the "Carried for 13-17" live counts
  - phase: 12-go-live-readiness-local-smoke-suite
    provides: sitemap.xml (14 URLs) and robots.txt Sitemap line emitted by the root build; the pinned search-console slot
provides:
  - "DEPLOYED_SHA = f16974962e3b6ace66655342387cd270f3d120b6 (= live /_app/version.json), the commit plan 13-18 audits; ci 41200919587 success incl. deploy, live-smoke 41202355014 success, both on that SHA"
  - "Search Console URL-prefix property https://wolfwdavid.github.io/tran_real_estate/ verified by the HTML-tag method ('Ownership auto verified', about 12:52Z 2026-10-31); Settings reads 'You are a verified owner'"
  - "docs/launch-proof/2026-10-30/40-search-console-verified.png committed in 9a3801f (crop, no account details)"
  - "sitemap.xml submitted in Search Console at about 12:54Z 2026-10-31 ('Sitemap submitted successfully'); status pending: Google's 'Couldn't fetch' placeholder with 0 discovered pages; Success with 14 URLs not yet observed"
  - "OPEN ITEM carried to 13-19: 41-search-console-sitemap.png and the 'sitemap read: 14 URLs' record are added when Search Console shows Success; the phase is not closed until then"
affects: [13-18 LAUNCH-AUDIT at DEPLOYED_SHA f169749, 13-19 ledger (LIVE-05 and LIVE-06 ticks, the pending sitemap row, the next owner push carrying 32caa72 / bf26745 / 9a3801f / this metadata commit)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A Search Console sitemap row that reads 'Couldn't fetch' with 0 discovered pages minutes after submission is the pre-processing placeholder, not a fetch failure, when a Googlebot-UA curl of the sitemap returns 200 application/xml and robots.txt carries the Sitemap line; it is recorded as pending and re-checked, never re-submitted repeatedly"
    - "Live checks for the verification tag count the tag pattern (grep -o '<meta name=\"google-site-verification\"' | wc -l), not the bare phrase, because the Phase 12 marker comment ships in every page"

key-files:
  created:
    - docs/launch-proof/2026-10-30/40-search-console-verified.png
    - .planning/phases/13-live-origin-first-ci-run-first-deploy-post-deploy-smoke-uat-burn-down/13-17-SUMMARY.md
  modified: []

key-decisions:
  - "13-17: DEPLOYED_SHA is f16974962e3b6ace66655342387cd270f3d120b6; no code commit is made after it in this plan (only the proof PNG and this metadata), so plan 13-18 audits exactly the live build"
  - "13-17: the Task 2 checkpoint closes at 'sitemap submitted, pending 2026-10-31 12:54Z' per the plan's own fallback; 41-search-console-sitemap.png is not created until Search Console shows Success with 14 discovered URLs, and the phase stays open on that item (13-19 carries it)"
  - "13-17: the Task 3 commit carries only the verified-owner screenshot and is titled 'docs(launch-proof): Search Console verified' (the plan's title named both screenshots; only one exists)"
  - "13-17: LIVE-05 and LIVE-06 are not ticked here (no requirements mark-complete); 13-19 ticks them once the sitemap Success row is on file"

patterns-established:
  - "Owner-browser checkpoints run by the orchestrator under a verbatim standing approval are recorded with who actually performed each step, the time, and the facts handed over in a scratch file"

requirements-completed: [LIVE-06, LIVE-05]

# Metrics
duration: about 8 min of executor work (both owner checkpoints were resolved by the orchestrator between about 12:50Z and 12:55Z before the executor was spawned)
completed: 2026-10-31
---

# Phase 13 Plan 17: Search Console verification and sitemap submission Summary

**The Search Console tag deployed with the 13-15 push (DEPLOYED_SHA `f16974962e3b6ace66655342387cd270f3d120b6`, ci 41200919587 success through deploy, live-smoke 41202355014 success, live `version.json` equal); the URL-prefix property `https://wolfwdavid.github.io/tran_real_estate/` was verified by the HTML-tag method at about 12:52Z on 2026-10-31 ("Ownership auto verified"; Settings reads "You are a verified owner"), proven by `40-search-console-verified.png` in commit `9a3801f`; `sitemap.xml` (14 URLs, all under the base) was submitted at about 12:54Z and is pending in Search Console (the "Couldn't fetch" / 0 discovered placeholder before first processing), so the "Success with 14 URLs" half of LIVE-05 remains an open item that 13-19 carries.**

## Performance

- **Duration:** about 8 min of executor work (re-checks, PII review, one commit, this SUMMARY, state updates). The owner checkpoints (Tasks 1 and 2) were resolved by the orchestrator between about 12:50Z and 12:55Z, before this executor started.
- **Started:** 2026-10-31T12:58:46Z (executor pre-flight)
- **Completed:** 2026-10-31T13:03Z (metadata commit)
- **Tasks:** 3 of 3 reached (two owner checkpoints satisfied under the verbatim approval below, with Task 2 closed in its documented "pending" state; one autonomous task)
- **Files modified:** 0 source files; 1 proof PNG added; this SUMMARY

Every tool call stayed under 7 minutes. No `git push`, no `gh variable set|delete`, no repository or Pages setting change, no PR action, no rebase, squash, or amend (D-14). `gh` and `curl` were used read-only.

## Owner approval and who performed the steps (verbatim)

The owner's standing approval, given in chat and recorded verbatim: **"signed in check please and auto aproove everything please"**.

Under it, **the orchestrator, not the owner by hand**, performed both owner checkpoints in the owner's signed-in Chrome: Task 1's push had already happened inside plan 13-15 under the same approval (the token commit `9c16e6e` rode the forms redeploy push); Task 2's Verify press and the sitemap submission were performed by the orchestrator at about 12:52Z and 12:54Z on 2026-10-31. The facts were handed to this executor in a scratch file and are copied below. No login was performed; no e-mail address, account name, token (other than the public `google-site-verification` content, which ships in every page head), or secret was requested, seen, or recorded.

## Task 1: the token push and the green trio (observed read-only)

### What happened (from 13-15)

No separate push was needed for this plan. The token commit `9c16e6e` was among the nine held commits that plan 13-15 pushed at 12:05Z (with the empty redeploy commit `5ebdf79`); that first ci run **41199555797** went red on the root leg at `pnpm audit:deps` (new advisory GHSA-g3hv-75wg-m249, minimatch <11.0.1) and was later marked `cancelled` by the next push's concurrency group. The fix push at 12:23:53Z carried `f169749` (`chore(deps): record the minimatch advisory exception`), and that SHA produced the green pair. Details and the failing log tail are in 13-15-SUMMARY.md (Task 2).

**DEPLOYED_SHA = `f16974962e3b6ace66655342387cd270f3d120b6`** (= `origin/main` = live `/_app/version.json`).

- ci run 41200919587: https://github.com/wolfwdavid/tran_real_estate/actions/runs/41200919587
- live-smoke run 41202355014: https://github.com/wolfwdavid/tran_real_estate/actions/runs/41202355014
- the red, cancelled ci run on 5ebdf79: https://github.com/wolfwdavid/tran_real_estate/actions/runs/41199555797

### Executor-side re-checks (2026-10-31T12:58Z-12:59Z, all read-only)

| # | Command | Output |
| --- | --- | --- |
| 1 | `node scripts/commit-hygiene.mjs --history` | `commit-hygiene: 1322 commits scanned, 0 with assistant attribution`; exit **0** |
| 2 | `git log --format='%h %(trailers:key=Co-Authored-By,valueonly)' origin/main..HEAD` | `bf26745 ` and `32caa72 ` (no trailer values) |
| 3 | `git status -sb` / `git log --oneline origin/main..HEAD` | `## main...origin/main [ahead 2]`, one untracked file (`40-search-console-verified.png`, the Task 3 input); `bf26745 docs(13-15): complete GTM proofs 2 plan`, `32caa72 docs(launch-proof): form deliveries and portal walk` |
| 4 | `curl -s https://wolfwdavid.github.io/tran_real_estate/ \| grep -o '<meta name="google-site-verification"' \| wc -l` | **1** |
| 5 | `curl -s https://wolfwdavid.github.io/tran_real_estate/ \| grep -c 'name="google-site-verification"'` (the plan's literal pattern) | **1** (see the expectation correction below: the bare phrase `google-site-verification` counts 2) |
| 6 | `curl -s .../ \| grep -n 'google-site-verification'` | line 33 the Phase 12 marker comment (`<!-- search-console: the google-site-verification meta goes on the next line ... -->`), line 34 the tag; exactly one `<meta ...>` |
| 7 | `curl -s https://wolfwdavid.github.io/tran_real_estate/sitemap.xml \| grep -c "<loc>"` | **14** |
| 8 | `... \| grep -o '<loc>[^<]*</loc>' \| grep -vc '<loc>https://wolfwdavid.github.io/tran_real_estate/'` | **0** (every `<loc>` starts with the base URL: `/`, `/feedback/`, `/for-agents/`, `/for-investors/`, `/for-renters/`, `/legal/data-coverage/`, `/legal/fair-housing/`, `/legal/privacy/`, `/legal/terms/`, `/tools/`, `/tools/affordability/`, `/tools/cap-rate/`, `/tools/cash-on-cash/`, `/tools/dscr/`) |
| 9 | Googlebot-UA `curl -s -o /dev/null -w ... -A "Mozilla/5.0 (compatible; Googlebot/2.1; ...)" .../sitemap.xml` | `http=200 type=application/xml bytes=1272` |
| 10 | `curl -s https://wolfwdavid.github.io/tran_real_estate/robots.txt` | 200; `User-agent: *`, `Allow: /`, two Disallow lines (`/tran_real_estate/print/`, `/tran_real_estate/agent/inquire/`), `Sitemap: https://wolfwdavid.github.io/tran_real_estate/sitemap.xml` |
| 11 | `curl -s https://wolfwdavid.github.io/tran_real_estate/_app/version.json` | `{"version":"f16974962e3b6ace66655342387cd270f3d120b6"}` |
| 12 | `gh run view 41200919587 --repo wolfwdavid/tran_real_estate --json conclusion,headSha,url` | `conclusion: success`, `headSha: f16974962e3b6ace66655342387cd270f3d120b6`, event push, created 12:23:55Z, updated 12:43:15Z; jobs: secrets + real-data guard success, configured leg success (12:24:15Z-12:29:53Z), sub leg success (-12:42:46Z), root leg success (-12:43:00Z), **deploy success** (12:43:03Z-12:43:14Z) |
| 13 | `gh run view 41202355014 --repo wolfwdavid/tran_real_estate --json conclusion,headSha,url` | `conclusion: success`, `headSha: f1697496...`, event workflow_run, created 12:43:17Z, updated 12:44:48Z; job "read-only smoke of the deployed site" success (12:43:19Z-12:44:48Z) |
| 14 | `gh run view 41199555797 ... --json conclusion,headSha` | `cancelled`, headSha `5ebdf79d...` (the red run, as recorded in 13-15) |
| 15 | `gh run list --branch main --limit 6` | newest: live-smoke 41202355014 success f169749; live-smoke 41200947140 skipped f169749 (triggered by the cancelled run); ci 41200919587 success f169749; ci 41199555797 cancelled 5ebdf79; then the 13-13 pair on f070c74. **No newer run exists**, so f169749 is still the live SHA. |

Acceptance criteria: ci (deploy success) and live-smoke (success) on the pushed SHA with URLs recorded (yes); the live index.html contains the verification meta exactly once (yes, one tag; see the grep note); the sitemap curl prints 14 (yes); DEPLOYED_SHA recorded and equal to the live version.json (yes).

## Task 2: property verified; sitemap submitted and pending

Performed by the orchestrator in the owner's signed-in Chrome (approval quoted above), 2026-10-31.

### Verification (about 12:52Z)

- Opened the ownership page for the URL-prefix property `https://wolfwdavid.github.io/tran_real_estate/`; the page reported no access and offered **"VERIFY YOUR OWNERSHIP"**; it was clicked.
- Dialog: **"Ownership auto verified"**, method **HTML tag** (the meta deployed at f169749).
- Settings page: Ownership verification = **"You are a verified owner"**.
- The HTML-tag meta stays in `apps/web/src/app.html` permanently (Google re-checks it).

Proof: `docs/launch-proof/2026-10-30/40-search-console-verified.png` (93,933 B, 1568x409 RGBA): a crop of the inspect bar showing the property URL plus the "Ownership verification / You are a verified owner" row; no e-mail address, avatar, or account name (details under Task 3).

### Sitemap (about 12:54Z)

- Sitemaps page: entered `sitemap.xml` under the property prefix, i.e. `https://wolfwdavid.github.io/tran_real_estate/sitemap.xml`; Submit -> **"Sitemap submitted successfully"**.
- Submitted-sitemaps row at the time of recording: `/sitemap.xml`, Type **Unknown**, Submitted **Oct 31 2026**, Last read **empty**, Status **"Couldn't fetch"**, Discovered pages **0**.
- Reading: this is Google's placeholder row before first processing, not a fetch failure. The sitemap is reachable to a Googlebot user agent (200, `application/xml`, 1272 bytes, 14 `<loc>` all under the base) and robots.txt (200) carries the `Sitemap:` line (Task 1 rows 7-10). Per the plan's instruction it was not re-submitted.

**Owner result for this checkpoint: "sitemap submitted, pending 2026-10-31 12:54Z".** Per the plan's `<how-to-verify>` this keeps the Success / 14-URLs half of the checkpoint open: `41-search-console-sitemap.png` does **not** exist and was not fabricated; "sitemap read: 14 URLs" is **not** claimed here.

Acceptance criteria: "search console pass: 14 URLs" (no; the plan's "pending" branch applies); `40-search-console-verified.png` exists in the LAUNCH_DATE folder (yes); `41-search-console-sitemap.png` exists (no; open item below).

## Task 3: the verified-owner screenshot committed

### D-20 check before the commit

The PNG was opened and read. Visible: the "Inspect any URL in "https://wolfwdavid.github.io/tran_real_estate/"" search bar, generic Search Console header icons (help, a generic person-with-gear settings glyph, a notification bell with a count, the apps grid), the left edge of a partially cropped promotional card ("...how visitors find ... TikTok, X and ... on Google Search" with X and YouTube icons), and the row "Ownership verification | You are a verified owner". No e-mail address, no avatar photo, no account or display name, no property list.

| Command | Output |
| --- | --- |
| `grep -caE '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}' docs/launch-proof/2026-10-30/40-search-console-verified.png` | **0** |
| `strings -n 8 ...png \| head` | compressed-stream noise only; no tEXt/iTXt metadata strings |
| `du -sk docs/launch-proof/2026-10-30` | **1608** (< 5120) |

### Commit

| Command | Output |
| --- | --- |
| `git add docs/launch-proof/2026-10-30/40-search-console-verified.png && git commit -m "docs(launch-proof): Search Console verified"` | pre-commit: gitleaks `no leaks found`, `Real-data guard passed (1 staged files checked)`; `[main 9a3801f] docs(launch-proof): Search Console verified`, `1 file changed`, `create mode 100644 ... 40-search-console-verified.png` (`Bin 0 -> 93933 bytes`) |
| `git log -1 --format=%B \| grep -ciE "co-authored-by\|claude\|anthropic"` | **0** (the body is the bare subject line) |
| `git status -sb` | `## main...origin/main [ahead 3]`, tree clean |

The commit title differs from the plan's `docs(launch-proof): Search Console verified and sitemap read` because only the verified-owner screenshot exists; the sitemap screenshot gets its own commit when Success shows.

No commit in this plan changes code: after `f169749` the local commits are `32caa72` (13-15 proofs), `bf26745` (13-15 metadata), `9a3801f` (this proof) and this plan's metadata commit, all under `docs/` and `.planning/`. Plan 13-18 therefore audits DEPLOYED_SHA `f169749` as the exact live build.

## Open item (carried to 13-19; the phase is not closed until it is done)

- **`41-search-console-sitemap.png` + "sitemap read: 14 URLs"** are to be added when Search Console's Submitted sitemaps row for `https://wolfwdavid.github.io/tran_real_estate/sitemap.xml` shows Status **Success** with **14** discovered pages. Until then LIVE-05's live half is "submitted, pending (2026-10-31 12:54Z)". Steps when it shows: open the Sitemaps page in the owner's signed-in browser (same standing approval, or the owner by hand), screenshot the row (no account details) as `docs/launch-proof/2026-10-30/41-search-console-sitemap.png`, commit it alone with a bare subject (for example `docs(launch-proof): Search Console sitemap read`), and record "sitemap read: 14 URLs" with the time in 13-19's ledger (and append it to this SUMMARY's record). Do not re-submit the sitemap repeatedly; Google's first read can take from minutes to a day.
- LIVE-05 and LIVE-06 checkboxes are left untouched here; 13-19 ticks them with the ledger once the row above is on file.

## Task Commits

1. **Task 1: token push + trio** - no commit in this plan (the push and the green pair belong to 13-15: `9c16e6e` token, `5ebdf79` redeploy, `f169749` fix = DEPLOYED_SHA)
2. **Task 2: verify + sitemap submit** - no commit (owner-account actions performed by the orchestrator; the screenshot is consumed by Task 3)
3. **Task 3: proof screenshot** - `9a3801f` (docs) `docs(launch-proof): Search Console verified` (local, carried by the next owner push)

**Plan metadata:** `docs(13-17): record token deploy and Search Console verification` (this SUMMARY, STATE.md, ROADMAP.md; local, not pushed per D-14).

## Files Created/Modified

- `docs/launch-proof/2026-10-30/40-search-console-verified.png` - Search Console Settings crop: property URL + "You are a verified owner" (93,933 B)
- `.planning/phases/13-live-origin-first-ci-run-first-deploy-post-deploy-smoke-uat-burn-down/13-17-SUMMARY.md` - this record

No application or tooling file changed.

## Decisions Made

- DEPLOYED_SHA = `f16974962e3b6ace66655342387cd270f3d120b6`, fixed by 13-15's green pair; nothing after it changes code, so 13-18 audits the exact live build.
- Task 2 is closed in the plan's documented "pending" state with the submit time; the sitemap screenshot and the 14-URL record are an explicit open item for 13-19 rather than an assumption.
- The Task 3 commit carries one screenshot and is titled for what it contains.
- No `requirements mark-complete` was run; LIVE-05 and LIVE-06 stay for 13-19.

## Deviations from Plan

### Owner-approved substitutions (no code change)

**1. Both owner checkpoints were performed by the orchestrator, not the owner by hand**, in the owner's signed-in Chrome under the verbatim standing approval `signed in check please and auto aproove everything please` (as in 13-15 and 13-16). The executor did not run any owner command; it observed read-only.

**2. Task 1's push happened inside plan 13-15.** The plan assumed a dedicated push for the token commit; 13-16 had already batched `9c16e6e` into 13-15's forms redeploy (deploy economy), so this plan's Task 1 is an observation of that push's SHA and runs. The first ci run on that push went red on a new audit advisory and the fix push's SHA `f169749` is the proof SHA (13-15 Task 2).

### Plan expectations corrected by observation (no code change)

**3. Grep count for the verification tag.** The plan's live check is `grep -c 'name="google-site-verification"'` and it prints **1** on the live root (the marker comment does not contain `name="`). 13-16's expectation correction stands for the bare phrase: `grep -c 'google-site-verification'` prints **2** on the live root (line 33 marker comment, line 34 tag), so any future live check should count the tag pattern (`grep -o '<meta name="google-site-verification"' | wc -l` -> 1), which is the form 13-15 carried and this plan used.

**4. Sitemap Success not yet observed.** The plan's acceptance for Task 2 needs "search console pass: 14 URLs" and both PNGs; the plan's own fallback ("sitemap submitted, pending <time>") applies, with the submit time 2026-10-31 12:54Z. `41-search-console-sitemap.png` is not created, and the Task 3 commit and its title cover only the verified-owner screenshot.

---

**Total deviations:** 0 auto-fixed, 2 owner-approved substitutions, 2 expectation corrections.
**Impact on plan:** The verification tag is live, the property is verified, and the sitemap is submitted; LIVE-05's live half is one Search Console read away from complete, tracked as an explicit open item for 13-19. DEPLOYED_SHA is fixed for 13-18.

## Issues Encountered

None in the executor's work. Search Console's first-minutes "Couldn't fetch" placeholder was checked against a Googlebot-UA fetch (200, 14 URLs) and robots.txt (Sitemap line present) rather than treated as a failure.

## Known Stubs

None. No application code changed in this plan.

## Next Phase Readiness

- **13-18** can regenerate `docs/LAUNCH-AUDIT.md` at DEPLOYED_SHA `f169749` now (five audit exceptions, including GHSA-g3hv-75wg-m249). The proof folder holds 10 PNGs + checks.json, 1608 KB.
- **13-19** ledger: Search Console verified at about 12:52Z (HTML tag) with `40-search-console-verified.png`; sitemap submitted 12:54Z, pending; the open item above (41 PNG + "sitemap read: 14 URLs") gates the phase close and the LIVE-05 / LIVE-06 ticks. The next owner-approved push carries `32caa72`, `bf26745`, `9a3801f` and the two metadata commits (13-15's and this one).
- Local main after this plan's metadata commit: `[ahead 4]` of origin; nothing pushed (D-14).

## Self-Check: PASSED

- FOUND `docs/launch-proof/2026-10-30/40-search-console-verified.png` (93,933 B) on disk and in commit `9a3801f`
- FOUND this SUMMARY on disk
- FOUND commit `9a3801f` (`docs(launch-proof): Search Console verified`) on local main; attribution grep on its message prints 0; `du -sk docs/launch-proof/2026-10-30` -> 1608 (< 5120)
- Live checks: tag pattern count 1; sitemap `<loc>` count 14 with 0 outside the base; `version.json` = f169749 = `origin/main`; ci 41200919587 and live-smoke 41202355014 both `success` on f169749; no newer run on main
- `41-search-console-sitemap.png` is NOT present and is NOT claimed; recorded as the open item above
- `requirements-completed: [LIVE-06, LIVE-05]` copied verbatim from 13-17-PLAN.md; neither checkbox was ticked (13-19 does it)
- No personal e-mail address, token, or non-public key in this file

---
*Phase: 13-live-origin-first-ci-run-first-deploy-post-deploy-smoke-uat-burn-down*
*Completed: 2026-10-31*
