---
phase: 10-launch-hardening-go-to-market
plan: 17
subsystem: gtm-forms
tags: [waitlist, web3forms, forms, honeypot, e2e, axe, gtm]
requires: [10-03, 10-05, 10-11]
provides:
  - form-gate.ts (MIN_FILL_MS, gateSubmit, validateEmail, formMode, mailtoHref, waitlistBody, feedbackBody, TOPICS, PORTAL_NAMES, topicLabel)
  - postWeb3Forms (shared Web3Forms POST + response mapping) and submitOwnerForm
  - FORMS_COPY (waitlist + feedback copy)
  - ComingSoonPanel, FormSuccess, FormError, WaitlistForm
  - waitlist on every audience page; "Try sample data" -> /{portal}/?source=sample
affects: [10-18 feedback form, 10-19 privacy text, 10-22 launch audit, 10-23 gate]
tech-stack:
  added: []
  patterns:
    - "Owner forms: pure body builders in lib/components/forms/form-gate.ts, delivery via lib/leads/owner-forms.ts (forms folder never calls fetch)"
    - "Timing gate reads Date.now() so Playwright's clock can drive it"
    - "Hydration marker data-ready on the form; specs wait for it before interacting"
key-files:
  created:
    - apps/web/src/lib/components/forms/form-gate.ts
    - apps/web/src/lib/components/forms/form-gate.test.ts
    - apps/web/src/lib/leads/owner-forms.ts
    - apps/web/src/lib/leads/owner-forms.test.ts
    - apps/web/src/lib/content/forms.ts
    - apps/web/src/lib/components/forms/ComingSoonPanel.svelte
    - apps/web/src/lib/components/forms/FormSuccess.svelte
    - apps/web/src/lib/components/forms/FormError.svelte
    - apps/web/src/lib/components/forms/WaitlistForm.svelte
    - apps/web/tests/e2e/waitlist.spec.ts
    - apps/web/tests/e2e/waitlist.configured.spec.ts
  modified:
    - apps/web/src/lib/leads/web3forms-sink.ts
    - apps/web/src/lib/components/marketing/AudiencePage.svelte
    - .planning/phases/10-launch-hardening-go-to-market/10-CONTRACT-MAP.md
decisions:
  - "The site's own forms send botcheck: false (UI-SPEC); the Phase 8 agent inquiry body still omits botcheck. Both share postWeb3Forms."
  - "The waitlist email input has no name attribute, so a submit before hydration (native GET fallback) never puts the address in the URL or browser history."
  - "FormError renders SectionError with announceOnMount=false; WaitlistForm announces '{title}. {body}' on every failure so a repeated failure is announced again. The 'Or email {contactEmail}.' line with its mailto link sits directly under the alert."
  - "Field validation runs on blur only once something was typed (or an error is already shown), so tabbing past the empty field does not raise an error; submit always validates."
  - "Send-failure alert and the too-fast message sit at the top of the form, above the label/input/button row (the input and button share one row from 640px)."
requirements: [GTM-02]
metrics:
  duration: ~55 min
  completed: 2026-10-13
  tasks: 3
  files: 14
---

# Phase 10 Plan 17: Per-portal Waitlist Summary

Each audience page now has a one-field waitlist. When the owner's Web3Forms key is built in, it posts once to `https://api.web3forms.com/submit` with an exact six-key body, behind a honeypot and a 3-second gate. When the key is missing, it shows a "The waitlist isn't open yet" panel with no fields, and adds a mailto link only if a contact email is configured. E2E covers the default, sub and configured builds.

## Tasks

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 (RED) | Failing form gate and owner sink tests | 96706ee | form-gate.test.ts, owner-forms.test.ts |
| 1 (GREEN) | Form gates, owner sink and form copy | 04f3912 | form-gate.ts, owner-forms.ts, web3forms-sink.ts, content/forms.ts |
| 2 | Per-portal waitlist on audience pages | 52f62da | ComingSoonPanel, FormSuccess, FormError, WaitlistForm, AudiencePage |
| 2 (fix) | Pre-hydration submit cannot leak the email into the URL; data-ready marker | 7f0c355 | WaitlistForm.svelte |
| 3 | Waitlist E2E | 6890f40 | waitlist.spec.ts, waitlist.configured.spec.ts |
| docs | Contract map entry for postWeb3Forms / owner forms | 413e47a | 10-CONTRACT-MAP.md |

## Data sent by the waitlist

Use this to check the 10-19 privacy text.

- **When:** only when the visitor selects **Join the waitlist**, the address passes the shape check, the honeypot is unchecked, and at least 3 seconds have passed since the form mounted. Nothing is sent on page load. Nothing is sent if the honeypot trips or the submit is too fast. With no owner key in the build, nothing is ever sent because there is no form.
- **Destination:** exactly one `POST https://api.web3forms.com/submit` with headers `Content-Type: application/json` and `Accept: application/json`. No other host is contacted, and no third-party script is loaded.
- **Body (JSON, exactly these keys):**
  - `access_key`: the site owner's public Web3Forms key, from build-time `PUBLIC_WEB3FORMS_KEY`
  - `subject`: `"Tran waitlist: Renter"`, `"Tran waitlist: Investor"` or `"Tran waitlist: Agent"`
  - `from_name`: `"Tran Real Estate Tools"`
  - `email`: the address the visitor typed, trimmed
  - `portal`: `"renter"`, `"investor"` or `"agent"`
  - `botcheck`: `false`
