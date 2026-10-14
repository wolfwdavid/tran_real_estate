# Phase 10 deferred items (out-of-scope discoveries)

## From 10-19 (2026-10-13)

- **Duplicate robots meta on agent/inquire/** (root and sub): `agent-inquire.spec.ts:48` fails on
  `meta[name="robots"][content="noindex"]` count 2. The built page has two identical
  `<meta name="robots" content="noindex"/>` tags: one from the (public) group layout noindex added
  in 10-11 (dc94b27) and one from the inquiry page's own head. Not caused by 10-19 (no head or
  (public) file touched). Fix: drop one of the two tags.
- **Load flakes seen in the full E2E run, both passed 3/3 in isolation:**
  `investor/autofill.spec.ts:195` (root) and `csp.spec.ts:46` (sub, transition toggle not visible).
- **Tool pages over the 60 KB budget** (from the tree containing 10-13's uncommitted work):
  tools/cap-rate 63.0, cash-on-cash 63.2, dscr 63.2 KB gz before 10-19's layout change (10-19 adds
  about 15 B). Owned by 10-13.
- **(10-13) Tool-page budget resolved for `build/` and `build-sub/`** (59.8 / 59.9 / 59.9 KB gz, hub
  51.8), but **`build-configured/` (analytics host set) is over**: cap-rate 60.3, cash-on-cash 60.5,
  dscr 60.5 KB gz. The difference (~0.6 KB) is the analytics beacon in the root layout. The gate
  only runs on `build/`, so CI passes, yet a production build with analytics on would ship over
  budget. Suggested owner fix: load the beacon with a dynamic `import()` after hydration (excluded
  from initial JS by assert-budget), or gate `build-configured` too. Not fixed in 10-13: the beacon
  is 10-19's file and was being edited concurrently.
- **(10-13 run) `agent-inquire.spec.ts:48` fails on root and sub, deterministic:** two
  `meta[name="robots"][content="noindex"]` on /agent/inquire/ — one from the `(public)` group layout
  (added by 10-11, dc94b27) and one from the page itself (08-13). Remove the page-level tag. Out of
  10-13 scope.
- **(10-15 run) More load flakes in the sharded full E2E, all passed in isolation:**
  `investor/buybox.spec.ts:217` (root and sub, toHaveCount) and `renter-saved.spec.ts:83` (root,
  toBeVisible). Also re-confirmed the `agent-inquire.spec.ts:48` duplicate-noindex failure above.

## Inter-wave fix (after wave 6)

- **RESOLVED: duplicate robots noindex on /agent/inquire/** (commit 50a2fbc). Removed the page-level
  `<meta name="robots" content="noindex" />`; the `(public)` group layout is the single source. Title,
  referrer and description stay on the page. Built `agent/inquire/index.html` now has 1 noindex in
  both `build/` and `build-sub/`. `playwright agent-inquire.spec.ts seo.spec.ts --project=root
  --project=sub`: 54 passed.
- **RESOLVED: tool pages over 60 KB gz on `build-configured/`** (commit f4ef7bb). Budget not raised.
  - Beacon: the root layout makes one lazy `import('$lib/analytics/boot')` inside the existing
    build-time gate, started from `afterNavigate` (after hydration). `boot.ts` holds the referrer/width
    logic and reads the defines directly, because the old dynamic `import('$lib/site')` made the
    bundler split `site.ts` into its own preloaded chunk. `boot.test.ts` pins the config to `$lib/site`
    and checks that only the first load sends the referrer. This alone took configured from
    60.3/60.5/60.5 to 59.9/60.1/60.0, which was still over.
  - Second lever: inline Lucide `menu`/`x` SVGs in `PortalSwitcher.svelte` instead of `@lucide/svelte`
    imports. Those two imports pulled Lucide's shared Icon runtime (~1.7 KB gz) into every tool page.
    I measured 10-13's chunk-group lever first, grouping core money/format/amortization/tool-inputs
    on build-configured: −0.25 KB on tool pages, but +0.4 KB on 15 portal routes. So I did not apply
    it. Across all prerendered pages the icon change is −1716 B on calculator pages, −265 B on most
    others, and at most +43 B anywhere (settings/).
  - `node scripts/assert-budget.mjs <dir> --require-tools`, initial JS KB gz, before -> after:

    | Route | build/ | build-sub/ | build-configured/ |
    | --- | --- | --- | --- |
    | tools/ | 51.8 -> 51.6 | 51.8 -> 51.6 | 52.3 -> 51.7 |
    | tools/cap-rate/ | 59.8 -> 58.1 | 59.8 -> 58.2 | 60.3 -> 58.3 |
    | tools/cash-on-cash/ | 59.9 -> 58.3 | 59.9 -> 58.3 | 60.5 -> 58.4 |
    | tools/dscr/ | 59.9 -> 58.3 | 59.9 -> 58.3 | 60.5 -> 58.4 |
    | index (report) | 57.9 -> 57.9 | 57.9 -> 58.0 | 58.5 -> 58.1 |

    All three runs print "Budget assertion passed: 4 gated route(s) within 60 KB". That leaves about
    1.6 KB of headroom on the configured build for 10-14.
  - Privacy/behaviour: `api/send` appears in 0 files of `build/` and `build-sub/`. In
    `build-configured/` it appears in 1 lazy chunk, which no HTML page preloads. Results:
    - `csp:assert`: passed for 42 pages × 3 targets.
    - `playwright analytics.configured harness.configured --project=configured`: 9 passed.
    - `playwright third-party layout agent-inquire --project=root --project=sub`: 520 passed (layout
      covers the Menu/Close toggle).
    - Mutation check: with `boot.pageview` made a no-op, the analytics spec failed 2 and passed 3.
      After restoring it and rebuilding, it passed 9.
  - `pnpm check`: 0 errors, 0 warnings. `pnpm lint`: exit 0. `banned` and `ui:guard`: passed.
    `vitest run apps/web/src/lib/analytics`: 61 passed.
- **(10-14 run) Load flake: `guide.spec.ts:107` (sub)** "hero Show me around resets the guide and
  focuses its heading" failed once in the sharded full E2E (sub shard 2/4: the guide still showed the
  agent tour, not "Where do you want to start?"). Re-run alone 3/3 passed, and the whole guide.spec on
  root + sub 14/14. Same test 10-13 saw fail on sub. For 10-23 to root-cause.
- **(10-16 run) Load flakes in the full E2E (8 shards, 2025 passed / 3 failed):**
  `agent-contact.spec.ts:351` (root, axe at 1280px) and `agent-followup.spec.ts:169` (root) passed
  3/3 each in isolation. `guide.spec.ts:107` (root) failed again under load and 1 of 3 isolated
  repeats (times out clicking "Agent Start the tour"); same test 10-13/10-14 logged, for 10-23.
  Unit: `ResultsView.browser.test.ts` and `scripts/precommit.test.ts` failed once in the full
  `test:unit` run and passed in isolation (known, see handoffs).
- **RESOLVED by 10-18 (b6b4dd5): (10-16) ProviderKeyCard in-page links on /setup/rentcast/.** The card
  now takes a `settingsBase` prefix; /setup/rentcast/ passes `resolve('/settings/')`, Settings keeps
  in-page fragments. E2E: setup-rentcast.spec.ts asserts the pointer is `…/settings/#rentcast-usage`
  and resolves with 200. Original note: the card is embedded unchanged, so
  its post-hydration pointer "RentCast usage" (`#rentcast-usage`) and the locked-state "Key security"
  (`#key-security`) point at ids that exist only on Settings. Not crawled (client-only), but they
  do nothing on the setup page. A follow-up could let the card take a `settingsHref` base.
