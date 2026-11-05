---
phase: 14-carried-debt
plan: 09
subsystem: marketing-forms
tags: [budget, initial-js, tailwind-merge, tailwind-variants, bits-ui, zod, dynamic-import, playwright, axe, DEBT-09]
requires:
  - "14-06 TW_MERGE_CONFIG (the trim is measured after the widened merge config, D-14)"
provides:
  - "PRIMARY_BUTTON_CLASS / GHOST_BUTTON_CLASS static strings, token-equal to buttonVariants()"
  - "FeedbackForm, WaitlistForm and FormError on native controls with static classes (no cn/tv/bits-ui)"
  - "Lazy key scan (@tran/core/backup) and sender ($lib/leads/owner-forms) behind fail-closed dynamic imports"
  - "Post-trim initial-JS bytes for the four routes in both builds (input for 14-12)"
affects: [14-12 (content-split levers for /for-*/ and the REPORT -> HARD flip), 14-11 (verify chain)]
tech-stack:
  added: []
  patterns:
    - "Lazy module cache per component instance: `const importX = () => import('...')`, `let p: ReturnType<typeof importX> | null`, `load = () => (p ??= importX().catch((e) => { p = null; throw e; }))`; warm-up on first focusin/pointerdown"
    - "E2E for a failed lazy import counts `vite:preloadError` events to prove a retry makes a fresh import attempt"
key-files:
  created:
    - apps/web/src/lib/components/forms/form-classes.ts
    - apps/web/src/lib/components/forms/form-classes.test.ts
  modified:
    - apps/web/src/lib/components/forms/FeedbackForm.svelte
    - apps/web/src/lib/components/forms/WaitlistForm.svelte
    - apps/web/src/lib/components/forms/FormError.svelte
    - apps/web/tests/e2e/feedback.configured.spec.ts
    - apps/web/tests/e2e/waitlist.configured.spec.ts
decisions:
  - "Chromium keeps a failed module fetch in its module map for the life of the page, so a same-page retry after a failed lazy chunk cannot succeed in Chromium whatever the app does. The forms still clear the cached promise (the next submit makes a fresh import attempt, proven by counting vite:preloadError events), every attempt fails closed, and a reload recovers. The E2E asserts that instead of retry-succeeds"
  - "FeedbackForm sets the busy state as soon as inline validation passes (before the lazy key scan); the too-fast path therefore refocuses the submit button after clearing busy, because disabling the focused button drops focus"
  - "Native textarea keeps the copy-in's `text-base leading-[1.6]`: Tailwind 4 text-base is 1rem and leading-[1.6] overrides its line height, so the computed result is 16px / 1.6, the same as `text-body` (--text-body: 1rem, --text-body--line-height: 1.6 in app.css)"
  - "Prettier (tailwind plugin) re-sorted the static Alert class string in FormError.svelte; the token set is unchanged"
metrics:
  duration: 22min
  completed: 2026-11-05
  tasks: 3
  files: 7
---

# Phase 14 Plan 09: Marketing form trim Summary

The waitlist and feedback forms now use native buttons, radios, a textarea and a static alert with fixed class strings. The zod-bearing key scan and sender load by fail-closed dynamic import. `/feedback/` dropped from 105,265 to 57,833 B gz (under the 61,440 B budget). Each `/for-*/` dropped from ~99,100 to ~62,683 B gz, still about 1.2-1.4 KB over the budget, which is 14-12's job.

## Tasks

| Task | Name | Commit(s) |
|------|------|-----------|
| 1 | Static button class module with token-parity test (TDD) | 653073e (RED), b395543 (GREEN) |
| 2 | Native controls + lazy validation in FeedbackForm, WaitlistForm, FormError; measure | a1ed09c |
| 3 | E2E: native radios, focus, fail-closed lazy import, axe on the configured project | b80b594 |

## Bytes per route (initial JS, gzip -9, `initialJs()` from scripts/assert-budget.mjs)

Budget: 61,440 B. "Plan before" is the plan's figure (docs/audit/budget.txt, pre-14-06). "Baseline" was measured in this plan at HEAD 7d51e9b (after 14-06, before the trim). "After" was measured on the final source at HEAD a1ed09c (the build stamp shifts bytes by about 10 B between HEADs).

