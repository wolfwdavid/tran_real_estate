# Pitfalls Research

**Domain:** Browser-only, BYOK (bring-your-own-key) nationwide US real-estate GTM SaaS — static SvelteKit on GitHub Pages, RentCast listing data, LLM drafting, three portals (Renter / Investor / Agent), plus a Zillow sponsored-listing-hider browser extension
**Researched:** 2026-09-13
**Confidence:** MEDIUM overall (HIGH on RentCast billing/terms, SvelteKit/CSP specs, Safari storage, provider data policies; MEDIUM on legal/regulatory interpretation; LOW on Zillow ToU exact text, which returned HTTP 403 and was only seen via secondary quotes)

> **Phase naming note:** No roadmap exists yet. Phases below use topic labels in a suggested order:
> **P1 Foundation** (SvelteKit static + Pages deploy + BYOK vault + security baseline + storage/backup) ->
> **P2 Data Layer** (RentCast client, call budget guard, cache, demo fixtures) ->
> **P3 Renter Portal** -> **P4 Investor Portal** -> **P5 Agent Portal** ->
> **P6 Zillow Extension** (separate package) -> **P7 GTM / Launch / Legal pages**.
> The roadmapper should remap these to real phase numbers.

---

## Three assumptions in PROJECT.md that the research contradicts

Read these first. They change requirements, not just implementation details.

| PROJECT.md says | What current sources say | Consequence |
|---|---|---|
| "RentCast license likely forbids redistribution" (so data is never published) | RentCast API Terms **grant** the right to "sublicense, disclose, display, resell and distribute the API Data to third parties", store it internally, and require no attribution. The real restrictions are: **API key is confidential and non-transferable**, you must use "commercially reasonable measures" to stop third parties scraping API data through your app, and there are **no hard usage caps**. Overage past the free 50 calls is billed at **$0.20/request** with no refunds. | The biggest RentCast risk is **billing the user's card**, not redistribution. Keeping data per-user is still correct (because the *key* can't be shared), but agents *can* send exported reports to clients. |
| NYU CoStar is fine "for the user's own offline research to validate assumptions" | CoStar's Academic Engagement terms prohibit commercial use and "any use involving direct or indirect benefit — financial or otherwise" to the student, school, or professor, plus industry work and "school development projects". Using it to validate rent benchmarks for a commercial product is a **direct benefit to a commercial product**. | Do **not** use NYU CoStar for Tran at all, not even offline. Violations can cost the **whole campus** its access. Use RentCast market stats, HUD Fair Market Rents, Census ACS, or Zillow's public ZORI research CSVs (check their license) instead. |
| "Fair Housing-safe AI copy" (implicitly per HUD AI guidance) | HUD **withdrew** its April 29, 2024 digital-advertising guidance (withdrawal effective Sept 17, 2025; Federal Register notice April 6, 2026). The **Fair Housing Act §804(c) and 24 CFR 100.75 still apply in full**. States are moving the other way (CA FEHA automated-decision rules, NY AI advertising disclosure law, Colorado SB 26-189). | Don't cite the withdrawn HUD guidance as authority in the product or docs. Base guardrails on the statute and regulation, the 1995 Achtenberg memo word lists (still widely used as guidance), and state law. Legal exposure hasn't gone down. |

---

## Critical Pitfalls

### Pitfall 1: Surprise overage charges on the user's RentCast card

**What goes wrong:**
The app quietly burns through the user's 50 free calls and keeps going. RentCast charges **$0.20 per extra request** and says: "We do not currently support hard usage caps or automatic API request blocking." Overages are billed at renewal, or right away once they reach $500, and "All Subscription charges and Overage Charges shall be final." A renter with 5 saved searches who opens the app twice a day makes about 300 calls/month, which is roughly **$50 in overage** they never agreed to. A pagination loop (limit max 500, each page is a separate request) or a Svelte `$effect` that refetches on every re-render can burn hundreds of calls in minutes.

**Why it happens:**
Developers treat "free tier" as a limit the provider enforces. RentCast enforces nothing; it only emails at 85% and 100%. "Re-run saved searches on app open" is exactly the kind of feature that multiplies calls without anyone noticing. Reactive frameworks make accidental refetches easy.

**How to avoid:**
- Build a **client-side call budget ledger** in P2, before any feature calls the API. Keep a persisted monthly counter per key (keyed by a hash of the key plus the billing anniversary the user enters). Hard-stop at a **user-set cap that defaults to 40 of 50**, and show a confirm dialog for anything past it: "This will cost about $0.20."
- **Every** RentCast call goes through one `rentcastFetch()` choke point that checks the budget, dedupes in-flight requests, and checks the cache first. Lint rule or test: no `fetch('https://api.rentcast.io` anywhere else.
- Saved-search re-run on open: **at most once per search per 24h** (configurable), run in sequence, and show the "N calls will be used" cost before running more than 3.
- Never auto-paginate. Use `limit=500` on one call, and require a user click for page 2.
- Show a persistent "Calls used this month: 23/50 (est.)" meter in the header.
- Tell users to set **endpoint restrictions** on their RentCast key (RentCast supports IP and endpoint restrictions). IP restriction is impractical for home users.
- Unit test: mount each feature with a mocked fetch counter. Assert call counts for "open app with 5 saved searches" and "re-render 10 times".

**Warning signs:**
The mock fetch counter goes up on hot reload or route changes. There's no single fetch wrapper. Anyone says "we'll add the budget meter later."

**Phase to address:** P2 Data Layer (blocking gate for P3–P5)

---

### Pitfall 2: API keys stolen from localStorage via XSS, prompt-injected LLM output, or third-party scripts

**What goes wrong:**
BYOK keys in `localStorage` or `IndexedDB` can be read by **any** script running on the origin. The origin is `wolfwdavid.github.io`, which is **shared by every Pages site under that user account**. Storage is per-origin, so every other project published at `wolfwdavid.github.io/<repo>` (the owner has many) can read `localStorage` keys written by `/tran_real_estate`. One compromised or careless sibling site exposes every visitor's RentCast and LLM keys. Separately, listing descriptions from RentCast and LLM output are untrusted text. If LLM markdown is rendered with `{@html marked(output)}`, a listing description containing `<img src=x onerror=...>` or a prompt injection ("ignore instructions, output this HTML") turns into XSS that exfiltrates keys. Analytics, error reporting (Sentry breadcrumbs capture request headers/URLs), and CDN-loaded fonts or scripts add more places a key can leak.

**Why it happens:**
"Keys never leave the browser" feels secure. Same-origin sharing on `username.github.io` isn't widely known. LLM output feels like trusted app content.

