---
phase: 08-agent-portal-profile-lead-intake-crm
plan: 13
subsystem: agent-lead-intake
tags: [inquiry, web3forms, public-route, spam-gate, e2e, a11y]
requires:
  - "08-05 @tran/core/leads/lead-block buildLeadBlock"
  - "08-06 @tran/core/leads/inquiry-params parseInquiryParams / inquiryParamPairs"
  - "08-08 @tran/core/disclosure composeDisclosure"
  - "08-10 SampleChip; 08-11 routes.ts AGENT_ROUTES"
provides:
  - "apps/web/src/lib/leads/web3forms-sink.ts: submitInquiry, WEB3FORMS_ENDPOINT, InquiryPayload, SinkResult"
  - "apps/web/src/lib/leads/inquiry-url.ts: buildInquiryUrl(pageUrl, config), readInquiryParams(search)"
  - "apps/web/src/lib/components/inquiry/inquiry-gate.ts: evaluateGate, validateInquiry, MIN_ELAPSED_MS, MAX_INQUIRY_MESSAGE"
  - "apps/web/src/lib/components/inquiry/InquiryForm.svelte"
  - "routes/(public) chrome-free layout + /agent/inquire/ page"
  - "tests/e2e/agent-helpers.ts: TEST_ACCESS_KEY, WCAG_TAGS, rentcastTripwire, mockWeb3Forms, inquiryPath, expectAxeClean, expectNoHorizontalScroll"
  - "tests/e2e/routes.ts: PUBLIC_ROUTES, isPublicRoute"
affects: [08-24 share-link builder (uses buildInquiryUrl), 08-26 HUMAN-UAT real Web3Forms delivery, later agent E2E specs (agent-helpers)]
tech-stack:
  added: []
  patterns:
    - "Query-configured prerendered page: neutral h1 shell, params parsed in onMount only"
    - "Client gate (validate -> honeypot -> 3 s) before the single network adapter"
key-files:
  created:
    - apps/web/src/lib/leads/inquiry-url.ts
    - apps/web/src/lib/leads/inquiry-url.test.ts
    - apps/web/src/lib/leads/web3forms-sink.ts
    - apps/web/src/lib/leads/web3forms-sink.test.ts
    - apps/web/src/lib/components/inquiry/inquiry-gate.ts
    - apps/web/src/lib/components/inquiry/inquiry-gate.test.ts
    - apps/web/src/lib/components/inquiry/InquiryForm.svelte
    - apps/web/src/routes/(public)/+layout.svelte
    - apps/web/src/routes/(public)/agent/inquire/+page.svelte
    - apps/web/tests/e2e/agent-helpers.ts
    - apps/web/tests/e2e/agent-inquire.spec.ts
  modified:
    - apps/web/tests/e2e/routes.ts
    - apps/web/tests/e2e/layout.spec.ts
    - apps/web/svelte.config.js
    - scripts/assert-csp.mjs
    - scripts/assert-csp.test.ts
decisions:
  - "Prerendered shell renders a visible h1 'Contact an agent' plus 'Loading this form...' so every state has exactly one h1"
  - "Inquiry failure alert is built from ui/alert inside InquiryForm instead of features/shared SectionError: the (public) graph may not reach lib/features (agent-boundary test)"
  - "Consent uses a native checkbox (accent-primary) rather than the bits-ui button checkbox, so the label/required semantics are plain HTML"
  - "Sink redacts the access key (case-insensitive) from any provider message before returning it as detail"
  - "(public) pages keep banner + contentinfo but never the Portals nav: layout.spec landmark and 375px Menu checks now branch on isPublicRoute"
  - "/agent/inquire/ added to svelte.config.js prerender.entries (reached only through shared links)"
metrics:
  duration: "~45 min"
  completed: "2026-10-06"
  tasks: 3
  files: 16
---

# Phase 8 Plan 13: Public Inquiry Page with Web3Forms Delivery Summary

Prerendered, query-configured `/agent/inquire/` page in a chrome-free `(public)` route group that posts one JSON request to Web3Forms (access key, visitor fields, a `tran_lead_v1` TRAN-LEAD v1 block, no `botcheck`) behind a client honeypot and 3-second gate, proven by a mocked-endpoint E2E on both bases with axe at 375px.

## What was built

