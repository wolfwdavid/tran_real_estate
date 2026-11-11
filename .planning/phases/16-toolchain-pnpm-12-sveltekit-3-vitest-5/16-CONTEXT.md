# Phase 16: Toolchain: pnpm 12 → SvelteKit 3 → Vitest 5 - Context

**Gathered:** 2026-11-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Move the platform to current, supported majors: pnpm 12, SvelteKit 3.1 + adapter-static 4, Vitest 5
with `@vitest/browser-playwright` 5 and `vitest-browser-svelte` 3. One tool per plan, in that order,
each gated by the full `pnpm verify` chain and `pnpm smoke:local`; the phase closes with a deploy and
a green live smoke. Requirements: TOOL-01..06.

This discussion added one thing in front of the migration: a pre-flight plan (16-00) that makes the
live smoke green again and closes the guard holes the migration could slip through. No new product
capability is in scope.

</domain>

<decisions>
## Implementation Decisions

### Carried forward (locked earlier, not re-asked)
- **D-01:** Order is pnpm 12 → Kit 3 → Vitest 5, one plan each, no parallel plans, never two majors in
  one commit (`.planning/research/SUMMARY.md`, "Where the four files disagree (resolved)").
- **D-02:** No plan from any other phase executes while Phase 16 is in flight; Phase 17 is serialized
  against it (ROADMAP). Check for other live sessions on the repo before execution.
- **D-03:** The smoke keeps `retries: 0`; a flake or a red run is root-caused, never hidden with a
  retry, a raised timeout or a `toPass` loop (Phase 15 guards, `tasks/lessons.md`).
- **D-04:** A page over the 60 KB gzipped JS budget after the Rolldown change is trimmed; the budget
  is not raised (owner decision 2026-10-29).
- **D-05:** Blame-clean diffs outside the codemod's own task groups (14-CONTEXT D-15). Commits carry
  no co-author trailer in this repo (commit-msg hygiene hook).

### Pre-flight debts (discussed 2026-11-10)
- **D-06:** The live-smoke HTTP 429 fix lands as the FIRST plan of Phase 16 (16-00), before pnpm 12.
  No decimal Phase 15.1, and it does not wait for Phase 17.
- **D-07:** The 429 fix does two things:
  1. Relabel, as defined in `15-.../deferred-items.md`: a 429 on any smoke navigation exits 2
     (precondition, "CDN rate-limited, re-dispatch once"), any other status keeps exit 1, and a
     scripts-project unit test plants a 429 and asserts exit 2.
  2. Pace: find out why the live run trips the Pages limit (observed 2026-11-11: specs 1-108 pass,
     then every navigation answers 429) and pace the live target so a run goes green on its own
     (fewer workers or spaced navigations, live target only; the local emulator runs stay as fast as
     today). Zero retries added.
