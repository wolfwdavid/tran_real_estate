# Phase 15 deferred items

## D-10 (carried from Phase 14): live-smoke HTTP 429 hardening

- **Source:** `14-CONTEXT.md` D-10: "map 429 on navigation to the exit-2 precondition path of
  `scripts/smoke.mjs`, zero retries otherwise", deferred "to Phase 15".
- **Decision (planning, 2026-11-06):** NOT planned in Phase 15. Recorded here so it is not dropped.
- **Why it does not fit this phase:**
  1. No TEST-01..06 requirement covers it. Phase 15 is about determinism under local CPU load;
     D-10 is about how the live smoke classifies a Pages CDN rate-limit response.
  2. It can only be verified against the live origin (a real 429 from the Pages CDN). The Phase 15
     evidence protocol runs locally and cannot exercise it, so it would ship unproven.
  3. It touches `scripts/smoke.mjs` and the smoke specs under `apps/web/tests/smoke/`, which no
     Phase 15 plan otherwise edits (Phase 15 annotates timeouts in `tests/smoke/fixtures.ts` only).
- **Pointer (next home):** insert a decimal phase before Phase 16 (`/gsd:insert-phase 15`, giving
  Phase 15.1 "Live-smoke 429 classification"). Phase 16 closes with a deploy and a green live smoke,
  which is the next run that can meet a CDN 429, and Phase 16 forbids anything else in flight.
  If the owner prefers, it can instead ride with Phase 17 (it also deploys).
- **Definition of done for whoever picks it up:** a 429 on any smoke navigation exits 2 (precondition,
  "CDN rate-limited, re-dispatch once per lessons 2026-10-31") instead of 1; zero retries added; a
  scripts-project unit test plants a 429 response and asserts exit 2; any other status keeps exit 1.