- **Not sent:** user agent, page URL, query string, referrer, analytics or website id, timestamps, any key besides the owner's form key. The browser itself still sends its usual request headers (Origin, User-Agent) to Web3Forms. That is standard browser behaviour and the app does not add them to the body.
- **Stored locally:** nothing. Success is held in component memory only, so a reload shows the form again. Nothing goes to localStorage, IndexedDB, cookies or the URL. The email input has no `name`, so a submit before hydration does not put the address in the query string either.
- **Who receives it:** Web3Forms emails the submission to the inbox tied to the owner's key. The visible privacy note reads: "Web3Forms, our form service, emails your address to the Tran team. It's used only for {portal} portal news. Reply to any message to be removed."
- **Coming-soon mailto:** if `PUBLIC_CONTACT_EMAIL` is set and the key is not, the link is `mailto:{contactEmail}?subject=Tran%20{Portal}%20waitlist`. It opens the visitor's own mail client, and the site sends nothing.

## Verification (real output)

- `vitest run --project web form-gate owner-forms web3forms-sink`: 3 files, **37 passed**. Phase 8's sink tests are unchanged and pass. RED run before the code existed: 2 files failed on missing modules.
- `pnpm test:unit` (whole suite, after all tasks): **317 files, 6238 tests passed**.
- `svelte-check`: 0 errors, 0 warnings once the tree was consistent. An earlier run showed 4 errors in another executor's uncommitted `GetStartedGuide.svelte`, none in my files.
- `pnpm lint` (full; Prettier and ESLint): clean. `pnpm banned`: passed (434 files).
- `build:root`, `build:sub`, `build:configured`: all exit 0. One `build:sub` attempt failed on another executor's half-edited `DscrCalculator.svelte` ("Identifier 'dscr' has already been declared"). It passed on retry 45 s later, and I rebuilt all three targets before the final E2E run.
- `pnpm csp:assert`: passed for 42 pages in each of build, build-sub and build-configured. `connect-src` already includes `https://api.web3forms.com`.
- Acceptance greps: `type="email"` count in `build/for-renters/index.html` = **0**, "The waitlist isn" = **1**. In `build-configured/for-renters/index.html`, `type="email"` = **1**. `grep -c 'style="' WaitlistForm.svelte` = **0**. No `navigator.userAgent` or `location.href` in forms/ or owner-forms.ts.
- `playwright test waitlist`: **27 passed** (6 root + 6 sub + 15 configured, 0 skipped).
- Mutation check: with `MIN_FILL_MS = 0` and the honeypot branch disabled, the configured spec failed exactly "too fast" and "honeypot" (2 failed, 13 passed). After restoring the code: 15 passed.
- `playwright test marketing a11y.spec csp.spec seo layout` (after Task 2, before the `name`/`data-ready` tweak): **952 passed**. This covers the audience-page link test (pathname check, which still passes with `?source=sample`), axe on every route, and CSP.
- **Not run:** the full `pnpm test:e2e` (about 1,700 tests, 30+ minutes in watchdog-sized chunks). I left it to the orchestrator's post-wave gate because three other executors are changing the shared tree.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Privacy] A submit before hydration could leak the email into the URL**
- **Found during:** Task 3, while writing the hydration wait
- **Issue:** The prerendered `<form novalidate>` has no action. If a visitor submits before hydration, the browser does a native GET to the same page. With `name="email"`, that would put `?email=...` into the URL and browser history.
- **Fix:** Removed `name` from the email input; the value is bound, so it was never needed. Added a `data-ready` hydration marker that specs wait on. The happy-path spec also asserts `location.search === ''` after a submit.
- **Commit:** 7f0c355

**2. [Rule 1 - Bug] `Portal` derived variable collided with the imported `Portal` type**
- Renamed it to `portalName` (svelte-check parse error). Fixed before the Task 2 commit.

**3. FormError composition**
- The plan says FormError wraps SectionError and adds the contact line. SectionError takes only string props, so the "Or email {contactEmail}." line and its mailto link sit directly under the alert inside the same wrapper, rather than inside the alert box. SectionError's own mount announcement is turned off and WaitlistForm announces instead, so repeated failures are announced each time.

## Known Stubs

None. The coming-soon panel is the intended unset state, not a stub.

## Handoffs

- **10-18 (feedback form):** `feedbackBody`, `TOPICS`, `topicLabel`, `validateEmail(value, false)`, `FORMS_COPY.feedback`, `ComingSoonPanel`, `FormSuccess` (bindable `titleEl`, optional children snippet for actions) and `FormError` (`subject` prop for the mailto) are ready. Follow WaitlistForm's patterns: no `name` on personal fields, `data-ready` marker, `Date.now()` mount time.
- **`?source=sample`:** the audience-page CTAs now point to `/{portal}/?source=sample`. Handling it in the `(app)` layout (UI-SPEC Planner Note 7) belongs to another plan.
- **10-22:** axe tests are titled `axe: waitlist ... state` in waitlist.spec.ts (coming soon, root + sub) and waitlist.configured.spec.ts (open, invalid, sending, success, error).

## Self-Check: PASSED

- FOUND: all 11 created files and 3 modified files listed above
- FOUND: commits 96706ee, 04f3912, 52f62da, 7f0c355, 6890f40, 413e47a
