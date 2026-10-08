---
phase: 09-agent-content-studio-market-snapshot-reports
plan: 23
subsystem: phase-gate
tags: [studio, snapshot, e2e, axe, keyless, banned-terms, verify, phase-gate]
requires:
  - phase: 09-07
    provides: "STUDIO_SCOPE banned-terms gate"
  - phase: 09-15
    provides: "listing studio"
  - phase: 09-17
    provides: "snapshot builder"
  - phase: 09-18
    provides: "snapshot print route"
  - phase: 09-20
    provides: "social post pack studio"
  - phase: 09-22
    provides: "reel script studio"
provides:
  - "apps/web/tests/e2e/studio-keyless.spec.ts: STUDIO_ROUTES + sample printout keyless/no-network/axe matrix, generators, hub states, saved-record print options, brand fallback, saved-record logo path"
  - "scripts/banned-terms.test.ts: 'real scope includes studio UI files'"
  - "GenerationPanel read-only `running` bindable; sections mode renders no cards row before the first run"
  - "ReelScriptView `streaming` prop: no parse-failure panel while a run streams"
  - "Snapshot print 'Preparing…' gate also waits for the route stylesheets"
  - "09-VALIDATION.md complete (nyquist_compliant, wave_0_complete), 09-HUMAN-UAT.md, 09-23-VERIFY-PROGRESS.md; STU-01..04 complete"
affects: [phase-9-verification, phase-10]
tech-stack:
  added: []
  patterns:
    - "Route-walk E2E budgets scale with the pages walked (PAGE_LOADS x 4 s + flows)"
    - "Checks that depend on async UI wait for the event they depend on (run started, debounced announcement, chart re-layout) instead of a fixed settle"
key-files:
  created:
    - apps/web/tests/e2e/studio-keyless.spec.ts
    - .planning/phases/09-agent-content-studio-market-snapshot-reports/09-HUMAN-UAT.md
    - .planning/phases/09-agent-content-studio-market-snapshot-reports/09-23-VERIFY-PROGRESS.md
  modified:
    - scripts/banned-terms.test.ts
    - apps/web/tests/e2e/agent-no-rentcast.spec.ts
    - apps/web/src/lib/ai/ui/GenerationPanel.svelte
    - apps/web/src/lib/ai/ui/GenerationPanel.sections.test.ts
    - apps/web/src/lib/features/studio/reel/ReelScriptView.svelte
    - apps/web/src/lib/features/studio/reel/ReelStudio.svelte
    - apps/web/src/lib/features/studio/reel/reel-view.test.ts
    - apps/web/src/routes/(print)/print/snapshot/+page.svelte
    - apps/web/src/lib/features/investor/analyzer/AnalyzerPage.svelte
    - apps/web/src/lib/data/rerender.browser.test.ts
    - apps/web/tests/e2e/investor/sweep.spec.ts
    - apps/web/tests/e2e/renter-map.spec.ts
    - apps/web/tests/e2e/studio-reel.spec.ts
    - .planning/phases/09-agent-content-studio-market-snapshot-reports/09-VALIDATION.md
    - .planning/REQUIREMENTS.md
key-decisions:
  - "09-23: verify was run step by step (one foreground call per package.json step, unit tests per vitest project, Playwright in ~2-5 min spec chunks, --workers=1) because every Node process must be pinned to one core on this machine; results are in 09-23-VERIFY-PROGRESS.md"
  - "09-23: sections mode shows the panel's single empty line until a run starts or a draft is opened (UI-SPEC), so the 09-19 SSR test 'before a run every card shows the empty line' was replaced by 'no cards row before a run' plus 'three gated cards once a run connects'"
  - "09-23: the snapshot print 'Preparing…' gate waits for every stylesheet link, because Save and open print view is a client-side navigation and the report could render before its CSS"
  - "09-23: STU-01..STU-04 ticked complete (no tool was cut); the phase verifier and phase complete were not run"
