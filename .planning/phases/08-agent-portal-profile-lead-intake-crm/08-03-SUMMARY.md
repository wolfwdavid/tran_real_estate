---
phase: 08-agent-portal-profile-lead-intake-crm
plan: 03
subsystem: security/csp, copy-compliance
tags: [csp, img-src, blob, banned-terms, e2e]
requires: []
provides:
  - "img-src 'self' https://tile.openstreetmap.org blob: (both config and oracle)"
  - "AGENT_SCOPES / AGENT_BANNED banned-terms list; SCOPE covers features/agent and lib/leads"
affects: [08 agent logo preview, 09 report logos]
tech-stack:
  added: []
  patterns: ["two-file CSP literal duplicate, one commit", "path-scoped banned list"]
key-files:
  modified:
    - apps/web/svelte.config.js
    - scripts/assert-csp.mjs
    - scripts/assert-csp.test.ts
    - apps/web/tests/e2e/csp.spec.ts
    - scripts/lib/banned-terms-rules.mjs
    - scripts/banned-terms.test.ts
decisions:
  - "blob: APPENDED to the Phase 6 img-src (OSM tile host kept); data: stays banned"
  - "Agent-scoped banned list enforces 08-UI-SPEC voice rules: sync, inbox connection, automatically sends, SMS/text consent, auto-reply"
metrics:
  duration: ~20min
  completed: 2026-10-06
---

# Phase 8 Plan 03: CSP blob: images and agent banned-terms scope Summary

The production CSP now allows same-origin `blob:` images (agent logo, Phase 9 report logos) through a reviewed two-file change. Oracle mutation tests and a built-site Chromium probe back the change, and the banned-terms gate now scans all Phase 8 agent copy locations.

## What was done

- **Task 1 (bd84fca):** I appended `blob:` to `img-src` in `apps/web/svelte.config.js` and in `EXACT['img-src']` in `scripts/assert-csp.mjs`, in one commit. **Phase 6's tile host was merged, not replaced:** the result is `'self' https://tile.openstreetmap.org blob:`. In `assert-csp.test.ts`, the golden policy now includes `blob:`. The Phase 6 "widened with blob:" rejection case was flipped to "missing blob:", and the Fault 10 table now carries `blob:` in every variant. New tests Fault 9a, 9b, 9c and 9d cover a missing `blob:`, an added `data:`, an extra host and a missing directive. Both builds produce 25 pages each and pass `csp:assert`. The scripts suite is 81/81 green.
- **Task 2 (8962314):**
  - `csp.spec.ts` builds a canvas PNG blob, turns it into an object URL, and decodes it on `agent/` (naturalWidth 4, zero violations). A second negative probe checks that a `data:` image still produces an `img-src` violation. Both pass on the root and sub projects (12/12 csp spec).
  - `SCOPE` now includes `features/agent` and `lib/leads`. Each path is defined once as a const so `SCOPE` and `AGENT_SCOPES` cannot drift apart.
  - New `AGENT_SCOPES` list: `(app)/agent/`, `(public)/`, `features/agent/` and `lib/leads/`, with `AGENT_BANNED` holding the UI-SPEC rules.
  - Tests cover the following: each banned phrase is flagged in agent paths, acceptable agent copy passes, an `async` identifier is not flagged, and the list does not apply outside the agent scopes. The CLI fails on `guaranteed results` in `features/agent/crm` and `we represent` in `lib/leads`, and on agent phrases in `(app)/agent` and `(public)/agent/inquire`. `banned` passes on 250 files. The banned-terms suite is 95/95 green.

## Deviations from Plan

- **[Rule 1 - Plan/codebase mismatch]** The plan said to add `'img-src': ['self','blob:']`. Phase 6 already had an `img-src`, so I appended to it as the 06-04 merge rule requires. The existing test named "Fault 9" (exact-set directives) is kept; the new tests are named 9a to 9d.
- **[Rule 2 - Additional scope]** The plan only extended `SCOPE`. The orchestrator also asked for agent-scoped phrasing rules, so I added the `AGENT_SCOPES` and `AGENT_BANNED` lists with non-vacuity tests.

## Requirements advanced

- AGT-01: the logo-render CSP prerequisite and the copy gate for agent copy (do not mark complete; the profile UI lives in other plans).

## Known Stubs

None.

## Self-Check: PASSED

- Commits bd84fca and 8962314 exist; all 6 files modified as listed; build lock released.