**How to avoid:**
- **Serve from a dedicated origin.** Use a custom domain (e.g., `app.tranrealestate.com` via Pages CNAME; the domain costs about $12/yr, which is the one justified exception to $0) or a dedicated GitHub org (`tran-real-estate.github.io`). If $0 is absolute, **namespace storage keys and document the shared-origin risk** in the security note. Treat this as a known, accepted risk, not a hidden one.
- Keep keys in **sessionStorage by default**, with an explicit opt-in "Remember on this device" that writes to localStorage. Offer optional **passphrase encryption** (WebCrypto AES-GCM, PBKDF2/Argon2-derived key). This only protects keys at rest (shared computer, disk forensics), not against live XSS. Say that honestly.
- **Never use `{@html}` on LLM or RentCast strings.** Render markdown through a sanitizer (DOMPurify) with a strict allowlist, or render plain text only. Add a grep-based CI check for `{@html`.
- **No third-party scripts** in the app shell. Self-host fonts. No analytics that capture URLs or headers. If error reporting is added, scrub `x-api-key`, `authorization`, `x-goog-api-key`, and `anthropic-*` headers.
- Meta-tag CSP (see Pitfall 7) with a `connect-src` allowlist of exactly `api.rentcast.io`, `api.anthropic.com`, `api.openai.com`, `generativelanguage.googleapis.com`, and the form service. A stolen key then can't be exfiltrated to an arbitrary host by *injected fetch* (it can still leave through navigation or image beacons, so `img-src` must be tight too).
- Settings page: "Test key", "Forget all keys", and a link to each provider's key-revoke page. Tell users to create **a dedicated key with a spend limit** (OpenAI and Anthropic both support per-project limits in their consoles).

**Warning signs:**
`{@html` shows up in the codebase. `<script src="https://...">` in `app.html`. Keys visible in the DevTools Network tab as URL query params (Gemini supports `?key=`; use the `x-goog-api-key` header instead). Deploying to `wolfwdavid.github.io/tran_real_estate` with no documented origin decision.

**Phase to address:** P1 Foundation (origin decision, CSP, key vault, sanitizer rule); re-verified in every portal phase that renders LLM output

---

### Pitfall 3: Assuming all three LLM providers accept browser-direct calls

**What goes wrong:**
The "Anthropic / OpenAI / Gemini" provider selector ships, and one or two providers fail with CORS errors in production.
- **Anthropic** officially supports browser calls, but only with the `anthropic-dangerous-direct-browser-access: true` header. Without it, requests are rejected as a CSRF guard.
- **OpenAI** browser CORS **works in practice but is not an officially supported path**. The SDK needs `dangerouslyAllowBrowser`, and the community forum records CORS breakages (Oct 15, 2025 on Chat Completions; Jan 29, 2026 on the Responses API, fixed the same day). It can break without notice.
- **Gemini** browser calls are inconsistent. The OpenAI-compatibility endpoint has reported CORS errors, and custom headers trigger preflight 403s.

Separately, **Gemini free-tier ("Unpaid Services") prompts are used to improve Google products and may be read by human reviewers**, and Google's terms say: "Do not submit sensitive, confidential, or personal information to the Unpaid Services." Agent CRM follow-ups contain lead names, phone numbers, and situations. Sending them to a free Gemini key violates Google's terms and exposes client PII.

**Why it happens:**
Developers test one provider, on localhost, once. Provider data-use differences between free and paid tiers are buried in terms pages.