requirements-completed: [STU-01, STU-02, STU-03, STU-04]
duration: ~7.6 h wall clock (16:01Z to 03:40Z), including three agent stalls and host suspends
completed: 2026-10-07
---

# Phase 9 Plan 23: Phase gate Summary

**Every Studio route and the sample printout now have keyless, no-network, axe-clean E2E proof on both bases. Generators stream sample output with no Must fix finding. Saved snapshots honor their print options, failing brand colors fall back to Tran's, and the saved-record logo decodes before printing. `corepack pnpm verify` is green, run step by step. Five items left to the gate were fixed at the root, and a further six root causes surfaced during verify were also fixed. STU-01 to STU-04 are complete.**

## Performance

- **Duration:** about 7.6 h wall clock on one core (mask 0x100), sole executor. That includes three agent stalls (the watchdog fired on long single calls) and host suspends.
- **Tasks:** 2 of 2, plus the gate items and the verify fixes.
- **Files:** 3 created, 15 modified.

## What was built

- **studio-keyless.spec.ts**, 8 tests on each base:
  - Every route in STUDIO_ROUTES plus `print/snapshot/?id=sample`: status 200, the UI-SPEC h1, axe clean (WCAG tags), and `scrollWidth <= width` at 1280x800 and at 375x812.
  - Hub: the four "No drafts yet" / "No snapshots yet" lines and the incomplete disclosure ("Finish your profile to copy studio content"), axe clean at both widths. After a keyless listing draft the Listing card reads "1 draft saved", again axe clean at both widths.
  - Social and reel generators: sample fill, then run. Both show "Sample output" with no Must fix. A MutationObserver proves the reel view never shows "unparsed" during the stream.
  - Saved-record options: in the builder, EHO, the Tran footer and Market notes are turned off, then saved. In print, "Equal Housing Opportunity." and "Prepared with Tran Real Estate Tools." are absent and the Market notes section is gone. SHORT_LABEL, Prepared by and Data sources are present.
  - Brand fallback: a complete profile with `#FFFF00` / `#000000` prints with `--brand-*-effective` `#A4452A` / `#F6E3D8`, a terracotta title and rule, and a sand band. Primary `#1F4E79` is kept (rgb(31, 78, 121)). The hub shows the ready disclosure and is axe clean.
  - Logo (gate item 4): an SVG logo is uploaded through the profile and a non-sample record with `hasLogo` is seeded. The print view loads a `blob:` logo that is complete and decoded at 200x100 before Print is enabled and focused. It shows zero CSP violations, is visible in print media, and is axe clean.
  - Every test records all requests. Hits on api.rentcast.io, api.anthropic.com, api.openai.com, generativelanguage.googleapis.com and openrouter.ai are 0, and nothing leaves the local origin.
- **banned-terms.test.ts:** `real scope includes studio UI files`. The test checks that features/studio, the studio routes and the snapshot print route are all collected, and that `runCli(REPO_ROOT).status === 0`.

## Gate items 1-6

1. **agent-no-rentcast budget (fixed).** `test.slow()` (90 s) was replaced with `PAGE_LOADS * 4_000 + 40_000`. PAGE_LOADS is `ROUTES.length * 2 + 7` = 21 loads, so the budget is 124 s. No assertion changed. The test now passes in about 1.1 min on root and inside its chunk on sub. Commit `6ddf8f8`.
2. **Reel parse panel flashed while streaming (fixed at the root).** GenerationPanel gains a read-only `running` bindable. ReelStudio passes it to `ReelScriptView streaming`, and `scriptView(draft, length, streaming)` keeps the empty line for partial text that does not parse. Text that does parse still shows its beats.
   - Unit test: streaming vs ended, plus a parseable script mid-stream.
   - E2E observer test: as a mutation check I removed the prop and rebuilt. The E2E then recorded `["empty", "unparsed", "beats"]` and failed. After restoring the prop it passes.
   - Commit `914c2c6`.
