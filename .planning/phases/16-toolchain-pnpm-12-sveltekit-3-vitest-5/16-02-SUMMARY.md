---
phase: 16-toolchain-pnpm-12-sveltekit-3-vitest-5
plan: 02
subsystem: testing
tags: [test-guard, vitest, playwright, mutation-testing, ci]

requires:
  - phase: 16-01
    provides: "Smoke pre-flight (live smoke green at e04ba10)"
provides:
  - "test-lane-rules.mjs reports zero/negative timeouts, options passed by reference/spread/shorthand, default-timeout setters, test API aliases, runner CLI flags and workflow re-runs"
  - "tooling/vitest/lanes.ts is scanned as config; serialTest() refuses VITEST_MAX_WORKERS"
  - "Lane exclusions and Playwright flaky/worker pins are behavioural or AST-based, not substring checks"
affects: [16-03, 16-05, phase-16 final gate]

tech-stack:
  added: []
  patterns:
    - "Guard fixes are proven by a planted bypass that passes before the fix and fails when the fix is reverted (mutation table)"
    - "Fail closed: anything the guard cannot read (identifier options, spreads, aliases, non-literal defineConfig) is a finding"

key-files:
  created:
    - scripts/lane-configs.test.ts
  modified:
    - scripts/lib/test-lane-rules.mjs
    - scripts/test-lane-rules.test.ts
    - scripts/test-lanes.test.ts
    - tooling/vitest/lanes.ts

key-decisions:
  - "Behavioural exclusion pin lives in a new scripts-serial file (lane-configs.test.ts): importing apps/web/vite.config.ts costs 3.2 s cold, 64% of the 5 s default"
  - "Identifier spreads in config roots are NOT flagged: the four serial configs legitimately do { ...base, test: { ...base.test, ...serialTest(lane) } }; serialTest() itself is now scanned instead"
  - "page/context setDefault*Timeout use the 30 s Playwright default as the ceiling; Vitest browser locator/matcher timeout options use the 1 s wait default"

requirements-completed: []  # TOOL-06 is the phase final-gate requirement (also carried by 16-10 and 16-13); left Pending

duration: n/a
completed: 2026-11-11
---

# Phase 16 Plan 02: Test-guard hardening (CR-01, WR-02..WR-05, WR-06 slice, WR-08) Summary

**The Phase 15 guard now sees `timeout: 0`, options passed by variable/spread/shorthand, `setDefault*Timeout`, `testInfo` raises, aliased test APIs, runner CLI flags, `continue-on-error` and `||` re-runs, and the lane manifest itself; every fix is backed by a planted bypass that passed before and fails with the fix reverted.**

## Tasks

| Task | Name | Commit |
|------|------|--------|
| 1 | CR-01 zero/negative timeouts, WR-02 reference/spread/shorthand options | a113cfa |
| 2 | WR-03 timeout-raising APIs, WR-04 lanes.ts, CLI flags, workflow re-runs | 2d462d3 |
| 3 | WR-05 behavioural exclude pin, WR-06 negation, WR-08 serialTest refusal | 752815e |

## Mutation tables

Method: tests were written first. For Tasks 1 and 2 the new tests were run against the unfixed module (26 and 24 failures respectively, i.e. the bypass was not detected: "passes before fix"). Each fix was then reverted one at a time with a scratch harness (outside the repo, always restored in `finally`) and the planted cases re-run ("fails when reverted"). Task 3 rows use the reverted state as the "before" state. No mutant was committed; `git status` was clean of mutants after every run.

Only one planted case was already caught before the fix: a literal `-1` timeout (a prefix-unary expression is not a numeric literal, so the old rule treated it as non-literal = raised). It is kept as a regression case.

### Task 1 (CR-01, WR-02): test-lane-rules.mjs

| Fix (reverted as mutant) | Planted case | Before fix | Fix reverted |
|--------------------------|--------------|------------|--------------|
| `isRaised`: `value <= 0` | `{ timeout: 0 }`, trailing `0`, `expect.poll {timeout:0}`, hook `0`, `test.setTimeout(0)`, `toBeVisible({timeout:0})`, `describe.configure({timeout:0})`, `testTimeout: 0`, `hookTimeout: 0`, Playwright `timeout: 0` and `expect.timeout: 0` | passes (not flagged) | 10 tests fail |
| Hook trailing timeout read from `args[1]` | `beforeAll(setup, 600000)` | passes | 2 fail |
| Vitest `reference` branch | `const o = {timeout: 600000}; test('a', o, fn)`, `test('a', run, MS)` | passes | 2 fail |
| Vitest inline-object spread | `test('a', { ...o }, fn)` | passes | 2 fail |
| Trailing numeric after a callback held in a name | `test('a', run, 600000)`, `test('a', wrap(fn), 600000)` | passes | 4 fail |
| `expect.poll`/`expect.element` options by reference | `expect.poll(fn, opts)` | passes | 2 fail |
| Vitest retry: reference | `test('a', o, fn)` with `retry` in `o` | passes | 1 fail |
| Vitest retry: spread | `test('a', { ...o }, fn)` | passes | 1 fail |
| Vitest config shorthand `retry` | `defineConfig({ test: { retry } })` | passes | 1 fail |
| Playwright config shorthand `retries` | `defineConfig({ retries })` | passes | 1 fail |
| Config shorthand `testTimeout` | `{ test: { testTimeout } }` | passes | 1 fail |
| `defineConfig(x)` non-literal finding | `const c = {...}; defineConfig(c)` | passes | 1 fail |
| Playwright matcher options by reference | `toBeVisible(opts)`, `toHaveText('x', opts)`, `toBeVisible({...o})` | passes | 1 fail |
| `expect.configure(opts)` reference | `expect.configure(opts)` | passes | 1 fail |
| `describe.configure(opts)` reference | `test.describe.configure(opts)` and Prettier-wrapped form | passes | 2 fail |
| Playwright spread inside matcher/configure options | `toBeVisible({ ...o })` | passes | 1 fail |
| Playwright retry: `describe.configure(opts)` | `test.describe.configure(opts)` carrying retries | passes | 1 fail |

