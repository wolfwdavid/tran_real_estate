---
phase: 17-extension-release-edge-add-ons-submission
verified: 2026-11-20T05:21:39Z
status: gaps_found
score: 5/6 must-haves verified (revised goal, scope change 2026-11-20)
overrides_applied: 2
overrides:
  - must_have: "After certification, docs/EXTENSION-INSTALL.md carries the Edge listing URL in place of the placeholder (roadmap success criterion 5, EXT-09)"
    reason: "Cut by owner decision: GitHub Release only, nothing is submitted to Edge Add-ons (ROADMAP.md:284, HUMAN-UAT L95, REQUIREMENTS.md:68). Replaced by: the install guide promises no store listing, enforced by scripts/extension-docs.test.ts."
    accepted_by: "owner (recorded in ROADMAP.md scope change and HUMAN-UAT L95)"
    accepted_at: "2026-11-20"
  - must_have: "The Edge Add-ons listing is submitted (submission half of roadmap success criterion 3, EXT-07)"
    reason: "Cut by the same owner decision. The asset half (screenshots, listing copy, store-copy test, ToU go/no-go, live privacy URL) is still verified below."
    accepted_by: "owner (recorded in ROADMAP.md scope change and HUMAN-UAT L95)"
    accepted_at: "2026-11-20"
gaps:
  - truth: "The 2026-11-20 scope change (GitHub Release only, no store listing) is recorded consistently across the planning records"
    status: partial
    reason: "The decision is recorded in ROADMAP.md:284, REQUIREMENTS.md:66-68 and 155-157, PROJECT.md:259, HUMAN-UAT L95 and STATE.md:6, but other lines in the same files still state the old plan. Records only; no product or user-facing file is affected."
    artifacts:
      - path: ".planning/ROADMAP.md"
        issue: "Line 273 (Goal) still reads 'and the Edge Add-ons listing is complete and submitted; certification and the install-guide link are owner follow-ups'. Line 44 (phase list entry) still reads 'Edge listing assets and submission; certification link is an owner follow-up'. Line 285 (Owner gate) still lists 'submit the Release zip to Partner Center' and 'edit the install guide after certification'. Line 286 (Research flag) still says to re-read the Partner Center form 'on the day of submission'. Line 319 (progress table) reads '0/TBD | Not started' while lines 291-295 tick all five plans."
      - path: ".planning/PROJECT.md"
        issue: "Line 231 still reads 'Edge Add-ons listing assets ready to submit; store submission ... stay owner steps'. Line 186 still reads 'load-unpacked + Edge Add-ons instead'. Line 159 still reads 'distributed free via load-unpacked zip + Edge Add-ons'. All three contradict the Key Decision on line 259 of the same file. Line 99 (v1.0 EXT-04, 'Microsoft Edge Add-ons, or Firefox Add-ons') is a historical validated entry with no note that the store channels were dropped."
      - path: ".planning/REQUIREMENTS.md"
        issue: "Line 103 (out-of-scope table, Firefox Add-ons) still reads 'revisit after Edge certification'; there will be no Edge certification."
      - path: ".planning/HUMAN-UAT.md"
        issue: "Line 136 heading still reads 'Tally (2026-11-05)' although the counts below it were updated through 2026-11-20 (the counts themselves are correct)."
      - path: "apps/extension/store/edge-listing.md"
        issue: "Line 3 still reads 'Paste-ready copy for Partner Center' with no note that the listing is kept but unused (docs/DEPLOY-CHECKLIST.md:267 says it is unused; the file itself does not)."
      - path: ".planning/phases/17-extension-release-edge-add-ons-submission/17-05-SUMMARY.md"
        issue: "Lines 52 and 56 still describe EXT-07 as unticked until the Partner Center submission and a post-certification follow-up; line 65 says the later section replaces them, so this is self-disclosed, but the stale text is left in place."
    missing:
      - "Reword ROADMAP.md:273, :44, :285 and :286 to the revised goal (published release from a hardened workflow, listing assets done but unused, no submission), or strike the submission wording the way REQUIREMENTS.md:68 strikes EXT-09"
      - "Update PROJECT.md:231, :186 and :159 to match the Key Decision on :259 (and annotate :99 if historical entries are annotated elsewhere)"
      - "Drop 'revisit after Edge certification' from REQUIREMENTS.md:103"
      - "Re-date the HUMAN-UAT.md:136 tally heading"
      - "Add one 'kept, unused since 2026-11-20' sentence to apps/extension/store/edge-listing.md, checking it against the store-copy test (no other browser names)"
      - "ROADMAP.md:319 and :44 checkbox: confirm the phase-complete step updates them; if it does not, fix by hand"
