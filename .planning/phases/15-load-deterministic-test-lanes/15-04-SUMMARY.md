---
phase: 15-load-deterministic-test-lanes
plan: 04
subsystem: testing
tags: [playwright, timeouts, annotation, test-02, e2e, extension, constant-hoisting]

# Dependency graph
requires:
  - phase: 15-load-deterministic-test-lanes
    provides: 15-02 rules module (playwrightTimeoutFindings, MEASURED, CAUSE) that defines what counts as annotated; 15-03 extension E2E durations table
  - phase: 14-launch-hardening
    provides: apps/web/test-results/e2e-report.json (449ecc5, 4 workers, 2026-11-06), the per-test durations every web annotation cites
provides:
  - Partition A of the Playwright TEST-02 annotation: every raised timeout and test.slow() in studio-*, snapshot-*, agent-* specs and apps/extension/e2e carries a measured duration and a root cause
  - Hoisted annotated constants for repeated raises: AI_FLOW_MS (keyless), RUN_WAIT_MS / SINGLE_RUN_MS / MULTI_RUN_MS (reel), PACK_FLOW_MS / LONG_PACK_MS (social)
  - Evidence files under .tools/test-evidence/ (gitignored): e2e-report-449ecc5.json snapshot, e2e-durations.tsv, 15-04-findings.txt, 15-04-values-before/after.txt, --list and lint logs
affects: [15-05, 15-09, test-lanes sweep]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Playwright raise annotation: '// Timeout: measured <n> s for \"<title>\" (<project>, 4 workers, e2e-report 449ecc5, 2026-11-06).' then '// Cause: <concrete slow work>. <value> s keeps a <ratio>x margin.' directly above the statement, the option property, or the hoisted const"
    - "test.slow() annotation: '// Timeout: test.slow() (3x = 90 s); measured <n> s for ...' and, when a test.setTimeout follows, say the slow() is superseded rather than pretend it governs"
    - "Hoisting (Pattern 4): a value repeated >= 2 times in one file becomes one UPPER_SNAKE _MS const with the annotation above it; the cited duration is the max over every test that uses it"

key-files:
  created: []
  modified:
    - apps/web/tests/e2e/studio-keyless.spec.ts
    - apps/web/tests/e2e/studio-reel.spec.ts
    - apps/web/tests/e2e/studio-social.spec.ts
    - apps/web/tests/e2e/studio-listing.spec.ts
    - apps/web/tests/e2e/studio-shell.spec.ts
    - apps/web/tests/e2e/snapshot-builder.spec.ts
    - apps/web/tests/e2e/snapshot-print.spec.ts
    - apps/web/tests/e2e/agent-share-link.spec.ts
    - apps/web/tests/e2e/agent-no-rentcast.spec.ts
    - apps/web/tests/e2e/agent-followup.spec.ts
    - apps/web/tests/e2e/agent-live-key.spec.ts
    - apps/extension/e2e/extension.spec.ts

key-decisions:
  - "Cite the governing test's total duration, not a guessed per-wait number: for helper waits (expectSampleRun, writeScript, writePack, writeDraft, draftNotes, draftNow, expectChartsDrawn) the comment names the slowest caller and says the margin is over the whole test"
  - "studio-reel hoists three constants (30 s wait x3, 120 s x2, 240 s x2) and studio-social two (240 s x3, 300 s x2); studio-keyless has five 240 s raises, not the six the plan and research counted, so AI_FLOW_MS replaces five literals"
  - "The extension's 15 s service-worker wait lives in a beforeAll helper with no per-test duration, so it cites the 15-03 whole-suite measurement (3.6 s including the launch) as the bound"

patterns-established:
  - "Where test.slow() is immediately followed by test.setTimeout, one comment above test.slow() states that it is superseded; the setTimeout is covered by its own comment or by the hoisted const's annotation"
  - "Values-unchanged proof: grep -oE '\\b[0-9]{1,3}_000\\b' | sort -u per file before and after, diffed; a hoisted const keeps the literal in the set"

requirements-completed: [TEST-02]

# Metrics
duration: 13min
completed: 2026-11-09
---

# Phase 15 Plan 04: Annotate raised Playwright timeouts, partition A Summary

**All 47 unannotated Playwright raises in the studio/snapshot/agent E2E specs and the extension spec now carry a measured duration from the 449ecc5 launch-audit report (or the 15-03 extension run) and a concrete root cause, with 17 repeated literals hoisted into six annotated constants and no timeout value changed.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-11-09T07:46:38Z
- **Completed:** 2026-11-09T07:59:29Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments

