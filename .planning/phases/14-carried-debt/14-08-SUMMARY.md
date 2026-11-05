---
phase: 14-carried-debt
plan: 08
subsystem: E2E harness / GitHub Pages emulator
tags: [testing, emulator, github-pages, dotfiles, debt]
requires:
  - "14-04 (serialized edits to REQUIREMENTS.md and ROADMAP.md)"
provides:
  - "scripts/serve-pages.test.ts: spawned-emulator parity test pinning the measured live dotfile behaviour"
  - "SERVE_PAGES_WEB_DIR: test-only override of the emulator's web dir"
affects:
  - scripts/serve-pages.mjs
  - .planning/REQUIREMENTS.md
  - .planning/ROADMAP.md
tech-stack:
  added: []
  patterns:
    - "Spawn a module that binds at import time on OS-assigned free ports (net.createServer().listen(0)), wait for its listen log lines, talk to it with node:http, shut it down through the stdin-end contract"
key-files:
  created:
    - scripts/serve-pages.test.ts
  modified:
    - scripts/serve-pages.mjs
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md
decisions:
  - "Live probe 2026-11-05 matched the emulator on every measurable case, so site() is unchanged; DEBT-08 closes with the test and the one-line web-dir override (D-05)"
  - "The test pins BASE_PATH='' in the child env so the root listener mounts at / regardless of the caller's shell"
metrics:
  duration: "about 10 min"
  completed: 2026-11-05
requirements: [DEBT-08]
---

# Phase 14 Plan 08: Measured dotfile parity for serve-pages Summary

The live origin was probed for dotfile behaviour on 2026-11-05 and matched the emulator on every case it could measure. `scripts/serve-pages.mjs` gets only a test-only `SERVE_PAGES_WEB_DIR` override. A new scripts-project test spawns the emulator against a fixture build and pins each measured case on the root and `/tran_real_estate` listeners. DEBT-08 and ROADMAP criterion 5 now describe the measured behaviour instead of "404 for dotfiles".

## Live probe (Task 1)

Four `curl -sI` requests at 2026-11-05T21:28:32Z to 21:28:33Z. None were rate-limited, so no retries were needed.

| Case | URL | Live status | Emulator today (from reading site()) | Delta |
| --- | --- | --- | --- | --- |
| Existing dotfile | `https://wolfwdavid.github.io/tran_real_estate/.nojekyll` | `HTTP/1.1 200 OK`, Content-Length 0, `application/octet-stream`, request id 29A8:3538C:318DB8:3BDC1E:6AECF4FF | 200 (any existing file is sent; extname `''` gives `application/octet-stream`) | match |
| Dot-directory path with a slash | `.../tran_real_estate/.well-known/` | `HTTP/1.1 404 Not Found`, Content-Length 3180, `text/html; charset=utf-8`, request id DDD0:90DF9:2EFBAD:394BBA:6AECF4FF | 404 via 404.html (statSync miss) | match |
| Missing dotfile | `.../tran_real_estate/.no-such-dotfile` | `HTTP/1.1 404 Not Found`, Content-Length 3180, `text/html; charset=utf-8`, request id 0926:23E93D:304970:3A981A:6AECF500 | 404 via 404.html (statSync miss) | match |
| Dot-directory path without a slash | `.../tran_real_estate/.well-known` | `HTTP/1.1 404 Not Found`, Content-Length 3180, `text/html; charset=utf-8`, request id 0CD4:233AB8:2DE408:3838A3:6AECF4FF | 404 via 404.html (it does not exist, so there is no 301) | match |
| Existing dot-directory | n/a | not measurable: the build ships none (`apps/web/build` has only `.nojekyll` at the top level) | 301 / index.html like any directory | not measured, no change |

**Decision:** the emulator matches. DEBT-08 closes with the test alone (D-05). `site()` is unchanged.

## What was built (Task 2)

