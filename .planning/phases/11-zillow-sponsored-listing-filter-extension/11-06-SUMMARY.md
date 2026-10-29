---
phase: 11-zillow-sponsored-listing-filter-extension
plan: 06
subsystem: extension
tags: [eslint, mv3, oracle, mutation-testing, zero-network, EXT-03]

requires:
  - phase: 11-01
    provides: "wxt.config.ts POPUP_CSP + manifest from COPY; extension package and lint ignores"
provides:
  - "ESLint extension block: network primitives are lint errors under apps/extension/src (fetch ban re-spread)"
  - "scripts/assert-extension.mjs: checkManifest, scanBundle, checkOutput, listZipEntries, checkZip, checkZipDir + CLI"
  - "scripts/assert-extension.test.ts: 61-test golden + planted-fault mutation suite (tmpdir only)"
affects: [11-10, 11-11, 11-12]

tech-stack:
  added: []
  patterns:
    - "noFetch hoisted and re-spread into any block that sets no-restricted-syntax (flat config replaces options)"
    - "Default-deny top-level manifest keys (ALLOWED_KEYS) on top of the named FORBIDDEN_KEYS"
    - "Exact-message assertions where another check could echo the planted value"

key-files:
  created:
    - scripts/assert-extension.mjs
    - scripts/assert-extension.test.ts
  modified:
    - eslint.config.js
    - scripts/eslint-rules.test.ts

key-decisions:
  - "11-06: the root restrictedSyntax list is split into noFetch + the $effect rule; the extension block re-spreads ...noFetch (the $effect/gateway rule is web-only)"
  - "11-06: oracle adds a default-deny ALLOWED_KEYS list (manifest_version, name, short_name, description, version, version_name, icons, permissions, host_permissions, action, background, content_scripts, content_security_policy); the real WXT 0.21.4 output uses exactly this set"
  - "11-06: CLI exit 2 on usage error, 1 on any problem; --zip-dir requires exactly one sponsored-listing-filter-<semver>-chrome.zip"
  - "11-06: EXPECTED_* manifest strings and EXPECTED_CSP are deliberate literal duplicates of copy.ts / POPUP_CSP; a change must touch both files in one commit"

patterns-established:
  - "Extension oracle runs on .output/chrome-mv3 (production) only; a -dev directory is refused"

requirements-completed: []

duration: 14min
completed: 2026-10-26
---

# Phase 11 Plan 06: Zero-Network Proof (Source + Build Output) Summary

**ESLint ban on every network primitive in shipped extension source, plus a dependency-free manifest, bundle and zip oracle. Every protection is proven by a planted fault, and the oracle itself was mutation-checked.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-10-26T02:34:30Z
- **Completed:** 2026-10-26T02:48:32Z
- **Tasks:** 2 (TDD, 4 commits)
- **Files modified:** 4

## Accomplishments