- `playwrightTimeoutFindings` returns `[]` for every partition-A file (25 files under the partition regex, 12 of which had findings). The plan's verify one-liner prints `0` and exits 0.
- Every cited number comes from `.tools/test-evidence/e2e-report-449ecc5.json` (a copy of `apps/web/test-results/e2e-report.json`; `config.metadata.actualWorkers` = 4, `stats.startTime` 2026-11-06T21:04:48Z, 2,338 expected / 0 unexpected / 0 flaky / 16 skipped) or, for the extension spec, from 15-03-SUMMARY's measured table. No number was invented; where a wait has no test of its own (the extension `beforeAll` launch) the comment says so and cites the whole-suite bound.
- Values unchanged: 12/12 edited files (and 25/25 partition files) have an identical set of distinct `N_000` literals before and after.
- Hoisting: `studio-keyless.spec.ts` five `test.setTimeout(240_000)` -> `AI_FLOW_MS`; `studio-reel.spec.ts` three `{ timeout: 30_000 }` -> `RUN_WAIT_MS`, two `120_000` -> `SINGLE_RUN_MS`, two `240_000` -> `MULTI_RUN_MS`; `studio-social.spec.ts` three `240_000` -> `PACK_FLOW_MS`, two `300_000` -> `LONG_PACK_MS`. Every other raise is used once and stays a literal with the comment above its statement.
- `playwright test --list` exits 0 for web (2354 tests in 88 files) and extension (7 tests in 1 file); repo-wide `pnpm lint` (prettier + eslint) exits 0.

## Task Commits

1. **Task 1: Snapshot the report, list partition-A findings and durations** - no commit (working files under the gitignored `.tools/test-evidence/`)
2. **Task 2: Annotate partition A** - three commits, grouped by spec family:
   - `caba682` (test) studio-keyless, studio-reel, studio-social, studio-listing, studio-shell
   - `b9050d3` (test) snapshot-builder, snapshot-print, agent-share-link, agent-no-rentcast, agent-followup, agent-live-key
   - `1a7c8c4` (test) apps/extension/e2e/extension.spec.ts

## Findings before

`.tools/test-evidence/15-04-findings.txt`: 47 findings (48 lines; one `expect.poll` detail wraps) across 12 files, every path inside the partition regex. The file set equals the plan's `files_modified` list exactly: no file added, none dropped.

| File | Findings | What |
|---|---|---|
| apps/extension/e2e/extension.spec.ts | 1 | `waitForEvent` timeout 15 s (line 71) |
| apps/web/tests/e2e/agent-followup.spec.ts | 2 | expect 20 s (80), setTimeout 120 s (274) |
| apps/web/tests/e2e/agent-live-key.spec.ts | 1 | describe.configure 120 s (11) |
| apps/web/tests/e2e/agent-no-rentcast.spec.ts | 2 | setTimeout non-literal (72), expect 20 s (117) |
| apps/web/tests/e2e/agent-share-link.spec.ts | 2 | test.slow() (245, 263) |
| apps/web/tests/e2e/snapshot-builder.spec.ts | 5 | expect 60 s (117), test.slow() x4 (132, 242, 274, 326) |
| apps/web/tests/e2e/snapshot-print.spec.ts | 4 | expect.poll 15 s (138), test.slow() x3 (176, 243, 350) |
| apps/web/tests/e2e/studio-keyless.spec.ts | 8 | expect 60 s (114), setTimeout non-literal (232), 240 s x5 (246, 288, 307, 344, 456), 300 s (367) |
| apps/web/tests/e2e/studio-listing.spec.ts | 4 | expect 30 s (82), setTimeout 180 s (146), test.slow() (231), setTimeout 240 s (232) |
| apps/web/tests/e2e/studio-reel.spec.ts | 8 | expect 30 s x3 (97, 98, 101), setTimeout 240 s (154), 120 s x2 (250, 268), test.slow() (319), 240 s (320) |
| apps/web/tests/e2e/studio-shell.spec.ts | 2 | test.slow() (183, 203) |
| apps/web/tests/e2e/studio-social.spec.ts | 8 | expect `{ timeout }` shorthand (116), setTimeout 240 s x3 (186, 302, 342), 300 s x2 (263, 381), expect 30 s (351), test.slow() (380) |

