---
phase: 14-carried-debt
plan: 12
subsystem: marketing-budget
tags: [budget, initial-js, code-splitting, rolldown, launch-audit, DEBT-09]
requires:
  - "14-09 marketing form trim (native controls, lazy validation)"
provides:
  - "Per-audience copy modules (audience-renter/-investor/-agent.ts), re-exported from audiences.ts"
  - "Per-form copy modules (forms-waitlist.ts, forms-feedback.ts), imported directly by the forms"
  - "HARD 60 KB gate for feedback/ and for-*/ in scripts/assert-budget.mjs and the launch audit"
affects: [14-11 (regenerates docs/LAUNCH-AUDIT.md and docs/audit/budget.txt at the deployed SHA)]
tech-stack:
  added: []
  patterns:
    - "Content that differs per route lives in its own module. Splitting exports inside one module does not split chunks: the bundler places a whole module in the chunk of every entry that uses any of it"
    - "Import leaf copy modules directly when the aggregating module has a call at top level (Object.freeze): the bundler keeps that call, and with it every module it references"
key-files:
  created:
    - apps/web/src/lib/content/audience-renter.ts
    - apps/web/src/lib/content/audience-investor.ts
    - apps/web/src/lib/content/audience-agent.ts
    - apps/web/src/lib/content/forms-waitlist.ts
    - apps/web/src/lib/content/forms-feedback.ts
  modified:
    - apps/web/src/lib/content/audiences.ts
    - apps/web/src/lib/content/forms.ts
    - apps/web/src/lib/components/forms/WaitlistForm.svelte
    - apps/web/src/lib/components/forms/FeedbackForm.svelte
    - apps/web/src/lib/components/forms/feedback-counter.ts
    - apps/web/src/routes/(marketing)/feedback/+page.svelte
    - apps/web/src/routes/(marketing)/for-agents/+page.svelte
    - apps/web/src/routes/(marketing)/for-investors/+page.svelte
    - apps/web/src/routes/(marketing)/for-renters/+page.svelte
    - scripts/assert-budget.mjs
    - scripts/assert-budget.test.ts
    - scripts/launch-audit.mjs
    - scripts/launch-audit.test.ts
decisions:
  - "Lever 1 as written (three exports in one audiences.ts) saved only about 20 B: the bundler cannot split one module across chunks. Each audience literal moved to its own module, re-exported from audiences.ts (the plan's import shape `{ renterAudience } from '$lib/content/audiences'` is kept, and the re-export is tree-shaken per page)"
  - "Lever 2 through forms.ts re-exports saved nothing: `FORMS_COPY = Object.freeze({...})` is a top-level call the bundler keeps, so any importer of forms.ts pulls both copies. The forms and the feedback page import $lib/content/forms-waitlist or forms-feedback directly; FORMS_COPY stays exported for other consumers"
  - "REPORT_ONLY_NOTES is now an empty exported array; the oversize-report path is tested with legal/ REPORT rows (the landing is in PERF_ROUTES and fails Performance on its own when over, so it cannot be the oversize fixture)"
  - "The configured-build table in the audit now covers every HARD row (tools, audience, feedback); its heading reads 'gated tool, audience and feedback pages'"
metrics:
  duration: 22min
  completed: 2026-11-05
  tasks: 2
  files: 18
---

# Phase 14 Plan 12: Marketing content split and HARD budget gate Summary

Each `/for-*/` page now ships only its own audience copy and only the waitlist copy, and `/feedback/` only the feedback copy. That brings all four marketing routes under 61,440 B gz in both builds, and `/feedback/` plus the three `/for-*/` routes are now a HARD gate in `assert-budget.mjs` and in the launch audit's Performance table.

## Tasks

| Task | Name | Commit |
|------|------|--------|
| 1 | Measure, lever 1 (per-audience content), lever 2 (per-form copy) | 4a5ef67 |
| 2 | HARD gate for feedback + for-* in assert-budget and the launch audit (TDD) | 89e1e94 |

## Measure -> lever -> measure (initial JS, gzip -9, `initialJs()`)

Budget: 61,440 B. All rows were measured on fresh builds in this plan.