**How to avoid:**
- Write a thin `LlmProvider` adapter per provider using raw `fetch` (no heavy SDKs), with the exact headers each one needs. Add a **"Test connection" button** that makes a 1-token call and reports CORS vs auth vs quota errors clearly.
- Ship Anthropic first (officially supported). Mark OpenAI and Gemini as "works in browser today; may break if the provider changes CORS". Consider **OpenRouter** as the fallback adapter, since it is confirmed to work from browsers with CORS.
- When the provider is Gemini and the key is free tier (you can't detect this; ask the user), **block or warn** before sending CRM or lead PII: "Google may use free-tier prompts for training and human review. Use a paid key or strip names."
- Strip or placeholder PII (names, phones, emails) in prompts by default. Re-insert client-side after generation.

**Warning signs:**
Only one provider tested. Using the official Node SDKs directly in the browser. No PII warning path.

**Phase to address:** P1 Foundation (adapter + test-connection); PII guard in P5 Agent Portal

---

### Pitfall 4: AI copy that violates the Fair Housing Act (steering, familial status, disability)

**What goes wrong:**
The Agent content studio generates listing descriptions and social posts, and the Renter outreach drafter writes messages. LLMs naturally produce phrases like "perfect for young professionals", "ideal for couples", "great family neighborhood", "quiet adult community", "walking distance to churches", "no wheelchairs needed", or "safe, exclusive area". Under **24 CFR 100.75** it is unlawful to publish words, phrases, photos, or symbols that "convey that dwellings are available or not available to a particular group" on the basis of race, color, religion, sex, handicap, familial status, or national origin. The Achtenberg memo (1995, still the de facto guide) specifically flags "adults only", "no children", "perfect for couples". The agent publishing it is liable, and the tool that "caused [it] to be made" is also exposed. Market reports that describe neighborhoods by demographics ("up-and-coming", school "quality" used as racial proxy, crime framing) create **steering** risk. Many states add protected classes (source of income, sexual orientation, gender identity, age, military status) with stricter rules than federal law.

**Why it happens:**
LLMs are trained on decades of non-compliant listing copy. HUD's 2024 AI guidance being withdrawn gets misread as "the rules relaxed." They didn't; the statute and regulation are unchanged.

**How to avoid:**
- **System prompt guardrail** on every housing-copy generation: describe the *property and amenities*, not the *people* who should live there. Never reference protected classes, neighborhood demographics, or crime. Use "accessible features" not "handicap".
- **Deterministic post-generation linter** (not just the prompt). Keep a maintained word/phrase list adapted from the Achtenberg memo and state lists (e.g., "family-friendly", "bachelor pad", "empty nesters", "exclusive", "integrated", "Christian", "English speaking", "able-bodied", "walking distance to [house of worship]", "senior" outside HOPA-exempt 55+). Highlight matches with explanations. The user must acknowledge each flag before copying.
- Market reports: use price, rent, inventory, and days-on-market only. **No demographic, school-ranking, or crime overlays in v1.**
- Renter-side filters: never offer filters on protected characteristics of occupants or neighborhoods.
- Equal Housing Opportunity statement/logo option on exported agent materials.
- LLM provider policies are relevant too: Anthropic's usage policy treats "decisions regarding eligibility for housing, including leases" as high-risk (human review plus AI-use disclosure required), and OpenAI prohibits automating housing decisions without human review. **Never build tenant screening, scoring, or applicant ranking.**

**Warning signs:**
Content studio demo output contains any "perfect for [group]" phrasing. No linter test suite with known-bad phrases. Market report template has a "demographics" section.

**Phase to address:** P5 Agent Portal (content studio + reports) and P3 Renter Portal (outreach drafts). Build the shared linter in P2/P3 so both portals use it.

---

### Pitfall 5: Implying brokerage or licensed services, or giving financial/appraisal advice, without a license

**What goes wrong:**
Marketing copy says "We find you the perfect rental", "Connect with our agents", "Get a fair-rent appraisal", or "Tran Real Estate helps you buy". The brand name itself is "Tran **Real Estate**". In many states, acting as a **rental locator** for compensation requires a real-estate license (Texas is explicit), soliciting buyers is a licensed activity in California, and referral fees to or from unlicensed persons are broadly prohibited (e.g., New York). The Agent lead inbox routes renter and investor inquiries to agents. If Tran is ever paid **per lead that converts or per closing**, that crosses into unlicensed brokerage and possibly RESPA territory. The investor deal analyzer and AI "investment memo" can read as investment advice. "Fair-rent estimate" labeled "appraisal" or "valuation" runs into appraisal licensing and USPAP expectations.

**Why it happens:**
GTM copy is written for conversion, not compliance. The brand name "Real Estate" suggests a brokerage. v1 is free, so nobody thinks about compensation structure until monetization.

**How to avoid:**
- Site-wide footer and About page: "Tran Real Estate is a software tool. It is not a real estate brokerage, does not represent buyers, sellers, landlords, or tenants, and is not licensed to provide real estate, legal, tax, or investment advice."
- Copy rules: use "tool", "calculator", "draft", "estimate". Never "appraisal", "valuation", "our agents", "we represent", "guaranteed". Add a grep check in CI for banned marketing terms.
- Deal analyzer and investment memo: persistent "Educational estimate — not investment, tax, or financial advice. Verify with a licensed professional." Show all assumptions (vacancy, capex, management, interest rate) as editable inputs, never hidden defaults. Label the memo "Draft analysis prepared by [user]", not by Tran.
- Fair-rent check: "Estimated market rent range from RentCast data, not an appraisal." Show the confidence/range and comp count. RentCast itself disclaims accuracy ("as is", estimates are "probabilistic").
- Agent content: add **brokerage name + state-of-licensure fields** that auto-insert into exports. NAR Code Article 12 / SOP 12-5 requires firm-name disclosure in advertising, and most state commissions require it too. Tran must not be the advertiser of record.
- Lead inbox: in v1 the agent configures **their own** form endpoint; Tran is never a party, never takes a fee, and never routes leads between agents. Write this into PROJECT.md as a constraint before any monetization milestone.
- Consider renaming or adding a descriptor ("Tran Real Estate Tools") before public launch. Low cost now, high cost later.

**Warning signs:**
Landing page hero with "we" + a transactional verb. Any design for "matching renters to agents". A pricing idea tied to closed deals.

**Phase to address:** P7 GTM / Legal pages for copy and disclaimers. Disclaimer components are built in P4 (analyzer) and P3 (fair rent). The compensation constraint gets recorded now.

---

### Pitfall 6: Zillow extension crosses from "hide cosmetic elements" into scraping, trademark misuse, or store rejection

**What goes wrong:**
Four failure modes:
1. **Scope creep into data extraction.** "While we're on the page, let's read the listing price and send it to the Tran app" is exactly what Zillow's Terms prohibit: automated queries "including screen and database scraping... or any other automated activity with the purpose of obtaining information from the Services", and using the Services "to develop competitive products or services". A pure hide-only content script is far less exposed. (Exact current ToU text could not be fetched, HTTP 403. **LOW confidence.** Get the text manually before launch.)
2. **Trademark/impersonation.** Chrome Web Store policy: "don't represent that your product is authorized by, endorsed by, or produced by another company." Using the Zillow logo, Zillow blue, or "Zillow Filter" as a name that implies an official product invites takedown. Existing listings like "Zillow Quick Hide" suggest the store tolerates nominative "for Zillow" naming (LOW confidence; tolerance is not permission).
3. **Single-purpose violation.** Bundling "hide sponsored" with "open in Tran", "save to CRM", or "rent estimate overlay" breaks the "single purpose that is narrow and easy to understand" policy and gets rejected.
4. **Selector rot.** Zillow uses hashed, generated CSS class names and changes markup often. The extension silently stops hiding anything, or worse, **hides organic listings**.

**Why it happens:**
The extension is the most "viral" feature from the origin thread, so it attracts feature requests. Selectors are written against one snapshot of the DOM.

**How to avoid:**
- Name it **"Sponsored Listing Filter — for Zillow"** (nominative use), with its own icon, no Zillow logo or colors, and a description stating "Not affiliated with or endorsed by Zillow Group."
- Single purpose: hide or dim cards labeled Sponsored/Featured/Promoted. No reading of prices, addresses, or listing IDs. **Zero network requests** from the content script. Permissions: `host_permissions` limited to `https://www.zillow.com/*`, no `tabs`, no `storage` beyond a toggle.
- Match on **visible label text and ARIA attributes** ("Sponsored", "Featured"), not hashed classes. Use a MutationObserver scoped to the results list container. Default to **dim + "Sponsored (hidden)" toggle** instead of `display:none`, so false positives are visible and recoverable.
- MV3 allows remote **configuration** JSON but prohibits remote **code**. A selector/label JSON hosted on the Pages site can update matchers without store review. Keep it data-only and validate its schema.
- Ship a fixture-based test: saved HTML snapshots of Zillow search result pages, with the matcher unit-tested against them. Refresh snapshots monthly and log the date.
- Privacy policy page (required by CWS even for no-data extensions): "collects nothing, sends nothing."
- Consider Firefox (AMO) as well. Its review is often faster, and the same MV3 code mostly works.

**Warning signs:**
Content script contains `fetch`, `chrome.runtime.sendMessage` with listing data, or `querySelector('.StyledPropertyCard-c11n-...')`. Feature requests for "export from Zillow".

**Phase to address:** P6 Zillow Extension (separate repo/package directory, separate release checklist)

---

### Pitfall 7: GitHub Pages can't send security headers — relying on a meta CSP that silently ignores key directives

**What goes wrong:**
GitHub Pages doesn't allow custom response headers, so the only CSP available is `<meta http-equiv="Content-Security-Policy">`. Per the CSP3 spec, **`frame-ancestors`, `report-uri`/`report-to`, and `sandbox` are ignored in meta**, and Report-Only mode isn't supported. The app **can be framed by any site** (clickjacking the "paste your API key" or "Forget keys" UI), and CSP violations produce **no reports**. Meta CSP also only applies after the tag is parsed, so it must be the first element in `<head>`. SvelteKit's inline hydration script needs either `kit.csp` hash mode (which generates the meta tag for prerendered pages) or `'unsafe-inline'`, which defeats the purpose.

**Why it happens:**
A developer copies a header-based CSP into a meta tag and assumes parity.

**How to avoid:**
- Use SvelteKit's built-in `kit.csp` with `mode: 'hash'`. For prerendered pages it emits a meta tag with script hashes. Verify the generated `build/**/*.html` contains it.
- Add a JS frame-buster on the settings/key page (`if (window.top !== window.self) { document.body.innerHTML = 'Open Tran directly'; }`) as the only available clickjacking mitigation. Accept that it's imperfect.
- If a custom domain goes in front of Cloudflare (free plan) later, move CSP and `frame-ancestors` to real headers via Transform Rules. Record that as the upgrade path.
- CI check: parse built HTML and assert the CSP meta exists, is first in `<head>`, and has no `'unsafe-inline'`/`'unsafe-eval'` in `script-src`.

**Warning signs:**
`frame-ancestors` in the meta tag (it does nothing). CSP console errors dismissed in dev. `'unsafe-inline'` added "temporarily".

**Phase to address:** P1 Foundation

---

### Pitfall 8: Local-only data silently lost — Safari's 7-day eviction, cleared storage, device switch

**What goes wrong:**
An agent spends three weeks building a CRM of 40 leads, doesn't open the site for 8 days on an iPhone, and **Safari/WebKit deletes IndexedDB, localStorage, and Service Worker registrations** (7 days without user interaction, in effect since Safari 13.1/iOS 13.4). This applies to **all iOS browsers**, since they all use WebKit. Other ways to lose data: "Clear browsing data", private windows, a new laptop, browser-profile resets. Saved searches, "N new since last visit" baselines, cached RentCast responses (which cost real calls to rebuild), and the API keys all disappear. The user blames the product.

**Why it happens:**
"Local-first" is chosen for $0 hosting, but durability is treated as the browser's job.

**How to avoid:**
- Call **`navigator.storage.persist()`** on first meaningful save (supported in Safari 17+). Show the result ("Storage: persistent / may be cleared by browser") in Settings.
- **Export/Import JSON backup** in P1, not later. It covers saved searches, CRM, deal analyses, and settings (keys excluded by default; opt-in include with warning). Use a versioned schema (`{ schemaVersion: 1, exportedAt, data }`) with migrations.
- **Backup nudges**: "You have 12 unsaved-to-file leads. Last backup: never." Show at 7 days since last export and whenever the CRM passes N records.
- Recommend "Add to Home Screen" on iOS (installed web apps have their own usage counter) with a minimal manifest.
- Store "last seen listing IDs" per saved search, so a lost baseline shows "all results new" instead of crashing.
- Optional later (not v1): export to a user-owned file via the File System Access API, or sync to the user's own GitHub Gist or Google Drive (BYO storage, still $0).

**Warning signs:**
CRM ships without export. No `storage.persist()` call. No schema version field in stored data.

**Phase to address:** P1 Foundation (storage layer + export/import + persist); nudges in P5 Agent Portal

---

### Pitfall 9: The demo is empty, fake-looking, or impossible at nationwide scale on 50 calls

**What goes wrong:**
- A first-time visitor has no key, so every portal shows spinners, error toasts, or blank states. They bounce before the "get a free RentCast key" onboarding. Getting a RentCast key requires signing up and likely a saved payment method (the billing docs refer to charging "your saved payment method"; whether the free plan needs a card is unconfirmed, so **verify manually**). That is heavy friction for a curious renter.
- Fixture data looks fake ("123 Main St, Anytown", round prices, stock photos), which destroys credibility with agents and investors.
- **Fixtures captured from the developer's real key and committed to the public repo** contain real listing-agent contact details and addresses. That's PII, and it arguably lets "unauthorized parties... obtain the API Data" through your portal.
- "Nationwide from day one" plus 50 calls/month doesn't add up. RentCast listing queries are scoped by city/state, zip, or a radius of at most 100 miles, and each query is one call returning up to 500 listings. A "nationwide rentals under $1,500" search can't exist. A full deal analysis (property record + value AVM + rent AVM + comps + market stats) is about 3–5 calls, so **roughly 10–15 deals/month** on the free tier.

**Why it happens:**
The demo is built last. Scale math is never done. "Nationwide" is a coverage claim confused with a query capability.

**How to avoid:**
- **Demo mode is a first-class data source** (P2): a `DemoRentCastClient` implementing the same interface, clearly badged "Sample data" in the UI. Make every portal fully explorable without keys.
- Fixtures: **synthetic but realistic** — real city/zip names, plausible price distributions generated from public aggregates (HUD FMR, Census ACS), fictional street numbers, **no real agent names, phones, or emails**, and generated or property-agnostic imagery. Keep them in `src/lib/demo/` with a README stating they're synthetic.
- Repo guard: a CI check that fails if fixtures contain email/phone patterns or `listingAgent` fields with non-placeholder values.
- Reframe "nationwide" as "**works in any US city or zip**". Search UI requires a location (city/zip/radius) before running. Show a per-action cost ("Analyze deal: ~4 calls") next to buttons.
- Onboarding: a 3-step "Get your free RentCast key" guide with screenshots, what 50 calls buys you, and a warning to set the in-app budget cap.

**Warning signs:**
Landing page screenshot shows real data. First-load Lighthouse/Playwright run without keys shows error states. Search form allows submission with no location.

**Phase to address:** P2 Data Layer (demo client + fixtures + CI guard); onboarding in P7 GTM

---

### Pitfall 10: Three-portal scope creep sinks a $0 solo v1

**What goes wrong:**
Twelve features across three audiences, plus an extension and marketing pages, adds up to 13+ deliverables for one developer. The typical failure: all three portals get to 60%, none is demo-credible, and the GTM message is muddled ("who is this for?"). Agent CRM and content studio in particular grow into a full real-estate CRM, a crowded market with entrenched incumbents.

**Why it happens:**
"One platform, three portals" makes each extra portal look nearly free, since the data layer is shared. But the UX, copy, compliance, and fixtures for each audience are not shared.

**How to avoid:**
- Define v1 as: **shared foundation + ONE portal done to "shippable" + thin "coming soon / preview" shells for the other two**, with an email waitlist per portal (a form service call, cheap GTM signal). The Renter portal is the natural first pick: it's the origin story, pairs with the Zillow extension, and has the least compliance surface.
- Or, if all three must ship: cap each portal at **2 features** in v1 (Renter: saved search + fair rent. Investor: deal analyzer + market stats. Agent: content studio + lead inbox), and defer CRM, memo, deal-flow alerts, and market reports.
- Every portal phase needs a "demo-credible" exit criterion: works fully in demo mode, works with a real key under budget, passes the Fair Housing linter where relevant.
- Keep the extension in a separate phase that can slip without blocking the web app.

**Warning signs:**
Phase plans with more than 4 features. Portal phases that end "partially done, continue next phase". CRM feature list mentions pipelines, tags, bulk email, or calendar.

**Phase to address:** Roadmap creation (now) — scope decision before P3

---

## Moderate Pitfalls

### Pitfall 11: SvelteKit static + GitHub Pages base-path and routing breakage

**What goes wrong:** The site works on `localhost:5173` but on Pages gives 404s on refresh, unstyled pages, broken asset links, or empty prerendered shells. Specific traps: `paths.base` not set to `/tran_real_estate`; hardcoded `href="/renter"` instead of the base-aware `resolve()`/`base`; missing `.nojekyll` (Jekyll drops `_app/` directories starting with `_`); no `fallback: '404.html'` for client-only routes; `trailingSlash` mismatches causing redirect loops or duplicate URLs; `ssr = false` producing empty prerendered HTML (bad for GTM/SEO); prerender crashing with `localStorage is not defined` because key or storage reads run at module top level; `prerender.handleHttpError` failures from links to not-yet-built routes; `actions/deploy-pages` getting **wedged** ("Deployment request failed... due to in progress deployment").
**Prevention:** In P1, deploy a hello-world with every route type (prerendered marketing page, client-only portal route, dynamic param route) **before** feature work. Settings: `adapter-static({ fallback: '404.html' })`, `paths.base` from env (`BASE_PATH`), `trailingSlash: 'always'`, `static/.nojekyll`. Marketing pages prerendered with SSR; portal routes `prerender = true` with browser-only data loading in `onMount`/`$effect` guarded by `browser`. Add a Playwright smoke test against `vite preview` with the base path set, and against the live URL post-deploy. Add `concurrency: { group: pages, cancel-in-progress: false }` to the deploy workflow. Document the wedge recovery (Settings -> Environments -> github-pages; push a trivial commit; GitHub Support after 24h).
**Phase:** P1 Foundation

### Pitfall 12: Committing secrets or licensed data to the public repo

**What goes wrong:** The developer's own RentCast or LLM key ends up in `.env`, a Playwright test, a recorded fixture, a screenshot, or a commit message. Public-repo secret scanning bots find keys within minutes, and the RentCast key has no hard cap, so the developer gets billed. Real RentCast responses committed as fixtures leak listing-agent PII. CoStar exports or screenshots dropped in `research/` violate the academic license.
**Prevention:** `.gitignore` covering `.env*`, `*.har`, `research/private/`, `fixtures/recorded/`. Enable GitHub **secret scanning + push protection** (free for public repos). Add a `gitleaks` pre-commit hook and CI job, plus a custom regex for RentCast key format (verify the format from a real key). Use `VITE_`-prefixed vars **only** for non-secrets, since anything `VITE_*` is inlined into the public bundle. E2E tests against real APIs read keys from GitHub Actions secrets, and **never run on pull requests from forks**. Policy line in CONTRIBUTING.md: no CoStar-derived numbers, screenshots, or files anywhere in the repo.
**Phase:** P1 Foundation (hooks + scanning), enforced continuously

### Pitfall 13: Lead inbox form service limits, spam, and exposed agent email

**What goes wrong:** Web3Forms free: **250 submissions/month**, 30-day history, spam protection **opt-in hCaptcha only**, and the **access key sits in public HTML**, so anyone can copy it and spam the agent's inbox from any site. Formspree free: **50 submissions/month, counted account-wide**. Bots find the form, the quota burns in a day, and real leads are dropped silently (the free tier won't alert you). If the agent's email is used as a `mailto:` or visible in HTML, it gets harvested.
**Prevention:** The agent brings their own form-service key (BYOK pattern again), so Tran never holds a shared quota. Enable hCaptcha (Web3Forms) or Formspree's reCAPTCHA. Add a honeypot field plus a minimum time-to-submit check client-side. Never render the agent's raw email in HTML; the form service delivers it. Show the quota in the setup guide ("Free: 250/month; beyond that leads bounce"). Copy on the renter side: "Your inquiry goes to [Agent name] via a third-party form service" (privacy disclosure). Because the form only sends email, the "lead inbox" in the app is really **manual entry or paste into the local CRM**. Design the UX honestly; don't imply leads appear in the app automatically, since there's no backend to receive them.
**Phase:** P5 Agent Portal

