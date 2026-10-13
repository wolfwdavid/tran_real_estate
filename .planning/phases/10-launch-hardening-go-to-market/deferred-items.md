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
