# Phase 14: Carried Debt - Context

**Gathered:** 2026-11-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Close every follow-up carried out of v1.0 (DEBT-01..09 in `.planning/REQUIREMENTS.md:34-42`) to its sourced definition of done, record the three owner decisions that ride along, and keep `git blame` clean (no reformatting, no drive-by renames, no file moves) so the Phase 16 Kit 3 codemod is the first large rewrite. CI on GitHub is the verifier for every fix. Phase 15 (different files) and Phase 17 may run alongside; nothing from this phase runs while Phase 16 is in flight.

Out of scope: new capabilities, the toolchain majors (Phase 16), test-lane determinism work beyond what DEBT-07 itself needs (Phase 15), the extension release (Phase 17).

</domain>

<decisions>
## Implementation Decisions

### Owner decisions riding along (taken 2026-11-05; copy each into PROJECT.md Key Decisions)
- **D-01 Snapshot page count:** the all-sections Market Snapshot sample stays at 6 Letter pages; the E2E cap in `apps/web/tests/e2e/snapshot-print.spec.ts` stays at 6. No print-CSS change. Close ledger row L79 as `decided (accept 6 pages)` with this date; close 09-HUMAN-UAT UAT-6.
- **D-02 Studio license titles:** the Studio disclosure keeps the fixed NY-safe titles ("Licensed Real Estate Salesperson"); the Phase 8 email footer keeps per-state titles. No code change. Close L80 as `decided (keep NY-safe titles, pending counsel)`; close 09-HUMAN-UAT UAT-7.
- **D-03 Duplicate memo block reason:** a phrase that is both an advertising claim and advice language keeps listing both reasons in the investor memo gate. No change to `apps/web/src/lib/features/investor/memo/memo-checks.ts`. Close L81 as `decided (keep both reasons)`; close 09-HUMAN-UAT UAT-8.
- **D-04 Showcase badge:** already decided 2026-10-29 (stays excluded by default; REQUIREMENTS EXT-F3, ledger L92). Phase 14 only records it in the PROJECT.md Key Decisions table so Phase 17 can cite one place.

### DEBT-08 re-scoped to measured parity
- **D-05:** the DEBT-08 premise ("Pages never serves dotfiles") is contradicted by Phase 13 evidence: the live origin answered `200` for `/.nojekyll` (`13-13-SUMMARY.md:152`, `13-19-SUMMARY.md:95`). The first task of the DEBT-08 plan probes the live origin for a dotfile (`/.nojekyll`), a dot-directory path, and a dotfile that does not exist, and records the status codes in the SUMMARY. `scripts/serve-pages.mjs` is then changed only where it disagrees with the measured behaviour, and a scripts-project test pins each measured case. REQUIREMENTS DEBT-08 and ROADMAP success criterion 5 are reworded from "answers 404 for dotfiles" to "matches the measured GitHub Pages dotfile behaviour" in the same commit as the fix. If the live origin matches the emulator everywhere, DEBT-08 closes with the test alone.

### Requirement text corrections (fold into the phase, no owner decision needed)
- **D-06 DEBT-04 wording:** `TRAN_ORIGIN` no longer exists (removed in 13-10; `scripts/site-url.test.ts:161-181` asserts its absence). The parity test asserts `TRAN_SITE_URL` equals `resolveSiteUrl()` for the configured `PUBLIC_SITE_URL` + `BASE_PATH`, and `PRIVACY_URL` equals `TRAN_SITE_URL + '/legal/privacy/#browser-extension'`, and the `browser-extension` anchor exists in `apps/web/src/routes/(marketing)/legal/privacy/+page.svelte`. Reword REQUIREMENTS DEBT-04 and ROADMAP criterion 3 accordingly. The literal in `scripts/extension-docs.test.ts:29-32` and the origin-only URLs in `scripts/assert-extension.test.ts` import the constant/helper instead.
- **D-07 Ledger numbering:** `.planning/HUMAN-UAT.md` L66 says "Phase 14 DEBT-02"; the notes-only print item is DEBT-03. Fix the row when closing it.
- **D-08 Stale verification item:** `12-VERIFICATION.md` still lists "create org `tranrealestate`" as human_needed; it was superseded by the 2026-10-29 owner decision (personal-account project site). Mark it superseded in the phase close-out so `audit-uat` stops reporting it.

