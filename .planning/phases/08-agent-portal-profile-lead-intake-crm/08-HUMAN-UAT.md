---
status: superseded
superseded_by: .planning/HUMAN-UAT.md
phase: 08-agent-portal-profile-lead-intake-crm
source: [08-26-PLAN.md, 08-VALIDATION.md "Manual-Only Verifications"]
started: 2026-10-07T05:30:00Z
updated: 2026-10-07T05:30:00Z
---
> Superseded on 2026-10-30 by `.planning/HUMAN-UAT.md` (Phase 13 ledger). This file is kept as history; record results in the ledger.

## Current Test

[awaiting the owner — NON-BLOCKING. UAT-1 to UAT-6 need a free Web3Forms access key (STATE pending
todo "[Phase 8]: Create a free Web3Forms access key"); UAT-7 is a pre-GTM counsel review (Phase 10
gate). Everything that can be checked locally already passes on both base paths with Web3Forms
mocked: request shape, honeypot, 3-second gate, every failure mapping, the TRAN-LEAD round trip,
the 13 mangled-paste fixtures and the footer in every follow-up exit.]

## Tests

### UAT-1. Real delivery through the agent's own Web3Forms key
steps: 1. Create a free access key at https://web3forms.com (leave captcha off). 2. Open
`/agent/profile/`, fill the profile, paste the key and save. 3. Copy the inquiry share link from the
profile page and open it in a private window. 4. Submit a test inquiry with a name, an email you can
read, a phone, a property and a message (wait at least 3 seconds before sending).
expected: The page shows "Message sent". The notification email arrives at the key's address with
the visitor's fields; reply-to is the visitor's email; the subject is
"New inquiry for {Name} from {Lead name}"; the sender name is "Tran inquiry form".
result: [pending — requires the owner's Web3Forms key]

### UAT-2. The tran_lead_v1 field is visible in the notification
steps: In the UAT-1 email, look for a row named `tran_lead_v1`.
expected: The row holds the whole block from `TRAN-LEAD v1` to `END TRAN-LEAD`. If the row does not
appear, record it: the documented fallback is appending the block to `message`.
result: [pending — requires UAT-1]

### UAT-3. Paste-back from Gmail web, Outlook and Apple Mail
steps: Open the UAT-1 notification in Gmail (web), Outlook (web or desktop) and Apple Mail. In each,
select and copy the whole email, paste it into **Import leads** on `/agent/import/` and choose
Check pasted text. Add the lead from the first paste, then paste the same email again.
expected: The review reads the lead exactly (name, email, phone, property, message, consent). The
second paste shows the existing contact (an update that only logs the inquiry, or "Already in
contacts" when the message is empty). Record which clients collapse line breaks (the parser
tolerates collapsed whitespace by design).
result: [pending — requires UAT-1 and the three mail clients]

### UAT-4. hCaptcha switched on in the Web3Forms dashboard
steps: Enable hCaptcha for the key in the Web3Forms dashboard, submit the inquiry page again, then
disable hCaptcha.
expected: The page shows "This form can't send messages right now" (the captcha-required mapping)
and keeps the typed message; nothing is delivered. After disabling, a send works again.
result: [pending — requires the owner's key and dashboard]

### UAT-5. Spam and free-tier quota behavior
steps: If observable, note what Web3Forms does near the 250 submissions/month free limit (the
behavior is undocumented). Check that the limit note under the share link on `/agent/profile/`
("Web3Forms' free plan has a monthly limit on submissions...") matches what you see.
expected: Over-limit sends show one of the page's failure messages (refused, rate-limited or server
error) and keep the typed message, never a false "Message sent"; the limit note is accurate.
result: [pending — requires volume on a real key; may stay unobserved]

### UAT-6. A follow-up draft in real email apps
steps: On a contact with an email, draft a follow-up and choose **Open in email app** on a desktop
and on a phone. Repeat with a long draft (more than 1,800 characters).
expected: The compose window holds the draft with the footer intact (postal address, opt-out line,
state disclosure). For the long draft, Phase 5's long-draft note appears and Copy text carries the
full text.
result: [pending — requires real devices and mail handlers]

### UAT-7. Counsel review before the public launch
steps: Have a real estate professional or counsel review the state disclosure table
(`packages/core/src/disclosure/`) and the CAN-SPAM footer wording.
expected: Wording approved, or the requested changes recorded as a follow-up, before Phase 10 GTM.
result: [pending — Phase 10 gate]

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps

None recorded. These are owner actions that need a real Web3Forms key, real mail clients and
devices, or a professional review. Every locally verifiable behavior behind them passed in the
Phase 8 gate (08-26): agent-inquire, agent-share-link, agent-import, agent-followup, agent-a11y and
agent-no-rentcast on both base paths, plus the core lead-block, CSV and disclosure unit suites.
