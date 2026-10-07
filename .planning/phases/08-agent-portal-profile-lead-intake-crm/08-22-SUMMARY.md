---
phase: 08-agent-portal-profile-lead-intake-crm
plan: 22
subsystem: agent-profile-brand-kit
tags: [agent, profile, logo, brand-colors, contrast, csp, blob-url, canvas, svelte5, playwright, axe]

# Dependency graph
requires:
  - phase: 08-03
    provides: "img-src 'self' https://tile.openstreetmap.org blob: in the production CSP; agent banned-terms scope"
  - phase: 08-04
    provides: "@tran/core/agent/logo (checkLogoFile, pngSize, svgIntrinsicSize, rasterTargetSize) and @tran/brand/brand-color (normalizeHex, assessBrandColor, effectiveBrandColors, BRAND_FALLBACK, FALLBACK_NAMES)"
  - phase: 08-16
    provides: "ProfileForm extraFieldsets snippet + onchange(draft); profile page aside with DisclosurePreview"
provides:
  - "logo-pipeline.ts: prepareLogo(file, { rasterize? }) -> StoredLogo (sniff on the first KB, PNG <= 1024 px stored as-is, larger PNG and every SVG drawn to a 1024 px PNG, 75% retries under 512 KB), bytesToBase64 / base64ToBytes (chunked, no data: URLs)"
  - "logo-url.ts: logoObjectUrl(logo) blob: URL for previews and Phase 9 reports (callers revoke)"
  - "LogoUpload.svelte: Logo fieldset with hidden file input, 160x80 blob: preview, Remove logo, type/size refusal copy, announcements"
  - "BrandColorField.svelte: color picker + hex text mirror, Clear, live Passes / Too low verdict with ratio, fallback swatch, debounced verdict announcements"
  - "BrandPreview.svelte: 320px mini report header from effectiveBrandColors(); only --brand-primary / --brand-accent reach a style attribute"
  - "tests/e2e/agent-profile-brand.spec.ts: 7 tests on root and sub (24/24 with agent-profile.spec.ts)"
