# Deploy checklist (owner actions)

Nothing in this file is required for local development. Every gate in the repository runs
locally and in CI without a remote, an organization, or a domain. The steps below are the
hosting actions only the repository owner can perform in a browser. Do them in order, once.

Until they are done the deploy job in `.github/workflows/ci.yml` stays dormant: it is gated on
the repository variable `PAGES_ENABLED`, and an unset variable evaluates to `''`, so the upload
and deploy steps skip cleanly on every run.

## Step 1: Create the organization

Create the free GitHub organization `tranrealestate` in the browser. Organizations cannot be
created through the API or the CLI, so this is always a manual step.

## Step 2: Create an empty public repository named exactly `tranrealestate.github.io`

Inside the organization create a public repository **named exactly `tranrealestate.github.io`**.
GitHub serves an organization root site (`https://tranrealestate.github.io/`) only from a
repository with that exact name.

Create it **empty**: do not add a README, licence or .gitignore. Any initial commit makes the first
push of `main` non-fast-forward.

If any other name is used, the site publishes under `https://tranrealestate.github.io/<repo>/`
and the deploy must build with `BASE_PATH=/<repo>` (set it on the `Build` step of the `root`
matrix leg in `ci.yml`). The `sub` leg of the CI matrix already proves that a non-root base path
builds, routes, and passes every check, so this is a supported configuration, not a workaround.

## Step 3: Set the Pages source to GitHub Actions

Settings, then Pages, then Build and deployment: set **Source** to **GitHub Actions**.

Do this before Step 6. It creates the `github-pages` environment; without it the `deploy` job's
`deploy-pages` step fails with HTTP 404 on create deployment.

## Step 4: Turn on Dependabot alerts and security updates

Settings, then Code security: enable Dependabot alerts and Dependabot security updates. `pnpm audit`
in CI remains the authoritative gate.

## Step 5: Enable secret scanning and push protection

Settings, then Code security: enable **Secret scanning** and, under it, **Push protection**.
Push protection rejects a push that contains a supported secret format before it reaches the
repository. It complements, and does not replace, the local gitleaks pre-commit hook and the CI
history scan.

Turn this on before the first push in Step 6, so the first push is already scanned.

## Step 6: Push `main` with `PAGES_ENABLED` unset, wait for green CI, then go live

1. With `PAGES_ENABLED` **not** set, add the remote and push from a local clone:

   ```sh
   git remote add origin https://github.com/tranrealestate/tranrealestate.github.io.git
   git push -u origin main
   git push origin v1.0   # optional: publish the v1.0 tag
   ```

   This is explicitly an owner action. Automated execution in this repository never adds a remote
   and never pushes; `git remote -v` printing nothing is part of the Phase 1 verification.

2. Wait for the first `ci` run on `main` to go green, with the `deploy` job skipped. If it fails,
   fix it before going live.
3. Settings, then Secrets and variables, then Actions, then the **Variables** tab: add a repository
   variable named `PAGES_ENABLED` with the value `true`.

   This is the switch that un-gates the deploy. Both the `Upload Pages artifact` step and the
   `deploy` job carry `vars.PAGES_ENABLED == 'true'` in their `if` condition, alongside the
   `push` to `main` condition and `needs: [hygiene, quality]`. A failing typecheck, lint, unit,
   build, CSP, end-to-end, accessibility, secret-scan, or real-data check therefore still blocks
   the deploy after the variable exists.

   Setting the variable alone deploys nothing: the deploy runs only on a push to `main`
   (`workflow_dispatch` is excluded from the gate). Push an empty commit to trigger it:

   ```sh
   git commit --allow-empty -m "chore: go live"
   git push
   ```

## Step 7: Verify the live origin

These checks are deferred human verification, recorded here as evidence to collect once the
site is live. They are not gaps: every behaviour below is already proven locally and in CI
against a GitHub Pages emulator under both base paths.

**Fresh-profile rule:** run every check below, after every redeploy, in a new InPrivate (Edge)
or Incognito (Chrome) window or a fresh browser profile, never in a profile that has visited the
site before. The service worker is cache-first and never skips waiting, so a used profile keeps
serving the previous build's HTML and CSP.

1. In a fresh InPrivate window, load `https://tranrealestate.github.io/`. Expect the landing
   page.
2. In a fresh InPrivate window, navigate to `/renter/` and refresh the browser. Expect the page,
   not a 404.
3. In a fresh InPrivate window, visit `https://tranrealestate.github.io/renter` (no trailing
   slash). Expect a redirect to `/renter/`.
4. In a fresh InPrivate window, visit a bogus path such as
   `https://tranrealestate.github.io/does-not-exist/`. Expect the branded not-found page.
5. In a fresh InPrivate window, view the source of any page. Expect the `Content-Security-Policy`
   meta tag immediately after `<meta charset>`, with no `unsafe-inline` or `unsafe-eval` in
   `script-src`.
