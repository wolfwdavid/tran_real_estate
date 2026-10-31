---
phase: 13-live-origin-first-ci-run-first-deploy-post-deploy-smoke-uat-burn-down
plan: 14
subsystem: infra
tags: [analytics, umami, gtm-04, cut-line, owner-decision, p13-4, d-14, d-16, d-17, launch-proof]
wave: 8
depends_on: ["13-13"]

# Dependency graph
requires:
  - phase: 13-live-origin-first-ci-run-first-deploy-post-deploy-smoke-uat-burn-down
    provides: 13-13 go-live (LAUNCH_DATE 2026-10-30, GO_LIVE_SHA ad5fd08, green ci + deploy + live-smoke pair on f070c74); variables BASE_PATH, PAGES_ENABLED, PUBLIC_SITE_URL
  - phase: 10-launch-services
    provides: the analytics beacon, the CSP connect-src wiring driven by PUBLIC_ANALYTICS_HOST, the analytics smoke spec, and the documented cut line (GTM-04 to v2)
provides:
  - "GTM-04 outcome for LIVE-06: umami cut, by owner decision P13-4 (b). No Umami website was created, no probe was run, no PUBLIC_ANALYTICS_* variable was ever set, no redeploy happened"
  - "Owner's D-17 IP-storage answer recorded verbatim ('IPs not stored: proceed'); no screenshot exists"
  - "Executor-verified live state: variable list has no PUBLIC_ANALYTICS_*; live CSP connect-src has no gateway.umami.is (0); privacy page has no usage-counts host (0); launch-proof folder has no 10-/11- files"
affects: [13-15 Task 1 (writes the cut into REQUIREMENTS.md and PROJECT.md; Task 2 has no variables to delete), 13-18 LAUNCH-AUDIT, 13-19 ledger rows P13-4 and L82, v2 analytics]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A cut taken by owner decision before any service exists is recorded as a decision, never dressed up as a measured 'no pageviews arrived' result"
    - "An owner's one-line answer stands in for a missing screenshot; the SUMMARY says the screenshot does not exist rather than creating a placeholder"

key-files:
  created:
    - .planning/phases/13-live-origin-first-ci-run-first-deploy-post-deploy-smoke-uat-burn-down/13-14-SUMMARY.md
  modified: []

key-decisions:
  - "13-14: analytics is cut now by owner decision P13-4 (b): GTM-04 moves to v2 under the documented cut line; Umami is not configured, the curl probe was not run, PUBLIC_ANALYTICS_HOST and PUBLIC_ANALYTICS_WEBSITE_ID were never set, so there is nothing to remove and no analytics redeploy"
  - "13-14: the D-17 IP-storage finding is the owner's verbatim answer 'IPs not stored: proceed'; docs/launch-proof/2026-10-30/10-umami-ip-setting.png was not saved and is not created"
  - "13-14: Tasks 2 and 3 are skipped with outcome 'umami cut', as the plan's Task 1 acceptance criteria allow on decision (b)"

patterns-established:
  - "Owner approvals and results are quoted verbatim with the question each answered, in the order they were given"

requirements-completed: [LIVE-06]