The 13 partition files without findings (agent-a11y, agent-contact, agent-contacts, agent-csv, agent-entry, agent-import, agent-inquire, agent-pipeline, agent-profile-brand, agent-profile, agent-shell, agent-today, apps/extension/e2e/zillow-page.ts) were not touched.

## Annotations (file, original line, value, cited duration, cause)

Durations are the max across the `root` and `sub` projects in the 449ecc5 report unless stated. Line numbers are the pre-edit positions from the findings file.

**studio-keyless.spec.ts**

| Line | Site | Value | Cited | Cause (short) |
|---|---|---|---|---|
| new const | `AI_FLOW_MS` | 240_000 | 9.1 s, "reel: the sample beats stream a Sample output script; the parse failure never flashes" (root); others 7.4 / 5.0 / 2.1 / 2.0 s | streamed keyless draft or builder save + print render, axe at two viewports; 26x |
| 114 | `expectSampleRun` toBeVisible | 60_000 | 9.1 s, same test (slowest caller) | Fixture streams the draft word by word; 6x over the whole test |
| 232 | `test.setTimeout(PAGES.length * 20_000)` | 6 x 20 s = 120 s | 11.5 s, "every Studio page at 1280px > STUDIO_ROUTES and the sample printout..." (sub) | 6 pages each loaded, hydrated and axe-scanned; 10x |
| 246, 288, 307, 344, 456 | `test.setTimeout` | 240_000 -> `AI_FLOW_MS` | (const) | (const) |
| 367 | `test.setTimeout` | 300_000 | 4.8 s, "brand colors that fail contrast never reach the printout; a passing primary is kept" (sub) | two profile saves, hub axe, two builder saves rendering the print sheet; 62x |

**studio-reel.spec.ts**

| Line | Site | Value | Cited | Cause (short) |
|---|---|---|---|---|
| new const | `RUN_WAIT_MS` | 30_000 | 27.4 s, "sample beats: timed table and cards, the placeholder rule, the copied script and the checklist" (root), which runs three scripts; one-script tests 9.7 / 9.1 s | Fixture streams each script word by word; provider resolved before aria-busy flips; each wait bounds one run, 3x over a whole one-script test |
| new const | `SINGLE_RUN_MS` | 120_000 | 9.7 s, "the Studio hub counts the reel draft under studio-reel"; own-beats 9.1 s | one streamed script plus hub navigation or profile-gate edits; 12x |
| new const | `MULTI_RUN_MS` | 240_000 | 27.4 s, same sample-beats test | three streamed scripts with edits, clipboard reads and a reload; axe tests stream two; 8x |
| 97, 98, 101 | `writeScript` expect options | 30_000 -> `RUN_WAIT_MS` | (const) | (const) |
| 154, 320 | `test.setTimeout` | 240_000 -> `MULTI_RUN_MS` | (const) | (const) |
| 250, 268 | `test.setTimeout` | 120_000 -> `SINGLE_RUN_MS` | (const) | (const) |
| 319 | `test.slow()` | 3x = 90 s, superseded by the 240 s below | 20.8 s, "axe at 1280px > filled results, empty results (placeholder), the beat view and the checklist are axe-clean" (sub) | two streamed scripts with an axe pass and scroll check after each |

**studio-social.spec.ts**

| Line | Site | Value | Cited | Cause (short) |
|---|---|---|---|---|
| new const | `PACK_FLOW_MS` | 240_000 | 6.0 s, "the sample brief writes three checked posts, each ending with the disclosure" (root); others 1.9 / 4.0 s | one streamed pack (Fixture or mocked Anthropic SSE), card edits, clipboard, hub navigation; 40x |
| new const | `LONG_PACK_MS` | 300_000 | 48.6 s, "an Instagram post over 2,200 characters cannot be copied; Facebook still can" (sub), slowest test in the report | the 1,990-char brief streams a pack whose Instagram post passes 2,200 chars; its writePack waits 180 s; 6x |
| 116 | `writePack` toBeVisible `{ timeout }` (shorthand, non-literal) | parameter default 30_000; 180_000 from one caller | 48.6 s, same Instagram test (the 180 s caller); 30 s-default callers at most 6.0 s | Fixture streams the whole pack; the wait grows with the brief |
| 186, 302, 342 | `test.setTimeout` | 240_000 -> `PACK_FLOW_MS` | (const) | (const) |
| 263, 381 | `test.setTimeout` | 300_000 -> `LONG_PACK_MS` | (const) | (const) |
| 351 | listing toBeVisible | 30_000 | 4.0 s, "a listing description can start the brief, without its disclosure" (sub) | Fixture streams the listing description; 7x over the whole test |
| 380 | `test.slow()` | 3x = 90 s, superseded by the 300 s below | 4.5 s, "axe at 1280px > before a run, and after a run with one card over the limit and one parse error" (sub) | mocked Anthropic pack with an over-limit post and a missing section, axe at three states |