- **Source layer:** `apps/extension/src/**/*.{ts,js,mjs,svelte}` and `*.svelte.ts` reject `fetch`, `window.fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `WebTransport`, `RTCPeerConnection`, `importScripts`, `sendBeacon`, `connectNative`, `sendNativeMessage`, dynamic `import()` and `new Image()`. 19 new lint tests cover this, including a `.svelte` file, a `.js` file, a clean-file control, and a check that the extension rules do not leak into `apps/web`.
- **Pitfall 7 proven:** removing `...noFetch` from the extension block turns 3 tests red (fetch, window.fetch, and the svelte fetch case).
- **Build-output layer:** `scripts/assert-extension.mjs` checks the following:
  - the exact manifest shape: permissions `['storage']`, the single Zillow host, one `document_idle` content script with js and css, `background` exactly `{service_worker}`, the popup, the exact CSP with `connect-src 'none'`, named forbidden keys plus default-deny keys, no `<all_urls>` anywhere, and every referenced file on disk;
  - network tokens in JS/HTML, remote `url(` in CSS, and an inventory of every http(s) URL against a prefix allowlist (a lookalike host such as `tranrealestate.github.io.evil.test` is still reported);
  - that a `-dev` output is refused;
  - that `manifest.json` sits at the zip root, using a hand-rolled EOCD/central-directory reader.
- **Oracle mutation check:** Each of 10 weakenings of the oracle turned the suite red. They covered the `-dev` guard, zip root, zip count, CSS url, `run_at`, file existence, the `sendBeacon` token, `background`, the `<all_urls>` scan and the URL allowlist.
- **First real production build (informational):** `wxt build` produced `.output/chrome-mv3` (icons from 11-02 were on disk). The oracle's key allowlist matched WXT's output exactly, and the bundle scan was clean. It reported only the 3 entrypoints later plans add: content CSS, `background`, and `action.default_popup`. The full output-layer run is 11-10's job.

## Task Commits

1. **Task 1 RED: failing extension network-ban lint tests**: `22a9436` (test)
2. **Task 1 GREEN: ESLint zero-network ban for extension source**: `d5a1ed2` (feat)
3. **Task 2 RED: failing extension oracle tests**: `3c554c5` (test)
4. **Task 2 GREEN: extension manifest, bundle and zip oracle**: `56e9dc1` (feat)

## Files Created/Modified

- `eslint.config.js`: `noFetch` hoisted out of `restrictedSyntax`; `EXT_SRC`/`netMsg`/`NET_GLOBALS` constants; the extension block sits after the generic fetch-ban block.
- `scripts/eslint-rules.test.ts`: the `extension zero-network (EXT-03)` describe block, using virtual `apps/extension/src/__lintfix__/` paths.
- `scripts/assert-extension.mjs`: the oracle and CLI (`node scripts/assert-extension.mjs <outDir> [--zip-dir <dir>]`).
- `scripts/assert-extension.test.ts`: 61 tests. Fixtures live only under `mkdtempSync(join(tmpdir(), 'ext-oracle-'))` and are removed in `finally`.

## Decisions Made

See key-decisions in the frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Correctness] Default-deny top-level manifest keys**
- **Found during:** Task 2
- **Issue:** The plan's `FORBIDDEN_KEYS` is a denylist. An unlisted surface (`side_panel`, `options_page`, `content_scripts` world changes via new keys) would pass silently.
- **Fix:** Added `ALLOWED_KEYS` with a planted `side_panel` test. The first real WXT build uses exactly this key set, so the change carries no false-positive risk today.
- **Commit:** `56e9dc1`

**2. [Rule 1 - Bug] A vacuous test, found by mutating the oracle**
- **Found during:** Task 2 oracle mutation pass
- **Issue:** The "`<all_urls>` anywhere in the manifest text" test planted the value in `action.default_title`. The `default_title` check echoes that value, so the substring assertion still passed with the text scan removed.
- **Fix:** The test now asserts the exact message `manifest.json: contains <all_urls>`. Re-mutating the oracle turns it red.
- **Commit:** `56e9dc1`

**3. [Rule 3 - Blocking] The root list was named `restrictedSyntax`, not `noFetch`**
- **Issue:** The plan's interface described a `noFetch` array. The real config had one `restrictedSyntax` array holding both fetch selectors and the `$effect` gateway rule.
- **Fix:** Split it into `noFetch` (the two fetch selectors) and `restrictedSyntax = [...noFetch, $effect rule]`. Web behaviour is unchanged: the full existing lint suite passes.
- **Commit:** `d5a1ed2`

**4. Extra coverage beyond the behavior list:** lint tests for `WebTransport`, `.js` coverage, EXT-03 message text and web non-leak. Oracle tests for `run_at`, `default_popup`, a missing content-script file on disk, a remote script URL in HTML, a token in `background.js`, the allowlist lookalike host, a missing manifest.json, a non-zip file, a nested zip via the CLI, and CLI usage (exit 2).

**Total deviations:** 3 auto-fixed, plus extra coverage. **Impact:** stricter oracle, no scope change.

## Issues Encountered

- A mid-run `pnpm lint` failed on another wave-2 agent's in-progress file (`apps/extension/tests/reveal-host.test.ts`, Prettier). I did not touch it. By the end of the plan, the full `corepack pnpm lint` passed (exit 0).
- An earlier commit was amended only to drop a trailer line before any other agent committed on top of it. Its final hash is `22a9436`.

## Known Stubs

None.

## Verification

- `corepack pnpm vitest run --project scripts eslint-rules`: 113 passed.
- `corepack pnpm vitest run --project scripts assert-extension`: 61 passed.
- `corepack pnpm vitest run --project scripts`: 23 files, 764 passed.
- `corepack pnpm lint`: Prettier and ESLint clean across the repo, including the other agents' extension source under the new ban.
- `git status --porcelain`: the test runs created no files outside `scripts/`. `.output/` from the informational build is gitignored.

## Next Phase Readiness

Plan 11-10 runs `node scripts/assert-extension.mjs apps/extension/.output/chrome-mv3 --zip-dir apps/extension/.output` after `wxt build` and `wxt zip`. It should go green once the content CSS, the `background.js` badge worker and `popup.html` are wired.

---
*Phase: 11-zillow-sponsored-listing-filter-extension*
*Completed: 2026-10-26*

## Self-Check: PASSED

All 4 key files exist; commits 22a9436, d5a1ed2, 3c554c5, 56e9dc1 are present.
