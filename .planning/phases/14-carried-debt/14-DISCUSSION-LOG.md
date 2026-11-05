# Phase 14: Carried Debt - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-11-05
**Phase:** 14-carried-debt
**Areas discussed:** Owner decisions riding along (selected); other carried items, save-gate reason copy, phase shape (offered, taken as defaults)

---

## Area selection

| Option | Description | Selected |
|--------|-------------|----------|
| Owner decisions riding along | Snapshot page count, Studio license titles, duplicate memo block reason, Showcase badge default | ✓ |
| Other carried items landing here | AI-provider CORS re-probes, live-smoke 429 hardening, @types/node majors, stale 12-VERIFICATION item, L66/L89 close-outs | |
| Save-gate and memo reason copy | Who writes the DEBT-02 review-only string; tone | |
| Phase shape and sequencing | Plan grouping, overlap with Phase 17, CPU-pressure definition, blame-clean strictness | |

**Note:** the code scout found the Showcase badge default was already decided 2026-10-29 (stays excluded; REQUIREMENTS EXT-F3, ledger L92), so it was not re-asked.

---

## Snapshot page count (09 UAT-6, ledger L79)

| Option | Description | Selected |
|--------|-------------|----------|
| Accept 6 pages | Keep output and the E2E cap at 6; record and close L79 | ✓ |
| Condense the print tables | Compact 24-month tables to fit 4 pages; cap drops to 4; adds a print-CSS task | |

**User's choice:** Accept 6 pages.

## Studio license titles (09 UAT-7, ledger L80)

| Option | Description | Selected |
|--------|-------------|----------|
| Keep NY-safe fixed titles | No code change; conservative label until counsel says otherwise | ✓ |
| Switch Studio to per-state titles | Reuse the Phase 8 per-state table in the Studio disclosure | |

**User's choice:** Keep NY-safe fixed titles.

## Duplicate memo block reason (09 UAT-8, ledger L81)

| Option | Description | Selected |
|--------|-------------|----------|
| Keep both reasons | Transparent; no code change; record acknowledgement | ✓ |
| Filter the duplicate | Drop advertising-category members from the memo's Fair Housing group | |

**User's choice:** Keep both reasons.

## DEBT-08 premise (live origin served `/.nojekyll` with 200)

| Option | Description | Selected |
|--------|-------------|----------|
| Re-scope to measured parity | Probe the live origin, make serve-pages match, pin with a test, reword the requirement | ✓ |
| Keep as written: 404 dotfiles | Emulator stricter than Pages | |
| Drop DEBT-08 | Precache filter and pwa.spec already prevent dotfiles in the precache | |

**User's choice:** Re-scope to measured parity.

## Wrap-up

| Option | Description | Selected |
|--------|-------------|----------|
| Write the context | Take the stated defaults for the three unselected areas | ✓ |
| Discuss the other carried items | Item by item | |
| Discuss phase shape | Grouping, overlap, CPU pressure, blame-clean | |

**User's choice:** Write the context with the defaults (recorded as D-09..D-16 in CONTEXT.md).

---

## Claude's Discretion

- Notes-numeral serialization into artifact `meta`
- `ListingCard` id-prefix prop shape
- Inline vs lazy validation split for the DEBT-09 trim
- Bounded-wait implementation detail for the `tran-alerts` lock
- Mutation-ledger wording

## Deferred Ideas

- Live-smoke 429 hardening → Phase 15
- `@types/node` majors → Phase 16
- AI-provider CORS re-probes (L36) → owner ledger task
- Studio per-state titles → only if counsel asks