- `scripts/serve-pages.mjs`: the web dir now resolves `process.env.SERVE_PAGES_WEB_DIR ?? path.join(import.meta.dirname, '../apps/web')`, and a one-line comment marks the override as test-only. Prettier wrapped the expression, so the diff reads +4/-1, but it is still a single statement. `grep -c SERVE_PAGES_WEB_DIR` returns 2.
- `scripts/serve-pages.test.ts` has 9 tests:
  - Fixture: `mkdtempSync` holds `build/`, `build-sub/` and `build-configured/`, each with `index.html`, `404.html` (`fixture-404`), an empty `.nojekyll` and `sub/index.html`.
  - Process: four free ports come from `listen(0)`. The test spawns `process.execPath serve-pages.mjs` with `SERVE_PAGES_EXIT_ON_STDIN_END=1` and waits for 4 `serve-pages:` lines (10 s timeout). `afterAll` ends stdin, awaits `exit`, then removes the fixture.
  - Root listener (6 tests): `/.nojekyll` 200 with an empty body. `/.no-such-dotfile`, `/.well-known/` and `/.well-known` each 404 with the fixture 404 body, and the last has no `location`. Control: `/sub` 301 to `/sub/`, and `/sub/` 200.
  - Sub listener (3 tests): `/tran_real_estate/.nojekyll` 200. The three 404 cases under `/tran_real_estate/`. Control: `/tran_real_estate/sub` 301 to `/tran_real_estate/sub/`.
- `.planning/REQUIREMENTS.md` DEBT-08 now reads "matches the measured GitHub Pages dotfile behaviour (probed 2026-11-05: `/.nojekyll` 200, a missing dotfile 404, a dot-directory path 404) ...". It is still unchecked `- [ ]`.
- `.planning/ROADMAP.md` Phase 14 criterion 5 has its dotfile clause replaced as the plan specified. `grep -c "answers 404 for dotfiles"` returns 0 in both files.

## Verification

- TDD RED, without the override: 7 failed, 2 passed (9). The emulator served the real `apps/web/build*` dirs, so the fixture bodies and `/sub` were missing.
- GREEN: `vitest run --project scripts scripts/serve-pages.test.ts` gave 9 passed (9) in 1.17 s.
- Full scripts project: 36 files, 1068 tests passed, 40.1 s. `vitest list` confirms `scripts/serve-pages.test.ts` is in the project.
- Playwright boot path with the override unset: I started it on non-default ports 48273-48276, because 4273-4276 belong to the parallel 14-09 Playwright run, and closed stdin after 1.5 s:
  ```
  serve-pages: http://127.0.0.1:48273/ -> ...\tran_real_estate\apps\web\build
  serve-pages: http://127.0.0.1:48274/tran_real_estate -> ...\tran_real_estate\apps\web\build-sub
  serve-pages: http://127.0.0.1:48276/ -> ...\tran_real_estate\apps\web\build-configured
  serve-pages: http://127.0.0.1:48275/ -> attacker page + beacon collector
  exit=0
  ```
- No build, Playwright or browser-mode run was needed, so the build lock was not taken.

## Mutation ledger

| # | Mutant | Expected red | Observed | Restored |
| --- | --- | --- | --- | --- |
| a | `site()`: after the traversal guard, `if (rel.split('/').some((seg) => seg.startsWith('.'))) return notFound();`, the old "404 for any dot segment" premise | the `/.nojekyll` cases | 2 failed (root `/.nojekyll`, sub `/tran_real_estate/.nojekyll`), 7 passed | file restored from backup, `grep -c MUTATION` returns 0, 9/9 green |

## Commits

| Task | Commit | Subject |
| --- | --- | --- |
| 1 | none | probe only; results recorded here |
| 2 | ba39b0c | fix(14-08): pin serve-pages dotfile behaviour to the measured live origin |

## Deviations from Plan

- The test waits for 4 `serve-pages:` lines, not "3+". The fixture creates all three build dirs, so all four listeners must be up before the first request. This is stricter than the plan, not a behaviour change.
- The RED run was not committed separately. The plan (D-05) requires a single commit carrying the fix, the test and both planning files.

Otherwise the plan was executed as written.

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: scripts/serve-pages.test.ts
- FOUND: scripts/serve-pages.mjs (2 x SERVE_PAGES_WEB_DIR)
- FOUND: commit ba39b0c
