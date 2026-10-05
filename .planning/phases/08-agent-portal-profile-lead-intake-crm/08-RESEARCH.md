# Phase 8: Agent Portal: Profile, Lead Intake & CRM - Research

**Researched:** 2026-10-04
**Domain:** Browser-only CRM (Dexie), Web3Forms lead capture, lead/CSV parsing, accessible drag-and-drop, real-estate advertising disclosure and CAN-SPAM composition
**Confidence:** MEDIUM-HIGH. Platform mechanics, CSV, CAN-SPAM, and WCAG are HIGH. Web3Forms email rendering and free-tier edge behavior are MEDIUM/LOW: the docs are thin and the owner has no key yet. State ad rules are MEDIUM: primary sources were fetched, but this is not legal advice.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

The owner chose fully autonomous mode on 2026-10-04. Recommended defaults adopted.

#### Profile & disclosures
- Profile fields: name, brokerage, license number, license state, logo (PNG/SVG uploaded to IndexedDB as a blob; max 512 KB), brand colors (primary/accent with contrast check against white/espresso), postal address, phone, email, website.
- **Disclosure composer** in `packages/core`: given profile → required disclosure line(s) ("{Name}, {License #}, {Brokerage}" + state-specific additions from a small data table for FL/NJ/OH/CA/NY/TX; default generic line otherwise). Appended automatically to every export and generated draft; a unit test asserts presence.

#### Inquiry page & lead capture
- `/agent/inquire/` is a prerendered page whose behavior is configured by **URL query params** encoding the agent's Web3Forms access key + display name (no backend; Web3Forms keys are public-safe by design). The agent copies the share link from `/agent/profile/`.
- Form: name, email, phone (optional), message, property of interest, consent checkbox text ("I agree to be contacted about my inquiry") — **no TCPA-style SMS consent**; honeypot `botcheck`, minimum time-to-submit (3 s), optional hCaptcha only if the agent enables it (hCaptcha script would violate "no third-party scripts" → **not included in v1**; honeypot + timing only).
- Submission posts to `https://api.web3forms.com/submit` (already in `connect-src`/`form-action`) with a structured `TRAN-LEAD v1` block in the message body (key: value lines) so it survives email clients and can be pasted back.
- **Owner key deferred:** the Web3Forms end-to-end test is a HUMAN-UAT item; E2E mocks the endpoint.

#### Lead import & CRM
- **Paste import:** parse `TRAN-LEAD v1` blocks or free-form emails (regex for name/email/phone); show a dry-run diff (new / duplicate / update) before commit; duplicates by normalized email or phone.
- **Manual quick-add** form; **CSV import** (dry-run diff, Zod-mini validated, max 5,000 rows) and **CSV export** (RFC 4180, UTF-8 BOM for Excel).
- **Pipeline** `/agent/pipeline/`: columns New → Contacted → Touring → Offer → Closed; drag-and-drop with a keyboard-accessible alternative (move menu / arrow keys) — a11y requirement; counts per column; 3 smart-list presets (Due today, No contact in 7 days, New this week).
- **Tasks:** per contact, due date, done; `/agent/today/` due-today queue shown on app open; overdue grouping.
- **Activity log** per contact (auto entries for stage changes, drafts marked sent, tasks done).
- All tables Dexie + backup-registered (logo blob included as base64 only if < 512 KB).

#### AI follow-ups
- Prompt `agent/followup.v1`: contact context (PII-minimized), stage, agent notes → email draft; the composer appends the postal address + an opt-out line ("Reply STOP or unsubscribe to stop receiving emails from me") + disclosures. Gated by Fair Housing checker; exits copy / `mailto:` / mark sent (logs activity).

#### Demo credibility
- Sample contacts fixture (synthetic, `example.com`, 555-01xx) when the CRM is empty with a "Load sample contacts" action and a clear "Sample" chip; zero RentCast calls anywhere in `/agent/*` (asserted by a test that the gateway is never imported by `features/agent`).

#### Specific ideas (from CONTEXT `<specifics>`)
- Honest copy: "Import from email" means paste; no inbox connection exists. The inquiry page says leads are emailed to the agent by Web3Forms and are not stored by Tran.

### Claude's Discretion
- DnD library choice (native HTML5 DnD with keyboard fallback vs. a small Svelte 5 lib). Prefer no new dependency.
- CSV column mapping UX.
- Logo size limits.

### Deferred Ideas (OUT OF SCOPE)
- `.ics` export (AGT-V2-01), live webhook leads (AGT-V2-02), `.eml` drop.
- Cut line: smart lists beyond 3 → `.eml` drop (already deferred) → CSV import (keep export).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AGT-01 | Agent can set up a profile (name, brokerage, license number, state, logo, brand colors, postal address) that automatically appends required disclosures to exports and generated content | §State Disclosure Table (FL/NJ/OH/CA/NY/TX, primary sources); §Pattern 6 Disclosure composer; §Pattern 8 Logo storage (magic-byte sniffing, SVG rasterization, **CSP `img-src 'self' blob:` change required**); §Pattern 9 Brand-color check reusing `@tran/brand` `contrastRatio` |
| AGT-02 | Agent can publish a shareable inquiry page that emails new leads to them through their own Web3Forms key, with spam protection | §Web3Forms Facts (fields, response shapes, honeypot deprecated, hCaptcha breaks our page, domain restriction is Pro); §Pattern 2 Inquiry page (separate `(inquiry)` route group, `onMount` param parsing, UUID key validation, extra disclosure params, `noindex`, impersonation copy); §Pattern 3 Web3Forms sink in `lib/leads` |
| AGT-03 | Agent can import leads by pasting a lead email or adding them manually, with duplicate detection | §Pattern 4 `TRAN-LEAD v1` format and whitespace-tolerant fixed-order parser; free-form extraction; §Pattern 5 normalization (email lowercase/NFKC, US phone to E.164) and `diffLeads` (new/duplicate/update/conflict) |
| AGT-04 | Agent can move contacts through a drag-and-drop pipeline (New → Contacted → Touring → Offer → Closed) | §Pattern 7 Native HTML5 DnD plus a "Move to…" menu on every card (WCAG 2.5.7), Phase 3 `LiveAnnouncer`; `aria-grabbed`/`aria-dropeffect` not used (deprecated) |
| AGT-05 | Agent can create follow-up tasks and see a due-today queue when opening the app | §Pattern 10 Tasks with local `YYYY-MM-DD` due dates, `status` string index (booleans are not indexable), injected clock; `/agent/` landing renders the queue |
| AGT-06 | Agent can generate AI follow-up email drafts that include CAN-SPAM elements (postal address, opt-out line) | §CAN-SPAM facts (15 USC 7704, 16 CFR 316.2(p)); §Pattern 11 deterministic footer appended outside the LLM, checked by the Fair Housing checker, included in all 3 exits; **Phase 5 `GenerationPanel` needs `footer`/`tokens`/`onExit` hooks** (Open Question 1) |
| AGT-07 | Agent can import contacts from CSV and export contacts to CSV | §Pattern 12 RFC 4180 parser/serializer in `packages/core` (quote-all, CRLF, BOM, formula-injection escape with symmetric unescape), TextDecoder UTF-8 → windows-1252 fallback, header-synonym mapping, 5,000-row cap, fast-check round-trip property |
</phase_requirements>

## Summary

Phase 8 is a local-first CRM plus a public lead form. It needs no data-layer code and makes **zero RentCast calls**. Almost everything is pure logic: lead-block build/parse, normalization, dedupe diff, CSV, disclosure composition, color contrast, and task date math. All of that belongs in DOM-free `packages/core`, where it can be tested exhaustively under the existing network-blocked Vitest projects. The web app adds Dexie tables (contacts, tasks, activities, agentProfile), Svelte 5 UI for `/agent/*`, and exactly one network adapter: `lib/leads/web3forms-sink.ts`. That folder is already on the ESLint fetch allowlist.

Research turned up six facts the CONTEXT did not anticipate. The planner must design around them:
1. **The inquiry page runs in the visitor's browser, which has no access to the agent's IndexedDB.** Everything it shows must come from the URL. FL, OH, NY, and NJ require the brokerage name on the page, and NJ/NY also require the brokerage phone. The share link therefore needs disclosure params (brokerage, license, state, title, brokerage phone) beyond the key and display name. The logo cannot appear on the inquiry page.
2. **The current CSP blocks the uploaded logo.** `img-src` falls back to `default-src 'self'`, which blocks `blob:` object URLs. Phase 8 must add `img-src 'self' blob:` as a reviewed two-file change (`apps/web/svelte.config.js` and `scripts/assert-csp.mjs`).
3. **Web3Forms now documents the honeypot as deprecated** ("This feature is depreciated. Please use any other captcha."). If an agent enables hCaptcha on their key, every submission from our page fails, because we cannot load the hCaptcha script. Setup copy must tell agents to leave captcha off. The sink must map that error to clear copy. Honeypot and timing are a thin client-side filter. Web3Forms' server-side spam check is the real protection.
4. **Phase 5's `GenerationPanel` contract has no hook for appending a deterministic footer, restoring redaction tokens, or logging "mark as sent" to a contact.** Phase 8 needs all three (Open Question 1).
5. **Flat-config ESLint does not merge `no-restricted-imports` options.** Adding a separate "agent must not import `data`" block would silently replace the existing per-portal rule for the same files. The patterns must be merged into one entry. ESLint also only checks direct imports, so a transitive import-graph test is required as well.
6. **Web3Forms does not document how notification emails render line breaks.** One third-party source says long values arrive as "one unbroken paragraph". The `TRAN-LEAD v1` parser must therefore work when newlines are collapsed (fixed key order, explicit `END TRAN-LEAD` terminator).

**Primary recommendation:** Build Phase 8 as pure `packages/core` modules plus thin Svelte 5 UI, with no new runtime dependencies. Use native HTML5 DnD plus a per-card "Move to…" menu, a hand-written RFC 4180 module (quote-all, BOM, formula-escape), and a `(inquiry)` route group configured from validated query params. Prove it with a transitive import-graph test, a CSV round-trip property test, and Playwright E2E with a mocked Web3Forms endpoint plus a RentCast tripwire.

## Standard Stack

