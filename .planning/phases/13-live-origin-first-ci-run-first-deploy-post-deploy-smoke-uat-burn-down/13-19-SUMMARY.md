---
phase: 13-live-origin-first-ci-run-first-deploy-post-deploy-smoke-uat-burn-down
plan: 19
subsystem: planning-docs
tags: [live-07, live-09, live-03, live-06, smoke-04, live-05-carried, human-uat-ledger, launch-proof, runbook, requirements, validation-map, close-out, d-13, d-18, d-19, d-20, d-21]
wave: 13
depends_on: ["13-18", "13-21"]

# Dependency graph
requires:
  - phase: 13-live-origin-first-ci-run-first-deploy-post-deploy-smoke-uat-burn-down
    provides: 13-13 go-live facts (GO_LIVE_SHA ad5fd08, D-13 curl table, first green trio on f070c74, proof shots 01-05 + checks.json); 13-15 forms deploy and GTM-01/02 proofs (20-, 21- PNGs, DEPLOYED_SHA f169749 pair ci 41200919587 + live-smoke 41202355014); 13-16 share cards with the D-18 substitution (30-, 31- PNGs); 13-17 Search Console verified (40- PNG) with the sitemap read pending; 13-18 docs/LAUNCH-AUDIT.md at f169749 (e9f82f2); 13-21 probe outcomes for L03/L88/L26/L36; 13-14 GTM-04 cut (P13-4 b); 13-01 decision C (P13-3)
  - phase: 13-live-origin-first-ci-run-first-deploy-post-deploy-smoke-uat-burn-down
    provides: 13-05 ledger and its oracle scripts/human-uat-ledger.test.ts; 13-08 runbook and its oracle scripts/runbook.test.ts
provides:
  - ".planning/HUMAN-UAT.md carries the Phase 13 results: 13 origin rows passed (smoke rows with live-smoke run links), L82 cut, L36 passed for RentCast and carried to Phase 14 for the AI providers, the four Phase 13 rows resolved (P13-1/P13-2 passed, P13-3/P13-4 decided), L86/L99 carried (sitemap read; owner, target 2026-11-04), L84 retargeted; tally recounted (passed 13, decided 1, cut 5, carried 12, pending 68); ledger test green"
  - "docs/launch-proof/2026-10-30/README.md indexes the bundle: deployed commits, every ci/deploy/live-smoke run per push including the 7372b61 close-out trio, D-13 facts, a Files table with capture provenance for every PNG and checks.json, the D-18 substitution, the redaction note and a carried Pending row for 41-search-console-sitemap.png with the follow-up"
  - "docs/RUNBOOK.md 'First deploy facts' holds the measured values (propagation 0 s, cache headers, raw 404 shell vs branded page, redirects, head_sha, precache install times, job durations); runbook test green"
  - "REQUIREMENTS.md: LIVE-03, LIVE-06, LIVE-07, LIVE-09, SMOKE-04 ticked and Complete; LIVE-05 left unticked with the carried parenthetical and its traceability row unchanged"
  - "PROJECT.md: GTM-01..03 Validated in Phase 13 (live origin, 2026-10-31), GTM-04 cut, Phase 13 Validated block and the Current State paragraph 'Phase 13 complete (2026-11-01) with one carried item: the Search Console sitemap read' with the follow-up"
  - "13-VALIDATION.md: 50 of 51 map rows green, 13-17-02 carried, status complete (carried legend entry added, reason written)"