6. Open the Actions tab and confirm the `deploy` job ran for the push to `main`. Download the
   `github-pages` artifact for that run and confirm `.nojekyll` is present at its root (the
   upload step passes `include-hidden-files: true` for exactly this file).
7. Prove push protection on a throwaway branch, then delete the branch:

   ```sh
   git switch -c push-protection-probe
   # Add a file containing a secret format that GitHub push protection recognises. The most
   # reliable choice is a GitHub fine-grained personal access token that you generate with no
   # permissions and a one-day expiry, and revoke immediately after this test.
   SKIP_SIMPLE_GIT_HOOKS=1 git commit -am "probe push protection"
   git push -u origin push-protection-probe   # expect: rejected by push protection
   git switch main
   git branch -D push-protection-probe
   ```

   Two rules for this step. First, the local commit needs `SKIP_SIMPLE_GIT_HOOKS=1` because the
   gitleaks pre-commit hook would otherwise block the probe commit itself, which proves the
   local gate but says nothing about GitHub. Second, do **not** use the repository's
   `TRANCANARY_` pattern here: push protection recognises only GitHub and partner secret formats,
   so the canary would be accepted and prove nothing. Never merge or keep the probe branch, and
   never use a live credential.

## Step 8: Launch services (Phase 10)

Each service below is optional and switched on by a repository variable. Nothing here blocks
local work: with no variables set, the site builds, tests and deploys with usage counting off, the
waitlist and feedback forms in their "isn't open yet" state, and no contact address. Add variables
in the repository under Settings → Secrets and variables → Actions → **Variables** (not Secrets:
every value here ends up in the public page source by design). Only the root deploy build reads
them; the sub-path and test builds ignore them.

**Fresh-profile rule:** run every check below, after every redeploy, in a new InPrivate (Edge)
or Incognito (Chrome) window or a fresh browser profile, never in a profile that has visited the
site before. The service worker is cache-first and never skips waiting, so a used profile keeps
serving the previous build's HTML and CSP.

1. **Umami usage counts (analytics, optional).**
   1. Create a free Umami Cloud account (or self-host Umami) and add the website
      `tranrealestate.github.io`.
   2. Copy the website ID (a UUID) from the site's tracking code in the Umami dashboard. The
      collect host is `https://gateway.umami.is` (the official tracker script posts there). Set
      `PUBLIC_ANALYTICS_HOST=https://gateway.umami.is`.
   3. In Umami's settings, confirm that IP addresses are not stored. Record the answer in
      `.planning/phases/10-launch-hardening-go-to-market/10-HUMAN-UAT.md` (`docs/LAUNCH-AUDIT.md`
      is generated; never edit it by hand). The privacy page tells visitors the counter
      receives their IP address like any web request, so do not turn counting on until this is
      confirmed.
   4. Add the variables `PUBLIC_ANALYTICS_HOST` (the https origin, no path) and
      `PUBLIC_ANALYTICS_WEBSITE_ID`. Set both or neither: the build fails on a half pair. The
      host is added to the Content-Security-Policy `connect-src` automatically, and
      `pnpm csp:assert` checks it.

      Before deploying, prove the host and the id together with the real website id:

      ```sh
      curl -i -X POST https://gateway.umami.is/api/send \
        -H 'content-type: application/json' \
        --data '{"type":"event","payload":{"website":"<your website id>","hostname":"tranrealestate.github.io","url":"/"}}'
      ```

      Expect `200` with a JSON body. `404 {"error":"Website not found"}` means the host OR the
      website id is wrong (both hosts answer 404 for an unknown id). The probe itself counts one
      pageview.

   5. Deploy. The privacy page now shows the "Usage counts" text that lists what each page view
      sends, and names the counter host.
   6. From the live origin in a fresh InPrivate window, in a normal browser with Global Privacy
      Control (GPC) and Do Not Track off, open two different pages. Confirm two pageviews in the
      Umami dashboard.
   7. From the live origin in a fresh InPrivate window, repeat in a browser with GPC on (Brave, or
      the Firefox setting "Tell websites not to sell or share my data"). Confirm that no new
      pageviews arrive.
   8. **Apply the cut line** if no pageviews arrive from the deployed origin: remove both
      variables and redeploy. The beacon becomes a no-op and the privacy page switches back to "Tran doesn't
      count visits right now". Then move GTM-04 to v2 in `.planning/REQUIREMENTS.md` and record
      the decision in `.planning/PROJECT.md` under Key Decisions.
   9. Read the counts as a lower bound: ad and tracker blockers may block analytics hosts.
