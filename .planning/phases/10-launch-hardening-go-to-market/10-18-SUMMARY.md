---
phase: 10-launch-hardening-go-to-market
plan: 18
subsystem: gtm-forms
tags: [feedback, web3forms, forms, key-scan, settings, onboarding, footer, e2e, axe, budget]
requires: [10-14, 10-15, 10-16, 10-17]
provides:
  - feedback-counter.ts (MAX_FEEDBACK, counterText, crossedThreshold, topicFromSearch)
  - FeedbackForm.svelte and the /feedback/ page (sitemap now 14 URLs)
  - footer "Send feedback" (Learn list, ?portal= on portal routes)
  - Settings section 8 "Getting started" (GettingStartedSection.svelte; registry slot now available)
  - ProviderKeyCard `settingsBase` prop for its section links
affects: [10-19 privacy text, 10-20 journey E2E, 10-22 launch audit, 10-23 gate]
tech-stack:
  added: []
  patterns:
    - "Settings sections stay registry-driven: a new section is a component in features/shared/settings plus a flipped `available` flag"
    - "Embedded settings cards take a settingsBase prefix ('' on Settings, resolve('/settings/') elsewhere)"
    - "Header avoids svelte/reactivity: a plain matchMedia listener closes the menu"
key-files:
  created:
    - apps/web/src/lib/components/forms/feedback-counter.ts
    - apps/web/src/lib/components/forms/feedback-counter.test.ts
    - apps/web/src/lib/components/forms/FeedbackForm.svelte
    - apps/web/src/routes/(marketing)/feedback/+page.svelte
    - apps/web/src/lib/features/shared/settings/GettingStartedSection.svelte
    - apps/web/tests/e2e/feedback.spec.ts
    - apps/web/tests/e2e/feedback.configured.spec.ts
  modified:
    - apps/web/src/lib/content/forms.ts
    - apps/web/tests/e2e/routes.ts
    - apps/web/src/lib/components/layout/SiteFooter.svelte
    - apps/web/src/lib/components/layout/PortalSwitcher.svelte
    - apps/web/src/lib/components/ui/ButtonLink.svelte
    - apps/web/src/lib/features/shared/settings/sections.ts
    - apps/web/src/lib/features/shared/settings/sections.test.ts
    - apps/web/src/routes/(app)/settings/+page.svelte
    - apps/web/tests/e2e/settings-shell.spec.ts
    - apps/web/src/lib/features/shared/settings/ProviderKeyCard.svelte
    - apps/web/src/routes/(app)/setup/rentcast/+page.svelte
    - apps/web/src/lib/ai/ui/key-card-additions.test.ts
    - apps/web/tests/e2e/setup-rentcast.spec.ts
    - apps/web/src/lib/components/onboarding/GetStartedGuide.svelte
    - apps/web/src/routes/(marketing)/legal/privacy/+page.svelte
    - .planning/phases/10-launch-hardening-go-to-market/deferred-items.md
decisions:
  - "The Settings 'Getting started' section is its own component (GettingStartedSection.svelte), wired through the existing section registry (`available: true`) and SECTION_COMPONENTS map. The plan's greps for settings/+page.svelte (id, copy, writeOnboarding, #get-started, resolve('/feedback/')) are therefore met in GettingStartedSection.svelte, the same way every other Settings section works."
  - "Key scan runs after field validation and before the spam gates, over JSON.stringify({ message, email }), with no known secrets (the vault is not opened on /feedback/). A hit sets the field error on 'Your feedback' and focuses it, whichever field held the key."
  - "The counter announcement reads the textarea's own value in the input handler (not the bound state), so the crossing check never sees a stale length. counterLeft is singular at 1 ('1 character left')."
  - "'Send more feedback' keeps the chosen topic, clears message/email/errors, restarts the 3 s gate and focuses the checked radio."
  - "Budget: replaced svelte/reactivity MediaQuery in PortalSwitcher with a matchMedia listener (-1.14 KB gz on every page) instead of shaving the footer. The footer link stays a plain list item."
  - "Guide heading focus on a client-side /#get-started arrival is set in a timeout queued after SvelteKit's fragment re-apply (it moved focus to the body)."
requirements: [GTM-01, GTM-02]
metrics:
  duration: ~75 min
  completed: 2026-10-13
  tasks: 3
  files: 23
---

# Phase 10 Plan 18: Feedback Form and Settings Getting Started Summary

The new /feedback/ page has a topic radio group that defaults from `?portal=`, a 2,000-character message with a counter that announces once at 100 characters left, and an optional email field. Any key-shaped text blocks the send before a request is made. It uses the same honeypot, 3-second gate and single Web3Forms POST as the waitlist. Without the owner key, the page shows "The feedback form isn't open yet" with no fields. The footer's Learn list now ends with "Send feedback", which pre-selects the portal topic on portal pages. Settings gains a last "Getting started" section with "Show the tour again", "Set up a RentCast key" and a "Send feedback" link.

