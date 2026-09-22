---
phase: 01-foundation-origin-security-baseline
plan: 07
subsystem: testing
tags: [playwright, e2e, csp, anti-framing, clickjacking, axe, wcag, chromium]

# Dependency graph
requires:
  - phase: 01-foundation-origin-security-baseline
    plan: 03
    provides: <html hidden> + static/frame-guard.js shell, hash-mode meta CSP with style-src-attr 'unsafe-inline', settings page csp-transition-toggle/target hooks, one <h1> + <title> per route, skip link + main landmark
  - phase: 01-foundation-origin-security-baseline
    plan: 04
    provides: build-time CSP oracle (csp:assert) proving the policy text; these specs prove the running app survives it
  - phase: 01-foundation-origin-security-baseline
    plan: 05
    provides: serve-pages.mjs attacker listener with iframe ids plain / sandboxed / sandboxed-scripts, Playwright root/sub projects with trailing-slash baseURLs, sub testIgnore for framing.spec
provides:
  - apps/web/tests/e2e/csp.spec.ts, a securitypolicyviolation collector installed before navigation, asserting zero violations on all six routes under both bases, through the settings fade transition and an explicit inline style attribute write, with a provoked inline-script violation as the non-vacuity control
  - apps/web/tests/e2e/framing.spec.ts, one test per cross-origin frame variant asserting the framed document loaded (html[hidden] present) AND its h1 is hidden AND the attacker page was not replaced, plus a top-level positive control; deterministic under parallel workers
  - apps/web/tests/e2e/a11y.spec.ts, AxeBuilder with the WCAG 2.0/2.1/2.2 A+AA tag set on every route in both projects, guarded so an empty violation list is never vacuous
  - A green 30-test pnpm test:e2e (routing + csp + framing + a11y) in 11-14 s with ports released
