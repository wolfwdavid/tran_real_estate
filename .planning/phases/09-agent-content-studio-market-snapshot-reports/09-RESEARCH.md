# Phase 9: Agent Content Studio & Market Snapshot Reports - Research

**Researched:** 2026-10-04
**Domain:** AI marketing-copy generators with deterministic compliance gates (Fair Housing, state license-law advertising disclosures, FTC/NY AI advertising rules), plus a branded print-to-PDF market report built from cached RentCast market stats
**Confidence:** MEDIUM overall. Architecture and reuse contracts are HIGH because they come from approved Phase 5/7/8 specs. Legal-adjacent findings are MEDIUM: primary sources were read for NY, NJ, OH, FL, TX, and CA, but this is not legal advice.

> **Not legal advice.** Everything below about advertising law is engineering input for product defaults. In-product copy must say "Check this against your state's and brokerage's advertising rules. This isn't legal advice." (Phase 8 already uses that sentence.)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

The owner chose fully autonomous mode on 2026-10-04. Recommended defaults adopted.

#### Listing description (STU-01)
- Structured facts form (beds, baths, sqft, year, features checklist, neighborhood *amenities* — transit, parks, shops; never schools/crime/demographics), tone picker (warm / concise / luxury), length. Prompt `studio/listing.v1` with the property-not-people fragment. Output gated by the Fair Housing checker; user-edited text is re-checked before copy. Disclosure appended.

#### Social post pack (STU-02)
- One generation → three variants with platform constraints (IG ≤2,200 chars + hashtags block; FB conversational; LinkedIn professional, no hashtags spam); each card has copy button + character count; brokerage disclosure from Phase 8 appended automatically; checker runs on each variant.

#### Founder-story reel script (STU-03)
- Inputs: agent's own story beats + results they supply (text fields; the app never invents numbers — if "results" is empty the script says so and prompts for real figures). Output: timed beats (hook 0-3s → manual pain → before/after → results → mission → CTA), on-screen captions, B-roll list, and an **AI-disclosure checklist** (NY AI Transparency in Advertising Act: disclose synthetic performers/voice if used; generic "AI-assisted script" note). Checker applied.

#### Market Snapshot report (STU-04)
- `/agent/studio/snapshot/` picks a zip (from watched zips or new — cost shown; cached stats = 0 calls); report = zip stats tables (rent by bedroom, trend, price-to-rent, days on market, inventory), reuse of Phase 7 chart components, optional active listings sample (0-1 calls), AI narrative over computed numbers (same numeric post-check as the investor memo), agent logo/colors/disclosures from profile, label "Market information only — not a CMA or appraisal", Equal Housing Opportunity statement toggle, removable Tran footer. Rendered in `/print/snapshot/` via the Phase 7 print shell; browser print to PDF.
- Agent brand colors are applied only to accents and must pass the contrast check from Phase 8 (fallback to brand tokens otherwise).

#### Demo credibility
- All studio routes work keyless (fixture provider streams sample output; fixture market stats); axe on all; banned-terms grep extended to studio static copy.

### Claude's Discretion
- Hashtag strategy; chart selection per report; exact checklist wording (plain language, not legal advice).