**studio-listing.spec.ts**

| Line | Site | Value | Cited | Cause (short) |
|---|---|---|---|---|
| 82 | `writeDraft` toBeVisible | 30_000 | 10.3 s, "axe at 1280px > empty, sample-filled, findings, edit mode and Clear confirm are axe-clean" (sub), slowest caller | Fixture streams the description; 2.9x over the whole test |
| 146 | `test.setTimeout` | 180_000 | 4.8 s, "sample facts: a checked draft, the disclosure on Copy, and a gated problem phrase" (root) | one streamed description, clipboard read, draft edit, Use alternative dialog; 37x |
| 231 | `test.slow()` | 3x = 90 s, superseded by the 240 s below | 10.3 s, same axe test | one streamed description, axe at five states |
| 232 | `test.setTimeout` | 240_000 | 10.3 s, same test and run | as above; 23x |

**studio-shell.spec.ts**

| Line | Site | Value | Cited | Cause (short) |
|---|---|---|---|---|
| 183 | `test.slow()` | 3x = 90 s | 1.0 s, "the Sample contacts notice stays on the CRM pages and off the Studio routes" (sub) | loadSampleContacts seeds the CRM, three client-side navigations wait for the live contacts query; 90x |
| 203 | `test.slow()` | 3x = 90 s | 1.7 s, "a full load of a Studio route still runs the check-on-open saved-search pass" (sub) | mocked key save, cap save, five seeded searches from the home page, full load opening the dialog; 53x |

**snapshot-builder.spec.ts**

| Line | Site | Value | Cited | Cause (short) |
|---|---|---|---|---|
| 117 | `draftNotes` toBeVisible | 60_000 | 12.3 s, "keyless: sample ZIP, notes with a planted number gate Save, then save opens the print view" (sub), slowest caller | sample market notes stream word by word; 4.9x over the whole test |
| 132 | `test.slow()` | 3x = 90 s | 12.3 s, same keyless test | streamed notes, four axe passes, three gated-Save edits, save rendering the print sheet; 7x |
| 242 | `test.slow()` | 3x = 90 s | 4.8 s, "Choose a different ZIP drops the old figures and notes and gates Save" (root and sub) | streamed notes, ZIP reset, second load; 18x |
| 274 | `test.slow()` | 3x = 90 s | 3.7 s, "save gate: no data section; Delete asks first, removes the row and announces it" (sub) | six toggles, two axe passes, save to print view, Delete dialog; 24x |
| 326 | `test.slow()` | 3x = 90 s | 3.0 s, "mocked key: new ZIP 1 call, listings summary 1 more, cached reload 0 (2 in total)" (sub) | two mocked RentCast loads, axe, reload re-reading the cache; 30x |

**snapshot-print.spec.ts**

| Line | Site | Value | Cited | Cause (short) |
|---|---|---|---|---|
| 138 | `expectChartsDrawn` expect.poll | 15_000 | 2.5 s, "sample report: labels, prominence and charts on screen and in print, a PDF within budget" (root), only caller | LayerChart draws the two foreignObject plots after hydration; poll runs three times; 6x over the whole test |
| 176 | `test.slow()` | 3x = 90 s | 2.5 s, same sample-report test | three chart polls, print emulation at two widths, Chromium page.pdf(); 36x |
| 243 | `test.slow()` | 3x = 90 s | 2.5 s, "sample report: axe in screen media" (sub) | one axe pass over the full printout with both 24-month tables open; 36x |
| 350 | `test.slow()` | 3x = 90 s | 2.4 s, "saved record: prints from this browser with EHO and the Tran footer off" (root) | IndexedDB write, print emulation at 672px, page.pdf(), axe; 37x |

**agent-share-link.spec.ts**

