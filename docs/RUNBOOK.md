# Runbook: Tran Real Estate Tools on GitHub Pages

The site is `https://wolfwdavid.github.io/tran_real_estate/`, a project site served from the
`wolfwdavid/tran_real_estate` repository. Every push to `main` runs the `ci` workflow; its `deploy`
job publishes the root build to Pages, and the `live-smoke` workflow then checks the deployed commit
read-only. This document is how the owner operates that loop: redeploy, roll back, read a smoke
result, run the suites, and keep the repository variables and dependency policy straight.

Each section is self-contained. Commands are for Git Bash on the development machine with the
`gh` CLI signed in as the repository owner.

## Variables

Repository variables (Settings > Secrets and variables > Actions > Variables). None is a secret;
all are public once deployed. Set them from Git Bash with
`MSYS_NO_PATHCONV=1 gh variable set <NAME> --repo wolfwdavid/tran_real_estate --body "<value>"`;
the `MSYS_NO_PATHCONV=1` prefix stops Git Bash from rewriting a value that starts with `/`
(`BASE_PATH`) into a Windows path.

| Variable                      | Example value                  | Read by                                                                                                                       |
| ----------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `PAGES_ENABLED`               | `true`                         | `ci` deploy gate (Upload Pages artifact step and the `deploy` job); `live-smoke` job gate. Unset or anything but `true` = off |
| `PUBLIC_SITE_URL`             | `https://wolfwdavid.github.io` | Origin only, no path. Every `ci` leg's env (root, sub, configured); `live-smoke`; `extension-release`                         |
| `BASE_PATH`                   | `/tran_real_estate`            | `ci` root leg only (the deploy build); `live-smoke`; `extension-release`                                                      |
| `PUBLIC_ANALYTICS_HOST`       | `https://gateway.umami.is`     | `ci` root leg; `live-smoke` (the smoke's beacon budget). Empty = analytics off                                                |
| `PUBLIC_ANALYTICS_WEBSITE_ID` | `<Umami website id>`           | `ci` root leg only                                                                                                            |
| `PUBLIC_WEB3FORMS_KEY`        | `<Web3Forms access key>`       | `ci` root leg only                                                                                                            |
| `PUBLIC_CONTACT_EMAIL`        | `<contact address>`            | `ci` root leg only                                                                                                            |
| `EXTENSION_RELEASES_ENABLED`  | `true`                         | `extension-release` only                                                                                                      |

The sub-path and configured legs of `ci` ignore the owner values on purpose: they test the build
shape, not the owner's accounts. Changing a variable deploys nothing by itself; redeploy afterwards.

## Redeploy

A redeploy is an empty commit pushed to `main`:

```bash
git switch main && git pull --ff-only
git commit --allow-empty -m "chore: redeploy"
git push
```

Then watch the three runs for that commit (`ci`, its `deploy` job, then `live-smoke`):

```bash
gh run list --repo wolfwdavid/tran_real_estate --workflow ci.yml --limit 5
gh run list --repo wolfwdavid/tran_real_estate --workflow live-smoke.yml --limit 5
```

A `workflow_dispatch` of `ci` (the "Run workflow" button) deploys nothing: the deploy gate requires
a push event on `main` with `PAGES_ENABLED=true`. Use the empty commit.

## Roll back

Preferred: revert the bad commit and push. The revert goes through the full `ci` run, so the
rollback is tested like any other deploy.

```bash
git revert <bad-sha>
git push
```

Then watch `ci`, its `deploy` job and `live-smoke` on the revert commit, exactly as for a
redeploy.

Alternative, when `main` cannot be changed right away: Actions > the previous green `ci` run >
**Re-run all jobs**. This rebuilds the same commit and ref (about 27 minutes) and is possible up
to 30 days after the run. Re-running only the `deploy` job works only within 1 day of that run,
because `actions/upload-pages-artifact@v5.0.0` keeps the `github-pages` artifact for
`retention-days: 1`; after that the deploy job has nothing to publish and the full re-run is the
only option. Re-runs use the original actor's privileges. A completed re-run of `ci` also triggers
`live-smoke` with the old `head_sha`; verify that on the first drill.

## Read a live-smoke result

`live-smoke` runs after every completed `ci` run on `main`. Find the run for a commit:

```bash
gh run list --repo wolfwdavid/tran_real_estate --workflow live-smoke.yml --limit 5
gh run view <run-id> --repo wolfwdavid/tran_real_estate --log-failed
```

The run page summary carries the Playwright `github` reporter annotations (one per failed test).
On failure the run uploads the artifact `live-smoke-traces` (kept 14 days):

```bash
gh run download <run-id> --repo wolfwdavid/tran_real_estate --name live-smoke-traces
pnpm --filter web exec playwright show-trace <trace.zip>
```

Exit codes of `scripts/smoke.mjs` (the step's exit code is the job's):

| Code | Meaning                                                                                                                                        |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 0    | ok                                                                                                                                             |
| 1    | suite failed: a read-only contract broke on the deployed site; open the traces                                                                 |
| 2    | precondition: the env gate rejected the run (URL, SHA or analytics host malformed, or a variable unset); fix the variables, redeploy           |
| 3    | version not propagated: `_app/version.json` never reported the deployed SHA within 10 minutes; the deploy failed or the CDN did not pick it up |
| 4    | over the 5-minute budget (local three-target mode only; the remote run has no budget)                                                          |

A skipped run means Pages is off (`PAGES_ENABLED` is not `true`) or the `ci` run it followed was
not a green push to `main`; nothing was deployed, so there was nothing to smoke.

Dispatch a smoke by hand (it targets the live origin and still requires `PAGES_ENABLED=true`):

```bash
gh workflow run live-smoke.yml --repo wolfwdavid/tran_real_estate -f base_url=https://wolfwdavid.github.io/tran_real_estate/
```

CDN note: the Pages CDN ignores the `?_=` cache-busting query, so the smoke's 10-minute poll relies
on GitHub purging the CDN on deploy. Never raise the poll or add retries; measure instead. Each
green run logs `smoke: <sha> live at <url> after <n> s`, and those seconds are the fact to record.

## Run the suites locally

Known-good worker counts. The development machine has 16 logical CPUs; CI runs on `ubuntu-24.04`
with 4 vCPUs.

| Suite         | Command                                                             | Workers and retries                                                                                                                                                                                                                                |
| ------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vitest        | `pnpm test:unit`                                                    | Root `vitest.config.ts` projects (web, core, brand, scripts, web-browser, extension); no worker pin. CI: 349 files in 117-121 s. Run it alone on the dev machine: a precommit test once failed under four parallel runs                            |
| Web E2E       | `pnpm --filter web exec playwright test --project=root --workers=4` | `apps/web/playwright.config.ts` sets no `workers`, so Playwright defaults to half the logical CPUs: 2 workers in CI ("using 2 workers" in every leg's log). Dev machine: `--workers=4` (8 gave six 30 s timeouts on 10-23). Retries: CI 1, local 0 |
| Smoke         | `pnpm smoke:local`                                                  | `apps/web/playwright.smoke.config.ts`: `workers: process.env.CI ? 2 : 4`, retries 0, `failOnFlakyTests`, `globalTimeout` 300 s                                                                                                                     |
| Extension E2E | `pnpm ext:e2e`                                                      | `apps/extension/playwright.config.ts`: `workers: 1`, timeout 60 s, CI retries 1                                                                                                                                                                    |
| Everything    | `pnpm verify`                                                       | The full local gate (check, lint, unit, the three builds, oracles, E2E, smoke, audits, extension)                                                                                                                                                  |

To build and test the deploy shape (root build under the base path) set the knob first, in Git
Bash with path conversion off:

```bash
MSYS_NO_PATHCONV=1 BASE_PATH=/tran_real_estate pnpm build:root
MSYS_NO_PATHCONV=1 BASE_PATH=/tran_real_estate pnpm --filter web exec playwright test --project=root --workers=4
MSYS_NO_PATHCONV=1 BASE_PATH=/tran_real_estate pnpm smoke:local --target root
```

## Fresh-profile rule

Check the live site in a new InPrivate (Edge) or Incognito (Chrome) window after every redeploy,
never in a profile that has visited the site before. Two caches stand in the way of an ordinary
window: Pages sends `Cache-Control: max-age=600` on HTML, and the service worker is cache-first and
never skips waiting, so a used profile keeps serving the previous build's HTML and CSP for a while.

## Dependabot policy

`.github/dependabot.yml` ignores semver-major updates of exactly these packages until Phase 16
(pnpm 12 -> Vitest 5 -> SvelteKit 3): `@sveltejs/kit`, `@sveltejs/adapter-static`, `vitest`,
`@vitest/*`, `vitest-browser-svelte`, `pnpm` and `@types/node`. The `@types/node` entry is owner
decision B (Phase 13), re-evaluated in Phase 14/16. If a major PR for one of these is open from
before the ignore list landed, close it by hand with a comment naming Phase 16.

Weekly minor/patch updates arrive as one grouped PR. Review it through the `pnpm audit` gate and a
green `ci` run; it is never merged blind. A `github-actions` PR (an action pin bump) is merged only
when its own CI is green: the workflow gate tests compare the pins across all workflows, so a bump
that lands in one workflow and not another turns red by design and the PR needs a hand edit.

## Analytics: synthetic pageviews

Every smoke spec runs with Global Privacy Control on, except one: the GPC-off analytics spec sends
at most one synthetic `/` pageview per smoke run, from the smoke's Chromium (Umami may drop it as a
bot). Read dashboard counts as a lower bound, and expect up to one extra `/` view per deploy.

## Launch proof screenshots

The launch-proof bundle is generated, not hand-captured. From the deployed site:

```bash
pnpm --filter web exec node tests/smoke/proof-shots.mjs --base-url https://wolfwdavid.github.io/tran_real_estate/ --out ../../docs/launch-proof/<YYYY-MM-DD>
```

It writes five viewport screenshots (landing, renter, deep-route refresh, 404, `version.json`) and
`checks.json` with the HTTP facts (status codes, redirect `Location` headers, the deployed SHA).
The script sends `Sec-GPC: 1` and sets the navigator flag, so proof shots never count as pageviews.
It exits non-zero if a fact misses its expected value or the bundle exceeds 5 MB.

Dashboard screenshots (Actions, Pages settings, Umami) are the one hand-captured part: redact e-mail
addresses and account details from them before committing, and keep the whole bundle under 5 MB.

## First deploy facts

Recorded at go-live (plan 13-19).
