# Phase 9: Agent Content Studio & Market Snapshot Reports - Context

**Gathered:** 2026-10-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Under `/agent/studio/`: listing description generator, social post pack (Instagram/Facebook/LinkedIn), founder-story reel script generator, and the branded Market Snapshot report (`/print/snapshot/`) for a zip code. Requirements STU-01..04. Depends on Phase 7 (print shell, zip dashboards), Phase 8 (profile/disclosures), Phases 4/5.

</domain>

<decisions>
## Implementation Decisions

The owner chose fully autonomous mode on 2026-10-04. Recommended defaults adopted.

### Listing description (STU-01)
- Structured facts form (beds, baths, sqft, year, features checklist, neighborhood *amenities* — transit, parks, shops; never schools/crime/demographics), tone picker (warm / concise / luxury), length. Prompt `studio/listing.v1` with the property-not-people fragment. Output gated by the Fair Housing checker; user-edited text is re-checked before copy. Disclosure appended.

### Social post pack (STU-02)
- One generation → three variants with platform constraints (IG ≤2,200 chars + hashtags block; FB conversational; LinkedIn professional, no hashtags spam); each card has copy button + character count; brokerage disclosure from Phase 8 appended automatically; checker runs on each variant.

### Founder-story reel script (STU-03)
- Inputs: agent's own story beats + results they supply (text fields; the app never invents numbers — if "results" is empty the script says so and prompts for real figures). Output: timed beats (hook 0-3s → manual pain → before/after → results → mission → CTA), on-screen captions, B-roll list, and an **AI-disclosure checklist** (NY AI Transparency in Advertising Act: disclose synthetic performers/voice if used; generic "AI-assisted script" note). Checker applied.

### Market Snapshot report (STU-04)
- `/agent/studio/snapshot/` picks a zip (from watched zips or new — cost shown; cached stats = 0 calls); report = zip stats tables (rent by bedroom, trend, price-to-rent, days on market, inventory), reuse of Phase 7 chart components, optional active listings sample (0-1 calls), AI narrative over computed numbers (same numeric post-check as the investor memo), agent logo/colors/disclosures from profile, label "Market information only — not a CMA or appraisal", Equal Housing Opportunity statement toggle, removable Tran footer. Rendered in `/print/snapshot/` via the Phase 7 print shell; browser print to PDF.
- Agent brand colors are applied only to accents and must pass the contrast check from Phase 8 (fallback to brand tokens otherwise).

### Demo credibility
- All studio routes work keyless (fixture provider streams sample output; fixture market stats); axe on all; banned-terms grep extended to studio static copy.

### Claude's Discretion
- Hashtag strategy; chart selection per report; exact checklist wording (plain language, not legal advice).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Phase 7 `PrintReport` shell + `ZipTrendChart`/`PriceToRentChart`; Phase 8 profile + disclosure composer; Phase 5 panel/checker/numeric post-check; Phase 4 gateway/fixtures.

### Established Patterns
- Query-param print routes; features/agent boundaries; checker gating on every output.

### Integration Points
- Agent nav gains "Studio"; profile page links "Create Market Snapshot".

</code_context>

<specifics>
## Specific Ideas

- "Results" in the reel script are always user-supplied; copy reminds agents that fabricated results violate advertising rules.

</specifics>

<deferred>
## Deferred Ideas

- Standalone public Fair Housing checker page (STU-V2-01 — Phase 10 may include a lightweight version as an SEO tool page if budget allows).
- Cut line: ship STU-01 + STU-04 first; cut STU-03 then STU-02 if overrun.

</deferred>
