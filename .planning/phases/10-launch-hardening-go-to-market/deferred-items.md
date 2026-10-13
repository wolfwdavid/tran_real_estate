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
