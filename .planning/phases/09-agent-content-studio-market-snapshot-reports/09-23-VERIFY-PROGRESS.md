# 09-23 verify progress (step by step, single core 0x100)

`corepack pnpm verify` is run one step at a time in package.json order because of the one-core
machine constraint (Node is pinned to a single core). Each line: step, exit code, wall seconds.
Wall seconds include any host suspend while the step ran.

- check: exit 0, 783 s (wall clock includes a host suspend; svelte-check 2615 files, 0 errors, 0 warnings)
- lint: exit 0, 245 s (prettier --check . clean, eslint . clean)
- banned: exit 0, 3 s (384 files)
- ui:guard: exit 0, 2 s (79 files)
- test:unit, run per project (same `vitest run`, split so each call stays short):
  - core: exit 0, 62 s (85 files, 2652 tests)
  - web: exit 0, 244 s (160 files, 2405 tests)
  - brand + scripts: exit 0, 66 s (16 files, 534 tests)
  - web-browser, first run: exit 1, 170 s. Two failures:
    - rerender.browser.test.ts "with the guard disabled ... the spy counts it": expected 0 > 0.
      Root cause: the test asserted the mutant's async spends (Dexie cache read, fetch spy, ledger
      write) after a fixed 100 ms settle; on a cold, single-core run the spends had not landed yet
      (and then hit DatabaseClosedError after teardown). Fixed with expect.poll on the same
      assertions (no assertion loosened).
    - OutreachSection.browser.test.ts "Failed to fetch dynamically imported module" (file never
      loaded). Not reproducible: passed alone, passed paired with rerender on rerun, and passed in
      both later full runs; the Vite deps cache was not re-optimized (deps/_metadata.json dated
      2026-10-06). The run took twice its normal time, and the host suspended network IO during
      this session (Playwright saw net::ERR_NETWORK_IO_SUSPENDED in another run), which fails an
      in-flight module fetch exactly this way. Recorded as a host-suspend transient, not a code fault.
  - web-browser, second run (before the fix): exit 0, 83 s (32 files, 244 tests)
  - web-browser, after the fix: exit 0, 84 s (32 files, 244 tests)
- build:root: exit 0, 41 s
- build:sub: exit 0, 43 s
- csp:assert: exit 0, 3 s (38 pages per base)
- test:e2e, Playwright --workers=1 in chunks (spec files, one project per chunk):
  - a11y [root] (e2e.a11y.spec): exit 0, 187 s: 77 passed (3.1m) 
  - agent-1 [root] (agent-a11y agent-contact.spec agent-contacts agent-csv agent-entry): exit 0, 273 s: 60 passed (4.5m) 
  - agent-2 [root] (agent-followup agent-import agent-inquire): exit 0, 154 s: 33 passed (2.5m) 
  - agent-3 [root] (agent-live-key agent-no-rentcast agent-pipeline agent-profile agent-share-link): exit 0, 183 s: 30 passed (3.0m) 
  - agent-4 [root] (agent-shell agent-today ai-a11y): exit 0, 203 s: 55 passed (3.4m) 
  - ai-app [root] (ai-drafting ai-guardrails app-notice csp.spec data-status framing): exit 0, 182 s: 37 passed (2.9m) 
  - inv-1 [root] (investor.analyze investor.autofill investor.buybox investor.deals): exit 0, 118 s: 28 passed (1.9m) 
  - inv-2 [root] (investor.demo investor.markets investor.memo investor.overview investor.print investor.routes investor.sweep): exit 0, 307 s: 47 passed (5.1m) 
  - layout-a [root] (layout.spec -g 'no horizontal scroll'): exit 0, 99 s: 71 passed (1.6m) 
  - layout-b [root] (layout.spec --grep-invert 'no horizontal scroll'): exit 0, 193 s: 150 passed (3.2m) 
  - mkt-pwa [root] (marketing pwa renter-affordability renter-demo-credible renter-fair-rent): exit 0, 175 s: 78 passed (2.9m) 
  - renter-1 [root] (renter-harness renter-journey renter-listing renter-map.spec renter-map-split): exit 0, 114 s: 33 passed (1.9m) 
  - renter-2 [root] (renter-outreach renter-results renter-saved renter-search renter-shortlist routes-drift routing): exit 0, 163 s: 31 passed (2.7m) 
  - settings-1 [root] (settings-a11y settings-backup settings-data settings-install): exit 0, 148 s: 34 passed (2.4m) 
  - settings-2 [root] (settings-keys settings-security settings-shell settings-storage): exit 0, 133 s: 36 passed (2.2m) 
  - studio-1 [root] (snapshot-builder snapshot-print studio-listing studio-reel): exit 0, 184 s: 23 passed (3.0m) 
  - studio-2 [root] (studio-shell studio-social studio-keyless): exit 1, 195 s: 1 failed 33 passed (3.2m) 
  - studio-2-rerun [root] (studio-shell studio-social studio-keyless): exit 0, 194 s: 34 passed (3.2m) 
  - studio-1-rerun [root] (snapshot-builder snapshot-print studio-listing studio-reel): exit 0, 175 s: 23 passed (2.9m) 
    - studio-2 failure root cause: `studio-keyless` "brand colors" read the print band's colors
      right after Save navigated client-side to /print/snapshot/. The trace shows the route's
      stylesheet (43.*.css, 456 ms) still loading while the report was rendered and the print
      button already enabled, so the band had no background and the title the default color. A real
      gap: printing in that window would drop the brand styling. Fixed in the route: "Preparing…"
      now also waits for every stylesheet link to load. build:root rebuilt (exit 0, 41 s); studio-1
      and studio-2 re-run on root, green.
