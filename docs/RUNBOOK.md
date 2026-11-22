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

A multi-commit migration (the SvelteKit 3 push spans plans 16-05 to 16-10, about 30 commits) is
NOT undone by a single `git revert <bad-sha>`; that would leave the site half migrated. Record the
first and last commit of the migration (for Kit: KIT_FIRST_SHA from `16-05-SUMMARY.md` and the HEAD
that was pushed, recorded in `16-10-SUMMARY.md`) and revert the whole range:

```bash
git revert --no-commit <first-sha>^..<last-sha>
git restore --source=HEAD --staged --worktree -- .planning   # only if the range holds phase-summary commits
pnpm install --frozen-lockfile
pnpm verify
git commit -m "revert: roll back <migration name>"
```

Push only with the owner's approval, then watch `ci` and `live-smoke` as above.

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

| Code | Meaning                                                                                                                                                                                                                           |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0    | ok                                                                                                                                                                                                                                |
| 1    | suite failed: a read-only contract broke on the deployed site; open the traces                                                                                                                                                    |
| 2    | precondition: the env gate rejected the run (URL, SHA or analytics host malformed, or a variable unset); fix the variables, redeploy. Also a 429 on any smoke request (Pages CDN rate-limited): re-dispatch once, never in a loop |
| 3    | version not propagated: `_app/version.json` never reported the deployed SHA within 10 minutes; the deploy failed or the CDN did not pick it up                                                                                    |
| 4    | over the 5-minute budget (local three-target mode only; the remote run has no budget)                                                                                                                                             |

Exit 2 for a 429 covers every request the suite makes: a page navigation, a sub-resource of a page,
the service worker install and an API-context request (the seo, csp, version and routing specs and
the manifest read). A failed suite with any logged 429 exits 2, not 1. A passing suite is never
relabelled.

