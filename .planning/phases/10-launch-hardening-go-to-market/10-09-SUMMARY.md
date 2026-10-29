---
phase: 10-launch-hardening-go-to-market
plan: 09
subsystem: build-oracles
tags: [seo, sitemap, og-image, json-ld, bundle-budget, oracle, tdd]
requires:
  - phase: 10-02
    provides: scripts/lib/build-targets.mjs targetEnv(), site-config resolveSiteOrigin()
provides:
  - scripts/assert-seo.mjs checkSeo(dir, { siteUrl, minUrls }) + collect() + CLI --target/--min-urls
  - scripts/assert-budget.mjs initialJs/initialCss/checkBudget/formatRows + CLI --json/--require-tools
affects: [10-24 verify/CI wiring, sitemap/robots/OG/tool-page plans, launch audit]
tech-stack:
  added: []
  patterns: [build-dir oracle with temp-dir golden fixture + one-fault mutation tests]
key-files:
  created:
    - scripts/assert-seo.mjs
    - scripts/assert-seo.test.ts
    - scripts/assert-budget.mjs
    - scripts/assert-budget.test.ts
  modified: []
key-decisions:
  - "SEO oracle parses meta/link attributes order-independently (Kit emits href before rel) and treats any robots meta whose content includes noindex as non-indexable"
  - "Sitemap set equality is enforced both ways: indexable page missing from sitemap AND a sitemap loc with no indexable page are errors"
  - "Tool-page FAQ section must also carry aria-labelledby=\"questions-heading\"; h3 text is compared after stripping Svelte <!----> markers and decoding entities"
  - "Budget refs must be relative and resolve inside the build dir; absolute/escaping/missing refs throw (reported per route), never count as 0"
  - "Budget messages print the limit as '60 KB' (no .0) and actuals to 0.1 KB"
requirements-completed: [GTM-03]
duration: ~25min
completed: 2026-10-13
---

# Phase 10 Plan 09: SEO and JS budget build oracles Summary

Two Node-builtin build oracles: `assert-seo.mjs` (sitemap/robots/head tags/1200x630 share-card PNGs/tool-page JSON-LD vs visible FAQ/URL hygiene) and `assert-budget.mjs` (initial JS per route from built HTML at gzip -9, 60 KB gate on tools pages), both mutation-tested on temp-dir fixtures.

## Tasks

| # | Task | Commits |
|---|------|---------|
| 1 | SEO oracle | a918e03 (RED test), ed43d3a (GREEN) |
| 2 | JS budget oracle | 010528e (RED test), 161d33c (GREEN) |

## Verification (real output)

- RED runs: both suites failed with `Cannot find module './assert-seo.mjs'` / `'./assert-budget.mjs'`.
- `corepack pnpm vitest run --project scripts assert-seo` -> `Tests 34 passed (34)` (golden passes with `[]`; one test per behavior fault plus duplicate description, missing urlset, stale loc, og:image outside /og/, missing WebApplication, review, invalid JSON, protocol-relative script, minUrls 2 vs 14).
- `corepack pnpm vitest run --project scripts assert-budget` -> `Tests 11 passed (11)` (incl. planted 200 KB `randomBytes` chunk -> FAIL naming route, KB, 60 KB budget; 1 KB chunk passes; landing over 60 KB is REPORT and does not fail; missing modulepreload ref and missing boot-import ref both throw).
- `corepack pnpm vitest run --project scripts` -> `Test Files 18 passed (18), Tests 608 passed (608)`.
- `corepack pnpm lint` -> exit 0 (an earlier run failed on `eslint.config.js`, another executor's uncommitted WIP; clean on re-run).
- CLI smoke against the existing `apps/web/build` (read-only, no build run, no lock needed):
  - `assert-budget.mjs apps/web/build` -> table, 8 REPORT rows, exit 0; `--require-tools` -> exit 1 "no tools pages found" (tools pages not built yet, as expected).
  - `assert-seo.mjs apps/web/build --target root` -> exit 1 with 364 errors (no sitemap/robots/OG tags yet: those land in later plans). `--target bogus` -> exit 2 with usage; missing dir -> exit 1.

## Deviations from Plan

None in behavior. Additions beyond the listed faults (all Rule 2, strengthening the same contracts): stale sitemap loc with no page, duplicate locs, og:image must be `<siteUrl>/og/<name>.png`, og:image:width/height values, FAQ section aria-labelledby check, refs escaping the build dir. `assert-seo.mjs` also exports `collect()` so the CLI can print page/URL/card counts.

## Risks / notes for later plans

- Current marketing pages already load **48.7-53.5 KB gz** initial JS (landing 53.5 KB). A tools page sharing the same marketing layout has roughly **6.5 KB gz** headroom under the 60 KB gate, far less than the research's 27 KB estimate (32.7 KB baseline). Tool-page plans should keep calculator code lean or trim the shared layout.
- The SEO CLI defaults `--min-urls` to 14; wiring (plan 10-24) must pass the build dir explicitly (e.g. `apps/web/build`, `apps/web/build-sub`).

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: scripts/assert-seo.mjs, scripts/assert-seo.test.ts, scripts/assert-budget.mjs, scripts/assert-budget.test.ts
- FOUND commits: a918e03, ed43d3a, 010528e, 161d33c