| Route | Build | Baseline (HEAD 96445a3) | Lever 1 as planned (exports in one module) | Lever 1 (own modules) | Lever 2 via forms.ts re-export | **Final** (lever 2 direct imports) | vs budget |
|-------|-------|------|------|------|------|------|------|
| /feedback/ | build | 57,849 | 57,849 | 57,848 | 57,831 | **57,434** | 4,006 under |
| /for-agents/ | build | 62,694 | 62,673 | 61,557 | 61,560 | **61,035** | 405 under |
| /for-investors/ | build | 62,696 | 62,674 | 61,627 | 61,630 | **61,106** | 334 under |
| /for-renters/ | build | 62,698 | 62,675 | 61,625 | 61,628 | **61,103** | 337 under |
| /feedback/ | build-configured (ships) | 58,019 | 58,021 | 58,018 | 58,002 | **57,595** | 3,845 under |
| /for-agents/ | build-configured (ships) | 62,863 | 62,843 | 61,723 | 61,732 | **61,197** | 243 under |
| /for-investors/ | build-configured (ships) | 62,865 | 62,845 | 61,794 | 61,803 | **61,266** | 174 under |
| /for-renters/ | build-configured (ships) | 62,863 | 62,845 | 61,791 | 61,800 | **61,264** | 176 under |

Final table:

| Route | build | build-configured | budget | status |
|-------|-------|------------------|--------|--------|
| /feedback/ | 57,434 | 57,595 | 61,440 | PASS |
| /for-agents/ | 61,035 | 61,197 | 61,440 | PASS |
| /for-investors/ | 61,106 | 61,266 | 61,440 | PASS |
| /for-renters/ | 61,103 | 61,264 | 61,440 | PASS |

Both levers were needed. Lever 1 took about 1,070 B off each `/for-*/`, and lever 2 took about 530 B off each `/for-*/` and about 410 B off `/feedback/`. Headroom on the shipped build is small (174 B on `/for-investors/`), so the HARD gate will catch the next shared-code addition.