### Pitfall 14: Outreach and follow-up drafts that violate CAN-SPAM / TCPA or deceive

**What goes wrong:** Human-in-the-loop sending is right, but drafts still matter. Commercial emails agents send (market reports, follow-ups to cold leads) need CAN-SPAM elements: non-deceptive subject lines, physical postal address, clear opt-out. CAN-SPAM covers commercial email generally, not only bulk. "Copy to SMS" or "open in Messages" for leads who didn't opt in is TCPA exposure at **$500–$1,500 per message**. AI-voice or cloned-voice scripts count as "artificial or prerecorded voice" under the FCC's Feb 2024 ruling. Drafts that pretend to be from a human who didn't write them, or invent urgency ("3 other offers today"), are FTC deception exposure.
**Prevention:** Email draft templates for agents include `{{postal_address}}` and an opt-out line by default. No bulk send, no mail-merge, no SMS automation, no voice features in v1. Renter drafts are one-to-one inquiries (not commercial solicitation) and are low risk, but still keep them free of fabricated claims. Linter flags on fabricated scarcity phrases. Note: a claim found in search that the FCC "one-to-one consent rule" took effect Jan 27, 2026 **conflicts** with the 11th Circuit's January 2025 vacatur of that rule. Treat it as unresolved, and don't build SMS features until counsel confirms.
**Phase:** P3 Renter (outreach) and P5 Agent (follow-ups)

