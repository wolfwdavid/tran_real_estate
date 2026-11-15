---
phase: 16-toolchain-pnpm-12-sveltekit-3-vitest-5
plan: 07
subsystem: toolchain
tags: [sveltekit-3, lib-alias, eslint, boundary-tests, plant-and-prove]
requires: [16-06]
provides:
  - "ESLint no-restricted-imports groups written against \\#lib (gitignore escape), with an effective-config predicate test"
  - "seven import-boundary guards migrated to #lib, each with a planted violation and a negative control"
  - "scripts/kit3-migration.test.ts repo-wide zero-grep gate (5 retired tokens, exact-path allowlist)"
  - "$lib alias removed from vite.config.ts and vitest.browser.config.ts; components.json on #lib"
affects: [16-08, 16-09, 16-10]
tech-stack:
  added: []
  patterns:
    - "boundary group strings: \\\\#lib/... in JS source (gitignore escape), data port exempted as !\\\\#lib/data/index.ts"
    - "source-scan guards expose a pure predicate, then run it on the real tree, a planted violation and a negative control"
key-files:
  created:
    - scripts/kit3-migration.test.ts
  modified:
    - eslint.config.js
    - scripts/eslint-rules.test.ts
    - scripts/agent-boundary.test.ts
    - tooling/import-graph.ts
    - apps/web/components.json
    - apps/web/vite.config.ts
    - apps/web/vitest.browser.config.ts
requirements-completed: []
duration: one session
completed: 2026-11-14
---

# Phase 16 Plan 07: #lib boundaries, aliases and the zero-grep gate

Every ESLint boundary group and every regex-over-source boundary test now speaks `#lib`, and each one is shown to still bite: a planted `#lib` violation is reported, a negative control stays silent, and reverting the guard to the old spelling makes the planted case fail. `$lib` no longer appears in any tracked text file outside the gate test itself. Nothing was pushed. TOOL-02 spans plans 05 to 10 and stays Pending.

## Commits

| Task | Commit | Subject |
|------|--------|---------|
| 1 | 0395e80 | refactor(lint): write boundary import groups against #lib |
| 1 (lint) | 2bfc930 | fix(web): justify the two shallow goto calls the navigation rule flags |
| 2 | ee8b6ea | test(boundaries): migrate import-graph walkers and source-scan boundary tests to #lib |
| 3 | 3e448e6 | refactor(web): finish the #lib migration for config, aliases and guards |
| 4 | none | dry run left the tree unchanged, nothing to commit |

No commit carries a trailer.

## Task 1: ESLint groups

Step A: samples in scripts/eslint-rules.test.ts and scripts/agent-boundary.test.ts moved to `#lib/...` with the explicit extensions the real modules carry, plus the new tests (effective-config predicate, trap probe, storage carve-out, navigation plant). Run against the UNCHANGED config: 43 failed of 140 (all boundary cases; the two predicate tests that look for an unescaped group pass because the old config has no `#` groups, and "every web boundary names #lib" fails, which is the live signal). After the storage tests were added the file has 135 tests.

Step B: config migrated. Step C mutants (plain `#lib` written for the group, restored afterwards):

| Mutant | Result in scripts/eslint-rules.test.ts |
|--------|----------------------------------------|
| DATA_INTERNALS `\\#lib/data/*` and `/**` written unescaped | 18 failed of 135 (renter route, features/shared, lib/ai, map folder, storage cases and 5 predicate cases) |
| `forbid()` template written unescaped (`#lib/${m}`) | 47 failed of 135 (cross-portal, marketing, public, marketing-safe, map folder, affordability) |
| storage exemption `!\\#lib/data/tables*` written `!#lib/...` | 1 failed (predicate only). Behaviourally harmless: after `!`, `#` is not a comment, so the exemption still works and the carve-out test stays green; the predicate is deliberately stricter so the config stays uniform |

The trap is also reproduced inside the test file (a standalone ESLint with an unescaped group reports nothing, the escaped group reports 1).

### Group list, before and after

Strings below are the JS source values. `**/lib/...` relative globs unchanged.

| Group | Before | After |
|-------|--------|-------|
| DATA_INTERNALS | `$lib/data/*`, `$lib/data/**`, `**/lib/data/*`, `**/lib/data/**` | `\#lib/data/*`, `\#lib/data/**`, `!\#lib/data/index.ts`, `!\#lib/data/index.js`, `**/lib/data/*`, `**/lib/data/**` |
| forbid(mods) (cross-portal, marketing, public, agent gateway, leads) | `$lib/${m}`, `$lib/${m}/**`, `**/lib/${m}`, `**/lib/${m}/**` | `\#lib/${m}`, `\#lib/${m}/**`, `**/lib/${m}`, `**/lib/${m}/**` |
| storage `*.ts` exemption | `!$lib/data/tables`, `!**/lib/data/tables` | `!\#lib/data/tables`, `!\#lib/data/tables.ts`, `!\#lib/data/tables.js`, `!**/lib/data/tables`, `!**/lib/data/tables.ts` |