### Other carried items (defaults chosen by the owner 2026-11-05)
- **D-09:** The four AI-provider CORS re-probes (ledger L36: Anthropic, OpenAI, Gemini, OpenRouter) stay an owner task on the ledger; they need the owner's real keys and are not a plan task. Phase 14 leaves L36 as is.
- **D-10:** The live-smoke HTTP 429 hardening (map 429 on navigation to the exit-2 precondition path of `scripts/smoke.mjs`, zero retries otherwise) is deferred to Phase 15 (test-lane determinism). Not in Phase 14.
- **D-11:** `@types/node` majors stay ignored by Dependabot until Phase 16 (owner decision B, 2026-10-30). No pin changes in Phase 14 beyond what a red CI run forces at the root cause.
- **D-12:** Ledger rows L66 (DEBT-03) and L89 (DEBT-09) close as `superseded by DEBT-0x` when the corresponding plan lands; the sitemap rows L86/L99 are not Phase 14 work.

### Reason copy (DEBT-02)
- **D-13:** The dedicated review-only reason string is spec-owned: `/gsd:ui-phase 14` writes it into the UI spec (extending `09-UI-SPEC.md` §Step 4 gating reasons at line ~611) before planning, and the plan copies it verbatim into `apps/web/src/lib/features/studio/snapshot/save-gate.ts`. Reuse the Phase 5 pattern: `WARN_REASON` and `blockReason(n)` in `apps/web/src/lib/ai/ui/panel-controller.ts:31-37` already pluralize phrase/phrases; the snapshot gate gets the same shape (singular/plural must-fix string, a distinct review-only string, never "Fix the 0 items").