### Task 2 (WR-03, WR-04)

| Fix (reverted as mutant) | Planted case | Before fix | Fix reverted |
|--------------------------|--------------|------------|--------------|
| `setDefaultTimeout`/`setDefaultNavigationTimeout` on any receiver | `page.`, `context.`, `setDefaultTimeout(0)`, Prettier-wrapped | passes | 5 fail |
| `testInfo`/`info` receivers for `setTimeout`/`slow` | `testInfo.setTimeout(600000)`, `testInfo.slow()` | passes | 2 fail |
| Playwright config `expect.toPass.timeout` | `expect: { toPass: { timeout: 600000 } }` | passes | 1 fail |
| Vitest browser locator/matcher `timeout` option | `expect.element(l).toBeVisible({timeout:60000})`, `page.getByRole().click(...)`, `timeout: 0` | passes | 3 fail |
| `test.extend` alias finding | `const t = test.extend({})` | passes | 1 fail |
| `import { test as t }` alias finding | `import { test as t }`, `beforeAll as setup` | passes | 1 fail |
| `fileKind('tooling/vitest/lanes.ts') = vitest-config` | `{ testTimeout: 600000, retry: 3 }` in lanes.ts | passes | 2 fail (rules test + sweep coverage test) |
| `.[cm]?[jt]s` extension widening (playwright / vite) | `.mts`, `.cts`, `.js`, `.mjs` configs | passes | 1 + 1 fail |
| `vitest.workspace.*` classification | `vitest.workspace.ts/.mts` | passes | 1 fail |
| CLI flag set (timeout/worker flags) | `--testTimeout`, `--hookTimeout`, `--timeout`, `--workers`, `--maxWorkers`, `--max-workers` in package.json, workflow line, mjs string and template | passes | 10 fail |
| Kebab-case Vitest flags | `--test-timeout`, `--hook-timeout` | passes | 2 fail |
| `continue-on-error` rule | `continue-on-error: true` and `${{ matrix.x }}` | passes | 1 fail |
| `||` re-run rule | `pnpm test:unit \|\| pnpm test:unit`, block scalar, `playwright test \|\| true`, `pnpm smoke \|\| pnpm smoke` | passes | 1 fail |
| `${{ }}` masking | `--reporter ${{ vars.R \|\| 'dot' }}` must stay silent | n/a (negative control) | 1 fail |
| Block scalar end detection | later `other: pnpm test:unit \|\| true` must stay silent / in-block `\|\|` must be seen | n/a | 2 fail |
| Test-runner regex tightness | `pnpm install \|\| echo ''` must stay silent | n/a (negative control) | 1 fail |

### Task 3 (WR-05, WR-06 slice, WR-08)

| Fix (reverted as mutant) | Planted case | Before fix (= reverted) | After fix |
|--------------------------|--------------|-------------------------|-----------|
| `!NOT_MEASURED.test(c)` | `// not measured; 60 s is a guess, cause unknown`, `un-measured`, `never measured`, `wasn't measured`, `has not been measured`, and a Playwright raise | accepted (no finding) | rejected; 6 tests fail when reverted |
| `serialTest()` throws on `VITEST_MAX_WORKERS` | `4`, `1`, `0`, empty string, for all four lanes | loads silently | 1 test fails when reverted; a truthy-only variant (misses `''`) also fails |
| Behavioural exclude pin, web | real `apps/web/vite.config.ts` with `, ...files('web')` deleted and the comment kept | old substring pin stayed green (comment names `files('web')`) | pin fails (2 tests) |
| Behavioural exclude pin, core / web-browser / scripts | the same deletion in `packages/core/vitest.config.ts`, `apps/web/vitest.browser.config.ts`, `scripts/vitest.config.ts` | old pin green | each fails its own lane test |
| AST pin: smoke `failOnFlakyTests` | line commented out (`// failOnFlakyTests: true,`) | no pin existed | fails |
| AST pin: web `failOnFlakyTests` | line commented out | old substring pin green | fails |
| AST pin: smoke `retries` | `retries: 1, // retries: 0,` | substring would pass | fails (also the repo sweep via PINNED_RETRIES) |

