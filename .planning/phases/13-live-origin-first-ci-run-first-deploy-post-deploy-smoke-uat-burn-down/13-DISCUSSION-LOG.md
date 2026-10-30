# Phase 13: Live Origin: First CI Run, First Deploy, Post-Deploy Smoke & UAT Burn-down - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-29
**Phase:** 13-live-origin-first-ci-run-first-deploy-post-deploy-smoke-uat-burn-down
**Mode:** `--auto` (every question resolved with the recommended option; no interactive prompts)
**Areas discussed:** Origin & base path mechanism, Dependabot triage, live-smoke.yml shape, GitHub-side actions ownership, GTM proof order & cut lines, UAT ledger / proof bundle / runbook

---

## Origin & base path mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| `BASE_PATH` repository variable, root leg only | Keep `PUBLIC_SITE_URL` origin-only (validator unchanged); add `BASE_PATH=/tran_real_estate` read by the deploy leg and the release workflow | ✓ |
| Loosen `PUBLIC_SITE_URL` to accept a path | Derive the base path from the URL's pathname | |
| Deploy the existing `sub` build | Switch the Pages upload to `build-sub` | — rejected: `sub` blanks every owner setting (analytics, forms) |
| Hard-code `BASE_PATH` on the root leg in `ci.yml` | Checklist Step 2 wording | — rejected: not a variable, org-root layout would stop being valid |

| Option | Description | Selected |
|--------|-------------|----------|
| `DEFAULT_SITE_ORIGIN` follows the real origin | `https://wolfwdavid.github.io`; local `sub` build becomes the production twin | ✓ |
| Keep the dead org default | Local builds and extension zips keep linking to a URL that will never exist | |

**Auto choice:** variable knob + real default origin; extension `PRIVACY_URL` composed from origin + base path via one shared helper.
**Notes:** The handoff's `PUBLIC_SITE_URL=https://wolfwdavid.github.io/tran_real_estate` fails the `site-config.js` origin regex; the handoff is overridden.

---

## Dependabot triage

| Option | Description | Selected |
|--------|-------------|----------|
| Ignore majors for the Phase 16 toolchain set; close open major PRs; keep weekly minor/patch group | Smallest config change; majors are Phase 16 by roadmap | ✓ |
| Merge what is green | Risks mid-phase pin drift against a locked toolchain | |
| Disable Dependabot | Loses the security-update signal the owner turned on at the gate | |

**Auto choice:** ignore + close with a Phase 16 pointer; the failing 20-package minor group and `@types/node` 26 are closed and re-evaluated in Phase 14/16; the `setup-node` 7.1.0 PR merges only if green and the gate test passes.

---

## live-smoke.yml shape

| Option | Description | Selected |
|--------|-------------|----------|
| `workflow_run` on `ci` success (main) + `workflow_dispatch(base_url, expect_version)`; checkout `head_sha`; job-level `if` on `PAGES_ENABLED` | Mirrors the deploy gate; no red runs while Pages is off | ✓ |
| Append the smoke as a job inside `ci.yml` | Would change the pinned action count and couple the deploy to the smoke | — rejected by SMOKE-04 |
| Schedule-based smoke | Not tied to a deploy; cannot know the expected SHA | |

| Option | Description | Selected |
|--------|-------------|----------|
| Upload Playwright report + traces on failure (pinned `actions/upload-artifact`, 14 days) | Readable failures without re-running | ✓ |
| No artifacts | Cheaper, but the owner reads logs only | |

**Auto choice:** as above; accept one synthetic Umami pageview per deploy from the single GPC-off spec.

---

## GitHub-side actions ownership

| Option | Description | Selected |
|--------|-------------|----------|
| Owner checkpoints with exact commands; executors never push or set variables | Matches the Phase 1/12 rule ("automation never pushes") | ✓ |
| Executors run `gh variable set` / `git push` under the logged-in session | Faster, but silently mutates the live repo | |

**Auto choice:** owner checkpoints; the owner may explicitly approve the executor running a printed command.

---

## GTM proof order & cut lines

| Option | Description | Selected |
|--------|-------------|----------|
| Umami → Web3Forms → share cards → Search Console | Cut line first; Search Console last because its token is a source commit needing a deploy | ✓ |
| Search Console first | Forces an extra deploy before anything else is proven | |

**Auto choice:** as above; Umami IP-storage confirmation and the `curl` probe stay preconditions; GTM-04 cut line unchanged (remove variables, redeploy, move to v2, record in PROJECT.md).

---

## UAT ledger, launch-proof bundle, runbook

| Option | Description | Selected |
|--------|-------------|----------|
| One ledger `.planning/HUMAN-UAT.md`; per-phase files kept with `status: superseded` | History preserved, one place to read results | ✓ |
| Delete the per-phase files | Loses the sourcing of each row | |
| Put the ledger under `docs/` | Owner UAT results have always lived in `.planning` | |

| Option | Description | Selected |
|--------|-------------|----------|
| `docs/launch-proof/<date>/README.md` + redacted PNGs, under 5 MB | Dated, indexed, no PII | ✓ |
| Links only, no screenshots | Run links expire with log retention | |

| Option | Description | Selected |
|--------|-------------|----------|
| New `docs/RUNBOOK.md` (operations) and DEPLOY-CHECKLIST kept as the one-time go-live record | Clear split between "once" and "every time" | ✓ |
| Fold the runbook into DEPLOY-CHECKLIST | One long doc mixing done steps with repeat procedures | |

---

## Claude's Discretion

- Shape and location of the shared origin+base helper.
- One or two jobs in `live-smoke.yml`.
- How the Playwright proof screenshots are produced.
- Ledger table layout and proof-bundle file names.

## Deferred Ideas

- Custom domain; the 20-package Dependabot minor group and `@types/node` 26 (Phase 14/16); Kit 3 / Vitest 5 (Phase 16); the `configured` leg's 6-minute runtime anomaly and `precommit.test.ts` load sensitivity (Phase 15); extension release and Edge submission (Phase 17).
