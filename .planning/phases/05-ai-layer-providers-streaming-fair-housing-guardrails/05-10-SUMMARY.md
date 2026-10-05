---
phase: 05-ai-layer-providers-streaming-fair-housing-guardrails
plan: 10
subsystem: ai-no-auto-send-enforcement
tags: [ai, eslint, flat-config, import-graph, typescript, ai-04, tdd, mutation-tested]
requires:
  - "05-05: providers/** (fake-sse.ts declared test-only)"
  - "05-06: exits.ts (copyText, buildMailto, markSent): the only exit implementations"
  - "05-09: runner.ts, prompts/**, fixture provider (part of the walked graph)"
  - "Phase 3/4 eslint.config.js: confirm bans, DATA_INTERNALS import boundary, fetch allowlist"
provides:
  - "eslint.config.js: lib/ai/** no-auto-send block (no-restricted-imports / -globals / -properties)"
  - "eslint.config.js: GLOBAL_RESTRICTED_GLOBALS / GLOBAL_RESTRICTED_PROPERTIES hoisted constants"
  - "apps/web/src/lib/ai/import-graph.ts: collectImportGraph, scriptOf, GraphIo, GraphResult, GraphEdge"
  - "apps/web/src/lib/ai/no-auto-send.test.ts: planted + real-tree import-graph, text bans, single-exit assertions"
affects: [05-11, 05-13 (GenerationPanel SSR exits test = layer 4), Phase 7-9 portal AI code, Phase 8 lib/leads + Web3Forms]
tech-stack:
  added: []
  patterns:
    - "Distinct rule names for a folder boundary so an overlapping `no-restricted-syntax: off` override cannot clobber it"
    - "Every block that sets a restricted-* rule repeats the earlier lists via shared constants (flat config replaces options)"
    - "Import-graph walk via ts.preProcessFile with injected POSIX io; posix.join (not resolve) keeps Windows C:/ paths intact"
    - "Tests walk the directory tree, so new lib/ai files are covered automatically"
key-files:
  created:
    - apps/web/src/lib/ai/import-graph.ts
    - apps/web/src/lib/ai/no-auto-send.test.ts
  modified:
    - eslint.config.js
    - scripts/eslint-rules.test.ts
key-decisions:
  - "The lib/ai lint block repeats DATA_INTERNALS in no-restricted-imports (not just the leads ban); otherwise it would silently drop the Phase 4 data-port boundary for every lib/ai file"
  - "Added a bare `open` restricted global alongside window.open (Rule 2): `open(url)` is the same browser navigation primitive without the window. prefix"
  - "Import-graph is test support living under lib/ai (excluded from its own walk) and treats type-only imports as coupling; non-code files (css, etc.) are visited as leaves, not parsed"
  - "The real-tree test asserts zero unresolved relative/$lib specifiers so a resolver gap cannot hide a reachable module"
requirements-completed: []
duration: 5min
completed: 2026-10-05
---

# Phase 5 Plan 10: No-auto-send enforcement Summary

**AI-04 is now enforced three ways: a `lib/ai/**` ESLint boundary that also binds the providers folder, a `ts.preProcessFile` import-graph walk that provably reaches nothing under `lib/leads` or any web3forms module, and a single-implementation check that keeps `navigator.clipboard` and `mailto:` in `exits.ts` only.**

## Performance

- **Duration:** about 5 min
- **Started:** 2026-10-05T13:42:54Z
- **Completed:** 2026-10-05T13:47:27Z
- **Tasks:** 2 (both TDD: RED commit, then GREEN)
- **Files modified:** 4

## Accomplishments

- **ESLint block for `apps/web/src/lib/ai/**`:**
  - `no-restricted-imports` = `DATA_INTERNALS` + a leads/web3forms pattern (`$lib/leads`, `**/lib/leads/**`, `**/leads`, `**/leads/**`, `*web3forms*`), so relative imports are caught too.
  - `no-restricted-globals` = the confirm ban + `XMLHttpRequest`, `WebSocket`, `EventSource`, `open`.
  - `no-restricted-properties` = window.confirm + `navigator.sendBeacon`, `window.open`, `location.assign`, `location.replace`.
- **Phase 3 lists hoisted** into `GLOBAL_RESTRICTED_GLOBALS` / `GLOBAL_RESTRICTED_PROPERTIES` and used by both the original block and the AI block.
- **13 new lintText cases** in the `AI no-auto-send boundary` describe block, all virtual under `__lintfix__`:
  - `$lib/leads/web3forms` from a `lib/ai/ui` Svelte component is rejected.
  - In `lib/ai/providers/__lintfix__`, a relative leads import is rejected while `fetch()` stays allowed, and `navigator.sendBeacon` is rejected.
  - 7 send/navigation primitives are rejected.
  - `navigator.clipboard.writeText` is allowed.
  - `confirm` / `window.confirm` stay banned in lib/ai.
  - The data-port boundary is preserved in lib/ai.
  - Control: `lib/leads` itself is untouched by the AI block.
