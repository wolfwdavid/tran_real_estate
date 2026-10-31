---
phase: 13-live-origin-first-ci-run-first-deploy-post-deploy-smoke-uat-burn-down
plan: 21
subsystem: infra
tags: [push-protection, secret-scanning, cors, live-origin, rentcast, owner-checkpoint, human-uat, d-14]

# Dependency graph
requires:
  - phase: 13-live-origin-first-ci-run-first-deploy-post-deploy-smoke-uat-burn-down
    provides: 13-13 go-live (GO_LIVE_SHA ad5fd08; green ci + deploy + live-smoke pair on f070c74); the live Settings page at https://wolfwdavid.github.io/tran_real_estate/settings/
  - phase: 12-go-live-readiness-local-smoke-suite
    provides: secret scanning and push protection enabled at the Phase 12 owner gate (DEPLOY-CHECKLIST Step 5); the probe recipe in DEPLOY-CHECKLIST Step 7 item 7
provides:
  - "L03 / L88 result: push protection rejected the throwaway-PAT push on a local probe branch; the PAT is revoked; the branch was never on the remote and is deleted locally (executor-verified)"
  - "L26 / L36 result: RentCast key test from the live origin answered with the accepted line and no CORS error (dashboard count not recorded; owner states unchanged); Anthropic, OpenAI, Gemini and OpenRouter declined, target Phase 14"
  - "Read-only confirmation that secret_scanning_push_protection is enabled on wolfwdavid/tran_real_estate"
affects: [13-19 ledger results for L03 L88 L26 L36, Phase 14 AI-provider CORS re-probe]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Owner probe results are recorded as outcome words, hosts, result lines and yes/no answers only; no key, token, status body or e-mail address ever enters a SUMMARY"
    - "A declined owner check is carried with an explicit target phase or date the owner names, never with the go-live itself as the target"

key-files:
  created:
    - .planning/phases/13-live-origin-first-ci-run-first-deploy-post-deploy-smoke-uat-burn-down/13-21-SUMMARY.md
  modified:
    - .planning/STATE.md
    - .planning/ROADMAP.md

key-decisions:
  - "13-21: the push-protection probe counts as proven on the owner's word plus the executor's branch and remote checks; no agent saw the token and no probe artifact exists in the tree"
  - "13-21: the RentCast CORS re-probe is proven by the accepted result line and no console CORS error; the dashboard count was not written down, so the L26/L36 evidence says 'count not recorded' rather than inventing a number"
  - "13-21: the four AI-provider re-probes (Anthropic, OpenAI, Gemini, OpenRouter) are declined with target Phase 14; 13-19 carries them as 'carried (Phase 14)'"

patterns-established:
  - "Executor side of an owner checkpoint: re-run every mechanical check the plan names and paste the outputs with a UTC timestamp, so the SUMMARY stands on its own"

requirements-completed: [LIVE-03]

# Metrics
duration: 12 min (executor side; the owner ran both probes before this executor was spawned, 2026-10-31 UTC)
completed: 2026-10-31
---

# Phase 13 Plan 21: Push-protection probe and live-origin CORS re-probe Summary

**Push protection on `wolfwdavid/tran_real_estate` rejected a throwaway zero-permission PAT pushed from a local `push-protection-probe` branch (PAT revoked, branch deleted locally, never on the remote; `secret_scanning_push_protection.status` reads `enabled` via the API), and the RentCast key test from the live origin `https://wolfwdavid.github.io/tran_real_estate/settings/` answered with the "RentCast accepted this key" line and no CORS error; the four AI-provider re-probes were declined by the owner and carried to Phase 14.**

## Performance

- **Duration:** 12 min of executor work (checks, SUMMARY, metadata). The owner's probes were run and reported through the orchestrator before this executor started.
- **Started:** 2026-10-31T01:16:09Z (executor-side checks)
- **Completed:** 2026-10-31T01:28Z
- **Tasks:** 2 (both owner checkpoints, both answered; no autonomous task)
- **Files modified:** 0 repository files; this SUMMARY plus STATE.md and ROADMAP.md

Every tool call stayed under 7 minutes. No `git push`, no `gh variable`, no PR or settings change; `gh` and `curl` were used read-only (D-14).

## Owner results

Given through the orchestrator's questions, 2026-10-31 UTC. Recorded verbatim.