## Tasks

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 (RED) | Failing counter helper tests | 36d0892 | feedback-counter.test.ts |
| 1 (GREEN) | Counter helpers | 8002fff | feedback-counter.ts, content/forms.ts |
| 1 | Feedback form and page | c337290 | FeedbackForm.svelte, feedback/+page.svelte, routes.ts, forms.ts |
| 2 | Footer link and Settings Getting started | 8136db5 | SiteFooter, GettingStartedSection, sections.ts(+test), settings page, ButtonLink, settings-shell.spec |
| 2 (budget) | Drop svelte/reactivity MediaQuery from the header | 217c5c1 | PortalSwitcher.svelte |
| extra | Key card links reach Settings from the setup page | b6b4dd5 | ProviderKeyCard, setup page, key-card-additions.test, setup-rentcast.spec |
| 3 (fix) | Guide heading focus on client-side #get-started arrival | 14b096b | GetStartedGuide.svelte |
| 3 | Feedback E2E | 30af516 | feedback.spec.ts, feedback.configured.spec.ts |
| docs | Privacy text names the feedback topic | dc68225 | legal/privacy/+page.svelte |
| docs | deferred-items: setup-page key card links resolved | 093e176 | deferred-items.md |

## Data sent by the feedback form (for checking against 10-19's privacy text)

- **When:** only after the visitor selects **Send feedback**, the message is not empty, any email has a valid shape, no key-shaped text was found, the honeypot is unchecked, and at least 3 seconds have passed since mount. Nothing is sent on load. Without the owner key there is no form.
- **Destination:** exactly one `POST https://api.web3forms.com/submit` (JSON) through the shared `submitOwnerForm`.
- **Body:** `access_key` (owner key), `subject` "Tran feedback: {Topic label}", `from_name` "Tran Real Estate Tools", `topic`, `message`, `email` only when given (trimmed), `botcheck: false`. No UA, URL, query, referrer or analytics id.
- **Stored locally:** nothing. The message and email fields have no `name` (a pre-hydration submit cannot put them in the URL).
- **Privacy text:** the 10-19 paragraph said messages are "labeled with the form it came from, such as which waitlist you joined". Feedback also carries the topic the visitor picked, so I changed the sentence to "...such as which waitlist you joined or which part of Tran your feedback is about." (dc68225). Everything else in the paragraph already matched: what you type goes to Web3Forms, only on submit, and the IP and browser type reach Web3Forms.

## Budget (orchestrator request): `node scripts/assert-budget.mjs <dir> --require-tools`, initial JS KB gz

Before this plan: 59.5 to 59.7 on build-configured (10-16 handoff). With Task 1 and the first Task 2 version (footer link only), configured cash-on-cash measured **60.0 KB (61,396 B, 44 B headroom)**. That still passed, but the margin was too thin. I tested two fixes. Folding the four footer lists into one nested template saved only 53 B, so I reverted it. Replacing `MediaQuery` from `svelte/reactivity` in PortalSwitcher removed the 1,149 B shared reactivity chunk from every page, and I kept that change. Final numbers:

| Route | build/ | build-sub/ | build-configured/ |
| --- | --- | --- | --- |
| tools/ | 51.1 | 51.1 | 51.2 |
| tools/affordability/ | 58.7 | 58.7 | 58.8 |
| tools/cap-rate/ | 58.5 | 58.5 | 58.7 |
| tools/cash-on-cash/ | 58.7 | 58.7 | 58.9 |
| tools/dscr/ | 58.7 | 58.7 | 58.8 |
| index (report) | 57.7 | 57.7 | 57.9 |
| feedback/ (report) | 102.5 | 102.5 | 102.7 |

All three runs print "Budget assertion passed: 5 gated route(s) within 60 KB, 9 reported". The configured build now has about 1.1 to 1.3 KB of headroom, up from about 0.3. The budget was not raised.

**For 10-23:** /feedback/ is 102.5 KB gz. It is report-only, but large. Most of it is the bits-ui radio group and the Phase 3 primitives. The calculators are not involved. A native `<input type="radio">` group would cut most of it if the audit wants that.

## SEO (orchestrator request)

`node scripts/assert-seo.mjs apps/web/build --target root` and `... apps/web/build-sub --target sub` (default `--min-urls`): **"SEO assertion passed for 44 pages, 14 sitemap URLs, 6 share cards"** on both.

## Verification (real output)

