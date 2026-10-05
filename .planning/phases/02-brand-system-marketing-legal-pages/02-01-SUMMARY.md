---
phase: 02-brand-system-marketing-legal-pages
plan: 01
subsystem: brand
tags: [design-tokens, wcag, contrast, vitest, tailwind-theme]
requires: []
provides:
  - "@tran/brand tokens (color, font, radius, shadow, ease, container) + motion"
  - "luminance(), contrastRatio(), failingPairs(), contrastPairs (45 pairs by token name)"
  - "themeVars() -> Tailwind v4 @theme custom properties"
  - "Vitest project 'brand' in the root harness"
affects: [02-03 app.css @theme parity, all Phase 2 styling plans, Phase 11 extension popup]
tech-stack:
  added: [vitest 4.1.11 in @tran/brand (exact pin)]
  patterns: [token-level WCAG gate referencing token names, never hex literals]
key-files:
  created:
    - packages/brand/vitest.config.ts
    - packages/brand/src/contrast.test.ts
  modified:
    - packages/brand/src/index.ts
    - packages/brand/package.json
    - vitest.config.ts
    - pnpm-lock.yaml
decisions:
  - "contrastPairs is Object.freeze'd and built with flatMap over SURFACES x TEXT_FOREGROUNDS; decorative tokens (deco-*, border) never appear as foregrounds"
  - "themeVars flattens every token group as --{group}-{name}; motion lives outside tokens so no --motion-/--duration- keys can be emitted"
metrics:
  duration: 3min
  completed: 2026-10-05
  tasks: 2
  files: 6
---

# Phase 2 Plan 01: Brand Tokens + WCAG Contrast Gate Summary

`@tran/brand` now holds every UI-SPEC color, font, radius, shadow, ease and container token, plus a WCAG 2.2 relative-luminance contrast gate. The gate checks a 45-pair matrix by token name, rejects a planted failing pair, and goes red when a real token is degraded.

## What Was Built

- **Task 1 (f38aa7f):** Added `vitest@4.1.11` (exact) to `@tran/brand` with `corepack pnpm`; `pnpm-workspace.yaml` is unchanged. Added the `brand` Vitest project with the no-network setup file and registered `packages/brand` in the root `projects` array. The placeholder test started RED.
- **Task 2 RED (ba7950a):** Wrote 10 tests. They cover the 21:1 anchor, symmetry, the five UI-SPEC anchor ratios (15.24 / 4.88 / 3.55 / 6.06 / 3.32), an empty `failingPairs()` result, the planted deco-terracotta failure, the decorative-foreground ban, at least 45 pairs, name-only pair references, and the `themeVars` keys with no motion or duration variables. All 10 failed.
- **Task 2 GREEN (58d1f58):** Wrote the token module (all hex lowercase), the luminance and contrast math, the 45-pair `contrastPairs` (30 text + 3 fill + 10 ring/border-strong UI + 2 nav-indicator), `failingPairs`, `themeVars` and `motion`. 10/10 tests pass.

## Verification

- `corepack pnpm vitest run --project brand`: 10/10 pass
- `corepack pnpm test:unit`: 12 files, 188 tests pass (all four projects)
- `corepack pnpm check` and `corepack pnpm lint` exit 0
- Uppercase-hex grep returns 0; `prose` grep returns 0; `git diff --exit-code pnpm-workspace.yaml` exits 0
- Mutation test (not committed): `primary` changed to `#c8714e` gave 2 failures (the gate and the anchor ratio). After the revert, `git diff --exit-code` on index.ts was clean.

## Deviations from Plan

**1. [Rule 3 - Blocking] The Task 1 placeholder test reads `contrastPairs` through a namespace cast**
- **Issue:** A named import of the not-yet-existing `contrastPairs` would make `tsc --noEmit` fail at the intermediate commit. The placeholder had to fail on an assertion instead.
- **Fix:** `import * as brand` plus a cast. The test fails RED with "expected 0 to be >= 45". Task 2 replaced the whole file with named imports.

**Process note (no code impact):** My first mutation-test revert used `git checkout` before the GREEN implementation was committed. That restored the Phase 1 stub. I rewrote the implementation with identical content, re-ran all checks green, and committed it. I then redid the mutation test against the committed file.

## Known Stubs

None.

## Self-Check: PASSED