Forbidden and exempt module sets are identical. Reason for the two additions: the data port used to be the bare specifier `$lib/data`, which `$lib/data/*` never matched. In the tree it is now `#lib/data/index.ts` (61 import sites), which `\#lib/data/*` DOES match, so without `!\#lib/data/index.ts` every port import would have been banned. Likewise the tables exemption needs its `.ts` spelling. The agent CRM, marketing and public entries ban the port through `forbid(['data'])` with no exemption, so it stays banned there (test: "agent CRM may not import the port").

### Navigation rule (Pitfall 6, A4)

A bare `<a href="/x">` in a `.svelte` fixture reports `svelte/no-navigation-without-resolve` on eslint-plugin-svelte 3.24.1 on Kit 3; the same link through `resolve('x/')` is silent. Both cases are in the test file.

### Lint gate and a deviation

`pnpm lint` after Task 1 showed two errors that 16-05 introduced: the shallow-routing codemod produced `goto(cleaned, { shallow: true ... })` and `goto(compareHref(...), { shallow: true ... })`, which the navigation rule flags. They got the same justified `eslint-disable-next-line` the six sibling `goto` calls already carry (commit 2bfc930). One warning remains: `GenerationPanel.svelte:83 Unused eslint-disable directive (no-useless-assignment)`. It is a built-in rule, independent of the boundary config, and a file this plan does not touch; I could not establish the pre-16-05 baseline without a second checkout, so it is reported rather than fixed. Exit code of `pnpm lint` is 0.

## Task 2: import-graph walkers and source-scan guards

Starting state: the codemod had already rewritten `apps/web/src/lib/ai/import-graph.ts` to a `#lib` branch (it resolves exact files, `.ts`, `.svelte.ts`, `.svelte`, `.js` to `.ts`, and `/index.ts`). `tooling/import-graph.ts` still had the `$lib` branch; it is a one-line change that agent-boundary.test.ts needs, so it went into the Task 1 commit (ordering deviation, see below).

Mutation table (the old spelling is restored in one predicate at a time, planted `#lib` case must fail). "Real tree" means the assertion over the actual source passes in the final state.

| Guard | Planted violation | Reported with fix | Fails when old spelling restored |
|-------|-------------------|-------------------|----------------------------------|
| tooling/import-graph.ts walker | gateway import two hops away (`#lib/data/rentcast/c.ts`), studio entry `#lib/data/x.ts`, barrel to agent CRM / investor / leads | yes | yes: 5 failed of 15 (agent-boundary planted control, 2 studio real-tree tests, 2 studio planted controls) |
| ai/import-graph.ts walker (no-auto-send) | dynamic `import('#lib/leads/web3forms.ts')`, type-only `#lib/leads/types.ts`, unresolvable `#lib/leads/typo.ts`, unmapped `#other/...` alias | yes | yes: 6 failed of 27 |
| no-auto-send unresolved-specifier check | `#lib/leads/typo.ts` edge with `to: null` | yes (control: resolvable `#lib/ai/s.ts` and bare `svelte` silent) | yes: 1 failed of 27 |
| investor-port barrel regex | `#lib/data/index.ts`, `index.js`, multi-line named import, bare `#lib/data` | yes (controls: `import type`, `#lib/data/tables.ts`, shared and relative imports silent) | yes: 5 failed of 21 (4 planted plus the real-tree sweep) |
| analyzer-page regex | import of `#lib/data/index.ts`, `#lib/data/gateway.ts`, `../data/investor-port` | yes (controls: `./sample-deal`, shared format) | yes: 2 failed of 10 |
| key-card-additions (`importsDefault`) | exact default-import check on `#lib/ai/ui/AiModelField.svelte` | yes (controls: missing extension, other file, wrong name, other component all false) | yes: 1 failed of 20 |
| studio boundaries | planted `.svelte` entry importing `#lib/data/x.ts` and the exempt `#lib/data/tables.ts` | yes (new control: shared-only entry reaches nothing) | yes: 1 failed of 6 |
| affordability needles | planted source importing `#lib/storage/db.ts`, `#lib/data/index.ts`, `#lib/ai/runner.ts` via a shared `filesContaining` helper | yes (control: source importing only `./AffordabilityForm.svelte` silent) | yes: 1 failed of 32 (the planted `#lib/data` row) |

Notes:

- Test files that carry planted import text can trip the scans that read the tree. analyzer-page's planted lines were caught by investor-port's scan of every features/investor file, so they are built from the specifier (`importOf(spec)`) instead of written as full import lines.
- The old walker predicate in no-auto-send only tested `startsWith('$lib/')`; once the tree became `#lib` it passed vacuously. It is now a pure `unresolvedLocal(edges)` helper plus `unmappedAliases(external)`, both with planted cases.
- A real bug found in the migration: `boundaries.test.ts` planted fixtures still contained `$lib/data/tables` in a `\n`-escaped string. That fixture imported nothing resolvable, which is why the test appeared to pass; it now reads `#lib/data/tables.ts`.
- `pnpm exec vitest run` on the six files: 6 files, 116 tests pass.

## Task 3: gate, config and remaining strings