2. **Web3Forms (waitlist and feedback forms).**
   1. Create a free Web3Forms access key with the owner's inbox as the destination.
   2. Keep captcha OFF in the Web3Forms dashboard. The site's CSP cannot load captcha scripts;
      Tran uses a hidden trap field and a 3-second check instead.
   3. Add the variable `PUBLIC_WEB3FORMS_KEY` (the access key is public by design).
   4. Deploy, then from the live origin submit one waitlist entry on `/for-renters/` and one
      message on `/feedback/`. Confirm both emails arrive, with the subjects "Tran waitlist:
      Renter" and "Tran feedback: …" (the topic you picked).
3. **Contact email (optional).** Add `PUBLIC_CONTACT_EMAIL` to turn on the mailto fallbacks on the
   forms. Leave it unset and the forms show "check back later" text instead of an address.
4. **Search Console.** Use the HTML-tag method only (the HTML-file method adds a page the CSP
   oracle rejects; DNS needs a custom domain). In Search Console add the URL-prefix property
   `https://tranrealestate.github.io/`, choose **HTML tag**, copy the
   `<meta name="google-site-verification" content="..." />` tag, and paste it in
   `apps/web/src/app.html` on the line directly after the `<!-- search-console: ... -->` marker,
   which sits directly after `%sveltekit.head%` (so the CSP meta stays first). The token is public.
   Run `pnpm vitest run --project scripts scripts/app-html.test.ts`, commit, push, wait for the
   deploy, then press Verify and submit `https://tranrealestate.github.io/sitemap.xml`; confirm it
   is read with 14 URLs.
5. **Share cards.** Paste `https://tranrealestate.github.io/tools/cap-rate/` into a link-preview
   debugger (LinkedIn Post Inspector or the Facebook Sharing Debugger). Confirm the card image and
   title.
6. **Dependabot.** Done in Step 4 (kept here so the item numbers below stay stable).
7. **Record the results** in `.planning/phases/10-launch-hardening-go-to-market/10-HUMAN-UAT.md`
   (`docs/LAUNCH-AUDIT.md` is generated by `pnpm audit:launch`; never edit it by hand), including the Umami
   IP-storage answer and the analytics cut-line decision (kept or cut).

## Step 9: Browser extension release (Phase 11)

The Sponsored Listing Filter extension builds, tests and passes its zero-network oracle locally
and in CI without any of these steps (`pnpm ext:build && pnpm ext:assert`). The release workflow
`.github/workflows/extension-release.yml` stays dormant until the variable in step 4 exists. Do
these in order, once. Record each result in
`.planning/phases/11-zillow-sponsored-listing-filter-extension/11-HUMAN-UAT.md`.

1. **Read the current Zillow Terms of Use** in a browser (automated fetch is refused). Record the
   "Updated" date and the section 5 Prohibited Use wording in 11-HUMAN-UAT item 4, and decide
   go or no-go before any public release. This gates the store listing and the GitHub Release,
   not the build.
2. **Confirm the privacy URL is live:**
   `https://tranrealestate.github.io/legal/privacy/#browser-extension` (needs Steps 1-7). The
   popup links to it and the store listing asks for it.
3. **Microsoft Edge Add-ons.** Create a free Partner Center developer account. Submit the
   `sponsored-listing-filter-<version>-chrome.zip` produced by `pnpm ext:build` (or the
   GitHub Release zip), with the copy in `apps/extension/store/edge-listing.md`, the logo
   `apps/extension/store/edge-logo-300.png`, screenshots at 640x480 or 1280x800 (the popup and a
   dimmed card), and the privacy URL from item 2. Certification takes up to 7 business days.
   Once the listing is live, replace the placeholder sentence under "Install from Microsoft
   Edge Add-ons" in `docs/EXTENSION-INSTALL.md` with the listing link.
4. **GitHub Releases.** After Step 6 (the remote exists), add the repository variable
   `EXTENSION_RELEASES_ENABLED` with the value `true` (Settings, then Secrets and variables,
   then Actions, then **Variables**). Then push a tag that matches
   `apps/extension/package.json` `version`:

   ```sh
   git tag ext-v0.1.0
   git push origin ext-v0.1.0
   ```

   Confirm the Release carries `sponsored-listing-filter-0.1.0-chrome.zip` and
   `SHA256SUMS.txt`, and that `sha256sum -c SHA256SUMS.txt` passes on the downloaded files.

Firefox Add-ons is not part of v1 (ROADMAP cut line 2).

## Later phases

- **Phase 4** adds the owner's endpoint-restricted RentCast key for billing verification. It is
  entered in the browser, never committed.
- **Phase 8** adds the owner's free Web3Forms access key for lead-delivery verification. Same
  rule: browser only, never committed.
- **Phase 10** services (analytics host, Web3Forms key, contact email) are switched on by
  repository variables, see Step 8. The analytics host reaches `connect-src` through the build
  and `pnpm csp:assert` checks it; no source edit is needed.
