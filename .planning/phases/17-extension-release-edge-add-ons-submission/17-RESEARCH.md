# Phase 17: Extension Release & Edge Add-ons Submission - Research

**Researched:** 2026-11-16
**Domain:** GitHub Actions release hardening, Edge Add-ons (Partner Center) submission, store-asset capture
**Confidence:** MEDIUM-HIGH (repo facts HIGH; Partner Center form HIGH from the 2026-09-02 MS Learn revision; review turnaround and developer-policy numbering MEDIUM/LOW)

## User Constraints

No CONTEXT.md exists (owner chose to plan without discuss-phase). Constraints come from the roadmap and CLAUDE.md.

### Locked (from ROADMAP Phase 17 and CLAUDE.md)
- Owner gates are checkpoints, never decided by the agent: Zillow ToU read with go/no-go recorded, Showcase badge decision, setting `EXTENSION_RELEASES_ENABLED=true`, pushing the `ext-v0.1.0` tag, confirming the draft loads unpacked, publishing the draft, submitting in Partner Center, recording the SHA256 in the consolidated UAT file, editing the install guide after certification.
- Showcase badge: already decided 2026-10-29, stays excluded by default (HUMAN-UAT L92, PROJECT.md D-04). The gate is a confirm-only checkpoint.
- Screenshots exactly 1280x800 from the synthetic fixture page, never live Zillow.
- No mention of AI assistants in any file or commit; no `NAME_KEY=value` assignment in docs (gitleaks hook); plain `pnpm`, not corepack; $0 budget (Edge Add-ons free; no Chrome Web Store); extension only hides sponsored cards and never extracts Zillow data.
- Public repo: never commit secrets or real Zillow/RentCast data.

### Deferred / out of scope
- Chrome Web Store, Firefox Add-ons (cut), any extension feature work.

## Summary

Most of the release machinery already exists. `extension-release.yml` triggers on `ext-v*` tag pushes, is gated by `vars.EXTENSION_RELEASES_ENABLED == 'true'`, runs install, tag==package.version check, `vitest --project extension`, `wxt zip`, the oracle (`assert-extension.mjs --zip-dir`), `sha256sum`, then `gh release create --verify-tag` with `--notes-file docs/EXTENSION-INSTALL.md`. [VERIFIED: codebase] The remote exists (`origin` = `wolfwdavid/tran_real_estate`) and has no `ext-v*` tag yet (only `v1.0`). [VERIFIED: git ls-remote]