- scripts/kit3-migration.test.ts written first; the sweep test was red (planted cases green, sweep red) before the fixes.
- components.json aliases to `#lib`; the `$lib` entries removed from the isVitest alias block (vite.config.ts) and from vitest.browser.config.ts. `fileURLToPath` is still used for the `$app/paths` stub, so the import stays.
- 28 files had `$lib` only in comments or test titles (apps/web/src, tests/e2e/support/seed-all.ts); they now say `#lib`. Two `svelte.config.js` mentions in comments (kit.options.js, csp-policy.test.ts) were reworded. No `@migration-task`, `$app/environment`, `$app/stores` or MIGRATION_TASKS file exists.
- Gate: 5 tokens, `findings(path, text)`, skips `.md`, `.planning/`, pnpm-lock.yaml and binary files, allowlist is frozen and contains only scripts/kit3-migration.test.ts. 11 tests: planted per token (5), non-allowlisted neighbour path, control (clean text, md, planning, lockfile, binary), allowlist shape, sweep non-vacuity (>500 files, this file read and spelling every token), the sweep, MIGRATION_TASKS absence.
- `git grep -nF '$lib' -- . ':!*.md' ':!pnpm-lock.yaml' ':!scripts/kit3-migration.test.ts'` also returns nothing once `.planning` is excluded (it has the plan text itself).

## Task 4: shadcn-svelte dry run (assumption A6)

`shadcn-svelte add` 1.6.1 has no `--dry-run`. As the plan allows, I ran it against a scratch copy of the app outside the repo (`add button --no-deps-install --yes --cwd <scratch>`).

1. With the real `tsconfig.json` (Kit 3, `"extends": "$app/tsconfig"`) the CLI dies before it reads any alias: `Error: File '$app/tsconfig' not found.` at `resolveExtends`. This is independent of `#lib`. The CLI cannot run in this repo until it is bumped (plan 12, CLI 1.8.0).
2. With the scratch tsconfig pointed at the generated `.svelte-kit/tsconfig.json`, it installed `src/lib/components/ui/button/{button.svelte,index.ts}`, the component imports `#lib/utils.js`, and components.json was byte-identical afterwards. So `#lib` aliases are read correctly and `$lib` is not written back.

Repo `git status` was unchanged (only the pre-existing config.json diff); `git diff --stat -- pnpm-lock.yaml package.json apps/web/package.json` is empty. No commit for this task.

## Plan gate results

| Gate | Result |
|------|--------|
| `vitest run scripts/kit3-migration.test.ts scripts/eslint-rules.test.ts scripts/agent-boundary.test.ts` | 3 files, 155 tests pass |
| `pnpm lint` | exit 0 (1 pre-existing-looking warning, see above) |
| `svelte-check --tsconfig ./tsconfig.json` | 3,218 files, 0 errors, 0 warnings |
| `vitest run --project web --project web-serial --project scripts --project scripts-serial` | 230 files, 4,141 tests, all pass (79 s) |
| `vitest run --project web-browser --project web-browser-serial` (extra, because the alias left the browser config) | 34 files, 262 tests, all pass (40 s); no WLAN 8003 event in the 19 minutes before the run |

## Deviations from plan

**1. [Rule 3] tooling/import-graph.ts migrated in Task 1, not Task 2.** scripts/agent-boundary.test.ts is a Task 1 file and its planted graph uses `#lib` specifiers that the old walker cannot resolve, so Task 1's verify could not pass without the one-line walker change. It is listed under Task 2's guard table and mutation-proved there.

**2. [Rule 1] Data-port exemption added to DATA_INTERNALS.** Mechanically escaping the groups would have banned the port itself (`#lib/data/index.ts` is a match for `\#lib/data/*`). `!\#lib/data/index.ts` and `!\#lib/data/index.js` keep the set of allowed modules identical to before.

**3. [Rule 1] Lint errors from 16-05.** Two shallow `goto` calls needed the standard justified disable (commit 2bfc930).

**4. [Rule 3] Task 4 used a scratch copy.** `--dry-run` does not exist; the plan's fallback applies.

**5. Tooling mistakes, no effect on the tree.** Several Python/heredoc edits mangled backslashes, newlines and `\b` in string literals (known from MEMORY); each was caught by prettier or a failing test and repaired. Nothing from that is in the commits.

No auth gates, no installs.

## Known stubs

None.

## Left red beyond this plan

- Plan 08: `src/service-worker.ts` (`$service-worker`), the worker rewrite and its guard; the `$service-worker` token is added to the kit3-migration gate there.
- Plans 09 and 10: budget and the full gate; `pnpm build` and E2E were not run here.
- Plan 12: shadcn-svelte CLI bump (1.6.1 cannot parse Kit 3's `$app/tsconfig` extends).
- Unrelated and unchanged: vite/vitest configs warn about `../../tooling/vitest/lanes` without an extension.

## Self-Check: PASSED

Commits 0395e80, 2bfc930, ee8b6ea, 3e448e6 exist; scripts/kit3-migration.test.ts exists; no `$lib` outside the allowlist.
