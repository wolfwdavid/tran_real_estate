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