human_verification:
  - test: "Approve and push the 7 local commits (7da6345..3714bef) to origin/main, then re-read docs/EXTENSION-INSTALL.md and docs/DEPLOY-CHECKLIST.md on GitHub"
    expected: "The public install guide no longer has the 'Install from Microsoft Edge Add-ons' section. Today origin/main (6df2493) still shows it at lines 41-46, and the checklist still has the Partner Center step at lines 261-275."
    why_human: "A push needs the owner's approval. The 'no store-listing promise' truth holds at local HEAD only until then."
  - test: "On live zillow.com with the released build loaded, click 'Sponsored — show' on a dimmed item, then click it again"
    expected: "The item shows at full strength, then dims again; the badge count is unchanged."
    why_human: "Not run in the L90 session: a Zillow bot-check overlay covered the page and was not bypassed. Covered only by fixture E2E."
  - test: "Load the released zip unpacked in Microsoft Edge (edge://extensions) and repeat the L90 smoke"
    expected: "Same behaviour as in Chrome: ad-slot items dim, popup switch works, no errors."
    why_human: "L90 and L96 were done in Chromium/Chrome only; the install guide names Edge and Brave."
  - test: "Open the current Zillow Terms of Use in a browser and add the page 'Updated' date and the section 5 Prohibited Use wording to HUMAN-UAT row L93"
    expected: "L93 carries the date and the quoted wording next to the 'go' decision, as docs/DEPLOY-CHECKLIST.md Step 9 item 1 asks."
    why_human: "Automated fetch of the terms is refused; L93 records only the owner's 'go' in chat."
  - test: "Read the extension service worker's DevTools Network tab during a real Zillow session"
    expected: "No request to any web host."
    why_human: "L91 was captured by browser automation, not from DevTools (limit disclosed in the row). The static oracle and the CSP connect-src 'none' already cover this in CI."
---

# Phase 17: Extension Release & Edge Add-ons Submission Verification Report

**Phase Goal (ROADMAP.md:273, as written):** The Zillow extension is published as a verifiable `ext-v0.1.0` GitHub Release from a hardened release workflow, and the Edge Add-ons listing is complete and submitted; certification and the install-guide link are owner follow-ups that never block another phase.

**Revised goal applied (ROADMAP.md:284, scope change 2026-11-20):** a verifiable published `ext-v0.1.0` GitHub Release from a hardened workflow, listing assets done but unused, and no store-listing promise left in user-facing docs. Nothing is submitted to Edge Add-ons.