affects: [01-08 (CI runs pnpm test:e2e per matrix leg), 01-09 (full verify closes FND-02/03/04), Phase 2 (a11y gate now catches contrast/markup regressions; style-src-attr proof covers UI primitives that render style attributes)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Install runtime collectors with page.addInitScript BEFORE the first navigation; read them with page.evaluate and assert toEqual([]) so failures name the directive
    - Every proof spec carries its own non-vacuity control (provoked violation, html[hidden] presence, axe passes.length > 0, top-level positive control)
    - Wait for iframe documents using CDP-tracked state only (page.frame({ name }).url() via expect.poll, frame.waitForLoadState) before any locator touches the frame
    - Specs whose subject is user-activation-sensitive run with test.use({ trace: 'off' }) and say why
    - Declare test-only window globals with `declare global { interface Window { ... } }` instead of `as any`

key-files:
  created:
    - apps/web/tests/e2e/csp.spec.ts
    - apps/web/tests/e2e/framing.spec.ts
    - apps/web/tests/e2e/a11y.spec.ts
  modified: []

key-decisions:
  - "Svelte 5.57's fade transition is pure Element.animate() (probe recorded four animate() calls and zero style attribute mutations), so the transition round-trip alone does not exercise style-src-attr; the spec adds an explicit setAttribute('style') write that must be permitted, which is what Phase 2's UI primitives will actually do"
  - "framing.spec.ts runs with trace off: Playwright's Runtime.callFunctionOn carries userGesture:true and the trace snapshotter evaluates in every frame around every action, which can grant the #plain frame transient activation before its document commits and let Chromium permit the top.location bust (2/4 flaky full runs); plain Chromium blocked it 22/22"
  - "Frame readiness is awaited through CDP-tracked frame url and lifecycle events only, never by evaluating inside the frame, so no Playwright code can precede the guard"
  - "One test per frame variant and per route (not one loop test) so a failure names the variant or route"
  - "FND-02/03/04 left unchecked, consistent with 01-01..01-06: runtime proofs shipped here; 01-08 wires CI and 01-09 runs the full suite and closes them"

patterns-established:
  - "A proof spec over already-shipped behaviour must include a control that would fail if the mechanism under test were absent (the mutation-tested fail-open guard, the provoked CSP violation)"
  - "Never assert on the framebust navigating the top page; assert the attacker page survived when no gesture was given"

requirements-completed: [FND-02, FND-03, FND-04]

# Metrics
duration: ~24min
completed: 2026-09-22
---

# Phase 01 Plan 07: Runtime CSP, Cross-Origin Framing & Axe E2E Proofs Summary

**Three Playwright proof suites over the served builds: zero `securitypolicyviolation` events on every route under both bases (including a Svelte fade and an inline `style` attribute write, with a provoked inline-script violation proving the collector is live), the app invisible in plain, sandboxed and sandboxed-with-scripts cross-origin frames with the framed document proven loaded, and zero axe WCAG 2.0/2.1/2.2 A+AA violations on all six routes; the framing spec was made deterministic after tracing down a parallel-worker flake to Playwright's `userGesture:true` evaluations granting the framed page a simulated gesture**

## Performance

- **Duration:** ~24 min (2026-09-22T18:37Z start; includes the flake diagnosis)
- **Tasks:** 3 (plus one fix commit)
- **Files modified:** 3 created

## Accomplishments

- `corepack pnpm --filter web exec playwright test csp` exits 0: `6 passed` (3 tests x `root` + `sub`); every route is 200, `html` has no `hidden`, `h1` visible, `window.__csp` empty; the settings fade intro+outro and an explicit `setAttribute('style', 'opacity: 0.99')` produce no violation; an injected un-hashed inline `<script>` is refused and reported as `script-src-elem inline` and its side effect never runs
- `corepack pnpm --filter web exec playwright test framing --project=root` exits 0: `4 passed`; `--project=sub --pass-with-no-tests` exits 0 with 0 tests (config `testIgnore`)
- `corepack pnpm --filter web exec playwright test a11y` exits 0: `12 passed` (6 routes x 2 projects), axe `passes.length > 0` on every route
- `corepack pnpm test:e2e` exits 0: `30 passed` in 11-14 s wall clock across 8 consecutive default-config runs after the fix (previously 2/4 failed); 4273/4274/4275 all free afterwards
- Mutation test of the framing spec: with `apps/web/build/frame-guard.js` replaced by a fail-open guard, `#plain` and `#sandboxed-scripts` FAIL (`toHaveAttribute` on `html[hidden]`), `#sandboxed` still passes (the sandbox, not the script, protects it) and the control passes; the build file was restored byte-identical (`cmp`) and `csp:assert` is green on both builds
- `corepack pnpm check` (0 errors, 0 warnings), `corepack pnpm lint` exit 0, every plan acceptance grep passes, no `page.goto('/` anywhere, `git remote -v` prints nothing

## Task Commits

1. **Task 1: Runtime CSP violation spec** - `1992ccf` (feat) - `apps/web/tests/e2e/csp.spec.ts`
2. **Task 2: Cross-origin framing spec** - `8cc25e1` (feat) - `apps/web/tests/e2e/framing.spec.ts`
3. **Task 3: Accessibility spec across every route** - `d6c87e8` (feat) - `apps/web/tests/e2e/a11y.spec.ts`
4. **Fix: framing spec deterministic under parallel workers** - `2e2adbe` (fix) - `apps/web/tests/e2e/framing.spec.ts` (see Deviations)

All commits used `--no-verify` per the wave-F parallel convention; the orchestrator runs `secrets:scan` + `guard` after the wave.

**Plan metadata:** see final docs commit below

## Files Created/Modified

- `apps/web/tests/e2e/csp.spec.ts` (92 lines) - `declare global` typing for `window.__csp`; `installCollector()` via `addInitScript`; test 1 loops the six routes (200, `html` not hidden, `h1` visible, `[]`); test 2 round-trips the settings fade and writes an inline `style` attribute (asserted via `toHaveCSS`) with `[]` after both; test 3 injects an inline `<script>` and `expect.poll`s for `/^script-src(-elem)? inline$/` and asserts the probe never ran
- `apps/web/tests/e2e/framing.spec.ts` (60 lines) - `test.use({ trace: 'off' })` with the rationale; `FRAMES` map of iframe id to expected src on `E2E_PORT_ROOT`; per-variant test: goto attacker on `E2E_PORT_ATTACKER`, `expect.poll(page.frame({ name }).url())`, `frame.waitForLoadState('load')`, then `frameLocator` asserts `html[hidden]` present, `h1` hidden, `page.url()` still the attacker; positive control at top level
- `apps/web/tests/e2e/a11y.spec.ts` (28 lines) - per-route test: not hidden + visible `h1` guard, `AxeBuilder.withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa'])`, `passes.length > 0`, `violations` `toEqual([])` with `id (impact): help` lines in the message

## Decisions Made

- **style-src-attr proof made explicit.** A DOM probe during Task 1 showed Svelte 5.57's `fade` issues four `Element.animate()` calls and zero `style` attribute mutations, so a MutationObserver-based "the transition wrote styles" guard failed and was dropped. The transition round-trip stays (the plan's behaviour), and an explicit `setAttribute('style', ...)` write is asserted as permitted, which is the operation `style-src-attr` actually governs and what Phase 2's primitives will perform. RESEARCH's observed violation is not reproducible with this Svelte pin.
- **Tracing off for the framing spec.** See Deviations: it is the only way to keep Playwright from handing the framed page a simulated user gesture.
- **CDP-only frame readiness.** `page.frame({ name })` reports iframe `id` as the name in Chromium; polling its `url()` and `waitForLoadState` never evaluates inside the frame.
- **Requirements not marked complete.** Same convention as every prior plan in this phase: the runtime proofs are shipped, 01-09 closes FND-02/03/04 after the full `pnpm verify`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Framing spec flaked under parallel workers (top page replaced by the app)**
- **Found during:** plan-level verification (`pnpm test:e2e`, 7 workers): 2 of 4 runs failed on a framing test with `element(s) not found` for `html` inside the frame; serial runs were 11/11 green
- **Issue:** Diagnostics showed that, in failing runs, `page.frames()` at test start held a single frame at `http://127.0.0.1:4273/` with no iframes: the `#plain` frame's `top.location` bust had succeeded. A standalone probe (8 serial + 14 parallel attacker loads in plain Chromium) blocked the bust 22/22 times with the "Unsafe attempt to initiate navigation" console message, so the permission came from the runner. Playwright's `Runtime.callFunctionOn` carries `userGesture: true` (playwright-core 1.63.0 `coreBundle.js`, `evaluateWithArguments`) and the trace snapshotter iterates `page.frames()` around every action; with `trace: 'retain-on-failure'`, a snapshot landing in `#plain` before its cross-origin document commits grants transient activation, after which Chromium legitimately allows the bust. Controlled runs: `--trace on` 1/6 failed, `--trace off` 0/16.
- **Fix:** `test.use({ trace: 'off' })` in `framing.spec.ts` with the rationale; frame readiness awaited through `expect.poll(() => page.frame({ name: id })?.url())` and `frame.waitForLoadState('load')` (no in-frame evaluation) before any locator; `page.url()` asserted to still be the attacker so a real behaviour change is caught.
- **Verification:** 0/8 full default-config runs failed after the fix (12-14 s each), 5/5 serial framing runs green, csp/a11y unaffected
- **Files modified:** `apps/web/tests/e2e/framing.spec.ts`
- **Commit:** `2e2adbe`

