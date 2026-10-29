# Milestones

## v1.0 MVP (Shipped: 2026-10-29)

**Delivered:** Tran Real Estate Tools v1: one statically built SvelteKit app with three portals (renters, investors, agents), a $0 browser-only architecture where every user brings their own RentCast and LLM keys, a launch surface with SEO tool pages and a first-party analytics beacon, and a hide-only Zillow sponsored-listing browser extension. Built and verified locally; the live demo waits on the owner creating the `tranrealestate` GitHub org and pushing.

**Phases completed:** 11 phases, 209 plans, 475 tasks
**Timeline:** 2026-09-13 → 2026-10-29 (47 days), 1,206 commits, 1,849 files, ~165k lines of TypeScript, Svelte, CSS and scripts (excluding generated output)
**Git range:** `213f4b6` (chore: workspace root) → `a60413c` (docs(v1.0): milestone audit)
**Audit:** `milestones/v1.0-MILESTONE-AUDIT.md` (status `tech_debt`: 58/58 requirements wired, 0 broken flows, owner-gated debt)

**Key accomplishments:**

1. **Security-first static platform (Phases 1-3).** Hash-mode meta CSP with a seven-host `connect-src`, frame guard, SHA-pinned CI with gitleaks and a real-data guard on every commit, and a local key vault (per-tab session by default, opt-in remember, optional PBKDF2 + AES-GCM passphrase lock) with Dexie storage, JSON backup/restore and persistent-storage handling.
2. **Budget-guarded data and AI layers (Phases 4-5).** A single RentCast gateway with IndexedDB cache, request dedupe, a visible monthly call meter and a hard stop at 40 of 50 free calls; synthetic demo fixtures with onboarding; raw-fetch streaming adapters for Claude, OpenAI, Gemini and OpenRouter behind one `GenerationPanel`; a deterministic Fair Housing checker that gates every AI housing text before it can be copied or sent.
3. **Three demo-credible portals (Phases 6-9).** Renter saved searches with "new since last visit", fair-rent check and outreach drafts; investor deal analyzer (cap rate, NOI, cash flow, cash-on-cash, DSCR), buy-box alerts, market dashboards and an exportable AI memo; agent lead form via Web3Forms with paste-import, local CRM with follow-ups, a content studio (listing, social pack, reel script) and a printable Market Snapshot report with disclosure gates.
4. **Launch hardening and go-to-market (Phase 10).** Portal tour and sample-data onboarding, per-portal waitlist and feedback forms, free SEO calculator pages with sitemap and share cards, a GPC/DNT-honouring first-party Umami beacon switched on by repo variables, 60 KB per-route JS budgets, and a generated launch audit (`docs/LAUNCH-AUDIT.md`) whose every row derives from test evidence.
5. **Zillow sponsored-listing filter extension (Phase 11).** WXT MV3 extension with label-first detection plus ad-slot selectors, dim-with-reveal, a toolbar popup with toggle and count, permissions limited to storage and zillow.com, a mutation-tested zero-network oracle over the production manifest/bundle/zip, a gated GitHub Releases workflow, install guide and Edge Add-ons listing copy.
6. **Verification discipline.** 6,647 unit tests, 2,327 Playwright E2E tests with axe at WCAG 2.2 AA on every route in keyless and keyed states, Nyquist-compliant validation maps for all 11 phases, mutation-tested oracles for CSP, SEO, budget, supply chain and the extension, and a composed `pnpm verify` chain that CI mirrors.

### Known Gaps

Accepted as tech debt at completion (owner-gated; see `milestones/v1.0-MILESTONE-AUDIT.md`):

- **GTM-01..GTM-04 (Phase 10) stay `Pending`.** The code shipped and verified locally; proof (Umami pageviews, Web3Forms delivery, share-card unfurl, Search Console) needs the live origin and the owner's accounts.
- **No live demo yet.** The repository has no git remote; the owner must create the `tranrealestate` org and `tranrealestate.github.io` repo, push `main`, enable Pages and walk `docs/DEPLOY-CHECKLIST.md`.
- **77 owner HUMAN-UAT rows** across the 11 phases (real keys, real devices, live origin, Edge Partner Center, Zillow Terms of Use read, three product decisions).
- Small follow-ups carried forward: origin drift test between the extension and the web app, a UI-level backup round-trip spec across all portal stores, tailwind-merge dropping a font-size token class, ListingCard address-link id, print recheck without notes, save-gate reason text, one load-sensitive saved-search spec, four low audit exceptions to revisit by 2027-01-31 or on the Kit 3 migration.