- build:sub rebuilt after the print fix: build-sub-2 exit=0 secs=38
  - a11y [sub] (e2e.a11y.spec): exit 0, 148 s: 77 passed (2.4m) 
  - agent-1 [sub] (agent-a11y agent-contact.spec agent-contacts agent-csv agent-entry): exit 0, 214 s: 60 passed (3.5m) 
  - agent-2 [sub] (agent-followup agent-import agent-inquire): exit 0, 134 s: 33 passed (2.2m) 
  - agent-3 [sub] (agent-live-key agent-no-rentcast agent-pipeline agent-profile agent-share-link): exit 0, 159 s: 30 passed (2.6m) 
  - agent-4 [sub] (agent-shell agent-today ai-a11y): exit 0, 191 s: 55 passed (3.1m) 
  - ai-app [sub] (ai-drafting ai-guardrails app-notice csp.spec data-status framing): exit 0, 152 s: 33 passed (2.5m) 
  - inv-1 [sub] (investor.analyze investor.autofill investor.buybox investor.deals): exit 0, 101 s: 28 passed (1.6m) 
  - inv-2a [sub] (investor.demo investor.markets investor.memo): exit 0, 128 s: 15 passed (2.1m) 
  - inv-2b [sub] (investor.overview investor.print investor.routes investor.sweep): exit 1, 133 s: 1 failed 31 passed (2.2m) 
  - inv-2b-rerun [sub] (investor.overview investor.print investor.routes investor.sweep): exit 1, 103 s: 1 failed 31 passed (1.7m) 
  - inv-2b-rerun2 [sub] (investor.overview investor.print investor.routes investor.sweep): exit 0, 134 s: 32 passed (2.2m) 
  - inv-analyzer-recheck [root] (investor.analyze investor.deals investor.sweep investor.memo): exit 0, 167 s: 21 passed (2.8m) 
  - inv-analyzer-recheck [sub] (investor.analyze investor.deals): exit 0, 43 s: 14 passed (41.8s) 
    - inv-2b [sub] failures (Phase 7 investor/sweep.spec), two root causes found:
      1. "market dashboard (mocked)": 8 SVG gridlines at right=1031 px right after the viewport
         changed to 375 px. LayerChart re-lays out from a ResizeObserver, so the first frame still
         held 1280 px gridlines. The spec now polls the same no-overflow assertion until the
         re-layout lands (sweep.spec.ts).
      2. keyless seed: "Save as a new deal" did nothing. The analyzer writes ?id= into the URL before
         `await autosaver.flush()`, so the test's next click arrived while `saving` was still true
         and save() silently ignored it. Product fix: "Save as a new deal" carries
         aria-disabled while a save is finishing, like Save (AnalyzerPage.svelte), so the control
         says it is busy and Playwright waits for it.
      build:root (31 s) and build:sub (34 s) rebuilt; inv-2b [sub] re-run green; analyzer, deals,
      sweep and memo re-run on root (21 passed) and analyzer + deals on sub (14 passed).
  - layout-a [sub] (layout.spec -g 'no horizontal scroll'): exit 0, 71 s: 71 passed (1.2m) 
  - layout-b [sub] (layout.spec --grep-invert 'no horizontal scroll'): exit 0, 160 s: 150 passed (2.6m) 
  - mkt-pwa [sub] (marketing pwa renter-affordability renter-demo-credible renter-fair-rent): exit 0, 153 s: 78 passed (2.5m) 
  - renter-1 [sub] (renter-harness renter-journey renter-listing renter-map.spec renter-map-split): exit 1, 93 s: 1 failed 32 passed (1.5m) 
  - renter-2 [sub] (renter-outreach renter-results renter-saved renter-search renter-shortlist routes-drift routing): exit 0, 147 s: 31 passed (2.4m) 
  - settings-1 [sub] (settings-a11y settings-backup settings-data settings-install): exit 0, 126 s: 34 passed (2.1m) 
  - settings-2 [sub] (settings-keys settings-security settings-shell settings-storage): exit 0, 98 s: 36 passed (1.6m) 
  - studio-1 [sub] (snapshot-builder snapshot-print studio-listing studio-reel): exit 1, 175 s: 1 failed 22 passed (2.9m) 
  - studio-2 [sub] (studio-shell studio-social studio-keyless): exit 0, 224 s: 34 passed (3.7m) 
  - renter-map-recheck [sub] (renter-map.spec studio-reel): exit 0, 153 s: 18 passed (2.5m) 
  - renter-map-recheck [root] (renter-map.spec studio-reel): exit 0, 156 s: 18 passed (2.6m) 
    - renter-1 [sub] failure (Phase 6 renter-map "co-located units"): the live region read
      "Showing 5 of 15 rentals." instead of "5 rentals at this spot.". Root cause: the price filter
      announces its result after a debounce (FILTER_ANNOUNCE_MS); on a slow run it landed after the
      spot list opened and replaced that announcement. The spec now waits for the filter
      announcement before opening the map; the spot assertion is unchanged.
    - studio-1 [sub] failure (09-22 studio-reel axe at 1280px): after "Generate again" the beat
      view still showed its empty line. Root cause: the spec's writeScript returned at once on a
      second run, because the panel resolves the provider and builds the prompt before the run
      starts, so the previous run's "Draft ready." was still visible and no Stop existed yet; the
      5 s check then raced the new stream. writeScript now waits for the panel's aria-busy (this
      run started) before waiting for it to finish.
    - Both re-checked: renter-map + studio-reel on sub (18 passed) and root (18 passed).
