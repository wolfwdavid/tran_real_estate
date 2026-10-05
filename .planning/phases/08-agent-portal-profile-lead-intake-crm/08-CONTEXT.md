# Phase 8: Agent Portal: Profile, Lead Intake & CRM - Context

**Gathered:** 2026-10-04
**Status:** Ready for planning

<domain>
## Phase Boundary

The Agent portal under `/agent/`: agent profile/brand kit with automatic disclosures, shareable inquiry page on the agent's own Web3Forms key, lead import (paste email / manual) with dedupe, drag-and-drop pipeline, tasks + due-today queue, AI follow-up drafts with CAN-SPAM elements, CSV import/export. Requirements AGT-01..07. Depends on Phases 2, 3, 5 only — spends zero RentCast calls.

</domain>

<decisions>
## Implementation Decisions

The owner chose fully autonomous mode on 2026-10-04. Recommended defaults adopted.

### Profile & disclosures
- Profile fields: name, brokerage, license number, license state, logo (PNG/SVG uploaded to IndexedDB as a blob; max 512 KB), brand colors (primary/accent with contrast check against white/espresso), postal address, phone, email, website.
- **Disclosure composer** in `packages/core`: given profile → required disclosure line(s) ("{Name}, {License #}, {Brokerage}" + state-specific additions from a small data table for FL/NJ/OH/CA/NY/TX; default generic line otherwise). Appended automatically to every export and generated draft; a unit test asserts presence.

### Inquiry page & lead capture
- `/agent/inquire/` is a prerendered page whose behavior is configured by **URL query params** encoding the agent's Web3Forms access key + display name (no backend; Web3Forms keys are public-safe by design). The agent copies the share link from `/agent/profile/`.
- Form: name, email, phone (optional), message, property of interest, consent checkbox text ("I agree to be contacted about my inquiry") — **no TCPA-style SMS consent**; honeypot `botcheck`, minimum time-to-submit (3 s), optional hCaptcha only if the agent enables it (hCaptcha script would violate "no third-party scripts" → **not included in v1**; honeypot + timing only).
- Submission posts to `https://api.web3forms.com/submit` (already in `connect-src`/`form-action`) with a structured `TRAN-LEAD v1` block in the message body (key: value lines) so it survives email clients and can be pasted back.
- **Owner key deferred:** the Web3Forms end-to-end test is a HUMAN-UAT item; E2E mocks the endpoint.

### Lead import & CRM
- **Paste import:** parse `TRAN-LEAD v1` blocks or free-form emails (regex for name/email/phone); show a dry-run diff (new / duplicate / update) before commit; duplicates by normalized email or phone.
- **Manual quick-add** form; **CSV import** (dry-run diff, Zod-mini validated, max 5,000 rows) and **CSV export** (RFC 4180, UTF-8 BOM for Excel).
- **Pipeline** `/agent/pipeline/`: columns New → Contacted → Touring → Offer → Closed; drag-and-drop with a keyboard-accessible alternative (move menu / arrow keys) — a11y requirement; counts per column; 3 smart-list presets (Due today, No contact in 7 days, New this week).
- **Tasks:** per contact, due date, done; `/agent/today/` due-today queue shown on app open; overdue grouping.
- **Activity log** per contact (auto entries for stage changes, drafts marked sent, tasks done).
- All tables Dexie + backup-registered (logo blob included as base64 only if < 512 KB).

### AI follow-ups
- Prompt `agent/followup.v1`: contact context (PII-minimized), stage, agent notes → email draft; the composer appends the postal address + an opt-out line ("Reply STOP or unsubscribe to stop receiving emails from me") + disclosures. Gated by Fair Housing checker; exits copy / `mailto:` / mark sent (logs activity).

### Demo credibility
- Sample contacts fixture (synthetic, `example.com`, 555-01xx) when the CRM is empty with a "Load sample contacts" action and a clear "Sample" chip; zero RentCast calls anywhere in `/agent/*` (asserted by a test that the gateway is never imported by `features/agent`).

### Claude's Discretion
- DnD library choice (native HTML5 DnD with keyboard fallback vs. a small Svelte 5 lib) — prefer no new dependency; CSV column mapping UX; logo size limits.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Phase 3 repos/backup/blob storage; Phase 5 panel/checker/redaction; Phase 2 tokens + Phase 3 shadcn primitives (Dialog, Tabs, Switch).
- `connect-src`/`form-action` already permit Web3Forms.

### Established Patterns
- Feature boundaries: `features/agent` must not import `data/` (gateway) — enforce via ESLint rule + test.
- Query-param-configured prerendered pages (no `[param]` routes).

### Integration Points
- Profile → Phase 9 content studio (disclosures, brand kit, logo).
- Backup registry (contacts, tasks, activities, profile).

</code_context>

<specifics>
## Specific Ideas

- Honest copy: "Import from email" means paste; no inbox connection exists. The inquiry page says leads are emailed to the agent by Web3Forms and are not stored by Tran.

</specifics>

<deferred>
## Deferred Ideas

- `.ics` export (AGT-V2-01), live webhook leads (AGT-V2-02), `.eml` drop.
- Cut line: smart lists beyond 3 → `.eml` drop (already deferred) → CSV import (keep export).

</deferred>