Isolation check (string grep over each route's modulepreload set, both builds): `/for-renters/` contains "Find rentals that fit" and "Join the waitlist" only. `/for-agents/` and `/for-investors/` contain their own title and "Join the waitlist" only. `/feedback/` contains "Send more feedback" only. Before the direct imports, chunk `Cs3cEsOx.js` carried both forms' copy and was preloaded by both page types.

`BUDGET_BYTES = 60 * 1024` is unchanged (grep count 1). The form is not lazy-rendered (UI-SPEC rule 5).

## Gate diff

- `scripts/assert-budget.mjs`: `HARD = [tools/, tools/<slug>/, for-*/, feedback/]`, `REPORT = [index.html, legal/*]`. The header comment says the audience and feedback pages are gated (Phase 14 DEBT-09).
- `scripts/launch-audit.mjs`: `PERF_ROUTES` appends `feedback/`, `for-agents/`, `for-investors/`, `for-renters/`. Both `REPORT_ONLY_NOTES` entries are deleted (the array stays exported and empty, with an updated doc comment). The Performance prose and the configured-build table heading now name tool, audience and feedback pages.
- `docs/LAUNCH-AUDIT.md` and `docs/audit/budget.txt` are not regenerated here; 14-11 regenerates them at the deployed SHA.

## Verification output

- `pnpm budget:assert`: "Budget assertion passed: 9 gated route(s) within 60 KB, 5 reported, in apps/web/build" and the same line for apps/web/build-configured.
- `vitest run --project scripts` (no deploy env): 36 files, 1070 tests passed. The two target files: 44 passed.
- RED before the gate flip: assert-budget 3 failed / 10 passed. launch-audit 2 failed / 29 passed.
- `pnpm check` (root, all packages): apps/web reports 3266 files, 0 errors, 0 warnings. `pnpm banned`: passed (453 files). `pnpm ui:guard`: passed (81 files). eslint on the touched files: clean. Prettier check: clean.
- `vitest run --project web apps/web/src/lib/content apps/web/src/lib/components/forms`: 5 files, 48 tests passed.
- Playwright `marketing.spec.ts seo.spec.ts --project root --project sub`: 150 passed (42.2s).
- Playwright `feedback.configured.spec.ts waitlist.configured.spec.ts --project configured`: 35 passed (18.8s).
- Playwright `feedback.spec.ts waitlist.spec.ts --project root --project sub`: 24 passed (11.0s).
- Acceptance greps: `audiences.` in each for-* page = 0, and each page imports exactly one `*Audience`. `export const HARD` contains `for-` and `feedback`, and REPORT contains neither. `for-renters/index.html` in launch-audit.mjs = 1. `match: /^feedback` = 0.

## Mutation ledger

| # | Mutation | Result | Restored -> |
|---|----------|--------|-------------|
| a | Move `/^for-[^/]+\/index\.html$/` from HARD back to REPORT in assert-budget.mjs | assert-budget.test.ts: "an audience page over 60 KB is a HARD FAIL" failed (`expected [] to have a length of 1`) and "a custom limit is honoured" failed (missing `for-renters/index.html`) | 13/13 green |
| a' | Delete the for-* regex outright (not in either list) | 3 failed: the HARD FAIL test, the skipped-routes list, the custom limit | 13/13 green |
| b | Re-add `import { Button } from '$lib/components/ui/button/index.js'` and one `<Button>` in WaitlistForm.svelte, then `build:configured` | `node scripts/assert-budget.mjs apps/web/build-configured --require-tools` exit 1: "Budget assertion failed (3)", naming for-agents, for-investors and for-renters at 81.5 KB gz each | `git checkout`, rebuild: "Budget assertion passed: 9 gated route(s)", exit 0 |

All mutations were applied to the working tree only and restored with `git checkout`. The configured build was rebuilt on the clean tree afterwards.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Lever had no effect] Per-audience exports in one module do not split the chunk**
- **Found during:** Task 1, lever 1
- **Issue:** With the three exports in one `audiences.ts`, `/for-*/` dropped by only about 20 B. The bundler assigns a whole module to the chunk shared by every entry that imports any of it, so all three audiences still shipped on every page.
- **Fix:** Moved each literal (bodies unchanged, de-indented one tab) into `audience-renter.ts`, `audience-investor.ts` and `audience-agent.ts`. `audiences.ts` keeps the types, re-exports the three, and still builds `audiences`. The pages keep the planned import (`{ renterAudience } from '$lib/content/audiences'`). D-15 note: `git diff -w` shows only the moved surrounding lines, and the body lines differ by indentation only.
- **Commit:** 4a5ef67

**2. [Rule 1 - Lever had no effect] FORMS_COPY's Object.freeze keeps both copies on every importer**
- **Found during:** Task 1, lever 2
- **Issue:** With `WAITLIST_COPY` and `FEEDBACK_COPY` split into their own modules but imported through `forms.ts`, the bytes did not move, and one chunk still carried both copies. `FORMS_COPY = Object.freeze({ waitlist, feedback })` is a top-level call the bundler keeps, so it holds on to both modules.
- **Fix:** The four consumers import `$lib/content/forms-waitlist` or `$lib/content/forms-feedback` directly. A comment in forms.ts explains why. `FORMS_COPY` stays exported and unchanged in shape.
- **Commit:** 4a5ef67

**3. [Rule 1 - Test premise] Oversize-report fixture cannot use the landing**
- **Found during:** Task 2
- **Issue:** The plan offered `index.html` as the REPORT fixture. But `index.html` is a PERF_ROUTES row whose status needs `jsGz <= BUDGET_BYTES`, so an over-budget landing fails Performance, and the test asserts PASS.
- **Fix:** The fixture uses `legal/privacy/` (build) and `legal/terms/` (configured) REPORT rows. Since REPORT_ONLY_NOTES is empty, the test asserts the generic "Not yet analysed." cause and the non-empty default fix.
- **Commit:** 89e1e94

## Known Stubs

None.

## Deferred Issues

None. `docs/LAUNCH-AUDIT.md` and `docs/audit/budget.txt` regenerate in 14-11 at the deployed SHA, as the plan specifies.

## Self-Check: PASSED