| Line | Site | Value | Cited | Cause (short) |
|---|---|---|---|---|
| 245 | `test.slow()` | 3x = 90 s | 5.2 s, "axe clean and no horizontal scroll while blocked, at 1280 and 375" (root) | three axe passes over the long profile page; 17x |
| 263 | `test.slow()` | 3x = 90 s | 3.9 s, "axe clean and no horizontal scroll with a ready link, at 1280 and 375" (root) | full profile and key save, two axe passes; 23x |

**agent-no-rentcast.spec.ts**

| Line | Site | Value | Cited | Cause (short) |
|---|---|---|---|---|
| 72 | `test.setTimeout(PAGE_LOADS * PER_PAGE_MS + FLOWS_MS)` | 21 x 4 s + 40 s = 124 s (ROUTES.length = 7) | 13.3 s, "every agent flow makes zero RentCast requests and offers no sms: links" (root) | 21 full page loads plus a streamed draft and the import, profile and inquiry forms; budget scales with pages walked; 9x |
| 117 | follow-up toBeVisible | 20_000 | 13.3 s, same test (the whole walk) | Fixture streams the follow-up draft; one wait inside the 124 s walk |

**agent-followup.spec.ts**

| Line | Site | Value | Cited | Cause (short) |
|---|---|---|---|---|
| 80 | `draftNow` toBeVisible | 20_000 | 12.2 s, "axe clean at 1280px in every follow-up state" (sub), slowest caller; single-draft tests at most 6.8 s | Fixture streams the follow-up draft; 2.9x over the slowest single-draft test |
| 274 | `test.setTimeout` (one statement, two generated tests) | 120_000 | 12.2 s, same axe test | lead added through the dialog, three contact opens, four axe passes, one streamed draft; 9.8x |

**agent-live-key.spec.ts**

| Line | Site | Value | Cited | Cause (short) |
|---|---|---|---|---|
| 11 | `test.describe.configure({ timeout })` | 120_000 | 10.0 s, "live key, 2 due: agent pages spend nothing; the first Renter arrival checks once" (root); 5-due test 8.9 s | walkAgent full-loads seven agent routes, client-side pass with two 1.5 s negative windows, Renter arrivals with 1 s waits; 12x |

**apps/extension/e2e/extension.spec.ts**

| Line | Site | Value | Cited | Cause (short) |
|---|---|---|---|---|
| 71 | `ctx.waitForEvent('serviceworker', { timeout })` in `launch()` (beforeAll) | 15_000 | 3.6 s for the whole 7-test suite including the single beforeAll launch (1 worker, 15-03 run 2026-11-09, max of 2 runs); no test over 0.447 s | launchPersistentContext starts Chromium with the unpacked extension and the MV3 worker registers asynchronously; off CI a missing worker triggers a second headed launch; 4x over the whole suite |

## Verification