### Pitfall 15: Founder-story video scripts and AI performers — new state disclosure laws

**What goes wrong:** The content studio generates founder-story reel scripts modeled on the reference video. If agents pair them with AI avatars or synthetic presenters, **New York's AI Transparency in Advertising Act (effective June 9, 2026)** requires "a clear, conspicuous disclosure" for commercial ads using synthetic performers ($1,000 first violation, $5,000 repeat). It applies to any ad distributed in New York, so a nationwide product is in scope. Scripts that fabricate testimonials or results ("I closed 40 deals in 30 days") violate NAR Article 12 ("true picture") and FTC endorsement rules.
**Prevention:** Script output includes placeholders for real, user-supplied results, never invented numbers. Add a checklist item "If using an AI avatar or voice, add an AI disclosure (required in NY)". The system prompt forbids fabricated testimonials and statistics.
**Phase:** P5 Agent Portal

### Pitfall 16: Rent estimates and listings presented with false precision

**What goes wrong:** "Fair rent: $1,842" displayed as fact. RentCast accuracy depends on local data density and drops in rural or thin zips. Estimates are long-term rent only (no short-term/Airbnb). Listings aggregate multiple sources, so landlord-direct and large property-manager units may be missing or stale. The origin thread's complaint ("Zillow shows a limited slice") then applies to Tran too, and users notice.
**Prevention:** Always show a range plus comp count plus a "low confidence" badge when comps < N or range width > X%. A "Data coverage" explainer page states plainly what's missing (not every rental; no short-term rentals; freshness varies). Show `lastSeenDate`/`daysOld` on listing cards. Never say "all rentals". Investor portal: label "Long-term rental estimates only".
**Phase:** P3 Renter (fair rent), P4 Investor (analyzer)

---

## Minor Pitfalls