### Phase shape
- **D-14:** One plan per DEBT item (nine plans) plus one close-out plan (ledger rows, PROJECT.md Key Decisions, REQUIREMENTS ticks, 12-VERIFICATION supersession, verification). Plans touching disjoint files may run in the same wave; DEBT-02/DEBT-03 (studio and memo gates) and DEBT-06 (cn/tv, Badge, Button, used by DEBT-09's trim) are ordered: DEBT-06 before DEBT-09.
- **D-15:** Blame-clean means: edit only the lines the fix needs; no Prettier re-wrap of untouched lines; no renames or moves; no `pnpm` pin changes. Any plan that cannot avoid a wide diff stops and records why.
- **D-16:** "CPU pressure" for the DEBT-07 proof is `--repeat-each 10` while the full unit suite (or an equivalent CPU-bound process) runs concurrently on the same machine, recorded with the worker count; this is the same shape Phase 15 will formalize, so record the method in the SUMMARY for Phase 15 to reuse.

### Claude's Discretion
- Serialization format of the notes-only numerals in artifact `meta` (must fit `isMeta`: at most 16 keys, string values at most 200 chars; `apps/web/src/lib/ai/storage/artifacts.ts:99-105`).
- The `idPrefix` prop name and default for `ListingCard`, and how `ResultsList`/`SplitList` focus lookups adopt it.
- Which validation stays inline vs lazy-loaded for the DEBT-09 trim, as long as the Fair Housing and lead-block checks keep running before any send.
- The exact bounded-wait implementation for the `tran-alerts` lock (AbortSignal timeout about ten seconds) and the shape of the busy/timeout result.
- Mutation-ledger wording; follow the SUMMARY "## Mutation ledger" table pattern.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase definition
- `.planning/ROADMAP.md` §"Phase 14: Carried Debt" (lines ~135-146) — goal, success criteria 1-5, riding-along decisions, UI hint; criteria 3 and 5 to be reworded per D-05/D-06
- `.planning/REQUIREMENTS.md:32-42` — DEBT-01..09 text; :132-140 traceability rows to tick
- `.planning/research/SUMMARY.md:124, 187` — original breakdown (names `scripts/origin-parity.test.ts`, `backup-roundtrip.spec.ts`, `seed-all.ts`; none exist yet)
- `.planning/HUMAN-UAT.md` — ledger rows L36, L51, L66, L79, L80, L81, L89, L92 (close-out targets)
- `.planning/PROJECT.md` §Key Decisions (line ~221) — where D-01..D-04 and the earlier fix/bounded-wait/trim choices are recorded
- `.planning/phases/12-go-live-readiness-local-smoke-suite/12-VERIFICATION.md` — stale org-gate human_needed item (D-08)

### Sourced definitions of done, per item
- DEBT-01: `.planning/phases/06-renter-portal/deferred-items.md:12-21`; `.planning/milestones/v1.0-MILESTONE-AUDIT.md` tech_debt "OPEN (06-22)"; `06-HUMAN-UAT.md:52,60` (R12)
- DEBT-02: `.planning/milestones/v1.0-MILESTONE-AUDIT.md` tech_debt "Fix the 0 items" (~line 69); `.planning/phases/09-agent-content-studio-market-snapshot-reports/09-UI-SPEC.md:611` (gating reasons), :419 (gate rules), :232/:644 (focus)
- DEBT-03: `.planning/phases/07-investor-portal/07-HUMAN-UAT.md` row S2
- DEBT-04: `.planning/phases/13-*/13-02-SUMMARY.md:169`, `13-04-SUMMARY.md:118`; `13-CONTEXT.md` D-04 (origin + base path)
- DEBT-05: `.planning/milestones/v1.0-MILESTONE-AUDIT.md` Integration (low) PLAT-04 (~line 55)
- DEBT-06: `.planning/phases/04-data-layer-rentcast-gateway-budget-guard-demo-fixtures/deferred-items.md:3-12` (exact `classGroups` fix); `06-renter-portal/deferred-items.md:5-10`
- DEBT-07: `.planning/phases/10-launch-hardening-go-to-market/10-23-SUMMARY.md:50, 179-183, 226`
- DEBT-08: `13-13-SUMMARY.md:152`, `13-19-SUMMARY.md:95` (live `200` for `/.nojekyll`); `.planning/research/ARCHITECTURE.md:13 (F3), :324 (K7)`
- DEBT-09: `.planning/phases/10-launch-hardening-go-to-market/10-HUMAN-UAT.md:45-47` (test 8); `docs/LAUNCH-AUDIT.md:158-197` (cause rows); `docs/audit/budget.txt` (measured sizes)

### Owner-decision sources
- `.planning/phases/09-agent-content-studio-market-snapshot-reports/09-HUMAN-UAT.md:65-89` — UAT-6, UAT-7, UAT-8 (closed by D-01..D-03)
- `.planning/phases/11-zillow-sponsored-listing-filter-extension/11-HUMAN-UAT.md:40-43` — Showcase row (D-04, already decided)

### Process
- `tasks/lessons.md` — mutation-ledger practice, `corepack.cmd` under `MSYS_NO_PATHCONV=1`, never write `NAME_KEY=value` in docs, deploy-env rule for audit regeneration
- `docs/RUNBOOK.md` — redeploy, read a smoke result, worker counts

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/web/src/lib/ai/ui/panel-controller.ts:31-37` — `WARN_REASON` and pluralizing `blockReason(n)`; the pattern DEBT-02's save-gate strings follow.
- `apps/web/tests/e2e/support/network.ts` — deny-all `net` fixture and `rentcastCalls(net)`; DEBT-05 asserts `expect(rentcastCalls(net)).toBe(0)`. Seed helpers in `support/seed.ts`; backup file helpers in `tests/e2e/helpers/backup-files.ts` (`makeBackup`, `fileFrom`) and `helpers/settings.ts`.
- `apps/web/src/lib/storage/backup-registry.ts:40-57, 77` — `DEFAULT_TABLES` and `listBackupTables()`; DEBT-05 seeds one row per registered table (prefs; ledger, savedSearches, searchSnapshots, dataPrefs; aiArtifacts; renterShortlist, renterSearchMeta; deals, investorDraft, buyBoxes, watchedZips; agent contacts/tasks/activities/profile; studioDraft, snapshots).
- `apps/web/src/lib/ai/storage/artifacts.test.ts:416-432` — existing `meta` round-trip test to extend for DEBT-03.
- `apps/web/vitest.browser.config.ts` (project `web-browser`) and `apps/web/src/lib/testing/axe.ts` — real-Chromium component tests with axe, for DEBT-06's Badge/Button computed font-size test.
- `scripts/vitest.config.ts` (project `scripts`, node, no-network setup) — home of the DEBT-04 parity test and the DEBT-08 serve-pages test.
- `scripts/assert-budget.mjs:16-23, 110-139` and `scripts/assert-budget.test.ts:126-178` — `HARD`/`REPORT` sets; DEBT-09 moves `/feedback/` and `/for-*/` into `HARD` (test at :155 flips).

### Established Patterns
- Mutation tests are not committed; each SUMMARY carries a "## Mutation ledger" table (`| # | Mutant | Failing test(s) |`, "N/N caught", restore check). Test files cite their ledger in a header comment (`saved-search-repo.test.ts:3`).
- Owner-run checks live in `.planning/HUMAN-UAT.md` with one row per check; per-phase HUMAN-UAT files are history (`status: superseded`).
- Every E2E runs under both base paths; CSP oracle and axe on every route; `pnpm verify` is the local gate and `ci.yml` the remote one. `test:unit` runs with no deploy env in CI.
- Workarounds for the tailwind-merge font-size bug already exist (`FairHousingText.svelte:46`, `dropdown-menu-content.svelte:21`, `popover-content.svelte:22`, `StageBadge.svelte:4`); DEBT-06 may remove them once `cn()` is fixed, but only if the diff stays line-local (D-15).

### Integration Points
- DEBT-01: `apps/web/src/lib/features/renter/search/ListingCard.svelte:54,111,156` (`addrId`); render sites `ResultsList.svelte:84` (focus lookup :49-50), `map/SplitList.svelte:85` (focus :49-54), `map/SelectedListingPreview.svelte:70` (focus :35-37); mounted from `MapTab.svelte:110-111, 146-147`. Tests: `ResultsView.browser.test.ts:76-95`, `tests/e2e/renter-results.spec.ts:99-117`, `renter-map-split.spec.ts:61-71`, `renter-map.spec.ts:123-139`, `renter-journey.spec.ts:75-96`. No duplicate-id assertion exists yet.
- DEBT-02: `apps/web/src/lib/features/studio/snapshot/save-gate.ts:35-82` (`notesFindingsReason`, `saveGateReason`, `notesGateFields`); `SnapshotBuilder.svelte:94-97, 203, 307-309, 348-359, 530-534`; tests `save-gate.test.ts:52-111` (:60 pins the "Fix the 0 items" bug), `tests/e2e/snapshot-builder.spec.ts:40, 191-205`.
- DEBT-03: `apps/web/src/routes/(print)/print/memo/+page.svelte:56-65` (notes hard-coded `''`); `packages/core/src/finance/memo-facts.ts:184-189` (`allowed` from notes, source `'your notes'`); `MemoPage.svelte:41, 59, 330` (`artifactMeta`); meta flow `GenerationPanel.svelte:130/225`, `panel-state.svelte.ts:67,415`; store `ai/storage/artifacts.ts:51-52, 99-105, 148-167, 190-198`; `tests/e2e/investor/print.spec.ts:53, 142-166`.
- DEBT-04: `apps/extension/src/lib/site.ts:11-13` (`TRAN_SITE_URL`, `PRIVACY_URL`); defines in `wxt.config.ts:32-37`, `vitest.config.ts:10`, `vitest.browser.config.ts:23`; `apps/web/src/lib/site-config.js:13, 21, 38`; anchor `legal/privacy/+page.svelte:118`; `scripts/site-url.test.ts:134-181`, `scripts/extension-docs.test.ts:29-32, 89, 112, 147-165`, `scripts/assert-extension.test.ts:76, 414, 453, 505`.
- DEBT-05: `apps/web/src/lib/storage/db.ts:38-86`; Settings UI `features/shared/settings/BackupExport.svelte`, `BackupImport.svelte`, `ImportPreview.svelte`, `BackupSection.svelte`; existing `tests/e2e/settings-backup.spec.ts:62-111` (fresh context, `#backup-file`, seeds only `prefs`).
- DEBT-06: `apps/web/src/lib/utils.ts:1-6` (plain `twMerge`); tokens `app.css:37-46`; `components/ui/badge/badge.svelte:4-10`, `components/ui/button/button.svelte:6-17` (no `twMergeConfig`); tailwind-merge 3.7.0 / tailwind-variants 3.3.1 (`apps/web/package.json:40-41`). No Badge/Button or `utils` tests exist.
- DEBT-07: `apps/web/src/lib/data/scheduler.ts:27-44` (`ifAvailable: true`), :92-95 (`skipped: 'busy'`), :97+ (`pass()` already lists inside the lock); `alerts.ts:42-58`; `scheduler.test.ts:234-280` (:272-280 asserts `ifAvailable`, must change); `tests/e2e/renter-saved.spec.ts:83-135` (uses `page.clock`).
- DEBT-08: `scripts/serve-pages.mjs:50-95` (`site()` serves any existing file 200; traversal guard :74; dir 301 :81-85; 404 via `404.html` :65); consumers `apps/web/playwright.config.ts:39-43`, `scripts/smoke.mjs:249-308`; related `svelte.config.js:26-28` precache filter, `tests/e2e/pwa.spec.ts:40-58`, `scripts/service-worker-guard.test.ts`, `scripts/assert-csp.mjs:92`.
- DEBT-09: `routes/(marketing)/feedback/+page.svelte` → `components/forms/FeedbackForm.svelte:14-18` (imports `findKeyMaterial` from `@tran/core/backup`, which pulls zod; shadcn `Button`; bits-ui `RadioGroup` :203-217; `Textarea`); `for-*` → `components/marketing/AudiencePage.svelte` → `WaitlistForm.svelte:13` (`Button`); both → `$lib/leads/owner-forms` → `web3forms-sink.ts:13` → `@tran/core/leads/lead-block` (`zod/mini`); `form-gate.ts` plain validators. Measured: `/feedback/` 105,327 B gz, each `/for-*/` ~99,156 B gz vs 61,440 B budget; cause rows in `docs/LAUNCH-AUDIT.md:158-197` (Button via tailwind-variants + tailwind-merge 13.0 + 8.6 KB, zod 9.2 KB, RadioGroup ~3 KB). `scripts/launch-audit.mjs:15, 33, 468-513`.

</code_context>

<specifics>
## Specific Ideas

- Record every riding-along decision in the PROJECT.md Key Decisions table in the first close-out commit, not at the end; Phase 17 needs the Showcase row there.
- When a requirement's premise turns out wrong (DEBT-08), measure the live origin first and reword the requirement in the same commit as the fix, so REQUIREMENTS.md never describes behaviour the code does not have.

</specifics>

<deferred>
## Deferred Ideas

- Live-smoke HTTP 429 hardening (`scripts/smoke.mjs` exit-2 path) — Phase 15.
- `@types/node` major bump — Phase 16 (owner decision B, 2026-10-30).
- AI-provider CORS re-probes (L36) — owner ledger task, outside any phase.
- Studio per-state license titles — only if counsel asks; re-open L80 then.
- Removing the four existing `text-label` tailwind-merge workarounds — allowed in DEBT-06 only if line-local; otherwise Phase 16 after the codemod.

</deferred>

---

*Phase: 14-carried-debt*
*Context gathered: 2026-11-05*