The gap versus the five success criteria is concrete: (1) no `workflow_dispatch` dry-run (the gate test currently asserts its absence); (2) release is published, not `--draft`; (3) notes come from the install guide, no `CHANGELOG.md`; (4) no tag-on-`main` ancestor check (checkout uses default depth 1, so `git merge-base --is-ancestor` needs `fetch-depth: 0` or an explicit fetch); (5) no manifest-version==tag check on the BUILT manifest (the existing check compares only `package.json`); (6) no zip entry allowlist (the oracle's `checkZip` only requires `manifest.json` at root); (7) no live privacy-URL probe; (8) listing copy lacks Website, Support contact, "Notes for certification", screenshots; `edge-listing.md` says screenshots are "captured from a live search", which contradicts the new constraint; (9) `docs/DEPLOY-CHECKLIST.md` Step 9 item 3 also says screenshots are "the popup and a dimmed card" and says to submit with 640x480 or 1280x800.

**Primary recommendation:** Keep the single workflow file and the existing step order; add a `workflow_dispatch` trigger with a dry-run default, put every new gate in testable Node scripts (`scripts/assert-extension.mjs` extensions plus one small `scripts/extension-release-checks.mjs`) rather than inline YAML shell, switch to `gh release create --draft`, and pin each new step in `extension-release-gate.test.ts` in the same commit. Screenshots come from a Playwright capture script reusing `apps/extension/e2e/zillow-page.ts` and the production build; verify dimensions by reading the PNG IHDR in a unit test.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary | Rationale |
|------------|--------------|-----------|-----------|
| Release gating (tag, ancestor, version, allowlist, probe) | CI (GitHub Actions) | Node scripts in `scripts/` | Logic in scripts is unit-testable; YAML only calls it |
| Draft release, checksums, notes | CI (`gh` CLI) | Owner (publish click) | Owner gate: publish is manual |
| Store copy and asset validation | Repo docs + vitest store-copy test | Owner (Partner Center paste) | Partner Center is a manual UI; the repo keeps paste-ready copy plus tests |
| Screenshot capture | Local Playwright script (production build + fixture page) | Unit test checks PNG size | Deterministic, offline, no live Zillow |
| Privacy URL live probe | CI (release job, network GET) | live-smoke already covers anchor | Fails closed before a draft exists |
| Certification and listing URL | Owner / Microsoft | Install-guide doc edit | Non-blocking follow-up |

## Standard Stack

No new packages. Everything is already installed and pinned.

| Tool | Version | Purpose |
|------|---------|---------|
| WXT | 0.21.5 | `wxt zip` -> `apps/extension/.output/sponsored-listing-filter-0.1.0-chrome.zip` [VERIFIED: apps/extension/package.json, .output listing] |
| Playwright | 1.65.0 | Screenshot capture (reuse persistent-context launch from `e2e/extension.spec.ts`) |
| Vitest | 5.1.0 | Gate tests, store-copy test |
| `gh` CLI | preinstalled on `ubuntu-24.04` runners | `gh release create --draft --verify-tag`, `gh run`/`gh release download` for owner verification [ASSUMED: runner image ships gh; ci already relies on it? verify in plan] |
| Node builtins | Node 24 | zip central-directory listing (`listZipEntries` already in `assert-extension.mjs`), PNG IHDR read, `fetch` for the probe |

**Package Legitimacy Audit:** No external packages are installed in this phase. slopcheck not run (nothing to check). Packages removed: none. Flagged: none.

Do not add a third-party release action (gate test forbids `softprops|action-gh-release|ncipollo|release-action`), do not add new `uses:` pins (gate test requires every SHA already pinned in `ci.yml`; the dry-run needs no upload-artifact action, see Pitfall 5).

## Architecture Patterns

### Release workflow flow (target)

```
tag push ext-v*  ----\                       workflow_dispatch (dry_run=true default)
                      v                                  v
        [if: vars.EXTENSION_RELEASES_ENABLED == 'true']   (same job, same gate var)
                      v
 checkout (fetch-depth: 0, persist-credentials: false)
   -> install --frozen-lockfile
   -> [tag push only] tag == ext-v<package.json version>
   -> [tag push only] tag commit is ancestor of origin/main
   -> vitest --project extension
   -> wxt zip (PUBLIC_SITE_URL, BASE_PATH env)
   -> oracle (manifest, zero-network, zip root)
   -> built manifest.version == tag version  (reads .output/chrome-mv3/manifest.json)
   -> zip entry allowlist (no .map/.ts/.env etc.)
   -> live privacy URL probe (GET 200 + anchor id present)
   -> sha256sum -> SHA256SUMS.txt ; sha256sum -c self-check
   -> notes = extract CHANGELOG.md [0.1.0] section
   -> if tag push: gh release create --draft --verify-tag ... ; else: stop (dry run, print sums to job summary)
Owner: download draft assets -> sha256sum -c -> load unpacked -> gh release edit --draft=false -> Partner Center
```

### Pattern 1: Put checks in scripts, pin the call in YAML
Existing precedent: `assert-extension.mjs` exports pure functions (`checkManifest`, `scanBundle`, `listZipEntries`, `checkZip`) with `assert-extension.test.ts`. Extend it: add `ZIP_ENTRY_DENY` / allowlist check in `checkZip`, and a `--tag <ref>` option comparing manifest `version`. Keep the YAML step names single-line `run:` calls so `extension-release-gate.test.ts` (text-based, ORDER array) can pin them. Update the ORDER array and the `each gate step appears exactly once` test for every new step.

### Pattern 2: Zip entry allowlist (default-deny)
Do not blocklist only `.map/.ts/.env`; the requirement says allowlist with those as must-reject. Build the allowlist from what WXT emits: `manifest.json`, `background.js`, `popup.html`, `chunks/*.js`, `assets/*.{js,css,woff2,woff,ttf?}`, `content-scripts/*.{js,css}`, `icon/*.png`. Derive the exact set by listing the real zip in a plan task (zip exists at `apps/extension/.output/`, built by Phase 16; re-run `pnpm ext:build` at plan time) and encode extensions plus a deny set (`.map`, `.ts`, `.tsx`, `.svelte`, `.env*`, `.pem`, dotfiles, `node_modules/`, `.git`). Unit-test with synthetic zips built in-test (the oracle tests already build zip buffers or can; mirror them), including a mutant per denied suffix.

### Pattern 3: Tag-on-main ancestor check
`actions/checkout` defaults to depth 1; `git merge-base --is-ancestor "$GITHUB_SHA" origin/main` fails without history. Use `fetch-depth: 0` (single checkout step; gate test counts `persist-credentials: false` once and `uses: actions/checkout@` once, keep both). Command: `git fetch origin main` is unnecessary after `fetch-depth: 0` (all branches fetched). For an annotated tag, `$GITHUB_SHA` is the commit, fine. [CITED: git-scm merge-base --is-ancestor semantics; ASSUMED: actions/checkout fetch-depth 0 fetches all remote branch heads, widely documented]

### Pattern 4: Draft release with notes from CHANGELOG
```bash
# Source: gh manual (gh release create); draft-first flow
gh release create "$GITHUB_REF_NAME" --draft --verify-tag \
  --title "Sponsored Listing Filter $GITHUB_REF_NAME" \
  --notes-file "$RUNNER_TEMP/release-notes.md" \
  apps/extension/.output/sponsored-listing-filter-*.zip apps/extension/.output/SHA256SUMS.txt
```
Extract the notes with a tested Node script (`scripts/changelog-notes.mjs <changelog> <version>`): take the `## [0.1.0] - YYYY-MM-DD` section body; fail closed if missing or empty. Keep a Changelog format: `## [Unreleased]`, `## [0.1.0] - <date>`, `### Added`, link refs at bottom. [CITED: keepachangelog.com/en/1.1.0]. Test: version in changelog heading equals `apps/extension/package.json` version (this also gives EXT-06 an automated proof) and the notes file does not equal or include the install guide.

### Pattern 5: Checksum verifiability
`sha256sum sponsored-listing-filter-*.zip > SHA256SUMS.txt` run in `.output` writes a bare filename (no path), so `sha256sum -c SHA256SUMS.txt` works from the download folder. Add `sha256sum -c SHA256SUMS.txt` as a workflow self-check step before upload. Owner verifies after download: `gh release download ext-v0.1.0 --dir <empty-dir>` then `sha256sum -c SHA256SUMS.txt` (Git Bash on Windows has `sha256sum`; PowerShell `Get-FileHash` alternative already in the install guide). Draft assets are downloadable by the owner with repo write access (use `gh release download`, drafts are not on the public releases page).

### Pattern 6: Dry-run trigger
```yaml
on:
  push:
    tags: ['ext-v*']
  workflow_dispatch: {}
```
Tag-specific steps get `if: github.event_name == 'push'`; the publish step too. On dispatch the ref is a branch, so the tag==version and ancestor steps are skipped, and "version equals tag" is replaced by "version equals package.json" (always true). For dry-run realism, accept an optional `inputs.version` is NOT needed (YAGNI). The gate var still applies to dispatch (fine: the dry-run needs `EXTENSION_RELEASES_ENABLED=true` too, which the owner sets anyway; OR move the dry-run to ignore the gate. Recommend keeping one `if:` line so the existing "appears exactly once" test stays valid; flag as open question O2).
Gate-test changes required: the `trigger` test currently asserts `not.toContain('workflow_dispatch')` and an exact `on:` block; rewrite both. The `if:` single-line count test must tolerate step-level `if: github.event_name == 'push'` lines (its regex is scoped to `EXTENSION_RELEASES_ENABLED`, so OK).

### Anti-patterns
- Inline multi-line shell in YAML that tests cannot run: put it in a script.
- `${{ github.ref_name }}` interpolated into `run:` (script injection surface; tag names are attacker-influenced only for repo writers, but use `$GITHUB_REF_NAME` env as the existing file does).
- Publishing from the workflow: criterion 4 says real releases are drafts; publishing is an owner action.
- Adding upload-artifact for the dry-run (new action pin breaks the "no new pins" test). Use `$GITHUB_STEP_SUMMARY` to print the zip name, size, entry count and SHA256.

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---------|-------------|-------------|-----|
| Zip listing | New zip parser | `listZipEntries` in `scripts/assert-extension.mjs` | Already tested, central-directory based |
| Release creation | Third-party action | `gh release create --draft --verify-tag` | Gate test forbids third-party release actions; fewer supply-chain pins |
| Changelog parsing | Regex in YAML | tiny tested Node script | Fail-closed, unit-testable |
| Site URL / privacy URL | Hard-coded string in workflow | `resolveSiteUrl()` (`apps/web/src/lib/site-config.js`) | Same helper the zip, the oracle and the docs tests use (origin-parity test) |
| PNG dimension check | Image library | Read IHDR (bytes 16-23, big-endian width/height) | 10 lines, zero deps |
| Store form submission | Automating Partner Center | Manual submit with paste-ready copy | Owner gate; Partner Center has a publish API but needs credentials, out of scope and $0 secret-free constraint |

## Runtime State Inventory
Not a rename/refactor phase. Skipped. (No stored data; the only external state is the GitHub repo variable `EXTENSION_RELEASES_ENABLED` (currently unset, per RUNBOOK it is listed as `true` to be set) and Partner Center, both owner-managed.)

## Common Pitfalls

### Pitfall 1: Ancestor check fails on a shallow clone
**What goes wrong:** `merge-base --is-ancestor` errors "Not a valid commit name origin/main" or returns false. **Why:** default `fetch-depth: 1`, tag checkouts have no branch refs. **Avoid:** `fetch-depth: 0`; test the script with a temp git repo (create commits, tag on a side branch, assert reject). **Sign:** step fails on a legitimate tag.

### Pitfall 2: Gate test is text-based and strict
`extension-release-gate.test.ts` asserts exact `on:` block, exact ORDER, "each step exactly once", `uses:` count 3, count of `persist-credentials: false` 1, `GH_TOKEN: ${{ github.token }}` count 1, no `secrets.`, no `git push`. Every new step must be reflected in the same commit, and `pnpm lint:workflows` (actionlint) must stay green. Per tasks/lessons.md: run the full `pnpm test:unit`, not just this file, before pushing a workflow edit (ci.yml facts are asserted in several files).

### Pitfall 3: Probe flakiness and the SPA 404 fallback
GitHub Pages serves 404.html with HTTP 404 for unknown paths; the privacy page is prerendered with `trailingSlash: 'always'`, so probe `.../legal/privacy/` (with trailing slash) and require status 200 AND the body to contain `id="browser-extension"`. The fragment never reaches the server. Use `fetch` with a retry-free single attempt plus a bounded timeout (`AbortSignal.timeout`); a transient Pages blip then fails the release job loudly and the owner re-runs (releases are rare). Derive URL from `resolveSiteUrl({PUBLIC_SITE_URL, BASE_PATH})`; fail if the site URL is the default placeholder (vars unset). Respect the repo rule that annotated timeouts need a measured+cause comment (test-lane rules apply to test files; keep it out of tests by making the probe injectable with a stub `fetch`).

### Pitfall 4: Version triple-equality
Tag, `apps/extension/package.json` version, built `manifest.json` version, and the zip filename must agree (`ZIP_NAME` regex in the oracle already ties the name to semver). WXT takes manifest `version` from package.json, so a mismatch is only possible if the build is stale; check the built manifest anyway (it is what the store sees). CHANGELOG heading must also match (EXT-06 test).

### Pitfall 5: New `uses:` pins break the supply-chain test
Do not add `actions/upload-artifact` or setup actions. If artifact upload for the dry-run is wanted, it must be pinned in ci.yml first (ci.yml already uses upload-artifact for traces, so the SHA exists there and could be reused; confirm before relying on it). Simplest: job summary only.

### Pitfall 6: Edge policy 1.1.2 and listing copy
Existing test `never mentions another browser` scans the entire `edge-listing.md` for chrome/chromium/firefox/brave/safari/opera. The new "Notes for certification" section lives in that file, so it must also avoid those words (do not write "Chromium-based"). The install guide legitimately names Chrome/Brave and is not scanned for that rule. Also the banned-word regex (`block|remove|official|Zillow's`...) applies: write "dims", never "blocks".

### Pitfall 7: Screenshot dimensions drift
Chromium headless screenshots at `viewport 1280x800` and `deviceScaleFactor: 1` give 1280x800; a HiDPI default would yield 2560x1600. Set `deviceScaleFactor: 1` explicitly. Assert width/height from IHDR in a unit test over the committed PNGs.

### Pitfall 8: Immutable releases
If the repo enables "immutable releases", a published release can't gain assets later. Draft-first with all assets attached before publish is the documented flow, which this design follows. [CITED: docs.github.com managing releases]

### Pitfall 9: Windows tooling
Owner verification on Windows: `sha256sum -c` works in Git Bash; the guide's PowerShell path compares manually. Set `MSYS_NO_PATHCONV=1` when exporting `BASE_PATH=/tran_real_estate` in Git Bash for the local dry run (tasks/lessons.md).

## Edge Add-ons Partner Center facts (re-read 2026-11-16)

Source: MS Learn "Publish a Microsoft Edge extension", page revision updated 2026-09-02. [CITED: learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension]

| Item | Fact |
|------|------|
| Flow | Create new extension -> upload zip -> Availability -> Properties -> Privacy -> Store listings -> Publish (Submit page with Notes for certification) |
| Properties | Category required; **Website** optional (must be a page on your own site, NOT the Edge listing); **Support contact detail** optional (support URL or email); Mature content optional. Developer name, Website, Support contact detail are also entered at registration and are displayed to users |
| Privacy page | Single purpose; per-permission justification (manifest `storage` and the Zillow host permission); remote code Yes/No (select No); data usage checkboxes + certification; privacy policy URL |
| Store listing | Name and short description come from the manifest (read-only); Description 250-10,000 chars required; Logo required, 1:1, recommended 300x300, min 128x128; small tile 440x280 optional; large tile 1400x560 optional; **Screenshots optional, max 6, exactly 640x480 or 1280x800**; search terms optional, max 7 terms / 21 words / 30 chars each |
| Notes for certification | Optional text box on the Submit page: test accounts, steps to reach hidden features, expected differences, changes for updates |
| Turnaround | "Can take up to seven business days" per the doc. The roadmap says the 2026-09 Edge dev blog reports turnaround rising; not re-verified (blog not fetched). Treat 7 business days as a floor for planning, per the roadmap [CITED: ROADMAP.md; MS Learn says "up to seven"] |
| Cost | Developer registration free (roadmap/STACK: Edge free vs Chrome $5) [CITED: STACK sources] |

Mapping to existing repo copy: the Privacy-tab answers, Single purpose, permission justifications, remote code No, data collection None, privacy URL, search terms (7 terms: OK; the 21-word cap is satisfied) and category Shopping already exist in `apps/extension/store/edge-listing.md`. Missing: Website, Support contact detail, Notes for certification, screenshots section rewrite.

Edge developer policies page: the fetch of `/en-us/microsoft-edge/extensions/publish/developer-policies` returned 404 (URL moved; the live link in the guide is `/en-us/legal/microsoft-edge/extensions/developer-policies`). Not re-read in this session. The repo's existing tests cite policy 1.1.2 (no references to other browsers) and 1.2.2 (unwanted software). [ASSUMED: policy numbering unchanged since the test was written; the owner/plan must re-read the live policy on the day of submission, as the roadmap flag says.] See Open Question O4.

### Draft content for the new listing sections (paste-ready, must satisfy the existing BANNED/OTHER_BROWSERS tests)

- **Website:** `https://wolfwdavid.github.io/tran_real_estate/` (own site; not the Edge listing).
- **Support contact detail:** a URL on the live site, e.g. the project's feedback page, or the owner's `PUBLIC_CONTACT_EMAIL`. Owner decision (O1); do not commit a personal email.
- **Notes for certification (draft):** "The extension runs only on zillow.com search results pages. It dims list items that Zillow marks as advertising slots and cards labelled Sponsored, Promoted or Featured, and adds a small 'Sponsored - show' button to each dimmed card. On live Zillow today only advertising-slot list items are dimmed; labelled cards are matched by exact short text and may not appear on every search. No account, login or test data is needed. Open a Zillow rentals or for-sale search, and the toolbar badge shows how many items were dimmed; the popup has one on/off switch. The extension makes no network requests and reads no listing details; the popup content security policy sets connect-src to 'none'." Ground-truth claim ("only ad-slot list items dim on live Zillow today") is stated in REQUIREMENTS EXT-07; confirm it against the owner's live smoke (UAT L90, still carried).

## Screenshot capture design

- Need 2 or 3 PNGs at 1280x800 in `apps/extension/store/screenshots/` (e.g. `01-dimmed-results.png`, `02-reveal-card.png`, `03-popup.png`).
- Capture script `apps/extension/scripts/capture-store-shots.mjs` (or a Playwright spec file not in the default e2e run) that: launches persistent Chromium with the production `.output/chrome-mv3` (same as `extension.spec.ts` `launch()`), `viewport {1280,800}`, `deviceScaleFactor 1`, `reducedMotion: 'reduce'`, routes `ZILLOW_URL` to `PAGE_A` (`e2e/zillow-page.ts`), aborts all other http(s), screenshots the page. The popup is a `chrome-extension://<id>/popup.html` page; open it in a tab with the viewport 1280x800 for shot 3 (a tiny popup centered on a large canvas looks sparse; alternative is a composite page, but keep to a real capture and let the owner judge, see O5).
- Fixture content is synthetic hand-written HTML (`tests/fixtures/cards.ts`: no scripts, no links, no URLs), satisfying the "never live Zillow" rule. Because the fixture markup is minimal, confirm shot 1 looks like a results grid; if too bare, add a presentational wrapper page in `zillow-page.ts` (CSS grid of the fixture cards) without changing fixture semantics. UI hint is "no" in the roadmap, so keep this to a capture, not a design task.
- Proof tests: (a) every PNG under `store/screenshots/` is exactly 1280x800 and 2-3 files exist (IHDR read); (b) PNG is real (signature bytes). Committing 2-3 PNGs under ~500 KB each is fine for the public repo; they contain only synthetic content. Check `guard-real-data` and `fixtures-guard` do not flag `store/` PNGs (run in plan).
- The capture cannot run unattended in CI cheaply; commit the PNGs and make the test check the committed files. Capture is a repeatable local script, re-run when the popup changes.

## Existing files and tests to touch

| File | Change |
|------|--------|
| `.github/workflows/extension-release.yml` | dispatch trigger, `fetch-depth: 0`, new steps, `--draft`, notes from changelog, `if: github.event_name == 'push'` on tag-only and publish steps |
| `scripts/extension-release-gate.test.ts` | rewrite `trigger` test; extend ORDER; per-step pin; draft pin (`--draft` present, `--verify-tag` still present); `sha256sum -c` pin; notes-file pin (not `docs/EXTENSION-INSTALL.md`) |
| `scripts/assert-extension.mjs` + `.test.ts` | zip entry allowlist/denylist, optional `--expect-version` |
| `scripts/extension-release-checks.mjs` (+ test) | tag/package/manifest version triple, ancestor check wrapper, privacy probe (injectable fetch), changelog notes extractor |
| `apps/extension/CHANGELOG.md` (new) | Keep a Changelog, 0.1.0 entry |
| `apps/extension/store/edge-listing.md` | add Website, Support contact, Notes for certification, Screenshots list; fix "captured from a live search" |
| `scripts/extension-docs.test.ts` | new tests: sections exist, notes contain the ad-slot statement, screenshots PNG size, no other browser (already global) |
| `docs/DEPLOY-CHECKLIST.md` Step 9 | align with new flow (draft, dry-run, screenshots from fixture); `deploy-checklist.test.ts` pins its order, so run it |
| `docs/EXTENSION-INSTALL.md` | EXT-09 follow-up only, see below |
| `docs/RUNBOOK.md` | add the dry-run command and the draft verification steps (runbook.test.ts pins tables; run it) |
| `.planning/HUMAN-UAT.md` | L90, L91, L93, L95, L96 results; `human-uat-ledger.test.ts` enforces counts, so edit rows by changing status text only, run it |
| `extension-release-gate` also covered by `actionlint.mjs` | `pnpm lint:workflows` |

### EXT-09 install-guide test
Current guide placeholder sentence: "The listing link will appear here once the Microsoft Edge Add-ons listing is live. Installs from Edge Add-ons update automatically." No test pins it today. Add a test in `extension-docs.test.ts`: section "Install from Microsoft Edge Add-ons" contains EITHER that exact placeholder sentence OR a link matching `https://microsoftedge.microsoft.com/addons/detail/`, never neither. Listing URL form [ASSUMED: `https://microsoftedge.microsoft.com/addons/detail/<slug>/<id>`; confirm from the Partner Center Overview page, which the doc says shows the listing URL]. Phase closes with the placeholder (owner follow-up, non-blocking).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `gh` CLI is preinstalled on `ubuntu-24.04` runners and supports `--draft --verify-tag` | Standard Stack | Release step fails; the current workflow already calls `gh release create --verify-tag`, so low risk |
| A2 | `actions/checkout` `fetch-depth: 0` makes `origin/main` resolvable on a tag-triggered run | Pattern 3 | Ancestor step fails; verify with a dry run on a throwaway tag or test via local temp repo |
| A3 | Edge policy numbers 1.1.2 and 1.2.2 unchanged | Edge facts | Test comments cite a stale number; harmless, but copy rules could have changed. Re-read on submission day |
| A4 | Edge listing URL shape `microsoftedge.microsoft.com/addons/detail/...` | EXT-09 | The EXT-09 test regex rejects a valid URL; widen to `https://microsoftedge.microsoft.com/` |
| A5 | Review turnaround is rising beyond the documented 7 business days | Edge facts | Only a scheduling expectation; roadmap already treats 7 as a floor |
| A6 | "Only ad-slot list items dim on live Zillow today" is true | Notes for certification | Misleading certification note; confirm via owner live smoke L90 before submitting |
| A7 | Draft release assets are downloadable by the owner via `gh release download` | Pattern 5 | Verification step needs the web UI instead; low risk |

## Open Questions

1. **O1 Support contact detail:** URL or email? Recommend a URL on the live site (feedback page) so no personal email is committed. Owner decision at the Partner Center checkpoint.
2. **O2 Should the dispatch dry-run require `EXTENSION_RELEASES_ENABLED`?** Recommend yes (single `if:` line, keeps the "exactly once" test), at the cost that the owner sets the variable before the dry run. Setting the variable alone cannot publish, because publishing needs a tag push and then only creates a draft. If the owner prefers a gate-free dry run, the gate test's exactly-once pin needs a second condition.
3. **O3 Zillow ToU go/no-go (owner gate, L93):** must be recorded before EXT-07 submission and before publishing the draft; building the draft does not need it per the checklist ("gates the store listing and the GitHub Release, not the build"). Plan: tag push and draft creation may precede the decision only if the owner accepts a never-published draft; safest ordering is ToU decision first.
4. **O4 Edge developer policies re-read:** page URL moved; the executing owner must re-read https://learn.microsoft.com/en-us/legal/microsoft-edge/extensions/developer-policies on submission day, and record the revision date in HUMAN-UAT.
5. **O5 Screenshot composition:** is a popup-only 1280x800 shot acceptable, or should shot 3 be a composite with the popup beside the results? Needs owner eyes; capture is cheap to redo.
6. **O6 First real tag:** `ext-v0.1.0` must be on `main`. Check at execution time that the commit with the hardened workflow, CHANGELOG, and store assets is pushed to `main` BEFORE tagging (the ancestor check depends on it). The workflow file used for a tag push is the one at the tagged commit.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node | scripts | yes | 24 per `.nvmrc` | none needed |
| pnpm | build/test | yes | 12.18.0 pin (use plain `pnpm`) | none |
| git remote `origin` | tag push, ancestor check | yes | `wolfwdavid/tran_real_estate`, no `ext-v*` tag yet | none |
| Built zip `apps/extension/.output/sponsored-listing-filter-0.1.0-chrome.zip` | allowlist derivation | yes (present) | 0.1.0 | rebuild with `pnpm ext:build` |
| `gh` CLI locally (owner verification) | draft download | not probed (read-only research) | - | Download from the release page in the browser |
| Partner Center account | submission | owner (STATE.md line 774 says to create; status not recorded) | - | blocking for submission only |
| Repo variable `EXTENSION_RELEASES_ENABLED` | workflow job | not set (owner gate) | - | blocking for the first draft |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 5.1.0 (root `scripts` project, parallel lane) + Playwright 1.65.0 for extension e2e |
| Config | `scripts/vitest.config.ts`, `scripts/vitest.serial.config.ts`; `apps/extension/vitest.config.ts` |
| Quick run | `pnpm vitest run --project scripts scripts/extension-release-gate.test.ts scripts/extension-docs.test.ts scripts/assert-extension.test.ts` |
| Full suite | `pnpm verify` (and `pnpm test:unit` before any workflow push, per tasks/lessons.md) |

### Phase Requirements -> Test Map
| Req | Behavior | Test type | Automated command | Exists |
|-----|----------|-----------|-------------------|--------|
| EXT-05 | Tag == package == built manifest version; zip + SHA256SUMS contents verify | unit (version triple, `sha256sum -c` step pin) + workflow dry-run | `vitest run scripts/extension-release-checks.test.ts scripts/extension-release-gate.test.ts` | Wave 0 (checks test new; gate test exists) |
| EXT-05 | Published release exists, downloads verify, loads unpacked once | OWNER MANUAL (L96): download draft, `sha256sum -c`, load unpacked, publish; record SHA256 in HUMAN-UAT | - | manual |
| EXT-06 | CHANGELOG exists, Keep a Changelog shape, 0.1.0 entry matches package version; notes extractor returns the section; workflow notes-file is not the install guide | unit | `vitest run scripts/extension-release-checks.test.ts scripts/extension-release-gate.test.ts` | Wave 0 |
| EXT-07 | Listing has Website, Support contact, Notes for certification (ad-slot statement), no other browser named, banned words absent | unit (store-copy) | `vitest run scripts/extension-docs.test.ts` | extend existing |
| EXT-07 | 2-3 screenshots exactly 1280x800 PNG | unit (IHDR) | `vitest run scripts/extension-docs.test.ts` | Wave 0 |
| EXT-07 | ToU go/no-go recorded; privacy URL live; submission done | OWNER MANUAL (L93, L94 smoke passed 2026-10-31, L95); privacy URL also asserted by the in-release probe and the existing `extension-link.smoke.ts` in live-smoke | - | manual |
| EXT-08 | dispatch trigger present; dry-run does not publish; `--draft`; ancestor check; version==tag; zip allowlist; privacy probe; each pinned | unit text pins + script unit tests (temp git repo for ancestor; synthetic zips for allowlist; stub fetch for probe) | `vitest run scripts/extension-release-gate.test.ts scripts/assert-extension.test.ts scripts/extension-release-checks.test.ts` and `pnpm lint:workflows` | gate test exists (rewrite); others Wave 0 |
| EXT-08 | Real dry-run on GitHub produces green run, no release created | OWNER/EXEC MANUAL after push: `gh workflow run extension-release.yml` then `gh run watch`; confirm `gh release list` shows nothing new | - | manual (needs variable set) |
| EXT-09 | Install guide has placeholder sentence or a listing link, never neither | unit | `vitest run scripts/extension-docs.test.ts` | Wave 0 |
| EXT-09 | Link replaced after certification | OWNER FOLLOW-UP, non-blocking | - | manual |

Mutation proofs: for each new check include a negative test (shallow/non-ancestor tag, mismatched version, `.map` in zip, `.env` in zip, 404 probe, missing anchor, empty changelog section, 1280x799 PNG), following the repo's non-vacuity ledger style (`test-lane-rules`, `assert-extension.test.ts`).

### Sampling Rate
- Per task commit: quick run above.
- Per wave merge: `pnpm test:unit` plus `pnpm lint:workflows` plus `pnpm ext:build && pnpm ext:assert`.
- Phase gate: full `pnpm verify` green; then owner pushes (workflow changes first, tag second).

### Wave 0 Gaps
- [ ] `scripts/extension-release-checks.mjs` and `.test.ts` (version triple, ancestor, probe, notes extractor)
- [ ] zip allowlist in `assert-extension.mjs` plus tests
- [ ] store screenshots PNGs plus capture script plus IHDR test
- [ ] `apps/extension/CHANGELOG.md`
- [ ] No new framework installs.

## Security Domain

| ASVS category | Applies | Control |
|---------------|---------|---------|
| V1 Architecture / supply chain | yes | no new action pins; no third-party release action; no cache on release job; `persist-credentials: false`; only `github.token`, `contents: write` on the release job only |
| V5 Input validation | yes | tag name and changelog read as data; use env vars (`$GITHUB_REF_NAME`), never `${{ }}` inside `run:`; reject tags not matching `^ext-v\d+\.\d+\.\d+$` |
| V8 Data protection | yes | zip allowlist excludes `.env`, `.map`, `.ts`; oracle already scans for URL/network tokens; screenshots are synthetic only |
| V14 Config | yes | gate variable keeps the workflow dormant; draft default means no public artifact without an owner click |

Threat patterns: poisoned release artifact via cache (no cache); stray secret/sourcemap in the zip (allowlist); release from a non-main commit (ancestor check); mis-versioned store submission (version triple); stale/dead privacy URL (probe); gitleaks hook rejects `NAME_KEY=value` in docs (do not write variable assignments such as the gate variable with `=` in docs; write "set the variable to true").

## Code Examples

### PNG size (no dependency)
```js
// IHDR: bytes 0-7 signature, 16-19 width, 20-23 height (big-endian)
const b = readFileSync(path);
const ok = b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
const [w, h] = [b.readUInt32BE(16), b.readUInt32BE(20)];
```

### Ancestor check (testable wrapper)
```bash
git merge-base --is-ancestor "$GITHUB_SHA" origin/main   # exit 0 = ancestor
```

### Owner verification of the draft
```bash
gh release download ext-v0.1.0 --repo wolfwdavid/tran_real_estate --dir ./ext-check
cd ext-check && sha256sum -c SHA256SUMS.txt
```
(then unzip, Load unpacked, then `gh release edit ext-v0.1.0 --draft=false`)

## State of the Art

| Old | Current | Impact |
|-----|---------|--------|
| Publish release directly | Draft-first, attach all assets, owner publishes (immutable releases compatible) | Matches criterion 4 |
| Notes from install guide | Notes from CHANGELOG section | Matches EXT-06 |

## Sources

### Primary (HIGH)
- Repo: `.github/workflows/extension-release.yml`, `scripts/extension-release-gate.test.ts`, `scripts/assert-extension.mjs`, `scripts/extension-docs.test.ts`, `apps/extension/store/edge-listing.md`, `docs/EXTENSION-INSTALL.md`, `docs/DEPLOY-CHECKLIST.md` Step 9, `.planning/HUMAN-UAT.md` L90-L97, `tasks/lessons.md`, `git ls-remote --tags origin`
- https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension (revision 2026-09-02): all Partner Center fields, screenshot sizes, certification up to 7 business days

### Secondary (MEDIUM)
- WebSearch results on `gh release create --draft --verify-tag` and draft-first immutable-release flow (docs.github.com managing releases; project guides); `--verify-tag` semantics not independently confirmed from the gh manual

### Tertiary (LOW)
- Edge developer-policy numbering (page not re-fetched; 404 on the old path); review-turnaround trend (from the roadmap's note, blog not fetched)

## Metadata
**Confidence:** repo gap analysis HIGH; Partner Center form HIGH; policies and turnaround LOW-MEDIUM.
**Research date:** 2026-11-16. **Valid until:** about 30 days; re-read the Partner Center form and policies on the submission day regardless.