### Core (all already chosen by earlier phases; Phase 8 adds **no runtime dependency**)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Dexie | 4.4.6 (installed by Phase 3) | contacts / tasks / activities / agentProfile tables | Project standard. Compound indexes like `[status+dueDate]` |
| zod (`zod/mini`) | 4.6.x (Phase 3 pins 4.6.4; registry latest 4.6.5, 2026-10-02) | Validate pasted leads, CSV rows, URL params, profile | Project standard at trust boundaries |
| date-fns | 4.4.0 (Phase 3) | Local-date task math, "this week", "7 days without contact" | `parseISO` treats date-only strings as **local** time, unlike `new Date('YYYY-MM-DD')` |
| bits-ui / shadcn-svelte | 2.19.x / 1.6.1 (Phase 3 init) | DropdownMenu ("Move to…"), Dialog, AlertDialog, Tabs, Checkbox | Accessible primitives already reconciled to tokens |
| `@tran/brand` | workspace | `contrastRatio()` / `luminance()` for brand-color checks | Phase 2 Pattern 3: one normative WCAG formula, no npm dependency |
| Phase 5 AI layer | workspace | `GenerationPanel`, `runGeneration`, prompt registry, `redactPii`, Fair Housing checker | Locked: every generated draft goes through it |

### Supporting (dev only)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| fast-check | 4.10.2 (2026-09-19) | Property tests: CSV round-trip, normalization idempotence, lead-block round-trip | Add as a devDependency of `packages/core`. Zero runtime surface. If the planner rejects it, use a seeded hand-written generator (document the seed) |
| fake-indexeddb | 6.2.5 (Phase 3 test stack) | Dexie repo tests in Node | Repository and move/log transaction tests |
| `@playwright/test` + `@axe-core/playwright` | 1.63.0 / 4.13.0 (installed) | E2E with `page.route` mocks, `locator.dragTo`, axe | All UI success criteria |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native HTML5 DnD + Move menu | `svelte-dnd-action` 0.9.79 (peer `svelte >=3.23 \|\| ^5`, updated 2026-08-21) | Built-in keyboard DnD and its own ARIA live instructions (self-described "beta"). Its live region would double-announce alongside Phase 3's single `LiveAnnouncer`, it mutates DOM and ARIA itself, and it adds a dependency. CONTEXT prefers none. Rejected |
| Native HTML5 DnD | `@thisux/sveltednd` 0.8.0 | Svelte 5-native but pre-1.0, with no documented keyboard model. Rejected |
| Hand-written RFC 4180 module | `papaparse` 5.7.0 (270 KB unpacked; `Papa.unparse({escapeFormulae:true})`) | Mature, auto-detects delimiters, streams. But the export side must be hand-controlled anyway (BOM, quote-all, symmetric formula escape), the 5,000-row cap makes streaming moot, and the project removes deps from the key-holding origin (LLM SDKs were dropped for that reason). **Fallback:** if the hand-written parser fails its edge-case suite, swap in papaparse via dynamic `import()` on the import screen only |
| Hand-written US phone normalizer | `libphonenumber-js` 1.13.14 (10 MB unpacked, about 145 KB min metadata) | Overkill for a US-only product. Hand-written NANP normalization is about 20 lines and fully testable |
| Web3Forms | Formspree (free 50/mo, CORS echoes origin, honeypot `_gotcha`) | Locked to Web3Forms. Formspree would need `https://formspree.io` added to `connect-src` (two-file CSP change). Keep a `LeadSink` interface so it can be added later. Not in v1 |

**Installation (only if fast-check is accepted):**
```bash
pnpm --filter @tran/core add -D fast-check@4.10.2
```

**Version verification (npm registry, 2026-10-04):** svelte-dnd-action 0.9.79, papaparse 5.7.0, fast-check 4.10.2, dexie 4.4.6, zod 4.6.5, bits-ui 2.19.5, date-fns 4.4.0, fake-indexeddb 6.2.5. Whatever Phase 3 pins for dexie, zod, and bits-ui wins. Do not bump them in Phase 8.

## Web3Forms Facts (focus area 1)

| Fact | Value | Source / Confidence |
|------|-------|--------------------|
| Endpoint | `POST https://api.web3forms.com/submit`, JSON body with `Content-Type: application/json`, `Accept: application/json` | Official AJAX example (docs.web3forms.com) — HIGH |
| Reserved fields | `access_key` (required), `email` (sets reply-to), `subject`, `replyto`, `from_name` (default sender name "Notifications"), `redirect`, `botcheck`; Pro-only: `ccemail`, `attachment`, `webhook` | API reference + From Name page — HIGH |
| Custom fields | Any other named field is forwarded "as-is" in the notification email | Docs/search summary — MEDIUM |
| Responses | 200 `{success:true, ... message:"Email sent successfully!"}`; 400 `{success:false, ... message:"<description>"}`; 429 `{success:false, message:"Too may requests. Please try later!"}`; 500 `{statusCode:500, error:"Something went wrong on server."}`. `message` appears top-level in the AJAX example and under `body` in the reference, so **read both** (`json.message ?? json.body?.message`) | API reference — HIGH (shape inconsistent in docs) |
| Client vs server | "Use the API client/browser side… Server side usage requires paid plan + server IP whitelisting." An earlier non-browser probe got 403. CORS: ACAO `*` (live preflight 2026-09-13) | Docs + project research — HIGH |
| Access key | "Access key is public." It is a UUID that serves as both form ID and auth token | FAQ (HIGH); UUID format from multiple secondary sources (MEDIUM) |
| Free plan | 250 submissions/month, unlimited forms/domains, 30-day submission history, hCaptcha + server-side spam check | Third-party pricing pages agree (splitforms, form2lead, itsfree.dev); official pricing page returns 403 to automated fetch — MEDIUM |
| Over-limit behavior | **Undocumented.** Treat any 4xx as "couldn't deliver" and show copy that suggests contacting the brokerage | LOW |
| Honeypot | `<input type="checkbox" name="botcheck" style="display:none">`. Docs now say: **"This feature is depreciated. Please use any other captcha."** | Official honeypot page — HIGH |
| Built-in spam filtering | "we do run a server-side spam check on all form submissions" | Official spam page — HIGH |
| hCaptcha | Free uses a shared sitekey and requires loading `https://web3forms.com/client/script.js`. Once enabled in the dashboard, `h-captcha-response` is **mandatory** | Official hCaptcha page — HIGH. **Consequence:** an agent who enables hCaptcha breaks our page (CSP forbids the script). Setup copy says "leave captcha off"; map the resulting 400 message to specific copy |
| Domain restriction | **Pro-only**; "will not work locally" | Official page — HIGH. Free keys can be used from any site, so a harvested key can be spammed from elsewhere. Disclose this honestly in profile setup copy |
| Notification rendering | Undocumented. One third-party post says long values show "as one unbroken paragraph with no line breaks" | formgrid.dev — LOW. **Design the parser to tolerate collapsed whitespace** and verify in HUMAN-UAT across Gmail, Outlook, and Apple Mail |
| Formspree fallback | 50/month account-wide, 2 linked emails, 30-day history, CORS echoes origin, honeypot `_gotcha` | Project research 2026-09-13 — MEDIUM. Not in v1 |

## CAN-SPAM Facts (focus area 6)

| Requirement | Exact source | Phase 8 implementation |
|-------------|--------------|-------------------------|
| Valid physical postal address | 15 USC 7704(a)(5)(A)(iii). 16 CFR 316.2(p): "the sender's current street address, a Post Office box the sender has accurately registered with the United States Postal Service, or a private mailbox the sender has accurately registered with a commercial mail receiving agency…" | Profile `postalAddress` (required to enable follow-up exits). Helper copy: street address, registered PO box, or registered private mailbox |
| Clear and conspicuous opt-out notice | 7704(a)(5)(A)(ii); mechanism = "functioning return electronic mail address or other Internet-based mechanism", working ≥ 30 days (7704(a)(3)) | Locked line: "Reply STOP or unsubscribe to stop receiving emails from me". The agent's reply address is the mechanism |
| Honor opt-outs within 10 business days | 7704(a)(4) | Contact field `emailOptOutAt`. Exits for that contact are gated immediately, with an activity entry. CSV round-trips it |
| Identification as advertisement | 7704(a)(5)(A)(i), **except** with "prior affirmative consent" (7704(a)(5)(B)) | Recommended: contacts with `consentSource: 'inquiry-form'` (they ticked "I agree to be contacted about my inquiry") skip it. Contacts with unknown consent (manual, CSV, free-form paste) get one extra footer line, e.g. "This email is a solicitation for real estate services." (Open Question 6) |
| Accurate headers and non-deceptive subject | FTC compliance guide items 1-2 | The `mailto:` subject comes from the draft. The prompt forbids deceptive subjects ("Re:" on first contact, etc.) |
| Penalty | "up to $53,088" per violating email (FTC guide, fetched 2026-10-04) | Copy and docs only. Never claim compliance, only "includes the elements CAN-SPAM requires" |

TCPA: there is no SMS feature, no `sms:` links, and the consent text is not an SMS consent. An E2E/unit check asserts no `sms:` href under `/agent/*`.

## State Disclosure Table (focus area 6)

This is not legal advice. The project already flags counsel review before the public GTM push. The table is data in `packages/core/src/disclosure/state-rules.ts`, with a `source` on every row.