Findings after (the plan's verify one-liner, whole partition):

```
$ node --input-type=module -e "import {playwrightTimeoutFindings as f} from './scripts/lib/test-lane-rules.mjs';import {execSync} from 'node:child_process';import {readFileSync} from 'node:fs';const P=/^(apps\/web\/tests\/e2e\/(studio|snapshot|agent)-[^/]*\.spec\.ts|apps\/extension\/e2e\/.+\.ts)$/;let n=0;for(const p of execSync('git ls-files apps/web/tests apps/extension/e2e',{encoding:'utf8'}).split('\n').filter(x=>P.test(x)))n+=f(p,readFileSync(p,'utf8')).length;console.log(n);process.exit(n?1:0)"
0
exit 0
```

Per file, `playwrightTimeoutFindings(path, text).length` is 0 for all 12 edited files (printed individually; see the Task 2 verify run).

Values unchanged: `diff .tools/test-evidence/15-04-values-before.txt .tools/test-evidence/15-04-values-after.txt` is empty over all 25 partition files (12/12 edited files identical). `grep -c "const AI_FLOW_MS = 240_000" studio-keyless.spec.ts` = 1; `grep -c "setTimeout(240_000)"` = 0. `grep -L "Timeout: measured\|Timeout: test.slow()"` over the 12 files lists nothing.

Filtered diff (`git diff -U0 14bed88 -- <12 partition files> | grep '^[-+]' | grep -vE '^[-+]{3}|^[-+]\s*//|_MS\b|^[-+]\s*$'`) shows only the 17 removed literals that the hoisted constants replaced:

```
-	test.setTimeout(240_000);            x5   (studio-keyless -> AI_FLOW_MS)
-	... { timeout: 30_000 }  /  timeout: 30_000  x3   (studio-reel -> RUN_WAIT_MS)
-	test.setTimeout(240_000);            x2   (studio-reel -> MULTI_RUN_MS)
-	test.setTimeout(120_000);            x2   (studio-reel -> SINGLE_RUN_MS)
-	test.setTimeout(240_000);            x3   (studio-social -> PACK_FLOW_MS)
-	test.setTimeout(300_000);            x2   (studio-social -> LONG_PACK_MS)
```

No assertion, locator or timeout value changed. `git diff --stat` over the 12 files: 177 insertions, 22 deletions.

- `MSYS_NO_PATHCONV=1 corepack.cmd pnpm --filter web exec playwright test --list`: exit 0, "Total: 2354 tests in 88 files" (`.tools/test-evidence/15-04-web-list.log`)
- `corepack.cmd pnpm --filter extension exec playwright test --list`: exit 0, "Total: 7 tests in 1 file" (`15-04-ext-list.log`)
- `corepack.cmd pnpm lint` (prettier --check . && eslint .): exit 0 (`15-04-lint.log`)
- prettier --check and eslint also run per edited file before each commit: exit 0

## Decisions Made

- **Cite the governing test, say what the margin is over.** For helper-level waits the report has no per-wait number, so the comment names the slowest caller and states "Nx margin over the whole test" (or "over the slowest single-draft test") rather than implying the wait itself took that long. The plan's Decision note ("the wait cannot exceed it") is what makes the test total a valid bound.
- **Keep `test.slow()` truthful when a `test.setTimeout` follows.** In studio-reel, studio-social and studio-listing the `test.slow()` tripling is overridden by the explicit `setTimeout` on the next line; the comment says "superseded by the N s below" instead of claiming the 90 s governs. Values untouched (removing the redundant `slow()` would be a change outside this plan's annotate-only scope).
- **Five, not six, `240_000` raises in studio-keyless.** The plan's `must_haves` and Inventory B say six; the file has five (lines 246, 288, 307, 344, 456) plus one `300_000` at 367. `AI_FLOW_MS` replaces the five; the 300 s raise keeps its own comment. Recorded here as the plan asked.
- **Extension wait cites the 15-03 suite total.** The 15 s `waitForEvent` runs inside `beforeAll`, which the 15-03 table does not time separately; the whole-suite 3.6 s (which includes that launch) is the honest upper bound, and the comment says so.
- **Constant names describe the work, not the value.** `RUN_WAIT_MS` / `SINGLE_RUN_MS` / `MULTI_RUN_MS` (reel) and `PACK_FLOW_MS` / `LONG_PACK_MS` (social) follow the plan's `AI_FLOW_MS` example so a future value change edits one annotated line.

## Deviations from Plan

None in substance - the plan was executed as written. Two small facts differed from the plan text and are recorded above rather than acted on: the 240 s raise count in studio-keyless is five (not six), and the 47 findings came in 48 lines because one `expect.poll` callee text contains a newline. The findings file set matched `files_modified` exactly.

## Issues Encountered

- The first filtered-diff run over `apps/web/tests apps/extension/e2e` (as the plan's acceptance criterion words it) also showed sibling agents' uncommitted lines (`investor/sweep.spec.ts` `describe.configure`, `third-party.spec.ts`, `smoke/fixtures.ts`), since 15-05 and 15-07 share the tree. Re-ran restricted to the 12 partition-A paths; that is the output recorded above. Nothing outside partition A was staged or touched.
- `scripts/cpu-burn.mjs` is untracked in the tree; it belongs to a sibling plan and was left alone.

## Known Stubs

None. Comment-only changes plus six constants that are all referenced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 15-05 (partition B: everything else under `apps/web/tests/**` and the Playwright configs) can reuse the annotation wording and the hoisting names here; the shared `e2e-report-449ecc5.json` and `e2e-durations.tsv` snapshots are in `.tools/test-evidence/`.
- 15-09's repo sweep should see zero `unannotated-raise` findings in partition A. If it reports any, the regexes in `scripts/lib/test-lane-rules.mjs` changed, not these files.
- Nothing was pushed.

---
*Phase: 15-load-deterministic-test-lanes*
*Completed: 2026-11-09*

## Self-Check: PASSED

- 12/12 modified files present on disk; commits caba682, b9050d3 and 1a7c8c4 present in `git log --all`.