### Deferred Ideas (OUT OF SCOPE)
- Standalone public Fair Housing checker page (STU-V2-01 — Phase 10 may include a lightweight version as an SEO tool page if budget allows).
- Cut line: ship STU-01 + STU-04 first; cut STU-03 then STU-02 if overrun.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| STU-01 | Agent can generate a listing description from facts they enter, checked by the Fair Housing checker | §Pattern 2 (facts-only prompt `studio/listing.v1`), §Pattern 4 (numeric post-check with the facts as the allowed set), §Pattern 5 (unsupported-feature check), §Fair Housing hot-spots (lexicon additions), Pitfalls 1, 4, 9 |
| STU-02 | Agent can generate an Instagram, Facebook, and LinkedIn post pack with their brokerage disclosure appended | §State disclosure table, §Pattern 3 (code-appended disclosure with a character budget), §Platform limits (IG 2,200 chars + **5 hashtags max**, LinkedIn 3,000, FB 63,206), sectioned single-generation parser, Pitfalls 2, 3 |
| STU-03 | Agent can generate a founder-story reel script (hook → manual pain → before/after → results → mission → CTA) with timed beats, captions, B-roll list, and an AI-disclosure checklist | §Pattern 6 (code-owned timing, model-owned words), §NY GBL §396-b + FTC 16 CFR 255/465 findings, §Checklist wording, results placeholder rule, Pitfalls 5, 6 |
| STU-04 | Agent can create a branded Market Snapshot report for a zip code and print it to PDF, labeled as not a CMA or appraisal | §Pattern 7 (snapshot record frozen at creation, print route spends 0 calls), RentCast `/v1/markets` fields, Phase 7 `PrintReport`/`ChartFigure print`, `effectiveBrandColors()`, EHO statement, aggregated listings sample (no other brokers' listings), banned-terms negation allowlist, Pitfalls 7, 8, 10, 11, 12 |
</phase_requirements>

## Summary

Phase 9 is mostly composition. The heavy machinery already has contracts: Phase 5's `GenerationPanel` (three exits, Fair Housing gating, `postChecks` prop added by Phase 7, `footer` prop added by Phase 8), Phase 7's `PrintReport` shell, `print.css`, `ChartFigure`/`ZipTrendChart`/`PriceToRentChart` in `features/shared/`, and the number check, plus Phase 8's profile, `effectiveBrandColors()`, disclosure composer, the sample agent "Avery Sample / Sample Realty", and the CSP `img-src 'self' blob:` change. None of those phases has executed yet. The repo has only Phase 1 code. So Phase 9 plans must name these contracts as prerequisites, not re-implement them.

What is new and needs care falls into three areas. (1) **A deterministic compliance layer for advertising copy**, which is where the legal research lands. The disclosure is appended by code and never written by the model. It is budgeted inside each platform's character limit. It is extended with state facts the Phase 8 format lacks: NY requires the **license type** ("Licensed Real Estate Salesperson") and the **broker's address or phone**, NJ wants the **brokerage name more prominent** than the agent's, and NY/TX/CA/FL constrain **team names**. Instagram now caps posts at **5 hashtags** (December 2025), not 30. (2) **Facts-only generation**, enforced after the fact. The same numeric post-check used for the investor memo runs with the agent's own inputs as the allowed set for listings and reels and the computed snapshot stats for the narrative. A small "unsupported feature" vocabulary check catches invented amenities. (3) **A Market Snapshot that is honest by construction.** Numbers are computed in `packages/core`. The narrative only narrates. The listings sample is **aggregated, with no addresses**, because NY 19 NYCRR 175.25(b)(2)(ii) and TX rules bar advertising another broker's exclusive listing without permission. The report is frozen into a Dexie record so the print route spends 0 calls. The required "not a CMA or appraisal" label needs a **negation allowlist** in the banned-terms gate, which bans the word "appraisal" outright.

**Primary recommendation:** Build a pure `packages/core/src/studio/` module first. It holds the disclosure formatter per platform with character budgeting, the social/reel section parsers, reel timing, the snapshot metric builder and allowed-number set, and the unsupported-feature check, all table-tested. Then wire four thin routes onto the existing `GenerationPanel` + `postChecks` + `footer` contracts. Ship STU-01 and STU-04 first, per the cut line.

## Standard Stack

No new runtime dependencies. Everything comes from earlier phases.

### Core
| Library / module | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| SvelteKit / Svelte | 2.70.3 / 5.57.0 | Routes `/agent/studio/*`, `/print/snapshot/` | Locked stack [CLAUDE.md] |
| `packages/core` (pure TS) | workspace | New `studio/` module: disclosure formatting, parsers, timing, snapshot metrics, allowed-number sets | Project pattern: pure logic in core, DOM-free tests [Phase 4/5/7 CONTEXT] |
| Phase 5 `GenerationPanel` + prompt registry + Fair Housing lexicon | workspace | Streaming, checker gating, three exits, `postChecks` (Phase 7 addition), `footer` (Phase 8 addition) | Locked reuse [09-CONTEXT code_context] |
| Phase 7 `PrintReport`, `print.css`, `ChartFigure` (`print` prop), `ZipTrendChart`, `PriceToRentChart` | workspace (`features/shared/`) | Snapshot print shell + charts | Locked reuse; Phase 7 UI-SPEC Planner Note 5 names Phase 9 as consumer |
| Phase 4 `DataGateway.marketStats(zip)` + optional `saleListings` / `rentalListings`, `CostLabel`, `CapConfirmDialog`, `ProvenanceChip` | workspace | Snapshot data, call cost shown first | Sole RentCast path [Phase 4 CONTEXT] |
| Phase 8 profile repo, `effectiveBrandColors()`, disclosure composer, sample profile | workspace | Branding + disclosures | Locked [Phase 8 UI-SPEC §Brand colors] |
| LayerChart | 2.5.0 | Already used by Phase 7 charts | Sanctioned chart lib |
| Dexie | 4.4.6 | New `studioArtifacts`/`snapshots` storage (or reuse Phase 5 generations table + a `snapshots` table) | Project store |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `Intl.NumberFormat`, `Intl.DateTimeFormat` | built-in | Number/date display that matches the allowed-number formatter | Every rendered figure |
| Vitest | 4.1.11 | Unit tests (`core`, `web`, `scripts` projects) | All pure logic |
| Playwright + `@axe-core/playwright` | 1.63.0 / 4.13.0 | E2E keyless flows, print emulation, axe | Every route |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Browser print (`window.print()`) | pdfmake 0.3.11 | Phase 7 locked browser print as the pipeline. pdfmake only if print output proves unusable. **Do not add it in Phase 9.** |
| One generation with section markers for the social pack | Three separate generations | 3× tokens/cost, but each is simpler. CONTEXT locks "one generation → three variants". |
| JSON-mode structured output | Plain-text sections with `=== MARKER ===` lines | JSON streams badly into a plain-text panel and differs per provider (Anthropic/OpenAI/Gemini/OpenRouter). Markers degrade gracefully. |
| HUD EHO logo image | Text statement "Equal Housing Opportunity" | Text satisfies the guidance ("logotype, statement, or slogan"), needs no asset, and has no CSP or print risk. The logo is an optional later addition. |

**Installation:** none. `pnpm` dependency diff for this phase should be empty, which is a useful plan-checker assertion.

## Legal-Adjacent Findings (primary sources; not legal advice)

### A. State advertising disclosure requirements (FL, NJ, OH, CA, NY, TX + generic)

| State | Brokerage name | Prominence | License # | License type / title | Team names | Social / character-limited platforms | Source | Conf. |
|---|---|---|---|---|---|---|---|---|
| **FL** | "All real estate advertisements must include the licensed name of the brokerage firm" (61J2-10.025(1)) | Internet ads: brokerage name "adjacent to or immediately above or below the point of contact information" (3)(a). Team name "shall not be in larger print than the name of the registered brokerage" (F.S. 475.2755) | Not required by rule | At least licensee's last name as registered (2) | Team name may not contain Agency, Associates, Brokerage, Brokers, Company, Corp., Inc., LLC, Partnership, Properties, Property, Real Estate, Realty | Internet rule applies to sites/posts | Cornell LII 61J2-10.025; Florida Realtors summary | HIGH (rule text) / MEDIUM (team) |
| **NJ** | Must include the agent's licensed name **and** the broker's "regular business name" (N.J.A.C. 11:5-6.1(b)) | Broker name "shall appear in **larger print or be displayed in a more prominent manner** than the name of the … salesperson" (b)(1) | Not required | Business cards: "salesperson"/"broker" titles (e) | (no specific rule found in the excerpt) | Webpages: brokerage office **telephone number** in wording as large as predominant text (b)(2) | Cornell LII N.J.A.C. 11:5-6.1 | HIGH |
| **OH** | Brokerage name "at least in **equal prominence** with the name of the salesperson in all advertising" (1301:5-1-02(B)) | Equal prominence | Not mentioned | — | (not addressed separately) | Internet: brokerage name on every viewable page (D). Limited-character social/electronic messages may "provide a direct link to a display" with full disclosure (D)(1) | codes.ohio.gov 1301:5-1-02 | HIGH |
| **CA** | Responsible broker's identity on first-point-of-contact solicitation materials (B&P 10140.6(b)(1)) | Team name ads: broker identity "as prominently and conspicuously as the team name" (B&P 10159.7) | **Required**: name + 8-digit license ID on first-contact materials incl. "electronic media" (10140.6(b); 10 CCR 2773). Type size "no smaller than the smallest size type used" (2773) | Must disclose licensed status (10140.6(a)) | No terms implying an entity independent of the broker (10159.7) | Electronic ads the licensee places/controls are covered (2773) | leginfo 10140.6; Cornell 10 CCR 2773; Walsworth summary (10159.7) | HIGH (10140.6, 2773) / MEDIUM (10159.7) |
| **NY** | Must name the broker/brokerage **and** either the brokerage's full address **or** telephone number (19 NYCRR 175.25(c)(1)). When an agent or team is named, brokerage name must also appear (c)(2) | — | Not required | **Must "correctly and accurately state the type of license held"**. "sales associate", "licensed sales agent", or bare "broker" are **prohibited** (c)(4) | Must use the word "team". "associate", "realty", "group" prohibited. Either include licensees' full names or be followed by "at/of [brokerage]" (e)(1) | Every website page carries the info (d)(3)(ii). Initial emails carry it (d)(4). No link-out allowance found | DOS PDF of §175.25 (read in full) | HIGH |
| **TX** | Name of license holder or team **and** broker's name "in at least **half the size** of the largest contact information" (22 TAC 535.155(a)) | Half-size rule | Not required | — | Team name must end in "team" or "group" (535.154(c)(2)). No "brokerage", "company", "associates" (535.155(d)(5)) | Social/text: required info "may be located on a separate page or on the account user profile page" reachable by direct link (535.155(c)) | Cornell LII 535.154, 535.155 | HIGH |
| **Generic default (all other states + NAR members)** | NAR SOP 12-5: firm name "in a reasonable and readily apparent manner either in the advertisement or … via a link" | — | Include if provided (CA-safe) | Include if provided (NY-safe) | "{Team} at {Brokerage}" | Inline (never rely on the link allowance) | NAR 2026 Code of Ethics Art. 12, SOP 12-5 | HIGH |

**Design consequences (prescriptive):**

1. **One union format satisfies all six states inline.** Recommended disclosure line for social posts and listing descriptions:
   `{Brokerage} · {Agent licensed name}, {License type} · Lic. #{number} ({ST}) · {Brokerage phone}`
   plus, when a team name exists: `{Team name} at {Brokerage}` in place of the bare brokerage. Brokerage comes **first**. In plain text that is the only "more prominent" lever NJ allows, and it satisfies OH equal prominence and TX half-size trivially, since text is uniform. Phase 8's locked format is `"{Name}, License #{num} ({ST}), {Brokerage}"`. Phase 9 should add a `format: 'inline-ad'` variant in the composer rather than changing Phase 8's email-footer format. **Decision for the planner:** keep Phase 8's composer API and add `composeDisclosure(profile, { variant: 'ad-inline' | 'ad-block' | 'print' })`.
2. **Profile fields Phase 8 lacks** (Phase 8 UI-SPEC §Your details lists name, brokerage, license #, license state, phone, email, website, postal address):
   - `licenseType` (select: Salesperson / Associate Broker / Broker / Sales Associate (FL) / Other text). Needed for NY (c)(4) and NJ titles. NY prohibits "sales associate" and bare "broker", so a NY profile must not use those. Validate per state.
   - `teamName` (optional). Validate: NY requires the word "Team" and forbids "group"/"realty"/"associate". TX requires ending in "team"/"group". FL forbids the entity words listed above. Show warnings, not hard blocks, since the agent is the advertiser of record.
   - `brokeragePhone` (optional). NY (c)(1) needs the brokerage address **or** phone. NJ webpages need the brokerage office phone. Phase 8's `phone` is the agent's own number. NY (c)(7) says other numbers must be labeled ("cell", "desk").
   - **Recommendation:** Phase 8 has not executed. The orchestrator should push these three optional fields into the Phase 8 plan. If Phase 8 ships without them, Phase 9 Wave 0 adds them with a Dexie version bump and a backup-schema update.
3. **Never rely on the OH/TX "link to compliant display" allowance.** IG/FB/LinkedIn all have room for an inline line, and NY/NJ have no link allowance.
4. **Print report (Market Snapshot)** prominence rules, rendered in CSS:
   - Brokerage name font size **≥** agent name and team name (NJ: larger or more prominent. OH: equal. FL/CA: team name not larger than brokerage. TX: ≥ half of the largest contact info). Rule: `brokerageSize >= max(agentNameSize, teamNameSize)`.
   - License number in a size **no smaller than the smallest text on the page** (10 CCR 2773). Use one minimum size (Label 14px) for all fine print, including the license line.
   - Brokerage name placed adjacent to the contact block (FL 61J2-10.025(3)(a)).
5. **Guarantee language is a hard no.** "Advertisements shall not guarantee future profits from any real estate activity" (NY 175.25(c)(10)). NAR Art. 12 requires "a true picture". Add a studio-scoped `advertising` lexicon category (warn/block) for "guaranteed", "will appreciate", "can't lose", "#1 agent", "top producer" (unsubstantiated superlatives). It mirrors the Phase 2 banned-terms list but runs on **generated** text through the Phase 5 checker.

### B. Platform character and hashtag limits (for STU-02)

| Platform | Hard text limit | Visible before "more" | Hashtags | Source | Conf. |
|---|---|---|---|---|---|
| Instagram caption | 2,200 characters | ~125 | **Max 5 per post/Reel** (since December 2025; extras ignored) | Digital Trends; multiple 2026 guides citing Mosseri/@creators | MEDIUM-HIGH (multiple consistent sources, no official help page fetched) |
| LinkedIn post | 3,000 characters | ~210 desktop / ~140 mobile | No hard cap. Recommend 0-3 | Multiple 2026 guides | MEDIUM |
| Facebook post | 63,206 characters | ~125 mobile | No cap. Recommend 0-2 | Multiple 2026 guides | MEDIUM |

**Counting rule:** count with `text.length` (UTF-16 code units). It is ≥ the grapheme count, so a post under the limit by `.length` is under the limit however the platform counts emoji. Platforms' exact counting is undocumented (LOW). Being conservative avoids rejection.

**Hashtag strategy (Claude's discretion → recommendation):** the IG hashtag block has ≤5 tags, generated from **non-people** topics only: the city/area name the agent typed, property type, and generic real-estate tags (e.g. `#JustListed`, `#{City}RealEstate`, `#OpenHouse`). LinkedIn gets ≤3 at the end. FB gets ≤2. Code enforces the caps by truncating the tag list (never the body). Every hashtag is also run through the Fair Housing checker (e.g. `#FamilyHome`, `#SafeNeighborhood` must flag).

### C. NY AI Transparency in Advertising Act (GBL §396-b, effective 2026-06-09)

- **Scope:** a person who "produces or creates an advertisement" for a commercial purpose in any medium must "conspicuously disclose" that a **synthetic performer** is in the ad, when they have actual knowledge of its use. [Cooley 2026-01-29; Croke Fairchild 2026-08; MEDIUM-HIGH, consistent across firms]
- **Synthetic performer:** a digitally created asset (generative AI or *any* software algorithm) intended to create the impression of an **audiovisual and/or visual performance** by a human who is **not recognizable as any identifiable natural performer**.
- **Not covered:** audio-only ads, pure language translation of a real performer, expressive works, and media/platforms that only disseminate. A **digital replica of an identifiable real person** (e.g. the agent's own AI avatar clone) appears to fall outside §396-b's definition. It is still a deception/platform-labeling issue, and the conservative checklist says to disclose anyway.
- **Penalties:** $1,000 first violation, $5,000 each subsequent. "Conspicuous" is undefined, so follow FTC clear-and-conspicuous practice (on-screen, near the performer, readable duration).
- **Platform rules (separate from law):** Meta requires creators to disclose photorealistic video or realistic audio that was digitally created/altered (the "AI info" label). YouTube and TikTok have similar toggles. [About Meta 2024-04; 2026 guides; MEDIUM]
- **Reach:** any ad distributed into New York. A nationwide tool must assume coverage (PITFALLS.md P15).

### D. FTC endorsement and "results" rules (for STU-03)

- 16 CFR 255.2: consumer endorsements are read as showing typical results. "Results not typical" disclaimers are insufficient. Claims need substantiation. [Cornell LII 16 CFR 255.2, HIGH]
- 16 CFR Part 465 (Consumer Reviews and Testimonials Rule, effective 2024-10-21): prohibits fake reviews/testimonials, including those by someone who doesn't exist (AI-generated) or who had no actual experience. Civil penalties apply per violation, inflation-adjusted. [FTC final rule PDF; Cornell part 465; HIGH for existence/scope, MEDIUM for current dollar amount]
- NAR Art. 12 ("true picture"), NY 175.25(c)(10) (no guaranteed profits).
- **Design consequence:** the reel prompt receives only the agent's typed results. When results are empty, the script carries a literal placeholder (`[Add a real result you can document]`) and the numeric post-check's allowed set is **only numbers the agent typed**. The model is told it may not write client quotes. The checklist reminds agents that client quotes need a real client's permission.

### E. Fair Housing hot-spots for listing descriptions (STU-01 lexicon additions)

The Phase 5 lexicon is the base, anchored to 42 U.S.C. §3604(c) and 24 CFR 100.75. HUD's 2024 AI advertising guidance was withdrawn (Federal Register 2026-04-06). Do not cite it. The Achtenberg memo (1995) remains the de facto guide. Its explicit **safe harbor** examples matter for avoiding false positives:

| Achtenberg memo says NOT a violation (do **not** block) | Source |
|---|---|
| "master bedroom", "rare find", "desirable neighborhood" | memo (race/sex) |
| "apartment complex with chapel", "kosher meals available" (facility/service descriptions) | memo (religion) |
| "great view", "fourth-floor walk-up", "walk-in closets", "jogging trails", "walk to bus-stop" | memo (handicap) |
| "two bedroom", "cozy", "family room", "no bicycles allowed", "quiet streets" | memo (familial status) |

Source: memo text quoted in the M1 Systems Fair Housing advertising page (secondary; original memo PDF linked from FHCCI). MEDIUM.

**Recommended additions for listing copy** (each `{phrase|regex, category, severity, explanation, alternative, source}`). Severity follows Phase 5: block disables exits, warn requires acknowledgement.

| Pattern (examples) | Category | Severity | Alternative | Basis |
|---|---|---|---|---|
| "perfect/ideal/great for (families\|couples\|singles\|young professionals\|retirees\|students\|empty nesters)" | familial status / age (state) | block | Describe the space: "three bedrooms and a fenced yard" | 24 CFR 100.75(c)(1); Achtenberg (adults only, couples) |
| "family-friendly", "kid-friendly", "family neighborhood", "#FamilyHome" | familial status | block (in neighborhood context) / warn (alone) | "near {park name}", "fenced yard" | same |
| "no children", "adults only", "mature (person\|couple)" | familial status | block | Remove; HOPA communities need the agent's confirmation | §3604(c); HOPA exemption |
| "55+", "senior community", "active adult" | age/familial (HOPA) | warn (+ "I confirm this is a qualified housing-for-older-persons community") | Keep only if HOPA-qualified | 42 U.S.C. §3607(b) |
| "safe (neighborhood\|area\|street)", "low crime", "crime-free", "up-and-coming", "transitional", "gentrifying" | steering / race proxy | warn | Name verifiable amenities: "streetlights", "gated entry" (property features) | 24 CFR 100.75; PITFALLS P4 |
| "exclusive", "private community", "restricted", "integrated", "traditional neighborhood" | catch words (rescinded Part 109 list, still cited) | warn | "gated community" (feature), or remove | 24 CFR Part 109 (rescinded 1996, HUD still treats as guidance) |
| "(great\|top-rated\|best\|good) schools", "school district" evaluations | race proxy / steering | warn | Omit, or "School information: {district name}, verify with the district" | PITFALLS P4; CONTEXT bans schools in amenity form |
| "Christian\|Catholic\|Jewish\|Muslim (home\|community\|neighborhood)", "walking distance to (church\|synagogue\|mosque\|temple)" | religion | block (community/home) / warn (walking distance to a house of worship) | "near {named landmark}". The memo allows a facility description, but the amenity form excludes houses of worship | Achtenberg religion section |
| "handicapped", "wheelchair-bound", "able-bodied", "must be able to climb", "no wheelchairs", "not suitable for (disabled\|handicapped)" | disability | block | "step-free entry", "elevator", "grab bars", "first-floor bedroom" (features are fine) | §3604(c), (f) |
| "English (only\|speaking)", "(Hispanic\|Asian\|white\|Black\|ethnic) (neighborhood\|area)", "no Section 8", "no vouchers", "(professionals\|employed) only" | national origin / race / source of income (state) | block | Remove; describe income criteria only via the landlord's lawful policy, not in ads | §3604(c); state SOI laws (tag `state`) |
| "bachelor pad", "man cave", "she shed", "mother-in-law suite", "nanny's quarters" | sex / familial | warn (low-risk; many lists flag) | "bonus room", "in-law suite" → "accessory suite" / "guest suite" | state association lists (paraphrased) |
| "guaranteed", "will appreciate", "can't lose", "best investment", "#1 agent", "top producer" | advertising (non-FHA) | block (guarantee) / warn (superlatives) | Remove, or substantiate | NY 175.25(c)(10); NAR Art. 12 |

**Do not flag:** "master bedroom" (memo safe harbor; offering "primary bedroom" as a style suggestion is optional and not a finding), "walk-in closet", "walk to transit", "family room", "quiet street", "cozy", "desirable", "wheelchair accessible entrance". These belong in the ≥30 neutral-phrase test set so false positives fail the build.

**Input-side checks:** the listing form's free-text fields (extra features, area amenities) run through `useFairHousing` **before** send, as warn-only with an inline note. That stops a protected-class descriptor from becoming prompt context. The amenity checklist offers transit, parks, shops, dining, trails, waterfront, and commuting routes. **No** schools, houses of worship, crime, or demographics (CONTEXT).

### F. Equal Housing Opportunity statement and logo

- HUD's Fair Housing Advertising guidance (former 24 CFR Part 109, removed from the CFR in 1996 but still treated by HUD as guidance) says residential real estate advertising **"should contain an equal housing opportunity logotype, statement, or slogan."** [fhcci copy of rescinded Part 109; M1 Systems summary; MEDIUM]
- The logo is widely distributed free (NAR offers JPG/EPS/PNG downloads). As a work of the U.S. government it is very likely public domain (17 U.S.C. §105). No official HUD license statement was found (LOW-MEDIUM).
- **Recommendation:** the snapshot toggle defaults **ON** and renders the text statement **"Equal Housing Opportunity."** (Phase 2's footer already uses that text). Do **not** ship a logo image in v1. It adds an asset, CSP and print concerns, and a provenance question for no compliance gain. Record the logo as a follow-up.

## Architecture Patterns

### Recommended Project Structure
```
packages/core/src/studio/
├── disclosure-format.ts      # formatDisclosure(profileDisclosure, variant), appendWithBudget(), PLATFORM_LIMITS
├── team-name.ts              # validateTeamName(name, state) -> warnings
├── social-sections.ts        # parseSocialPack(text) -> {instagram, facebook, linkedin, hashtags[]} | errors
├── reel.ts                   # REEL_TEMPLATE (beats + seconds), parseReel(text), estimateSpokenSeconds(), timeBeats()
├── listing-facts.ts          # Zod-mini schema for facts; allowedNumbersFromFacts(); FEATURE_VOCAB
├── unsupported-claims.ts     # findUnsupportedFeatures(text, facts) -> findings (warn)
├── snapshot-metrics.ts       # buildSnapshotMetrics(marketStats, sample?) -> SnapshotMetrics (pure)
├── snapshot-facts.ts         # snapshotAllowedNumbers(metrics) + factsForPrompt(metrics)
└── *.test.ts
packages/core/src/numbers/    # IF Phase 7 put the number check in features/investor, MOVE the pure part here
apps/web/src/lib/ai/prompts/studio/
├── listing.v1.ts  social.v1.ts  reel.v1.ts  snapshot.v1.ts   # {id, version, system, render(input), maxTokens, guardrails, sample(input)}
apps/web/src/lib/features/studio/            # NEW feature module (see Pitfall 7)
├── StudioHub.svelte  ListingStudio.svelte  SocialStudio.svelte  ReelStudio.svelte
├── SnapshotBuilder.svelte  SnapshotReport.svelte  AiDisclosureChecklist.svelte  PlatformCard.svelte
apps/web/src/routes/(app)/agent/studio/
├── +page.svelte  listing/+page.svelte  social/+page.svelte  reel/+page.svelte  snapshot/+page.svelte
apps/web/src/routes/(print)/print/snapshot/+page.svelte     # ?id= read in onMount; 0 calls
```

### Pattern 1: Feature boundary. Studio is its own feature module
**What:** Phase 8 asserts that `features/agent` never imports the RentCast gateway and that `/agent/*` spends zero calls. The snapshot *must* call `gateway.marketStats`. Put all studio code in `features/studio/`, which may import `features/shared/markets` (and through it the gateway). `features/agent` stays gateway-free.
**When:** Always. Update the Phase 8 test's wording/scope from "no `/agent/*` view" to "no `features/agent/**` module", and add the inverse rule that `features/studio` never imports `features/agent/crm` or leads (profile access goes through a shared profile repo).
**Also:** Phase 8 hid `DataStatusBar` on `/agent/*` and noted that "Phase 9 re-enables it for `/agent/studio/*`". Do that only on `/agent/studio/snapshot/` (the only route that can spend calls) or on all studio routes. Recommend **snapshot route only**, so listing/social/reel don't show a meter for a resource they never use.

### Pattern 2: Facts-only prompts (structured input → constrained output)
**What:** Each prompt module renders a fixed system prompt plus a **JSON facts block**. Free text is fenced and labeled as agent-supplied. Output format uses explicit section markers. The prompt registry prepends the Phase 5 property-not-people fragment.

```ts
// apps/web/src/lib/ai/prompts/studio/listing.v1.ts  (shape follows ARCHITECTURE.md prompt modules)
export const listingV1 = {
  id: 'studio/listing', version: 1, maxTokens: 700,
  system: [
    PROPERTY_NOT_PEOPLE,                       // Phase 5 fragment
    'Write a real estate listing description using ONLY the facts in <facts>.',
    'Do not add any feature, amenity, number, measurement, date, or price that is not in <facts>.',
    'Use numerals exactly as given. Do not round, convert, or estimate.',
    'Never describe who should live here, the neighbors, schools, safety, crime, religion, or demographics.',
    'Never promise value, appreciation, or returns. No superlatives like "best" or "#1".',
    'Do not write a disclosure, license number, brokerage name, or hashtags; they are added separately.',
    'Output plain text only. No headings, no markdown, no emoji.'
  ].join('\n'),
  render: (i: ListingFacts) =>
    `<facts>\n${JSON.stringify(pickListingFacts(i), null, 2)}\n</facts>\n` +
    `Tone: ${i.tone}. Length: about ${LENGTH_WORDS[i.length]} words.`,
  sample: (i: ListingFacts) => sampleListingText(i)   // templated from inputs so checks pass in demo
};
```
- `social.v1` output contract:
  ```
  === INSTAGRAM ===
  <body, ≤ {igBudget} characters>
  === INSTAGRAM HASHTAGS ===
  #Tag1 #Tag2 (max 5)
  === FACEBOOK ===
  <conversational body, ≤ {fbBudget}>
  === LINKEDIN ===
  <professional body, ≤ {liBudget}, no hashtags>
  ```
  Budgets are computed in code (`limit − disclosure.length − hashtagBlock.length − 2 newlines − safety 40`) and passed in the prompt.
- `reel.v1` output contract: six `=== BEAT: hook|pain|before_after|results|mission|cta ===` sections, each with `VO:`, `CAPTION:`, `BROLL:` lines. **The model never writes times.** Code assigns them (Pattern 6).
- `snapshot.v1`: input is `factsForPrompt(metrics)`, a flat list of `label: formatted value` lines produced by the **same formatter** the report uses. The prompt says "Every number you write must be copied from <facts> exactly as written. Write 2-3 short paragraphs: what the numbers show for buyers, for sellers, for renters. No predictions, no advice, no 'good time to buy/sell'."

### Pattern 3: Disclosure appended by code with a character budget
```ts
// packages/core/src/studio/disclosure-format.ts
export const PLATFORM_LIMITS = { instagram: 2200, linkedin: 3000, facebook: 63206 } as const;
export const HASHTAG_CAPS   = { instagram: 5, linkedin: 3, facebook: 2 } as const;

export function assemblePost(platform: Platform, body: string, tags: string[], disclosure: string) {
  const capped = tags.slice(0, HASHTAG_CAPS[platform]);
  const tagBlock = capped.length ? `\n\n${capped.join(' ')}` : '';
  const tail = `\n\n${disclosure}`;                      // disclosure is ALWAYS last and never truncated
  const text = `${body.trimEnd()}${tagBlock}${tail}`;
  const over = text.length - PLATFORM_LIMITS[platform];   // UTF-16 length: conservative
  return { text, length: text.length, limit: PLATFORM_LIMITS[platform], over: Math.max(0, over), droppedTags: tags.length - capped.length };
}
```
- The Fair Housing checker runs on `body + tagBlock` (the disclosure is excluded, matching Phase 8's `footer` semantics).
- When over the limit, Copy for that card is gated with the reason "{n} characters over Instagram's limit. Shorten the post." The body is **never silently truncated**, since that could cut a sentence mid-claim. Use Phase 8's per-exit `gate` prop.
- Listing description: disclosure appended via Phase 8's `footer` prop (`ad-block` variant). The MLS remarks field often has a site-specific limit. Offer an optional "Character limit for your listing site" number input that drives a counter only.

### Pattern 4: Numeric post-check reuse (facts-only enforcement)
**What:** Phase 7 defines the memo number check as a `PostCheck` passed to `GenerationPanel.postChecks`, producing `block` findings ("Number not in your analysis"), with tolerant formatting (`$1,850` = `1850` = `$1.85k` at display precision; `6.4%` = 6.4). Phase 9 reuses it with **different allowed sets** and **feature-specific category labels**:

| Feature | Allowed set | Category label |
|---|---|---|
| Listing | every numeric fact typed (beds, baths, sqft, year built, lot size, garage spaces, price/HOA if entered) + numbers inside typed free text | "Number not in your facts" |
| Social | listing facts if the pack is generated from a listing, else numbers in the agent's typed brief | "Number not in your brief" |
| Reel | numbers inside the agent's story/results fields only | "Number you didn't provide" |
| Snapshot narrative | `snapshotAllowedNumbers(metrics)`: every displayed stat, the derived changes computed in code, the zip, bedroom counts 1-5 (labels), month/year labels in range, history length ("12 months") | "Number not in this report" |

**Boundary fix:** if Phase 7 implements the extractor and matcher inside `features/investor/memo/`, Phase 9 cannot import it (feature boundary). Plan a Wave-0 task: *move the pure extractor/matcher to `packages/core/src/numbers/` (or confirm Phase 7 put it there) and keep `MemoNumberCheck` as a thin investor adapter.* The panel-level `PostCheck` type is already shared.

**Spelled-out numbers:** prompts require digits. The post-check also flags number words above ten ("eleven", "twenty", "hundred", "thousand", "million", "dozen", "percent" not after a numeral) as warn. Otherwise "rents rose twelve percent" slips through.

### Pattern 5: Unsupported-feature check (listing)
A deterministic warn-level `PostCheck`. `FEATURE_VOCAB` is ~60 common listing terms (pool, garage, fireplace, hardwood, granite, quartz, stainless, view, waterfront, basement, deck, patio, balcony, solar, EV charger, in-unit laundry, central air, walk-in closet, vaulted ceilings, renovated/updated, new roof…) mapped to synonyms. Any vocab hit in the output whose concept isn't in the selected features or free-text facts becomes a **warn** finding: "Not in your facts: 'fireplace'. Remove it or add it to your facts." This is the facts-only guard numbers can't provide. Conf: MEDIUM (heuristic; its value is catching the common hallucinations).

### Pattern 6: Reel timing is code-owned
```ts
// packages/core/src/studio/reel.ts
export const REEL_TEMPLATES = {
  30: [['hook',0,3],['pain',3,8],['before_after',8,15],['results',15,21],['mission',21,26],['cta',26,30]],
  60: [['hook',0,3],['pain',3,12],['before_after',12,25],['results',25,40],['mission',40,52],['cta',52,60]],
} as const;
export const WORDS_PER_SECOND = 2.5;                    // ~150 wpm conversational VO
export const estimateSpokenSeconds = (vo: string) => vo.trim().split(/\s+/).filter(Boolean).length / WORDS_PER_SECOND;
// timeBeats(parsed, 60) -> beats with start/end + overrun warnings ("Voiceover runs ~2s long for this beat")
```
- Hook is always 0-3s (CONTEXT). Offer 30s and 60s. IG Reels allow longer, but founder-story reels are short.
- **Results beat:** if the agent's results field is empty, the prompt is told to output exactly `[Add a real result you can document]` as the VO and caption. Code verifies the literal is present and that the beat contains no digits. Otherwise a `block` finding results.
- Captions: on-screen text ≤ 42 characters per line (a common caption convention, LOW). Code wraps and warns, it doesn't truncate.
- Exports: Copy gives a plain-text script with a timecode table (`0:00-0:03 HOOK …`). The checklist is included in the copy as a separate section (outside the checker scope, like a footer).

### Pattern 7: Market Snapshot = frozen record + 0-call print route
```ts
// Dexie table `snapshots` (backup-registered)
type SnapshotRecord = {
  id: string; zip: string; createdAt: string;
  source: 'rentcast' | 'sample'; fetchedAt: string;              // provenance from the gateway row
  metrics: SnapshotMetrics;                                       // computed by core, frozen
  listingsSample?: AggregatedSample;                              // counts/price bands only, no addresses
  narrative?: { text: string; artifactId: string; status: 'draft'|'acknowledged' };
  options: { eho: boolean; tranFooter: boolean; sections: SectionKey[] };
};
```
- **Builder** (`/agent/studio/snapshot/`): pick a zip from watched zips (`features/shared/markets`) or type one. `CostLabel` shows `(0 calls · cached)` / `(1 call)`. "Include active listings summary (1 call)" is an opt-in checkbox. The gateway confirm flow applies (`CapConfirmDialog`). Max spend per new snapshot: **2 calls**. Cached zip without sample: **0**.
- **Canonical request:** the snapshot must call exactly the same `gateway.marketStats(zip)` as Phase 7 dashboards (same `dataType=All`, same `historyRange`), so a zip the investor watched is a cache hit. **Do not pass different params.** RentCast `/v1/markets` returns `saleData` + `rentalData` (average/median price/rent, per-sqft, DOM, `newListings`, `totalListings`, `dataByBedrooms`, `dataByPropertyType`, monthly `history`) in one request. [developers.rentcast.io market-statistics, HIGH]
- **Print route** reads `?id=` in `onMount`, loads the record, and renders `PrintReport`. It **never imports the gateway** (asserted by test). A missing id renders a not-found state with a link back.
- **Sections (chart selection, Claude's discretion):** (1) Key figures `<dl>`: median rent, median list price, price-to-rent, median DOM (sale and rental), total/new listings. (2) `ZipTrendChart` (rent by bedroom). (3) `PriceToRentChart`. (4) Table: rent by bedroom (median, listings counted). (5) Table: days on market + inventory (sale vs rental). (6) Optional listings summary (count by bedroom, price range by bedroom, median DOM). (7) Narrative. (8) Agent contact block + disclosure. (9) EHO statement. (10) Data sources + Important (shell). Do not add a DOM chart or inventory chart (Phase 7's cut line is two charts; tables carry those values).
- **Branding:** read only `effectiveBrandColors()` (Phase 8 contract). Primary (white-on-color ≥ 4.5:1, so color-on-white text is also ≥ 4.5:1) → `h1` color and the header rule. Accent → header band behind espresso text. Charts keep Tran series tokens: they are already contrast- and dash-verified, and agent colors would break the never-color-alone and series-contrast guarantees. Phase 7 print CSS omits `print-color-adjust: exact`. Add it **only** to `.brand-band` so the agent's band prints. Text in the band passes contrast whether or not the fill prints.
- **Logo:** blob → `URL.createObjectURL` (CSP `img-src 'self' blob:` from Phase 8 Planner Note 1). Before enabling Print: `await img.decode()` and `await document.fonts.ready`. Revoke the URL on destroy. SVG logos render only via `<img>` (no script execution in image context), never inline.
- **Required labels:** short header disclaimer = "Market information only — not a CMA or appraisal." `disclaimerFull` = "This report summarizes listing-based market statistics from RentCast as of {date}. It is not a comparative market analysis (CMA), an appraisal, or a valuation of any property, and it is not investment, legal, or tax advice. Figures are estimates from listings data and may not include every property." The Tran footer ("Prepared with Tran Real Estate Tools") is removable. **The disclaimer, data-sources line, as-of date, sample watermark, and disclosure are not removable.**
- **Sample mode:** fixture stats + Avery Sample profile when no profile exists. The `PrintReport` `sample` chip plus a repeated "Sample data, not a real market" line in the page header. `position: fixed` elements repeat on every printed page in Chromium. Verify in Firefox/Safari (LOW) and fall back to a per-section note if needed.

### Anti-Patterns to Avoid
- **Letting the model write the disclosure, license number, timings, or hashtags count.** Code owns every compliance-critical string.
- **Listing addresses or photos from RentCast active listings in the snapshot.** That advertises other brokers' exclusive listings (Pitfall 8).
- **Reading live cache in the print route.** The cache expires (market stats TTL 30d), so the printed report would change or need a call. Freeze the metrics in the record.
- **Calling the gateway from `$effect`** (Phase 4 rule). Builder fetches only on button press.
- **Importing `features/investor` or `features/agent/crm` from `features/studio`.** Use `features/shared` or `packages/core`.
- **`{@html}` of model output** (Phase 5 lint rule). Section parsers return plain strings.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Streaming, stop, three exits, findings UI | A studio-specific generator panel | Phase 5 `GenerationPanel` (+ `postChecks`, `footer`, per-exit `gate`) | Exit gating and the "exactly three exits" test already exist |
| Fair Housing scanning | Regexes inside studio components | Phase 5 lexicon + `useFairHousing`. Add entries to the lexicon data | One audited list; mutation-tested |
| Number checking | A second numeral extractor | Phase 7's extractor/matcher (moved to core if needed) | Tolerant formatting is subtle (k-suffix, %, ranges, U+2212) |
| PDF generation | pdfmake/jsPDF/html2canvas | `PrintReport` + `print.css` + `window.print()` | Locked pipeline; vector, selectable text |
| Charts | New LayerChart configs | `ZipTrendChart`, `PriceToRentChart`, `ChartFigure print` | Contrast/dash/table fallbacks already specified |
| Contrast math / brand fallback | New contrast code | `effectiveBrandColors()` (Phase 8) + `contrastRatio()` (Phase 2) | A failing color must never reach output (Phase 8 test) |
| Disclosure composition | String concatenation in components | Phase 8 composer + new `variant` | Single tested source; presence test |
| Market stats fetch/cost/cap | `fetch` to RentCast | `DataGateway.marketStats`, `estimateCost`, `CapConfirmDialog` | Budget, cache, provenance |

**Key insight:** every compliance property in this phase (disclosure present, no invented numbers, no protected-class language, no sample data passed off as real) must be enforced by deterministic code that the model can't skip. Prompts reduce the findings rate. Code guarantees the outcome.

## Common Pitfalls

### Pitfall 1: Over-blocking memo-safe phrases
**What goes wrong:** the lexicon flags "master bedroom", "family room", "walk-in closet", "walk to bus stop" and agents learn to ignore the checker.
**How to avoid:** put the Achtenberg safe-harbor phrases in the neutral test set. Use warn (not block) for context-dependent terms.
**Warning signs:** sample fixture listings need acknowledgements to copy.

### Pitfall 2: Disclosure truncated or pushed past the platform limit
**What goes wrong:** the model fills 2,200 characters and the appended disclosure overflows, or code trims the end and cuts the disclosure.
**How to avoid:** pass the computed budget to the prompt, append the disclosure last, never truncate, and gate Copy when over. Run a property test: for any body length, `text.endsWith(disclosure)`.

### Pitfall 3: Instagram 30-hashtag assumption
**What goes wrong:** the 30-tag guidance is outdated. Since December 2025 IG uses the first 5 and ignores the rest.
**How to avoid:** `HASHTAG_CAPS.instagram = 5`, enforced in code, with a test.

### Pitfall 4: Fixture (keyless) outputs fail their own checks
**What goes wrong:** the Fixture provider streams canned text that mentions numbers or features the demo user changed, so the numeric/unsupported checks block Copy in demo mode.
**How to avoid:** each studio prompt module exports `sample(input)`, a deterministic template filled from the actual inputs/metrics. A unit test runs every check over `sample(fixtureInput)` and expects zero block findings. Extend Phase 5's Fixture provider to call `prompt.sample?.(input)` when present.

### Pitfall 5: Fabricated results or client quotes in the reel
**What goes wrong:** the LLM writes "I helped 47 families…" or a client quote.
**How to avoid:** the allowed-number set is the agent's own text. The empty-results placeholder rule. The prompt forbids quotes. Warn-lexicon entries for `"…" said|says` patterns and "my clients say". The checklist line about client permission.

### Pitfall 6: Checklist reads as legal advice or as a guarantee of compliance
**How to avoid:** use plain language with "if/then" framing, cite the law by name only, and end with "This checklist is a reminder, not legal advice." Use no "you are compliant" or "approved" states. Checkboxes are local, unsaved, and informational.

### Pitfall 7: Snapshot breaks the Phase 8 "agent spends zero calls" invariant
**How to avoid:** use the `features/studio` module (Pattern 1). Amend the Phase 8 test scope explicitly in the plan. Show `DataStatusBar` only on the snapshot builder.

### Pitfall 8: Advertising other brokers' listings
**What goes wrong:** an "active listings sample" shows addresses/prices of homes listed by other brokers inside the agent's branded report. NY 19 NYCRR 175.25(b)(2)(ii) and (d)(6) bar advertising a property under another broker's exclusive listing without authorization (and require "Listing courtesy of…" attribution when authorized). TX requires written authorization. Most MLS rules (e.g. CRMLS 12.8) agree.
**How to avoid:** the sample section is **aggregated only**: counts by bedroom, price range (min-max) and median by bedroom, median DOM, number of listings sampled. No addresses, no photos, no listing-agent names. This also avoids the PII the fixtures guard against.

### Pitfall 9: Prompt inputs leaking protected-class context
**What goes wrong:** the agent types "great for young families, near St. Mary's" into free text and the model faithfully reuses it.
**How to avoid:** run the checker on inputs before send (warn) and on outputs (gate). The amenity checklist excludes schools and worship.

### Pitfall 10: Banned-terms gate vs required "not a CMA or appraisal" label
**What goes wrong:** Phase 2's `scripts/lib/banned-terms-rules.mjs` bans `\bappraisals?\b` and `\btestimonials?\b`. CONTEXT extends the scan to studio static copy. The required label ("…not a CMA or appraisal") and checklist wording ("…fabricated testimonials…") fail the build. Phase 7 UI-SPEC Planner Note 5 explicitly hands this to Phase 9.
**How to avoid:** add a narrow `NEGATED_ALLOW` list in the rules module, applied by blanking exact allowed spans before matching:
```js
// scripts/lib/banned-terms-rules.mjs (addition)
export const NEGATED_ALLOW = [
  /not\s+a\s+CMA\s+or\s+(?:an\s+)?appraisal/gi,
  /not\s+(?:a\s+comparative\s+market\s+analysis\s+\(CMA\),\s+)?an\s+appraisal/gi,
  /(?:no|never|don't\s+use)\s+(?:fake\s+|fabricated\s+|AI-generated\s+)?testimonials?/gi
];
```
Tests: the allowed sentences pass, while "free appraisal", "get an appraisal", "client testimonials" still fail (non-vacuity). Scope addition: `apps/web/src/lib/features/studio/**` (UI copy), **excluding** lexicon data and prompt files under `lib/ai/**` (they must contain the banned words to detect them). Prefer phrasing around the word when possible: "client reviews or quotes" instead of "testimonials".

### Pitfall 11: Charts mis-sized in print
**What goes wrong:** LayerChart containers measure screen width. On print, the page width changes and SVGs overflow or don't re-layout before the print snapshot.
**How to avoid:** `ChartFigure print` should render at a fixed `viewBox` width (e.g. 672 = 816 − 2×72) with `width:100%; height:auto`, so scaling is pure SVG. Assert with Playwright `emulateMedia({ media: 'print' })` that no figure's `scrollWidth > clientWidth`. Conf: MEDIUM. Coordinate with Phase 7's `print` prop.

### Pitfall 12: Prerender crawler misses studio routes
**What goes wrong:** `handleUnseenRoutes: 'fail'` plus client-rendered links means `/agent/studio/*` and `/print/snapshot/` aren't discovered and the build fails.
**How to avoid:** static `<a>` links in prerendered HTML (agent nav "Studio", the studio hub cards, a "Preview a sample report" link to `/print/snapshot/?id=sample`), or list them in `prerender.entries`. Add every new route to the e2e route lists (routing, CSP, a11y, 375px).

### Pitfall 13: NY license-type wording in the sample profile
**What goes wrong:** sample/default license type "Sales Associate" or "Broker" for a NY profile violates 175.25(c)(4).
**How to avoid:** the per-state allowed-title table. The NY default is "Licensed Real Estate Salesperson". The sample profile uses a fictional state or a generic title.

## Code Examples

### Snapshot metrics (pure; numbers computed, never by the LLM)
```ts
// packages/core/src/studio/snapshot-metrics.ts
export function buildSnapshotMetrics(m: MarketStatsRow): SnapshotMetrics {
  const rent = m.rentalData?.medianRent ?? null;
  const price = m.saleData?.medianPrice ?? null;
  const ptr = rent && price ? round1(price / (rent * 12)) : null;          // same formula as Phase 7 PriceToRentChart
  const h = m.rentalData?.history ?? [];
  const first = h.at(0)?.medianRent, last = h.at(-1)?.medianRent;
  const rentChangePct = first && last ? round1(((last - first) / first) * 100) : null;
  return { zip: m.zipCode, medianRent: rent, medianPrice: price, priceToRent: ptr, rentChangePct,
           months: h.length, saleDom: m.saleData?.medianDaysOnMarket ?? null,
           rentalDom: m.rentalData?.medianDaysOnMarket ?? null,
           saleTotal: m.saleData?.totalListings ?? null, saleNew: m.saleData?.newListings ?? null,
           rentByBedroom: (m.rentalData?.dataByBedrooms ?? []).map(b => ({ beds: b.bedrooms, median: b.medianRent, n: b.totalListings })) };
}
// snapshotAllowedNumbers(metrics) => Set of every value above + zip + bedroom labels + month/year labels + metrics.months
// factsForPrompt(metrics)        => lines formatted with the SAME Intl formatters the report renders
```

### AI-disclosure checklist (static, code-rendered; plain language)
```
Before you post this video
[ ] I wrote or edited this script myself. AI helped draft it.
[ ] If the video shows a person generated by AI (an avatar or digital presenter), I add a clear on-screen note such as
    "This ad includes an AI-generated person." New York law requires this for ads seen in New York (General Business Law § 396-b).
[ ] If I use an AI copy of my own face or voice, I turn on the platform's AI label (Instagram/Facebook "AI info", YouTube, TikTok).
[ ] Every result I mention is real, mine, and something I can show records for. I don't promise future profits or appreciation.
[ ] Any client quote is real and used with that client's permission. No made-up quotes or reviews.
[ ] My brokerage name and my license details appear in the caption or on screen, as my state requires.
[ ] I describe homes and places, never the kind of people who should live there.
[ ] I have the rights to the music, footage, and photos I use.
This checklist is a reminder, not legal advice. Check your state's and brokerage's advertising rules.
```
(It avoids "testimonial" so the banned-terms gate stays clean without an allowlist.)

### Print readiness
```ts
async function printWhenReady(logo?: HTMLImageElement) {
  await document.fonts.ready;
  if (logo && !logo.complete) await logo.decode().catch(() => {});
  window.print();
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Cite HUD 2024 AI advertising guidance | Cite FHA §3604(c) + 24 CFR 100.75 + Achtenberg memo | Guidance withdrawn effective 2025-09-17 (FR notice 2026-04-06) | Docs/copy must not cite withdrawn guidance |
| Up to 30 IG hashtags | Max 5 per post/Reel | December 2025 | Cap in code |
| No AI-performer ad law | NY GBL §396-b synthetic performer disclosure | Effective 2026-06-09 | Checklist item |
| Fake reviews policed case by case | FTC 16 CFR Part 465 civil penalties | Effective 2024-10-21 | No generated client quotes |

**Deprecated/outdated:** 24 CFR Part 109 is removed from the CFR (1996). HUD still treats its content as guidance, so cite it as "former Part 109 guidance".

## Open Questions

1. **Profile fields for NY/NJ compliance (`licenseType`, `teamName`, `brokeragePhone`)**
   - Known: NY requires license type + broker address/phone. NJ requires broker phone on webpages. Phase 8 lacks these fields.
   - Unclear: whether the Phase 8 planner will add them.
   - Recommendation: push them into Phase 8. Otherwise Phase 9 Wave 0 adds optional fields + Dexie version bump + backup schema + composer `variant`.
2. **Where Phase 7's number-check core lives**
   - Recommendation: Wave-0 verification task. If it's in `features/investor`, move the pure functions to `packages/core/src/numbers/` with the investor adapter unchanged (Phase 7 tests must stay green).
3. **EHO logo asset**
   - Text-only in v1 (default ON). The logo is a later follow-up once HUD's official download/terms are verified by a human (LOW confidence on licensing statement).
4. **Repeated sample watermark in non-Chromium print engines** (LOW)
   - Recommendation: Chromium E2E only. Add a HUMAN-UAT item to print a sample report from Firefox and Safari.
5. **Exact platform character counting** (LOW)
   - Recommendation: conservative `.length`. No action unless users report false "over limit".
6. **Snapshot listings sample endpoint** (sale vs rental)
   - Recommendation: one "Active listings summary" checkbox with a sale/rental radio (default sale). It is exactly 1 call through the gateway's existing `saleListings`/`rentalListings` with the zip and the gateway's default page size. Aggregated only.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.11 (projects `core`, `web`, `scripts`, plus `brand` from Phase 2); Playwright 1.63.0 + `@axe-core/playwright` 4.13.0 |
| Config file | `vitest.config.ts` (root projects), `packages/core/vitest.config.ts`, `apps/web/vite.config.ts`, `apps/web/playwright.config.ts` |
| Quick run command | `corepack pnpm vitest run --project core packages/core/src/studio && corepack pnpm vitest run --project web apps/web/src/lib/features/studio apps/web/src/lib/ai/prompts/studio` |
| Full suite command | `corepack pnpm verify` (check, lint, banned, unit, build root/sub, csp, e2e, guard, secrets) |
| E2E only | `corepack pnpm build:root && corepack pnpm --filter web exec playwright test tests/e2e/studio.spec.ts tests/e2e/snapshot.spec.ts` |

### Phase Requirements → Test Map
| Req / SC | Behavior | Type | File | Automated command | Failure mode it catches | Exists? |
|----|----------|------|------|-------------------|------|---------|
| STU-01 / SC1 | Listing prompt renders only whitelisted facts; no schools/crime/demographic keys can enter the input schema | unit | `apps/web/src/lib/ai/prompts/studio/listing.v1.test.ts` | `corepack pnpm vitest run --project web listing.v1` | Input leakage; prompt drift | ❌ W0 |
| STU-01 / SC1 | Numbers outside the facts → `block` "Number not in your facts"; spelled-out >10 → warn; facts in any display format pass | unit | `packages/core/src/numbers/*.test.ts` (+ studio adapter test) | `corepack pnpm vitest run --project core numbers` | Fabricated sqft/price | ❌ W0 |
| STU-01 | Unsupported feature ("fireplace" not in facts) → warn; feature in facts → no finding | unit | `packages/core/src/studio/unsupported-claims.test.ts` | `… --project core unsupported-claims` | Hallucinated amenities | ❌ W0 |
| STU-01 / SC1 | Lexicon additions: ≥20 new listing-specific bad phrases flagged; Achtenberg safe-harbor phrases pass; mutation test (delete one entry → suite red) | unit | `packages/core/src/fair-housing/listing-additions.test.ts` | `… --project core fair-housing` | Over/under-blocking | ❌ W0 |
| STU-01 / SC1 | E2E keyless: fill facts → Generate (fixture) → zero block findings; type "perfect for young families" in edit → Copy disabled → Use alternative → Copy enabled; copied text ends with disclosure | e2e | `apps/web/tests/e2e/studio.spec.ts` | E2E only command | Gating regression; missing disclosure | ❌ W0 |
| STU-02 / SC2 | `assemblePost`: for each platform × each state profile (FL, NJ, OH, CA, NY, TX, generic) the output ends with the disclosure, the disclosure is unmodified, length ≤ limit or `over>0` reported, IG tags ≤5, LI ≤3, FB ≤2 | unit (table + property loop) | `packages/core/src/studio/disclosure-format.test.ts` | `… --project core disclosure-format` | Truncated/missing disclosure; 30-tag assumption | ❌ W0 |
| STU-02 | State formatter: NY includes license type + brokerage phone/address; CA includes license #; brokerage first; NY rejects "Sales Associate"/"Broker" titles; team validator per state | unit | `packages/core/src/studio/disclosure-format.test.ts`, `team-name.test.ts` | same | State rule regressions | ❌ W0 |
| STU-02 | `parseSocialPack`: well-formed, missing section, extra prose before the first marker, markers in different case → correct sections or explicit per-variant error | unit | `packages/core/src/studio/social-sections.test.ts` | `… --project core social-sections` | Silent empty card | ❌ W0 |
| STU-02 / SC2 | E2E: three cards, each with a character counter matching `assemblePost.length`, its own checker findings, and a Copy whose clipboard text ends with the sample disclosure; over-limit fixture → Copy gated with reason | e2e | `studio.spec.ts` | E2E only | UI wiring | ❌ W0 |
| STU-03 / SC3 | `timeBeats`: 6 beats in order, hook 0-3s, contiguous, ends at 30/60; VO overrun warns | unit | `packages/core/src/studio/reel.test.ts` | `… --project core reel` | Wrong beat order/timing | ❌ W0 |
| STU-03 / SC3 | Empty results → placeholder literal present + no digits in results beat; typed results → only those numbers allowed (others block) | unit | `reel.test.ts` + `reel.v1.test.ts` | same | Invented results | ❌ W0 |
| STU-03 / SC3 | Checklist renders all items incl. NY §396-b line + "not legal advice"; copy payload includes checklist after script | e2e + unit | `studio.spec.ts`; `AiDisclosureChecklist` content test | E2E / web unit | Missing disclosure checklist | ❌ W0 |
| STU-04 / SC4 | `buildSnapshotMetrics` on fixtures: price-to-rent and % change exact (hand-checked); nulls handled; no NaN | unit | `packages/core/src/studio/snapshot-metrics.test.ts` | `… --project core snapshot-metrics` | Bad math | ❌ W0 |
| STU-04 / SC4 | **No numbers outside the computed set:** narrative with a planted "$2,450" not in metrics → block; every number in `factsForPrompt` passes; `sample(metrics)` narrative → zero findings for every fixture zip | unit | `packages/core/src/studio/snapshot-facts.test.ts`, `apps/web/src/lib/ai/prompts/studio/snapshot.v1.test.ts` | `… --project core snapshot-facts` | Fabricated stats | ❌ W0 |
| STU-04 / SC5 (budget) | Call counts (fake-indexeddb + mocked fetch): cached zip → 0 billed; new zip → 1; new zip + listings summary → 2; second snapshot same zip → 0; params identical to the Phase 7 dashboard request key | unit | `apps/web/src/lib/features/studio/snapshot-calls.test.ts` | `… --project web snapshot-calls` | Budget overspend; cache-key mismatch | ❌ W0 |
| STU-04 | Print route spends 0: module graph of `routes/(print)/print/snapshot` has no import of `lib/data/**`; feature boundary test: `features/agent/**` never imports gateway, `features/studio/**` never imports `features/investor/**` or `features/agent/crm/**` | unit (import-graph) | `apps/web/src/lib/features/studio/boundaries.test.ts` | `… --project web boundaries` | Invariant drift | ❌ W0 |
| STU-04 / SC4 | Print E2E: `/print/snapshot/?id=sample` with `emulateMedia({media:'print'})`: toolbar hidden; text "Market information only — not a CMA or appraisal" visible; disclosure + data sources + as-of visible; EHO statement visible when on, absent when off; Tran footer toggles; sample line present; logo `naturalWidth>0` when a sample logo is set; no figure overflow | e2e | `apps/web/tests/e2e/snapshot.spec.ts` | E2E only | Missing label; broken print | ❌ W0 |
| STU-04 | Brand: failing primary/accent → Tran tokens in rendered CSS vars; passing → agent color; brokerage font-size ≥ agent name font-size | unit + e2e | `effectiveBrandColors` (Phase 8 test) + `snapshot.spec.ts` computed-style assertion | both | Unreadable brand colors; NJ prominence | partial (Phase 8) |
| STU-04 | Listings summary contains no address/street pattern or agent names (aggregated only) | unit | `snapshot-metrics.test.ts` (`AggregatedSample` keys whitelist) + `guard-real-data` on fixtures | `… --project core` + `corepack pnpm guard` | Advertising others' listings; PII | ❌ W0 |
| SC5 (banned copy) | Studio UI dirs in scope; "not a CMA or appraisal" passes; "free appraisal", "client testimonials" fail (non-vacuity); scope count includes a studio file | unit | `scripts/banned-terms.test.ts` | `corepack pnpm vitest run --project scripts banned-terms` | Gate vacuous or blocks required label | ❌ (extends Phase 2 file) |
| SC5 (axe) | axe WCAG A/AA zero violations on `/agent/studio/`, `listing/`, `social/`, `reel/`, `snapshot/`, `/print/snapshot/?id=sample`, keyless and after a fixture generation (findings visible), at 375px and 1280px, root + sub base | e2e | `apps/web/tests/e2e/a11y.spec.ts` (route list extended) + `studio.spec.ts` | E2E only | A11y regressions | ✅ modify |
| SC5 (keyless) | With no keys: every studio route renders, Generate uses the fixture provider with a "Sample output" badge, and zero requests go to any provider or RentCast host (`page.route` asserts none) | e2e | `studio.spec.ts` | E2E only | Demo breaks / leaks calls | ❌ W0 |
| SC5 (prerender) | Build passes with `handleUnseenRoutes: 'fail'`; routing spec lists new routes | build + e2e | `routing.spec.ts`, `csp.spec.ts` | `corepack pnpm build:root` | Unseen route failure | ✅ modify |
| All | No new runtime dependency | script/unit | `scripts/workflow-gate.test.ts` or a package.json snapshot assertion | `--project scripts` | Supply-chain creep | optional |

### Sampling Rate
- **Per task commit:** the quick run command (core + web studio tests, < 30 s) plus `corepack pnpm banned`.
- **Per wave merge:** `corepack pnpm vitest run` (all projects) + `corepack pnpm build:root` + the two studio E2E specs.
- **Phase gate:** `corepack pnpm verify` green on root and sub bases before `/gsd:verify-work`. Add HUMAN-UAT items: print a real-key snapshot to PDF in Chrome/Firefox/Safari; paste a social pack into a real IG/LinkedIn/FB composer to confirm counts and hashtag cap; check one NY and one CA sample disclosure against the rule text.

### Wave 0 Gaps
- [ ] Confirm or move the number-check pure functions to `packages/core/src/numbers/` (Open Question 2)
- [ ] Profile fields `licenseType`, `teamName`, `brokeragePhone` + composer `variant` (Open Question 1), if Phase 8 didn't add them
- [ ] `packages/core/src/studio/` test files listed above (disclosure-format, team-name, social-sections, reel, listing-facts, unsupported-claims, snapshot-metrics, snapshot-facts)
- [ ] Studio fixture inputs + `sample(input)` per prompt module; fixture zip stats already from Phase 4
- [ ] `scripts/lib/banned-terms-rules.mjs` `NEGATED_ALLOW` + scope addition + tests
- [ ] `apps/web/tests/e2e/studio.spec.ts`, `snapshot.spec.ts`; extend shared route list (a11y, routing, csp, viewport)
- [ ] Import-graph boundary test helper (reuse whatever Phase 8 built for "features/agent never imports gateway")

## Sources

### Primary (HIGH confidence)
- N.J.A.C. 11:5-6.1, https://www.law.cornell.edu/regulations/new-jersey/N-J-A-C-11-5-6-1 (broker name, prominence, webpage phone)
- Ohio Adm. Code 1301:5-1-02, https://codes.ohio.gov/ohio-administrative-code/rule-1301:5-1-02 (equal prominence, internet, link allowance)
- Fla. Admin. Code 61J2-10.025, https://www.law.cornell.edu/regulations/florida/Fla-Admin-Code-Ann-R-61J2-10-025 (brokerage name, adjacency)
- Cal. B&P Code §10140.6, https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=BPC&sectionNum=10140.6; 10 CCR §2773, https://www.law.cornell.edu/regulations/california/10-CCR-2773
- 19 NYCRR §175.25 (full text PDF), https://dos.ny.gov/real-estate-advertising-regulations
- 22 TAC §535.154 and §535.155, https://www.law.cornell.edu/regulations/texas/22-Tex-Admin-Code-SS-535-154 , https://www.law.cornell.edu/regulations/texas/22-Tex-Admin-Code-SS-535-155
- NAR 2026 Code of Ethics (Art. 12, SOP 12-5), https://www.nar.realtor/about-nar/governing-documents/code-of-ethics/2026-code-of-ethics-standards-of-practice
- 16 CFR 255.2, https://www.law.cornell.edu/cfr/text/16/255.2 ; 16 CFR Part 465, https://www.law.cornell.edu/cfr/text/16/part-465 ; FTC final rule, https://www.ftc.gov/system/files/ftc_gov/pdf/r311003consumerreviewstestimonialsfinalrulefrn.pdf
- RentCast market statistics endpoint, https://developers.rentcast.io/reference/market-statistics
- Project: 05-CONTEXT/UI-SPEC, 07-CONTEXT/UI-SPEC (PrintReport, ChartFigure, number check, Planner Notes), 08-CONTEXT/UI-SPEC (brand colors, disclosure format, CSP blob, footer prop), 02-RESEARCH (banned-terms rules), PITFALLS.md P4/P5/P14/P15, `apps/web/svelte.config.js`

### Secondary (MEDIUM confidence)
- NY GBL §396-b analyses: Cooley (2026-01-29) https://www.cooley.com/news/insight/2026/2026-01-29-new-york-enacts-synthetic-performer-disclosure-law-for-advertisements-including-those-using-generative-ai ; Croke Fairchild (2026-08) https://crokefairchild.com/2026/08/client-alert-new-yorks-synthetic-performer-disclosure-law-is-now-in-effect/ ; Davis+Gilbert https://www.dglaw.com/ai-legal-updates-synthetic-performer-transparency-state-federal-conflict/
- CA team names §10159.7 summary, Walsworth: https://walsworthlaw.com/news-and-insights/position-team-names-real-estate-advertising/
- Florida Realtors advertising summary (team naming, 475.2755): https://www.floridarealtors.org/law-ethics/library/realtor-advertising-rules-florida
- Achtenberg memo examples + EHO guidance summary: https://m1sys.screenstepslive.com/s/15592/m/49813/l/637698-fair-housing-logo-use-poster-advertising-rules ; rescinded Part 109 text: https://www.fhcci.org/wp-content/uploads/2018/06/HUD-Part-109-Fair-Housing-Advertising-Rescinded.pdf
- Instagram 5-hashtag cap: https://www.digitaltrends.com/social-media/instagram-now-limits-you-to-five-hashtags-per-post/ (+ several 2026 guides)
- Meta AI labeling: https://about.fb.com/news/2024/04/metas-approach-to-labeling-ai-generated-content-and-manipulated-media/
- Platform character limits (multiple 2026 guides): https://authoredup.com/blog/linkedin-character-limit , https://ferryman.io/character-limits/facebook , https://www.outfy.com/blog/instagram-character-limit/
- Advertising other brokers' listings (TX/NY/MLS): https://www.nar.realtor/sites/default/files/documents/CRMLS-Advertising-Rule-Update-2019-07-29.pdf

### Tertiary (LOW confidence)
- EHO logo licensing (no official HUD statement fetched; public-domain inference from 17 U.S.C. §105)
- Exact platform character-counting methods (emoji/grapheme)
- Caption line-length convention (42 chars)
- Repeated `position: fixed` print watermark in Firefox/Safari

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH. No new dependencies; every reused contract was read in the approved UI-SPECs.
- Architecture: HIGH for reuse/boundaries/print, MEDIUM for print chart sizing and the unsupported-feature heuristic.
- Legal-adjacent findings: MEDIUM. Primary regulation text was read for NY/NJ/OH/FL/TX/CA. NY §396-b comes from consistent law-firm analyses, not the statute text. Not legal advice.
- Pitfalls: HIGH for the banned-terms conflict, feature-boundary conflict, and IG hashtag cap (verified against code/specs/sources). MEDIUM for print-engine behaviors.

**Research date:** 2026-10-04
**Valid until:** 2026-11-03 (30 days). Re-check NY §396-b guidance/enforcement and platform hashtag/label policies before launch (Phase 10).