| State | What ads must show (incl. web/email) | Extra rules relevant to rendering | Source |
|-------|---------------------------------------|-----------------------------------|--------|
| FL | Licensed name of the brokerage firm in all ads. On internet ads, brokerage name "above, below or adjacent to the point of contact information". License # not required | Team/group name may not be larger than the brokerage name and may not use "Real Estate", "Brokerage", "Agency", etc. (61J2-10.026) | Fla. Admin. Code 61J2-10.025 via floridarealtors.org — MEDIUM |
| NJ | Licensee's licensed name plus the broker's regular business name. Broker name **"in larger print or… more prominent"** than the salesperson. Non-linked webpages show the brokerage office **telephone number** | Business cards use "salesperson / sales representative / sales associate" | N.J.A.C. 11:5-6.1 (Cornell LII) — MEDIUM-HIGH |
| OH | Licensee identified by name. Brokerage name "at least in equal prominence" with the salesperson. Internet ads show the brokerage name "on every viewable web page" | — | Ohio Adm. Code 1301:5-1-02 — MEDIUM-HIGH |
| CA | Licensee name, **license identification number**, and **responsible broker's identity** (name under which the broker is licensed, optionally with the broker's license #) on first-point-of-contact solicitation materials incl. electronic media | Excludes fictitious names/team names as the broker identity (10015.4) | Cal. B&P 10140.6(b)(1), 10015.4 (leginfo) — HIGH |
| NY | Name as licensed. Broker/brokerage name plus **either full address or telephone** of the broker. Use the actual licensed title ("Licensed Real Estate Salesperson", not "sales associate") | Every web page; the initial email must carry the info; team names must use "team" | 19 NYCRR 175.25 (Cornell LII) — MEDIUM-HIGH |
| TX | License holder's name or team name, plus the broker's name in **at least half the size** of the largest contact info. "Advertisement" includes email, text, and social | Websites: link to IABS and TREC Consumer Protection Notice (TREC rules, secondary sources) | TREC Rule 535.155 (trec.texas.gov articles; primary page 404'd) — MEDIUM |
| Other | Generic line: name, licensed title, "Licensed in {ST}", license #, brokerage, brokerage phone | NAR Code Art. 12 / SOP 12-5 firm-name disclosure | Project research — MEDIUM |

**Profile fields this table implies** (an extension of the CONTEXT field list, needed to meet the locked "required disclosure" goal):
- `licenseType: 'salesperson' | 'associate-broker' | 'broker'`, which drives the title text, especially for NY and NJ.
- `brokeragePhone`, required when the state is NJ or NY. It is also the only contact shown on the inquiry page, so the agent's personal email is never rendered.
- `brokerageLicenseNumber` (optional; CA may show it).
- `iabsUrl` (optional; TX web pages).

Teams are out of scope. There is no team field, so the composer never emits team names.

**Rendering rule for any page Tran renders** (inquiry page now, Phase 9 reports later): the brokerage name is shown at **equal or larger** type than the agent's name. One rule satisfies NJ (larger/more prominent), OH (equal), TX (≥ half), and FL (adjacent to contact info).

## Architecture Patterns

### Recommended Project Structure
```
packages/core/src/
├── leads/
│   ├── lead-block.ts          # buildLeadBlock(fields) / parseLeadBlocks(text) — TRAN-LEAD v1
│   ├── parse-freeform.ts      # email/phone/labelled-name extraction from pasted email text
│   ├── normalize.ts           # normEmail, normPhoneUS, normalizeText (NBSP, ZW chars, bidi, quotes)
│   └── diff-leads.ts          # diffLeads(incoming, existing) → new / duplicate / update / conflict
├── csv/
│   ├── csv.ts                 # parseCsv / toCsv (RFC 4180, quote-all, CRLF, BOM) + formula escape
│   └── contact-columns.ts     # canonical columns, header synonyms, row → ContactDraft via zod/mini
├── disclosure/
│   ├── state-rules.ts         # FL/NJ/OH/CA/NY/TX + generic (data with source citations)
│   └── compose.ts             # composeDisclosure(profile, context) / composeEmailFooter(profile, contact)
├── crm/
│   ├── pipeline.ts            # STAGES, moveContact() pure transition → {contact', activity}
│   ├── tasks.ts               # dueToday / overdue / upcoming (injected `today: string`)
│   └── smart-lists.ts         # dueToday, noContact7d, newThisWeek (injected clock)
└── brand-color.ts             # assessBrandColor(hex) using @tran/brand contrastRatio (or put in @tran/brand)

apps/web/src/lib/
├── leads/web3forms-sink.ts    # the ONLY fetch in Phase 8 (folder already fetch-allowlisted)
├── storage/agent/             # Dexie table decls + repos (contacts, tasks, activities, agentProfile) + backup registration
└── features/agent/
    ├── profile/               # ProfileForm, LogoField, BrandColorField, DisclosurePreview, ShareLinkBuilder
    ├── crm/                   # ContactList, QuickAdd, ContactDetail, ActivityLog, SampleChip
    ├── import/                # PasteImport, CsvImport (mapping table), LeadDiffPreview, CsvExportButton
    ├── pipeline/              # PipelineBoard, PipelineColumn, ContactCard, MoveMenu
    ├── tasks/                 # TaskList, TodayQueue
    ├── followup/              # FollowupPanel (wraps Phase 5 GenerationPanel) + prompt agent/followup.v1
    └── fixtures/sample-contacts.ts   # scanned by the real-data guard (path matches /fixtures/)

apps/web/src/routes/
├── (app)/agent/+page.svelte          # landing: TodayQueue first ("on app open"), sub-nav links
├── (app)/agent/profile/+page.svelte
├── (app)/agent/contacts/+page.svelte # list + quick add + paste import + CSV import/export
├── (app)/agent/contact/+page.svelte  # ?id= read in onMount (no [param] routes)
├── (app)/agent/pipeline/+page.svelte
├── (app)/agent/today/+page.svelte
└── (inquiry)/agent/inquire/+page.svelte + (inquiry)/+layout.svelte   # visitor-facing, minimal layout
```

Every new route must be (a) linked from a statically rendered element so the prerender crawler sees it (`handleUnseenRoutes: 'fail'`), or added to `kit.prerender.entries`, and (b) added to `EXPECTED_PAGES` in `scripts/assert-csp.mjs` and to the shared E2E `routes.ts` from Phase 2 (Pitfall 13 in 02-RESEARCH: route lists drift). Put the agent sub-nav as static links in an `(app)/agent/+layout.svelte`. That covers the crawler for every agent route. Also add the `/agent/inquire/` "Preview your inquiry page" link to `/agent/profile/` as a static href with no params. Query strings do not affect route matching or `handleUnseenRoutes`; the crawler only needs the path.

### Pattern 1: Dexie tables (Syncable, indexable fields only)
**What:** Four tables registered with the Phase 3 base and the backup registry.
```ts
// Shape (Phase 3 Syncable: id, ownerId:'local', createdAt, updatedAt, deletedAt, schemaVersion)
contacts:    'id, stage, emailNorm, phoneNorm, createdAt, updatedAt, lastContactedAt, deletedAt'
tasks:       'id, contactId, [status+dueDate], updatedAt, deletedAt'   // status: 'open' | 'done'
activities:  'id, contactId, [contactId+at], at'
agentProfile:'id'                                                      // singleton id 'profile'
```
- **IndexedDB cannot index booleans, and `null`/`undefined` keys are left out of the index.** Use `status: 'open'|'done'` (string) for tasks, and keep `done` only as a derived getter. A missing `emailNorm` simply isn't indexed, which is fine for lookups.
- `dueDate` is a **local date string `YYYY-MM-DD`**, not a timestamp. Timestamps are ISO strings with time.
- Contact fields: `name, email, emailNorm, phone, phoneNorm, stage, source ('inquiry'|'paste'|'manual'|'csv'|'sample'), propertyOfInterest, notes, consentSource ('inquiry-form'|'unknown'), emailOptOutAt, lastContactedAt, sample: boolean`.
- **Move, task-done, and mark-sent write the contact and its activity in one Dexie transaction** (`db.transaction('rw', db.contacts, db.activities, …)`).
- Logo: store `{ bytes: Uint8Array, mime: 'image/png'|'image/svg+xml', width, height }` instead of a `Blob`. ArrayBuffer and typed arrays structured-clone everywhere (fake-indexeddb, Safari), and base64 for backup is trivial. Create the `Blob` and object URL only at render time.

### Pattern 2: Inquiry page configured by query params (prerendered, visitor-facing)
**What:** `routes/(inquiry)/agent/inquire/+page.svelte` in its **own route group**, with a minimal `(inquiry)/+layout.svelte`. It shows no portal nav, no AppNotice/backup banner, and never imports `storage`, `ai`, `data`, or the vault. Add an ESLint `no-restricted-imports` block for `routes/(inquiry)/**`, mirroring the marketing rule. Route groups do not affect URLs, so `(app)/agent/*` and `(inquiry)/agent/inquire/` coexist.

Kit docs: **"Accessing `url.searchParams` during prerendering is forbidden… only [use it] in the browser (for example in `onMount`)."** The prerendered HTML shows a neutral h1 plus "Loading this inquiry form…". `onMount` parses `location.search`.

**Params** (short names, all optional except `k`, `n`, `b`):

| Param | Meaning | Validation |
|-------|---------|-----------|
| `k` | Web3Forms access key | `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i` |
| `n` | Agent display name | 1-80 chars after `cleanText` |
| `b` | Brokerage name (required on page: FL/OH/NY/NJ/TX/CA) | 1-120 chars |
| `t` | Licensed title code (`s`/`ab`/`b`) | enum |
| `st` | License state | USPS 2-letter allowlist |
| `lic` | License # | ≤ 30, `/^[A-Za-z0-9 .#\-\/]+$/` |
| `ph` | Brokerage phone | `normPhoneUS` must succeed; displayed in national format |
| `v` | Link format version (`1`) | enum. Unknown → "This inquiry link was made by a newer version" |

Invalid or missing `k`/`n`/`b` renders an **"This inquiry link is incomplete"** state with an h1, no form, and copy telling the visitor to ask the agent for a new link.

**Security:**
- Render params only through Svelte text interpolation, never `{@html}` (existing lint rule).
- `cleanText` strips C0/C1 controls, bidi overrides (U+202A-202E, U+2066-2069), and zero-width characters, then NFKC-normalizes.
- `<svelte:head>` adds `<meta name="robots" content="noindex">` so spoofed links aren't indexed.
- **Impersonation is inherent:** anyone can craft `?k=attacker&n=Famous Agent`. Visible copy states: "This form is provided by {n} of {b}. Tran Real Estate Tools doesn't verify agents and doesn't store your inquiry. It's emailed to the agent by Web3Forms, a third-party form service."
- The key is public by design, so a query string is acceptable. **Carve it out explicitly** from the project rule "never put keys in URLs/backups". The Web3Forms key is a profile field, not a vault secret, and lives in `agentProfile`, never in the vault. The Phase 3 key-free backup scanner must not refuse it. Use a low-entropy test UUID (`00000000-0000-4000-8000-000000000000`) so gitleaks' generic-api-key rule never fires.

**Share-link builder** (on `/agent/profile/`, agent's browser):
```ts
import { resolve } from '$app/paths';
export function buildInquiryUrl(origin: string, p: InquiryParams): string {
	const url = new URL(resolve('/agent/inquire/'), origin); // respects BASE_PATH sub-path
	const q = url.searchParams;
	q.set('v', '1'); q.set('k', p.key); q.set('n', p.name); q.set('b', p.brokerage);
	if (p.title) q.set('t', p.title); if (p.state) q.set('st', p.state);
	if (p.license) q.set('lic', p.license); if (p.brokeragePhone) q.set('ph', p.brokeragePhone);
	return url.toString(); // URLSearchParams percent-encodes; never hand-concatenate
}
```
Unit-test that `parseInquiryParams(new URL(buildInquiryUrl(...)).search)` round-trips, under both the root and `/tran_real_estate` bases.

### Pattern 3: Web3Forms sink (the single network adapter)
```ts
// apps/web/src/lib/leads/web3forms-sink.ts  (fetch allowed here by eslint.config.js)
export type SinkResult =
	| { ok: true }
	| { ok: false; kind: 'rejected' | 'captcha-required' | 'rate-limited' | 'server' | 'network'; detail?: string };

export async function submitInquiry(input: InquiryPayload, fetchImpl: typeof fetch = fetch): Promise<SinkResult> {
	const body = {
		access_key: input.key,
		subject: `New inquiry from ${input.name} (Tran inquiry page)`,
		from_name: `Tran inquiry page for ${input.agentName}`,
		name: input.name,
		email: input.email,             // reserved: becomes reply-to, so the agent can just reply
		phone: input.phone ?? '',
		property_of_interest: input.property ?? '',
		message: input.message,
		consent: 'Yes: I agree to be contacted about my inquiry',
		tran_lead_v1: buildLeadBlock(input) // dedicated field; see Pattern 4
		// botcheck deliberately omitted: honeypot is evaluated client-side and a tripped
		// honeypot never reaches this function (Web3Forms' handling of botcheck:false is undocumented)
	};
	let res: Response;
	try {
		res = await fetchImpl('https://api.web3forms.com/submit', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
			body: JSON.stringify(body)
		});
	} catch { return { ok: false, kind: 'network' }; } // CORS / offline / blocker
	const json = await res.json().catch(() => ({}));
	const message: string = json.message ?? json.body?.message ?? '';
	if (res.ok && json.success) return { ok: true };
	if (res.status === 429) return { ok: false, kind: 'rate-limited' };
	if (res.status >= 500) return { ok: false, kind: 'server' };
	if (/captcha/i.test(message)) return { ok: false, kind: 'captcha-required', detail: message };
	return { ok: false, kind: 'rejected', detail: message };
}
```
- The client-side gate runs before calling the sink. If the honeypot is checked → show the normal success state and make **no request**. If less than 3 s has passed since mount (`performance.now()`) → show "Please take a moment to check your details, then send again." and make no request. Don't drop silently: fast humans and autofill exist.
- The honeypot is a visually hidden checkbox with `tabindex="-1"`, `autocomplete="off"`, and `aria-hidden="true"` inside a `display:none` wrapper. Axe ignores `display:none` content.
- No native form fallback: the key is only known at runtime, and Phase 1's `<html hidden>` frame guard needs JS anyway. The `<form>` has no `action` and uses `preventDefault`.
- Error copy never shows the agent's email. The fallback is the brokerage phone (`ph`) when present.

### Pattern 4: `TRAN-LEAD v1` block, robust to collapsed whitespace and quoting
**Format** (fixed key order; single-line values have CR/LF collapsed to a space at build time; the message is last):
```
TRAN-LEAD v1
name: Jordan Example
email: jordan@example.com
phone: (555) 555-0142
property: 12 Sample Lane, Harlow Springs
consent: yes
submitted: 2026-10-04T15:04:05Z
message: Could we tour Saturday?
Second line of the message.
END TRAN-LEAD
```
**Parser algorithm** (`parseLeadBlocks(text)` returns `ParsedLead[]`; supports several blocks per paste):
1. `normalizeText`: `\r\n|\r → \n`. NBSP/U+2007/U+202F → space. Strip U+200B-U+200D and U+FEFF. Strip leading quote markers `^(>\s?)+` per line (forwarded mail). NFKC.
2. Find each `/TRAN-LEAD\s+v(\d+)/gi`. Version ≠ 1 → `{error:'newer-version'}`. The block ends at the next `/END\s+TRAN-LEAD/i` or the next `TRAN-LEAD v` or end of text.
3. Inside the block, **search the keys sequentially in the fixed order** `name, email, phone, property, consent, submitted, message`, each as `/(?:^|\s)KEY:\s*/i` starting from the end of the previous key. A value runs until the next found key's start. The message runs to the block end. This works whether newlines survive or are collapsed to spaces. A `name:` string inside the message can't override earlier keys because the search only moves forward.
4. Validate with zod/mini (lengths: name ≤ 120, property ≤ 300, message ≤ 5,000; email via `normEmail`; phone via `normPhoneUS`, falling back to keeping the raw value without a `phoneNorm`).
5. **Everything is untrusted:** anyone holding the public key can post arbitrary blocks. Values only ever render as text.

Free-form fallback (`parseFreeform`): extract every email (`[^\s<>()"',;:]+@[^\s<>()"',;:]+\.[A-Za-z]{2,}`) and NANP phone, plus a name **only** from labelled lines (`Name:`, `From: Jane Doe <…>`). Otherwise the name is left blank for the agent to fill in the preview. Never guess names from prose.

**Why a dedicated field `tran_lead_v1`** instead of appending to `message`: the visitor's free text stays clean in its own row of the notification email, and the block is still "in the message body" of the email the agent receives.

### Pattern 5: Normalization and dedupe diff
```ts
export function normEmail(raw: string): string | null {
	const e = raw.normalize('NFKC').trim().toLowerCase();
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
	// Do NOT strip dots or +tags: correct only for some providers and would merge distinct people.
}
export function normPhoneUS(raw: string): string | null {
	const main = raw.split(/\s*(?:x|ext\.?|extension|#)\s*\d+\s*$/i)[0]; // drop extension
	const d = main.replace(/\D/g, '');
	const ten = d.length === 11 && d.startsWith('1') ? d.slice(1) : d.length === 10 ? d : null;
	if (ten && /^[2-9]\d{2}[2-9]\d{6}$/.test(ten)) return `+1${ten}`;      // NANP shape
	if (main.trim().startsWith('+') && d.length >= 8 && d.length <= 15) return `+${d}`; // intl, unvalidated
	return null; // un-normalizable: keep raw, never dedupe on it
}
export const formatPhoneUS = (e164: string) =>
	/^\+1(\d{3})(\d{3})(\d{4})$/.test(e164) ? e164.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, '($1) $2-$3') : e164;
```
`diffLeads(incoming, existing)` uses lookup maps over **non-tombstoned** contacts:
- **new**: no match.
- **duplicate**: matched, and every incoming non-empty field equals the stored one.
- **update**: matched (by email or phone), and incoming fills blanks or adds a message. Rule: **fill blanks only, never overwrite a non-empty field silently.** Changed non-empty fields are listed field-by-field and need a per-row choice (keep / use incoming).
- **conflict**: the email matches contact A and the phone matches contact B. The default action is "skip". The user can pick a target.
- In-batch duplicates (the same person twice in one paste/CSV) collapse before diffing.
- Messages from inquiries become an `activity` (`type: 'inquiry'`), never overwriting `notes`.

Reuse the **Phase 3 `ImportPreview` presentation** (table with caption, tabular-nums, single transaction, focus to the preview `h3`), but not its id/updatedAt merge semantics. Lead matching is by identity, not record id.

### Pattern 6: Disclosure composer
```ts
export type DisclosureContext = 'email' | 'web' | 'social' | 'print';
export interface DisclosureResult { lines: string[]; text: string; missing: ProfileField[] }
export function composeDisclosure(p: AgentProfile, ctx: DisclosureContext): DisclosureResult;
export function composeEmailFooter(p: AgentProfile, c: Pick<Contact,'consentSource'>): { text: string; missing: ProfileField[] };
// footer = [adIdentification if consentSource!=='inquiry-form'] + disclosure lines + postal address + opt-out line
```
- Rules come from `STATE_RULES[p.licenseState] ?? GENERIC_RULE`. Each rule lists required fields (e.g. CA: `licenseNumber`; NJ/NY: `brokeragePhone`) and a template.
- `missing` drives a persistent "Complete your profile" notice on `/agent/profile/` and **gates the follow-up exits** when `postalAddress`, `name`, or `brokerage` is missing (CAN-SPAM and every state).
- The output is plain text with no HTML and no `{@html}`.
- **Scope:** disclosures are appended to consumer-facing content: follow-up drafts (Phase 8), the inquiry page (Phase 8), and Phase 9 content and reports. They are **not** appended to CSV contact exports or JSON backups. Those are data files, and a disclosure row would break RFC 4180 round-trips and re-import (Open Question 2).

### Pattern 7: Accessible pipeline (native DnD plus a Move menu)
**What:** Five `<section aria-labelledby>` columns, each with an `h2` like "Touring" followed by a count ("Touring, 4 contacts" as accessible text) and a `<ul>` of cards. Each card (`<li>`) holds a link to `/agent/contact/?id=` and a **"Move to…" button** that opens a bits-ui DropdownMenu listing the other four stages. The menu is the keyboard, screen-reader, touch, and single-pointer path. It satisfies **WCAG 2.2 SC 2.5.7 Dragging Movements (AA)**: "All functionality that uses a dragging movement for operation can be achieved by a single pointer without dragging". G219 lists "pop-up menus with click/tap options" as sufficient. Drag is a progressive enhancement for mouse users.
```svelte
<li draggable="true"
    ondragstart={(e) => { e.dataTransfer?.setData('text/plain', c.id); e.dataTransfer!.effectAllowed = 'move'; }}>
	…<MoveMenu contact={c} onmove={(stage) => move(c.id, stage)} />
</li>
<!-- column -->
<ul ondragover={(e) => { e.preventDefault(); e.dataTransfer!.dropEffect = 'move'; }}
    ondrop={(e) => { e.preventDefault(); const id = e.dataTransfer?.getData('text/plain'); if (id) move(id, stage); }}>
```
- `setData` in `dragstart` is required for Firefox to start a drag.
- `move()` calls the core `moveContact` (pure) and then a Dexie transaction that writes the contact plus a `stage_changed` activity. It then announces through the Phase 3 `LiveAnnouncer`: "Moved {name} to Touring. Touring now has 4 contacts." After a menu move, focus goes to the moved card's Move button in its new column (`await tick()`, then focus by `data-contact-id`). Use a keyed `{#each}`.
- **Do not use `aria-grabbed`/`aria-dropeffect`** (deprecated in ARIA 1.1, no AT support). The live-region announcement is the feedback.
- Within a column, contacts are sorted by `lastContactedAt ?? createdAt` descending. No manual in-column reordering, so there is no fractional-index complexity.
- Below 640px, columns stack vertically (UI-SPEC decides). Drag is optional there. The Move menu always works.
- Svelte may emit `a11y_no_static_element_interactions` for drag handlers on `<ul>`/`<li>`. Use a targeted `<!-- svelte-ignore -->` with a comment that the Move menu is the accessible equivalent (LOW: confirm what the compiler actually emits).
- E2E: Playwright `locator.dragTo()` drives native HTML5 DnD in Chromium.

### Pattern 8: Logo storage and display
- **Limits:** ≤ 512 KB (locked). Reject raster images over 4096 px on either side. Accept PNG and SVG (locked list).
- **Type sniffing (never trust `file.type` or the extension):** PNG = first 8 bytes `89 50 4E 47 0D 0A 1A 0A`. SVG = UTF-8 text which, after optional BOM, whitespace, `<?xml …?>`, comments, and `<!DOCTYPE svg…>`, starts with `<svg`. Anything else → "Choose a PNG or SVG file".
- **SVG → rasterize to PNG on upload** (longest side 1024 px, via `<img src=blob:>` → `<canvas>` → `canvas.toBlob('image/png')`), and store only the PNG. Reason: an SVG `blob:` URL opened as a top-level document ("Open image in new tab") runs **in the app's origin**, which holds API keys. Rasterizing removes that class of bug without hand-writing an SVG sanitizer. SVGs without `width`/`height` need the `viewBox` read to size the canvas. If the rasterized PNG exceeds 512 KB, downscale and try again.
- **CSP change (required):** add `'img-src': ['self', 'blob:']` to `kit.csp.directives` **and** to `EXACT` in `scripts/assert-csp.mjs`, in one commit, with a CSP E2E proving a `blob:` image loads. `blob:` URLs can only be minted by same-origin script, so this does not widen the exfiltration surface. `connect-src` stays unchanged. Phase 6 will also touch `img-src` (OSM tiles), so coordinate if both land in wave {6,7,8}.
- Render with `<img src={objectUrl} alt="{brokerage} logo">` and `URL.revokeObjectURL` in the effect cleanup. Never inline SVG markup.
- Backup: `bytes` → base64 inside the backup registry entry (only if < 512 KB, which is always true after the cap). **The Phase 3 key-free scanner must not run a generic high-entropy detector over the logo field** (base64 is high-entropy). Scan by known key prefixes and exact vault values (Open Question 9).

### Pattern 9: Brand colors
```ts
import { contrastRatio } from '@tran/brand';
const WHITE = '#FFFFFF', ESPRESSO = '#2B1D16', IVORY = '#FBF7F0';
export function assessBrandColor(hex: string) {
	const h = normalizeHex(hex); // #rgb → #rrggbb, lowercase; invalid → null
	if (!h) return { valid: false } as const;
	const onWhite = contrastRatio(h, WHITE), onEspresso = contrastRatio(h, ESPRESSO);
	const textOn = onWhite >= 4.5 ? WHITE : onEspresso >= 4.5 ? ESPRESSO : null; // label color on a brand fill
	return { valid: true, hex: h, onWhite, onEspresso, onBackground: contrastRatio(h, IVORY),
		textOn, usableAsFill: textOn !== null, usableAsText: contrastRatio(h, IVORY) >= 4.5,
		usableAsUi: contrastRatio(h, IVORY) >= 3 } as const;
}
```
Mid-tones can fail **both** white and espresso (e.g. luminance ≈ 0.18: about 4.57 vs white but 3.6 vs espresso). The UI then shows "This color is too light/dark for readable text. Tran will use its own colors for text and buttons." and falls back to Phase 2 tokens. Phase 9 consumes the same function (09-CONTEXT: "must pass the contrast check from Phase 8"). Use `<input type="color">` paired with a labelled hex text field, because the color picker's accessibility varies by browser.

### Pattern 10: Tasks and the due-today queue
```ts
// packages/core/src/crm/tasks.ts — pure; caller passes today = format(new Date(), 'yyyy-MM-dd')
export const isDueToday = (t: Task, today: string) => t.status === 'open' && t.dueDate === today;
export const isOverdue  = (t: Task, today: string) => t.status === 'open' && t.dueDate < today; // ISO date strings compare lexically
```
- `/agent/` (the portal entry, "when opening the app") renders `TodayQueue` first: Overdue (grouped, oldest first) → Due today → link to `/agent/today/`. Don't auto-redirect, which would break Back.
- Smart lists: **Due today** (contacts with an open task due today or overdue); **No contact in 7 days** (`lastContactedAt` older than 7 calendar days, or never contacted and created more than 7 days ago; excludes Closed); **New this week** (`createdAt` ≥ `startOfWeek(today, { weekStartsOn: 0 })`, US convention). `lastContactedAt` is set by stage change to Contacted or later, "Mark as sent", or a manual "Log contact" activity.
- Never call `new Date('2026-10-04')`: that parses as UTC midnight, which is the previous evening in every US zone. Use date-fns `parseISO` (local) or string comparison.

### Pattern 11: AI follow-up composition
- Prompt `agent/followup.v1` (registered in the Phase 5 registry, `containsClientData: true`) receives stage, agent notes, property of interest, days since last contact, and a **first-name token** `{client_first_name}`. It never receives email or phone. The system prompt instructs the model to keep the token literal, write no signature block (Tran appends it), use no fake urgency, and write a non-deceptive subject.
- **Final text = `fillTokens(llmText, { client_first_name })` + "\n\n" + `composeEmailFooter(profile, contact).text`.** The footer is appended **outside the LLM**, so the model cannot drop or alter it. The Fair Housing checker runs on the **final** text. All three exits (Copy, `mailto:` body, Mark as sent) use the final text. The footer is shown read-only below the draft with the label "Added to every email".
- Exits are gated when: `emailOptOutAt` is set ("{name} asked not to receive emails. Tran won't draft emails to them."), the contact has no email (mailto gated, Copy allowed), or the footer reports `missing` postal/name/brokerage ("Add your postal address in Profile. Commercial emails must include one.").
- "Mark as sent" → contact activity `draft_sent` + `lastContactedAt` + stage stays put (no auto-advance), all in one transaction.

### Pattern 12: CSV (RFC 4180) import and export
```ts
// packages/core/src/csv/csv.ts
const TRIGGER = /^[=+\-@\t\r\n]/;                       // OWASP CSV-injection leading chars
export const escapeFormula = (v: string) => (TRIGGER.test(v) || /^'+[=+\-@\t\r\n]/.test(v) ? `'${v}` : v);
export const unescapeFormula = (v: string) => (/^'+[=+\-@\t\r\n]/.test(v) ? v.slice(1) : v); // exact inverse

export function toCsv(rows: string[][]): string {        // quote EVERY field: valid RFC 4180, trivially safe
	const line = (r: string[]) => r.map((v) => `"${escapeFormula(v).replace(/"/g, '""')}"`).join(',');
	return '\uFEFF' + rows.map(line).join('\r\n') + (rows.length ? '\r\n' : '');
}

export function parseCsv(input: string): string[][] {   // RFC 4180 + lenient CR/LF/CRLF
	const s = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
	const rows: string[][] = []; let row: string[] = []; let f = ''; let q = false; let quotedField = false;
	for (let i = 0; i < s.length; i++) {
		const c = s[i];
		if (q) {
			if (c === '"') { if (s[i + 1] === '"') { f += '"'; i++; } else q = false; }
			else f += c;
		} else if (c === '"' && f === '' && !quotedField) { q = true; quotedField = true; }
		else if (c === ',') { row.push(f); f = ''; quotedField = false; }
		else if (c === '\r' || c === '\n') {
			row.push(f); rows.push(row); row = []; f = ''; quotedField = false;
			if (c === '\r' && s[i + 1] === '\n') i++;
		} else f += c;
	}
	if (q) throw new CsvError('unterminated-quote');
	if (f !== '' || row.length) { row.push(f); rows.push(row); }
	return rows;
}
```
- **Round-trip property (fast-check):** for any `string[][]` with ≥ 1 row and ≥ 1 column (arbitrary unicode incl. `"`, `,`, `\r`, `\n`, `=`, `'`), `parseCsv(toCsv(rows)).map(r => r.map(unescapeFormula))` deep-equals `rows`. Add a second property for contacts: `importContacts(exportContacts(cs))` equals `cs` on exported fields.
- **Decoding:** `file.arrayBuffer()` → `new TextDecoder('utf-8', { fatal: true })`. On `TypeError`, retry with `new TextDecoder('windows-1252')`, because Excel's plain "CSV (Comma delimited)" isn't UTF-8. The UTF-8 decoder strips a BOM by default. Cap file size at 5 MB before reading.
- **5,000-row cap:** count data rows (after the header, ignoring fully blank rows). If over the cap, reject with "This file has {n} rows. Tran imports up to 5,000 at a time. Split the file and import each part." Never truncate silently.
- **Export columns** (stable order, snake_case header): `name,email,phone,stage,source,property_of_interest,notes,consent_source,email_opt_out_at,created_at,last_contacted_at,id`. Phones are exported in **national format `(555) 555-0142`**: E.164 `+1…` would be formula-escaped (`+` is a trigger) and Excel would coerce it to a number. Filename `tran-contacts-YYYY-MM-DD.csv`. Download via `<a download href={objectURL}>` (Phase 3 pattern; no CSP change).
- **Column mapping UX:** auto-map headers by a synonym table (case/space/punctuation-insensitive): name ← `name, full name, contact, contact name, client`; first+last ← `first name`+`last name` (joined); email ← `email, e-mail, email address, email 1, primary email`; phone ← `phone, phone number, mobile, cell, phone 1`; stage ← `stage, status, pipeline stage`; notes ← `notes, note, comments`; property ← `property, address, property of interest`. Show a mapping table (`<table>`, caption, one `<select>` per file column with a visible label: "{File column} → Tran field | Don't import"). The user can change any mapping. At least one of name/email/phone must be mapped. Unknown stage values → `new`, counted in the preview ("12 rows had a stage Tran doesn't use; they'll start in New"). The Tran export headers map 1:1 automatically.
- Row validation via zod/mini per row. Invalid rows are listed by line number with the reason, and are skipped (not fatal) unless every row is invalid.

### Anti-Patterns to Avoid
- **Reading `page.url.searchParams` in the component's top-level script** on a prerendered route: the build fails. Read it only in `onMount`.
- **Reading the agent profile from Dexie on `/agent/inquire/`:** the visitor doesn't have it. Everything comes from the URL.
- **Letting the LLM write the footer/disclosure/opt-out:** it can drop or alter it. Append deterministically.
- **Separate flat-config blocks for `no-restricted-imports` on the same files:** the later block replaces the earlier rule's options instead of merging them. Merge the patterns into one entry.
- **Indexing booleans in Dexie** (`done`, `sample`): it silently never matches.
- **Overwriting contact fields on import:** fill blanks only; show changed non-empty fields.
- **`{@html}` for any lead text, CSV cell, URL param, or SVG:** never.
- **`window.confirm` for delete/replace:** banned by Phase 3. Use `ConfirmDialog`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SVG sanitization | A regex or DOM SVG sanitizer | Rasterize to PNG on upload (canvas) | SVG has dozens of script/exfil vectors (`<script>`, `on*`, `<foreignObject>`, `<use href>`, CSS `url()`). Rasterizing removes the attack surface |
| WCAG contrast math | A new implementation | `@tran/brand` `contrastRatio()` (Phase 2) | One normative formula, already verified against the UI-SPEC matrix |
| Accessible menus, dialogs, focus trapping | Custom popovers | bits-ui DropdownMenu / Dialog / AlertDialog (Phase 3 copy-ins) | Focus return, Escape, typeahead, roving focus |
| Screen-reader announcements | A second live region per feature | Phase 3 `LiveAnnouncer` / `announce()` | One polite region app-wide (locked in Phase 3) |
| Draft generation, redaction, Fair Housing gating, exits | Agent-specific copies | Phase 5 `GenerationPanel` + extension props | Locked: exactly three exits, checker on every output |
| Import preview table, single-transaction commit | A new preview UI | Phase 3 `ImportPreview` presentation patterns | Same a11y contract (caption, scroll wrapper, focus to `h3`) |
| Date arithmetic (week start, day diffs) | Manual ms math | date-fns (`startOfWeek`, `differenceInCalendarDays`, `parseISO`, `format`) | DST and UTC-parse traps |
| URL building | String concatenation | `URL` + `URLSearchParams` + `resolve()` | Encoding and base path |
| Text encoding detection | Heuristics | `TextDecoder('utf-8', {fatal:true})` → `windows-1252` fallback | Native, exact |

**Hand-rolled on purpose (bounded, fully tested):** the RFC 4180 parser/serializer (about 40 lines, quote-all output, property-tested; papaparse is the fallback), US phone normalization (NANP only), and the `TRAN-LEAD` parser (our own format).

## Common Pitfalls

### Pitfall 1: hCaptcha enabled on the agent's key breaks the inquiry page
**What goes wrong:** The agent turns on "hCaptcha" in the Web3Forms dashboard (the docs recommend it). Every submission from our page now fails, because `h-captcha-response` is mandatory and our CSP forbids the hCaptcha script.
**How to avoid:** Profile setup copy says: "Leave captcha off in Web3Forms. Tran's page can't load third-party captcha scripts. Tran uses a hidden spam trap and a short time check instead, and Web3Forms filters spam on its side." The sink maps a 400 whose message mentions captcha → `captcha-required`. Visitor copy then says the form isn't set up correctly and offers the brokerage phone. Profile shows a "Send a test inquiry" link, which is the HUMAN-UAT step.
**Warning signs:** Real test submission returns 400.

### Pitfall 2: Honeypot gives a false sense of protection
**What goes wrong:** Web3Forms calls the honeypot deprecated. The public key can be harvested from any share link and spammed from anywhere (domain restriction is Pro-only), burning the 250/month quota.
**How to avoid:** Honest copy in profile: "Anyone who sees your link can see your Web3Forms key. That's how Web3Forms is designed. If you get spam, create a new key in Web3Forms and update your link here." Provide a "Replace key" flow that regenerates the share link. Don't claim "spam-proof".

### Pitfall 3: Email clients mangle the lead block
**What goes wrong:** Newlines collapse, NBSPs appear, forwarded mail adds `> `, Outlook Safe Links rewrite URLs, Gmail hides quoted text behind "…".
**How to avoid:** Pattern 4: sequential fixed-order key search, an explicit terminator, normalization, and no URLs in the block. Unit fixtures cover multiline, collapsed single-line, `> `-quoted, NBSP-laden, CRLF, two blocks in one paste, and a block with a forged `name:` inside the message. HUMAN-UAT pastes a real email from Gmail web, Outlook, and Apple Mail.

### Pitfall 4: ESLint boundary silently overwritten or bypassed
**What goes wrong:** (a) A new `{ files: [features/agent/**], rules: { 'no-restricted-imports': … data … } }` block placed after the existing per-portal block **replaces** the cross-portal patterns for those files. (b) ESLint only sees direct imports: `features/agent → features/shared/x → lib/data` passes lint.
**How to avoid:** (a) In `eslint.config.js`, build the agent patterns as `[...crossPortal, forbid(['data'], 'The agent CRM never touches the RentCast gateway.')]` inside the **same** `PORTALS.map` entry (special-case `agent`). Extend `scripts/eslint-rules.test.ts` with an in-memory `lintText` fixture proving both the cross-portal and the data ban fire for `lib/features/agent/x.ts`. (b) Add a transitive import-graph test (Validation Architecture). **Phase 9 conflict:** `/agent/studio/` snapshot needs the gateway. Scope the ban to `features/agent/**` and `routes/(app)/agent/**` **excluding** `features/agent/studio/**` and `routes/(app)/agent/studio/**` (flat-config `ignores` on that block) (Open Question 5).

### Pitfall 5: Barrel files pull the gateway in transitively
**What goes wrong:** Importing `ProvenanceChip` from a `features/shared` barrel that also re-exports gateway-backed stores drags `lib/data` (and RentCast fixtures) into agent chunks.
**How to avoid:** The agent imports shared components by deep file path. The graph test fails on any `lib/data` reach. For the "Sample" chip, reuse Phase 4's `ProvenanceChip` only if its own import graph is clean, otherwise use the Phase 3 `badge` with the identical visual.

### Pitfall 6: Logo invisible in production (CSP)
**What goes wrong:** `<img src="blob:…">` is blocked because `img-src` falls back to `default-src 'self'`. It works in `vite dev` (no CSP meta there), so the bug only appears in the built site.
**How to avoid:** The two-file CSP change plus an E2E against the **built** site (`pnpm build:root`/`build:sub`) asserting `naturalWidth > 0` and no `securitypolicyviolation` events.

### Pitfall 7: Phases 6/7/8 collide on Dexie versions and shared files
**What goes wrong:** Wave {6,7,8} runs in parallel. Each adds a `db.version(n)`, a backup-registry entry, `EXPECTED_PAGES` rows, and E2E route rows, which causes merge conflicts or an un-upgraded DB at runtime.
**How to avoid:** Use whatever table-registration mechanism Phase 3 ships (planner: read the Phase 3 plans). If versions are hand-numbered, give each phase a distinct number and keep upgrades additive. No production users exist yet, so no data migration is needed. Use append-only edits to shared lists.

### Pitfall 8: Formula injection in exported CSV
**What goes wrong:** A lead's message `=HYPERLINK("http://evil","click")` executes in Excel.
**How to avoid:** `escapeFormula` on every exported cell (OWASP: `= + - @ \t \r \n`), with the exact inverse on import. Both are property-tested.

### Pitfall 9: Time-zone off-by-one in "due today"
**What goes wrong:** `new Date('2026-10-04')` is UTC midnight, so the task shows as due "yesterday" in the US.
**How to avoid:** Local `YYYY-MM-DD` strings, an injected `today`, and tests with `vi.setSystemTime` plus `TZ` variations (run one test file with `process.env.TZ='America/Los_Angeles'` set before date-fns use, or assert purely on strings).

### Pitfall 10: Inquiry page impersonation and SEO
**What goes wrong:** A scammer crafts a link using a real agent's name on Tran's origin.
**How to avoid:** `noindex`, the "Tran doesn't verify agents" line, no Tran branding implying endorsement, and the brokerage name required (a fake brokerage name is at least visible).

### Pitfall 11: Backup key-free scanner false positives
**What goes wrong:** A generic high-entropy check refuses backups because of the Web3Forms UUID or the base64 logo.
**How to avoid:** Confirm Phase 3's scanner design (vault exact values plus provider prefixes). If it has an entropy heuristic, register field-level exemptions (`agentProfile.web3formsKey`, `agentProfile.logo.bytes`) in the backup registry, and add a test that a backup with a logo and a key exports.

### Pitfall 12: Banned marketing terms in agent copy
**What goes wrong:** Copy such as "our agents", "we find you", or "appraisal" fails the Phase 2 banned-terms CI grep, or implies brokerage.
**How to avoid:** Inquiry page copy is in the agent's voice ("{n} will reply by email"), never Tran's.

## Code Examples

### Transitive import-graph boundary test (no new deps)
```ts
// scripts/agent-boundary.test.ts  (scripts project; reads files, no network)
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { expect, test } from 'vitest';

const LIB = resolve(import.meta.dirname, '../apps/web/src/lib');
const IMPORT = /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|import\s*['"]([^'"]+)['"]/g;
const EXT = ['', '.ts', '.js', '.svelte', '.svelte.ts', '/index.ts', '/index.js'];

function resolveSpec(spec: string, from: string): string | null {
	const base = spec.startsWith('$lib/') ? join(LIB, spec.slice(5)) : spec.startsWith('.') ? resolve(dirname(from), spec) : null;
	if (!base) return null; // bare package import: out of scope
	for (const e of EXT) { const p = base + e; if (existsSync(p) && statSync(p).isFile()) return p; }
	return null;
}
function graph(entries: string[]): Set<string> {
	const seen = new Set<string>(); const stack = [...entries];
	while (stack.length) {
		const f = stack.pop()!; if (seen.has(f)) continue; seen.add(f);
		for (const m of readFileSync(f, 'utf8').matchAll(IMPORT)) {
			const r = resolveSpec(m[1] ?? m[2] ?? m[3], f); if (r) stack.push(r);
		}
	}
	return seen;
}
const walk = (d: string): string[] => readdirSync(d).flatMap((n) => statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]);

test('features/agent (excluding studio) never reaches lib/data, transitively', () => {
	const entries = walk(join(LIB, 'features/agent')).filter((f) => !f.includes(join('features', 'agent', 'studio')) && /\.(ts|svelte)$/.test(f) && !f.endsWith('.test.ts'));
	expect(entries.length).toBeGreaterThan(0); // non-vacuity
	const reached = [...graph(entries)].filter((f) => f.startsWith(join(LIB, 'data')));
	expect(reached).toEqual([]);
});
// Planted-failure control: a temp entry importing '$lib/data/x' must be reported (write the fixture
// under os.tmpdir() and feed it as an entry with a stubbed resolver, never into apps/web/src).
```
Also feed the `routes/(app)/agent/**` and `routes/(inquiry)/**` page files as entries. Phase 5 needs a similar graph test ("AI module graph has no import from leads"), so put `graph()` in `tooling/import-graph.ts` and share it.

### E2E: mocked Web3Forms plus RentCast tripwire
```ts
test('inquiry submits a TRAN-LEAD block to the mocked endpoint', async ({ page }) => {
	const rentcast: string[] = [];
	await page.route('https://api.rentcast.io/**', (r) => { rentcast.push(r.request().url()); return r.abort(); });
	let posted: Record<string, string> | undefined;
	await page.route('https://api.web3forms.com/submit', async (route) => {
		const req = route.request();
		const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type, accept', 'access-control-allow-methods': 'POST' };
		if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
		posted = req.postDataJSON();
		return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' },
			body: JSON.stringify({ success: true, message: 'Email sent successfully!' }) });
	});
	await page.goto('agent/inquire/?v=1&k=00000000-0000-4000-8000-000000000000&n=Sample%20Agent&b=Example%20Realty&st=TX');
	// fill fields… wait > 3 s via page.clock or a real wait… submit
	expect(posted?.access_key).toBe('00000000-0000-4000-8000-000000000000');
	expect(posted?.tran_lead_v1).toMatch(/^TRAN-LEAD v1[\s\S]*END TRAN-LEAD$/);
	expect(posted).not.toHaveProperty('botcheck');
	expect(rentcast).toEqual([]);
});
```
Use Playwright's `page.clock.install()` and `fastForward(3500)` to pass the 3-second gate deterministically. `performance.now()` is controlled by the Playwright clock (MEDIUM; fall back to a real `waitForTimeout(3100)` if not).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `aria-grabbed` / `aria-dropeffect` for DnD | Live-region announcements plus a non-drag alternative | ARIA 1.1 deprecated them; WCAG 2.2 (2023) added SC 2.5.7 | Must ship the Move menu; don't use the attributes |
| Web3Forms honeypot recommended | Honeypot "depreciated"; captcha recommended | Current docs (2026) | Our honeypot is a client-only filter; be honest in copy |
| HUD 2024 digital-advertising guidance | Withdrawn (eff. 2025-09-17); FHA §3604(c) / 24 CFR 100.75 unchanged | 2025-2026 | Phase 5 checker basis unchanged |
| CAN-SPAM penalty $51,744 / $50,120 | $53,088 per email (FTC guide, 2026-10-04) | Annual inflation adjustment | Copy cites no figure; docs may |

## Open Questions

1. **Phase 5 `GenerationPanel` needs three extension props.**
   - Known: the props are `feature, promptId, inputs, title, headingLevel, generateLabel, mailto, containsClientData`, and the exits are exactly three.
   - Unclear: how Phase 8 appends the footer, restores `{client_first_name}`, and logs "Mark as sent" to a contact.
   - **Recommendation:** add optional props `footer?: string` (rendered read-only and labelled, concatenated into checker input and all exits, stored in the artifact), `tokens?: Record<string,string>` (local `fillTokens` before display, checker, and exits), and `onExit?: (kind: 'copy'|'mailto'|'sent', artifact) => void`. If Phase 5 is planned/executed first, the Phase 8 plan adds them in a small first task with the Phase 5 exit-count test kept green. Phase 9 needs the same `footer` prop.
2. **Do "exports" include CSV?** Recommendation: no. Disclosures go on consumer-facing content (drafts, inquiry page, Phase 9 outputs). CSV/JSON are data files. The verifier should test drafts and the inquiry page.
3. **Inquiry params beyond key and display name.** Recommendation: add `b`, `t`, `st`, `lic`, `ph`, `v` (Pattern 2). This is needed to meet state rules on the page itself and stays consistent with the locked "query params, no backend" design.
4. **CSP `img-src 'self' blob:`.** Recommendation: adopt it (Pattern 8). This is a reviewed two-file change, and the plan must state it explicitly (03-UI-SPEC rule).
5. **ESLint data ban vs Phase 9 studio.** Recommendation: exclude `features/agent/studio/**` and `routes/(app)/agent/studio/**` from the ban now, so Phase 9 needs no rule surgery.
6. **Ad-identification line for contacts without inquiry-form consent.** Recommendation: include it by default when `consentSource !== 'inquiry-form'` (15 USC 7704(a)(5)(A)(i)). It is a single line and cheap compliance. Flag for counsel review with the rest.
7. **Profile fields beyond CONTEXT** (`licenseType`, `brokeragePhone`, `brokerageLicenseNumber`, `iabsUrl`, `web3formsKey`, `consentSource`/`emailOptOutAt` on contacts). Recommendation: adopt them, because each is required to satisfy a locked behavior.
8. **Web3Forms notification formatting and over-quota behavior.** These can't be verified without a key. Recommendation: build the tolerant parser now, and add HUMAN-UAT rows: (a) real submission arrives, (b) paste from Gmail web / Outlook / Apple Mail parses, (c) hCaptcha-on error copy, (d) observe behavior near the cap if feasible.
9. **Phase 3 backup scanner heuristics vs UUID and base64 logo.** Recommendation: verify against Phase 3 plans. Add exemptions plus a test (Pitfall 11).
10. **No 08-UI-SPEC yet.** `workflow.ui_phase` and `ui_safety_gate` are true, and STATE lists Phase 8 as a UI phase. Recommendation: run `/gsd:ui-phase 8` before planning UI tasks. This research leaves visual and copy details (mobile pipeline layout, exact strings) to that contract.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.11 (projects: `web`, `core`, `scripts`; network blocked by `tooling/vitest/no-network.ts`) + Playwright 1.63.0 with `@axe-core/playwright` 4.13.0 (projects `root`, `sub`) |
| Config files | `vitest.config.ts` (root projects), `packages/core/vitest.config.ts`, `apps/web/vite.config.ts`, `scripts/vitest.config.ts`, `apps/web/playwright.config.ts` |
| Quick run command | `corepack pnpm vitest run --project core --project web` (pure logic + repos, < 30 s) |
| Boundary/oracle run | `corepack pnpm vitest run --project scripts` (ESLint rules, import graph, CSP oracle) |
| E2E command | `corepack pnpm build:root && corepack pnpm build:sub && corepack pnpm test:e2e -- --grep agent` |
| Full suite command | `corepack pnpm verify` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command / File | Failure mode it catches | File Exists? |
|--------|----------|-----------|--------------------------|--------------------------|-------------|
| AGT-01 | `composeDisclosure` emits brokerage for all 7 rules; CA has license #; NJ/NY have brokerage phone; NY uses licensed title; `missing` lists absent required fields | unit | `vitest run --project core packages/core/src/disclosure/compose.test.ts` | State rule regresses; required field dropped. Planted control: a rule with `brokerage` removed must fail the "brokerage present" assertion | ❌ Wave 0 |
| AGT-01 | Every draft final text and the inquiry page contain the disclosure | unit + E2E | `followup-compose.test.ts`; `tests/e2e/agent-inquire.spec.ts` asserts the brokerage text is visible | Footer bypassed by a code path | ❌ Wave 0 |
| AGT-01 | `assessBrandColor`: anchors (#000/#fff), mid-tone fails both, invalid hex rejected, `#abc` normalized | unit | `packages/core/src/brand-color.test.ts` | Bad color shipped into Phase 9 accents | ❌ Wave 0 |
| AGT-01 | Logo sniffing (PNG magic, SVG detection, JPEG/GIF/HTML-renamed-.png rejected, > 512 KB rejected) | unit | `apps/web/src/lib/features/agent/profile/logo.test.ts` (pure byte functions) | Wrong file type stored; SVG stored raw | ❌ Wave 0 |
| AGT-01 | Uploaded logo renders on the **built** site under CSP (`naturalWidth > 0`, zero `securitypolicyviolation`) | E2E | `tests/e2e/agent-profile.spec.ts` (root + sub) | `img-src` regression | ❌ Wave 0 |
| AGT-01 | CSP oracle accepts `img-src 'self' blob:` and still rejects drift | unit | `scripts/assert-csp.test.ts` (extend) | Silent policy widening | ✅ extend |
| AGT-02 | Param parsing: UUID validation, lengths, bidi/control stripping, unknown `v`, missing `b` → incomplete state; `buildInquiryUrl` round-trip under both bases | unit | `packages/core/src/leads/inquiry-params.test.ts` (or `lib/features/agent`) | XSS/spoof strings, broken share links | ❌ Wave 0 |
| AGT-02 | Sink: payload shape (no `botcheck`, has `tran_lead_v1`, `email` reply-to), maps 200/400/400-captcha/429/500/TypeError | unit (fake fetch) | `apps/web/src/lib/leads/web3forms-sink.test.ts` | Wrong error copy; key leaked to other host | ❌ Wave 0 |
| AGT-02 | Form E2E: mocked POST receives block; honeypot → **zero** requests + success UI; < 3 s → zero requests + message; captcha error copy; axe clean with valid and with missing params; `noindex` present; no app nav | E2E | `tests/e2e/agent-inquire.spec.ts` | Spam gate bypass; visitor sees app chrome | ❌ Wave 0 |
| AGT-02 | Real Web3Forms delivery and paste-back across Gmail/Outlook/Apple Mail; hCaptcha-on behavior | manual | `08-HUMAN-UAT.md` | Undocumented email rendering | ❌ (HUMAN-UAT) |
| AGT-03 | `buildLeadBlock` → `parseLeadBlocks` round-trip (property); collapsed-whitespace, `> `-quoted, NBSP, CRLF, two blocks, forged key inside message, `v2` → newer-version | unit + property | `packages/core/src/leads/lead-block.test.ts` | Parser breaks on real mail | ❌ Wave 0 |
| AGT-03 | `normEmail`/`normPhoneUS` idempotent (property), NANP rules, extensions, intl `+`, 555-01xx accepted | unit + property | `packages/core/src/leads/normalize.test.ts` | Missed or false duplicates | ❌ Wave 0 |
| AGT-03 | `diffLeads`: new/duplicate/update (fill blanks only)/conflict (email→A, phone→B)/in-batch dupes/tombstones ignored | unit | `packages/core/src/leads/diff-leads.test.ts` | Silent overwrite; merged strangers | ❌ Wave 0 |
| AGT-03 | Paste → dry-run table → commit creates the expected contacts; re-paste shows "duplicate"; manual quick-add dedupes | E2E | `tests/e2e/agent-import.spec.ts` | UI commits without preview | ❌ Wave 0 |
| AGT-04 | `moveContact` pure transition + Dexie transaction writes contact and `stage_changed` activity atomically | unit (fake-indexeddb) | `apps/web/src/lib/storage/agent/contacts-repo.test.ts` | Stage moves without log; partial writes | ❌ Wave 0 |
| AGT-04 | Drag (`locator.dragTo`) and keyboard Move menu both move a card; counts update; live region text; focus lands on the moved card's Move button; axe clean | E2E | `tests/e2e/agent-pipeline.spec.ts` | Keyboard path missing (WCAG 2.5.7) | ❌ Wave 0 |
| AGT-05 | Due-today/overdue/smart lists with injected `today`, week start Sunday, 7-day boundary, Closed excluded | unit | `packages/core/src/crm/tasks.test.ts`, `smart-lists.test.ts` | TZ off-by-one; wrong list membership | ❌ Wave 0 |
| AGT-05 | `/agent/` shows overdue then due-today on load (seeded via UI/fixture); completing a task logs an activity | E2E | `tests/e2e/agent-today.spec.ts` | Queue absent "on app open" | ❌ Wave 0 |
| AGT-06 | Final text = filled tokens + footer (postal, opt-out line verbatim, disclosure, ad-identification when consent unknown); exits gated for opt-out / missing postal | unit | `apps/web/src/lib/features/agent/followup/followup-compose.test.ts` | Footer lost; opted-out contact emailed | ❌ Wave 0 |
| AGT-06 | With the Fixture provider: draft shows the footer; `mailto:` href body contains the encoded footer; Mark as sent logs activity and sets last contacted; no `sms:` anywhere in `/agent/*` | E2E | `tests/e2e/agent-followup.spec.ts` | Exit bypasses footer | ❌ Wave 0 |
| AGT-07 | RFC 4180 cases (embedded quotes, commas, CR/LF/CRLF in quoted fields, empty fields, trailing newline, unterminated quote error, BOM strip), formula escape/unescape inverse, **round-trip property** | unit + property | `packages/core/src/csv/csv.test.ts` | Data corruption; CSV injection | ❌ Wave 0 |
| AGT-07 | Header synonym mapping, first+last join, 5,000 cap (5,001 rejected, 5,000 accepted), windows-1252 fallback, invalid rows listed by line | unit | `packages/core/src/csv/contact-columns.test.ts` | Silent truncation; mojibake | ❌ Wave 0 |
| AGT-07 | Export download starts with BOM `EF BB BF`, CRLF, and re-imports to an identical set (E2E round trip) | E2E | `tests/e2e/agent-csv.spec.ts` (`page.waitForEvent('download')`) | Excel garbles UTF-8 | ❌ Wave 0 |
| Demo | `features/agent` (minus studio) + agent routes + inquiry route never reach `lib/data` transitively; planted control fails | unit | `scripts/agent-boundary.test.ts` | Gateway import sneaks in via shared barrel | ❌ Wave 0 |
| Demo | ESLint: agent file importing `$lib/data/x` errors **and** cross-portal import still errors (merge proof); `(inquiry)` importing storage errors | unit | `scripts/eslint-rules.test.ts` (extend) | Rule override in flat config | ✅ extend |
| Demo | Every `/agent/*` route makes **zero** requests to `api.rentcast.io` (tripwire route) in empty, sample-loaded, and inquiry flows | E2E | `tests/e2e/agent-no-rentcast.spec.ts` | Hidden gateway call | ❌ Wave 0 |
| Demo | Sample contacts fixture passes the real-data guard (example.com, 555-01xx); "Sample" chip visible; remove-samples works | guard + E2E | `pnpm guard`; `agent-pipeline.spec.ts` | Real-looking PII committed | ✅ guard exists |
| All | axe (WCAG 2.0/2.1/2.2 A/AA) on every new route, both bases, empty and sample states, dialogs open | E2E | `tests/e2e/a11y.spec.ts` via shared `routes.ts` + agent specs | a11y regressions | ✅ extend |
| All | New routes present in `EXPECTED_PAGES` and built with CSP meta first | unit/oracle | `pnpm csp:assert` | Route escapes the oracle | ✅ extend |

### Sampling Rate
- **Per task commit:** `corepack pnpm vitest run --project core --project web` (plus `--project scripts` when touching ESLint, CSP, or boundary files).
- **Per wave merge:** the above plus `build:root`, `build:sub`, `csp:assert`, and the agent E2E specs.
- **Phase gate:** `corepack pnpm verify` green, then `08-HUMAN-UAT.md` items recorded as deferred owner actions (Web3Forms key), before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `packages/core/src/{leads,csv,disclosure,crm}/*.test.ts` and `brand-color.test.ts`: all new
- [ ] `fast-check@4.10.2` devDependency in `packages/core` (or a documented seeded generator)
- [ ] `tooling/import-graph.ts` + `scripts/agent-boundary.test.ts`, with planted-failure control
- [ ] `scripts/eslint-rules.test.ts` fixtures for the merged agent rule and the `(inquiry)` rule
- [ ] `scripts/assert-csp.mjs` `EXACT['img-src']` + new `EXPECTED_PAGES`; `assert-csp.test.ts` cases
- [ ] E2E specs: `agent-inquire`, `agent-import`, `agent-pipeline`, `agent-today`, `agent-followup`, `agent-csv`, `agent-profile`, `agent-no-rentcast`; agent routes added to shared `routes.ts`
- [ ] Test assets: a tiny PNG and a small SVG logo (synthetic), a CSV with BOM/quotes/newlines (`example.com`, 555-01xx), a windows-1252 CSV; all under a path the real-data guard scans
- [ ] `08-HUMAN-UAT.md`: real Web3Forms submission, paste-back from 3 mail clients, hCaptcha-on error, quota behavior

## Sources

### Primary (HIGH confidence)
- Web3Forms docs: [API reference](https://docs.web3forms.com/getting-started/api-reference), [AJAX example](https://docs.web3forms.com/getting-started/examples/ajax-contact-form-using-javascript.md), [Honeypot (deprecated)](https://docs.web3forms.com/getting-started/customizations/spam-protection/spam-protection.md), [Spam protection](https://docs.web3forms.com/getting-started/customizations/spam-protection.md), [hCaptcha](https://docs.web3forms.com/getting-started/customizations/spam-protection/hcaptcha.md), [Restrict to domain (Pro)](https://docs.web3forms.com/getting-started/pro-features/restrict-to-domain.md), [From name](https://docs.web3forms.com/getting-started/customizations/from-name.md), [FAQ](https://docs.web3forms.com/getting-started/faq), [llms.txt index](https://docs.web3forms.com/llms.txt)
- [FTC CAN-SPAM compliance guide](https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business); [15 U.S.C. 7704](https://www.law.cornell.edu/uscode/text/15/7704); [16 CFR 316.2](https://www.law.cornell.edu/cfr/text/16/316.2)
- [Cal. B&P 10140.6](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=BPC&sectionNum=10140.6), [10015.4](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=BPC&sectionNum=10015.4)
- [WCAG 2.2 Understanding SC 2.5.7 Dragging Movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html)
- [SvelteKit page options (searchParams during prerender)](https://svelte.dev/docs/kit/page-options)
- [RFC 4180](https://www.rfc-editor.org/rfc/rfc4180); [OWASP CSV Injection](https://community.owasp.org/attacks/CSV_Injection)
- npm registry (2026-10-04): svelte-dnd-action, papaparse, fast-check, dexie, zod, bits-ui, date-fns, fake-indexeddb, libphonenumber-js, @thisux/sveltednd
- Repo code: `apps/web/svelte.config.js`, `eslint.config.js`, `scripts/assert-csp.mjs`, `scripts/lib/real-data-rules.mjs`, `scripts/eslint-rules.test.ts`, `apps/web/playwright.config.ts`, `tests/e2e/a11y.spec.ts`

### Secondary (MEDIUM confidence)
- [N.J.A.C. 11:5-6.1](https://www.law.cornell.edu/regulations/new-jersey/N-J-A-C-11-5-6-1); [Ohio Adm. Code 1301:5-1-02](https://codes.ohio.gov/ohio-administrative-code/rule-1301:5-1-02); [19 NYCRR 175.25](https://www.law.cornell.edu/regulations/new-york/19-NYCRR-175.25); [Florida Realtors advertising rules (61J2-10.025/.026)](https://www.floridarealtors.org/law-ethics/library/realtor-advertising-rules-florida); [TREC advertising rules article](https://www.trec.texas.gov/article/trecs-advertising-rules-what-you-need-know), [TREC IABS/CPN flexibility](https://www.trec.texas.gov/article/flexibility-added-posting-link-iabs-and-consumer-protection-notices)
- Web3Forms free limits: [splitforms pricing](https://splitforms.com/web3forms-pricing), [form2lead](https://form2lead.com/alternatives/web3forms/pricing), [itsfree.dev](https://itsfree.dev/tools/web3forms) (official pricing page 403s automated fetch)
- [svelte-dnd-action README/release notes](https://github.com/isaacHagoel/svelte-dnd-action) (Svelte 5 runes support, beta keyboard a11y)

### Tertiary (LOW confidence, flagged)
- [formgrid.dev on notification formatting](https://formgrid.dev/blog/how-to-customize-your-form-submission-email-notifications-and-why-it-matters): "long text values show as one unbroken paragraph". Drives the defensive parser and HUMAN-UAT
- Web3Forms over-quota behavior: undocumented
- Playwright clock controlling `performance.now()`; Svelte a11y warning on drag handlers: verify during execution

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH. No new runtime deps; registry versions verified 2026-10-04.
- Architecture: HIGH for boundaries, CSP, prerender, and Dexie rules (verified against repo code and official docs). MEDIUM for Phase 5 extension props (contract not yet executed).
- Web3Forms behavior: MEDIUM (docs fetched; rendering and over-quota behavior LOW, covered by HUMAN-UAT).
- Legal (CAN-SPAM HIGH; state ad rules MEDIUM; not legal advice).
- Pitfalls: HIGH for CSP, ESLint merge, IndexedDB booleans, TZ parsing, and CSV injection; MEDIUM for email-client mangling.

**Research date:** 2026-10-04
**Valid until:** 2026-11-03 (30 days). Re-check Web3Forms docs and the Phase 5 GenerationPanel contract at plan time.
