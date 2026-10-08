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
