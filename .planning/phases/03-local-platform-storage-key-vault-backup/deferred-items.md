# Phase 3 deferred items

## Load-dependent E2E flake: import preview click not reflected within 5 s (found in 03-17)

- **Seen:** first `corepack pnpm verify` of 2026-10-05 (2 of 456 E2E failed). Also seen once in 03-15 (app-notice test 4).
- **Tests:** `apps/web/tests/e2e/app-notice.spec.ts` "never-backed-up notice at 8 days on every app page" [root], at the `seed()` helper's `import-result` expectation after clicking **Import backup**; `apps/web/tests/e2e/settings-backup.spec.ts` "fresh-profile import with preview" [sub], at `expect(preview).toHaveCount(0)` after clicking **Close**.
- **Symptom:** the click is accepted but the ImportPreview panel does not change within the default 5 s expect timeout. The snapshot shows the preview still rendered with the buttons enabled.
- **Not reproducible:** 140/140 with `--repeat-each 5` on both specs and bases; the second full `verify` and two further full E2E runs were green (454 passed / 2 skipped each).
- **Status:** no deterministic root cause found. The first run's traces were overwritten by the isolated rerun before they could be inspected.
- **Next time it fires:** copy `apps/web/test-results/` before rerunning, then open the trace (`pnpm --filter web exec playwright show-trace …/trace.zip`) and check whether the click event reached `importMerge`/`onClose` (console + DOM snapshots at the action) or whether ImportPreview re-mounted between Playwright's actionability check and the dispatch. Do not raise the expect timeout until the trace has been read.
- **Owner:** next phase that touches `apps/web/src/lib/features/shared/settings/ImportPreview.svelte` or CI stability (CI will surface it if it is real).