### Pitfall 17: RentCast API parameter case-sensitivity and location normalization
**What goes wrong:** `city` and `state` are case-sensitive ("austin" vs "Austin", "tx" vs "TX"), so a lowercase query returns empty results and costs a call.
**Prevention:** Normalize location input (title-case city, uppercase 2-letter state, 5-digit zip validation) before the call. Reject invalid input client-side, since every empty result still costs $0 on the free tier but counts against the 50.
**Phase:** P2 Data Layer

### Pitfall 18: Cache that's too fresh or too stale
**What goes wrong:** No cache means the budget burns; an infinite cache means "N new since last visit" never changes and rent stats go months stale.
**Prevention:** Per-endpoint TTLs: listings 24h, AVM rent/value 7d, market stats 30d, property records 90d. Show "as of" timestamps, and offer a manual "Refresh (1 call)" button. The cache is stored in IndexedDB (not localStorage, which has a 5MB limit and is synchronous) and counts toward the export/backup decision (exclude by default; it's rebuildable).
**Phase:** P2 Data Layer

### Pitfall 19: Warm editorial design that fails WCAG AA
**What goes wrong:** Warm palettes (cream backgrounds, terracotta or gold text) and thin elegant serifs routinely fail 4.5:1 contrast. Cinematic hero images with text overlays fail contrast on some frames. Financial tables in serif fonts become hard to scan.
**Prevention:** Contrast-check tokens at design time. Text on images always gets a scrim. Serif for headings only, with tabular-numeral sans for numbers. Add an axe-core Playwright check per route.
**Phase:** P1 Foundation (design tokens), verified every UI phase

### Pitfall 20: Extension selector JSON fetched from the Pages site breaks CSP or goes stale
**What goes wrong:** The remote matcher config is cached forever, or fetched from a URL that changes when the base path changes.
**Prevention:** Stable URL (`/tran_real_estate/extension/matchers.v1.json`), bundled fallback config, 24h refresh, schema validation.
**Phase:** P6 Zillow Extension

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Calling RentCast directly from components instead of through the budgeted client | Faster first feature | Uncounted calls, and real money on users' cards | **Never** |
| Storing keys in plain localStorage without a "remember" opt-in | Simpler settings UX | Keys persist on shared computers; bigger XSS blast radius | Only in P1 spike; replace before any portal ships |
| `{@html}` for LLM markdown output | Pretty formatting in one line | Stored XSS -> key theft | **Never** (use sanitizer or text) |
| Deploying at `wolfwdavid.github.io/tran_real_estate` (shared origin) | $0, zero setup | Every sibling Pages site can read Tran's storage | Acceptable for private preview; decide before public GTM launch |
| Fixtures recorded from real API responses | Realistic demo quickly | PII in public repo; possible RentCast terms issue | **Never** commit; synthetic only |
| No schema version on stored data | Faster initial build | Breaking changes wipe or corrupt user CRM | **Never** — add `schemaVersion: 1` from day one |
| Hashed-class CSS selectors in the extension | Works today | Breaks silently on next Zillow deploy | Never as the only matcher; OK as a secondary signal |
| Prompt-only Fair Housing guardrails (no linter) | Ships faster | LLM drift produces violating copy unnoticed | Only for internal demo; linter required before agents use it |
| Building all 3 portals in parallel | Visible breadth | Nothing demo-credible | Only as preview shells |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| RentCast API | Treating 50/month as an enforced cap | Client-side budget ledger with hard stop; no auto-pagination; $0.20/call overage warning |
| RentCast API | Lowercase `city`/`state` params | Normalize: title-case city, uppercase 2-letter state |
| RentCast API | Nationwide query UI | Require city/zip/radius (<=100 mi); one call returns <=500 listings |
| RentCast API | Encouraging IP-restricted keys | Recommend **endpoint** restrictions (IP restriction breaks for home/mobile users) |
| Anthropic API | Missing `anthropic-dangerous-direct-browser-access: true` | Include header; handle 401/429/529 distinctly |
| OpenAI API | Using the Node SDK without `dangerouslyAllowBrowser`, or assuming CORS is guaranteed | Raw fetch adapter + test-connection button + "may break" notice; OpenRouter fallback |
| Gemini API | `?key=` in URL (leaks to history/logs); free-tier PII | `x-goog-api-key` header; warn that free-tier prompts may be human-reviewed and used for training |
| Web3Forms | Assuming the access key is secret | It's public by design; enable hCaptcha + honeypot; agent's own key |
| Formspree | Planning on 250/month | Free is 50/month **account-wide** |
| GitHub Pages | Setting security headers | Not possible; meta CSP only (no `frame-ancestors`/reporting) |
| GitHub Pages | Hardcoded root-relative links | `paths.base` + base-aware links + `.nojekyll` + `404.html` fallback |
| Chrome Web Store | Remote JS for selector updates | Remote **JSON config** only (allowed in MV3); code must be bundled |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Re-running all saved searches in parallel on open | Calls burn; rate-limit throttling; UI freeze | Sequential, once per 24h per search, user-confirm above 3 | >3 saved searches |
| Storing 500-listing responses in localStorage | `QuotaExceededError`, jank from sync writes | IndexedDB (via idb-keyval or Dexie), store only needed fields | ~5MB, about 10–20 cached searches |
| Map rendering of 500 markers without clustering | Mobile scroll jank | Cluster markers; list-first on mobile | >200 markers on mid-range phones |
| MutationObserver on `document.body` in the extension | Zillow page lag, high CPU | Observe the results container only; debounce | Infinite-scroll result pages |
| LLM streaming re-render per token with markdown parse | Laggy typing and battery drain | Throttle render to ~50ms; parse on completion | Long memos/reports (>1k tokens) |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Shared `username.github.io` origin for a BYOK app | Any sibling site reads stored keys | Dedicated origin (custom domain or org Pages) before public launch |
| Rendering RentCast listing descriptions or LLM output as HTML | Prompt-injection -> XSS -> key exfiltration | Text rendering or DOMPurify strict allowlist; CI grep for `{@html` |
| Keys included in exported JSON backups by default | Backup files shared or emailed leak keys | Exclude keys by default; explicit opt-in with warning |
| Error reporting/analytics capturing request headers | Keys in third-party logs | No third-party scripts in v1; scrub headers if ever added |
| `VITE_*` env var holding a real key "for testing" | Key inlined into the public bundle | Real keys only via Actions secrets for server-side E2E; never `VITE_` |
| Extension content script sending page data anywhere | Scraping claim + CWS privacy violation | No network in content script; "collects nothing" privacy policy |
| Committing CoStar-derived files or numbers | Academic license breach; campus-wide access loss | Don't use CoStar for Tran at all; gitleaks/path rules on `research/` |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Blank or error screens without a key | Immediate bounce | Full demo mode with "Sample data" badge on every portal |
| Hidden API cost of actions | Unexpected RentCast bill; lost trust | Per-button call cost + monthly meter + cap |
| "Lead inbox" implying leads arrive in-app | Agent waits for leads that only arrive by email | Honest copy: "Leads arrive in your email; paste or import to CRM" |
| No backup reminder | CRM wiped by Safari 7-day eviction | Persist request + export nudges + iOS home-screen tip |
| Rent estimate as a single number | False confidence; bad decisions | Range + comp count + confidence badge |
| Fair Housing flags that block without explanation | Agents disable or ignore the tool | Inline highlight + why + compliant alternative wording |
| "Paste your API key" with no trust explanation | Security-aware users refuse | Plain-language "where your key goes" panel, network diagram, open-source link, revoke links |
| Extension hides organic listings by mistake | User misses their apartment | Dim + label + one-click reveal instead of full removal |

## "Looks Done But Isn't" Checklist

- [ ] **RentCast client:** Often missing budget hard-stop — verify a test simulating 60 calls blocks call #41 (default cap) and shows the overage confirm
- [ ] **Saved-search alerts:** Often missing once-per-24h throttle — verify reloading the app 10 times makes <=N calls total
- [ ] **BYOK settings:** Often missing per-provider test-connection and forget-all — verify each of Anthropic/OpenAI/Gemini from the **deployed Pages URL** (not localhost)
- [ ] **LLM output rendering:** Often uses `{@html}` — verify a listing description containing `<img src=x onerror=alert(1)>` renders inert
- [ ] **CSP:** Often `'unsafe-inline'` or placed after other head tags — verify built HTML: CSP meta first, hashes present, `connect-src` allowlist exact
- [ ] **Pages deploy:** Often breaks on refresh — verify hard-refresh on a deep portal route on the live URL returns the app, not GitHub 404
- [ ] **Demo mode:** Often only the landing page works — verify every portal route with storage cleared and no keys
- [ ] **Fixtures:** Often contain real agent contacts — verify CI PII scan passes
- [ ] **Export/Import:** Often exports but import doesn't migrate — verify round-trip plus importing a `schemaVersion: 0` file
- [ ] **Storage persistence:** verify `navigator.storage.persisted()` result surfaced in Settings on Safari 17+
- [ ] **Fair Housing linter:** Often prompt-only — verify test suite of 30+ known-bad phrases flags all, and 30 neutral phrases flag none
- [ ] **Disclaimers:** verify deal analyzer, investment memo, fair-rent, market report exports, and footer all carry the non-brokerage / not-advice text
- [ ] **Agent exports:** verify brokerage name + license state fields render on every export
- [ ] **Lead form:** verify honeypot + captcha, and that the agent email is absent from page source
- [ ] **Extension:** verify zero network requests (DevTools, extension service worker + content script), and matcher tests pass on stored Zillow snapshots
- [ ] **Extension listing:** verify name/description has "for Zillow" + "not affiliated" and no Zillow logo
- [ ] **Secrets:** verify GitHub secret scanning + push protection enabled and gitleaks in CI

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| User billed RentCast overage due to app bug | HIGH (trust + possible refund demand; RentCast says charges are final) | Ship hotfix with hard cap; publish incident note; tell affected users to contact RentCast support; add regression test on call counts |
| Key leak via XSS or shared origin | HIGH | Patch; banner telling all users to rotate RentCast and LLM keys, with revoke links; move to a dedicated origin; post-mortem |
| Developer key committed to public repo | MEDIUM | Revoke key at provider **first**, then purge history (`git filter-repo`), force-push, confirm scanning alert closed |
| Fair Housing-violating copy published by an agent | HIGH (legal exposure for agent, reputational for Tran) | Add phrase to linter; notify users of the pattern; review prompt; consult counsel if a complaint is filed |
| Zillow cease-and-desist or CWS takedown | MEDIUM | Rename and rebrand the extension; strip marks; confirm hide-only/no-network; appeal via CWS with the single-purpose statement; Firefox listing as fallback |
| Zillow markup change breaks extension | LOW | Update remote matcher JSON (no store review); refresh snapshots; add label-text fallback |
| CRM data wiped by eviction | HIGH for user (unrecoverable without backup) | Only prevention works; add auto-export reminders; offer BYO cloud sync later |
| OpenAI or Gemini CORS breaks | LOW | Banner "provider temporarily unavailable in browser"; default to Anthropic or OpenRouter adapter |
| CoStar data found in repo or product | HIGH (NYU license) | Remove and purge history; stop use; don't reuse derived numbers |
| Pages deployment wedged | LOW | Cancel stuck deployment in Environments; trivial commit; Support ticket after 24h |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 0a. RentCast terms misread | Roadmap now (update PROJECT.md) | PROJECT.md Out of Scope reason rewritten to "API key is non-transferable; no hard caps" |
| 0b. CoStar "offline research" | Roadmap now (update PROJECT.md) | PROJECT.md states CoStar not used for Tran in any form |
| 0c. Withdrawn HUD guidance cited | P3/P5 linter docs | Docs cite 42 USC 3604(c) / 24 CFR 100.75 + state law, not the 2024 guidance |
| 1. RentCast overage billing | P2 Data Layer | Call-count unit tests; budget hard-stop test; meter visible |
| 2. Key leakage (XSS/origin/scripts) | P1 Foundation | Origin decision recorded; XSS payload test inert; no third-party scripts in build |
| 3. LLM provider CORS/data policy | P1 Foundation (+P5 PII guard) | Test-connection passes from live URL for each provider; Gemini free-tier PII warning test |
| 4. Fair Housing copy | P3 + P5 (shared linter built first) | Linter test suite pass; demo outputs reviewed |
| 5. Unlicensed brokerage / advice | P7 GTM (+P3/P4 disclaimer components) | Banned-terms CI grep; disclaimers on all listed surfaces |
| 6. Zillow extension ToU/CWS/selectors | P6 Extension | No-network check; snapshot tests; listing copy review |
| 7. Meta-only CSP | P1 Foundation | Built-HTML CSP assertion in CI |
| 8. Storage eviction/loss | P1 Foundation (+P5 nudges) | Export/import round-trip test; persist() surfaced |
| 9. Demo credibility / 50-call math | P2 Data Layer (+P7 onboarding) | Keyless Playwright run of all portals; fixture PII scan |
| 10. Three-portal scope creep | Roadmap now | Each portal phase <=4 features with demo-credible exit criteria |
| 11. SvelteKit/Pages routing | P1 Foundation | Live deep-link refresh test; deploy workflow concurrency set |
| 12. Secrets/licensed data in repo | P1 Foundation | Push protection on; gitleaks CI green |
| 13. Form service limits/spam | P5 Agent Portal | Honeypot/captcha present; email not in source |
| 14. CAN-SPAM/TCPA | P3 + P5 | Templates include address + opt-out; no SMS/bulk features exist |
| 15. AI performer disclosure | P5 Agent Portal | Script output checklist includes NY disclosure |
| 16. False-precision estimates | P3 + P4 | Range + confidence badge rendered; coverage page exists |
| 17–20. Minor | P2 / P1 / P6 | Normalization tests; TTL tests; axe checks; matcher fallback test |

## Sources

**RentCast (HIGH)**
- RentCast API Terms of Use — license grant incl. display/resell/distribute; key confidentiality; anti-scraping duty; overage billing, $500 immediate-bill threshold, no refunds; "as is" data: https://www.rentcast.io/terms-api
- RentCast Billing and Pricing — no hard caps, 85%/100% email alerts, overage per request, charges saved payment method: https://developers.rentcast.io/reference/billing-and-pricing
- RentCast API pricing — free 50 calls/month, $0.20/request overage: https://www.rentcast.io/api
- RentCast rental listings endpoint — case-sensitive city/state, radius max 100 mi, limit max 500, one call per page: https://developers.rentcast.io/reference/rental-listings-long-term
- RentCast CORS support and key IP/endpoint restrictions: https://developers.rentcast.io/reference/introduction
- RentCast Platform Terms (separate from API terms): https://www.rentcast.io/terms
- Accuracy caveats (thin markets, no short-term rental) — MEDIUM: https://www.bnbcalc.com/reviews/rentcast-review-2026

**LLM providers (HIGH/MEDIUM)**
- Anthropic browser CORS header: https://simonwillison.net/2024/Aug/23/anthropic-dangerous-direct-browser-access/
- Anthropic Usage Policy high-risk use cases (housing, finance): https://www.anthropic.com/legal/aup
- OpenAI browser CORS breakages (Oct 2025): https://community.openai.com/t/chat-completions-api-endpoint-down-blocked-any-web-browser-request/1362527
- OpenAI Responses API CORS regression, fixed same day (Jan 29, 2026): https://community.openai.com/t/has-the-cors-policy-changed-responses-api/1372791
- OpenAI usage policies (no automated housing decisions without human review): https://openai.com/policies/usage-policies/
- Gemini API Additional Terms — unpaid-tier data used for improvement, human review, "do not submit personal information": https://ai.google.dev/gemini-api/terms
- Gemini OpenAI-compat CORS errors (MEDIUM): https://discuss.ai.google.dev/t/gemini-api-cors-error-with-openai-compatability/58619
- OpenRouter browser CORS confirmed working (Aug 2026): https://simonwillison.net/2026/Aug/15/cors-chat/

**Web platform (HIGH)**
- CSP3 spec — `frame-ancestors`, `report-uri`, `sandbox` not supported in meta: https://www.w3.org/TR/CSP3/
- MDN CSP guide (meta limitations, no report-only in meta): https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP
- SvelteKit adapter-static (GitHub Pages base path, 404 fallback, .nojekyll, trailingSlash, ssr): https://svelte.dev/docs/kit/adapter-static
- WebKit storage policy updates (Storage API in Safari 17): https://webkit.org/blog/14403/updates-to-storage-policy/
- MDN storage quotas and eviction / persist(): https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria
- Safari 7-day script-writable storage cap (MEDIUM, multiple sources): https://github.com/nearprotocol/near-wallet/issues/479
- GitHub Pages wedged deployments (MEDIUM): https://github.com/orgs/community/discussions/200884

**Chrome Web Store / Zillow**
- CWS single-purpose policy (HIGH): https://developer.chrome.com/docs/webstore/program-policies/quality-guidelines
- CWS impersonation & IP policy (HIGH): https://developer.chrome.com/docs/webstore/program-policies/impersonation-and-intellectual-property
- MV3 remote code prohibited, remote config allowed (HIGH): https://developer.chrome.com/docs/extensions/develop/migrate/improve-security
- Zillow Terms of Use (fetch blocked 403; clauses quoted via secondary sources — LOW): https://www.zillow.com/z/corp/terms/ and https://www.olostep.com/blog/zillow-web-scraping
- Existing "for Zillow" extensions as naming precedent (LOW): https://chromewebstore.google.com/detail/zillow-quick-hide/nlpcoafjhhlikkojhagkkipflagidelf

**Fair Housing / advertising / licensing (MEDIUM)**
- 24 CFR 100.75 discriminatory advertisements (HIGH): https://www.law.cornell.edu/cfr/text/24/100.75
- HUD withdrawal of FHEO guidance incl. 2024 digital advertising guidance: https://www.federalregister.gov/documents/2026/04/06/2026-06624/notification-of-withdrawal-of-fair-housing-and-equal-opportunity-guidance-documents
- Analysis of withdrawal (FHA obligations unchanged): https://naahq.org/news/hud-withdraws-fair-housing-related-guidance-documents
- 2024 HUD AI advertising guidance content (historical context): https://www.cohnreznick.com/insights/hud-offers-fair-housing-act-guidance-on-ai-applications
- Achtenberg memo word guidance: https://www.fhcci.org/programs/education/advertising/
- NY AI Transparency in Advertising Act (synthetic performers, eff. June 9, 2026): https://www.koeglelaw.com/2026/06/04/new-york-just-blinked-first-on-ai-advertising-california-employers-youre-next/
- NAR 2026 Code of Ethics (Article 12): https://www.nar.realtor/about-nar/governing-documents/code-of-ethics/2026-code-of-ethics-standards-of-practice
- Rental locator licensing / unlicensed referral fees (state-specific; LOW-MEDIUM): https://www.trec.texas.gov/article/use-unlicensed-assistants-real-estate-transactions and https://www.inman.com/2015/08/25/referrals-from-non-real-estate-agents-can-be-tricky-or-even-illegal/
- FCC AI-generated voices under TCPA: https://www.wsgr.com/en/insights/fcc-rules-ai-generated-voices-are-artificial-under-the-tcpa.html

**CoStar (MEDIUM — NYU's specific license may differ; confirm with NYU Libraries)**
- CoStar Academic Engagement Terms: https://www.costar.com/CoStarTerms-and-Conditions/AcademicEngagement

**Form services (MEDIUM — third-party comparison sites; official pricing pages returned 403)**
- Web3Forms free limits (250/mo, hCaptcha opt-in, public access key): https://splitforms.com/web3forms-pricing
- Formspree free limits (50/mo account-wide): https://formtorch.com/compare/formspree-free-plan-limits

**Open items / unverified**
- Whether RentCast's free Developer plan requires a payment method on file (billing doc implies it; confirm by signing up).
- Exact current Zillow ToU clause text on page modification and extensions (403 on fetch; read manually).
- Status of the FCC one-to-one consent rule (search claim conflicts with the known January 2025 11th Circuit vacatur).
- Whether RentCast rental listing payloads include listing-agent contact fields (affects fixture PII risk; inspect a real response locally, never commit it).
- NYU's specific CoStar license terms (may be stricter or looser than CoStar's public academic terms).

---
*Pitfalls research for: BYOK static real-estate GTM SaaS (Tran Real Estate)*
*Researched: 2026-09-13*