# Metrics
duration: 9 min (executor side; the owner's three answers were given through the orchestrator before this executor was spawned)
completed: 2026-10-31
---

# Phase 13 Plan 14: Umami usage counts (GTM-04 proof or cut) Summary

**GTM-04 is cut: the owner chose "Cut Umami now (GTM-04 to v2)" (ledger decision P13-4 option b) after first putting Umami on hold, so no Umami Cloud website exists, the `gateway.umami.is` probe was never run, `PUBLIC_ANALYTICS_HOST` and `PUBLIC_ANALYTICS_WEBSITE_ID` were never set, and no analytics redeploy happened; the executor's read-only checks confirm the live site at f070c74 carries no analytics host (`connect-src` count 0, variable list unchanged), and plan 13-15 Task 1 writes the cut into REQUIREMENTS.md and PROJECT.md.**

## Performance

- **Duration:** 9 min of executor work (reads, three read-only checks, this SUMMARY, one commit)
- **Started:** 2026-10-31T03:30:41Z
- **Completed:** 2026-10-31T03:40Z
- **Tasks:** 1 of 3 resolved (Task 1 owner checkpoint answered with decision b); Tasks 2 and 3 skipped with outcome "umami cut" per the plan's own acceptance criteria
- **Files modified:** 0 repository files; this SUMMARY only

Every tool call finished in seconds. No `git push`, no `gh variable set` or `delete`, no Umami probe, no repository or Pages setting change (D-14). No secret, token or key was requested, seen or recorded.

## Owner approvals/results

Given through the orchestrator's questions, 2026-10-30/31 UTC. Recorded verbatim, in the order they were given.

1. **D-17 IP-storage finding.** Earlier in the session, asked for the Umami IP-storage finding (plan Task 1 step 2, D-17), the owner answered: `IPs not stored: proceed`
2. **Website ID.** Asked for the Umami website ID (plan Task 1 step 1), the owner answered: `Hold Umami for now`
3. **Cut decision.** Asked "GTM-04 analytics: how should 13-14 proceed? The phase cannot close while Umami is on hold. "Cut" records GTM-04 to v2 under the documented cut line (REQUIREMENTS + PROJECT.md) with no variables to remove, since none are set." the owner chose: `Cut Umami now (GTM-04 to v2)` (option description: "13-14 records "umami cut" (owner decision P13-4 b). 13-15 Task 1 writes the cut into REQUIREMENTS.md and PROJECT.md. No analytics variables, no extra redeploy.")

## Outcome: umami cut (owner decision P13-4 b)

This is an owner decision, not a measured result. Stated plainly:

- No Umami Cloud account or website for `wolfwdavid.github.io` was created, so no website ID exists.
- The `curl -i -X POST https://gateway.umami.is/api/send ...` probe (plan step 3) was **not run** by the owner or the executor; there is no probe status line to record.
- `PUBLIC_ANALYTICS_HOST` and `PUBLIC_ANALYTICS_WEBSITE_ID` were **never set**; no `chore: redeploy with usage counts` commit exists; the live build has always run with analytics off (`CSP assertion passed for 45 pages (analytics host: none)` in every root-leg log, 13-12 and 13-13).
- No GPC-off / GPC-on pageview check (plan Task 3) took place, because there was nothing to send pageviews to. The D-17 wording "if no pageviews arrive from the deployed origin" does not describe what happened here; the trigger is the owner's choice to cut before configuring the service.
- The D-17 IP-storage finding is the owner's one-line answer above (`IPs not stored: proceed`). `docs/launch-proof/2026-10-30/10-umami-ip-setting.png` was not saved by the owner and does not exist; no placeholder image was created. `11-umami-pageviews.png` likewise does not exist.
- The cut line's remaining steps (GTM-04 moved to the future section of REQUIREMENTS.md, a PROJECT.md Key Decisions row) belong to plan 13-15 Task 1 and were **not** performed here. The cut line's "remove both variables, redeploy" steps have nothing to act on.

## Task 1: owner checkpoint (answered)

The plan's acceptance criteria for Task 1, checked against what happened:

| Criterion | Result |
| --- | --- |
| Variable list shows `PUBLIC_ANALYTICS_HOST` and a UUID `PUBLIC_ANALYTICS_WEBSITE_ID` | Not applicable on decision (b): the criterion itself says "on (b) no analytics variable exists and Tasks 2-3 are skipped with outcome 'umami cut'". Verified: no `PUBLIC_ANALYTICS_*` variable exists (below). |
| Owner reported the IP finding sentence; P13-4 decision recorded BEFORE any `gh variable set` | Yes: `IPs not stored: proceed`, then decision (b) `Cut Umami now (GTM-04 to v2)`. No `gh variable set` ever ran. |
| On proceed: probe status line 200 with JSON | Not applicable: the owner did not proceed; the probe was not run. |
| A commit `chore: redeploy with usage counts` is on origin/main | Not applicable on (b): no such commit exists (`git log --oneline -5` below shows none). |

### Executor-side checks (read-only, 2026-10-31T03:31:06Z)

| Command | Output |
| --- | --- |
| `gh variable list --repo wolfwdavid/tran_real_estate` | `BASE_PATH  /tran_real_estate  2026-10-30T18:21:10Z` / `PAGES_ENABLED  true  2026-10-30T18:55:45Z` / `PUBLIC_SITE_URL  https://wolfwdavid.github.io  2026-10-30T18:21:10Z` (exit 0; exactly three variables, no `PUBLIC_ANALYTICS_*`) |
| `curl -s https://wolfwdavid.github.io/tran_real_estate/ \| grep -o "connect-src[^;]*" \| grep -c "gateway.umami.is"` | **`0`** (expected 0: analytics never deployed). The live `connect-src` is `'self'` plus the six provider/form hosts already listed in the Phase 10 CSP (api.rentcast.io through api.web3forms.com); `gateway.umami.is` is absent. |
| `curl -s https://wolfwdavid.github.io/tran_real_estate/legal/privacy/ \| grep -c "gateway.umami.is"` | `0` (the privacy page's "Usage counts" host text is rendered only when the pair is set) |
| `curl -s https://wolfwdavid.github.io/tran_real_estate/_app/version.json` | `{"version":"f070c746cfb2ef1e0f1151cca2f5779cab00ecd3"}` (still the 13-13 green-pair SHA; no deploy since) |
| `ls docs/launch-proof/2026-10-30/` | `01-landing.png  02-renter.png  03-deep-route-refresh.png  04-not-found.png  05-version-json.png  checks.json` (no `10-` or `11-` file) |
| `git status --short` (before starting) | (empty) |
| `git status -sb` (before starting) | `## main...origin/main [ahead 2]` (the unpushed 13-13 and 13-21 metadata commits `a0ed201`, `74c799e`; expected, nothing was pushed here) |
| `git log --oneline -5` | `74c799e docs(13-21) ...`, `a0ed201 docs(13-13) ...`, `f070c74 docs(launch-proof) ...`, `79f82bc fix(13-13) ...`, `ad5fd08 chore: go live` (no `chore: redeploy with usage counts`) |

## Tasks 2 and 3: skipped (outcome "umami cut")

- **Task 2 (observe the analytics redeploy and its live-smoke):** skipped. There was no analytics SHA, no ci or live-smoke run to poll, and no IP screenshot to check or commit. The plan's own verify command was still run read-only and printed `0`, which is the correct value for a site with analytics off.
- **Task 3 (owner checks pageviews with GPC off and on):** skipped. Nothing was deployed to count pageviews. The resume word recorded for the plan is **"umami cut"**, with the qualification that it comes from decision P13-4 (b), not from an observed absence of pageviews.

## Hand-off to plans 13-15, 13-18 and 13-19

- **13-15 Task 1** applies the cut line to `.planning/REQUIREMENTS.md` (GTM-04 to the future section; LIVE-06 line annotated) and `.planning/PROJECT.md` (Key Decisions row). Its drafted wording says "No pageviews arrived from https://wolfwdavid.github.io/tran_real_estate/ in the Phase 13 live check"; that sentence is **not accurate** for this outcome and should read as an owner decision instead, for example: "cut by owner decision P13-4 (b) on 2026-10-30 before any Umami website or analytics variable existed; see 13-14-SUMMARY.md". The "<what the owner saw>" slot is the verbatim `Cut Umami now (GTM-04 to v2)`.
- **13-15 Task 2** says "On 'umami cut' only: run the two `gh variable delete` commands". There is nothing to delete; the variable list already has no `PUBLIC_ANALYTICS_*` entries, and the live CSP already prints 0 for `gateway.umami.is`. No extra redeploy is needed for the cut.
- **13-19** ledger: row **P13-4** (Umami "IP not stored" evidence, D-17) resolves to the owner's answer `IPs not stored: proceed` followed by decision (b), evidence "13-14-SUMMARY.md (owner answer only; no screenshot)". Row **L82** (the DEPLOY-CHECKLIST Step 8 item 1.3 IP record) resolves the same way, with analytics cut.
- **13-18** LAUNCH-AUDIT inherits GTM-04 = cut (v2), evidence this SUMMARY.
- Still unset by design after this plan: `PUBLIC_ANALYTICS_HOST`, `PUBLIC_ANALYTICS_WEBSITE_ID` (now permanently for v1.1), `PUBLIC_WEB3FORMS_KEY`, `PUBLIC_CONTACT_EMAIL`, `EXTENSION_RELEASES_ENABLED`.

## Task Commits

No task commits: Task 1 is an owner checkpoint that touched no repository file, and Tasks 2 and 3 were skipped. No screenshot was supplied, so the plan's only foreseen commit (`docs(launch-proof): Umami IP-storage finding`) does not exist.

**Plan metadata:** `docs(13-14): record the analytics cut (GTM-04 to v2)` (this SUMMARY only; local, not pushed per D-14, carried by the next owner push with `a0ed201` and `74c799e`).

## Files Created/Modified

- `.planning/phases/13-live-origin-first-ci-run-first-deploy-post-deploy-smoke-uat-burn-down/13-14-SUMMARY.md` - this record

`REQUIREMENTS.md` and `PROJECT.md` were deliberately not edited: plan 13-15 Task 1 owns the cut-line edits. `docs/launch-proof/` was not touched: the plan's `files_modified` entry anticipated owner screenshots that were never produced.

## Decisions Made

- Analytics is cut now by owner decision P13-4 (b). GTM-04 moves to v2 under the Phase 10 cut line. Rationale given by the owner's sequence: hold first, then cut so that Phase 13 can close.
- The outcome word for downstream plans is "umami cut", recorded with the plain statement that it is a decision taken before the service existed, not a finding that pageviews failed to arrive.
- The D-17 IP finding stands on the owner's one-line answer; no screenshot exists and none was fabricated.
- The executor ran only the read-only checks the orchestrator listed; the probe was not run because the owner cut analytics and because it would record a pageview on a website that does not exist.

## Deviations from Plan

### Owner-decision substitutions (no code change)

**1. Decision (b) taken at the first step, not at the IP-storage STOP condition.** The plan placed the P13-4 decision after the IP finding came back "stored or unclear". The owner's IP answer was "not stored" ("proceed"), but the owner then held the website ID and finally chose (b). Allowed by the plan's acceptance criterion for Task 1 ("on (b) no analytics variable exists and Tasks 2-3 are skipped with outcome 'umami cut'").

**2. No IP-setting screenshot.** The plan expected `docs/launch-proof/2026-10-30/10-umami-ip-setting.png`. The owner did not save one; the finding is the verbatim answer. Recorded plainly, no placeholder created (D-20 leaves nothing to redact).

**3. Probe not run; no probe status line.** The plan's "probe status line is 200 with JSON" criterion applies only on proceed. Not run by anyone.

**4. Tasks 2 and 3 skipped.** Per the plan's own rule for decision (b).

### Executor-side read-only additions

**5.** `curl .../legal/privacy/ | grep -c "gateway.umami.is"` (the Task 2 privacy check) and `curl .../_app/version.json` were run anyway to document the live state (`0` and f070c74). Read-only, no effect.

---

**Total deviations:** 0 auto-fixed, 4 owner-decision substitutions, 1 read-only check added.
**Impact on plan:** GTM-04 has a definitive outcome (cut, v2) with the decision recorded verbatim, which is what the plan's success criterion asks for. No repository file, variable, or deployment changed. LIVE-06's "or GTM-04 is cut per the documented cut line with the decision recorded" branch is satisfied here; the documentation half of the cut line lands in 13-15 Task 1.

## Issues Encountered

None. All checks returned the expected values on the first attempt and finished in seconds.

## Known Stubs

None. No application code changed in this plan.

## Next Phase Readiness

- Wave 8 is done: 13-14 (this plan, cut) and 13-21 (probes) both have SUMMARYs. Plan 13-15 can start: Task 1 writes the cut into REQUIREMENTS.md and PROJECT.md (with the wording correction noted above), Task 2 switches on Web3Forms with no analytics variables to delete.
- Nothing local is pending a push except the three metadata commits (13-13, 13-21, this one); the next owner push deploys again and triggers one live-smoke.
- v2 inherits GTM-04 (usage counts with GPC respected) along with the already-built beacon, CSP wiring and analytics smoke spec, which remain in the tree unused.

## Self-Check: PASSED

- FOUND `.planning/phases/13-live-origin-first-ci-run-first-deploy-post-deploy-smoke-uat-burn-down/13-14-SUMMARY.md`
- FOUND the metadata commit `docs(13-14): record the analytics cut (GTM-04 to v2)` at HEAD; attribution grep on its message prints 0
- `git status --short` empty after the commit; `git status -sb` reads `## main...origin/main [ahead 3]` (nothing pushed)
- `gh variable list` shows exactly BASE_PATH, PAGES_ENABLED, PUBLIC_SITE_URL; live `connect-src` `gateway.umami.is` count 0; `docs/launch-proof/2026-10-30/` has no `10-` or `11-` file
- `requirements-completed: [LIVE-06]` copied verbatim from 13-14-PLAN.md
- No key, token or e-mail address in this file

---
*Phase: 13-live-origin-first-ci-run-first-deploy-post-deploy-smoke-uat-burn-down*
*Completed: 2026-10-31*