**2. [Rule 1 - Bug] Transition style-write counter was based on a false premise**
- **Found during:** Task 1 (added as a non-vacuity guard, failed on both projects with 0 writes)
- **Issue:** Svelte 5.57 `fade` is WAAPI-only; no `style` attribute mutations occur
- **Fix:** Replaced by the explicit inline style attribute assertion described above; never committed in the failing form
- **Files modified:** `apps/web/tests/e2e/csp.spec.ts`
- **Commit:** `1992ccf`

---

**Total deviations:** 2 auto-fixed (both Rule 1, both inside this plan's own specs)
**Impact on plan:** No scope or interface change. All three artifacts exist with the contracted strings (`securitypolicyviolation`, `frameLocator`, `withTags`, `E2E_PORT_ATTACKER`, `csp-transition-toggle`); additions are the non-vacuity controls and the deterministic frame wait.

## Issues Encountered

- `pnpm lint` failed twice transiently during the wave: once while plan 01-08 was writing `scripts/workflow-gate.test.ts`, once on my own temporary probe file (`apps/web/.probe-bust.tmp.mjs`, deleted before commit). Both resolved on re-run with no repo change.
- Throwaway Node probes had to live inside `apps/web/` (ESM resolves `@playwright/test` relative to the script file, not cwd) and used `process.exitCode` per the 01-05 note; both were removed and never committed.
- `netstat` is unavailable in Git Bash here (machine PATH omits System32); port release was verified with a `node:net` bind probe instead.

## Known Stubs

None. All three specs are complete proof suites; no placeholder values.

## User Setup Required

None.

## Requirements Status

| ID | This plan delivers | Still open | Closed by |
|----|-------------------|------------|-----------|
| FND-02 | Zero runtime CSP violations on every route under both bases, through a transition and an inline style attribute write; collector proven live by a provoked violation | CI run, full verify | 01-08, 01-09 |
| FND-03 | App hidden in plain / sandboxed / sandboxed-with-scripts cross-origin frames with the framed document proven loaded; visible at top level; guard mutation-tested (fail-open guard fails the spec) | CI run, full verify | 01-08, 01-09 |
| FND-04 (a11y gate) | axe WCAG 2.0/2.1/2.2 A+AA zero violations on six routes x two bases | CI wiring of `pnpm test:e2e`, full verify | 01-08, 01-09 |

## Next Phase Readiness

- 01-09 can run `pnpm verify` end to end; `pnpm test:e2e` is 30 tests in ~12 s with tracing on for csp/routing/a11y and off for framing
- Phase 2 UI work: the a11y gate is live on every route (add new routes to the `ROUTES` lists in csp/a11y/routing specs); components that render `style` attributes are covered by the `style-src-attr` proof
- Anyone adding a spec that inspects framed content should copy the CDP-only readiness pattern and keep tracing off for it
- No remote, no push, branch `main`

## Self-Check: PASSED

`apps/web/tests/e2e/csp.spec.ts`, `framing.spec.ts` and `a11y.spec.ts` exist on disk; commits `1992ccf`, `8cc25e1`, `d6c87e8` and `2e2adbe` are present in `git log`.

---
*Phase: 01-foundation-origin-security-baseline*
*Completed: 2026-09-22*