affects: [08-24 share link builder (same page), 08-26 AGT gate, Phase 9 reports (logoObjectUrl + effectiveBrandColors)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Injectable rasterizer: prepareLogo takes deps.rasterize so the Node unit tests cover gate/sniff/retry/cap logic with a fake, while the browser default is Blob -> object URL -> img.decode() -> canvas -> toBlob('image/png')"
    - "Blob-URL preview effect: $effect mints logoObjectUrl(logo) into local state and revokes it in the cleanup, so every logo change or unmount releases the URL"
    - "Draft holds only '' or a normalized #RRGGBB; the raw hex text lives in the field component, so an unfinished value can never reach the profile store"
    - "Snippet-with-draft: ProfileForm.extraFieldsets is Snippet<[ProfileInput]> and receives the live $state draft, so page-defined fieldsets write straight into the form"

key-files:
  created:
    - apps/web/src/lib/features/agent/profile/logo-pipeline.ts
    - apps/web/src/lib/features/agent/profile/logo-pipeline.test.ts
    - apps/web/src/lib/features/agent/profile/logo-url.ts
    - apps/web/src/lib/features/agent/profile/LogoUpload.svelte
    - apps/web/src/lib/features/agent/profile/BrandColorField.svelte
    - apps/web/src/lib/features/agent/profile/BrandPreview.svelte
    - apps/web/tests/e2e/agent-profile-brand.spec.ts
  modified:
    - apps/web/src/routes/(app)/agent/profile/+page.svelte
    - apps/web/src/lib/features/agent/profile/ProfileForm.svelte

key-decisions:
  - "ProfileForm's extraFieldsets snippet now receives the live draft (Snippet<[ProfileInput]>): without it the page-defined Logo and Brand colors fieldsets had no write path into the form state"
  - "PNGs wider or taller than 1024 px (including those over 4096 px) are downscaled to a 1024 px PNG instead of rejected; the byte cap still applies and the plan's LogoResult has no reason for a pixel rejection"
  - "An invalid or unfinished hex keeps the draft color at '' and shows the format error in place of the verdict, so Save profile can never hit agentProfileSchema's hex regex and fail"
  - "Verdict announcements fire on any transition into pass or fail (including from empty) after a 500 ms debounce; ratio changes inside the same verdict are silent"
  - "requirements mark-complete not run for AGT-01 (Phase 8 convention: AGT ids close at the 08-26 gate)"

patterns-established:
  - "Pattern: agent-entered colors render only through CSS custom properties set from effectiveBrandColors(); Tran's own chrome never takes them"
  - "Pattern: file inputs are content-sniffed through the core checkLogoFile before any decode; file.type and the extension are never trusted"

requirements-completed: []  # AGT-01 advanced (brand kit); closes at the 08-26 gate per the Phase 8 convention

# Metrics
duration: ~70min active across two stages (Stage 1 01:05-01:45Z implement + commit; Stage 2 02:25-02:52Z builds, E2E, csp:assert)
completed: 2026-10-07
---

# Phase 8 Plan 22: Agent brand kit (logo upload, brand colors, brand preview) Summary

**The profile page now takes a PNG or SVG logo (sniffed by content, SVG rasterized to a size-capped PNG, rendered from a blob: URL under the production CSP), two brand colors with a live WCAG verdict and Tran token fallbacks, and a mini report header preview that only ever shows the effective colors.**

## Performance

- **Duration:** ~70 min active (two-stage run: implementation while four other wave-5 executors shared the repo, then builds + Playwright once the build directory was free)
- **Started:** 2026-10-07T01:05:19Z
- **Completed:** 2026-10-07T02:51:34Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments
- `logo-pipeline.ts`: `prepareLogo(file)` refuses files over 524,288 bytes by size alone (nothing read), sniffs the first KB through `checkLogoFile`, stores a PNG of at most 1024 px unchanged, draws larger PNGs and every SVG to a 1024 px-longest-side PNG on a canvas (SVG size from width/height or viewBox, else 1024x512), retries at 75% up to three times while the PNG is over the cap, and returns `{ base64, mime: 'image/png', width, height, bytes }`. Base64 goes through chunked `btoa`/`atob`; no `data:` URL anywhere.
- `logo-url.ts`: `logoObjectUrl(logo)` for the profile preview, BrandPreview and Phase 9 reports.
- `LogoUpload.svelte`: the Logo fieldset (160x80 preview on background, `ImageUp` + "No logo yet" when empty, Choose logo label over a hidden `accept=".png,.svg,image/png,image/svg+xml"` input, Remove logo, helper and the two refusal messages, "Logo ready." / "Logo removed." announcements). SVG markup is never inlined; the preview is always an `<img>` on a blob: URL that is revoked on change and unmount.
- `BrandColorField.svelte`: 48x48 native color picker ("Pick primary/accent color") mirrored with a 128px hex field, Clear, "Use a 6-digit hex color, like #A4452A.", and the ContrastVerdict: Passes (secondary-surface badge, CircleCheck) or Too low (surface badge, TriangleAlert) with "{ratio}:1 with white|dark text", the "Reports will use Tran's terracotta|sand instead." line and a class-based fallback swatch; verdict flips announced after 500 ms.
- `BrandPreview.svelte`: `effectiveBrandColors(profile)` drives the single `style` attribute (`--brand-primary` / `--brand-accent`); accent band with the logo (max 120x48) and the agent name in espresso, 4px primary rule, a "Contact me" span in white on primary, the first print disclosure line, and the caption.
- Profile page: Logo and Brand colors fieldsets rendered inside the form through `extraFieldsets` (order: Your details, Mailing address, Logo, Brand colors); BrandPreview above DisclosurePreview in the sticky aside.
- E2E (24/24 for the `agent-profile` filter: 12 root + 12 sub, of which 7 + 7 are the new brand spec): a Node-built 2x1 PNG renders with `src` `blob:` and `naturalWidth` 2 with zero CSP violations, survives Save + reload; an SVG with viewBox 0 0 200 100 renders at `naturalWidth` 200 after reload; HTML named .png and JPEG magic bytes are refused with "Choose a PNG or SVG file."; 524,289 bytes gives "This logo is 513 KB. Choose one that's 512 KB or smaller."; #FFFFFF primary -> Too low, "1.0:1 with white text", announcer text, computed `--brand-primary` stays `#a4452a`; #1F4E79 -> Passes and reaches the preview; #2B1D16 accent -> Too low with sand; "#12" shows the hex error; "#fff" expands to #FFFFFF on blur; colors persist across reload; Clear resets to the fallback; Remove logo clears the preview, announces, and persists; axe clean and no horizontal scroll at 1280 and 375 with a logo and both verdicts.

## Task Commits

1. **Task 1: Logo pipeline and object-URL helper** - `1dc4e88` (feat)
2. **Task 2: LogoUpload, BrandColorField, BrandPreview and profile page wiring** - `71028d8` (feat)
3. **Task 3: Brand kit E2E on the built site** - `5c40339` (test)

**Plan metadata:** see the docs commit that adds this file.

## Files Created/Modified
- `apps/web/src/lib/features/agent/profile/logo-pipeline.ts` - prepareLogo, bytesToBase64, base64ToBytes, injectable Rasterize
- `apps/web/src/lib/features/agent/profile/logo-pipeline.test.ts` - 14 unit tests with a fake rasterizer (base64 round trip incl. 0x00/0xFF over 70,000 bytes; size gate with no read; JPEG/HTML refusals; PNG stored unchanged at <= 1024; wide PNG and SVG targets; unsized SVG default; retry sequence 800 -> 600 -> 450; give-up after 4 attempts; rasterizer failure)
- `apps/web/src/lib/features/agent/profile/logo-url.ts` - logoObjectUrl
- `apps/web/src/lib/features/agent/profile/LogoUpload.svelte` - Logo fieldset
- `apps/web/src/lib/features/agent/profile/BrandColorField.svelte` - one brand color row with verdict
- `apps/web/src/lib/features/agent/profile/BrandPreview.svelte` - mini report header
- `apps/web/src/routes/(app)/agent/profile/+page.svelte` - brand fieldsets snippet + BrandPreview in the aside
- `apps/web/src/lib/features/agent/profile/ProfileForm.svelte` - extraFieldsets now `Snippet<[ProfileInput]>` rendered with the draft (2 lines + doc comment)
- `apps/web/tests/e2e/agent-profile-brand.spec.ts` - 7 built-site tests (PNG built in Node via node:zlib)

## Decisions Made
- See `key-decisions` in the frontmatter. The alt text is "{brokerage or name} logo", falling back to "Your logo" before either is typed.
- "Checking..." in the busy label is written as `&hellip;` so the Phase 8 source stays ASCII.
- The hex error copy lives in a `HEX_ERROR` constant because Prettier wrapped the inline text and the acceptance grep needs it on one line.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] ProfileForm.svelte: `extraFieldsets` receives the live draft**
- **Found during:** Task 2 (page wiring)
- **Issue:** `extraFieldsets` was a parameterless `Snippet`. A snippet defined in the page can only see the page's `$state.raw` snapshot from `onchange`, so the Logo and Brand colors fieldsets had no way to write into the form's `$state` draft (which `isDirty`, Save profile and the previews read).
- **Fix:** `extraFieldsets?: Snippet<[ProfileInput]>` and `{@render extraFieldsets?.(draft)}`; the page snippet does `onchange={(l) => (d.logo = l)}` and `bind:value={d.brandPrimary}` / `d.brandAccent`. ProfileForm.svelte is outside this plan's `files_modified` but belongs to no concurrent wave-5 plan (08-24 touches it later).
- **Files modified:** apps/web/src/lib/features/agent/profile/ProfileForm.svelte
- **Verification:** E2E persistence tests (logo and colors survive Save + reload); "You have unsaved changes." after a logo or color change
- **Committed in:** 71028d8

