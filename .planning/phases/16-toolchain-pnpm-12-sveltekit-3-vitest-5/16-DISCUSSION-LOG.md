# Phase 16: Toolchain: pnpm 12 → SvelteKit 3 → Vitest 5 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-11-10
**Phase:** 16-Toolchain: pnpm 12 → SvelteKit 3 → Vitest 5
**Areas discussed:** Pre-flight debts

---

## Area selection

| Area offered | Selected |
|--------------|----------|
| Pre-flight debts | ✓ |
| Landing and deploy cadence | |
| Audit target and bumps | |
| Proof after Vitest 5 | |

The three unselected areas are recorded in CONTEXT.md under Claude's Discretion with a default each.

---

## Pre-flight debts

### Where the live-smoke 429 fix lands

| Option | Description | Selected |
|--------|-------------|----------|
| First plan of Phase 16 | Plan 16-00 before pnpm 12; green live baseline on Kit 2, no separate phase | ✓ |
| Insert Phase 15.1 first | Own decimal phase with its own discuss/plan/verify | |
| Leave for Phase 17 | Phase 16 runs with the smoke as is; manual re-dispatch at the closing deploy | |

**User's choice:** First plan of Phase 16

### What the 429 fix does

| Option | Description | Selected |
|--------|-------------|----------|
| Relabel and pace | Exit 2 on 429 plus pacing the live run so it stops tripping the limit; no retries | ✓ |
| Relabel only | The deferred definition as written; a green run still needs a re-dispatch | |
| You decide | Research measures the limit and picks the smallest change | |

**User's choice:** Relabel and pace
**Notes:** Context shown before the question: both recent failures pass specs 1-108, then every navigation answers 429.

### How much of 15-REVIEW is fixed before the migration

| Option | Description | Selected |
|--------|-------------|----------|
| CR-01 plus migration-relevant | Blocker plus the warnings a migration could slip through (by-reference timeouts, APIs outside the rule set, lanes.ts and CLI flags) | ✓ |
| CR-01 only | Blocker only; nine warnings stay recorded | |
| All ten findings | Everything before pnpm 12 | |
| None in Phase 16 | Guard findings go to a later quick task | |

**User's choice:** CR-01 plus migration-relevant

### Baseline gate before pnpm 12

| Option | Description | Selected |
|--------|-------------|----------|
| Hard gate | `pnpm verify` green and one green live-smoke run at the pre-flight commit, run link recorded | ✓ |
| Local gate only | `pnpm verify` + `smoke:local`; live smoke only at the closing deploy | |
| No gate | Migration starts straight after pre-flight | |

**User's choice:** Hard gate

---

## Claude's Discretion

- Landing and deploy cadence (default: main, push and deploy after each plan, revert on a migration-caused red)
- Audit target and bumps (default: Kit exceptions removed, deepmerge stays, minimatch only if ESLint allows; routine bumps as a final plan; Dependabot PRs held)
- Proof after Vitest 5 (default: re-run the evidence protocol once, new dated evidence file)
- Exact patch versions; whether 16-00 is one plan or two

## Deferred Ideas

- Remaining 15-REVIEW warnings and info items
- Node major move / `@types/node` 26
- App-level recovery from a failed lazy chunk load