| Route | Build | Plan before | Baseline (post-14-06) | After | Delta vs baseline | vs budget |
|-------|-------|-------------|-----------------------|-------|-------------------|-----------|
| /feedback/ | build (default) | 105,327 | 105,265 | **57,833** | -47,432 | 3,607 under |
| /for-agents/ | build (default) | 99,155 | 99,100 | **62,682** | -36,418 | 1,242 over |
| /for-investors/ | build (default) | 99,158 | 99,103 | **62,685** | -36,418 | 1,245 over |
| /for-renters/ | build (default) | 99,156 | 99,101 | **62,682** | -36,419 | 1,242 over |
| /feedback/ | build-configured (ships) | 105,393 | 105,440 | **58,004** | -47,436 | 3,436 under |
| /for-agents/ | build-configured (ships) | 99,223 | 99,272 | **62,851** | -36,421 | 1,411 over |
| /for-investors/ | build-configured (ships) | 99,225 | 99,275 | **62,857** | -36,418 | 1,417 over |
| /for-renters/ | build-configured (ships) | 99,223 | 99,273 | **62,851** | -36,422 | 1,411 over |

Preload files per route: feedback 37 -> 22, for-* 38 -> 30.

`pnpm budget:assert` (tool routes HARD, both builds, `--require-tools`) exits 0. The four routes are still REPORT rows; 14-12 flips them.

## Preload-set grep (no tailwind-merge, tailwind-variants or zod)

Commands (Git Bash, from apps/web):

```
for B in build build-configured; do for P in feedback for-agents; do H=$B/$P/index.html; \
  refs=$(grep -o '...modulepreload...href="[^"]*"' $H | ...); for r in $refs; do \
  grep -l "twMerge\|tailwind-variants\|ZodError\|data-radio-group\|radio-group-item" "$(realpath -m $B/$P/$r)"; done; done; done
```

Output: `hits=[]` for build/feedback (22 preloads), build/for-agents (30), build-configured/feedback (22) and build-configured/for-agents (30). A second scanner (scratchpad `measure.mjs`) covers modulepreload hrefs plus inline `import("…js")` targets for all four routes in both builds and greps `twMerge|tailwind-variants|ZodError`. It printed `hits=none` for all 8 rows. Baseline, same scanner: every row hit `twMerge@DXDPU1tL.js, ZodError@p8sXwDPs.js, twMerge@uTk4Za_C.js`. The zod chunk still exists in the build (`p8sXwDPs.js`) and loads only through the lazy imports.

## Implementation notes

- Buttons: `<button type="submit" class="{PRIMARY_BUTTON_CLASS} w-full sm:w-auto">` keeps `bind:this`, `disabled` and the `grid` + `invisible` spinner and label stacking. **Send more feedback** is `<button type="button" class={GHOST_BUTTON_CLASS}>`.
- Topic picker: five `<input type="radio" name="feedback-topic" value={id} bind:group={topic}>` with the spec class, inside the existing labels, fieldset and legend. The RadioGroup root's resolved classes are kept on a plain `div` (`mt-2 grid w-full`). `focusTopic()` uses `input[name="feedback-topic"]:checked`.
- Textarea: native, with the spec class string, `bind:this` and every existing attribute. No `name`.
- FormError: static `div[data-slot=alert][tabindex=-1]` with the resolved Alert destructive classes, `CircleAlert size-5 text-destructive`, and title and description divs carrying the alert-title and alert-description classes. No `role`. The mailto line is unchanged.
- Lazy order (feedback): inline validation -> busy -> `await loadScan()` -> key scan -> honeypot/timing gate -> `await loadSender()` -> one request. Waitlist: inline validation -> gate -> busy -> `await loadSender()` -> one request. A rejected import goes to the network-error path (title from FORMS_COPY, announce "{title}. {body}", focus the submit button) and sends nothing.
- No lazy rendering: the prerendered form markup is complete. The CLS gate in perf.spec.ts is green.
- Untouched copy-ins (textarea, radio-group, SectionError) stay in the repo (D-15).

## Verification output