- **Task 1, push-protection probe.** Question: "Push-protection probe (plan 13-21, rows L03/L88): what was the outcome?" The owner chose **"Rejected, revoked, deleted"** (description: "The push was rejected by push protection, the token is revoked in GitHub settings, and the local probe branch is deleted."). The orchestrator then verified: `git branch --show-current` = main, `git status --short` empty, `git branch --list push-protection-probe` empty, `git ls-remote --heads origin push-protection-probe` empty, no probe.txt in the tree. No token was ever shown to any agent.
- **Task 2, CORS re-probe.** The question listed the plan's steps and asked for per-provider results. The owner chose **"All tested, no CORS errors"**, then on the detail question chose **"RentCast only, others declined"** (description: "Only RentCast was tested (accepted, no CORS error, count unchanged)."), then on the record question chose **"Counts not recorded; target Phase 14"** (description: "You did not note the dashboard counts; the AI provider re-probe is carried to Phase 14.").

## Task 1: push-protection probe (ledger L03, L88)

| Row | Check | Outcome |
| --- | --- | --- |
| L03 (01-3) | Push protection rejects a token push | **rejected by push protection**; PAT revoked; probe branch never on the remote, deleted locally |
| L88 (10-7) | Dependabot + push protection on; probe rejected | **rejected by push protection**; PAT revoked; branch never on remote, deleted locally. Settings side confirmed read-only below (`enabled`) |

The probe followed DEPLOY-CHECKLIST Step 7 item 7 (throwaway fine-grained PAT with no permissions and a one-day expiry; `SKIP_SIMPLE_GIT_HOOKS=1` for the local commit so the gitleaks hook did not pre-empt GitHub; never the `TRANCANARY_` pattern). The executor ran none of the probe commands and never asked for the token.

### Executor-side checks (2026-10-31T01:16:09Z)

| Command | Output |
| --- | --- |
| `git branch --list push-protection-probe` | (empty) |
| `git ls-remote --heads origin push-protection-probe` | (empty), exit 0 |
| `git status -sb` | `## main...origin/main [ahead 1]` (the 13-13 metadata commit `a0ed201`, not pushed per D-14) |
| `ls probe.txt`; `git ls-files \| grep -c probe.txt` | `No such file or directory`; `0` |
| `gh api repos/wolfwdavid/tran_real_estate --jq '.security_and_analysis.secret_scanning_push_protection.status'` | `enabled` |
| `gh api repos/wolfwdavid/tran_real_estate --jq '.security_and_analysis.secret_scanning.status'` | `enabled` |
| `git log --oneline -3` | `a0ed201 docs(13-13): ...`, `f070c74 docs(launch-proof): ...`, `79f82bc fix(13-13): ...` (no probe commit on `main`) |

Acceptance criteria: owner reports "rejected by push protection" (yes); both branch checks print nothing (yes); owner confirms the PAT was revoked (yes).

## Task 2: live-origin CORS re-probe per provider (ledger L26, L36)

Run by the owner in a fresh private window at `https://wolfwdavid.github.io/tran_real_estate/settings/` with DevTools Console and Network open, keys session-only.

| Provider | Host | Result line / status | CORS error | RentCast dashboard count before / after |
| --- | --- | --- | --- | --- |
| RentCast | `api.rentcast.io` | "RentCast accepted this key" line shown (the key test is the 04-U3 probe, which answers 400 or 404; the owner did not report the numeric status) | **no** | **not recorded**; the owner states the count was unchanged, but no before/after numbers were written down |
| Anthropic | `api.anthropic.com` | declined, target Phase 14 | n/a | n/a |
| OpenAI | `api.openai.com` | declined, target Phase 14 | n/a | n/a |
| Gemini | `generativelanguage.googleapis.com` | declined, target Phase 14 | n/a | n/a |
| OpenRouter | `openrouter.ai` | declined, target Phase 14 | n/a | n/a |

| Row | Check | Outcome |
| --- | --- | --- |
| L26 (04-U11) | Browser fetch from the deployed origin succeeds (CORS) | **passed for RentCast** from the live origin (accepted line, no CORS error); dashboard count not recorded (owner: unchanged) |
| L36 (05-H7) | Launch-day CORS re-probe | **RentCast passed; Anthropic, OpenAI, Gemini, OpenRouter declined, target Phase 14** |

### Executor-side check (2026-10-31T01:16:09Z)

| Command | Output |
| --- | --- |
| `curl -s -o /dev/null -w "%{http_code}" https://wolfwdavid.github.io/tran_real_estate/settings/` | `200` |

Acceptance criteria: one row per provider with host, result line or "declined, target <X>" (yes); RentCast row records the dashboard count before and after (**partially**: the count was not recorded; this is stated plainly rather than filled in); no key, token or e-mail address in this SUMMARY (yes); the verify curl prints 200 (yes).

## Hand-off to plan 13-19

Plan 13-19 Task 1 turns these outcomes into `.planning/HUMAN-UAT.md` ledger results:

