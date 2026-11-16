---
phase: 17
slug: extension-release-edge-add-ons-submission
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-11-16
---

# Phase 17 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Source: `17-RESEARCH.md`, section "Validation Architecture".

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 5.1.0 (root `scripts` project) + Playwright 1.65.0 (extension e2e, screenshot capture) |
| **Config file** | `scripts/vitest.config.ts`, `scripts/vitest.serial.config.ts`, `apps/extension/vitest.config.ts` |
| **Quick run command** | `pnpm vitest run --project scripts scripts/extension-release-gate.test.ts scripts/extension-docs.test.ts scripts/assert-extension.test.ts scripts/extension-release-checks.test.ts` |
| **Full suite command** | `pnpm verify` (and the full `pnpm test:unit` before any push that touches a workflow file) |
| **Estimated runtime** | quick ~20 seconds; full ~25 minutes |

---

## Sampling Rate

- **After every task commit:** run the quick run command
- **After every plan wave:** `pnpm test:unit`, `pnpm lint:workflows`, `pnpm ext:build && pnpm ext:assert`
- **Before `/gsd:verify-work`:** full `pnpm verify` green
- **Max feedback latency:** 30 seconds for the quick run

---

## Per-Task Verification Map

Task IDs are filled in by the planner; the rows below are the requirement-level contract each task must map to.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 17-01-T1, 17-03-T1 | 17-01, 17-03 | 1, 3 | EXT-05 | supply chain | tag, package and built manifest versions are equal; zip and `SHA256SUMS.txt` verify | unit + step pin | `pnpm vitest run --project scripts scripts/extension-release-checks.test.ts scripts/extension-release-gate.test.ts` | ❌ W0 (checks test) / ✅ (gate test) | ⬜ pending |
| 17-01-T3, 17-03-T1 | 17-01, 17-03 | 1, 3 | EXT-06 | — | changelog has the 0.1.0 entry; release notes come from it, not the install guide | unit | `pnpm vitest run --project scripts scripts/extension-release-checks.test.ts scripts/extension-release-gate.test.ts` | ❌ W0 | ⬜ pending |
| 17-02-T2 | 17-02 | 2 | EXT-07 | data protection | listing copy names no other browser; certification notes state the ad-slot fact; screenshots are synthetic only | unit (store copy) | `pnpm vitest run --project scripts scripts/extension-docs.test.ts` | ✅ extend | ⬜ pending |
| 17-02-T1, 17-02-T2 | 17-02 | 2 | EXT-07 | data protection | two or three PNG screenshots, exactly 1280x800 | unit (PNG header) | `pnpm vitest run --project scripts scripts/extension-docs.test.ts` | ❌ W0 | ⬜ pending |
| 17-01-T1, 17-01-T2, 17-03-T1 | 17-01, 17-03 | 1, 3 | EXT-08 | supply chain, input validation | dispatch dry-run never publishes; `--draft`; tag is an ancestor of `main`; zip allowlist rejects `.map`, `.ts`, `.env`; live privacy URL probe | unit text pins + script tests (temp git repo, synthetic zips, stub fetch) | `pnpm vitest run --project scripts scripts/extension-release-gate.test.ts scripts/assert-extension.test.ts scripts/extension-release-checks.test.ts && pnpm lint:workflows` | ✅ rewrite (gate) / ❌ W0 (others) | ⬜ pending |
| 17-02-T2 | 17-02 | 2 | EXT-09 | — | install guide has the placeholder sentence or an Edge listing link, never neither | unit | `pnpm vitest run --project scripts scripts/extension-docs.test.ts` | ❌ W0 | ⬜ pending |

Each new check needs a negative test: non-ancestor tag, mismatched version, `.map` in zip, `.env` in zip, 404 probe, empty changelog section, 1280x799 PNG, install guide with neither placeholder nor link.

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/extension-release-checks.mjs` and `scripts/extension-release-checks.test.ts` — version triple, ancestor check, privacy probe, changelog notes extractor (EXT-05, EXT-06, EXT-08)
- [ ] zip entry allowlist in `scripts/assert-extension.mjs` plus tests (EXT-08)
- [ ] store screenshots, the capture script and the PNG-header test (EXT-07)
- [ ] `apps/extension/CHANGELOG.md` (EXT-06)
- [ ] No new framework installs.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Draft release downloads verify and the zip loads unpacked once; then publish | EXT-05 | Needs a real tag push, the repo variable and a browser | Download the draft assets, run `sha256sum -c SHA256SUMS.txt`, load the unzipped folder in Edge, publish, record the SHA256 in the consolidated UAT file |
| Dry-run on GitHub is green and creates no release | EXT-08 | Runs only on GitHub with the repo variable set | `gh workflow run extension-release.yml`, `gh run watch`, then `gh release list` shows nothing new |
| Zillow Terms of Use go/no-go recorded | EXT-07 | Owner legal decision | Read the terms, record the decision and date in the UAT file before publishing or submitting |
| Edge developer policies re-read on submission day | EXT-07 | Policy text changes; the page moved | Read the current policies, record the revision date in the UAT file |
| Partner Center submission | EXT-07 | Owner account and web form | Paste the listing copy, upload the Release zip and screenshots, fill the certification notes, submit |
| Listing link added to the install guide after certification | EXT-09 | Depends on certification (at least 7 business days); non-blocking | Replace the placeholder sentence with the listing URL; the install-guide test must stay green |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