3. **Social cards row before the first run (fixed, small).** Sections mode renders the panel's single empty line until `st.hasDraft || st.running`. All three cards render, each with its empty line, once a run starts. The SSR tests were updated to the UI-SPEC behavior. As a mutation check, forcing the old branch fails the new test. studio-social passes 8/8 on root. Commit `8b0ecad`.
4. **Snapshot print logo path (E2E added).** Covered by the logo test above. Commit `0c91fa8`.
5. **HUMAN-UAT owner decisions:** recorded in 09-HUMAN-UAT.md as UAT-6 (6 Letter pages vs condensed print tables), UAT-7 (NY-safe studio titles vs Phase 8 per-state titles) and UAT-8 (two memo block reasons, harmless). The plan's UAT items are there too: UAT-1 real-key print in Chrome, Firefox and Safari; UAT-2 Instagram, Facebook and LinkedIn composers with the 5/2/3 caps; UAT-3 NY 19 NYCRR 175.25 and CA B&P 10140.6; UAT-4 the EHO logo; UAT-5 GBL § 396-b and platform policies.
6. **Deferred with reasons** (09-HUMAN-UAT.md "Deferred"):
   - Card edits are not written back to the stored pack. This needs a SectionSpec serializer and a shared panel change, and the copied text is always the edited one.
   - Draft history does not show the street or area. This needs a DraftHistory row label from meta; 09-20's `rowNote` could carry it.
   - The snapshot "stale" flag is future-proofing only, because the gateway refetches anything past its TTL.
   - Live RentCast data has no placeName, and a lookup would cost an extra call.

## Verify (step by step, single core)

`corepack pnpm verify` was run one step at a time in package.json order, because Node must be pinned to one core on this machine. Unit tests ran per vitest project, and Playwright ran in spec-file chunks with `--workers=1`, foreground, each under about 5 min. The full log is in 09-23-VERIFY-PROGRESS.md.

| Step | Result |
|------|--------|
| check | exit 0 (2615 files, 0 errors, 0 warnings); re-run on the final tree, 52 s |
| lint | exit 0 (245 s); re-run on the final tree, 188 s |
| banned | exit 0 (384 files), on both runs |
| ui:guard | exit 0 (79 files), on both runs |
| test:unit core | 85 files, 2652 passed (62 s) |
| test:unit web | 160 files, 2405 passed (244 s); final re-run 330 s |
| test:unit brand + scripts | 16 files, 534 passed (66 s) |
| test:unit web-browser | first run red (2, see below); final run 32 files, 244 passed (95 s) |
| build:root / build:sub | exit 0 (41 s / 43 s); rebuilt after each app fix (latest 31 s / 34 s) |
| csp:assert | 38 pages per base |
| test:e2e root | 857 passed, 0 failed, 0 skipped |
| test:e2e sub | 853 passed, 0 failed, 0 skipped (framing.spec is root-only by config) |
| guard | 1593 files |
| fixtures:check | 6 files match |
| secrets:canary | detected as expected |
| secrets:scan | 971 commits, no leaks |
| lint:workflows | exit 0 |