- **`collectImportGraph` walker:**
  - Does a breadth-first walk over static, type-only, side-effect and dynamic imports, including both `<script>` blocks of `.svelte` files.
  - Resolves `$lib`, relative and `@tran/core[/sub]` specifiers in this order: exact, `.ts`, `.svelte.ts`, `.svelte`, `.js`→`.ts`, `/index.ts`.
  - Records bare specifiers as external, and records `to: null` for local specifiers it cannot resolve.
- **`no-auto-send.test.ts` (23 tests):**
  - 6 planted-graph cases, including the dynamic `import('$lib/leads/web3forms')` reached through a second file.
  - Real-tree checks: at least 15 visited files including `exits.ts` and `runner.ts`; nothing under `/lib/leads/`; no web3forms specifier; zero unresolved local specifiers; no production import of `providers/fake-sse.ts`.
  - 10 text bans.
  - `navigator.clipboard` and `mailto:` appear only in `exits.ts`.

## Task Commits

1. **Task 1: ESLint boundary for lib/ai.** `95ec421` (test, RED: 10 failing), `763f306` (feat)
2. **Task 2: Import-graph walker + no-auto-send test.** `aee5ad1` (test, RED: missing module), `e5230b4` (feat)

## Mutation Checks (none committed)

| Mutation | Result |
|---|---|
| Remove `no-restricted-properties` from the AI block | 4 tests FAIL (providers sendBeacon, window.open, location.assign, location.replace) |
| Remove the leads pattern (keep DATA_INTERNALS) | 2 tests FAIL (ui `$lib/leads/web3forms`, providers relative leads import) |
| Drop DATA_INTERNALS and the GLOBAL_* repeats from the AI block | 2 tests FAIL (confirm bans, data-port boundary) |
| `runner.ts` gains `import('../leads/zz_mut/deliver')` to a real temp `lib/leads` file | "no reachable module lives under /lib/leads/" FAILS |
| `gemini-gate.ts` gains a `navigator.clipboard` reference | "navigator.clipboard appears in exactly one … exits.ts" FAILS |

Every mutation was restored, and the suites returned to green (47/47 scripts lint tests, 23/23 no-auto-send).

## Verification

- `corepack pnpm exec vitest run --project scripts scripts/eslint-rules.test.ts`: 47/47
- `corepack pnpm exec vitest run --project web apps/web/src/lib/ai/no-auto-send.test.ts`: 23/23
- `corepack pnpm exec vitest run --project web`: 885/886. The single failure is `lib/data/platform.test.ts` "verno is the Phase 3 latest version + 1". It comes from 05-11's in-flight `lib/storage/db.ts` version bump, which runs in parallel and is outside this plan's files.
- `corepack pnpm check`: 0 errors, 0 warnings (1637 files)
- `corepack pnpm exec eslint .` (whole repo, with the new rules): exit 0
- `corepack pnpm lint`: ESLint is clean. Prettier `--check` flags only 05-11's in-progress `lib/ai/storage/artifacts.test.ts`, and all four of this plan's files pass Prettier.
- `grep -rl navigator.clipboard lib/ai` (non-test): only `apps/web/src/lib/ai/exits.ts`

## Decisions Made

See frontmatter `key-decisions`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] The AI block repeats DATA_INTERNALS in no-restricted-imports**
- **Found during:** Task 1
- **Issue:** The plan's snippet set `no-restricted-imports` to the leads pattern only. Flat config would then replace the Phase 4 catch-all `DATA_INTERNALS` boundary for every `lib/ai` file (RESEARCH Pitfall 11).
- **Fix:** Patterns are `[DATA_INTERNALS, leadsPattern]`. A lintText case ("lib/ai keeps the Phase 4 data-port import boundary") is mutation-proven.
- **Commit:** 763f306

**2. [Rule 2 - Missing critical] Bare `open()` banned as a restricted global**
- **Found during:** Task 1
- **Issue:** `window.open` is caught by `no-restricted-properties`, but a bare `open(url)` is the same global and slipped through.
- **Fix:** Added `{ name: 'open' }` to the AI block's `no-restricted-globals`, with a lintText case.
- **Commit:** 763f306

## Issues Encountered

- 05-11 ran in parallel and its files were mid-edit during verification. That caused the `platform.test.ts` verno failure and the Prettier warning on `ai/storage/artifacts.test.ts`. Both are outside this plan's scope and are left to 05-11 and the post-wave hook. The new 05-11 `lib/ai/storage/*.ts` files are already covered by the tree walk and pass all bans.

## Requirements

- Advances **AI-04** (no AI output is ever sent automatically): lint, import-graph and single-exit layers are live. Layer 4, the SSR "exactly three exits" test, ships with GenerationPanel in 05-13. AI-04 stays open until the 05-16 gate (not marked complete here).

## Next Phase Readiness

- Phase 8 `lib/leads` + Web3Forms can land without further work: lint and the tree walk already reject any lib/ai path into them.
- Any new file under `lib/ai` is automatically walked, text-scanned and linted.

## Self-Check: PASSED