All mutants were applied to real files in the working tree and restored in `finally`; `git status` afterwards showed only intended edits.

## Real-tree findings from the widened rules

None. The repo sweep (`scripts/test-lanes.test.ts`, every tracked or untracked-not-ignored file) reports no finding with the new rules, so no real file had to be annotated, fixed or allowlisted. Coverage assertions now also require every `package.json` and every `.github/workflows/*.yml` in the repo to be scanned, and `tooling/vitest/lanes.ts` to be classified as `vitest-config`.

## Unfixed 15-REVIEW items (judgement: could a migration commit use this to go green?)

| Item | Reachable by a migration commit | Reason |
|------|--------------------------------|--------|
| WR-01 elapsed-time rule sees only three callees and a direct `Date.now()` operand | no | Adds a timing assertion; it cannot make a red migration green or hide a raised timeout. Left recorded. |
| WR-06 (rest): annotation scoping (blank line plus unrelated comment; same-named `const` in another function) | no | Needs an unrelated annotation to already exist and a raise to be added to the serial lane; a migration commit gains nothing the negation fix did not already close. The negation case itself IS fixed (it let "not measured; 60 s is a guess" through). |
| WR-07 worker counts pinned, not capped by CPU count | no | Does not weaken any assertion; affects only smaller machines. |
| WR-09 `test-evidence.test.ts` hard-codes one machine's row shapes | no | Affects only the evidence file written by the final plan on the same machine. |
| IN-01 .. IN-07 | no | Informational; none changes what the guard accepts for timeouts, retries or lanes. |

## Deviations from Plan

**1. [Rule 3 - Blocking] Repo sweep got slower, then timed out; fixed by caching the parse, not by raising a timeout.**
- **Found during:** Task 3 full run (the sweep test hit 5139 ms against its 5000 ms default; the known pre-existing note from 16-01).
- **Issue:** the widened rules plus lanes.ts made `scanFile` slower (each file was parsed three times, once per rule).
- **Fix:** a one-slot `(path, text)` parse cache in `test-lane-rules.mjs`. The sweep went from about 4.9 s to about 2.2 s (three runs: 2.5, 2.2, 2.0 s). No timeout raised, no retry added.
- **Commit:** 752815e

**2. [Plan shape] The behavioural exclusion pin is in a new file, `scripts/lane-configs.test.ts`, registered in the scripts serial lane.**
- Reason: importing `apps/web/vite.config.ts` loads the Kit, Tailwind and Svelte plugins and took 3.2 s cold (64% of the 5 s default) in the parallel lane. The manifest `reason` records the measurement. `scripts/test-lanes.test.ts` keeps a light on-disk check that the file is registered. `apps/web/vite.config.ts` itself is unchanged (the plan lists it in `files_modified`; only temporary mutants touched it). `.github/workflows/ci.yml` also needed no change.
- **Commit:** 752815e

**3. [Design note] Config-root identifier spreads are not flagged.** `{ ...base, test: { ...base.test, ...serialTest(lane) } }` is how all four serial configs are written, so flagging identifier spreads in configs would reject the real tree. The risk is covered instead by scanning `serialTest()` (lanes.ts) and by flagging `defineConfig(x)` with a non-literal argument and shorthand keys.

## Known limitations (documented, not fixed)

- Playwright `testInfo` receivers are recognised by name (`testInfo`, `info`) plus `test.info()`; a differently named fixture parameter would escape the `setTimeout`/`slow` rule.
- Matcher-options-by-reference is checked only for matchers in `MATCHER_OPTION_INDEX`; an unlisted matcher passing a variable as its options argument is not seen.
- The Vitest browser locator rule applies to calls in browser-lane files only and uses the 1 s wait default as the ceiling; the real tree produced no hit, so the ceiling was not tuned against data.

## Gates run

- `corepack.cmd pnpm exec vitest run --project scripts --project scripts-serial`: 44 files, 1354 tests, all pass (after the parse-cache fix; the first full run had the one sweep timeout described above).
- `corepack.cmd pnpm lint` (prettier + eslint): clean.
- `corepack.cmd pnpm check`: apps/web 3271 files, apps/extension 1079 files, 0 errors, 0 warnings.
- `git diff --stat -- pnpm-lock.yaml package.json`: empty (no dependency change).
- `fileKind('tooling/vitest/lanes.ts')` prints `vitest-config`.

## Known Stubs

None.

## Threat Flags

None.

## Self-Check: PASSED
- Commits a113cfa, 2d462d3 and 752815e exist on main; none carries a co-author trailer.
- Created file `scripts/lane-configs.test.ts` exists.
- TOOL-06 left Pending in REQUIREMENTS.md (final-gate requirement carried by 16-10 and 16-13 as well).