**Flakes found during verify, each fixed at the root (no assertion loosened, no skip, no lint disable):**
- **rerender.browser** (Phase 4): the test asserted async spends after a fixed 100 ms settle. It now polls the same assertions. Commit `6921b51`.
- **OutreachSection.browser**, "Failed to fetch dynamically imported module": seen once and not reproducible. It passed alone, paired, and in three later full runs, and the deps cache was not re-optimized. The run coincided with host suspends (Chrome logged `net::ERR_NETWORK_IO_SUSPENDED` elsewhere in this session). Recorded as a host-suspend transient.
- **Snapshot print after Save (product bug):** the trace shows the route CSS still loading 450 ms after Print was enabled. The Preparing gate now also waits for the stylesheets. Commit `ff09866`.
- **investor/sweep 375px** (Phase 7): LayerChart gridlines were still sized for 1280 px for one frame after the resize. The test now polls the same no-overflow check. Commit `e3c78bb`.
- **Analyzer "Save as a new deal" (product race):** the URL showed `?id=` while the save was still running, so `save()` silently ignored the click. The button now carries `aria-disabled` while saving. Commit `e3c78bb`.
- **renter-map co-located** (Phase 6): the debounced filter announcement replaced the spot announcement. The spec now waits for the filter announcement first. Commit `f814ce7`.
- **studio-reel writeScript** (09-22): on "Generate again", the previous run's "Draft ready." satisfied the wait before the new run had started. The helper now waits for the panel's aria-busy first. Commit `f814ce7`.
- **studio-keyless sub**, ERR_NETWORK_IO_SUSPENDED and a 14.7 min "timeout" on a 240 s test: a host suspend, not the code. The three affected tests were re-run green.

**Dependency check:** `git log --format=%H --grep='(09-' --reverse | head -1` gives `bbaf0fd` (the first Phase 9 commit); its parent is `1941910`. `git diff 1941910 -- apps/web/package.json packages/core/package.json packages/brand/package.json package.json` is empty, and `pnpm-lock.yaml` is unchanged. **No packages added.**

## Task Commits

- `6ddf8f8` test(09-23): scale the agent no-RentCast walk budget by the pages it walks
- `914c2c6` fix(09-23): reel beat view shows a parse failure only once the run has ended
- `8b0ecad` fix(09-23): social cards row is not rendered before the first run
- `0c91fa8` test(09-23): cross-route keyless, print options, brand fallback and axe proof (Task 1)
- `6903710` docs(09-23): interim validation map, human UAT and verify progress
- `6921b51` fix(09-23): rerender non-vacuity test polls for the mutant's async spends
- `ff09866` fix(09-23): snapshot print waits for the route stylesheet before enabling print
- `e3c78bb` fix(09-23): analyzer marks Save as a new deal busy while a save finishes; sweep waits for chart re-layout
- `f814ce7` test(09-23): wait for the run or announcement the next check depends on
- `babef2b` docs(09-23): phase 9 validation map, human UAT and requirement status (Task 2)

All commits used an explicit pathspec, with one exception: `914c2c6` committed a hand-staged index (only the `running` hunks of GenerationPanel.svelte) without a pathspec, because `git commit -- <path>` would have taken the whole working file.

## Deviations from Plan

### Auto-fixed Issues

1. **[Rule 1] Reel parse panel flash.** Gate item 2. Touched GenerationPanel.svelte and ReelStudio.svelte, both outside files_modified.
2. **[Rule 1] Cards row rendered before the first run.** Gate item 3. Touched GenerationPanel.svelte and its sections test.
3. **[Rule 1] Snapshot print enabled before its CSS loaded.** Touched the print route, outside files_modified.
4. **[Rule 1] Analyzer "Save as a new deal" ignored clicks while saving with no busy state.** Touched AnalyzerPage.svelte (Phase 7).
5. **[Rule 3] Load-sensitive test races** in rerender.browser, investor/sweep, renter-map, studio-reel and agent-no-rentcast, needed for a green verify. Each now waits for the event it depends on.
6. **[Interpretation] verify ran per step, not as one `pnpm verify`.** This was required by the machine constraint. Unit tests were split by vitest project. check, lint and unit were re-run after the late fixes.

## Requirements

STU-01, STU-02, STU-03 and STU-04 are marked complete in REQUIREMENTS.md, both the checkboxes and the traceability table, as this plan's Task 2 directs. No tool was cut. The phase verifier and `phase complete` were not run.

## Known Stubs

None. The deferred items above are recorded, with reasons, in 09-HUMAN-UAT.md.

## Self-Check: PASSED