**Verified:** 2026-11-20T05:21:39Z
**Status:** gaps_found (one records-consistency gap; the product goal is achieved)
**Re-verification:** No, initial verification
**Judged at:** local HEAD 3714bef. origin/main is 6df2493; 7 commits are unpushed.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| - | ----- | ------ | -------- |
| 1 | SC1: zip and `SHA256SUMS.txt` download from the published release, verify with `sha256sum -c`, tag equals package and manifest version | VERIFIED | `gh release view`: `isDraft:false`, published 2026-11-19T17:01:11Z, author `github-actions[bot]`, two assets. Anonymous curl of both assets returned 200; `sha256sum -c` printed OK; zip SHA256 ec756e6d15fbca83ed5e0a69d7d34b60a0f0ee48ddb13a88a239cb680197ee27 (matches GitHub's asset digest and HUMAN-UAT L96). Tag commit 6df2493 is an ancestor of origin/main. `apps/extension/package.json` at the tag and the `manifest.json` inside the downloaded zip both say 0.1.0. The "loads unpacked once" half is the owner's recorded Chrome load (L96), not re-run here. |
| 2 | SC2: `apps/extension/CHANGELOG.md` (Keep a Changelog) has the 0.1.0 entry and the release notes come from it | VERIFIED | File has `## [Unreleased]`, `## [0.1.0] - 2026-11-17`, link references. The live release body is the 0.1.0 section text line for line. Workflow line 68 writes the notes with `extension-release-checks.mjs notes`; line 75 passes `--notes-file`; the gate test forbids `docs/EXTENSION-INSTALL.md` in the workflow. |
| 3 | SC3 (revised): listing assets complete, ToU go/no-go recorded, privacy URL live; submission cut | VERIFIED (asset half) / PASSED (override, submission half) | Three PNGs read from their IHDR: 1280x800 each. `edge-listing.md` has Website, Support contact detail, Notes for certification (states only advertising-slot items dim on live Zillow today) and Assets sections. Store-copy tests in `scripts/extension-docs.test.ts` pass. Live privacy URL answered 200 with `id="browser-extension"`. ToU "go" is in L93 without the page date or wording (human item 4). |
| 4 | SC4: dispatch dry-run cannot publish; draft releases; ancestor, version, zip allowlist and privacy probe gates; gate test pins each | VERIFIED | See "Workflow hardening" below. Real runs: dry-run 44362704933 (`workflow_dispatch`, success, "Tag commit is on main" and "Create draft release" skipped); tag run 44534979713 (`push`, success, no step skipped). `gh release list` shows one release only. |
| 5 | SC5 as revised: no store-listing promise left in user-facing docs | VERIFIED at local HEAD / PASSED (override for the original SC5) | `docs/EXTENSION-INSTALL.md:41`: "The release zip is the only way to install; there is no store listing." `docs/DEPLOY-CHECKLIST.md:265-267`: "No store listing." `scripts/extension-docs.test.ts:255-260` fails the guide on `Add-ons`, `Web Store` or `microsoftedge.microsoft.com`. Repo grep (excluding `.planning/phases`, `.planning/milestones`, `.planning/research`, `node_modules`) found no promise in `apps/web`, `docs/RUNBOOK.md`, `README.md`, the release body, or the released zip. Not yet live: see human item 1. |
| 6 | The scope change is recorded consistently in the planning records | FAILED (partial) | Recorded in five places, contradicted in ROADMAP.md:44, :273, :285, :286, :319; PROJECT.md:159, :186, :231; REQUIREMENTS.md:103; HUMAN-UAT.md:136. Details in the `gaps` frontmatter. |

**Score:** 5/6 truths verified (2 overrides applied, both from the owner's recorded decision).

### Workflow hardening (truth 4, read from `.github/workflows/extension-release.yml`)

| Gate | Where | Pinned by |
| ---- | ----- | --------- |
| Dry-run cannot publish | line 11 `workflow_dispatch` with no inputs; line 72 `if: github.event_name == 'push'` on the only `gh release` step | gate test: exactly one `gh release`, exactly two push-only `if:` lines, planted mutant removing the `if:` is reported "not push-only" |
| Draft only | line 75 `gh release create "$GITHUB_REF_NAME" --draft --verify-tag` | gate test: no `--draft=false`, no `gh release edit`, no `gh release upload`; planted mutant removing `--draft` is reported "not a draft" |
| Ancestor check | lines 31 and 38-40, `fetch-depth: 0` plus `extension-release-checks.mjs ancestor` (fails closed when `origin/main` does not resolve) | gate test step order and count; planted mutant removing `fetch-depth: 0` is reported "shallow checkout" |
| Version check | lines 55-58, tag from `RELEASE_TAG` only on a push; compares tag, package, built manifest and zip name | gate test pins the step and its env line |
| Zip allowlist | line 51 oracle with `--zip-dir`; `ZIP_ENTRY_ALLOWLIST` in `scripts/assert-extension.mjs:293-301` is default-deny | `scripts/assert-extension.test.ts:652-704` rejects `.js.map`, `src/popup.ts` and `.env` entries, including through the CLI |
| Privacy probe | lines 59-63, 200 status plus the `id="browser-extension"` anchor | gate test pins the step and its two env lines |

Note on non-vacuity: the planted-mutant test covers three predicates (draft, push-only, full-depth checkout). The version, probe and allowlist steps are pinned by exact-string presence, order and a count of one, and their logic has its own negative tests in `scripts/extension-release-checks.test.ts` (29 tests) and `scripts/assert-extension.test.ts`. That is sufficient; it is not one mutant per gate.

The downloaded zip's 18 entries all match the allowlist shapes (no `.map`, `.ts`, `.env`). Its manifest has `permissions: ["storage"]`, host access to `*.zillow.com` only, and a popup CSP with `connect-src 'none'`. The zip was read as data only; nothing from it was executed.

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `.github/workflows/extension-release.yml` | hardened workflow | VERIFIED | identical at the tag and at HEAD |
| `scripts/extension-release-checks.mjs` | version, ancestor, probe, notes, summary | VERIFIED | called five times by the workflow |
| `scripts/extension-release-gate.test.ts` | text pins plus mutants | VERIFIED | passes |
| `scripts/assert-extension.mjs` | `ZIP_ENTRY_ALLOWLIST` wired into `checkZip` | VERIFIED | |
| `apps/extension/CHANGELOG.md` | Keep a Changelog, 0.1.0 | VERIFIED | |
| `apps/extension/store/screenshots/*.png` | 2-3 at 1280x800 | VERIFIED | three, tracked in git |
| `apps/extension/store/edge-listing.md` | Website, Support, Notes for certification | VERIFIED, unused | no "unused" note in the file (gap item) |
| `docs/EXTENSION-INSTALL.md`, `docs/DEPLOY-CHECKLIST.md` | no listing promise | VERIFIED at HEAD | unpushed |
| `docs/RUNBOOK.md` "Release the extension" | dry-run, draft, publish | VERIFIED | no store wording |

### Key Link Verification

| From | To | Via | Status |
| ---- | -- | --- | ------ |
| workflow | `extension-release-checks.mjs` | `run: node scripts/extension-release-checks.mjs <cmd>` x5 | WIRED |
| workflow | `CHANGELOG.md` | `notes --out` then `--notes-file` | WIRED (release body equals the section) |
| `extension-release-checks.mjs` | `assert-extension.mjs` | imports `ZIP_NAME`, `listZipEntries` | WIRED |
| `extension-release-checks.mjs` | `apps/web/src/lib/site-config.js` | `resolveSiteUrl` | WIRED |
| tag `ext-v0.1.0` | workflow run | push event, run 44534979713 | WIRED |
| HUMAN-UAT L96 | published release | recorded SHA256 equals the downloaded zip's | WIRED |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Scripts tests | `pnpm vitest run --project scripts` | 39 files, 1258 tests passed | PASS |
| Workflow lint | `pnpm lint:workflows` | exit 0, no findings | PASS |
| Release published with two assets | `gh release view ext-v0.1.0 ...` | not a draft, zip + `SHA256SUMS.txt` | PASS |
| Tag on main | `git merge-base --is-ancestor ext-v0.1.0^{commit} origin/main` | exit 0 | PASS |
| Anonymous download verifies | `curl` then `sha256sum -c SHA256SUMS.txt` | OK | PASS |
| Privacy URL live | `curl .../legal/privacy/` | 200, anchor present | PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` probes are declared by this phase. Skipped.

### Requirements Coverage

| Requirement | Status | Evidence |
| ----------- | ------ | -------- |
| EXT-05 | SATISFIED | truth 1 |
| EXT-06 | SATISFIED | truth 2 |
| EXT-07 | SATISFIED as revised (assets done, submission cut by owner) | truth 3; REQUIREMENTS.md:66 and :155 say so |
| EXT-08 | SATISFIED | truth 4 |
| EXT-09 | CUT by owner 2026-11-20 | REQUIREMENTS.md:68 and :157 |

No orphaned requirement IDs for this phase.

### HUMAN-UAT tally check

Rows recounted by script: 99 origin rows and 4 Phase 13 rows. By class: smoke 5, smoke + human 1, human 73, owner-decision 15, cut 5. By result: passed 16, decided 8, cut 5, carried 2, pending 68. All match lines 138-144, including the named row lists (L90, L91, L96 in passed; L93, L95 in decided). Only the heading date on line 136 is stale.

### Anti-Patterns Found

No `TBD`, `FIXME` or `XXX` in any code, workflow, doc or test file touched by this phase. The one `shortcut:` comment (`extension-release-checks.mjs:74`, single probe attempt with no retry) states its limit. `.planning/ROADMAP.md:319` contains the literal "0/TBD" in the progress table; it is a planning table cell, listed under the gap.

### Human Verification Required

Listed in the `human_verification` frontmatter. Items 2 to 5 are limits already disclosed in HUMAN-UAT rows L90, L91, L93 and L96. Item 1 (the push) is the only one that changes what the public sees: until it happens, the install guide on GitHub still tells readers an Edge Add-ons listing is coming.

### Gaps Summary

The release itself is sound and independently reproducible: published, built by the workflow, on main, checksum-verified from an anonymous download, notes from the changelog, and both real runs behaved as the gates intend. The listing assets exist at the right size and pass their tests. At local HEAD no user-facing file promises a store listing, and a test keeps it that way.

The single gap is bookkeeping. The scope change was added as new lines but the older lines it supersedes were left standing, so ROADMAP.md states a goal ("complete and submitted") that its own next paragraph cancels, and PROJECT.md says both "Edge Add-ons instead" and "no store listing". A later milestone audit reading the goal line would mark the phase unmet. These are one-line edits in `.planning/` plus one sentence in `edge-listing.md`; none touches shipped code. If the owner prefers to accept the records as they are, an override on truth 6 would move the status to `human_needed`.

---

_Verified: 2026-11-20T05:21:39Z_
_Verifier: Claude (gsd-verifier)_

## Gap closure (2026-11-20, after this report)

The one gap (superseded wording left standing) was fixed in the same session: ROADMAP lines for the phase entry, goal, owner gate, research flag and progress table; PROJECT.md lines 159, 186 and 231; the Firefox row in REQUIREMENTS.md; the HUMAN-UAT tally date; a "not submitted" note at the top of `apps/extension/store/edge-listing.md`; and the two superseded headings in 17-05-SUMMARY.md. PROJECT.md line 99 (v1.0 EXT-04, historical) was left as is. The full scripts project was re-run after the edits. The human-verification items above still stand.