- `vitest run --project web feedback-counter`: RED first ("1 failed, no tests": module missing), then 26 passed with form-gate.
- `pnpm test:unit` (full): **320 files, 6265 tests passed**.
- `pnpm check`: 0 errors, 0 warnings (2745 files). `pnpm lint`: exit 0. `pnpm banned`: passed (446 files). `pnpm ui:guard`: passed (79 files).
- `build:root`, `build:sub`, `build:configured`: all exit 0. `pnpm csp:assert`: passed for 45 pages × 3 targets.
- `grep -o 'feedback/?portal=investor' apps/web/build/investor/index.html`: match.
- Built `feedback/index.html`: default build has 0 `<textarea>` and 1 "feedback form isn". Configured has 1 `<textarea>` with `maxlength="2000"`, and `botcheck` is its only `name=` attribute on a form field.
- `playwright test feedback` (first run): 27 passed and 2 failed. The failures were the Settings "Show the tour again" focus test on root and sub: `activeElement.id` was "" and not `get-started-heading`. This was a real bug, fixed in 14b096b (see Deviations). After the fix, `playwright test feedback guide --project=root --project=sub` gave 26 passed. `feedback.configured`, `setup-rentcast`, `settings-shell`, `layout` and `routes-drift` gave 581 passed.
- **Full `pnpm test:e2e`** in 8 shards (about 1 to 4 min each): **2129 passed, 4 skipped, 2 failed**. Both failures are known load flakes and passed 3/3 when run alone:
  - `renter-journey.spec.ts:43` (root): the announcer showed "Showing 1 of 10 rentals." where the test expected "...selected.", because two announcements raced. 3/3 passed alone.
  - `investor/autofill.spec.ts:195` (sub): already listed by 10-19. 3/3 passed alone.

## Deviations from Plan

### Orchestrator-assigned extra scope

**1. Settings "Set up a RentCast key" → `resolve('/setup/rentcast/')`.** The plan already covered this. It is in GettingStartedSection.svelte, and feedback.spec.ts clicks it and checks that the setup page's h1 loads with status 200.

**2. [Rule 1 - Bug] Dead in-card anchors on /setup/rentcast/ (from the 10-16 handoff)**
- **Issue:** ProviderKeyCard's "RentCast usage" pointer and the locked-state "Key security" link used `#rentcast-usage` and `#key-security`. Those ids exist only on Settings.
- **Fix:** Added a `settingsBase` prop. It defaults to `''`, so Settings keeps its in-page links. The setup page passes `resolve('/settings/')`.
- **Tests:** setup-rentcast.spec.ts now checks that the pointer is `…/settings/#rentcast-usage` and that it returns 200. key-card-additions.test.ts checks both `{settingsBase}#…` hrefs and that no bare `href="#rentcast-usage|key-security"` is left. deferred-items.md marks the entry RESOLVED.
- **Commits:** b6b4dd5, 093e176.

### Auto-fixed Issues

**3. [Rule 1 - Bug] Guide heading lost focus on a client-side arrival at /#get-started**
- **Found during:** Task 3 (feedback.spec "Show the tour again", failed on root and sub).
- **Issue:** SvelteKit's `reset_focus` runs before the `afterNavigate` callbacks. It queues a `setTimeout` that re-applies the fragment with `location.replace('#get-started')`. The guide focused its h2 after a microtask tick, and then the fragment re-apply moved focus to the body. The hero same-page link and full page loads were not affected, so 10-15's specs never saw it. This is the Settings → landing path that the UI-SPEC "Focus management" table requires.
- **Fix:** In `afterNavigate`, focus the heading inside a `setTimeout`, which is queued after the router's.
- **Evidence:** Before the fix the test failed 2/2. After the fix, feedback plus guide passed 26/26 and the full E2E was green for both.
- **Commit:** 14b096b.

**4. [Rule 3 - Blocking/budget] Tool pages at 44 B headroom on build-configured.** Fixed by the PortalSwitcher matchMedia change (217c5c1). Numbers are in the budget section above. The menu still closes when the viewport crosses 640px. layout.spec "resizing to 640px closes the panel" passed in the targeted run and in the full E2E.

**5. Registry tests updated for the shipped slot.** sections.test.ts asserted that slot 8 was unavailable, and settings-shell.spec asserted that `id="getting-started"` was absent. Both were placeholder assertions that this plan was meant to flip. They now expect 8 sections, in order, with Getting started last.

**6. `maxlength`:** The Phase 3 `Textarea` types `maxlength` as a number, so the source has `maxlength={MAX_FEEDBACK}` and not the literal `maxlength="2000"` the plan's grep expects. The built HTML and the configured E2E both check `maxlength="2000"`.

**7. Footer link placement:** "Send feedback" is a separate last `<li>` in Learn. Its `aria-current` is "page" on /feedback/, and an E2E test checks that.

**8. Privacy text** (orchestrator check): I made one targeted change, described in the data-flow section above.

## Known Stubs

None. The coming-soon panel is the intended state when the build has no owner key.

## Handoffs

- **10-20 (journey E2E):** Settings → "Show the tour again" now lands on `/#get-started` with focus on `#get-started-heading`. It stores `{ status: 'new', lastPortal }`.
- **10-22 audit:** the axe tests follow the contract: `axe: feedback coming-soon state` (root and sub), plus `axe: feedback open / invalid / sending / success / error state` (configured), all in spec files whose path contains "feedback".
- **10-23:** /feedback/ is 102.5 KB gz (report-only), see the budget note. New load flake seen: `renter-journey.spec.ts:43` (root, competing announcements).

## Self-Check: PASSED

- FOUND: all 7 created files and 16 modified files listed above
- FOUND: commits 36d0892, 8002fff, c337290, 8136db5, 217c5c1, b6b4dd5, 14b096b, 30af516, dc68225, 093e176
