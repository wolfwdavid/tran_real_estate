---
phase: 14-carried-debt
plan: 04
subsystem: extension / site URL
tags: [testing, extension, origin-parity, debt]
requires: []
provides:
  - "scripts/origin-parity.test.ts: evaluated-module parity of the extension TRAN_SITE_URL / PRIVACY_URL with resolveSiteUrl()"
affects:
  - scripts/extension-docs.test.ts
  - scripts/assert-extension.test.ts
  - scripts/site-url.test.ts
  - .planning/REQUIREMENTS.md
  - .planning/ROADMAP.md
tech-stack:
  added: []
  patterns:
    - "vi.stubGlobal('__TRAN_SITE_URL__', define) + vi.resetModules() + dynamic import to evaluate a module that reads a bundler define"
key-files:
  created:
    - scripts/origin-parity.test.ts
  modified:
    - scripts/extension-docs.test.ts
    - scripts/assert-extension.test.ts
    - scripts/site-url.test.ts
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md
decisions:
  - "The docs test composes PRIVACY_URL from an explicit LIVE_SITE_ENV ({ BASE_PATH: '/tran_real_estate' }), never process.env, so it is env-independent in CI and locally"
  - "Env stubs use vi.stubEnv(name, undefined) so case A is genuinely unset rather than an empty string"
metrics:
  duration: "about 15 min"
  completed: 2026-11-05
requirements: [DEBT-04]
---

# Phase 14 Plan 04: Origin parity from the evaluated extension module Summary

A scripts-project test now imports the real `apps/extension/src/lib/site.ts` with the WXT define stubbed in as `__TRAN_SITE_URL__`, and proves `TRAN_SITE_URL` / `PRIVACY_URL` equal what `resolveSiteUrl()` composes. It also proves that all three `__TRAN_SITE_URL__` defines agree and that the privacy anchor exists. The extension doc and bundle tests no longer carry literal privacy URLs.

## What was built

- `scripts/origin-parity.test.ts` (10 tests). It uses `describe.each` over three env cases:
  - A: `PUBLIC_SITE_URL` and `BASE_PATH` unset, giving `https://wolfwdavid.github.io`
  - B: `{ BASE_PATH: '/tran_real_estate' }`, giving `https://wolfwdavid.github.io/tran_real_estate`
  - C: `{ PUBLIC_SITE_URL: 'https://example.org', BASE_PATH: '/x' }`, giving `https://example.org/x`

  Each case has three tests: the WXT define equals `resolveSiteUrl()`; the evaluated `site.ts` exports `TRAN_SITE_URL` and `PRIVACY_URL` from that define; and the WXT, `vitest.config.ts` and `vitest.browser.config.ts` defines agree. A tenth test checks `<h2 id="browser-extension">` in the privacy page source.
- `scripts/extension-docs.test.ts`: `PRIVACY_URL = `${resolveSiteUrl(LIVE_SITE_ENV)}/legal/privacy/#browser-extension`` replaces the literal. `RETIRED_HOST` is kept.
- `scripts/assert-extension.test.ts`: the golden fixture (:76) and the allowlisted-URL case (:414) use `resolveSiteUrl()`. `DEFAULT_SITE_ORIGIN` is still imported, since lines 187, 398, 445, 458-465 and 505 use it and were left alone on purpose.
- `scripts/site-url.test.ts`: the header comment points to origin-parity.test.ts. Only the comment changed.
- REQUIREMENTS DEBT-04 and ROADMAP Phase 14 criterion 3 were reworded to describe `TRAN_SITE_URL` / `resolveSiteUrl()`. They were committed together with the test edits (D-06). The checkbox is still unticked, because ticking is the close-out plan's job.

## Verification

| Run | Env | Result |
| --- | --- | --- |
| `vitest run --project scripts scripts/origin-parity.test.ts` | none | 10 passed |
| four touched scripts test files | none | 4 files, 115 passed |
| four touched scripts test files | `BASE_PATH` exported (`/tran_real_estate`) | 114 passed, 1 failed: `assert-extension.test.ts:187` (see below). `extension-docs.test.ts` and `origin-parity.test.ts` pass |
| `vitest run --project scripts` (whole project) | none | 35 files, 1059 passed |
| `vitest run --project extension` | none | 17 files, 242 passed |
| `prettier --check` on the four test files | n/a | clean |
| `git diff --stat apps/extension/src/lib/site.ts scripts/vitest.config.ts` | n/a | empty |

The single failure with `BASE_PATH` exported is at `assert-extension.test.ts:187`, `expect(URL_ALLOWLIST).toContain(`${DEFAULT_SITE_ORIGIN}/`)`. That line asserts the default allowlist on purpose, and the plan says to leave it unchanged. The failure is not new. On the pre-change file, the same exported-env run failed 5 tests (:187 plus the four fixture and CLI cases that used `DEFAULT_SITE_ORIGIN`). After this plan it fails only :187, so the edits removed four env-dependent failures and added none. This matches the 2026-10-31 lesson: `test:unit` runs with no deploy env, and that is the shape CI uses.

## Mutation ledger

| # | Mutant | Expected red | Observed | Restored |
| --- | --- | --- | --- | --- |
| a | `wxt.config.ts` define `resolveSiteUrl()` changed to `resolveSiteOrigin()` | case B | 6 failed (cases B and C, all three tests each); case A stays green because origin equals URL without a base | `git diff --stat` empty, 10/10 green |
| b | `site.ts` `/legal/privacy/` changed to `/legal/privac/` | PRIVACY_URL assertion | 3 failed (evaluated-module test in A, B, C) | `git diff --stat` empty, green |
| c | privacy page `id="browser-extension"` changed to `id="browser-ext"` | anchor check | 1 failed (anchor test) | `git diff --stat` empty, green |
| d (extra) | `vitest.browser.config.ts` define changed to `resolveSiteUrl({})` | defines-agree test | 2 failed (cases B and C) | `git diff --stat` empty, green |

4/4 mutants caught (3/3 planned plus 1 extra).

## Deviations from Plan

- TDD RED note: the behavior already existed, so the new test passed on first run. Its non-vacuity is shown by the mutation ledger above, not by a failing-first commit.
- An acceptance line says `grep -c "TRAN_ORIGIN"` should be 0 on the DEBT-04 line. The replacement text the plan prescribes contains "`TRAN_ORIGIN` was removed in 13-10", so the prescribed text was used and the line keeps that historical mention. The Phase 14 ROADMAP section has no `TRAN_ORIGIN` mention. The remaining ROADMAP mentions (:74, :86) are in Phase 12 and are out of scope.
- The env-exported run is not fully green because of the pre-existing `assert-extension.test.ts:187` default-allowlist assertion, which the plan protects. Details are in Verification. Nothing was changed for it.

## Known Stubs

None.

## Commits

- fdb33d1 test(14-04): origin parity test evaluates the real extension site module
- b5e8903 test(14-04): doc and bundle tests build the privacy URL from resolveSiteUrl

## Self-Check: PASSED
