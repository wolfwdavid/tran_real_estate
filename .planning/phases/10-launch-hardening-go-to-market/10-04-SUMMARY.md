---
phase: 10-launch-hardening-go-to-market
plan: 04
subsystem: supply-chain
tags: [pnpm-audit, audit-ignore, dependabot, lockfile, supply-chain]
requires:
  - 10-01 (wave 1 gate)
provides:
  - "pnpm audit:deps script (`pnpm audit --audit-level low`): full audit, exits 0"
  - pnpm-workspace.yaml audit.ignore (1 reviewed GHSA)
  - scripts/lib/audit-exceptions.mjs (AUDIT_EXCEPTIONS)
  - .github/dependabot.yml npm (grouped minor/patch) + github-actions, weekly
  - scripts/supply-chain.test.ts (ignore list == exceptions, dependabot ecosystems, single-document lockfile)
affects: [10-24 (wires audit:deps into verify/CI)]
tech-stack:
  added: []
  patterns:
    - Reviewed audit exceptions live in one frozen module and are test-locked to pnpm's audit.ignore
    - Supply-chain config files are read as text in tests (no YAML parser dependency)
key-files:
  created:
    - scripts/lib/audit-exceptions.mjs
    - scripts/supply-chain.test.ts
  modified:
    - pnpm-lock.yaml
    - pnpm-workspace.yaml
    - package.json
    - .github/dependabot.yml
decisions:
  - "Fixed 7 of 8 advisories with a lockfile-only update (devalue 5.9.2 -> 5.9.4 clears 6, source-map-js 1.2.1 -> 1.2.2 clears 1). source-map-js was a new high finding that did not exist at research time"
  - "Ignored only GHSA-pxg6-pf52-xh8x (cookie 0.6.0, low): every path goes through @sveltejs/kit 2.70.3's server runtime. Confirmed after build:root: the cookie@0.6.0 strings ('argument name is invalid', 'option maxAge is invalid') appear in apps/web/.svelte-kit/output/server/index.js (positive control) and in 0 files under apps/web/build/_app. Revisit by 2027-01-31 or at the Kit 3 migration"
  - "Reverted pnpm's side-effect rewrite of the @types/node specifier (^24 -> ^24.13.5) from `audit --fix=update`. The resolved version is unchanged at 24.13.5, so nothing beyond the advisory fixes was upgraded"
  - "audit:deps is not wired into verify here; plan 10-24 owns that"
requirements-completed: [GTM-01, GTM-02, GTM-03, GTM-04]
metrics:
  duration: ~25 min
  completed: 2026-10-13
  tasks: 2
---

# Phase 10 Plan 04: Dependency Audit and Dependabot Summary

The full `pnpm audit` (not the vacuous `--prod`) now exits 0. Seven of the eight advisories were fixed with a lockfile update. The one remaining low-severity, server-only `cookie` advisory is a reviewed, test-locked exception. Dependabot now covers npm (grouped) as well as GitHub Actions.

## Audit before and after

| | Findings | Detail |
|---|---|---|
| Before | 8 (4 high, 2 moderate, 2 low) | devalue 5.9.2 x6 (3 high, 2 moderate, 1 low; via svelte / Kit), source-map-js 1.2.1 (high; via postcss under eslint-plugin-svelte / tailwind), cookie 0.6.0 (low; via @sveltejs/kit) |
| After `audit --fix=update` | 1 (low) | cookie 0.6.0 only |
| After audit.ignore | 0 reported, "1 ignored: 1 low" | `corepack pnpm audit:deps` exit 0 |

## Tasks

| Task | Name | Commit |
|---|---|---|
| 1 | Fix fixable advisories and record reviewed exceptions | aedfb14 |
| 2 (RED) | Failing supply-chain tests | a226228 |
| 2 (GREEN) | Dependabot npm + supply-chain guard | b7f6b54 |

## Verification (real output)

- `corepack pnpm audit:deps`: "All found vulnerabilities were already reviewed and decided to be ignored / 1 ignored: 1 low", exit 0
- `corepack pnpm install --frozen-lockfile`: "Already up to date", exit 0
- `corepack pnpm build:root`: exit 0. `grep` for cookie@0.6.0 strings: 0 files in `apps/web/build/_app`, 1 in the server output
- `grep -c "ignoreGhsas\|auditConfig" pnpm-workspace.yaml package.json`: 0 / 0
- `corepack pnpm vitest run --project scripts supply-chain`: RED had 3 failures (dependabot) and 6 passes. GREEN is 9/9
- Mutation check: deleting the npm `groups:` block makes "npm updates are grouped" fail. Restored
- `corepack pnpm lint:workflows` (actionlint): exit 0. `eslint` and `prettier --check` on the new files are clean
- `corepack pnpm test:unit` (full, run twice with 10-02/10-03/10-08 executing in parallel) was NOT fully green, and no failure is in this plan's files:
  - run 1: `scripts/assert-csp.test.ts` (8; it matches another executor's uncommitted `scripts/assert-csp.mjs`), `models.test.ts` CSP coverage, plus timeouts in `precommit.test.ts` and `ResultsView.browser.test.ts`
  - run 2: 4 failures. `precommit.test.ts` x2 and `ResultsView.browser.test.ts` both pass in isolation (3/3, and 27/27 with models). They are load timeouts. `apps/web/src/lib/ai/models.test.ts` "every registry host is listed in svelte.config.js connect-src" fails in isolation as well. It started after 10-02's commit 0a4cde7 ("host-aware CSP builder") moved the connect-src literals out of svelte.config.js, so it belongs to 10-02 and not to this plan

## Deviations from Plan

**1. [Rule 1 - Scope] Reverted the @types/node specifier rewrite.** `pnpm audit --fix=update` also rewrote `"@types/node": "^24"` to `"^24.13.5"` in package.json and the lockfile importer. That is not an advisory fix, and the orchestrator forbids upgrades beyond the plan, so I restored `^24` (the resolved version stays 24.13.5) and confirmed with `install --frozen-lockfile`.

**2. Different findings from research.** Research listed 7 findings. The current audit had 8 because a high-severity source-map-js advisory had been added. The same lockfile update fixed it, and the exception list still has only the cookie entry.

## Owner follow-ups

- When the GitHub remote exists, enable Dependabot alerts and security updates in the repo settings (RESEARCH Pitfall 12). Treat `pnpm audit:deps` in CI as the authoritative gate, not Dependabot alerts.

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: scripts/lib/audit-exceptions.mjs, scripts/supply-chain.test.ts, .github/dependabot.yml
- FOUND commits: aedfb14, a226228, b7f6b54
