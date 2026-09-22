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

## Step 2: Create the repository, named exactly `tranrealestate.github.io`

Inside the organization create a public repository **named exactly `tranrealestate.github.io`**.
GitHub serves an organization root site (`https://tranrealestate.github.io/`) only from a
repository with that exact name.

If any other name is used, the site publishes under `https://tranrealestate.github.io/<repo>/`
and the deploy must build with `BASE_PATH=/<repo>` (set it on the `Build` step of the `root`
matrix leg in `ci.yml`). The `sub` leg of the CI matrix already proves that a non-root base path
builds, routes, and passes every check, so this is a supported configuration, not a workaround.

## Step 3: Add the remote and push `main`

From a local clone:

```sh
git remote add origin https://github.com/tranrealestate/tranrealestate.github.io.git
git push -u origin main
```

This is explicitly an owner action. Automated execution in this repository never adds a remote
and never pushes; `git remote -v` printing nothing is part of the Phase 1 verification.

## Step 4: Set the Pages source

Settings, then Pages, then Build and deployment: set **Source** to **GitHub Actions**.

## Step 5: Enable secret scanning and push protection

Settings, then Code security: enable **Secret scanning** and, under it, **Push protection**.
Push protection rejects a push that contains a supported secret format before it reaches the
repository. It complements, and does not replace, the local gitleaks pre-commit hook and the CI
history scan.

## Step 6: Set the `PAGES_ENABLED` variable

Settings, then Secrets and variables, then Actions, then the **Variables** tab: add a repository
variable named `PAGES_ENABLED` with the value `true`.

This is the switch that un-gates the deploy. Both the `Upload Pages artifact` step and the
`deploy` job carry `vars.PAGES_ENABLED == 'true'` in their `if` condition, alongside the
`push` to `main` condition and `needs: [hygiene, quality]`. A failing typecheck, lint, unit,
build, CSP, end-to-end, accessibility, secret-scan, or real-data check therefore still blocks
the deploy after the variable exists.

## Step 7: Verify the live origin

These checks are deferred human verification, recorded here as evidence to collect once the
site is live. They are not gaps: every behaviour below is already proven locally and in CI
against a GitHub Pages emulator under both base paths.

1. Load `https://tranrealestate.github.io/`. Expect the landing page.
2. Navigate to `/renter/` and refresh the browser. Expect the page, not a 404.
3. Visit `https://tranrealestate.github.io/renter` (no trailing slash). Expect a redirect to
   `/renter/`.
4. Visit a bogus path such as `https://tranrealestate.github.io/does-not-exist/`. Expect the
   branded not-found page.
5. View the source of any page. Expect the `Content-Security-Policy` meta tag immediately after
   `<meta charset>`, with no `unsafe-inline` or `unsafe-eval` in `script-src`.
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

## Later phases

- **Phase 4** adds the owner's endpoint-restricted RentCast key for billing verification. It is
  entered in the browser, never committed.
- **Phase 8** adds the owner's free Web3Forms access key for lead-delivery verification. Same
  rule: browser only, never committed.
- **Phase 10** adds the first-party analytics beacon host to `connect-src`. That host must be
  added to `apps/web/svelte.config.js` and to the allowlist in `scripts/assert-csp.mjs` in the
  same commit, because `pnpm csp:assert` fails the build when the two disagree.
