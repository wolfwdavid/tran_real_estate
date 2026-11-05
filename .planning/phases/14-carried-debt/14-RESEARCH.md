# Phase 14: Carried Debt - Research

**Researched:** 2026-11-05
**Domain:** Debt closure in an existing SvelteKit 2 / Svelte 5 monorepo (renter list/map ids, studio and memo gates, extension origin parity, backup round-trip E2E, tailwind-merge/tailwind-variants config, Web Locks bounded wait, Pages emulator parity, marketing-page JS trim)
**Confidence:** HIGH for the edit surfaces (every path and line below was read on 2026-11-05). MEDIUM for two measured predictions: the DEBT-09 post-trim sizes and Tailwind CSS loading in the `web-browser` project.

## Summary

All nine items are small, line-local fixes in files that already exist, and every item already has a test file to extend. Research turned up five facts the planner cannot get from CONTEXT.md or the UI-SPEC alone:

1. **tailwind-variants 3.3.1 does not use the installed `tailwind-merge`** (DEBT-06). It ships its own copy of the merger inside `node_modules/tailwind-variants/dist/index.js` (`src/internal/merge`, `createTwMerge`). `extendTailwindMerge` therefore only fixes `cn()`. Every `tv()` needs its own `twMergeConfig`: either `tv(opts, { twMergeConfig })` or a `createTV({ twMergeConfig })` instance. Verified by running both in Node: plain `tv` drops `text-label`, the configured instance keeps it, and the config does not leak to other `tv` instances.
2. **The `web-browser` Vitest project loads no CSS** (DEBT-06). `vitest.browser.config.ts` has only `svelte()`, and `testing/axe.ts` says "Component tests load no CSS". A computed-font-size test therefore reads the inherited size unless the plan adds `@tailwindcss/vite` to that config and the test imports `app.css`. (Vitest's `css` option does not apply to browser mode, so Vite processes the import once the plugin is present.)
3. **The UI-SPEC trim may not reach 60 KB on its own** (DEBT-09). I measured the existing `apps/web/build` (2026-10-31, after the last code change; every commit since is docs-only). For each `/for-*/` page, the chunks the spec removes total about 35-37 KB gz, which leaves about 62-64 KB against a 61,440 B budget. `/feedback/` would land at about 60-62 KB. The plan must measure after the trim, and it needs a second lever ready, e.g. the `audiences` content module (`Cwwh5bE5.js`, 6 KB gz) holds all three audiences.
4. **The HUMAN-UAT ledger oracle rejects a result starting with "superseded"** (close-out). `scripts/human-uat-ledger.test.ts:43-51,140` allows only `pending|passed|failed|carried|decided|cut|not applicable`. D-12 says to close L66/L89 "as `superseded by DEBT-0x`", so the cell must read e.g. `decided (superseded by DEBT-03, 2026-11-xx)`, or the plan must deliberately extend the oracle.
5. **The DEBT-04 docs test URL depends on the environment** (DEBT-04). `test:unit` runs in CI with no deploy env, so `BASE_PATH` is unset and `resolveSiteUrl()` returns the bare origin. The docs and the Edge listing must carry the live project-site URL (`.../tran_real_estate/legal/privacy/#browser-extension`), so the doc test has to pass an explicit live env (`resolveSiteUrl({ BASE_PATH: '/tran_real_estate' })`), not `process.env`.

Other facts that matter:
- `pass()` already lists due searches inside the lock (`scheduler.ts:93,114`). DEBT-07 is only the lock-acquisition change plus tests that pin it.
- Node 24.18 has a real `navigator.locks`. The two-tab unit proof can therefore use the real lock manager in the `web` project, not a stub.
- A `signal` combined with `ifAvailable` throws `NotSupportedError` (verified in Node and on MDN).
- A timed-out request rejects with `signal.reason`, which is a `TimeoutError` for `AbortSignal.timeout`, not an `AbortError`. Detect the timeout by checking `signal.aborted`, not the error name.

**Primary recommendation:** write one plan per DEBT item, as D-14 says. Every plan starts with the read-first files below, ships the test before or with the fix, and records a "## Mutation ledger" table. Run DEBT-06 before DEBT-09, and DEBT-03 before DEBT-05 (DEBT-05 can then prove that `meta` survives the UI round-trip by printing a notes-only memo).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Owner decisions riding along (taken 2026-11-05; copy each into PROJECT.md Key Decisions)
- **D-01 Snapshot page count:** the all-sections Market Snapshot sample stays at 6 Letter pages; the E2E cap in `apps/web/tests/e2e/snapshot-print.spec.ts` stays at 6. No print-CSS change. Close ledger row L79 as `decided (accept 6 pages)` with this date; close 09-HUMAN-UAT UAT-6.
- **D-02 Studio license titles:** the Studio disclosure keeps the fixed NY-safe titles ("Licensed Real Estate Salesperson"); the Phase 8 email footer keeps per-state titles. No code change. Close L80 as `decided (keep NY-safe titles, pending counsel)`; close 09-HUMAN-UAT UAT-7.
- **D-03 Duplicate memo block reason:** a phrase that is both an advertising claim and advice language keeps listing both reasons in the investor memo gate. No change to `apps/web/src/lib/features/investor/memo/memo-checks.ts`. Close L81 as `decided (keep both reasons)`; close 09-HUMAN-UAT UAT-8.
- **D-04 Showcase badge:** already decided 2026-10-29 (stays excluded by default; REQUIREMENTS EXT-F3, ledger L92). Phase 14 only records it in the PROJECT.md Key Decisions table so Phase 17 can cite one place.

#### DEBT-08 re-scoped to measured parity
- **D-05:** the DEBT-08 premise ("Pages never serves dotfiles") is contradicted by Phase 13 evidence: the live origin answered `200` for `/.nojekyll` (`13-13-SUMMARY.md:152`, `13-19-SUMMARY.md:95`). The first task of the DEBT-08 plan probes the live origin for a dotfile (`/.nojekyll`), a dot-directory path, and a dotfile that does not exist, and records the status codes in the SUMMARY. `scripts/serve-pages.mjs` is then changed only where it disagrees with the measured behaviour, and a scripts-project test pins each measured case. REQUIREMENTS DEBT-08 and ROADMAP success criterion 5 are reworded from "answers 404 for dotfiles" to "matches the measured GitHub Pages dotfile behaviour" in the same commit as the fix. If the live origin matches the emulator everywhere, DEBT-08 closes with the test alone.

#### Requirement text corrections (fold into the phase, no owner decision needed)
- **D-06 DEBT-04 wording:** `TRAN_ORIGIN` no longer exists (removed in 13-10; `scripts/site-url.test.ts:161-181` asserts its absence). The parity test asserts `TRAN_SITE_URL` equals `resolveSiteUrl()` for the configured `PUBLIC_SITE_URL` + `BASE_PATH`, and `PRIVACY_URL` equals `TRAN_SITE_URL + '/legal/privacy/#browser-extension'`, and the `browser-extension` anchor exists in `apps/web/src/routes/(marketing)/legal/privacy/+page.svelte`. Reword REQUIREMENTS DEBT-04 and ROADMAP criterion 3 accordingly. The literal in `scripts/extension-docs.test.ts:29-32` and the origin-only URLs in `scripts/assert-extension.test.ts` import the constant/helper instead.
- **D-07 Ledger numbering:** `.planning/HUMAN-UAT.md` L66 says "Phase 14 DEBT-02"; the notes-only print item is DEBT-03. Fix the row when closing it.
- **D-08 Stale verification item:** `12-VERIFICATION.md` still lists "create org `tranrealestate`" as human_needed; it was superseded by the 2026-10-29 owner decision (personal-account project site). Mark it superseded in the phase close-out so `audit-uat` stops reporting it.

#### Other carried items (defaults chosen by the owner 2026-11-05)
- **D-09:** The four AI-provider CORS re-probes (ledger L36: Anthropic, OpenAI, Gemini, OpenRouter) stay an owner task on the ledger; they need the owner's real keys and are not a plan task. Phase 14 leaves L36 as is.
- **D-10:** The live-smoke HTTP 429 hardening (map 429 on navigation to the exit-2 precondition path of `scripts/smoke.mjs`, zero retries otherwise) is deferred to Phase 15 (test-lane determinism). Not in Phase 14.
- **D-11:** `@types/node` majors stay ignored by Dependabot until Phase 16 (owner decision B, 2026-10-30). No pin changes in Phase 14 beyond what a red CI run forces at the root cause.
- **D-12:** Ledger rows L66 (DEBT-03) and L89 (DEBT-09) close as `superseded by DEBT-0x` when the corresponding plan lands; the sitemap rows L86/L99 are not Phase 14 work.

#### Reason copy (DEBT-02)
- **D-13:** The dedicated review-only reason string is spec-owned: `/gsd:ui-phase 14` writes it into the UI spec (extending `09-UI-SPEC.md` §Step 4 gating reasons at line ~611) before planning, and the plan copies it verbatim into `apps/web/src/lib/features/studio/snapshot/save-gate.ts`. Reuse the Phase 5 pattern: `WARN_REASON` and `blockReason(n)` in `apps/web/src/lib/ai/ui/panel-controller.ts:31-37` already pluralize phrase/phrases; the snapshot gate gets the same shape (singular/plural must-fix string, a distinct review-only string, never "Fix the 0 items").

#### Phase shape
- **D-14:** One plan per DEBT item (nine plans) plus one close-out plan (ledger rows, PROJECT.md Key Decisions, REQUIREMENTS ticks, 12-VERIFICATION supersession, verification). Plans touching disjoint files may run in the same wave; DEBT-02/DEBT-03 (studio and memo gates) and DEBT-06 (cn/tv, Badge, Button, used by DEBT-09's trim) are ordered: DEBT-06 before DEBT-09.
- **D-15:** Blame-clean means: edit only the lines the fix needs; no Prettier re-wrap of untouched lines; no renames or moves; no `pnpm` pin changes. Any plan that cannot avoid a wide diff stops and records why.
- **D-16:** "CPU pressure" for the DEBT-07 proof is `--repeat-each 10` while the full unit suite (or an equivalent CPU-bound process) runs concurrently on the same machine, recorded with the worker count; this is the same shape Phase 15 will formalize, so record the method in the SUMMARY for Phase 15 to reuse.

### Claude's Discretion
- Serialization format of the notes-only numerals in artifact `meta` (must fit `isMeta`: at most 16 keys, string values at most 200 chars; `apps/web/src/lib/ai/storage/artifacts.ts:99-105`).
- The `idPrefix` prop name and default for `ListingCard`, and how `ResultsList`/`SplitList` focus lookups adopt it.
- Which validation stays inline vs lazy-loaded for the DEBT-09 trim, as long as the Fair Housing and lead-block checks keep running before any send.
- The exact bounded-wait implementation for the `tran-alerts` lock (AbortSignal timeout about ten seconds) and the shape of the busy/timeout result.
- Mutation-ledger wording; follow the SUMMARY "## Mutation ledger" table pattern.

### Deferred Ideas (OUT OF SCOPE)
- Live-smoke HTTP 429 hardening (`scripts/smoke.mjs` exit-2 path) — Phase 15.
- `@types/node` major bump — Phase 16 (owner decision B, 2026-10-30).
- AI-provider CORS re-probes (L36) — owner ledger task, outside any phase.
- Studio per-state license titles — only if counsel asks; re-open L80 then.
- Removing the four existing `text-label` tailwind-merge workarounds — allowed in DEBT-06 only if line-local; otherwise Phase 16 after the codemod.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DEBT-01 | `ListingCard` id prefix; no duplicate ids at 1280px Map tab with a pin selected; focus after Show more / pin-select | §DEBT-01: only one id (`addrId`) inside the card subtree. Three mount sites, two focus lookups that use the id (`ResultsList.svelte:49`, `SplitList.svelte:53`). Two spec selectors to update (`renter-map-split.spec.ts:71,183`). |
| DEBT-02 | Snapshot save-gate reason: pluralized must-fix, dedicated review-only string, unit + E2E | §DEBT-02: `save-gate.ts:39-40,50`, test flip at `save-gate.test.ts:47-48,60,86-88`, E2E at `snapshot-builder.spec.ts:40,191-205`, ack checkbox label from `FindingsSummary.svelte:86-87` |
| DEBT-03 | Notes-only numerals persisted in memo `meta`, read at `/print/memo/`, unit round-trip, print E2E, backup carries `meta` | §DEBT-03: write site `MemoPage.svelte:330`, read site `print/memo/+page.svelte:57-61`, `allowedFromText` (`numbers/check.ts:94`), the backup copies rows verbatim (aiArtifacts has no record schema), existing round-trip test `artifacts.test.ts:392-412` |
| DEBT-04 | Extension/web origin parity test, anchor check, doc tests import the helper | §DEBT-04: `site.ts:11-13` uses `declare const __TRAN_SITE_URL__`, so the scripts project must stub the global or read the WXT define. The doc test needs an explicit live env (Pitfall 5). |
| DEBT-05 | One Playwright spec: seed every backup table, export via UI, wipe, import with preview, each portal shows its row, 0 RentCast calls | §DEBT-05: 18 registered tables (list below), `settings-backup.spec.ts` selectors, `support/network.ts` `net` fixture semantics, raw-IndexedDB seeding pattern in `helpers/data.ts:109-200` |
| DEBT-06 | `cn()` and `tv()` extended merge config; unit test; real-Chromium computed font-size on Badge/Button; axe | §DEBT-06: tv bundles its own merger (Finding 1); the browser project needs Tailwind (Finding 2); verified merge outputs |
| DEBT-07 | Bounded-wait `tran-alerts` lock, recompute inside the lock, two-tab tests, mutation-tested, `renter-saved.spec.ts` x10 under CPU pressure | §DEBT-07: `scheduler.ts:34-44,92-95`, `scheduler.test.ts:258-283` flip, Node 24 real `navigator.locks` semantics verified |
| DEBT-08 | Emulator matches the measured Pages dotfile behaviour (re-scoped by D-05) | §DEBT-08: `serve-pages.mjs` serves any existing file with 200 (`:89`), so it likely already matches the live `200` for `/.nojekyll`. The module starts listeners at import, so testing it needs a spawn plus a one-line web-dir env override. |
| DEBT-09 | `/feedback/` + `/for-*/` under 60 KB gz, HARD gate in budget + launch audit | §DEBT-09: per-chunk measurement of the current build, `assert-budget.mjs:16-23`, test flips at `assert-budget.test.ts:155-177,180-183`, `launch-audit.mjs:149-156,167-180,503-526`, `launch-audit.test.ts:566-603` |
</phase_requirements>

## Standard Stack

No dependency is added, removed or re-pinned (UI-SPEC "Registry Safety", D-11, D-15). Versions below were read from `apps/web/package.json` and `node_modules` on 2026-11-05.

### Core (already installed, used by this phase)
| Library | Version | Purpose in Phase 14 | Note |
|---------|---------|---------------------|------|
| tailwind-merge | 3.7.0 | `cn()` merge; `extendTailwindMerge` for the font-size group | `extendTailwindMerge({ extend: { classGroups: { 'font-size': [{ text: ['label','body','heading','display'] }] } } })` verified |
| tailwind-variants | 3.3.1 | `tv()` in badge, button, alert | **Bundles its own merger**; accepts `twMergeConfig` (same shape, flat or `{extend}`); `createTV` exported |
| Web Locks API | browser native / Node 24.18 | `navigator.locks.request('tran-alerts', { signal }, cb)` | `signal` + `ifAvailable` = `NotSupportedError`; abort rejects with `signal.reason` |
| @playwright/test | 1.63.0 | DEBT-01/02/03/05/07/09 E2E | `--repeat-each`, `page.route`, `browser.newContext()` |
| vitest + @vitest/browser-playwright | 4.1.12 | unit (`web`, `scripts`) and `web-browser` projects | root `vitest.config.ts` `projects` list |
| @tailwindcss/vite | 4.3.3 | Needed in `vitest.browser.config.ts` for DEBT-06 computed styles | Already a devDependency. This is a config-only addition, not a new package. |
| fake-indexeddb | 6.2.5 | artifact/backup unit tests | existing `freshIdb()` pattern |
| axe-core / @axe-core/playwright | 4.13.0 | `axeViolations(root)` in browser tests, `AxeBuilder` in E2E | WCAG tags in `testing/axe.ts:4` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `tv(opts, { twMergeConfig })` in each copy-in | `createTV({ twMergeConfig })` in a new `$lib/components/ui/tv.ts` | Both are line-local. **Do not** put a `createTV(...)` call in `$lib/utils.ts`: every `cn()` consumer would then bundle tailwind-variants (13.3 KB gz), and a top-level call is not tree-shaken. |
| CPU throttling via CDP `Emulation.setCPUThrottlingRate` | concurrent `pnpm test:unit` (D-16) | D-16 locks the concurrent-process method. CDP throttling is per-page and does not reproduce the 10-23 scheduler starvation. |
| Fresh `browser.newContext()` for the wipe | `indexedDB.deleteDatabase('tran')` in the same page | The fresh context is the proven pattern (`settings-backup.spec.ts:68`) but loses the `net` fixture's deny-all. See DEBT-05. |

## Architecture Patterns

### Monorepo test layout (verified)
```
vitest.config.ts                 # root: projects = apps/web, packages/core, packages/brand, scripts,
                                 #   apps/web/vitest.browser.config.ts, apps/extension
apps/web/vite.config.ts          # project "web": node env, src/**/*.{test,spec}.ts, excludes *.browser.test.ts
apps/web/vitest.browser.config.ts# project "web-browser": real Chromium, src/**/*.browser.test.ts, plugins: [svelte()] ONLY
apps/web/playwright.config.ts    # testDir tests/e2e; projects root / sub / configured (*.configured.spec.ts only);
                                 #   webServer = node ../../scripts/serve-pages.mjs (needs build dirs)
scripts/vitest.config.ts         # project "scripts": node env, **/*.test.ts, setup ../tooling/vitest/no-network.ts
tooling/vitest/no-network.ts     # replaces globalThis.fetch with a thrower (node:http to loopback still works)
apps/extension/vitest.config.ts  # project "extension": define __TRAN_SITE_URL__ = resolveSiteUrl()
```

### Pattern: Mutation ledger (repo convention)
Mutation tests are not committed. Each SUMMARY carries `## Mutation ledger` with `| # | Mutant | Failing test(s) |`, an "N/N caught" line and a restore check. The test file header cites its ledger (e.g. `saved-search-repo.test.ts:1-3`: "...mutation proof recorded in 04-19-SUMMARY.md").

### Pattern: Pluralized reason strings (Phase 5)
`apps/web/src/lib/ai/ui/panel-controller.ts:31-37`:
```ts
export const WARN_REASON = 'Review the flagged phrases and check the box above to continue.';
export function blockReason(n: number): string {
	return n === 1
		? 'Fix the 1 phrase marked Must fix to copy or email this draft.'
		: `Fix the ${n} phrases marked Must fix to copy or email this draft.`;
}
```

### Pattern: Raw-IndexedDB seeding in E2E
`apps/web/tests/e2e/helpers/data.ts:109-200` (`seedLedger`, `seedSavedSearches`): `page.evaluate` opens `indexedDB.open('tran')` (no version), writes Syncable rows (`id, ownerId:'local', createdAt, updatedAt, schemaVersion:1, ...`) in one transaction, closes, then reloads. Seed from a page that has no DataShell (e.g. the marketing home `''`). The `data-status.spec.ts:27-36` comment explains why: on an (app) page, that page's own check-on-open pass races the seeding.

### Anti-Patterns to Avoid
- **Re-wrapping untouched lines** (D-15). Prettier 3.9.6 with `prettier-plugin-tailwindcss` re-sorts class strings, so the planner must check `git diff --stat` per plan and run `pnpm lint` without `--write` on unrelated files.
- **`fetch` in scripts/web unit tests.** The no-network setup throws. Use `node:http` for loopback (DEBT-08).
- **Importing `scripts/serve-pages.mjs` in a test.** It starts listeners at module top level (`:105-113` and the attacker server at `:129`) and has no `isMain` guard. Spawn it instead.
- **A second read of `TRAN_SITE_URL` in `apps/extension/src/lib/site.ts`.** A second read leaves a bare literal in the bundle, and `pnpm ext:assert` fails (`site-url.test.ts:161-181`, lessons 2026-10-25). DEBT-04 must not touch `site.ts`.

## DEBT-by-DEBT Findings and Edit Surface

### DEBT-01: ListingCard ids

**Current shape** (`apps/web/src/lib/features/renter/search/ListingCard.svelte`):
- `:54` `const addrId = $derived(\`card-${row.id}-addr\`);`
- `:111` `<article aria-labelledby={addrId} ... data-listing-card={row.id}>`
- `:156` `<a id={addrId} {href} ...>`
- No other `id` in the card subtree. `ShortlistToggle`, `ProvenanceChip`, `ListingStatusChip` and `PropertyTypeMark` render no `id=` (grep 2026-11-05). The file has no `<script module>` block yet.

**Mount sites** (all three exist at once on the Map tab, because bits-ui `Tabs.Content` keeps the inactive List panel mounted with `hidden`):
- `ResultsList.svelte:84-94` (List tab; mounted from `ResultsView.svelte:59-61`). Focus after Show more: `:49` `listEl?.querySelector(\`#${CSS.escape(\`card-${row.id}-addr\`)}\`)`.
- `map/SplitList.svelte:85-96` (`MapTab.svelte:110-111`, in `hidden lg:block`). Focus after pin activation: `:49-54`, which finds the `[data-listing-card]` card and then `#card-${id}-addr` inside it.
- `map/SelectedListingPreview.svelte:70` `<ListingCard {row} {provenance} isNew=... selected />` (`MapTab.svelte:146-154`, `contents lg:hidden` unless a spot list). Focus: `:35-37` `'a[data-preview-link], article a[href]'`. This lookup has no id. Keep it, or switch it to the prefixed id.

**Tests to update/extend:**
- `tests/e2e/renter-map-split.spec.ts:71` `toHaveAttribute('id', \`card-${id}-addr\`)` → `split-${id}-addr`; `:183` `card.locator(\`#card-${id}-addr\`)` → `#split-${id}-addr`.
- These stay valid and need no change: `renter-map.spec.ts:131-136` and `renter-journey.spec.ts:90-96` (they use `aria-labelledby`), `renter-results.spec.ts:116-117` (List tab, default prefix), `ResultsView.browser.test.ts:87` (`card-...`), and `results-ui.test.ts:68,80` (SSR, default prefix).
- New: a duplicate-id assertion at 1280×800 and 375×812 on the Map tab with a pin selected, in `renter-map-split.spec.ts` (it already has `selectPin()` at 1280×900; use `test.use` or `setViewportSize` for 1280×800) and in `renter-map.spec.ts` for 375.

**Edit surface**
| Files to modify | Files to read first |
|---|---|
| `ListingCard.svelte` (Props + `:54`; add a `<script module>` exporting `addrIdFor(prefix, id)`), `ResultsList.svelte:49`, `map/SplitList.svelte:53` + pass `idPrefix="split"` at `:86`, `map/SelectedListingPreview.svelte:70` (`idPrefix="preview"`), `tests/e2e/renter-map-split.spec.ts:71,183` (+ new test), `tests/e2e/renter-map.spec.ts` (375 case) | `06-UI-SPEC.md` §ListingCard and §"List <-> map linking"; `06-renter-portal/deferred-items.md:12-21`; `14-UI-SPEC.md` §DEBT-01; `MapTab.svelte:95-155`; `ResultsView.svelte:40-70` |

Duplicate-id collector (Playwright):
```ts
const dupes = await page.evaluate(() => {
	const ids = [...document.querySelectorAll('[id]')].map((e) => e.id);
	return [...new Set(ids.filter((v, i) => ids.indexOf(v) !== i))];
});
expect(dupes).toEqual([]);
```
Run the collector before the fix to confirm it is red. If ids that a `ListingCard` does not own also repeat (Leaflet, a skip link), record them; do not widen the fix.

### DEBT-02: Snapshot save-gate reason

**Current shape** (`apps/web/src/lib/features/studio/snapshot/save-gate.ts`):
```ts
39 export const notesFindingsReason = (n: number): string =>
40 	`Fix the ${n} items marked Must fix in the market notes, and review any others.`;
50 	if (s.notesOn && (s.mustFix > 0 || s.unackedReview)) return notesFindingsReason(s.mustFix);
80 		unackedReview: !panel.canExit && mustFix === 0 && review
```
Only `save-gate.ts` and `save-gate.test.ts` reference `notesFindingsReason` (grep). `SnapshotBuilder.svelte` consumes `saveGateReason` (`:94,202-212`) and the urgent path (`:345-359`). The urgent path only triggers on `block` findings. A warn-only phrase is gated through `gateReason` after `panel?.flushChecks()` (`:336-341`).

**Strings (verbatim from 14-UI-SPEC §DEBT-02):**
- 4a: `Fix the 1 item marked Must fix in the market notes, and review any others.`
- 4b: `Fix the {n} items marked Must fix in the market notes, and review any others.` (n ≥ 2)
- 4c: `Review the flagged phrases in the market notes and check the box in step 3 to continue.`

Recommended line-local change (keeps the `notesFindingsReason` export name):
```ts
export const NOTES_REVIEW_REASON =
	'Review the flagged phrases in the market notes and check the box in step 3 to continue.';

export const notesFindingsReason = (n: number): string =>
	n === 1
		? 'Fix the 1 item marked Must fix in the market notes, and review any others.'
		: `Fix the ${n} items marked Must fix in the market notes, and review any others.`;
// :50 becomes two lines:
	if (s.notesOn && s.mustFix > 0) return notesFindingsReason(s.mustFix);
	if (s.notesOn && s.unackedReview) return NOTES_REVIEW_REASON;
```

**Test flips:**
- `save-gate.test.ts:47-48`: `R.fix` becomes the pluralizing form. Add `R.review`.
- `:60`: `['unacknowledged review only', { unackedReview: true }, R.fix(0)]` → `R.review`.
- Add `['one must-fix', { mustFix: 1 }, 'Fix the 1 item marked ...']`.
- `:86-88` priority test (`mustFix: 1`) expects `R.fix(1)`, which is now the singular string. Update `R` and the test passes.
- `tests/e2e/snapshot-builder.spec.ts:40`: `NOTES_REASON = /Fix the \d+ items marked Must fix in the market notes/` → `/Fix the \d+ items? marked Must fix in the market notes/`. The planted `$9,999` makes exactly one Must fix.
- `:196-200`: delete the "do not lock it in" comment and assert `toHaveText(<4c>)`. After refusal, click **Done editing**, check the box (`notesPanel(page).getByRole('checkbox', { name: "I've reviewed the flagged phrases. They describe the property, not who should live there." })`, the label copied from `FindingsSummary.svelte:86-87`), and assert Save has no `aria-disabled`. Today the spec clears the phrase instead (`:202-204`). Keep that path or replace it, but the acknowledgement path is mandatory.

**Edit surface**
| Files to modify | Files to read first |
|---|---|
| `features/studio/snapshot/save-gate.ts:35-53`, `save-gate.test.ts:43-70`, `tests/e2e/snapshot-builder.spec.ts:40,191-205` | `14-UI-SPEC.md` §DEBT-02; `09-UI-SPEC.md:419,611,232,644`; `SnapshotBuilder.svelte:300-360,525-540`; `ai/ui/FindingsSummary.svelte:75-90`; `ai/ui/panel-controller.ts:25-40` |

### DEBT-03: Memo print with notes-only numerals

**Write site:** `features/investor/memo/MemoPage.svelte`
- `:59` `const facts = $derived(deal ? memoFactsForDeal(deal, overLimit ? '' : notes) : null);`
- `:61` `postChecks = createMemoPostChecks(facts?.allowed ?? [])`. The memo page allows notes numerals.
- `:330` `artifactMeta={{ analysisHash: hash }}` → flows through `GenerationPanel.svelte:130,225-226` and `panel-state.svelte.ts:67,405-416` to `repo.create({... meta })`. `deps.artifactMeta` is read through a getter at create time, so a `$derived` value is current.

**Read site:** `routes/(print)/print/memo/+page.svelte:57-65`
```ts
function isBlocked(artifact: AiArtifact, current: DealRecord): boolean {
	const findings = runChecks(
		artifact.text,
		createMemoPostChecks(memoFactsForDeal(current, '').allowed)   // notes hard-coded ''
	);
```
**Allowed numerals:** `packages/core/src/finance/memo-facts.ts:184-189` (`allowedFromText(notes, 'your notes')`). `allowedFromText` is in `packages/core/src/numbers/check.ts:94-98` and returns `{ value, source }[]`. Matching is unit-agnostic, with tolerance in `matchesAllowed` (`:46-51`). Only `value` matters to the print re-check.

**Store constraints:** `ai/storage/artifacts.ts:96-105` `isMeta` allows ≤16 keys, string values ≤200 chars. `create` validates (`:148`) and `updateMeta` re-validates the merged meta (`:189-199`). Keys already in use: `analysisHash` (memo) and `copied` (`PlatformCard.svelte:124`, Phase 9 social; the memo does not use it but `updateMeta` may add it). Notes are ≤1,000 chars (`MemoPage.svelte:31`).

**Serialization (Claude's discretion, recommended):**
- New pure module `features/investor/memo/memo-meta.ts`:
  - `memoArtifactMeta(analysisHash, notes)` → `{ analysisHash, notesNumbers?: '...', 'notesNumbers.1'?: '...' }`.
  - `notesNumbersFromMeta(meta)` → `number[]`.
- Format: distinct finite values from `allowedFromText(notes)`, each `String(v)` (shortest round-trip repr, so `Number(s)` restores the exact double), joined with a single space. Chunks are ≤200 chars, split on value boundaries, under keys `notesNumbers`, `notesNumbers.1` … `notesNumbers.11`. With `analysisHash` + `copied` that is at most 14 keys.
- If the values overflow 12 chunks, store none. The print then blocks (fail closed), which is today's behaviour. Pin this with a test.
- MemoPage `:330` becomes `artifactMeta={memoArtifactMeta(hash, facts.notes)}`. `facts.notes` is trimmed, and is `''` when over the limit.
- Print `:60` becomes `createMemoPostChecks([...memoFactsForDeal(current, '').allowed, ...notesNumbersFromMeta(artifact.meta)])`. `createMemoPostChecks` accepts `(number | AllowedNumber)[]`.

**Backup:** `aiArtifacts` is registered without a record schema (`ai/storage/tables.ts:45-46`). Export copies rows verbatim (`storage/backup.ts:49` `toArray()`), and import `bulkPut`s them (`:243-248`). `meta` is therefore carried today. Pin it by extending `artifacts.test.ts:392-412` ("backup export then import keeps subjectId") with a memo that carries `notesNumbers`, and assert `restored.get(id).meta` deep-equals the original. The key scan (`findKeyMaterial`) runs over meta values: numerals are not key-shaped, but the test proves that too.

**E2E:** `tests/e2e/investor/print.spec.ts:142-166` is the blocked case (`PLANTED = 'Monthly cash flow is $184. Expect 12% growth next year.'`, which shows "Number check: 1 to fix"). New notes-only case: fill **Your notes for the memo (optional)** with a sentence containing `12%` (e.g. "Comparable rents rose 12% last year."), mock Anthropic with the same `PLANTED`, draft, and expect "Number check passed". Open `print/memo/?id=&memo=` and expect `[data-ready]` and no BLOCKED heading.
Caveat: the print gate also blocks a `warn` finding while `artifact.status === 'draft'` (`:63`). If `checkAdviceLanguage` flags "Expect ... growth" as warn, use a neutral sentence ("Rent growth was 12% last year.") or acknowledge first. Check this against `packages/core/src/finance` advice patterns when writing the spec.

**Edit surface**
| Files to modify | Files to read first |
|---|---|
| new `features/investor/memo/memo-meta.ts` + `memo-meta.test.ts`; `MemoPage.svelte:330` (+1 import line); `routes/(print)/print/memo/+page.svelte:57-61` (+1 import); `ai/storage/artifacts.test.ts` (meta in backup round-trip); `tests/e2e/investor/print.spec.ts` (notes-only case) | `07-HUMAN-UAT.md:63` (S2); `memo-facts.ts:180-190`; `numbers/check.ts`; `artifacts.ts:40-60,96-200`; `panel-state.svelte.ts:400-420`; `print.spec.ts:1-70,142-166`; `memo.spec.ts:182-191` (notes field locator) |

### DEBT-04: Extension/web origin parity

**Current shape:**
- `apps/extension/src/lib/site.ts:11-13`:
  ```ts
  declare const __TRAN_SITE_URL__: string;
  export const TRAN_SITE_URL: string = __TRAN_SITE_URL__;
  export const PRIVACY_URL = `${TRAN_SITE_URL}/legal/privacy/#browser-extension`;
  ```
- The define is set in `apps/extension/wxt.config.ts:36` (`vite: () => ({ define: { __TRAN_SITE_URL__: JSON.stringify(resolveSiteUrl()) } })`), `apps/extension/vitest.config.ts:10` and `vitest.browser.config.ts:23`. The scripts project does **not** define it.
- `apps/web/src/lib/site-config.js:13` `DEFAULT_SITE_ORIGIN = 'https://wolfwdavid.github.io'`; `:21` `resolveSiteOrigin(env)`; `:38` `resolveSiteUrl(env) = origin + resolveBasePath(env)`.
- Anchor: `apps/web/src/routes/(marketing)/legal/privacy/+page.svelte:118` `<h2 id="browser-extension">Sponsored Listing Filter extension</h2>`. `extension-docs.test.ts:147-165` already asserts the h2 text.
- Existing coverage: `scripts/site-url.test.ts:126-182` (group c). It reads `wxt.config.ts`'s define via `cfg.vite(...)` and asserts `site.ts` **source text**. Nothing evaluates `site.ts`, so the current test cannot catch a wrong value at runtime.

**Non-vacuous parity test (new `scripts/origin-parity.test.ts`, the name from research SUMMARY:124):**
```ts
// For each env case (unset; BASE_PATH only; PUBLIC_SITE_URL + BASE_PATH):
vi.stubEnv('PUBLIC_SITE_URL', ...); vi.stubEnv('BASE_PATH', ...);
const { default: config } = await import('../apps/extension/wxt.config.ts');
const define = (config as WxtVite).vite({ mode: 'production', command: 'build' } as never).define;
vi.stubGlobal('__TRAN_SITE_URL__', JSON.parse(define.__TRAN_SITE_URL__)); // what the bundler folds in
vi.resetModules();
const site = await import('../apps/extension/src/lib/site.ts');
expect(site.TRAN_SITE_URL).toBe(resolveSiteUrl());
expect(site.PRIVACY_URL).toBe(`${resolveSiteUrl()}/legal/privacy/#browser-extension`);
// Anchor: read the privacy page source and match /<h2 id="browser-extension">/
```
Also assert that all three defines (wxt, extension vitest, extension browser vitest) are equal: import each config and read `define`. The `wxtDefine()` helper already exists in `site-url.test.ts:126-132`. Copy it rather than export it from a test file.

**Literal URLs to replace (D-06):**
- `scripts/extension-docs.test.ts:29-32` `const PRIVACY_URL = 'https://wolfwdavid.github.io/tran_real_estate/legal/privacy/#browser-extension'` (used at `:89`, `:112`).
  → `const PRIVACY_URL = \`${resolveSiteUrl(LIVE_SITE_ENV)}/legal/privacy/#browser-extension\`` with `LIVE_SITE_ENV = { BASE_PATH: '/tran_real_estate' }`. **Must be explicit, not `process.env`** (Pitfall 5). Keep `RETIRED_HOST`.
- `scripts/assert-extension.test.ts:76, 414` use `${DEFAULT_SITE_ORIGIN}/legal/privacy/#browser-extension`. That is the origin plus the path, which is only correct while `BASE_PATH` is unset. Switch both to `${resolveSiteUrl()}/legal/privacy/#browser-extension`, which matches `URL_ALLOWLIST = urlAllowlist(process.env)` (`:483-485`) in every env. Leave `:187, 398, 445, 458-465, 476, 505` alone: they test the origin and lookalike rules on purpose.
- Update the header comment in `site-url.test.ts:1-2`, which says "Phase 14 item 5.4 ... satisfied", to point at `origin-parity.test.ts`.
- Reword REQUIREMENTS DEBT-04 and ROADMAP criterion 3 in the same commit (D-06).

**Edit surface**
| Files to modify | Files to read first |
|---|---|
| new `scripts/origin-parity.test.ts`; `scripts/extension-docs.test.ts:29-32` (+ import of `resolveSiteUrl`); `scripts/assert-extension.test.ts:76,414`; `scripts/site-url.test.ts:1-2` (comment); `.planning/REQUIREMENTS.md:38`; `.planning/ROADMAP.md:140` | `13-CONTEXT.md` D-04; `13-02-SUMMARY.md:169`; `13-04-SUMMARY.md:118`; `apps/extension/src/lib/site.ts`; `wxt.config.ts:28-38`; `site-config.js`; `site-url.test.ts:120-215`; `tasks/lessons.md` 2026-10-31 (test:unit has no deploy env) |

### DEBT-05: UI-level backup round-trip

**Registered tables** (`storage/backup-registry.ts:41-57`, in order; labels are what `ImportPreview` shows):
| # | Table | Label | Record schema on import |
|---|-------|-------|-------------------------|
| 1 | prefs | Settings | none |
| 2 | ledger | RentCast call history | none (Phase 4 list, `data/tables.ts:96-101`) |
| 3 | savedSearches | Saved searches | none |
| 4 | searchSnapshots | Saved search results | none |
| 5 | dataPrefs | Data settings | none |
| 6 | aiArtifacts | AI drafts | none |
| 7 | renterShortlist | (RENTER_SHORTLIST_LABEL) | none |
| 8 | renterSearchMeta | (RENTER_SEARCH_META_LABEL) | none |
| 9 | deals | Saved deals | `dealRecordSchema` |
| 10 | investorDraft | Deal analyzer draft | schema |
| 11 | buyBoxes | Buy boxes | `looseRecordSchema` |
| 12 | watchedZips | Watched ZIP codes | schema |
| 13 | contacts | Contacts | `contactSchema` |
| 14 | tasks | Tasks | `taskSchema` |
| 15 | activities | Activity | `activitySchema` |
| 16 | agentProfile | Agent profile | schema + `scanExemptPaths` |
| 17 | studioDraft | Studio forms | `studioDraftRowSchema` |
| 18 | snapshots | Market Snapshots | `snapshotRowSchema` + aggregate-only privacy guard |

Excluded: `meta` and `apiCache` (`BACKUP_EXCLUDED_TABLES`). Dexie stores are in `storage/db.ts:38-86` (versions 1-7).

**Settings UI:** "Download backup" button (`BackupExport.svelte:89`); file input `#backup-file` (`BackupImport.svelte:104`); heading "Review this backup"; "Changes if you merge"; preview rows read `getByRole('row', { name: /^Settings/ })` cells `[label, added, updated, unchanged]`; "Import backup" (`ImportPreview.svelte:262`); result `getByTestId('import-result')` reads "Import complete. N added, 0 updated, 0 unchanged." The existing spec shows all of this (`settings-backup.spec.ts:33-111`).

**Network fixture semantics** (`support/network.ts:59-99`): `rentcastCalls(net)` counts only requests a mock answered. Any unmocked external request is aborted, pushed to `net.external`, and fails the test at teardown. A zero-call assertion is non-vacuous only if (a) the page is in live mode and (b) a counting RentCast mock is registered. Do both: `withRentCastKey(page)` + `mockRentCast(page, net, ...)`, then `expect(rentcastCalls(net)).toBe(0)`. Seed `savedSearches` with `lastRunAt` = now so the scheduler finds nothing due.

**Recommended spec shape (`tests/e2e/backup-roundtrip.spec.ts`, name from research SUMMARY):**
1. `test.use(RENTER_TEST_OPTIONS)`. On the fixture `page` (deny-all + net), go to `''` (no DataShell), add the RentCast key, and seed one row per table with a new `tests/e2e/support/seed-all.ts` (raw IndexedDB as in `helpers/data.ts`). Rows are synthetic, but they must pass the zod schemas above. Copy shapes from the unit fixtures (`studio/fixtures/sample-snapshot.ts` `SAMPLE_SNAPSHOT_RECORD`, deal/contact repo tests). The `aiArtifacts` row is a memo with `subjectId` = the seeded deal id and `meta` from DEBT-03.
2. Open Settings, then Download backup. Parse the file and assert: `Object.keys(tables)` equals the 18 names, and **every table has ≥1 live row**. This makes the spec self-maintaining: a newly registered table exports `[]` and turns the test red.
3. Wipe. Option A (keeps `net`): `page.goto('')` and `page.evaluate` to `indexedDB.deleteDatabase('tran')` (Dexie closes on `versionchange`), then clear `localStorage` and `sessionStorage`, then re-add the key. Option B: `browser.newContext()` + `context.route(NON_LOCAL, abort)` + a RentCast counter, as in `settings-backup.spec.ts:68-111`. Prefer A. Assert the wipe with `indexedDB.databases()`, or by opening the DB and seeing zero rows.
4. Import with preview: `setInputFiles`, then for every label assert the row `[label, '1', '0', '0']` (or the seeded count), then Import backup, then the "Import complete." text.
5. Visit each portal and assert the seeded row's visible text:
   - renter: `renter/shortlist/` (shortlist item) and `renter/` (saved search row)
   - investor: `investor/deals/` (deal name), `investor/buy-boxes/`
   - agent: `agent/contacts/` (contact name), `agent/today/` (task), `agent/profile/`
   - studio: `agent/studio/snapshot/` ("Your snapshots" row `[data-snapshot-row]`)
   - AI draft: `investor/memo/?id=<deal>` draft history
   - Optional cross-proof that DEBT-03 meta survived: `print/memo/?id=&memo=` is `[data-ready]`.
6. `expect(rentcastCalls(net)).toBe(0)` at the end (the deny-all teardown also enforces this).

**Edit surface**
| Files to modify | Files to read first |
|---|---|
| new `tests/e2e/backup-roundtrip.spec.ts`; new `tests/e2e/support/seed-all.ts` | `v1.0-MILESTONE-AUDIT.md` ~line 55 (PLAT-04); `backup-registry.ts`; `storage/backup.ts:40-250`; every `*/tables.ts` + `storage/agent/backup.ts` + `storage/studio/tables.ts` (schemas); `settings-backup.spec.ts`; `support/network.ts`; `support/seed.ts`; `helpers/data.ts:100-200`; `data-status.spec.ts:27-36` |

### DEBT-06: tailwind-merge font-size token

**Current shape:**
- `apps/web/src/lib/utils.ts:1-6`: `return twMerge(clsx(inputs));` (plain).
- `badge/badge.svelte:2-17` `tv({ base: '... text-label font-semibold ...', variants: { variant: { neutral: 'bg-surface text-muted-foreground', ... } } })`, rendered `class={cn(badgeVariants({ variant }), className)}` (`:39`).
- `button/button.svelte:2-31` `tv({ base: '... text-body font-semibold ...', variants: { variant: { default: 'bg-primary text-primary-foreground ...' } } })`, `class={cn(buttonVariants({ variant, size }), className)}` (`:57`).
- `alert/alert.svelte:2-15` also uses `tv` (no font-size token in it today; give it the same config for consistency).
- `onboarding/guide-buttons.ts` writes static classes with no tv.
- Tokens: `app.css:37-46` (`--text-label` 0.875rem/1.4, `--text-body` 1rem/1.6, `--text-heading` 1.5rem/1.25, `--text-display` 2.5rem/1.1).

**Verified in Node, from `apps/web` with the installed packages, 2026-11-05:**
```
twMerge('text-label text-muted-foreground')                 -> "text-muted-foreground"   (bug)
extended('text-label text-muted-foreground')                -> "text-label text-muted-foreground"
extended('text-label text-sm')                              -> "text-sm"
extended('leading-[1.6] text-label')                        -> "text-label"   (NEW: font-size now conflicts with an earlier leading-*)
tv plain base text-label + variant text-muted-foreground    -> "font-semibold text-muted-foreground" (bug)
createTV({ twMergeConfig }) same                            -> "text-label font-semibold text-muted-foreground"
tv(opts, { twMergeConfig: flat classGroups }) text-body     -> "text-body text-primary-foreground"
plain tv created after a configured one                     -> still drops (config is per instance, no leak)
```
A grep for a `leading-*` class written before a `text-(label|body|heading|display)` token in `src/**/*.svelte|ts` found nothing, so the new conflict changes no current output. Record the grep in the SUMMARY.

**Recommended implementation (line-local):**
```ts
// apps/web/src/lib/utils.ts
import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/** The --text-* tokens in app.css @theme (a new token joins this list in the same commit). */
export const TW_MERGE_CONFIG = {
	extend: { classGroups: { 'font-size': [{ text: ['label', 'body', 'heading', 'display'] }] } }
};
const twMerge = extendTailwindMerge(TW_MERGE_CONFIG);

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}
```
In badge/button/alert, keep the `tailwind-variants` import line and change the call to `tv({...}, { twMergeConfig: TW_MERGE_CONFIG })`. That is a one-line change at each closing `});`, plus `TW_MERGE_CONFIG` added to the existing `$lib/utils.js` import. In `badge.svelte` the `utils` import is in the instance script, so add a module-script import line. Type: `extendTailwindMerge`'s generic accepts the object literal; if TS complains, annotate with `ConfigExtension<'font-size', never>` from tailwind-merge.

**Browser test (real Chromium):** new `apps/web/src/lib/components/ui/primitives.browser.test.ts`.
- **Config change required:** `apps/web/vitest.browser.config.ts` gets `import tailwindcss from '@tailwindcss/vite'` and `plugins: [tailwindcss(), svelte()]`.
- The test imports `'../../../app.css'`.
- Mount Badge and Button inside a `<div style="font-size:20px">` wrapper (a small test harness `.svelte`, or `render` with a container). Read `getComputedStyle(el).fontSize/lineHeight/fontWeight` and expect 14px/19.6px/600 and 16px/25.6px/600 (UI-SPEC §DEBT-06 rule 3).
- Run `axeViolations(container)` for Badge (3 variants), Button (variants/sizes) and Alert.
- MEDIUM risk: Tailwind v4 source detection under the root `projects` harness (cwd = repo root). If the utilities are missing from the generated CSS, add `@source '../src';` in a test-only CSS file, or `@source inline("text-label text-body ...")` (Tailwind ≥4.1). Verify on the first run; a red computed-size test is the signal.

**Unit test:** new `apps/web/src/lib/utils.test.ts` (node `web` project):
- `cn('text-label text-muted-foreground')` contains both classes.
- `cn('text-label text-sm')` is `'text-sm'`.
- For each of `body|heading|display`, the same colour case.
- `badgeVariants()` / `buttonVariants()` output contains `text-label` / `text-body`. These are importable from the module script in the node project because the `svelte()` plugin compiles `.svelte`; `save-gate.test.ts` already imports from `.svelte` modules.

**Edit surface**
| Files to modify | Files to read first |
|---|---|
| `lib/utils.ts:1-6`; `components/ui/badge/badge.svelte` (module import + `tv` call end); `components/ui/button/button.svelte` (`tv` call end); `components/ui/alert/alert.svelte` (`tv` call end); `vitest.browser.config.ts` (plugin); new `lib/utils.test.ts`; new `components/ui/primitives.browser.test.ts` | `04-*/deferred-items.md:3-12`; `06-renter-portal/deferred-items.md:5-10`; `14-UI-SPEC.md` §Typography Δ14; `app.css:30-50`; `testing/axe.ts`; an existing browser test (e.g. `features/shared/data/NewSinceBadge.browser.test.ts`) for the render pattern |

The workarounds (`FairHousingText.svelte:46`, `dropdown-menu-content.svelte:19-21`, `popover-content.svelte:20-22`, `StageBadge.svelte:2-4`) stay unless the removal is line-local and the computed size stays the same. The recommendation is to leave them (Deferred).

### DEBT-07: Saved-search scheduler lock

**Current shape** (`apps/web/src/lib/data/scheduler.ts`):
```ts
34 /** navigator.locks 'tran-alerts' with ifAvailable (a busy lock skips the pass), else noLock. */
35 export function browserLock(): LockPort {
36 	const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
37 	if (!locks || typeof locks.request !== 'function') return noLock;
38 	return {
39 		run: <T>(fn: () => Promise<T>) =>
40 			locks.request('tran-alerts', { ifAvailable: true }, (lock) =>
41 				lock ? fn() : null
42 			) as Promise<T | null>
43 	};
44 }
92 export async function runDueSearches(deps) {
93 	const result = await (deps.lock ?? noLock).run(() => pass(deps));
94 	return result ?? { ran: [], waiting: [], failed: [], skipped: 'busy', newListings: 0, due: 0 };
```
`pass()` calls `repo.list()` (`:114`) and `dueSearches` (`:128`) inside the lock already, so the "recompute inside the lock" part is satisfied by structure. What is missing is a test that would catch a regression (mutation 2 below). Consumers: `alerts.ts:56` (`deps.lock ?? browserLock()`). `DataShell.svelte:76-81` treats `'busy'` as not waiting, so returning `'busy'` on timeout needs no UI change.

**Verified semantics (Node 24.18 real `navigator.locks`; MDN LockManager.request):**
- `request(name, { signal }, cb)`: if the signal aborts before the lock is granted, the promise rejects with `signal.reason`. That is `TimeoutError` for `AbortSignal.timeout(ms)` and `AbortError` for `controller.abort()`. Aborting after the grant does nothing.
- `{ signal, ifAvailable: true }` throws `NotSupportedError`.
- Detect the timeout with `signal.aborted`, not `e.name`, so it works on either engine.

**Recommended implementation:**
```ts
export const ALERTS_LOCK_WAIT_MS = 10_000;

/** navigator.locks 'tran-alerts', waiting at most `waitMs` (then the pass skips as busy), else noLock. */
export function browserLock(waitMs = ALERTS_LOCK_WAIT_MS): LockPort {
	const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
	if (!locks || typeof locks.request !== 'function') return noLock;
	return {
		run: async <T>(fn: () => Promise<T>) => {
			const signal = AbortSignal.timeout(waitMs);
			try {
				return (await locks.request('tran-alerts', { signal }, () => fn())) as T;
			} catch (e) {
				if (signal.aborted) return null; // waited waitMs: another tab is still checking
				throw e;
			}
		}
	};
}
```
Caveat on `signal.aborted`: if `fn()` itself throws after the timer fired (a pass longer than 10 s that then fails), this treats it as busy. That is acceptable, because the pass's own errors are gateway errors handled inside `pass()`. Alternatively, track `granted` in a closure flag and return `null` only when `!granted`. The flag version is more precise; recommend it.

**Tests (`scheduler.test.ts`):**
- `:272-283` flips: expect `request.mock.calls[0][1]` to have a `signal` that is an `AbortSignal` and **no** `ifAvailable`.
- Timeout: a stub `request` that rejects with `signal.reason` after the abort, with `browserLock(20)` → `run()` returns `null` → `runDueSearches` returns `skipped: 'busy'`.
- **Real two-tab lock proof** (new): two `world()`s over one fake-indexeddb DB (the `twoTabs()` helper at `:235-245`), each `lock: browserLock(5_000)` on the real Node `navigator.locks`, with `Promise.all([a.run(), b.run()])`. Expect exactly 5 fetches, `ran` sums to 5, and the second runner has `skipped === null`, `due === 0` (it waited, then recomputed and found nothing due). This is the test mutation 2 hits.
- Hold-then-release: tab A holds `tran-alerts` for 200 ms via `navigator.locks.request` and B runs with `browserLock(5_000)`: B runs its due searches after A releases (`ran.length === 5`, not `'busy'`). This is the 10-23 race in unit form.
- Keep `:258-265` (an injected busy LockPort still yields `'busy'`).

**Mutation ledger targets:**
1. Put `ifAvailable: true` back → the hold-then-release test fails (busy).
2. Move `repo.list()`/`dueSearches` outside `lock.run` (compute candidates before the lock) → the two-tab proof makes 10 fetches, or the claim catches it. **Check this mutant actually fails.** If `repo.claim` alone keeps the count at 5, the assertion that discriminates is the second runner's `due === 0`.
3. Drop `signal` (unbounded wait) → the timeout test hangs or fails. Give that test a small `testTimeout`.
4. Return `null` on any error, not just a timeout → a test where `fn` throws a non-gateway error must propagate.

**E2E:** `tests/e2e/renter-saved.spec.ts:83-135` uses `page.clock.setFixedTime`, which fakes only `Date`; timers keep running, so `AbortSignal.timeout` is unaffected. The `data-status.spec.ts:27-36` comment describes the old busy behaviour; update it if the wording becomes wrong.

**CPU-pressure proof (D-16):**
- Shell 1 (Git Bash): `MSYS_NO_PATHCONV=1 corepack.cmd pnpm test:unit` (loop it if it finishes first).
- Shell 2: `MSYS_NO_PATHCONV=1 corepack.cmd pnpm --filter web exec playwright test renter-saved.spec.ts --repeat-each 10 --workers 4`.
- Builds `build/` and `build-sub/` must exist first.
- Record the worker count, the core count, any external load, and pass/fail per project in the SUMMARY for Phase 15.

**Edit surface**
| Files to modify | Files to read first |
|---|---|
| `lib/data/scheduler.ts:34-44` (+ const); `lib/data/scheduler.test.ts:234-283`; possibly `tests/e2e/data-status.spec.ts:27-31` (comment only) | `10-23-SUMMARY.md:50,179-183,226`; `scheduler.ts` whole; `alerts.ts:20-60`; `saved-search-repo.ts` (`claim`); `DataShell.svelte:70-180`; `renter-saved.spec.ts:83-140`; MDN LockManager.request |

### DEBT-08: Emulator dotfile parity (re-scoped, D-05)

**Current shape** (`scripts/serve-pages.mjs:50-95`): the prefix check (`:66`), decode (`:69`), traversal guard (`:74`), `statSync` miss → 404 with `404.html` (`:76-80`), directory without slash → 301 (`:81-85`), directory with slash → `index.html` or 404 (`:86-87`), any existing file → **200** (`:89`). There is no dotfile special case. So `/.nojekyll` already answers 200, as the live origin did (`13-13-SUMMARY.md:152`); a missing dotfile → 404; a missing dot-directory → 404.

**Live probe (first task; use few requests because the Pages CDN rate-limits with 429, see lessons 2026-10-31):**
```
curl -sI https://wolfwdavid.github.io/tran_real_estate/.nojekyll | head -1          # existing dotfile (expect 200)
curl -sI https://wolfwdavid.github.io/tran_real_estate/.well-known/ | head -1       # dot-directory path (none shipped; expect 404)
curl -sI https://wolfwdavid.github.io/tran_real_estate/.no-such-dotfile | head -1   # missing dotfile (expect 404)
```
The build ships no dot-directory (`apps/web/build` has only `.nojekyll` at the top level), so "existing dot-directory" cannot be measured. Record it as not measurable. Also probe the redirect form `/tran_real_estate/.well-known` (no slash) if the SUMMARY should cover the 301 rule.

**Test approach (scripts project; new `scripts/serve-pages.test.ts`):**
- The module has top-level side effects. Do not import it. Spawn `node scripts/serve-pages.mjs` with env ports from a free-port probe (`net.createServer().listen(0)`), `SERVE_PAGES_EXIT_ON_STDIN_END=1`, and a fixture web dir.
- **One-line product change needed:** `:36` `const web = path.resolve(import.meta.dirname, '../apps/web');` → `const web = path.resolve(process.env.SERVE_PAGES_WEB_DIR ?? path.join(import.meta.dirname, '../apps/web'));`.
- The fixture dir has `build/index.html`, `build/404.html`, `build/.nojekyll`, `build/sub/index.html`. Wait for the `serve-pages:` log line, request with `node:http` (`fetch` is blocked), assert each measured status, then end stdin and await exit.
- Add a mutation note: making `:89` 404 on dotfiles turns the `.nojekyll` 200 case red.
- Reword REQUIREMENTS DEBT-08 (`:41`) and ROADMAP criterion 5 in the same commit (D-05).
- Related, unchanged: `svelte.config.js:26-28` precache filter, `service-worker-guard.test.ts:66-75`, `pwa.spec.ts:40-58`.

**Edit surface**
| Files to modify | Files to read first |
|---|---|
| `scripts/serve-pages.mjs:36` (env override; plus any line the probe proves wrong); new `scripts/serve-pages.test.ts`; `.planning/REQUIREMENTS.md:41`; `.planning/ROADMAP.md:141` | `13-13-SUMMARY.md:140-160`; `13-19-SUMMARY.md:90-100`; `research/ARCHITECTURE.md:13,324`; `serve-pages.mjs` whole (incl. stdin exit `:150-165`); `playwright.config.ts:35-50`; `smoke.mjs:249-308`; `smoke.test.ts:1-5` |

### DEBT-09: Marketing-page JS budget

**Current gate:** `scripts/assert-budget.mjs:16-23`:
```js
export const HARD = [/^tools\/index\.html$/, /^tools\/[^/]+\/index\.html$/];
export const REPORT = [/^index\.html$/, /^for-[^/]+\/index\.html$/, /^legal\/[^/]+\/index\.html$/, /^feedback\/index\.html$/];
```
Change: add `/^for-[^/]+\/index\.html$/` and `/^feedback\/index\.html$/` to `HARD`, and remove them from `REPORT`. Update the header comment at `:9-10`.

**Test flips (`scripts/assert-budget.test.ts`):** the `golden()` fixture (`:69-82`) contains `for-renters/index.html`. With it in HARD:
- `:155-168` "a landing page over 60 KB is a REPORT row": `for-renters` becomes FAIL, so assert FAIL plus an error naming it (or drop it from that test and add a dedicated HARD case for `for-renters` and `feedback`).
- `:180-183` "a custom limit is honoured" (`limit: 100`): errors become 3, not 2.
- `:170-178` still lists the same routes.

**Launch audit (`scripts/launch-audit.mjs`):**
- `PERF_ROUTES` (`:149-156`): add `feedback/index.html` and `for-{agents,investors,renters}/index.html` so the Performance table shows them with PASS/FAIL.
- `REPORT_ONLY_NOTES` (`:167-180`): the feedback and for-* entries become dead. Remove them, or keep one generic note.
- `oversizeReportRows` (`:503-526`) is unchanged.
- `launch-audit.test.ts:566-603` uses a `for-renters` REPORT fixture row. Switch the fixture to `index.html` or `legal/terms/index.html` so the oversize-report path stays tested.
- Regenerate `docs/LAUNCH-AUDIT.md` and `docs/audit/budget.txt` under the deploy-env rule (lessons 2026-10-31: deploy env for builds/E2E/`audit:launch`, none for Vitest).

**Measured chunk breakdown** (`apps/web/build`, built 2026-10-31; route JS minus the `legal/privacy` set; gzip -9 per chunk):
| Chunk (current hash) | gz B | What | /feedback/ | /for-*/ |
|---|---|---|---|---|
| `mrE-XOnH.js` | 13,302 | tailwind-variants (bundled merger) | yes | yes |
| `p8sXwDPs.js` | 9,639 | zod | yes | yes |
| `BxT_HGH0.js` | 8,803 | tailwind-merge | yes | yes |
| `Cwwh5bE5.js` | 6,067 | AudiencePage + WaitlistForm + **all three audiences' content** | - | yes |
| `nodes/35.*.js` | 3,801 | feedback page node (FeedbackForm) | yes | - |
| `D-5SFz16.js` | 3,202 | bits-ui / svelte-toolbelt internals | yes | - |
| `CRhj4TLX.js` | 2,585 | `FORMS_COPY` (waitlist **and** feedback copy) | yes | yes |
| `Duc-UGqP.js` | 2,413 | bits-ui radio-group | yes | - |
| `meUWdjjd.js` + `BzAcmiJl.js` | 1,721 + 996 | web3forms sink | yes | yes |
| `BzpPv62d.js`, `TyKAVQs9.js`, `Dc_3k25j.js` | 1,433 / 1,420 / 1,146 | bits-ui/runed helpers, `SvelteSet` | yes | - |
| `B4kuKzRO.js` (+ `Dyf5gJ25.js` 676) | 1,038 | `lead-block` (imports zod chunk) | yes | yes |

Totals: `/feedback/` 105,327 B, `/for-renters/` 99,156 B, budget 61,440 B. Removing tv + twm + zod + bits-ui + sink + lead-block takes roughly 43-46 KB off `/feedback/` (to about 59-62 KB) and 35-37 KB off `/for-*/` (to about 62-64 KB). **The `/for-*/` pages are likely still 1-3 KB over after the UI-SPEC trim.** Ranked extra levers that stay inside the UI-SPEC (no lazy rendering of the form):
1. Split `$lib/content/audiences.ts` (`export const audiences: Record<PortalId, Audience>` at `:43`) so each `/for-*/` page imports only its own audience (e.g. also export `renterAudience` etc. and keep `audiences` for other consumers). Rollup cannot tree-shake object properties.
2. Split `FORMS_COPY` into per-form exports so WaitlistForm does not ship the feedback copy.
3. Lazy-load `FormError`'s markup dependencies only if `SectionError` pulls `tv` (Alert). It does (`FormError.svelte:6` → `SectionError` → `Alert`), so a static error block is already required by the UI-SPEC.

Measure after each step with `node scripts/assert-budget.mjs apps/web/build` (and `build-configured`). Chunk hashes change on rebuild, so measure; do not predict from this table.

**Form code facts:**
- `FeedbackForm.svelte:14-20` imports `findKeyMaterial` from `@tran/core/backup`. Its barrel (`packages/core/src/backup/index.ts`) re-exports `envelope`/`migrations`, which pull zod. `@tran/core`'s exports map has no deep path for `backup/key-scan`, so the UI-SPEC's dynamic `import('@tran/core/backup')` on submit is the right lever.
- `:16` Button, `:17` RadioGroup, `:18` Textarea, `:20` `submitOwnerForm`.
- `:89-90` `focusTopic()` uses `[data-state="checked"]` and must become `input[name="feedback-topic"]:checked` (UI-SPEC).
- `WaitlistForm.svelte:13-15` imports Button, `FORMS_COPY` and `submitOwnerForm`.
- `feedback.configured.spec.ts:76-106,214-220` uses `getByRole('radio')` and `toBeChecked()`, which stay valid for native radios. Both form specs are `*.configured.spec.ts` (configured project only) plus `feedback.spec.ts`/`waitlist.spec.ts` for the coming-soon state.
- `scripts/ui-class-guard.mjs` (`pnpm ui:guard`) checks class strings repo-wide. Run it on the new static strings.

**Recommended tests:**
- `form-classes.test.ts` (UI-SPEC: each string contains `text-body`, `font-semibold`, `h-12`, `min-w-11`, focus-visible ring). Also assert parity with `buttonVariants({})` output token-for-token: import `buttonVariants` in the node test and compare class sets, so the static copy cannot drift from the Button.
- Fail-closed lazy import E2E (configured project): after load, `page.route('**/_app/immutable/**', r => r.abort())` (only chunks requested after this point fail). Submit, then assert the "Your message wasn't sent" error, zero requests to `api.web3forms.com`, and focus on the submit button.
- Budget: the existing HARD path covers the gate (FAIL on oversize). The mutation to record is restoring a static `Button` import in `WaitlistForm`, which turns `pnpm budget:assert` red.

**Edit surface**
| Files to modify | Files to read first |
|---|---|
| `components/forms/FeedbackForm.svelte` (imports, radio block `:203-217`, textarea, buttons, `focusTopic`, submit path); `components/forms/WaitlistForm.svelte` (imports, button, submit path); `components/forms/FormError.svelte` (static alert markup); new `components/forms/form-classes.ts` + test; possibly `content/audiences.ts` / route `+page.svelte` (lever 1); `scripts/assert-budget.mjs:9-23`; `scripts/assert-budget.test.ts:155-183`; `scripts/launch-audit.mjs:149-180`; `scripts/launch-audit.test.ts:566-603`; `tests/e2e/feedback.configured.spec.ts`, `waitlist.configured.spec.ts`; regenerated `docs/LAUNCH-AUDIT.md`, `docs/audit/budget.txt` | `10-HUMAN-UAT.md:45-47`; `docs/LAUNCH-AUDIT.md:158-197`; `docs/audit/budget.txt`; `14-UI-SPEC.md` §DEBT-09; `10-UI-SPEC.md` §WaitlistForm/§FeedbackForm; `components/tools/CalculatorShell.svelte:42-43`; `components/ui/ButtonLink.svelte`; `onboarding/guide-buttons.ts`; `features/shared/settings/SectionError.svelte`; `components/ui/alert/alert.svelte`; `leads/owner-forms.ts`, `web3forms-sink.ts` |

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Class conflict resolution | A regex filter that keeps `text-label` | `extendTailwindMerge` + `tv(..., { twMergeConfig })` | The merger's class map already handles modifiers, arbitrary values and conflict groups. Verified outputs above. |
| Cross-tab mutual exclusion with a timeout | `localStorage` heartbeats or a `BroadcastChannel` election | `navigator.locks.request(name, { signal: AbortSignal.timeout(ms) }, cb)` | Auto-release on tab close or crash; native; available in Node 24 for unit proofs |
| Number extraction for notes | A new numeral regex | `allowedFromText` / `extractNumerals` (`@tran/core/numbers`) | The same tokenizer and tolerance as the gate; anything else drifts |
| Backup file building in E2E | Hand-written envelope JSON for 18 tables | Seed IndexedDB, then the real **Download backup** | The point of DEBT-05 is the UI path; `makeBackup` only covers `prefs` |
| Gzip budget measurement | Ad-hoc `du`/`gzip` | `checkBudget()` / `initialJs()` in `scripts/assert-budget.mjs` | It is the gate that CI and the launch audit read |
| Site URL composition | String concatenation in tests | `resolveSiteUrl(env)` | The only helper the web define, the extension define and the oracle share (13 D-04) |

## Common Pitfalls

### Pitfall 1: Fixing only `cn()` (DEBT-06)
**What goes wrong:** the Badge still renders without `text-label`, because `badgeVariants()` drops it before `cn()` sees it.
**Why:** tailwind-variants 3.3.1 merges with its own bundled merger, which ignores `extendTailwindMerge`.
**How to avoid:** pass `twMergeConfig` to every `tv()`, and unit-test `badgeVariants()` output directly.
**Warning signs:** the `cn` unit test is green but the Badge computed size is 20px (inherited).

### Pitfall 2: Computed-style test passes or fails for the wrong reason (DEBT-06)
**What goes wrong:** the `web-browser` project has no Tailwind plugin, so no utility CSS exists and every element inherits its size.
**How to avoid:** add `tailwindcss()` to `vitest.browser.config.ts`, import `app.css`, and use a 20px wrapper (UI-SPEC rule 3). Add a sanity assertion that some utility (e.g. `font-semibold` → 600) applies before asserting sizes.

### Pitfall 3: The DEBT-09 trim lands but the HARD gate is red
**What goes wrong:** `/for-*/` stays at about 62-64 KB after the spec trim.
**How to avoid:** order the plan as measure → trim → measure → audiences/FORMS_COPY split → measure. Budget the time for lever 1. Never raise `BUDGET_BYTES`.

### Pitfall 4: The ledger oracle rejects "superseded" (close-out)
**What goes wrong:** `human-uat-ledger.test.ts:140` reports `L66: bad result "superseded by DEBT-03"`.
**How to avoid:** write `decided (superseded by DEBT-03, 2026-11-xx)`. Also fix the L66 text "Phase 14 DEBT-02" → DEBT-03 (D-07).

### Pitfall 5: Env-dependent literal in the docs test (DEBT-04)
**What goes wrong:** `resolveSiteUrl()` with no `BASE_PATH` (CI `test:unit`) yields `https://wolfwdavid.github.io/legal/privacy/#browser-extension`, which the docs do not contain, so CI goes red. A dev shell with the deploy env goes green. That is the inverse of lessons 2026-10-31.
**How to avoid:** the doc tests use `resolveSiteUrl({ BASE_PATH: '/tran_real_estate' })`. The bundle tests (`assert-extension.test.ts`) use `resolveSiteUrl()`, matching `URL_ALLOWLIST`.

### Pitfall 6: `site.ts` cannot load in the scripts project (DEBT-04)
**What goes wrong:** importing `apps/extension/src/lib/site.ts` throws `ReferenceError: __TRAN_SITE_URL__ is not defined`.
**How to avoid:** call `vi.stubGlobal('__TRAN_SITE_URL__', value)` and `vi.resetModules()` before each dynamic import. Do not add a `define` to `scripts/vitest.config.ts`: it would freeze the env at config load.

### Pitfall 7: A vacuous "0 RentCast calls" (DEBT-05)
**What goes wrong:** in sample mode (no key) nothing could call RentCast, so `0` proves nothing.
**How to avoid:** live key + counting mock + `savedSearches.lastRunAt = now`. Also assert `net.external` stays empty (the fixture does this at teardown).

### Pitfall 8: Seeded rows rejected by import schemas (DEBT-05)
**What goes wrong:** the preview rejects the whole file ("a failing row") because a hand-seeded deal or contact misses a field.
**How to avoid:** build each seed row from an existing unit fixture or repo `create()` output shape. The spec fails loudly at the preview step, so read the error text.

### Pitfall 9: Lock timeout detected by error name (DEBT-07)
**What goes wrong:** `catch (e) { if (e.name === 'AbortError') ... }` misses `TimeoutError`, which is what `AbortSignal.timeout` produces (verified in Node 24.18).
**How to avoid:** check `signal.aborted` or a `granted` flag.

### Pitfall 10: The DueSearchesDialog holds the lock (DEBT-07)
**What goes wrong:** a tab showing the "more than 3 due" confirm holds `tran-alerts` while it waits, so a second tab now waits 10 s and then skips as busy, where before it skipped instantly. This is expected, but specs that open two (app) pages back to back may get about 10 s slower.
**How to avoid:** keep the seeding-from-home pattern (`data-status.spec.ts:27-36`) and watch spec durations in the `--repeat-each` run.

### Pitfall 11: Importing `serve-pages.mjs` from a test (DEBT-08)
**What goes wrong:** the import binds ports 4273-4276 and the attacker server, and collides with a running Playwright webServer.
**How to avoid:** spawn it with free ports and a fixture web dir.

### Pitfall 12: Prettier class re-sort widens the diff (all UI items)
**What goes wrong:** editing one class string with the tailwind Prettier plugin re-orders it; editing a `tv()` call can re-wrap neighbouring lines.
**How to avoid:** after each edit run `corepack.cmd pnpm exec prettier --check <file>`. If Prettier insists on a re-wrap, accept only lines inside the edited statement, and record it per D-15.

### Pitfall 13: Commit hygiene
`commit-msg` runs `scripts/commit-hygiene.mjs`, and the pre-commit runs gitleaks + guard-real-data. Commit messages must not mention AI assistants. Lessons 2026-10-25: no `Co-Authored-By` model trailer. Never write `NAME_KEY=value` in SUMMARY/docs. Use the convention seen in the log: `fix(14-0N): ...`, `test(14-0N): ...`, `docs(14-0N): ...`.

## Code Examples

### Bounded lock request (DEBT-07)
```ts
// Source: MDN LockManager.request (signal option) + Node 24.18 probe 2026-11-05
let granted = false;
const signal = AbortSignal.timeout(waitMs);
try {
	return await navigator.locks.request('tran-alerts', { signal }, async () => {
		granted = true;
		return fn();
	});
} catch (e) {
	if (!granted && signal.aborted) return null; // timed out waiting: skip as 'busy'
	throw e;
}
```

### tv with the shared merge config (DEBT-06)
```ts
// Source: node_modules/tailwind-variants/dist/index.d.ts (tv, createTV, TWMConfig.twMergeConfig)
import { type VariantProps, tv } from 'tailwind-variants';
import { TW_MERGE_CONFIG, cn, type WithElementRef } from '$lib/utils.js';
export const buttonVariants = tv({ /* unchanged */ }, { twMergeConfig: TW_MERGE_CONFIG });
```

### Origin parity with the real module (DEBT-04)
```ts
vi.stubGlobal('__TRAN_SITE_URL__', resolveSiteUrl());
vi.resetModules();
const { TRAN_SITE_URL, PRIVACY_URL } = await import('../apps/extension/src/lib/site.ts');
expect(TRAN_SITE_URL).toBe(resolveSiteUrl());
expect(PRIVACY_URL).toBe(`${resolveSiteUrl()}/legal/privacy/#browser-extension`);
```
(Combine with the WXT define read, so the value under test is what the bundler injects. Repeat for env cases: unset, `BASE_PATH` only, `PUBLIC_SITE_URL` + `BASE_PATH`.)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `navigator.locks.request(..., { ifAvailable: true })` skip | `{ signal: AbortSignal.timeout(ms) }` bounded wait | Web Locks `signal` option is baseline in Chromium; Node 24 ships the API | Fixes the 10-23 reload race without unbounded waits |
| tailwind-variants 0.x/1.x calling the `tailwind-merge` package | tailwind-variants 3.x with its own internal merger; `twMergeConfig` per instance | 3.x | `extendTailwindMerge` alone no longer covers `tv()` |
| `TRAN_ORIGIN` constant | `TRAN_SITE_URL` (origin + base) only | 13-10 | DEBT-04 text corrected per D-06 |

## Open Questions

1. **Does Tailwind v4 auto source detection work in the `web-browser` project under the root `projects` harness?**
   - What we know: `vite.config.ts:12-16` notes that Kit's plugin pins root to cwd. The browser config uses plain `svelte()`. Vitest's `css` option does not apply to browser mode.
   - What's unclear: whether `@tailwindcss/vite` finds `src/**` from cwd = repo root.
   - Recommendation: first task of DEBT-06 adds the plugin and a sanity assertion. If utilities are missing, add an explicit `@source` in a test-only CSS file.
2. **Is `/for-*/` under 61,440 B after the UI-SPEC trim?**
   - What we know: the per-chunk estimate is about 62-64 KB.
   - Recommendation: lever 1 (per-audience content) is pre-approved by the "Which validation stays inline vs lazy" discretion only if read broadly. It changes no UI. If it is not enough, stop and record per D-15 rather than lazy-render the form (UI-SPEC rule 5 forbids that).
3. **Does mutation 2 of DEBT-07 (list outside the lock) get caught?**
   - What we know: `repo.claim` already prevents double fetches across tabs (`saved-search-repo.test.ts:1-3`).
   - Recommendation: assert the second runner's `due === 0` (it recomputed after waiting). That assertion fails when candidates are computed before the lock.
4. **Advice-language false positive in the DEBT-03 notes-only E2E?**
   - Recommendation: use a neutral memo sentence. Confirm with `checkAdviceLanguage` in a quick unit check while writing the spec.

## Validation Architecture

`workflow.nyquist_validation` is `true` in `.planning/config.json`.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.12 (projects `web`, `web-browser`, `scripts`, `packages/core`, `extension`); Playwright 1.63.0 (projects `root`, `sub`, `configured`) |
| Config files | `vitest.config.ts` (root), `apps/web/vite.config.ts`, `apps/web/vitest.browser.config.ts`, `scripts/vitest.config.ts`, `apps/web/playwright.config.ts` |
| Quick run (one file) | `MSYS_NO_PATHCONV=1 corepack.cmd pnpm exec vitest run --project <web\|web-browser\|scripts> <path>` |
| E2E (one spec) | `MSYS_NO_PATHCONV=1 corepack.cmd pnpm --filter web exec playwright test <spec> [--project root]` (needs `pnpm build:root` / `build:sub` / `build:configured` first) |
| Full suite | `corepack.cmd pnpm verify` (local gate); `ci.yml` (remote verifier) |

### Phase Requirements → Test Map
| Req | Behavior | Type | Test file (add/extend) | Automated command | Mutation that must turn it red |
|-----|----------|------|------------------------|-------------------|-------------------------------|
| DEBT-01 | No duplicate ids on Map tab at 1280 and 375 with a pin selected; focus lands on the prefixed link | Playwright | extend `tests/e2e/renter-map-split.spec.ts` (+ `renter-map.spec.ts` 375 case) | `... playwright test renter-map-split.spec.ts renter-map.spec.ts` | Pass the same `idPrefix` to split and preview (or drop it in SplitList) → duplicate-id assertion fails. Revert the `SplitList` lookup to `card-` → focus assertion fails. |
| DEBT-01 | Show more focus unchanged (default prefix) | browser + Playwright | existing `ResultsView.browser.test.ts:76-95`, `renter-results.spec.ts:99-117` | `vitest run --project web-browser apps/web/src/lib/features/renter/search/ResultsView.browser.test.ts` | Change the default prefix → `card-…` expectation fails |
| DEBT-02 | 0/1/2+ reason strings; priority order | unit | `apps/web/src/lib/features/studio/snapshot/save-gate.test.ts` | `vitest run --project web apps/web/src/lib/features/studio/snapshot/save-gate.test.ts` | (a) return the must-fix string for review-only → review case fails; (b) drop the singular branch → singular case fails |
| DEBT-02 | Warn-only draft shows the 4c text, Save refused, ack enables | Playwright | `tests/e2e/snapshot-builder.spec.ts:191-205` | `... playwright test snapshot-builder.spec.ts` | Revert 4c → `toHaveText` fails |
| DEBT-03 | Meta builder/reader round-trip, chunking, overflow fails closed | unit | new `apps/web/src/lib/features/investor/memo/memo-meta.test.ts` | `vitest run --project web apps/web/src/lib/features/investor/memo/memo-meta.test.ts` | `memoArtifactMeta` returns only `analysisHash` → round-trip fails |
| DEBT-03 | Repo + backup carry `meta` | unit | extend `apps/web/src/lib/ai/storage/artifacts.test.ts:392-432` | `vitest run --project web apps/web/src/lib/ai/storage/artifacts.test.ts` | Strip `meta` in `create` (`:166`) → fails |
| DEBT-03 | Notes-only memo prints; Must-fix memo still blocked | Playwright | extend `tests/e2e/investor/print.spec.ts` | `... playwright test investor/print.spec.ts` | Drop the meta write in `MemoPage.svelte:330` (or the print read at `:60`) → the notes-only case shows BLOCKED |
| DEBT-04 | `TRAN_SITE_URL`/`PRIVACY_URL` from the real module equal `resolveSiteUrl()` across 3 env cases; defines agree; anchor exists | unit (scripts) | new `scripts/origin-parity.test.ts`; extend `extension-docs.test.ts`, `assert-extension.test.ts` | `vitest run --project scripts scripts/origin-parity.test.ts scripts/extension-docs.test.ts scripts/assert-extension.test.ts` | (a) `wxt.config.ts` define → `resolveSiteOrigin()` → BASE_PATH case fails; (b) `site.ts` path typo → PRIVACY_URL fails; (c) rename the privacy h2 id → anchor check fails |
| DEBT-05 | Seed 18 tables → UI export (every table ≥1) → wipe → preview (18 rows) → import → portals show rows → 0 RentCast | Playwright | new `tests/e2e/backup-roundtrip.spec.ts` + `support/seed-all.ts` | `... playwright test backup-roundtrip.spec.ts` | Register a new table without seeding (or remove one table from the seed) → the "every table ≥1" check fails. Skip the import → the portal assertions fail. |
| DEBT-06 | `cn`/`badgeVariants`/`buttonVariants` keep tokens | unit | new `apps/web/src/lib/utils.test.ts` | `vitest run --project web apps/web/src/lib/utils.test.ts` | Remove the `font-size` group from `TW_MERGE_CONFIG` → fails; drop `twMergeConfig` from badge `tv` → the badgeVariants case fails |
| DEBT-06 | Badge 14px/19.6px/600, Button 16px/25.6px/600 in Chromium; axe clean on primitives | browser | new `apps/web/src/lib/components/ui/primitives.browser.test.ts` (+ Tailwind plugin in `vitest.browser.config.ts`) | `vitest run --project web-browser apps/web/src/lib/components/ui/primitives.browser.test.ts` | Same as above → Badge font-size reads 20px |
| DEBT-07 | Bounded wait options; timeout → busy; real two-tab lock: 5 fetches, second runner `due === 0`; hold-then-release runs | unit | `apps/web/src/lib/data/scheduler.test.ts:234-283` | `vitest run --project web apps/web/src/lib/data/scheduler.test.ts` | (1) `ifAvailable` back → hold-then-release fails; (2) list before the lock → `due === 0` fails; (3) catch-all `return null` → error-propagation test fails |
| DEBT-07 | `renter-saved.spec.ts` x10 under CPU pressure | Playwright (manual load) | existing `tests/e2e/renter-saved.spec.ts` | `... playwright test renter-saved.spec.ts --repeat-each 10 --workers 4` while `corepack.cmd pnpm test:unit` runs | Restore `ifAvailable` + hold the lock 3 s in a probe → a run fails (10-23 repro) |
| DEBT-08 | Emulator status per measured case (`/.nojekyll` 200, missing dotfile 404, missing dot-dir 404, dir 301) | script (spawn) | new `scripts/serve-pages.test.ts` | `vitest run --project scripts scripts/serve-pages.test.ts` | 404 dotfiles at `serve-pages.mjs:89` → the `.nojekyll` 200 case fails |
| DEBT-09 | feedback + for-* in HARD; oversize FAIL; audit rows | unit (scripts) | `scripts/assert-budget.test.ts`, `scripts/launch-audit.test.ts` | `vitest run --project scripts scripts/assert-budget.test.ts scripts/launch-audit.test.ts` | Move `for-*` back to REPORT → the new HARD test fails |
| DEBT-09 | Real build under budget | script | `pnpm budget:assert` | `corepack.cmd pnpm build:root && corepack.cmd pnpm build:configured && corepack.cmd pnpm budget:assert` | Static `Button` import in `WaitlistForm` → `/for-*/` FAIL |
| DEBT-09 | Static class parity, native radios, lazy import fail-closed, axe | unit + Playwright | new `components/forms/form-classes.test.ts`; `feedback.configured.spec.ts`, `waitlist.configured.spec.ts` | `vitest run --project web apps/web/src/lib/components/forms/form-classes.test.ts`; `... playwright test --project configured feedback waitlist` | Drop `focus-visible:outline-ring` from the static string → parity test fails; send before the key scan resolves → the fail-closed spec sees a web3forms request |

### Sampling Rate
- **Per task commit:** the single-file Vitest command(s) above for the touched item (< 30 s each), and `prettier --check` on touched files.
- **Per wave merge:** `corepack.cmd pnpm test:unit` + the item's Playwright specs on root and sub.
- **Phase gate:** `corepack.cmd pnpm verify` green locally, then CI green on GitHub (the verifier per CONTEXT), before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `apps/web/vitest.browser.config.ts`: add `@tailwindcss/vite` (DEBT-06 prerequisite; verify the utilities generate)
- [ ] `apps/web/src/lib/utils.test.ts`: new (DEBT-06)
- [ ] `apps/web/src/lib/components/ui/primitives.browser.test.ts`: new (DEBT-06)
- [ ] `apps/web/src/lib/features/investor/memo/memo-meta.test.ts`: new (DEBT-03)
- [ ] `scripts/origin-parity.test.ts`: new (DEBT-04)
- [ ] `scripts/serve-pages.test.ts` + `SERVE_PAGES_WEB_DIR` override: new (DEBT-08)
- [ ] `apps/web/tests/e2e/backup-roundtrip.spec.ts` + `tests/e2e/support/seed-all.ts`: new (DEBT-05)
- [ ] `apps/web/src/lib/components/forms/form-classes.test.ts`: new (DEBT-09)
- Existing files are extended for DEBT-01, 02, 07 (no new infrastructure).

## Runtime State Inventory

This phase does not rename anything. The one string-moving change is DEBT-01's id prefix, which is not persisted anywhere.
| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | DEBT-03 adds new `meta` keys to new `aiArtifacts` rows only. Old memos have no `notesNumbers` and keep today's fail-closed print. No Dexie version bump (`meta` is not indexed). | None (no migration). Document that old memos keep blocking a notes-only number until redrafted. |
| Live service config | GitHub Pages origin: DEBT-08 probes it read-only. | None |
| OS-registered state | None. Verified: the phase touches no scheduler, service or hook registration. | None |
| Secrets/env vars | `PUBLIC_SITE_URL`, `BASE_PATH` read by DEBT-04 tests (no new names); new test-only `SERVE_PAGES_WEB_DIR` (DEBT-08) | None. Never write `NAME_KEY=value` in docs. |
| Build artifacts | `docs/LAUNCH-AUDIT.md`, `docs/audit/budget.txt` must be regenerated after DEBT-09. The service-worker cache key changes on deploy as usual. | Regenerate under the deploy-env rule |

## Sources

### Primary (HIGH confidence)
- Repository source read 2026-11-05: every file and line cited above.
- Node probes run 2026-11-05 in `apps/web` with installed `tailwind-merge@3.7.0` / `tailwind-variants@3.3.1`: merge outputs and per-instance config.
- Node 24.18.0 probe: `navigator.locks` exists; the `signal` timeout rejects with `TimeoutError === signal.reason`; `signal` + `ifAvailable` throws `NotSupportedError`.
- `node_modules/tailwind-variants/dist/index.js:3060-3125` (bundled `createTwMerge`, `toMergerConfig` accepting flat or `{extend}`), `index.d.ts` (`tv`, `createTV`, `twMergeConfig`).
- Per-chunk gzip measurement of `apps/web/build` (built 2026-10-31) against `docs/audit/budget.txt`.
- [MDN LockManager.request](https://developer.mozilla.org/en-US/docs/Web/API/LockManager/request): `signal` semantics, `NotSupportedError` combinations.
- [Vitest config: css](https://vitest.dev/config/css): "This option is not applied to browser tests."

### Secondary (MEDIUM confidence)
- Post-trim size estimates for DEBT-09 (arithmetic over current chunks; chunking changes on rebuild).
- Tailwind v4 source detection in the `web-browser` project (not run).

### Tertiary (LOW confidence)
- None used for a recommendation.

## Metadata

**Confidence breakdown:**
- Edit surfaces and test flips: HIGH. Every line was read.
- DEBT-06 mechanism: HIGH (verified by execution). The browser-test CSS setup is MEDIUM (not executed).
- DEBT-07 semantics: HIGH (Node probe + MDN). Chromium rejection reason: MEDIUM, made irrelevant by the `granted`/`signal.aborted` check.
- DEBT-09 outcome: MEDIUM-LOW that the spec trim alone reaches the budget for `/for-*/`.
- DEBT-08: HIGH that the emulator already matches the one measured live case; the other cases await the probe.

**Research date:** 2026-11-05
**Valid until:** 2026-12-05 (stable code base; re-measure DEBT-09 after any marketing-page change)
