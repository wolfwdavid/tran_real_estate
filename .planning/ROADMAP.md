# Roadmap: Tran Real Estate Tools

## Milestones

- ✅ **v1.0 MVP** — Phases 1-11 (shipped 2026-10-29) — full details in `milestones/v1.0-ROADMAP.md`
- 📋 **v1.1** — not yet defined (run `/gsd:new-milestone`)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-11) — SHIPPED 2026-10-29</summary>

- [x] Phase 1: Foundation, Origin & Security Baseline (9/9 plans) — completed 2026-09-22
- [x] Phase 2: Brand System, Marketing & Legal Pages (12/12 plans) — completed 2026-10-05
- [x] Phase 3: Local Platform: Storage, Key Vault & Backup (17/17 plans) — completed 2026-10-05
- [x] Phase 4: Data Layer: RentCast Gateway, Budget Guard & Demo Fixtures (25/25 plans) — completed 2026-10-05
- [x] Phase 5: AI Layer: Providers, Streaming & Fair Housing Guardrails (16/16 plans) — completed 2026-10-05
- [x] Phase 6: Renter Portal (22/22 plans) — completed 2026-10-06
- [x] Phase 7: Investor Portal (21/21 plans) — completed 2026-10-06
- [x] Phase 8: Agent Portal: Profile, Lead Intake & CRM (27/27 plans) — completed 2026-10-07
- [x] Phase 9: Agent Content Studio & Market Snapshot Reports (25/25 plans) — completed 2026-10-13
- [x] Phase 10: Launch Hardening & Go-to-Market (23/23 plans) — completed 2026-10-14
- [x] Phase 11: Zillow Sponsored Listing Filter Extension (12/12 plans) — completed 2026-10-29

Every phase closed with verifier status `human_needed` (no code gaps); the owner rows live in each phase's `*-HUMAN-UAT.md`. Milestone audit: `milestones/v1.0-MILESTONE-AUDIT.md`.

</details>

### 📋 v1.1 (Planned)

Not yet planned. Candidates carried from the v1.0 audit (see `MILESTONES.md` → Known Gaps):

- Owner launch: create the `tranrealestate` org and `tranrealestate.github.io` repo, push, enable Pages, walk `docs/DEPLOY-CHECKLIST.md`, burn down the 77 HUMAN-UAT rows, tick GTM-01..04.
- Extension release: Edge Add-ons submission, `ext-v0.1.0` GitHub Release, "Showcase" badge decision.
- Small follow-ups: origin drift test (extension ↔ web app), UI-level backup round-trip spec across all portal stores, tailwind-merge font-size token class, ListingCard address-link id, print recheck without notes, save-gate reason text, load-sensitive saved-search spec.
- Maintenance: Kit 3 migration (clears three low audit exceptions), Vitest 5, pnpm 12.

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation, Origin & Security Baseline | v1.0 | 9/9 | Complete | 2026-09-22 |
| 2. Brand System, Marketing & Legal Pages | v1.0 | 12/12 | Complete | 2026-10-05 |
| 3. Local Platform: Storage, Key Vault & Backup | v1.0 | 17/17 | Complete | 2026-10-05 |
| 4. Data Layer: RentCast Gateway, Budget Guard & Demo Fixtures | v1.0 | 25/25 | Complete | 2026-10-05 |
| 5. AI Layer: Providers, Streaming & Fair Housing Guardrails | v1.0 | 16/16 | Complete | 2026-10-05 |
| 6. Renter Portal | v1.0 | 22/22 | Complete | 2026-10-06 |
| 7. Investor Portal | v1.0 | 21/21 | Complete | 2026-10-06 |
| 8. Agent Portal: Profile, Lead Intake & CRM | v1.0 | 27/27 | Complete | 2026-10-07 |
| 9. Agent Content Studio & Market Snapshot Reports | v1.0 | 25/25 | Complete | 2026-10-13 |
| 10. Launch Hardening & Go-to-Market | v1.0 | 23/23 | Complete | 2026-10-14 |
| 11. Zillow Sponsored Listing Filter Extension | v1.0 | 12/12 | Complete | 2026-10-29 |