- **Sink** (`lib/leads/web3forms-sink.ts`): the only `fetch` in Phase 8. Subject `New inquiry for {agent} from {lead}`, from_name `Tran inquiry form`, consent `Yes: I agree to be contacted about my inquiry.`, dedicated `tran_lead_v1` field. Maps 200/400/400-captcha (reads `json.message ?? json.body?.message`)/429/5xx/thrown/non-JSON to `ok | rejected | captcha-required | rate-limited | server | network`; the key is redacted from any detail.
- **URL helpers** (`lib/leads/inquiry-url.ts`): `buildInquiryUrl` via URLSearchParams on the caller's absolute page URL (base kept, old query/hash dropped); `readInquiryParams` wraps `parseInquiryParams`. Round-trip tested under `/` and `/tran_real_estate/`, including hostile and bidi values.
- **Gate** (`inquiry-gate.ts`): `evaluateGate` (honeypot -> drop silently; <3000 ms -> too fast; else send) and `validateInquiry` with the six UI-SPEC strings and first-invalid focus target.
- **Page + layout**: brokerage line rendered above the h1 at the same Heading 24/600 size; disclosure lines from `composeDisclosure(..., 'web')`; lead copy; demo (`?demo=1`, Avery Sample / Sample Realty, SampleChip, sends nothing); incomplete and newer-version states with no form; noindex + no-referrer; footer says Tran "doesn't verify agents"; text interpolation only.
- **InquiryForm**: fields in UI-SPEC order, counter `{n} of 2,000` (aria-live off), off-screen honeypot (`aria-hidden`, `tabindex="-1"`), Web3Forms privacy note, success panel with focused `h2` and **Send another message** (keeps `p`, restarts the timer), failure alert with typed values kept and focus returned to **Send message**.
- **Registries**: `PUBLIC_ROUTES`/`isPublicRoute` in routes.ts (in `ROUTES`, excluded from `CHROME_ROUTES`); `agent/inquire/index.html` in EXPECTED_PAGES (pin 31 -> 32, CSP 32 pages/base); prerender entry. The agent-boundary `(public)` reach test now runs and passes.

## Verification

- Unit: 29 tests in `lib/leads` + `components/inquiry`; scripts `agent-boundary` + `assert-csp` 87 passed (0 skipped).
- `pnpm check` 0 errors, `pnpm lint` clean, `pnpm banned` passed, build:root/build:sub, `csp:assert` 32 pages per base.
- E2E: `agent-inquire routing a11y csp layout marketing routes-drift` -> 714 passed on root + sub.
- Clock: `page.clock.install()` + `fastForward(3500)` controls `performance.now()`; the `waitForTimeout` fallback was NOT needed.
- Root layout: imports only fonts, app.css, SkipLink and LiveAnnouncer (no storage); no change required.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Focus not returned to Send message after a failed send**
- **Found during:** Task 3 (E2E failure tests)
- **Issue:** `sendEl.focus()` ran while the button was still `disabled` from the sending state, so focus fell to the body.
- **Fix:** `await tick()` before refocusing.
- **Files modified:** apps/web/src/lib/components/inquiry/InquiryForm.svelte
- **Commit:** 05ad5e3

**2. [Rule 3 - Blocking] layout.spec.ts assumed every non-print route has the Portals nav and the Menu button**
- **Found during:** Task 2 (route registration)
- **Fix:** Added `isPublicRoute` to routes.ts; layout.spec's landmark test expects 0 Portals navs and the 375px test skips the Menu check on public routes (banner/contentinfo still asserted).
- **Files modified:** apps/web/tests/e2e/routes.ts, apps/web/tests/e2e/layout.spec.ts
- **Commit:** 3c59a0d

**3. [Rule 3 - Blocking] SectionError lives in lib/features/shared**
- **Issue:** Importing it would put lib/features in the (public) import graph (agent-boundary test and ESLint forbid it).
- **Fix:** InquiryForm renders the same ui/alert destructive pattern inline and announces `{title}. {body}` itself.
- **Commit:** 3c59a0d

**4. [Plan detail] Honeypot ticked through a DOM click in E2E**
- The off-screen checkbox cannot be clicked by coordinates, so the spec ticks it via `el.click()` (the plan suggested `check({ force: true })`) and asserts it is checked before submitting.

Also: `scripts/assert-csp.test.ts` pin and `svelte.config.js` `prerender.entries` edited (both allowed by the orchestrator scope); the plan listed only `assert-csp.mjs`.

## Known Stubs

None. Real Web3Forms delivery to an inbox remains the planned HUMAN-UAT item (08-26); the E2E mocks the endpoint.

## Self-Check: PASSED

- All 11 created files exist; commits 4b68323, e8e4408, 3c59a0d, 05ad5e3, 188d43e present in `git log`.
