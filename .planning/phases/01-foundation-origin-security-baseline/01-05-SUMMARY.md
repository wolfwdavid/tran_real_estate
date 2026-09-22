---
phase: 01-foundation-origin-security-baseline
plan: 05
subsystem: testing
tags: [playwright, e2e, github-pages, routing, adapter-static, windows]

# Dependency graph
requires:
  - phase: 01-foundation-origin-security-baseline
    plan: 03
    provides: apps/web/build and apps/web/build-sub (7 prerendered pages + 404.html each), trailingSlash 'always', paths.relative, exact-pinned @playwright/test 1.63.0 and @axe-core/playwright 4.13.0 in apps/web/package.json, root test:e2e script
  - phase: 01-foundation-origin-security-baseline
    plan: 04
    provides: csp:assert oracle proving both builds carry .nojekyll, 404.html and the 7-page set (the carriers this plan serves)
provides:
  - scripts/serve-pages.mjs, a dependency-free GitHub Pages behaviour emulator (301 on directory-without-slash, 404.html with status 404, path-traversal guard) on env-overridable loopback ports 4273/4274/4275, plus the always-on attacker page with iframe ids plain / sandboxed / sandboxed-scripts
  - apps/web/playwright.config.ts with ONE webServer whose readiness probe targets the attacker listener, and root / sub projects with trailing-slash baseURLs
  - apps/web/tests/e2e/routing.spec.ts proving deep link, 301 redirect, refresh, branded 404 and base-correct links under both bases (8 tests green)
  - A Windows teardown contract between Playwright and the emulator (System32 on PATH inside the runner; stdin-close exit opt-in) so the suite finishes in seconds rather than minutes