**2. [Rule 1 - Behavior] Oversized PNGs are downscaled, not rejected**
- **Found during:** Task 1
- **Issue:** 08-RESEARCH Pattern 8 says to reject rasters over 4096 px on a side, but the plan's `LogoResult` has only `too-large` (bytes), `not-png-or-svg` and `unreadable`, none of which describes a pixel rejection, and the plan's own step list says "PNG larger -> rasterize to rasterTargetSize".
- **Fix:** Any PNG with a longest side over 1024 px (4096+ included) is drawn to a 1024 px PNG through the same capped rasterizer as SVGs. The 512 KB cap still governs what is stored. `isOversizedRaster` stays available in core if a later plan wants the stricter rule.
- **Files modified:** apps/web/src/lib/features/agent/profile/logo-pipeline.ts
- **Verification:** unit test "stores a 1024 px wide PNG unchanged but rasterizes a wider one to 1024"
- **Committed in:** 1dc4e88

**3. [Rule 2 - Missing Critical] Invalid hex never reaches the draft**
- **Found during:** Task 2
- **Issue:** `agentProfileSchema` requires `brandPrimary` / `brandAccent` to match `^(#[0-9A-Fa-f]{6})?$`, and `validateProfile` does not check them, so an unfinished hex in the draft would make `saveProfile` throw `profile-invalid` and surface as the generic "Your profile wasn't saved" error.
- **Fix:** `BrandColorField` keeps the raw text locally; the bound draft value is `normalizeHex(text) ?? ''`. While the text is invalid the field shows "Use a 6-digit hex color, like #A4452A." with `aria-invalid` and the verdict is hidden; on blur a valid short form is expanded (#fff -> #FFFFFF).
- **Files modified:** apps/web/src/lib/features/agent/profile/BrandColorField.svelte
- **Verification:** E2E "contrast verdicts..." (the "#12" step keeps `--brand-accent` at the sand token; "#fff" expands)
- **Committed in:** 71028d8

**4. [Rule 3 - Blocking] Banned term in a comment**
- **Found during:** Task 2 (`pnpm banned`)
- **Issue:** The agent-scoped banned list flags "sync"; my BrandColorField comment said "kept in sync".
- **Fix:** Reworded to "mirror each other".
- **Committed in:** 71028d8

---

**Total deviations:** 4 auto-fixed (2 blocking, 1 behavior, 1 missing critical)
**Impact on plan:** The snippet parameter is the only change outside the plan's file list and is required for the feature to work at all. No scope change.

## Issues Encountered
- The machine's performance counter runs backwards across cores since a resume from sleep, so every Node command ran through the single-core wrapper (core mask 0x8000). Single-core timings: vitest profile set 3 s, check ~40 s, each build ~70 s, the 24-test Playwright run 3.3 min.
- Repo-wide `pnpm lint` failed during Stage 1 on another executor's scratch file (`apps/web/tests/e2e/zz-debug-drag.spec.ts`, since removed); eslint was run directly on this plan's directories instead and was clean. By Stage 2 the tree was clean.
- The wrapper's cmd layer rejects literal `(app)` paths; Prettier and eslint were pointed at globs (`apps/web/src/routes/*/agent/profile/*.svelte`, `apps/web/src/routes/**/agent/profile/*.svelte`).
- Two transient svelte-check warnings appeared in `features/agent/tasks/*.svelte` (another executor's in-progress files) and were gone by the final run.

## Verification
- `vitest run --project web src/lib/features/agent/profile`: 50 passed (36 existing + 14 new).
- `pnpm check`: 2485 files, 0 errors, 0 warnings. eslint on the profile feature, route and spec: clean. Prettier: clean. `pnpm banned`: passed (330 files).
- `pnpm build:root` and `pnpm build:sub`: both built (32 pages each). `pnpm csp:assert`: passed on both builds.
- `playwright test agent-profile --workers=1`: 24 passed (root 12, sub 12), of which agent-profile-brand.spec.ts 7 + 7 and agent-profile.spec.ts 5 + 5.
- Acceptance greps: all Task 1/2/3 strings present; `readAsDataURL|data:image` 0 in the pipeline files; `@html` 0 in LogoUpload; exactly one `style=` in BrandPreview; "brokerage services" 0; all new files ASCII-only.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None. The brand kit is fully wired to the profile store; Phase 9 consumes `logoObjectUrl()` and `effectiveBrandColors()`.

## Next Phase Readiness
- 08-24 can add the inquiry share builder below the form; the page's `brandFieldsets` snippet and the aside are self-contained.
- Phase 9 reports: read `effectiveBrandColors(profile)` for colors and `logoObjectUrl(profile.logo)` (revoke after use) for the logo; both are the only sanctioned paths.
- AGT-01 stays open until the 08-26 gate per the Phase 8 convention (`requirements mark-complete` deliberately not run).

---
*Phase: 08-agent-portal-profile-lead-intake-crm*
*Completed: 2026-10-07*

## Self-Check: PASSED

All nine plan files and this SUMMARY exist on disk; commits 1dc4e88, 71028d8 and 5c40339 are in `git log`. Playwright agent-profile: 24/24 (root 12, sub 12); csp:assert passed on both builds.