- **D-08:** From `15-REVIEW.md`, plan 16-00 fixes CR-01 (a timeout of `0` disables the timeout and
  passes every rule) and the warnings a Kit 3 / Vitest 5 migration could slip through: at minimum
  WR-02 (timeouts and retries passed by reference or shorthand), WR-03 (timeout-raising APIs outside
  the rule set) and WR-04 (`tooling/vitest/lanes.ts` and runner CLI flags outside the sweep). The
  planner judges the remaining warnings against the same test ("could a migration commit use this to
  go green?") and leaves the rest recorded, unfixed. Each guard fix is mutation-tested: plant the
  bypass, see the rule fail.
- **D-09:** Hard baseline gate. Plan 16-01 (pnpm 12) may not start until, at the pre-flight commit on
  the current toolchain (Kit 2 / Vitest 4), `pnpm verify` is green and one `live-smoke` run is green,
  with the run link recorded in the 16-00 summary. A later red then has the migration as its only
  candidate cause.

### Corrections to the roadmap text (facts, not choices)
- **D-10:** Success criterion 3 names `https://tranrealestate.github.io/`. The live origin is
  `https://wolfwdavid.github.io/tran_real_estate/` (sub-path project site, owner decision
  2026-10-29). The service-worker proof is against that origin, so registration scope and the precache
  list are under `/tran_real_estate/`. Fix the wording in ROADMAP when the phase is planned.
- **D-11:** Recorded audit exceptions are five today, not four: `GHSA-g3hv-75wg-m249` (minimatch, dev
  toolchain, revisit 2026-11-30) was added in `f169749` after the roadmap was written. Kit 3 clears
  the three Kit-related ones; deepmerge stays. See discretion item below for the target.

### Claude's Discretion
The owner chose not to discuss these three areas. Each has a stated default; research and planning may
change it with a recorded reason, and anything that needs the owner (a push, a revert on the live
site) is still asked at the time.

- **Landing and deploy cadence.** Default: work on `main`, push after each plan once its local gates
  are green, so each plan gets its own deploy and live-smoke run (the Kit 3 service-worker change is
  only observable live, and a red run then points at one plan). Pushes stay owner-approved as in
  15-11. A red live smoke caused by the migration: roll back per `docs/RUNBOOK.md` (revert and push),
  then fix and re-land; a 429-only run exits 2 and is re-dispatched once.
- **Audit target and bumps.** Default: the three Kit 2 exceptions are removed in the Kit 3 plan from
  both `scripts/lib/audit-exceptions.mjs` and `pnpm-workspace.yaml`; deepmerge stays to 2027-01-31;
  minimatch is removed only if the ESLint family accepts minimatch ≥ 11.0.1 by then, otherwise it
  stays with a refreshed revisit date and TOOL-05 / criterion 5 are reworded to the honest count.
  Routine bumps (Playwright, axe, bits-ui, layerchart, shadcn CLI, wxt, ESLint family) are one final
  plan after Vitest 5, not mixed into the three major plans. Dependabot PRs #9 and #10 are not merged
  while the phase is in flight and are closed or superseded by that final plan; the Kit-major ignore
  in `.github/dependabot.yml` is revisited after Kit 3 lands. `@types/node` stays `^24` while
  `engines.node` is `>=24 <25`.
- **Proof after Vitest 5.** Default: the Phase 15 evidence protocol is re-run once on Vitest 5 and a
  new dated file is committed under `docs/test-evidence/` (the current file was measured on Vitest 4
  and `scripts/test-evidence.test.ts` pins the newest file). The `groupOrder` single-invocation lane
  experiment is time-boxed; keep the two-invocation lanes if per-project `maxWorkers` does not hold.
- Exact patch versions (research named pnpm 12.16.1, Kit 3.1.0, Vitest 5.0.5 on 2026-10-29): the
  researcher re-checks the latest stable patches and pins exact versions.
- Whether 16-00 is one plan or two (smoke 429 work and guard fixes touch disjoint files).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and requirements
- `.planning/ROADMAP.md` §"Phase 16" — goal, five success criteria, the research flag list (eight
  open questions for `/gsd-plan-phase` research), serialization against Phase 17
- `.planning/REQUIREMENTS.md` — TOOL-01..06
- `.planning/PROJECT.md` — Key Decisions (hosting on the personal account, budget trim, Kit 3 in v1.1)

### Migration research
- `.planning/research/SUMMARY.md` §"Where the four files disagree (resolved)", §"Phase 16", §"Gaps to
  Address" — settled order, per-plan deliverables, unverified assumptions
- `.planning/research/PITFALLS.md` Pitfalls 12 (Kit 3 codemod gaps in this repo), 13 (Vitest 5
  semantics), 14 (pnpm 12 and the supply-chain test), 17 (nothing else in flight)
- `.planning/research/STACK.md` — target versions and companions

### Pre-flight (plan 16-00)
- `.planning/phases/15-load-deterministic-test-lanes/deferred-items.md` §"D-10" — the 429 definition
  of done
- `.planning/phases/15-load-deterministic-test-lanes/15-REVIEW.md` — CR-01, WR-01..09
- `tasks/lessons.md` §"2026-10-31" — the 429 rule (rate-limit, re-dispatch once)
- `.planning/phases/14-carried-debt/14-CONTEXT.md` D-10, D-11, D-15 — where the 429 item and the
  `@types/node` hold came from; blame-clean rule

### Gates and operations
- `docs/RUNBOOK.md` — redeploy, rollback, reading a smoke result, known-good worker counts
- `docs/test-evidence/2026-11-10.md` — the Vitest 4 determinism evidence and its protocol
- `docs/LAUNCH-AUDIT.md` — regenerated at the deployed commit when the phase closes

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/smoke.mjs` + `apps/web/playwright.smoke.config.ts` + `apps/web/tests/smoke/*.smoke.ts`:
  the smoke harness with exit codes 0/1/2/3/4; exit 2 is the existing precondition path the 429
  relabel uses. Config today: `retries: 0`, `fullyParallel: true`, `workers: CI ? 2 : 4`.
- `scripts/lib/test-lane-rules.mjs` and `tooling/vitest/lanes.ts`: the Phase 15 guard rules and lane
  definitions that D-08 hardens.
- `scripts/lib/audit-exceptions.mjs` + `pnpm-workspace.yaml` `audit.ignore`: must stay equal
  (`scripts/supply-chain.test.ts` enforces it).
- `.github/workflows/live-smoke.yml`: runs on `workflow_run` after `ci` on `main`, plus
  `workflow_dispatch` for a re-dispatch.

### Established Patterns
- Build dirs go stale on every commit (build stamp = commit SHA): rebuild all three targets before
  any E2E or smoke run, or measure on a checkout of the built SHA.
- Concurrency and guard fixes are mutation-tested; a green suite alone is not accepted as proof.
- Three build targets (root, sub, configured) each pass `csp:assert`, `seo:assert`, `budget:assert`.

### Integration Points
- Current pins: `packageManager: pnpm@11.27.0` (also hardcoded in `scripts/build-web.mjs` and
  `scripts/launch-audit.test.ts`), `@sveltejs/kit` 2.70.3, `@sveltejs/adapter-static` 3.0.10,
  `vitest` 4.1.12 (root, `apps/web`, `apps/extension`), `vitest-browser-svelte` 2.2.1, `wxt` 0.21.4.
- `apps/web/svelte.config.js`: `kit.version.name` (build stamp) and
  `kit.serviceWorker.files` (dotfile filter) both move under Kit 3; `apps/web/src/service-worker.ts`
  is rewritten on `$app/manifest`.
- `$lib` → `#lib` touches `eslint.config.js`, `apps/web/components.json`, `tooling/import-graph.ts`,
  the Vitest alias blocks and the boundary tests.
- About 198 `render(` call sites in `apps/web/src` test files need `await` under Vitest 5.
- Live-smoke history: green at `449ecc5` (2026-11-06), red on 429 at `23c7aae` and `11b58f9`
  (2026-11-10/11), skipped at `7217d4d`.

</code_context>

<specifics>
## Specific Ideas

- The owner wants live-smoke runs that go green on their own, not runs that need a lucky re-dispatch:
  pacing is part of the fix, the relabel alone is not enough.
- "Any later red has the migration as its only candidate cause" is the reason for the hard baseline.

</specifics>

<deferred>
## Deferred Ideas

- The `15-REVIEW.md` warnings and info items that 16-00 does not fix stay recorded there for a later
  quick task.
- A Node major move (and `@types/node` 26) is its own decision, not part of this phase.
- App-level recovery from a failed lazy chunk load (`15-.../deferred-items.md`, 15-01 root cause) is a
  product decision for a later phase.

</deferred>

---

*Phase: 16-Toolchain: pnpm 12 → SvelteKit 3 → Vitest 5*
*Context gathered: 2026-11-10*