- **L03** and **L88**: `passed 2026-10-31`, evidence "13-21-SUMMARY.md (rejected by push protection; PAT revoked; branch never on remote, deleted locally; push protection `enabled` via API)".
- **L26**: `passed 2026-10-31` for RentCast, evidence "13-21-SUMMARY.md (status/host/count only; count not recorded)".
- **L36**: RentCast part `passed 2026-10-31`; the Anthropic, OpenAI, Gemini and OpenRouter parts `carried (Phase 14)`.

None of the four rows may stay in their current `pending (owner, plan 13-21)` state or point at the go-live as a target.

## Task Commits

No task commits: both tasks are owner checkpoints that touch no repository file, and the plan's executor rules forbid committing anything during the probe.

**Plan metadata:** `docs(13-21): complete push-protection and live-origin CORS probe plan` (this SUMMARY, STATE.md, ROADMAP.md; local, not pushed per D-14).

## Files Created/Modified

- `.planning/phases/13-live-origin-first-ci-run-first-deploy-post-deploy-smoke-uat-burn-down/13-21-SUMMARY.md` - this record
- `.planning/STATE.md` - position advanced, metric row, decisions, session line (13-21 done; 13-14 holding for the Umami website ID)
- `.planning/ROADMAP.md` - 13-21 ticked, Phase 13 progress 14/21 -> 15/21

`REQUIREMENTS.md` was not edited: LIVE-03 was already ticked complete by 13-13 and this plan adds no new evidence to it.

## Decisions Made

- The probe is recorded as proven on the owner's verbatim answer plus the executor's mechanical checks (branch absent locally and remotely, no probe file, push protection `enabled` read from the API). No agent handled or saw the token.
- The RentCast dashboard count is recorded as "not recorded" instead of a number. The owner's statement that it was unchanged is kept as the owner's statement.
- The four AI-provider re-probes are carried with the explicit target **Phase 14** (the owner's named target); the go-live is not used as a target anywhere in this record.

## Deviations from Plan

### Owner-reported substitutions (no code change)

**1. Partial Task 2 coverage.** The plan asked for one tested row per provider; the owner tested RentCast only and declined the four AI providers with target Phase 14. Allowed by the plan's executor rules ("declined, target <phase or date the owner names>").

**2. RentCast dashboard count not recorded.** The plan's acceptance criterion asks for the count before and after. The owner did not note it. Recorded plainly as "not recorded (owner: unchanged)" rather than filled in; 13-19 cites the SUMMARY as "status/host/count only" with that caveat.

**3. Executor-side read-only addition.** The executor added `gh api ... secret_scanning_push_protection.status` (read-only) to corroborate L88's "push protection on" half from the repository settings; output `enabled`.

---

**Total deviations:** 0 auto-fixed, 2 owner-reported substitutions, 1 read-only check added.
**Impact on plan:** L03 and L88 are fully closed. L26 is closed for RentCast with the count caveat. L36 is closed for RentCast and carried for the four AI providers to Phase 14. No repository file changed.

## Issues Encountered

None. All checks ran under 7 minutes and returned the expected values on the first attempt.

## Known Stubs

None. No application code changed in this plan.

## Next Phase Readiness

- Wave 8 remaining: **13-14** (GTM-04 Umami proof or cut) is on hold by owner decision until an Umami website ID exists. 13-19 depends on both 13-18 and 13-21; 13-21 is now done.
- Phase 14 inherits the AI-provider CORS re-probe (Anthropic, OpenAI, Gemini, OpenRouter) from the live origin, and the RentCast dashboard before/after count if the owner wants a numeric record.
- Nothing local is pending a push except the 13-13 and 13-21 metadata commits; the next push deploys and triggers a live-smoke.

## Self-Check: PASSED

- FOUND `.planning/phases/13-live-origin-first-ci-run-first-deploy-post-deploy-smoke-uat-burn-down/13-21-SUMMARY.md`
- `git branch --list push-protection-probe` and `git ls-remote --heads origin push-protection-probe` both empty; no `probe.txt` tracked or on disk
- `secret_scanning_push_protection.status` = `enabled`; live `/settings/` curl = 200
- `requirements-completed: [LIVE-03]` copied verbatim from 13-21-PLAN.md (already ticked by 13-13; REQUIREMENTS.md untouched)
- No key, token, or e-mail address in this file: a grep for the at-sign and for the GitHub, Anthropic, OpenAI, OpenRouter and Google key prefixes returns 0 lines

---
*Phase: 13-live-origin-first-ci-run-first-deploy-post-deploy-smoke-uat-burn-down*
*Completed: 2026-10-31*