affects: [the sitemap-read follow-up (LIVE-05, L86, L99, 41-search-console-sitemap.png, 13-17-02), the live-smoke CDN-429 hardening quick task, Phase 14 (AI-provider CORS re-probe, L36 carried part)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Ledger results are written from the plan SUMMARYs only; a result the owner has not yet observed stays `pending (...)` or, by recorded owner decision, `carried (<item>; owner, target <date>)`, never `passed`"
    - "Planning-doc edits of this size are applied with small asserted replacement scripts (exact old text, exactly one occurrence) kept outside the repo, so a stale or ambiguous anchor fails loudly instead of corrupting a table"
    - "Proof-bundle README rows name who captured each file and keep a Pending row, with its follow-up, for a proof that does not exist yet"
    - "A validation-map row whose evidence is owner-gated and external may be `carried` by recorded owner decision; it is not red and does not block `status: complete` (precedent: 05 and 10 validation files)"

key-files:
  created:
    - docs/launch-proof/2026-10-30/README.md
    - .planning/phases/13-live-origin-first-ci-run-first-deploy-post-deploy-smoke-uat-burn-down/13-19-SUMMARY.md
  modified:
    - .planning/HUMAN-UAT.md
    - docs/RUNBOOK.md
    - .planning/REQUIREMENTS.md
    - .planning/PROJECT.md
    - .planning/phases/13-live-origin-first-ci-run-first-deploy-post-deploy-smoke-uat-burn-down/13-VALIDATION.md

key-decisions:
  - "13-19: owner decision 2026-11-01, verbatim menu answer \"Close now, sitemap carried (Recommended)\": Phase 13 closes with LIVE-05 and ledger rows L86/L99 carried. The target is 2026-11-04 rather than the menu's 2026-11-02 because the Search Console read was still pending on 2026-11-01 (about 28 h after submission), so a one-day target would very likely lapse unmet"
  - "13-19: L86/L99 read `carried (sitemap read; owner, target 2026-11-04)`: the ledger test accepts any `carried` prefix, and the owner-plus-dated-target form matches how the ledger records owner-gated work; the robots-at-host-root note stays on L86"
  - "13-19: LIVE-05 stays `[ ]` with its traceability row unchanged (`Pending (local half done; live half in Phase 13)`); the plan's two LIVE-05 acceptance greps are deliberately unsatisfied until the read lands"
  - "13-19: 13-VALIDATION `status: complete` with 13-17-02 marked `carried` (new legend entry), following the 05/10 precedent that owner-gated live evidence tracked in the HUMAN-UAT ledger is deferred evidence, not a gap; no row is red"
  - "13-19: Task 3 acceptance met on 7372b61 by ci 41218226897 (deploy success) + dispatched live-smoke 41220812811 (121/121) + version.json; the red chained run 41220466187 (35 HTTP 429s from the Pages CDN) is kept in the record, not hidden"
  - "13-19: L82's class changed from `human` to `cut` to match the four pre-existing cut rows; the tally moves to human 73 / cut 5"
  - "13-19: the smoke rows cite live-smoke 41149881068 (f070c74, the first green trio) as the passing run; L03/L88/L26/L36 are closed exactly as 13-21 handed them over; L84 retargeted to `next owner session`"

patterns-established:
  - "Phase close-out writes the ledger first, then the proof index, then the runbook and requirement ticks, each verified by its text oracle before the next commit; an external item that misses the close is carried by owner decision with a dated target and a written follow-up"

requirements-completed: [LIVE-07, LIVE-09, LIVE-03, LIVE-06, SMOKE-04]

# Metrics
duration: about 15 min of executor work for Tasks 1-2 (2026-10-31T14:07Z to 14:21Z), the Task 3 push and trio (16:08Z to 16:42Z), Search Console re-checks to 2026-11-01T17:12Z, close-out edits 2026-11-01T17:10Z to 17:35Z
completed: 2026-11-01
---

# Phase 13 Plan 19: Phase close-out (ledger, proof index, runbook facts, requirement ticks) Summary

**Phase 13 closes on a green ci + deploy + live-smoke trio for the docs-only push `7372b61` (ci 41218226897, dispatched live-smoke 41220812811 121/121, `version.json` = `7372b61`). The 99 + 4 row owner ledger carries every Phase 13 result with evidence, `docs/launch-proof/2026-10-30/README.md` indexes every proof file and run, `docs/RUNBOOK.md` records the measured first-deploy facts, LIVE-03, LIVE-06, LIVE-07, LIVE-09 and SMOKE-04 are ticked and Complete, and the one external item that missed the close (the Search Console sitemap read, still "Couldn't fetch" about 28 h after submission although Googlebot fetches the sitemap 200 with 14 URLs) is carried by owner decision to 2026-11-04 as LIVE-05 and ledger rows L86/L99.**

## Performance

- **Duration:** about 15 min of executor work for Tasks 1 and 2 (2026-10-31, 14:07Z to 14:21Z); Task 3 push and trio 16:08Z to 16:42Z; Search Console re-checks through 2026-11-01 17:12Z; close-out edits 2026-11-01 17:10Z to 17:35Z.
- **Started:** 2026-10-31T14:07:10Z
- **Completed:** 2026-11-01
- **Tasks:** 3 of 3 (Task 3 was the owner's push checkpoint)
- **Files modified:** 5 planning/docs files + 1 created (the README); no source, test or workflow file

Every Bash call stayed under 7 minutes. No `git push` by any executor (the owner pushed `7372b61`), no `gh variable set|delete`, no repository, Pages or PR change, no rebase, reset or amend.

## Owner decision (2026-11-01)

Menu answer, verbatim: **"Close now, sitemap carried (Recommended)"**. The option text the owner chose: "Finalize 13-19 with LIVE-05 and ledger rows L86/L99 marked carried (target 2026-11-02), run the regression gate and verifier, and mark Phase 13 complete. The sitemap proof lands later as a small docs follow-up. You push the close-out commit."

**Target recorded as 2026-11-04, not 2026-11-02:** the read was still pending on 2026-11-01 (the 17:12Z re-check showed the same "Couldn't fetch" row about 28 h after submission), so a target one day out would very likely lapse unmet; three days leaves room for Google's queue before the resubmit step.

## Requirements

- **Complete:** LIVE-03, LIVE-06, LIVE-07, LIVE-09, SMOKE-04 (ticked `[x]`, traceability `Complete`).
- **Carried:** LIVE-05 stays `[ ]`, its line reads "(live half: property verified 2026-10-31; sitemap read carried to 2026-11-04, Search Console still 'Couldn't fetch' after 28 h although Googlebot fetches it 200 with 14 URLs; see 13-19-SUMMARY.md)", and its traceability row is unchanged (`| LIVE-05 | Phase 12 | Pending (local half done; live half in Phase 13) |`).

## Task 1: ledger results and the launch-proof index (`29d9c66`)

### Ledger rows written (`.planning/HUMAN-UAT.md`)

| Row | Result | Evidence (abridged; the ledger has the full cell) |
| --- | --- | --- |
| L01 | passed 2026-10-31 | live-smoke 41149881068 (f070c74, 121 passed: `routing.smoke.ts` + `csp.smoke.ts`); same specs green in go-live run 41115004823 (its one failure was the precache wait); `docs/launch-proof/2026-10-30/`; owner "Fresh checks pass" |
| L02 | passed 2026-10-30 | go-live ci 41111039721 (deploy success 19:24:26Z); `.nojekyll` curl 200; `workflow-gate.test.ts` |
| L03 | passed 2026-10-31 | 13-21-SUMMARY.md (status only: rejected by push protection; PAT revoked; branch never on the remote; push protection `enabled` via API) |
| L06 | passed 2026-10-31 | `third-party.smoke.ts` + `assets.smoke.ts` in 41149881068; re-confirmed in 41202355014 |
| L26 | passed 2026-10-31 | 13-21-SUMMARY.md (status/host/count only: RentCast accepted line, no CORS error; dashboard count not recorded) |
| L36 | passed 2026-10-31 (RentCast only); carried (Phase 14 AI-provider CORS re-probe: Anthropic, OpenAI, Gemini, OpenRouter) | 13-21-SUMMARY.md (status/host/count only) |
| L64 | passed 2026-10-31 | `csp.smoke.ts` + `third-party.smoke.ts` in 41149881068; live connect-src without an analytics host |
| L82 | cut: GTM-04 moved to v2 by owner decision P13-4 (b) on 2026-10-30, before any Umami website, probe or analytics variable existed (class changed `human` -> `cut`) | 13-14-SUMMARY.md (owner answers verbatim; no screenshot exists) |
| L83 | passed 2026-10-31 | `20-web3forms-inbox.png`; f169749 pair; 13-15 Task 3 |
| L84 | pending (owner, target next owner session) | `PUBLIC_CONTACT_EMAIL` unset through Phase 13; set and verify, or record "unset" |
| L85 | passed 2026-10-31 | `30-linkedin-card.png` + `31-og-validator-card.png` (D-18: OpenGraph.xyz for the login-walled Facebook debugger); 13-16 |
| L86 | carried (sitemap read; owner, target 2026-11-04): property verified 2026-10-31; sitemap submitted 12:54Z, still "Couldn't fetch", 0 discovered, through 2026-11-01 17:12Z; robots at the host root not applicable on a project site | `40-search-console-verified.png` + 13-17-SUMMARY.md + this SUMMARY; Googlebot fetch 200 with 14 `<loc>`; live test "URL is available to Google" (final wording set in `5421807`) |
| L87 | passed 2026-10-31 (routing half) | `routing.smoke.ts` in 41149881068 + owner fresh-profile checks; keys half = L30/L36; Safari half = L12 |
| L88 | passed 2026-10-31 | 13-21-SUMMARY.md (status only; push protection and secret scanning `enabled` via API); Dependabot triaged per D-07 (13-11) |
| L94 | passed 2026-10-31 | `extension-link.smoke.ts` in 41149881068; popup-click half rides with Phase 17 (L95) |
| L99 | carried (sitemap read; owner, target 2026-11-04) | P13 = L86; same evidence (final wording set in `5421807`) |
| P13-1 | passed 2026-10-31 | `21-gtm01-sample-data.png`; performed by the orchestrator in the owner's browser under the recorded approval; 13-15 Task 3 |
| P13-2 | passed 2026-10-30 | go-live ci 41111039721 + live-smoke 41149881068; propagation 0 s in every run; D-13 facts; `checks.json`; RUNBOOK |
| P13-3 | decided 2026-10-30: decision C (C-approve) | 13-01-SUMMARY.md ("A-approve, B-ignore, C-approve"); applied by 13-07 |
| P13-4 | decided 2026-10-30: "IPs not stored: proceed", then "Hold Umami for now", then "Cut Umami now (GTM-04 to v2)" (option b) | 13-14-SUMMARY.md |

Final tally (2026-11-01): smoke 5, smoke + human 1, human 73, owner-decision 15, cut 5 by class; by result passed 13, decided 1, cut 5, carried 12 (L66, L79-L81, L86, L89, L90, L91, L93, L95, L96, L99), pending 68 origin rows; Phase 13 rows passed 2, decided 2.

### Launch-proof index (`docs/launch-proof/2026-10-30/README.md`)

Sections: Deployed commits; Runs table (now including the close-out row for `7372b61`: ci 41218226897, deploy success 16:35:48Z, chained live-smoke 41220466187 red on HTTP 429, dispatched re-run 41220812811 green); First-deploy facts (D-13); Files table with "Captured by" for every file and the carried **Pending** row for `41-search-console-sitemap.png` (with the follow-up); Substitutions (D-18); Redaction.

### Verification (Task 1)

| Check | Output |
| --- | --- |
| `pnpm vitest run --project scripts scripts/human-uat-ledger.test.ts` | 1 file, **24 passed** |
| `grep -cE "^\| (L01\|L02\|L06\|L64\|L94) \|.*passed" .planning/HUMAN-UAT.md` | **5**; each row contains `actions/runs/` |
| `grep -c "actions/runs/" docs/launch-proof/2026-10-30/README.md` | **7** at Task 1 (>= 6); more after the close-out row |
| `du -sk docs/launch-proof/2026-10-30` | **1632** (< 5120) |
| e-mail-shaped strings in README | **0**; `_KEY=` assignments in README/ledger: 0 / 0 |
| `pnpm lint` | exit 0 |
| commit | `29d9c66 docs(13): ledger results and launch-proof index`; gitleaks no leaks; attribution grep **0** |

## Task 2: runbook facts, requirement ticks, validation map (`7372b61`)

- `docs/RUNBOOK.md` `## First deploy facts`: placeholder replaced by the dated list (go-live SHA/runs/first green trio; `after 0 s` propagation lines; cache headers; raw 404 shell vs branded page; redirects, `.nojekyll`, `version.json`; `workflow_run` head_sha; precache times with the 20 s wait; job durations; the fix-by-new-push rule).
- `.planning/REQUIREMENTS.md`: LIVE-06, LIVE-07, LIVE-09 `[x]` with evidence pointers and `Complete`; LIVE-03 and SMOKE-04 lines extended; LIVE-05 left `[ ]`.
- `.planning/PROJECT.md`: "Validated in Phase 13 ... (live origin, 2026-10-31)" block (GTM-01..03 ✓, GTM-04 ✗ cut, LIVE-02/03/06/07/09, SMOKE-04); Current State paragraph.
- `13-VALIDATION.md`: all 51 map rows filled, `wave_0_complete: true`, Wave 0 boxes ticked.

### Verification (Task 2)

| Check | Output |
| --- | --- |
| `pnpm vitest run --project scripts scripts/runbook.test.ts` | 1 file, **23 passed** |
| `grep -c "Recorded at go-live (plan 13-19)." docs/RUNBOOK.md` | **0**; propagation `after 0 s` present |
| `grep -cE "^- \[x\] \*\*(LIVE-03\|LIVE-05\|LIVE-06\|LIVE-07\|LIVE-09\|SMOKE-04)\*\*" .planning/REQUIREMENTS.md` | **5** (the plan expects 6; LIVE-05 is carried) |
| `grep -cE "\| (LIVE-03\|LIVE-06\|LIVE-07\|LIVE-09\|SMOKE-04) \| Phase 13 \| Complete \|"` | **5** |
| LIVE-05 traceability greps (`Pending (local half ...)` / `Complete`) | **1 / 0** (the plan expects 0 / 1; carried) |
| `grep -cE "^\| (L03\|L26\|L36\|L88) \|.*(passed\|carried \()" .planning/HUMAN-UAT.md` | **4**; none contains "Phase 13 go-live" |
| `pnpm lint` | exit 0 |
| `pnpm vitest run --project scripts` | **34 files, 1049 passed** |
| commit | `7372b61 docs(13): runbook first-deploy facts and requirement ticks`; gitleaks no leaks; attribution grep **0** |

## Task 3: owner close-out push and the final trio (pushed `7372b61`, trio green)

### Owner approval (verbatim) and its reading

The owner's standing approval, relayed by the orchestrator: **"signed in check please and auto aproove everything please"**. It was read as covering this close-out push and the one dispatch of `live-smoke.yml` below.

### Executor-first hygiene (read-only, 2026-10-31T14:26:58Z)

| Check | Output |
| --- | --- |
| `node scripts/commit-hygiene.mjs --history` | `1329 commits scanned, 0 with assistant attribution`; exit 0 |
| `git log --format='%h [%(trailers:key=Co-Authored-By,valueonly)]' origin/main..HEAD` | nine commits, every trailer value `[]` |
| `git status --short` | only the then-draft SUMMARY untracked |
| `git diff --stat origin/main..HEAD -- apps packages scripts .github` | empty (docs/planning only; the deployed code stays the audited `f169749`) |
| `git fetch origin && git status -sb` | `## main...origin/main [ahead 9]`; HEAD `7372b61`, origin/main `f169749` |

### The push

The executor's `git push origin main` was **denied by the session's permission layer** (classified as a production deploy) and was not worked around. **The owner ran `git push origin main` themselves:** `f169749..7372b61  main -> main`. Pushed SHA **`7372b611be76dda8ffc8943b4a7cfde33cb22932`**.

### Close-out trio on 7372b61 (final)

| Leg | URL | Conclusion |
| --- | --- | --- |
| ci 41218226897 (push) | https://github.com/wolfwdavid/tran_real_estate/actions/runs/41218226897 | **success**, `deploy` job **success** (16:35:48Z-16:35:58Z), wall 27m22s |
| live-smoke 41220812811 (workflow_dispatch) | https://github.com/wolfwdavid/tran_real_estate/actions/runs/41220812811 | **success**, headSha 7372b61, 16:40:28Z-16:42:06Z; `live at ... after 0 s`, **121 passed (50.8s)**, zero 429s |
| `version.json` | https://wolfwdavid.github.io/tran_real_estate/_app/version.json | `{"version":"7372b611be76dda8ffc8943b4a7cfde33cb22932"}` (= pushed SHA) |

The orchestrator dispatched 41220812811 under the owner's standing approval above, after confirming 200 on `/`, `/legal/privacy/`, `/renter/`, `/settings/` and `version.json` at 16:40:20Z. Command (the documented manual run in docs/RUNBOOK.md): `gh workflow run live-smoke.yml --repo wolfwdavid/tran_real_estate --ref main -f base_url=https://wolfwdavid.github.io/tran_real_estate/ -f expect_version=7372b611be76dda8ffc8943b4a7cfde33cb22932`.

### Chained live-smoke on 7372b61 (kept in the record: RED on an external rate limit)

| Run | URL | Conclusion | Timing |
| --- | --- | --- | --- |
| ci 41218226897 | https://github.com/wolfwdavid/tran_real_estate/actions/runs/41218226897 | **success** (push, main) | 16:08:37Z to 16:35:59Z, wall **27m22s**. Jobs: secrets + real-data guard 7 s; configured leg 6m36s; sub leg 26m15s; root leg 27m03s; **deploy success** 10 s, `Created deployment for 7372b611be76dda8ffc8943b4a7cfde33cb22932` |
| live-smoke 41220466187 | https://github.com/wolfwdavid/tran_real_estate/actions/runs/41220466187 | **failure** (exit 1 = suite; workflow_run) | 16:36:01Z, job 1m26s. `live at ... after 0 s`, `precache: 380 entries installed after 3085 / 1796 / 1800 ms`, **`35 failed`, `86 passed (42.2s)`**; artifact `live-smoke-traces` uploaded |

**Diagnosis (read-only):** every failing assertion is `Expected: 200`, `Received: 429` on `page.goto(route)` or the `version.json` fetch, 70 times across 35 tests, starting at test 86 (`third-party.smoke.ts › /legal/privacy/`) after tests 1-85 passed. GitHub Pages rate-limited the runner's burst after three full precache installs and a walk of every route. The site served the new build throughout (`version.json` = pushed SHA, propagation 0 s, `/`, `/tools/`, `/sitemap.xml` 200 at 16:38:35Z), and the dispatched re-run three minutes later passed 121/121 with zero 429s. **Classification:** an external rate limit, not a regression; no retry, poll raise or re-run was done by the executor.

```
##[error]  1) tests/smoke/third-party.smoke.ts:10:2 › /legal/privacy/ makes zero cross-origin requests
    Expected: 200
    Received: 429
  35 failed
  86 passed (42.2s)
```

## Search Console sitemap read (carried)

| When (UTC) | Observation |
| --- | --- |
| 2026-10-31 12:54Z | `sitemap.xml` submitted on the verified URL-prefix property (13-17) |
| 2026-10-31 19:31Z, 20:02Z, 20:21Z, 20:31Z; 2026-11-01 17:12Z | "Submitted sitemaps" row unchanged every time: `/sitemap.xml`, Type Unknown, Submitted Oct 31 2026, Last read empty, Status "Couldn't fetch", 0 discovered (about 28 h after submission at the last check) |
| 2026-10-31 19:31Z | URL Inspection of the home page: indexed view "URL is unknown to Google" (no referring sitemaps, last crawl N/A); live test "URL is available to Google" |
| 2026-10-31 20:02Z | Googlebot-UA fetch of `sitemap.xml`: 200, `application/xml`, 1272 bytes, no BOM, sitemaps.org namespace, 14 `<loc>` with 14 `<url>` open/close pairs, no unescaped ampersands; all 14 listed URLs answered 200 |
| 2026-10-31 | The orchestrator tried to press "Request indexing"; the permission layer blocked it, so no request was sent |

The sitemap is well-formed and fetchable, so the "Couldn't fetch" row is Google's processing state, not a site defect. Recorded as carried in the ledger (L86, L99), REQUIREMENTS (LIVE-05), PROJECT.md, the proof README and 13-VALIDATION (13-17-02).

## Task Commits

1. **Task 1: ledger results and the launch-proof index** - `29d9c66` (docs)
2. **Task 2: runbook facts, requirement ticks, validation map** - `7372b61` (docs; the pushed close-out SHA)
3. **Task 3: owner close-out push** - no executor commit; owner pushed `7372b61`, trio recorded above
4. **Carry the sitemap read and close the ledger** - `5421807` (docs: L86/L99 carried, tally, LIVE-05 note, PROJECT status, README close-out row and Pending follow-up, 13-VALIDATION complete)

Also on local main (not part of this plan's tasks): `4dd2d33 docs(lessons): Pages CDN 429 in live-smoke`.

**Plan metadata:** `docs(13-19): complete phase close-out plan` (this SUMMARY, STATE.md, ROADMAP.md).

## Files Created/Modified

- `.planning/HUMAN-UAT.md` - Phase 13 results on 20 rows, L86/L99 carried, `Updated:` 2026-11-01, tally
- `docs/launch-proof/2026-10-30/README.md` - the bundle index (new), close-out run row, carried Pending row
- `docs/RUNBOOK.md` - `## First deploy facts` measured list
- `.planning/REQUIREMENTS.md` - LIVE-06/07/09 ticked, pointers, LIVE-05 carried note, footer
- `.planning/PROJECT.md` - Phase 13 Validated block, GTM moves, "Phase 13 complete (2026-11-01) with one carried item"
- `.planning/phases/13-live-origin-first-ci-run-first-deploy-post-deploy-smoke-uat-burn-down/13-VALIDATION.md` - map statuses, `status: complete`, carried legend, execution-status note
- this SUMMARY

## Decisions Made

See `key-decisions` in the frontmatter: the owner's close-with-carry decision and the 2026-11-04 target, the carried wording for L86/L99, LIVE-05 left open, 13-VALIDATION complete with one carried row, the trio accepted with the red chained run kept in the record, L82 reclassified to `cut`, smoke evidence anchored on 41149881068, the 13-21 hand-off applied verbatim, L84 retargeted.

## Deviations from Plan

### Scope held back by owner decision (no code change)

**1. LIVE-05, L86, L99 carried, not passed.** The plan writes `passed <date>: sitemap read, 14 URLs` and `| LIVE-05 | Phase 12 | Complete |`. Search Console never read the sitemap before the close, so by owner decision (2026-11-01) the rows are carried to 2026-11-04 and the two LIVE-05 greps print 1 / 0 instead of 0 / 1.

**2. 13-VALIDATION row 13-17-02 is `carried`.** The legend gained `↪ carried`; `status: complete` is set on the 05/10 precedent, with the reason in the file.

**3. Task 3 trio uses a dispatched live-smoke.** The chained run 41220466187 failed on Pages CDN 429s; the green leg is the dispatched run 41220812811 on the same SHA. Both are recorded.

### Plan expectations corrected by the evidence (no code change)

**4. L82 and P13-4 use the cut/decision wording**, not the plan's `no pageviews` sentence (13-14 recorded a cut before any Umami service existed).

**5. L85 cites OpenGraph.xyz (D-18)** instead of the Facebook debugger, as 13-16 recorded.

**6. L82's class changed `human` -> `cut`**; tally recounted.

---

**Total deviations:** 0 auto-fixed; 3 items shaped by the owner decision and the external rate limit; 3 evidence-driven wording changes.
**Impact on plan:** every task is complete; the phase's one external item is carried in the same words in the ledger, REQUIREMENTS, PROJECT, the validation map, the proof README and this SUMMARY.

## Issues Encountered

- The chained live-smoke on the close-out push hit HTTP 429 from the Pages CDN (see Task 3); handled by one dispatched re-run, recorded in `tasks/lessons.md` (`4dd2d33`).
- The executor's push and the orchestrator's "Request indexing" click were both blocked by the permission layer; the owner pushed, and no indexing request was sent.

## Known Stubs

None. Planning and docs only; the carried rows and the README Pending row are explicit, dated and have a written follow-up.

## Next steps (carried follow-up)

1. **Sitemap read (owner, target 2026-11-04).** When Search Console shows the read (Success, 14 discovered): add `docs/launch-proof/2026-10-30/41-search-console-sitemap.png`, set ledger rows L86/L99 to `passed <date>: sitemap read, 14 URLs` (keep the robots-at-host-root note on L86), tick LIVE-05 and set `| LIVE-05 | Phase 12 | Complete |`, flip 13-VALIDATION 13-17-02 to green, and replace the README Pending row. One small docs commit.
2. **If it still reads "Couldn't fetch" on 2026-11-04:** resubmit once using the full sitemap URL (`https://wolfwdavid.github.io/tran_real_estate/sitemap.xml`), then investigate (never resubmit in a loop).
3. **Live-smoke CDN-429 hardening (separate quick task):** map HTTP 429 on navigation (and on the `version.json` fetch) to the existing exit-2 environment-precondition path of `scripts/smoke.mjs`, keeping zero retries for every other status. Evidence: run 41220466187 and the Task 3 section above.

## Self-Check: PASSED

- Files exist: `docs/launch-proof/2026-10-30/README.md`, `.planning/HUMAN-UAT.md`, `docs/RUNBOOK.md`, `.planning/REQUIREMENTS.md`, `.planning/PROJECT.md`, `13-VALIDATION.md`, this SUMMARY, `40-search-console-verified.png`.
- Commits resolve (`git cat-file -t` = commit): `29d9c66`, `7372b61`, `5421807`, `4dd2d33`, `f169749`, `e9f82f2`.
- `pnpm lint` exit 0; `pnpm vitest run --project scripts` exit 0 (34 files, 1049 passed); ledger test 24 passed.
