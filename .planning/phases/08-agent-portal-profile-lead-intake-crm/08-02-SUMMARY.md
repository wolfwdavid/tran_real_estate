---
phase: 08-agent-portal-profile-lead-intake-crm
plan: 02
subsystem: tooling/boundaries
tags: [eslint, import-graph, boundary, agent, public-route, rentcast-budget]
requires: []
provides:
  - "Agent CRM gateway ban merged into the per-portal no-restricted-imports entry"
  - "(public) route-group import boundary (no storage/ai/data/security/features)"
  - "agent/studio + features/studio carve-out (cross-portal ban kept, gateway port allowed)"
  - "tooling/import-graph.ts: resolveSpec, importGraph, walkFiles over an injectable GraphFs"
  - "scripts/agent-boundary.test.ts: transitive zero-RentCast + public isolation proof"
affects: [08-13 public inquiry route, all agent CRM plans, Phase 9 studio]
tech-stack:
  added: []
  patterns:
    - "Portal-specific bans are spread into the SAME PORTALS.map entry (flat config replaces rule options)"
    - "Later, narrower carve-out entry intentionally replaces the agent patterns for studio files"
    - "Regex import graph with forward-slash paths and an in-memory planted control"
key-files:
  created:
    - tooling/import-graph.ts
    - scripts/agent-boundary.test.ts
  modified:
    - eslint.config.js
    - scripts/eslint-rules.test.ts
decisions:
  - "AGENT_NO_GATEWAY bans the gateway port itself ($lib/data), not only internals"
  - "The studio carve-out also covers lib/features/studio/** so Phase 9's module inherits the cross-portal ban"
  - "The (public) reach test is test.skipIf'd until routes/(public) exists (08-13); it activates automatically"
  - "Phase 5's lib/ai/import-graph.ts left untouched (no-auto-send.test.ts stays green); tooling/import-graph.ts is the generic Node-side walker"
metrics:
  duration: ~25min
  completed: 2026-10-06
  tasks: 2
  files: 4
---

# Phase 8 Plan 02: Agent gateway and public-page import boundaries Summary

The agent CRM's zero-RentCast promise and the public inquiry page's isolation are now enforced twice. Lint bans the direct imports through a merged per-portal entry and a `(public)` block. A transitive import-graph test walks every barrel and re-export, and a planted control proves it can find a gateway import two hops away.

## Tasks

| Task | Name | Commit |
| ---- | ---- | ------ |
| 1 | Merge the agent data ban into the portal rule; add the (public) and studio blocks | 59c61c1 |
| 2 | Shared import-graph tool and transitive agent/public boundary test with planted control | 7fb73fc |

## What changed

- **eslint.config.js**
  - `AGENT_NO_GATEWAY` (`forbid(['data'], 'The agent CRM never touches the RentCast gateway…')`) is spread into the `agent` entry of `PORTALS.map`, next to the cross-portal ban, `DATA_INTERNALS` and `MAP_LIBS`.
  - A new studio carve-out entry covers `routes/(app)/agent/studio/**` and `lib/features/studio/**`. It keeps the renter/investor ban, `DATA_INTERNALS` and `MAP_LIBS`, and allows the `$lib/data` port.
  - A new `(public)` entry forbids storage, ai, data, security and features, and also repeats `MAP_LIBS`.
  - The map-folder override is still the last `no-restricted-imports` entry.
- **scripts/eslint-rules.test.ts**: adds 10 in-memory `lintText` cases on virtual `__lintfix__` paths:
  - CRM to gateway port and internals: red
  - CRM to features/renter: one error with the cross-portal message, which proves the two bans merged
  - Pipeline route to `$lib/data/x`: red
  - Studio: the `$lib/data` port is allowed, internals give no gateway error, and features/renter is red
  - `(public)`: storage, features/agent, ai, security and data are red; `$lib/leads/web3forms-sink` and `@tran/core/leads/lead-block` are clean
- **tooling/import-graph.ts**: `GraphFs`, `nodeFs`, `IMPORT_RE`, `resolveSpec`, `importGraph` and `walkFiles`.
  - Uses forward-slash posix paths throughout, so the same code works on Windows and in in-memory graphs.
  - Creates a fresh regex per file.
  - When an import ends in `.js`, it also tries the `.ts` file.
  - Bare packages return `null`.
- **scripts/agent-boundary.test.ts** has 5 tests: 4 pass and 1 is skipped until the route exists.
  - **Agent entries never reach lib/data.** Entries are `features/agent`, `(app)/agent` minus studio, `lib/leads` and `(public)`. A non-vacuity check requires more than 0 entries; today `(app)/agent/+page.svelte` exists.
  - **The `(public)` group either exists with sources or not at all.**
  - **The `(public)` graph never reaches storage, ai, security, features or data.** This is skipped until 08-13 creates the route.
  - **No studio route appears in the agent entries.**
  - **Planted control.** A two-hop barrel leading to the gateway is reported. A `.svelte` relative import resolves, and `import('./lazy.js')` resolves to `lazy.ts`.

## Mutation proofs (every boundary removed made a test fail; all reverted)

- Removing the `AGENT_NO_GATEWAY` spread made 2 tests fail: the CRM gateway test and the agent route gateway test.
- Retargeting the `(public)` block's `files` to a path that matches nothing made all 5 `(public)` deny cases fail.
- Dropping `routes/(app)/agent/studio/**` from the carve-out made the studio test fail, because the agent gateway ban applied again.
- Planting `import '$lib/data/rentcast/client';` in `apps/web/src/routes/(app)/agent/+page.svelte` made the transitive test fail and report `lib/data/rentcast/client.ts`. The file was restored and was clean in git.

## Verification

- `corepack pnpm vitest run --project scripts eslint-rules`: 78/78 passed.
- `corepack pnpm vitest run --project scripts agent-boundary`: 4 passed, 1 skipped (the `(public)` route does not exist yet).
- The full `scripts` project with `--no-file-parallelism`: 460 passed, 1 skipped.
- `no-auto-send` (05-10): 23/23 passed. The Phase 5 walker was not changed.
- ESLint passes on all 4 owned files, and Prettier is clean.
- A strict `tsc` pass on `tooling/import-graph.ts` is clean.
- Repo-wide `corepack pnpm lint` is **red because of a file 08-02 does not own**: `packages/core/src/leads/normalize.ts:9` fails `no-control-regex`. Plan 08-01 committed this file in parallel. It is logged in `deferred-items.md` with a suggested fix. Before 08-01 landed, repo-wide lint passed with this plan's config changes.

## Requirements advanced

AGT-02 and AGT-04 (structural zero-RentCast proof for the agent CRM and isolation of the public inquiry page). Not marked complete here, per the orchestrator's instruction.

## Deviations from Plan

- **[Rule 2 - Missing critical] The studio carve-out also covers `lib/features/studio/**`.** Without this, Phase 9's module would get only the catch-all entry and could import renter/investor features. The cross-portal ban is unchanged.
- **The `(public)` block also repeats `MAP_LIBS`.** This follows the project rule that every entry repeats `MAP_LIBS`. It is not a deviation in intent.
- **Data is added to the `(public)` reach test's banned folders**, on top of storage, ai, security and features. This is belt and braces, because the first test already covers data.

## Known Stubs

None.

## Self-Check: PASSED