Superseded: a run can also exit 0 without running the suite. When two pushes land close together,
the origin may already serve the second commit when the first commit's chained run starts. If the
served commit is ahead of the expected one (GitHub's compare API answers `ahead`), the run ends
green with a `::notice::smoke: <sha> superseded by <sha>` line and no test counts, because the
newer commit's own chained run judges the site.

- It is only possible for chained runs (the run event is `workflow_run`, with the repository and
  the read-only token present). A `workflow_dispatch` run or a local run is never superseded and
  keeps the red path.
- Every other state fails closed: a served commit that is behind, diverged or identical, a compare
  lookup that fails (non-200, not JSON, network error, 401 or 403), or a version that is not a
  40-character SHA stays red (exit 3 from the poll, exit 1 or 2 after a failed suite). A compare
  failure never produces this outcome.
- A superseded run is not evidence that the suite passed. Read the newer commit's run, and never
  count a superseded run toward the three-run proof.

A skipped run means Pages is off (`PAGES_ENABLED` is not `true`) or the `ci` run it followed was
not a green push to `main`; nothing was deployed, so there was nothing to smoke.

Dispatch a smoke by hand (it targets the live origin and still requires `PAGES_ENABLED=true`):

```bash
gh workflow run live-smoke.yml --repo wolfwdavid/tran_real_estate -f base_url=https://wolfwdavid.github.io/tran_real_estate/
```

CDN note: the Pages CDN ignores the `?_=` cache-busting query, so the smoke's 10-minute poll relies
on GitHub purging the CDN on deploy. Never raise the poll or add retries; measure instead. Each
green run logs `smoke: <sha> live at <url> after <n> s`, and those seconds are the fact to record.

### Live smoke request volume

GitHub Pages rate-limits by request volume and publishes no rate-limit figure. The first 429 was
observed after roughly 3.7k to 4k requests, and the threshold varied between runs, so the suite is
kept well below that. The live suite stays under 1600 requests per run.

Requests per run on the root build, measured at build `2aeff6b72877f89c35444e4e31a6335ab8e924a5`
(the before column at `8f4541ced2fd2e473d19b0f88e38a43352a20b08`, the suite as it was before the
cut):

| Spec           | Before    | After     | Live sample note                                                                   |
| -------------- | --------- | --------- | ---------------------------------------------------------------------------------- |
| third-party    | 3,337     | 576       | 9 page loads live (one per route group); 44 loads and 3,337 requests locally       |
| pwa            | 841       | 421       | one shared service worker install; hashed-asset statuses read from the cache       |
| assets         | 742       | 0         | spec removed; its check moved into pwa                                             |
| seo            | 504       | 19        | share tags read from prerendered HTML, no page loads                               |
| routing        | 225       | 225       | unchanged; varies by a few requests between runs                                   |
| a11y           | 177       | 177       | unchanged                                                                          |
| csp            | 45        | 45        | unchanged                                                                          |
| analytics      | 38        | 38        | unchanged                                                                          |
| extension-link | 33        | 33        | unchanged                                                                          |
| version        | 1         | 1         | unchanged                                                                          |
| **Total**      | **5,939** | **1,535** | before is the full-suite run (the rows sum to 5,943); after is the live projection |

- **The live figure is a projection.** 1,535 is arithmetic over local emulator measurements until
  the first live run confirms it. A live run lists 84 tests; the local run keeps every route, with
  119 tests in 9 spec files and 4,294 requests on the root target.
- **How it was measured.** The Pages emulator (`scripts/serve-pages.mjs`) counts GET and HEAD
  requests when the environment variable `SERVE_PAGES_COUNT_FILE` names a file. Run
  `pnpm smoke:local --target root -- tests/smoke/<spec>.smoke.ts` once per spec and subtract the
  orchestrator's one `version.json` poll. Give the file as a Windows-style absolute path
  (`$(pwd -W)/...` in Git Bash). An empty or missing count file is a failed measurement to redo,
  never zero.
- **The three levers.** A 9-route third-party sample live (one per route group) and 44 locally;
  one shared service worker install; share tags read from HTML.
- **A fourth lever** is `workers: 1` in the smoke config, only if a 429 still appears.
- **Changing the ceiling** means re-measuring, then updating this table and `LIVE_REQUEST_CEILING`
  in `scripts/smoke.mjs` together; `scripts/runbook.test.ts` compares the two.

#### Proof runs (SMOKE-07)

A run counts as proof only if its event is `workflow_run`, its head SHA equals the pushed SHA, it
concluded success with zero failed tests and no 429, and retries is 0.

## Run the suites locally

Known-good worker counts. The development machine has 16 logical CPUs; CI runs on `ubuntu-24.04`
with 4 vCPUs.

| Suite         | Command                                                             | Workers and retries                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vitest        | `pnpm test:unit`                                                    | Root `vitest.config.ts`. Parallel lane: web, core, brand, scripts, web-browser, extension. Then the serial lane: core-serial, web-serial, web-browser-serial, scripts-serial, one file at a time (`tooling/vitest/lanes.ts` lists each file and why). `maxWorkers`: `MAX_WORKERS = process.env.CI ? 3 : 8` (CI 93.7-108.2 s; dev 124.3 s, 2026-11-09). Setting VITEST_MAX_WORKERS fails the run on purpose (it would disable the serial lane). `--project scripts` does not select `scripts-serial`; name both |
| Web E2E       | `pnpm --filter web exec playwright test --project=root --workers=4` | `apps/web/playwright.config.ts`: `workers: process.env.CI ? 2 : 4` (CI log: "using 2 workers"; dev 4, since 8 gave six 30 s timeouts on 10-23). Retries: CI 1, local 0, with `failOnFlakyTests` in CI and `--fail-on-flaky-tests` in `ci.yml`: a test that passes only on retry fails the job                                                                                                                                                                                                                  |
| Smoke         | `pnpm smoke:local`                                                  | `apps/web/playwright.smoke.config.ts`: `workers: process.env.CI ? 2 : 4`, retries 0, `failOnFlakyTests`, `globalTimeout` 300 s                                                                                                                                                                                                                                                                                                                                                                                 |
| Extension E2E | `pnpm ext:e2e`                                                      | `apps/extension/playwright.config.ts`: `workers: 1`, timeout 60 s, CI retries 1, `failOnFlakyTests` in CI                                                                                                                                                                                                                                                                                                                                                                                                      |
| Everything    | `pnpm verify`                                                       | The full local gate (check, lint, unit, the three builds, oracles, E2E, smoke, audits, extension)                                                                                                                                                                                                                                                                                                                                                                                                              |

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

`.github/dependabot.yml` ignores semver-major updates of exactly these packages until Phase 16 finishes:
`pnpm` and `@types/node`. The `@sveltejs/kit`, `@sveltejs/adapter-static`, `vitest`, `@vitest/*` and
`vitest-browser-svelte` majors were released after Kit 3 and Vitest 5 landed. The `@types/node` entry is owner
decision B (Phase 13), re-evaluated in Phase 14/16. If a major PR for one of these is open from
before the ignore list landed, close it by hand with a comment naming Phase 16.

Weekly minor/patch updates arrive as one grouped PR. Review it through the `pnpm audit` gate and a
green `ci` run; it is never merged blind. `pnpm-lock.yaml` has two YAML documents since pnpm 12
(a boot document, then the project document); Dependabot's handling of that shape was fixed
upstream on 2026-11-03, and the dependency graph under Insights is checked after each lockfile
change. A `github-actions` PR (an action pin bump) is merged only
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

## Release the extension

The `extension-release` workflow needs the extension variable set to true and the release commit on
`main`. It never publishes: a tag push creates a draft and a manual run creates nothing.

1. Dry run: `gh workflow run extension-release.yml --ref main`, then `gh run watch`. It builds,
   asserts, probes and checksums; `gh release list` must show no new release.
2. Read the job summary: zip name, size, entry count and the `SHA256SUMS.txt` lines.
3. Tag `ext-v<version>` (equal to `apps/extension/package.json`) and push the tag. The workflow
   creates a draft release with the zip, `SHA256SUMS.txt` and the CHANGELOG notes.
4. Verify the draft: `gh release download ext-v0.1.0 --repo wolfwdavid/tran_real_estate --dir <empty folder>`,
   then `sha256sum -c SHA256SUMS.txt` in that folder (PowerShell:
   `Get-FileHash -Algorithm SHA256 <zip>` and compare with the file).
5. Publish, owner only: `gh release edit ext-v0.1.0 --draft=false`.

Failures are fail-closed and each stops the job before anything is uploaded:

- "not an ancestor of origin/main": push `main` first, then tag.
- "versions disagree": the tag, package version, built manifest and zip name differ; fix the tag or
  rebuild.
- "zip entry not on allowlist": a stray file is in the extension output.
- "privacy probe failed": the live site is down or the `BASE_PATH` variable is unset; re-run once.

A bad draft is deleted by the owner with `gh release delete ext-v0.1.0`. A tag that is already
pushed is removed only with the owner's explicit approval.

## First deploy facts

Measured at the Phase 13 go-live and the two deploys that followed (plans 13-13, 13-15, 13-17;
recorded 2026-10-31 by plan 13-19). Proof bundle and run links: `docs/launch-proof/2026-10-30/README.md`.

- **Go-live.** `PAGES_ENABLED=true` set 2026-10-30T18:55:45Z; empty commit `ad5fd08` (`chore: go
live`) pushed 18:55:47Z; `ci` run 41111039721 `deploy` job success at 19:24:26Z with
  `Evaluated environment url: https://wolfwdavid.github.io/tran_real_estate/`. The first deploy on
  which `ci`, `deploy` and `live-smoke` were all green is `f070c74` (ci 41147247922, live-smoke
  41149881068, 2026-10-31T00:24Z). Deployed commit when this was written: `f169749` (ci
  41200919587, live-smoke 41202355014).
- **Propagation.** Every `live-smoke` found the new build on its first poll:
  `smoke: ad5fd08188c7cdd37cc5fcb2bc45c58c7f631684 live at https://wolfwdavid.github.io/tran_real_estate/ after 0 s`
  (run 41115004823), `after 0 s` again for `f070c74` (41149881068) and `f169749` (41202355014).
  The 10-minute poll was never needed; keep it as the ceiling, not the expectation.
- **Cache headers** (`curl -sI` on `/tran_real_estate/`): `Cache-Control: max-age=600`,
  `Server: GitHub.com`; right after a deploy `X-Cache: MISS`, `X-Cache-Hits: 0`, `Age: 0` (also
  seen 5 hours later on the landing page); the same path a minute later `X-Cache: HIT`,
  `X-Cache-Hits: 1`; `/for-renters/` on `f169749` `X-Cache: HIT`, `Age: 2`. Expect a cold-ish
  first visit after each deploy; that is what the precache measurement records.
- **Unknown path.** `curl -s -o /dev/null -w "%{http_code}" .../proof-not-found-13/` -> `404`.
  The body is the adapter-static SPA fallback shell (3,082 B, `text/html`, `<html lang="en" hidden>`,
  no `<title>`); the branded page (title `Page not found: Tran Real Estate Tools`, h1
  `404: Page not found`) renders client-side about 300 ms after load. The branded proof is
  therefore browser-side (`routing.smoke.ts`, `04-not-found.png`, the owner's fresh-profile
  check), never a grep of the body.
- **Redirects.** `http://wolfwdavid.github.io/tran_real_estate/` -> `301`
  `Location: https://wolfwdavid.github.io/tran_real_estate/`; `/tran_real_estate/renter` -> `301`
  `Location: https://wolfwdavid.github.io/tran_real_estate/renter/`. `/.nojekyll` -> `200`.
  `/_app/version.json` equalled the deploy SHA each time (`ad5fd08...`, `f070c74...`,
  `f169749...`).
- **`workflow_run` head_sha.** Equal to the deploy SHA on every `live-smoke` run
  (`gh api repos/wolfwdavid/tran_real_estate/actions/runs/<id> --jq .head_sha`), so
  `SMOKE_EXPECT_VERSION` matched the live `version.json` each time.
- **Service-worker precache.** 380 entries in one atomic `cache.addAll`: 5.27 s on the cold CDN at
  go-live, which failed Playwright's 5 s `expect.poll` default in the first live-smoke (exit 1,
  120 of 121 passed). Measured by the smoke's install log since `79f82bc`: 9,731 / 4,816 /
  2,368 ms on `f070c74`, 4,718 / 2,962 / 2,783 ms on `f169749`. The smoke waits 20 s
  (`installedPrecache` in `tests/smoke/fixtures.ts`); the version poll was not raised.
- **Durations.** `deploy` job 18 s (`ad5fd08`), 9 s (`f070c74`), 11 s (`f169749`); `live-smoke`
  job 1m25s (the red run), 1m12s (121 passed, Playwright 39.3 s), 1m29s (121 passed, 45.6 s);
  `ci` wall 28m39s, 28m08s, 19m20s. Go-live `ci` legs: hygiene 9 s, configured 6m07s, root 26m34s
  (Playwright 21.0m), sub 28m11s.
- **Rule confirmed.** A red live-smoke after a real deploy is fixed at the root, committed, and
  proven by a new push and a new observed `ci` + `deploy` + `live-smoke` trio; it is never re-run
  in place.