affects: [01-07 (framing/CSP/axe specs reuse this harness and the attacker iframe ids), 01-08 (CI matrix builds one target per leg and relies on the attacker-listener readiness probe; workflow-gate.test.ts pins it), 01-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Pages-emulating static server instead of vite preview so E2E sees the same 301/404 semantics production will
    - Single Playwright webServer whose readiness URL is the one listener that always answers 200, never a build-dependent one
    - Relative page.goto('renter/') under trailing-slash baseURLs so one spec runs under '/' and '/tran_real_estate/'
    - Link assertions resolve href against page.url() (paths.relative emits ./ and ../ hrefs) and exclude fragment links
    - Config-level environment guard (PATH prepend evaluated inside the runner process) in preference to machine-level changes

key-files:
  created:
    - scripts/serve-pages.mjs
    - apps/web/playwright.config.ts
    - apps/web/tests/e2e/routing.spec.ts
  modified:
    - .planning/STATE.md

key-decisions:
  - "Playwright webServer readiness probes the attacker listener (always 200), not the root listener, because CI's sub matrix leg has no apps/web/build and a root probe would time out"
  - "Windows teardown root cause is a machine-level PATH that omits C:\\Windows\\System32, so Playwright's only Windows kill path (taskkill) silently fails; playwright.config.ts prepends %SystemRoot%\\System32 to process.env.PATH at config-evaluation time instead of repairing the machine"
  - "serve-pages.mjs exits on stdin close only when SERVE_PAGES_EXIT_ON_STDIN_END=1 (set by the Playwright config), so a shell background job with a closed stdin still serves; SIGTERM/SIGINT/SIGHUP handlers cover POSIX and CI"
  - "The routing spec's at-least-one-link guard skips print/, which by design carries only the skip link"
  - "FND-01 left unchecked, consistent with 01-01..01-04: the routing contract is proven here; requirements mark-complete is deferred to 01-09"

patterns-established:
  - "Every later E2E spec (01-07 and portal phases) runs against serve-pages.mjs through this config; add specs, never a second webServer"
  - "Plan-level verification of a served build happens in wave isolation: nothing rebuilds apps/web/build* while Playwright serves them"

requirements-completed: [FND-01]

# Metrics
duration: ~25min active (two sessions; excludes a 10 min teardown stall)
completed: 2026-09-22
---

# Phase 01 Plan 05: Pages Emulator, Playwright Harness & Routing E2E Summary

**Dependency-free GitHub Pages emulator (`scripts/serve-pages.mjs`: 301 on directory-without-slash, `404.html` at status 404, three loopback listeners on env-overridable 4273/4274/4275) plus a single-`webServer` Playwright harness probing the always-on attacker listener, proving FND-01's deep-link, redirect, refresh and branded-404 contract green on both the `root` and `sub` projects (8/8 in 4.7 s) after a Windows teardown stall was traced to a machine PATH missing `System32` and guarded at config level**

## Performance

- **Duration:** ~25 min active across two sessions (Task 1 on 2026-09-17; Task 2 recovery, verification and docs on 2026-09-22). A 10 min stall in the original Task 2 verification is excluded and explained under Deviations.
- **Started:** 2026-09-17 (Task 1)
- **Completed:** 2026-09-22
- **Tasks:** 2
- **Files modified:** 4 (3 created, plus a STATE.md note recorded in the Task 2 commit)

## Accomplishments

- `corepack pnpm --filter web exec playwright test routing --workers=1` exits 0: `8 passed (4.7s)`, four tests on `[root]` and four on `[sub]`, 6 s wall clock including webServer start and teardown; no listener remains on 4273/4274/4275 afterwards and 4173/4174 were never bound
- The plan's Task 1 probe prints exactly `{ a: 301, b: 200, c: 404, d: 200 }` (301 carries `location: /renter/`), covering root redirect, root index, unknown path, and the sub-path mount at `/tran_real_estate/`
- Every Task 1 and Task 2 acceptance grep passes against the committed files: `E2E_PORT_ROOT`/`E2E_PORT_SUB`/`E2E_PORT_ATTACKER` and 4273/4274/4275 present, `4173|4174` absent from both files, `127.0.0.1` x7 in the emulator, all three iframe ids present, `301` and `404.html` present, no non-`node:` imports and zero `require(`, `webServer:` count 1, `reuseExistingServer: false`, `serve-pages.mjs`, `` url: `http://127.0.0.1:${ATTACKER}/` ``, `tran_real_estate`, `framing`, no `page.goto('/`, `reload`, `404`, and `#` present in the spec
- `apps/web/package.json` devDependencies contain `"@playwright/test":"1.63.0"` and `"@axe-core/playwright":"4.13.0"` (exact, no caret) and `git status --porcelain apps/web/package.json pnpm-lock.yaml` prints nothing: plan 03 still owns both files
- `corepack pnpm lint` exits 0 (Prettier and ESLint); `git status --porcelain` is empty, `test-results/` and `playwright-report/` are gitignored (lines 12-13); `git remote -v` prints nothing

## Task Commits

1. **Task 1: GitHub Pages behaviour emulator** - `d915844` (feat) - `scripts/serve-pages.mjs`
2. **Task 2: Playwright harness and routing contract spec** - `17e79d6` (feat) - `apps/web/playwright.config.ts`, `apps/web/tests/e2e/routing.spec.ts`, plus the teardown fix to `scripts/serve-pages.mjs` and a STATE.md note (see Deviations)

**Plan metadata:** see final docs commit below

## Files Created/Modified

- `scripts/serve-pages.mjs` (119 lines) - `site(port, mount, dir)` factory over `node:http`/`node:fs`/`node:path`: prefix check, `decodeURIComponent` guard, `path.join` + `startsWith(root)` traversal guard, `statSync` directory branch (301 with preserved query, `index.html` or `404.html`), content-type map for `.html/.js/.css/.json/.svg/.woff2`; root and sub listeners gated on their build directory, attacker listener unconditional with the three contract iframes; SIGTERM/SIGINT/SIGHUP handlers and the env-gated stdin-close exit
- `apps/web/playwright.config.ts` (55 lines) - win32 `System32` PATH prepend with explanatory comment; ports from env with 4273/4274/4275 defaults; `testDir: 'tests/e2e'`, `forbidOnly`/`retries`/`reporter` keyed on `CI`, Desktop Chrome with `trace: 'retain-on-failure'`; single `webServer` running `node ../../scripts/serve-pages.mjs` with the three port vars and `SERVE_PAGES_EXIT_ON_STDIN_END: '1'`, `url` on the attacker listener, `reuseExistingServer: false`, `timeout: 30_000`; projects `root` and `sub` (`testIgnore: /framing\.spec/`)
- `apps/web/tests/e2e/routing.spec.ts` (63 lines) - four tests: every route in `['', 'renter/', 'investor/', 'agent/', 'settings/', 'print/']` is 200 with a visible `h1`; `page.goto('renter')` lands on `/renter/$` and survives `page.reload()`; `does-not-exist/deeper/` is 404 with `404` in the `h1`; every `a:not([href^="#"])` resolves via `new URL(href, page.url())` to a trailing-slash pathname and, on `sub`, to `/tran_real_estate/...` (the at-least-one-link guard skips `print/`)

## Decisions Made

- **Readiness probe on the attacker listener.** Kept the plan's one deliberate deviation from the RESEARCH example: the root listener does not exist on CI's `sub` matrix leg, the attacker listener always answers 200, so `webServer.url` is `http://127.0.0.1:${ATTACKER}/`.
- **Config-level PATH guard instead of a machine repair.** The Windows teardown failure is environmental (machine PATH omits `C:\Windows\System32`), but a repo that only works after an owner edits their machine is fragile. `playwright.config.ts` is evaluated inside the runner process, so prepending `%SystemRoot%\System32` there makes `taskkill` resolvable for Playwright's kill call with no machine change. The machine-level repair remains an owner decision.
- **Opt-in stdin-close exit in the emulator.** Playwright on Windows cannot signal the grandchild it launches through `cmd.exe`, but the grandchild's stdin does close when the parent dies. The exit-on-stdin-end behaviour is gated on `SERVE_PAGES_EXIT_ON_STDIN_END=1` (set only by the Playwright config) because a shell background job inherits a closed stdin and would otherwise exit before serving a request. SIGTERM/SIGINT/SIGHUP handlers make POSIX and CI teardown immediate.
- **`print/` exempt from the link-count guard.** The print surface deliberately carries only the skip link; the href-shape assertions still run over whatever links it has.
- **Requirements not marked complete.** Same convention as 01-01..01-04: FND-01's routing contract is proven here, and 01-09 runs the full suite and closes it. `requirements mark-complete` deferred to 01-09.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Playwright webServer teardown stalled ~140 s per run on this Windows machine**
- **Found during:** Task 2 verification (the original executor stalled for 10 minutes)
- **Issue:** This machine's PATH (machine-level) omits `C:\Windows\System32`, so `taskkill` does not resolve. Playwright's Windows webServer teardown is solely `taskkill /pid <pid> /T /F` (output discarded), so the server was never killed and Playwright waited ~140 s per run before giving up. The tests themselves passed in ~2.5 s.
- **Fix:** (1) `apps/web/playwright.config.ts` prepends `%SystemRoot%\System32` to `process.env.PATH` on win32 at config-evaluation time (the config runs inside the runner process), with a comment explaining why. It also sets `SERVE_PAGES_EXIT_ON_STDIN_END=1` in `webServer.env`. (2) `scripts/serve-pages.mjs` gained SIGTERM/SIGINT/SIGHUP handlers (POSIX/CI) and an env-gated stdin-close exit (opt-in so a shell background job with a closed stdin still serves).
- **Verification:** After the fix, `corepack pnpm --filter web exec playwright test routing --workers=1` reported 8 passed (4.7 s), the webServer terminated in 0.66 s, total run 6 s, ports 4273-4275 released. `corepack pnpm lint` green. Re-verified identically in this continuation (8 passed, 6 s wall clock, ports released).
- **Files modified:** `apps/web/playwright.config.ts`, `scripts/serve-pages.mjs`
- **Commit:** `17e79d6`
- **Not done:** Machine-level PATH repair was NOT performed (owner decision pending); the config-level guard makes the repo independent of it.

**2. [Rule 1 - Bug] Routing spec required navigation links on `print/`**
- **Found during:** Task 2 verification (test 4 failed on `print/` under both projects)
- **Issue:** The "at least one link" guard ran on every route, but `print/` by design carries only the `#main-content` skip link, which the fragment exclusion correctly removes, leaving zero links.
- **Fix:** The guard is skipped for `print/`; the trailing-slash and base-prefix assertions still run over every non-fragment link on every route.
- **Files modified:** `apps/web/tests/e2e/routing.spec.ts`
- **Commit:** `17e79d6`

### Process note

The original executor stalled and was not resumed; the orchestrator diagnosed the stall, applied the fixes above, verified, and committed Task 2 together with the teardown fix and a STATE.md note as `17e79d6`. This continuation re-verified the acceptance criteria against the committed state and produced the docs; no source file was changed here.

---

**Total deviations:** 2 auto-fixed (1 x Rule 3, 1 x Rule 1)
**Impact on plan:** None on scope or interfaces. All three artifacts exist with the contracted env vars, ports, iframe ids and project names; the additions beyond the RESEARCH prototypes are the teardown contract (PATH guard + signal/stdin handlers) and the `print/` exemption.

## Issues Encountered

- **Plan Task 1 one-liner aborts on exit (harness, not emulator).** The plan's inline probe prints the correct `{ a: 301, b: 200, c: 404, d: 200 }` but then dies with `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\win\async.c, line 94` (exit 127) on Node v24.18.0/win32. Isolated with three controls: the identical probe using `process.exitCode` and a natural exit returns 0; spawn + kill + `process.exit()` without `fetch` returns 0; `fetch` + a 300 ms grace + `process.exit()` returns 0. The abort is therefore `process.exit()` called synchronously while undici's keep-alive sockets are still closing, a libuv race inside the harness. The emulator's behaviour and port release are correct in every variant. Future plans that script a probe should set `process.exitCode` and let the loop drain, or wait a tick before `process.exit()`.
- Wall-clock duration is not meaningful for this plan (Task 1 on 2026-09-17, Task 2 committed 2026-09-22 after the stall was diagnosed); the metric above is active time.

## Known Stubs

None. All three files are complete deliverables; no placeholder values flow anywhere.

## User Setup Required

None for the repo. Optional, owner decision: add `C:\Windows\System32` back to the machine-level PATH. Not required for this repo (the config guard covers it), but other tools that shell out to `taskkill`, `where`, `findstr` and similar will keep failing silently until it is fixed.

## Requirements Status

| ID | This plan delivers | Still open | Closed by |
|----|-------------------|------------|-----------|
| FND-01 | Deep link, 301 redirect, refresh and branded 404 proven under `/` and `/tran_real_estate/` against real built output with Pages semantics; base-correct links asserted | CI wiring (per-target matrix) and full-suite run | 01-08, 01-09 |
| FND-03 (harness) | Attacker page with the three contract iframe ids, always-on listener | Framing spec | 01-07, 01-09 |

## Next Phase Readiness

- 01-07 can add `framing.spec.ts`, `csp.spec.ts` and `axe.spec.ts` under `apps/web/tests/e2e/` with no config change; the `sub` project already ignores `framing.spec`, and the attacker page serves iframes `plain`, `sandboxed`, `sandboxed-scripts` against the root origin
- 01-08 can run `pnpm test:e2e` per matrix leg after building one target; the readiness probe on port 4275 answers regardless of which build exists, and `scripts/workflow-gate.test.ts` should pin the `${ATTACKER}` probe contract
- 01-09 runs the composed `pnpm verify`; nothing here needs machine setup beyond the Chromium binary (`playwright install chromium`, machine cache only)
- Wave 4 sole ownership of `apps/web/build*` ends with this plan; wave 5 (01-07 and 01-08) may proceed in parallel with `--no-verify` per the established parallel-wave convention
- No remote, no push, branch `main`

## Self-Check: PASSED

`scripts/serve-pages.mjs`, `apps/web/playwright.config.ts` and `apps/web/tests/e2e/routing.spec.ts` exist on disk; commits `d915844` and `17e79d6` are present in `git log`.

---
*Phase: 01-foundation-origin-security-baseline*
*Completed: 2026-09-22*