- `vitest run --project web apps/web/src/lib/components/forms/`: 3 files, 31 tests passed (form-classes 5/5).
- `pnpm --filter web check`: 3261 files, 0 errors, 0 warnings. `pnpm ui:guard`: passed (81 files). `pnpm lint`: exit 0.
- `playwright test feedback.configured.spec.ts waitlist.configured.spec.ts --project configured`: 35 passed (17.6s), clean build.
- `playwright test feedback.spec.ts waitlist.spec.ts marketing.spec.ts perf.spec.ts --project root --project sub`: 144 passed, 4 skipped (pre-existing skips: coming-soon specs gated off the configured env, and the perf measurement runs on root only), 44.0s.
- Acceptance greps: components/ui/button|radio-group|textarea in both forms = 0. SectionError in FormError = 0. `import('@tran/core/backup')` in FeedbackForm = 1. `import('$lib/leads/owner-forms')` = 1 per form. Static `from` imports of either = 0. `name="feedback-topic"` = 2 (input + query). `data-state="checked"` = 0. `data-state` in feedback.configured.spec.ts = 0.

## Mutation ledger

| # | Mutation | Test that failed | Restored -> |
|---|----------|------------------|-------------|
| 1 | Delete `focus-visible:outline-ring` from BASE in form-classes.ts | form-classes.test.ts: 4 of 5 failed (both parity tests + both required-token tests) | 5/5 green |
| 2 | WaitlistForm: swallow the import rejection (`failure = copy.networkError` -> `return`) | waitlist lazy test: `Expected substring: "Your email wasn't sent"` not found | green (35/35 run) |
| 3 | WaitlistForm: delete `senderP = null` from the loader's catch | waitlist lazy test: `expect.poll(failures).toBeGreaterThan(1)`, received 1 (no fresh import attempt) | green |
| 4 | FeedbackForm: delete `scanP = null` from the loader's catch | feedback lazy test: `toBeGreaterThan(2)`, received 2 | green |

All mutations were applied to the working tree only and restored with `git checkout`. The final configured, root and sub builds were rebuilt on the clean tree before the last E2E runs.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug in the test premise] Retry-succeeds after a failed lazy chunk is impossible in Chromium**
- **Found during:** Task 3
- **Issue:** After `page.unroute('**/_app/immutable/**')`, a second submit issued no network request at all. A diagnostic spec logged zero `_app/immutable` requests after unroute. Chromium keeps the failed module fetch in its module map for the page's lifetime, so `import()` of the same URL rejects again even though the app cleared its cached promise.
- **Fix:** The test now asserts what the app controls. The retry makes a fresh import attempt (counted with a `vite:preloadError` listener, since Vite's preload wrapper dispatches one per failed attempt), it still sends nothing, it shows the error and refocuses the button. Then `page.reload()` recovers and exactly one request is sent. Mutation (b) is still detected (ledger rows 3 and 4). Test titles end with "a retry re-imports".
- **Files modified:** apps/web/tests/e2e/feedback.configured.spec.ts, apps/web/tests/e2e/waitlist.configured.spec.ts
- **Commit:** b80b594

**2. [Rule 1 - Focus] Too-fast path refocuses the submit button (FeedbackForm)**
- **Found during:** Task 2
- **Issue:** UI-SPEC rule 3 puts the busy state (disabled button) before the lazy key scan, and the timing gate now runs after the scan. Disabling the focused button would drop focus to `body` on a too-fast submit.
- **Fix:** After clearing busy on too-fast, `await tick(); buttonEl?.focus()`. Key-found does the same for the textarea (`tick` before `messageEl.focus()`, because the textarea was disabled).
- **Commit:** a1ed09c

**3. [Rule 3 - Acceptance grep] Single import specifier per form**
- **Issue:** Typing the caches with `typeof import('…')` would put the specifier on 2-3 lines, but the acceptance grep requires exactly 1.
- **Fix:** `const importX = () => import('…')` and types derived via `ReturnType<typeof importX>`. The FormError header comment was reworded so `SectionError` appears 0 times.
- **Commit:** a1ed09c

### Additional baseline measurement
The plan's "before" bytes predate 14-06. Per D-14 and the lessons file, a post-14-06 baseline of both builds was taken at HEAD 7d51e9b before any form edit (table above).

## Known Stubs

None.

## Deferred Issues

None. `/for-*/` remain ~1.2-1.4 KB over 61,440 B in both builds, as the plan allowed. Plan 14-12 decides the content-split levers and flips the HARD gate.

## Self-Check: PASSED
