# Phase 18: Live Smoke Stability - Research

**Researched:** 2026-11-21
**Domain:** Playwright smoke suite against GitHub Pages (Fastly/Varnish CDN), GitHub Actions workflow_run chain
**Confidence:** MEDIUM (request counts and the failure shape are measured from run logs; the CDN threshold itself is unpublished and varies between runs)

<user_constraints>
## User Constraints (from CONTEXT.md)

No 18-CONTEXT.md exists for this phase (no discuss-phase was run; owner choice 2026-11-21: fixes to existing code, no domain research flag). Constraints come from the orchestrator brief and CLAUDE.md:

### Locked Decisions
- No retries, no blind timeout raises, no `toPass` to make tests green; root causes only. A raised timeout needs a measured annotation (lane guard).
- The smoke suite is read-only against the live site: never submits a form, never calls RentCast or an LLM host.
- Never edit `scripts/assert-budget.mjs` in this phase.
- `pnpm smoke:local` against the emulator must keep full coverage.
- 429 must not be ignored (it stays exit 2 evidence); zero retries stays configured.
- No AI-assistant mentions in any file; never write text of the form NAME_KEY=value in docs (secret-scan hook).

### Planner's Discretion
- How to cut request volume (research options, recommend one).
- How to handle the superseded SHA (concurrency vs in-script exit path).
- Where and in what format to record request volume.

### Deferred Ideas (OUT OF SCOPE)
- Anything in Phases 19-21 (budget oracle, ci smoke-before-deploy, actionlint in CI, rollback drill).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SMOKE-07 | Live smoke finishes green without Pages CDN rate limiting: volume measured and kept under the observed limit (fewer or paced navigations), zero retries, proven by three consecutive pushes with green chained live-smoke runs | Sections "Measured request volume", "Recommended reduction", "Proof of three consecutive green runs" |
| SMOKE-08 | Two quick pushes do not produce a false-red live smoke (audit I3), pinned by a test on the workflow or smoke entry script | Sections "Superseded-SHA mechanism" and "Recommended handling" |
</phase_requirements>

## Summary

The 2026-11-21 failures are not caused by suite growth or Kit 3. The suite is the same 121 tests it was at the Phase 16-01 pre-flight (121 passed in 35.7 s at e04ba10), the precache is 381 entries now versus 380 at go-live, and three runs with identical volume and identical ~37 s duration gave one green (ae7f163, run 44812409812, 121 passed in 37.8 s) and two red (f91b91b, runs 44932727516 and 44959696791). The suite sits on a CDN threshold that moves between runs. 16-01 halved volume (10.8k to 5.3k requests, about 5.7k with the assets spec's own GETs) by blocking the service worker, and that bought margin, not safety. [VERIFIED: gh run logs 44812409812, 44932727516, 44959696791; 16-01-SUMMARY.md]

The 429s are time/volume-windowed per client, not per route. In both red runs everything that started after roughly 26 s into the run (test 95/96 of 121 in third-party.smoke.ts) failed with 429, including a plain `request.get` of `_app/version.json` (version.smoke.ts) and the last 25 navigations, for the remaining ~10 s. Before that point about 3.7 to 4.0k requests had been issued, most of them in the last ~15 s: three service worker installs of 381 entries each (about 1.14k, each a parallel `cache.addAll` burst), the assets spec's own ~370 GETs, 15 SEO page loads, and 19 third-party page loads at ~73 requests each. The pwa/assets/third-party block alone is about 84% of all requests. [VERIFIED: run 44932727516 log timeline; per-spec counts from 16-01-SUMMARY.md, third-party at 73 requests per load]

**Primary recommendation:** Cut live request volume about 70% (about 5.7k to about 1.3k to 1.8k) with fewer requests, not waits: (1) one service-worker install shared by pwa and assets, and assets checks statuses from the cache instead of re-GETting 370 files; (2) third-party.smoke.ts loads a 7-route sample live and all 44 routes locally; (3) seo share-tag checks read the prerendered HTML with `request.get` instead of full page loads. For SMOKE-08, add a "superseded" classification to `scripts/smoke.mjs` (served version is a different 40-hex SHA that GitHub's compare API reports as ahead of the expected SHA, checked during the version poll and again after a failed suite) that exits 0 with a `::notice::`, pinned by unit tests with injected `get`/compare functions, and keep `cancel-in-progress: false`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Request-volume budget of the suite | Test runner (Playwright specs + fixtures) | CDN (limit owner) | The suite decides how many requests it sends; the CDN is the unpublished constraint |
| 429 evidence and exit-code mapping | Orchestrator (`scripts/smoke.mjs`) | Fixture (`rateLimit429`) | Fixtures observe, the orchestrator classifies |
| Superseded-SHA decision | Orchestrator (`scripts/smoke.mjs`) | Workflow (env: token, repository) | Needs polling state plus a compare lookup; workflow YAML is text-pinned only |
| Serialisation of smokes | Workflow (`concurrency` group) | none | Already `live-smoke`, `cancel-in-progress: false` |
| Durable volume record | Docs (`docs/RUNBOOK.md` table plus a committed JSON) | Run log / step summary | Logs expire; a committed table is the durable fact |

## Measured Request Volume (question 1)

### Per-spec volume, from Phase 16-01 (sub target, after the SW block) plus the assets GETs

| Spec | Page loads / calls | Requests | Share |
|------|--------------------|----------|-------|
| third-party.smoke.ts | 44 loads | 3,216 (about 73 per load) | about 56% |
| pwa.smoke.ts | 2 installs (+1 manifest GET) | 824 (760 are `cache.addAll` fetches) | 14% |
| assets.smoke.ts | 1 install + about 370 `request.get` of hashed files | 412 + about 370 | about 14% |
| seo.smoke.ts | 15 loads + 4 GETs | 478 | 8% |
| routing.smoke.ts | 4 loads + 1 GET | 217 | 4% |
| a11y.smoke.ts | 3 loads | 163 | 3% |
| csp.smoke.ts | 45 `request.get` | about 45 | <1% |
| analytics, extension-link, version | 1 load, 1 load, 1 GET | about 60 | 1% |
| **Total** | | **about 5,339 plus about 370 = about 5,700** | |

[VERIFIED: 16-01-SUMMARY.md measurement table, `apps/web/tests/smoke/*.smoke.ts`]. Caveat: 16-01 counted browser-side `request` events; the assets spec's ~370 `request.get` calls are APIRequestContext calls and may not have been in that count (whether `context.on('request')` reports APIRequestContext traffic is [ASSUMED], see Open Questions). The measurement was taken on Kit 2; the Kit 3 numbers were not re-measured. Evidence that the shape did not change: precache 380 entries at go-live (13-13) and 381 in the failing runs. [VERIFIED: run logs show "precache: 381 entries"]

### Where 429 started (run 44932727516, f91b91b, 2 workers, run began 17:57:17Z)

- 17:57:28 CSP and extension-link done (~50 tests, almost no traffic).
- 17:57:28 to 17:57:34: three SW installs (381 entries each, 2.7 s / 8.5 s / 2.2 s) and the assets spec's ~370 GETs. About 1.5k requests in 6 s.
- 17:57:34 to 17:57:36.6: 15 SEO loads plus og:image GET (about 480).
- 17:57:37 to 17:57:43.3: third-party tests 77 to 94 (18 loads, about 1.3k requests).
- **17:57:43.48: first 429**, third-party test 96 (`/agent/`), about 26 s in and about 3.7k to 4.0k cumulative requests. Every later test failed: tests 96 to 121, including version.smoke.ts, which is a plain `request.get` (so the limiter is per client IP across all request types, not navigation-specific). The run ended at 17:57:53 (36.7 s), so the block lasted at least 10 s.
- Re-dispatch run 44959696791 (f91b91b, about 5 h later): identical shape; first failure test 95 (`/investor/`) at 23:02:57, 94 passed, 27 failed, 36.0 s.
- Green run 44812409812 (ae7f163, 2026-11-20): same 121 tests, same install log (6.8 / 2.6 / 3.0 s), third-party tests 96 to 121 passed, 121 passed in 37.8 s.

So the run that goes green and the runs that go red send the same traffic at the same speed. The threshold is not a fixed cumulative count: green runs have crossed 5.7k, red ones tripped at about 4.0k. It depends on the shared runner egress IP, POP and other tenants' load. [VERIFIED: three run logs; interpretation is the researcher's] Consequence for the plan: do not pace to a guessed threshold; reduce volume well below the lowest tripping point.

### What the suite already has (16-01)

- `classifySuiteExit(status, rateLimitedCount)` and `countRateLimited` in `scripts/smoke.mjs`: a failed suite with any 429 navigation is exit 2 ("CDN rate-limited, re-dispatch once"). [VERIFIED: scripts/smoke.mjs]
- `rateLimit429` auto fixture in `fixtures.ts` appending the URL of every 429 *navigation* response to `SMOKE_429_LOG`. [VERIFIED]
- `serviceWorkers: 'block'` as default; only pwa and assets opt in with `serviceWorkers: 'allow'`. [VERIFIED: playwright.smoke.config.ts]
- `workers: process.env.CI ? 2 : 4`, `retries: 0`, `failOnFlakyTests`, `globalTimeout: 300_000`. There is no pacing delay anywhere ("pacing" in 16-01 means request reduction).

### Why it is no longer enough

16-01's proof was one green run (35.7 s, 121 passed), not a margin measurement. The post-reduction volume is still about 5.7k requests in under 40 s with burst installs, which is the regime where the limiter flips between runs. Gaps that matter for "no 429 ignored": the fixture only logs 429 on navigations. A 429 on `request.get` (csp, seo, routing GETs, version, the assets GETs) is not logged; today it reaches exit 2 only if some navigation also 429s. In the red runs one did, so labelling worked. A run where only API-context requests were limited would exit 1 and read as a suite failure.

## GitHub Pages rate-limit facts (question 2)

| Fact | Source | Confidence |
|------|--------|------------|
| "In order to provide consistent quality of service for all GitHub Pages sites, rate limits may apply." Rate-limited requests get HTTP 429 with an informative HTML body | [CITED: docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits] | HIGH |
| Soft limits: 10 builds per hour (does not apply to custom Actions workflow publishing), 100 GB per month bandwidth, 10-minute deployment timeout | same page | HIGH |
| No requests-per-second or per-minute figure is published; the page gives no per-IP or Actions-runner detail | same page, absence confirmed on the fetched page | HIGH that it is unpublished |
| Response headers on the live site: `Server: GitHub.com`, `Via: 1.1 varnish`, `X-Served-By: cache-ewr-...`, `x-proxy-cache`, `Cache-Control: max-age=600` | one `curl -I` of `_app/version.json` on 2026-11-22 | HIGH |
| Community reports of 429s from CI on other GitHub hosts (githubusercontent) with no published threshold | [CITED: github.com/orgs/community/discussions/159645, /157887] | LOW (other hosts, user reports) |

Conclusion: the limit cannot be looked up. It has to be treated as unknown and variable, which is why the recommendation is a large margin rather than a tuned pace. [ASSUMED: that GitHub-hosted runners share egress ranges that make per-IP limiting noisier than from a home connection; consistent with the observation but not documented]

## Standard Stack

No new packages. Everything below already exists in the repo.

| Tool | Version | Use |
|------|---------|-----|
| `@playwright/test` | 1.65.0 | Smoke specs, fixtures, `request`/`page` APIs [CITED: CLAUDE.md stack table] |
| Vitest | 5.1.0, `--project scripts` | Unit pins in `scripts/*.test.ts` [CITED: CLAUDE.md] |
| Node `node:https`, `node:child_process` | Node 24 | `smoke.mjs` is dependency-free; the repo bans bare `fetch` there |
| GitHub REST `GET /repos/{owner}/{repo}/compare/{base}...{head}` | n/a | Superseded check (status `ahead` / `identical` / `behind` / `diverged`) [ASSUMED: response field name `status`; verify once against the API before coding] |

### Package Legitimacy Audit

No external packages are installed by this phase. slopcheck not needed. **Packages removed:** none. **Flagged [SUS]:** none.

## Options to stay under the limit (question 3)

| Option | Effect (live) | Verdict |
|--------|---------------|---------|
| A. Fewer navigations: third-party on a route sample live, all routes locally | about 3,216 to about 440 (-2,780) | Adopt |
| B. One service-worker install shared by pwa and assets; assets reads statuses from the cache instead of 370 GETs | 1,143 + 370 to about 381 (-1,130) | Adopt |
| C. SEO share-tag checks via `request.get` of the prerendered HTML | 478 to about 15 (-460) | Adopt (HTML is prerendered; csp.smoke.ts already reads the same HTML this way) |
| D. Pacing with a measured delay (sleep between tests/navigations) | Same total, lower burst; adds wall time, needs a tuned constant | Reject: the repo rule is "fewer requests, not waits" (fixtures.ts comment), and the threshold is not stable enough to tune |
| E. `workers: 1` on live | Same total, half the burst rate, about 2x duration | Hold in reserve; only if the measured post-A/B/C runs still show any 429 |
| F. Cache assets within a run (shared context, HTTP cache) | Would cut ~73 to ~3 requests per later load | Reject: the `monitor` fixture installs `context.route(...)` for provider hosts, and Playwright interception is believed to disable the browser HTTP cache [ASSUMED, not found on the fetched docs pages; verify locally before relying on it]; sharing a context also breaks per-test isolation of the monitor, GPC and key-header assertions |
| G. Retries, `toPass`, ignoring 429 | n/a | Forbidden |

### Recommended: A + B + C

Expected live volume after the change (sub-equivalent numbers; live is the root build with the same page weights):

| Spec | Now | After |
|------|-----|-------|
| third-party | 3,216 | about 440 (6 to 7 loads) |
| pwa + assets | about 1,606 | about 390 (one install, cache-status check, manifest GET) |
| seo | 478 | about 20 |
| routing, a11y, csp, analytics, ext, version | about 500 | about 500 (unchanged) |
| **Total** | **about 5,700** | **about 1,350** (-76%) |

Expected run time: third-party was about 6 s of the 26 s before the cutoff and about 16 s over its 44 loads; assets was 9.5 s; so the live run should drop from about 37 s to about 12 to 18 s. [ASSUMED: derived from the log timeline, to be measured in the first task]. The largest remaining burst is the single 381-entry `cache.addAll`, about 2 to 8 s; it was already tolerated in every run, red or green, before the cutoff.

Why this is safe for the suite's purpose:
- `cache.addAll` rejects if any response is non-2xx, so a populated precache already proves every hashed asset answered 200. The assets spec's 370 GETs duplicate the install. Replace them with an in-page check that every `/_app/immutable/` URL in the cache has `response.status === 200` (zero network), keeping the "non-vacuity: more than 50 chunks" assertion. [VERIFIED: fixtures.ts says the install is one atomic `cache.addAll` of the whole build; the 200-status inference follows from the Cache API spec, [ASSUMED] until the first local run confirms `Response.ok` on cached entries]
- Local coverage stays full: gate on the origin kind (`SMOKE_ALLOW_HTTP === '1'`, which `smoke.mjs local()` sets and the remote path never sets). Live runs use the sample; `smoke:local` runs all 44 routes on all three targets.
- Live still checks every route's CSP over HTTP (csp.smoke.ts, 45 requests), so a cross-origin source on a non-sampled route is still caught at the policy level. The sample must cover each route group: marketing (`/`), tools, legal, renter, investor, agent, print (7 routes), and a unit test must pin that the sample is a subset of `ROUTES` and spans every group so it cannot rot.
- The two installs the pwa spec used to do become one: merge the two `installedPrecache` tests (registration/scope and precache contents) into one test or one `describe.serial` group sharing a single page, and assets joins the same flow (or reads the same cache in the same test). The `PRECACHE_INSTALL_TIMEOUT_MS` annotation (20 s, measured 8.3 s max) does not change; no timeout is raised. `scripts/smoke.test.ts` pins that only pwa/assets use `installedPrecache` and both keep `serviceWorkers: 'allow'`; keep that true (if the two specs are merged into one file, update that pin in the same commit).

## Superseded-SHA mechanism (question 4)

Current chain: `ci` (push to main) -> workflow_run `completed` -> `live-smoke` with `SMOKE_EXPECT_VERSION = workflow_run.head_sha`, checkout of that same SHA, concurrency group `live-smoke`, `cancel-in-progress: false`. `smoke.mjs remote()` polls `_app/version.json` every 15 s for up to 10 minutes until it reports the expected SHA (exit 3 on timeout), then runs the suite; `version.smoke.ts` asserts the served version equals the expected SHA once more.

False red happens when push B's deploy lands on the origin while smoke A is waiting or running:
1. A's smoke starts (or sits in the queue) after B deployed: the poll never sees A, 10 minutes later exit 3 (red).
2. B deploys during A's 1-2 minute suite: `version.smoke.ts` fails with exit 1 (red).

`ci` has `concurrency: ci-${{ github.ref }}, cancel-in-progress: true`, so a push made while A's ci is still running cancels A before it deploys (A's workflow_run concludes `cancelled`, live-smoke skipped). With ci at 27 to 33 minutes and a smoke at 1 to 2 minutes, the window is narrow: it needs B's ci to complete while A's smoke is queued or running (A's smoke queued behind another smoke, a hand dispatch, a re-run of an older ci run, or an unusually fast B). No red run to date was a superseded case: both red runs are 429s on the current head. So SMOKE-08 is a hardening item. [VERIFIED: ci.yml concurrency, live-smoke.yml, run list; the window analysis is reasoning, tagged ASSUMED for the exact frequency]

Concurrency-only handling is not enough and has a trap. `cancel-in-progress: true` on the `live-smoke` group would let any new `live-smoke` run cancel an in-flight one, but that includes workflow_run runs whose job is *skipped* (ci cancelled or failed, which is common: the run list shows skipped runs), because the group is declared at workflow level, so a skipped later run would cancel a healthy smoke of a real deploy. That is exactly why 13-03 chose `false`. [VERIFIED: STATE.md 13-03 entry, `gh run list` shows skipped runs; that a workflow-level group is claimed even when the job is skipped is [ASSUMED] from GitHub's documented semantics, verify before relying on it either way.] Moving the group to job level is possible but unproven here. Recommendation: keep `false` and handle it in the entry script.

### Recommended handling: a "superseded" outcome in `smoke.mjs`

- New pure helper, e.g. `classifyServed(expected, served, compareStatus)` returning `'ok' | 'superseded' | 'pending'`:
  - `served === expected` -> ok
  - `served` is a 40-hex SHA other than `expected` and the compare of `expected...served` says `ahead` -> superseded (a newer commit of this repository is serving; its own chained smoke judges it)
  - anything else (`behind`, `diverged`, `identical` with a different string, API failure, non-hex) -> pending / keep waiting, and on timeout exit 3 as today. `behind` is propagation lag or a rollback and must NOT be treated as superseded; a compare failure must fail closed (keep the current behaviour), never turn a red into a green.
- `waitForVersion(base, expected, opts)` gets an injectable `compare` (like the existing `get`) and returns `'ok' | 'timeout' | 'superseded'`. Look up compare once per distinct served SHA.
- `remote()`: on `'superseded'` print `::notice::smoke: <expected> superseded by <served>; not smoked (the newer commit's own live-smoke judges it)` and return 0. After a *failed* suite (status not 0), re-read `version.json` once; if it is now a different SHA that compares `ahead`, return 0 with the same notice (covers B landing mid-run). A 429 failure is still exit 2: check superseded first only when the served SHA differs; 429 evidence with the expected SHA still served stays exit 2.
- Workflow: add to the smoke step env `GITHUB_TOKEN: ${{ github.token }}` (the compare call is a public-repo read; permissions stay `contents: read`; `GITHUB_REPOSITORY` is provided by Actions). Do not add `gh` calls (live-smoke-gate pins `no gh CLI side effects`), no `secrets.`, no new `uses:` (the pin count stays four). The unauthenticated API limit is 60 requests per hour per IP, so use the token (1,000 per hour per repository). [CITED: docs.github.com REST rate limits, via the search result page]
- No new exit code: RUNBOOK's exit table test requires rows 0 to 4 exactly. Document superseded under exit 0 in prose, and in "Read a live-smoke result".

### How a test pins it (style of `scripts/live-smoke-gate.test.ts`)

1. Behavioural unit tests in `scripts/smoke.test.ts` (it already imports `waitForVersion` with injected `get`): served SHA differs and compare says `ahead` -> `'superseded'` without waiting the full timeout; `behind` or `diverged` or a throwing compare -> keeps polling then `'timeout'`; served equals expected -> `'ok'`. Removing the handling turns the first case red. `classifyServed` is pure, so also table-test it.
2. Text pin in `scripts/live-smoke-gate.test.ts`: `GITHUB_TOKEN: ${{ github.token }}` present in the smoke step env, `cancel-in-progress: false` unchanged, still exactly four `uses:` and no `gh `/`secrets.`/`write`.
3. Text pin in `smoke.test.ts` that `remote()` consults the superseded path after a failed suite (needle such as the notice text), with a non-vacuity case like the existing `SMOKE_429_LOG` pin (replace the needle, expect it reported missing).

## Request-volume record and proof (question 5)

### Measure (exact) and record (durable)

- **Authoritative count:** add an opt-in request counter to `scripts/serve-pages.mjs` (env flag, e.g. a count of GET/HEAD per path printed on exit) and run each spec alone against the local emulator (`pnpm smoke:local --target root -- tests/smoke/<spec>`). The emulator sees every request including APIRequestContext ones, so it is not subject to the Playwright event ambiguity. Page weights are build-dependent, so record the build SHA with the numbers. [ASSUMED: serve-pages has no request logging today, grep found none]
- **Per live run (cross-check):** an auto fixture appends one line per test to a file named by an env var (`SMOKE_VOLUME_LOG`, same mechanism as `SMOKE_429_LOG`, same temp dir cleanup in `remote()`), holding the test title and the `context.on('request')` count; `remote()` sums it, prints `smoke: N requests in S s` and appends a short table to `$GITHUB_STEP_SUMMARY` (a file write, no new action, so the pinned `uses:` count is unaffected).
- **Durable:** commit a small table in `docs/RUNBOOK.md` (new subsection under "Read a live-smoke result", for example "Live smoke request volume") with: build SHA, per-spec requests before and after, the run ids and whether each had 429, and the stated rule "the live suite stays under N requests". Add a runbook-oracle assertion that the table's total equals a constant exported from the smoke code, or just a unit test that fails if the live sample list changes without the table: keep it modest. Plain JSON copy at `docs/smoke-volume.json` is optional; the table plus the unit pins are enough.
- Extend the 429 evidence so nothing is ignored: record 429 for APIRequestContext responses too (wrap the `request` fixture, or assert status in the specs through one helper); log the URL to `SMOKE_429_LOG` and keep exit 2. Verify with a local probe whether `context.on('response')` already sees API-context responses before writing a wrapper. Add a unit pin like the existing fixture needle pin.

### Prove "three consecutive green chained runs"

Each push must be allowed to finish `ci` (27 to 33 min) before the next, otherwise `cancel-in-progress` cancels the earlier ci and there is no chained smoke for it. Minimum 3 sequential pushes, about 1.5 to 2 hours. Pushes are the code wave itself plus two docs-only commits (needs owner approval per the repo rule). Evidence per run, read-only:

```bash
gh run list --repo wolfwdavid/tran_real_estate --workflow live-smoke.yml --limit 6 --json databaseId,conclusion,event,headSha
gh run view <id> --repo wolfwdavid/tran_real_estate --log | grep -E "live at|passed|failed|429|requests in"
```

Accept a run only if: event `workflow_run`, `headSha` equals the pushed SHA, `conclusion` success, the log has `N passed` with zero `failed`, no `429` line, and `retries` unchanged at 0 (`git grep -n "retries: 0" apps/web/playwright.smoke.config.ts`). A "superseded" run (exit 0 with the notice) must not count toward the three. Record the three run ids in the RUNBOOK volume table and the phase VERIFICATION file. Do not dispatch a smoke by hand to make up the count. If any of the three shows a 429, the volume is still too high: fix the root cause (option E, or reduce further) and start a new trio; never re-run (RUNBOOK rule 13-13).

## Architecture Patterns

### Request flow of the live smoke after the change

```
push to main
   |
   v
ci (27-33 min) -> deploy job -> Pages origin (Fastly) serves new build
   | workflow_run completed
   v
live-smoke (group live-smoke, queue, never cancelled)
   checkout head_sha -> pnpm install -> playwright install chromium
   |
   v
smoke.mjs remote()
   poll _app/version.json (15 s, up to 10 min)
      served == expected ------------------------------> run suite
      served = other SHA, compare says ahead ----------> notice, exit 0 (superseded)
      served = other SHA, not ahead / lookup fails ----> keep polling -> timeout -> exit 3
   |
   v
playwright (workers 2, retries 0, SW blocked by default)
   csp x45 (GET) | routing | a11y x3 | seo (GET HTML) | third-party (7 routes live)
   pwa + assets (ONE precache install, cache-status check)
   fixtures: monitor (read-only), rateLimit429 (log 429), volume (count)
   |
   +-- green ----------------------------------------> exit 0, log N requests
   +-- fail: served SHA changed + ahead --------------> notice, exit 0 (superseded mid-run)
   +-- fail: any 429 logged --------------------------> exit 2 (CDN rate-limited)
   +-- fail: other -----------------------------------> exit 1 (traces uploaded)
```

### Files that change (and their pins)

| File | Change | Same-commit pin updates |
|------|--------|-------------------------|
| `apps/web/tests/smoke/third-party.smoke.ts` | live sample, full list when `SMOKE_ALLOW_HTTP === '1'` | new unit pin: sample subset of ROUTES and spans groups; `smoke-readonly.test.ts` scans the file (no writes, imports from `./fixtures` only) |
| `apps/web/tests/smoke/pwa.smoke.ts`, `assets.smoke.ts` | one install; cache-status check instead of 370 GETs | `scripts/smoke.test.ts` "service worker is blocked outside the two worker specs" (needles `serviceWorkers: 'allow'`, `installedPrecache` users); update if files merge |
| `apps/web/tests/smoke/seo.smoke.ts` | `request.get` + HTML parse for share tags | none beyond readonly guard; keep `locs.length` 14 and the og:image check |
| `apps/web/tests/smoke/fixtures.ts` | volume fixture; 429 on API-context responses | `smoke.test.ts` "429 evidence fixture pin" needles (`SMOKE_429_LOG`, `isNavigationRequest()`, `429`) must stay, plus new needles |
| `scripts/smoke.mjs` | `classifyServed`, `waitForVersion` superseded, post-fail recheck, volume summary | `scripts/smoke.test.ts`; header comment wording must keep the phrases `precondition`, `not propagated`, `5-minute budget` (runbook oracle reads them) |
| `.github/workflows/live-smoke.yml` | env `GITHUB_TOKEN` only | `scripts/live-smoke-gate.test.ts` (new text pin; four `uses:` and the 25-minute timeout pins unchanged; `no 'write'`, `no 'secrets.'`, no `https://` in the YAML) |
| `docs/RUNBOOK.md` | volume table, superseded paragraph (exit 0), keep rows 0 to 4 | `scripts/runbook.test.ts` (exit-code rows `[0,1,2,3,4]`, workers line equals the config) |
| `apps/web/playwright.smoke.config.ts` | prefer no change (workers 2 stays) | `runbook.test.ts` compares the workers line; `test-lane-rules.test.ts` pins retries `0` and CLI workers; `smoke-env.test.ts` reads the config as text |

### Anti-patterns to avoid
- Sleeping between navigations, or any `waitForTimeout`, to "pace": unmeasured and rejected by lane rules.
- Treating `behind`/unknown as superseded: would turn a real not-deployed failure green.
- Counting a superseded exit-0 run towards the three-green proof.
- Dropping full-route third-party coverage locally: `smoke:local` is part of `pnpm verify` and must run all 44 routes on all three targets.
- Adding a `uses:` step to live-smoke.yml: the gate pins exactly four pinned actions; use env and script code instead.

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---------|-------------|-------------|-----|
| Is commit X newer than commit A | Own ancestry walk / shallow-clone gymnastics | GitHub compare API (`status: ahead`) via `node:https` with the injected-`get` pattern already in `smoke.mjs` | Exact, no history depth issues, testable by injection |
| Verifying every hashed asset answers 200 | 370 manual GETs | The service worker's own `cache.addAll` outcome plus a cached-status check | The install already fetched and validated each file |
| Retry/backoff for 429 | Retry loop | Fewer requests; 429 stays a labelled failure (exit 2) | Retries hide the CDN failures this suite exists to catch |

## Common Pitfalls

### Pitfall 1: "Pacing" that only moves the burst
**What goes wrong:** a sleep or `workers: 1` lowers peak rate but keeps about 5.7k total requests, and the limiter may be count-per-window. **Avoid:** cut volume first; measure; only then consider E. **Sign:** 429 still appears after tests 90+.

### Pitfall 2: Live/local divergence in coverage
**What goes wrong:** the live sample hides a bad route nobody runs. **Avoid:** local runs all routes (pinned), live csp.smoke.ts still covers every route's policy, sample spans every group. **Sign:** sample list not a subset of `ROUTES`.

### Pitfall 3: Counting only navigations
**What goes wrong:** APIRequestContext 429s (csp, seo, version, assets) are invisible to the current fixture and show up as exit 1. **Avoid:** log all 429 responses, including API-context ones, and keep the "any 429 -> exit 2" rule.

### Pitfall 4: Superseded check that fails open
**What goes wrong:** compare API error or rate limit makes the script report superseded and skip a real failure. **Avoid:** only an explicit `ahead` answer for a different 40-hex served SHA counts; every other outcome keeps the current red path. Test it.

### Pitfall 5: Proof pushes that cancel each other
**What goes wrong:** pushing the second commit before the first ci finishes cancels the first run and its smoke never exists. **Avoid:** push sequentially, wait for each chained smoke to finish.

### Pitfall 6: Stale pins after editing workflow or specs
**What goes wrong:** `live-smoke-gate.test.ts`, `smoke.test.ts`, `runbook.test.ts` and the lane guards fail on innocuous edits. **Avoid:** run the pinned tests in the same commit (see Validation Architecture). Never edit `scripts/assert-budget.mjs`.

## Code Examples

### Superseded classification (shape, not final code)

```js
// scripts/smoke.mjs (pure; compare is injected so tests never touch the network)
export function classifyServed(expected, served, compareStatus) {
	if (served === expected) return 'ok';
	if (/^[0-9a-f]{40}$/.test(served) && compareStatus === 'ahead') return 'superseded';
	return 'pending'; // behind, diverged, unknown, lookup failed: keep the existing red path
}
```

### Live sample with full local coverage (shape)

```ts
// apps/web/tests/smoke/third-party.smoke.ts
const LIVE_SAMPLE = ['', 'tools/cap-rate/', 'legal/privacy/', 'renter/', 'investor/deals/', 'agent/', 'print/'];
const routes = process.env.SMOKE_ALLOW_HTTP === '1' ? ROUTES : ROUTES.filter((r) => LIVE_SAMPLE.includes(r));
```

## State of the Art

| Old approach | Current | When | Impact |
|--------------|---------|------|--------|
| Every spec installed the SW (about 10.8k requests) | SW blocked outside pwa/assets (about 5.7k) | 16-01, 2026-11-11 | Halved volume, still at the threshold |
| 429 shows as a generic exit 1 | 429 navigation -> exit 2 | 16-01 | Labelled, still red |
| Smoke trusts head_sha is what is served | Superseded-aware | this phase | No false red for older SHA |

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|-------|---------|---------------|
| A1 | Playwright route interception disables the browser HTTP cache (so a shared-context cache option F does not work) | Options | Low: option F is rejected anyway for isolation reasons |
| A2 | `context.on('request')` may not report APIRequestContext calls, so 16-01's totals may omit the ~370 assets GETs and csp/seo GETs | Measured volume | Totals off by ~10%; the emulator-side counter removes the dependency |
| A3 | GitHub compare API returns `status` with `ahead`/`behind`/`identical`/`diverged` and is callable unauthenticated or with the Actions token for a public repo | Superseded handling | Wrong field name breaks the helper; verify with one read-only API call before coding |
| A4 | A cached Response from `cache.addAll` has `status 200` and is readable via `cache.match` in the page | Recommended A+B+C | Fall back to counting entries plus the install's success |
| A5 | The workflow-level concurrency group is claimed by workflow_run runs whose job is skipped | Superseded handling | If false, `cancel-in-progress: true` would be viable; recommendation to keep `false` still safe |
| A6 | Post-change live run time of 12 to 18 s | Recommendation | Only a planning estimate; measure |
| A7 | Per-IP limiting from shared Actions egress makes thresholds noisy | Pages facts | Does not change the fix |
| A8 | Superseded false-red frequency is low given ci duration 27 to 33 min | Superseded mechanism | If frequent, the handler matters more; no behaviour change |

## Open Questions

1. **Does `context.on('request'/'response')` include APIRequestContext traffic?**
   - Known: docs pages fetched did not state it. Unknown: behaviour in 1.65.
   - Recommendation: first task, a local probe against the emulator with a stub 429 route; decide between a `request` fixture wrapper and a status helper from the result.
2. **What is the real CDN threshold?** Unpublished and variable. Recommendation: do not chase it; after the change, record the volume and ask for 3 clean runs; only if a 429 appears, escalate to option E.
3. **Should the live sample be 7 routes or fewer?** 7 (one per route group) costs about 440 requests. Fewer saves little; keep 7.
4. **Superseded outcome as exit 0 vs a neutral conclusion.** GitHub has no neutral step conclusion without `continue-on-error`; exit 0 with a notice is simplest and is pinned by tests. Flag to the owner if a visible non-green marker is preferred.

## Environment Availability

| Dependency | Required by | Available | Notes |
|------------|-------------|-----------|-------|
| `gh` CLI (read-only) | reading runs, proof | yes | used in this research |
| Node 24, pnpm 12, Playwright chromium | local smoke | yes (repo toolchain) | local build under `apps/web/build` is stale (stamp c14e964, HEAD 07af9c6); rebuild before `smoke:local` |
| Live origin | proof pushes | yes | do not smoke it by hand; owner approves pushes |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 5.1.0, project `scripts` (and `scripts-serial`) for the pins; Playwright 1.65.0 for the smoke itself |
| Config | `scripts/vitest.config.ts`, `scripts/vitest.serial.config.ts`, `apps/web/playwright.smoke.config.ts` |
| Quick run | `pnpm vitest run --project scripts scripts/smoke.test.ts scripts/live-smoke-gate.test.ts scripts/runbook.test.ts scripts/smoke-readonly.test.ts` (about 30 s) |
| Full suite | `pnpm vitest run --project scripts --project scripts-serial`, then `pnpm smoke:local` after rebuilding all three targets (all 44 routes, 3 targets, under the 5-minute budget) |

### Phase Requirements to Test Map
| Req | Behavior | Test type | Automated check | Exists |
|-----|----------|-----------|-----------------|--------|
| SMOKE-07 | Live sample is a subset of ROUTES and spans every group; local runs full list | unit (text/import) | new case in `scripts/smoke.test.ts` | Wave 0 |
| SMOKE-07 | Single install shared by pwa/assets; no per-hash GET loop; SW still blocked elsewhere | unit (text pin) | existing "service worker is blocked outside the two worker specs" group, updated | exists, update |
| SMOKE-07 | retries stays 0, no `toPass`, no sleeps | unit | `scripts/test-lane-rules.test.ts`, `scripts/smoke-env.test.ts` | exists |
| SMOKE-07 | No 429 ignored: API-context 429 logged; any 429 -> exit 2 | unit | `classifySuiteExit` cases + new fixture needle pin | exists + new |
| SMOKE-07 | Volume recorded and under the stated number | unit + docs oracle | runbook test reads the volume table; emulator counter total <= stated max | Wave 0 |
| SMOKE-07 | Three consecutive green chained runs | manual-only (needs real pushes) | `gh run list ... --json` + log grep, recorded in VERIFICATION | n/a |
| SMOKE-08 | Superseded served SHA returns superseded, not timeout; behind/diverged/failed lookup does not | unit | injected `get`/`compare` cases in `scripts/smoke.test.ts` | Wave 0 |
| SMOKE-08 | Removing the handling fails a test | unit (mutation) | the same cases; plus needle pin for the post-failure recheck with a non-vacuity case | Wave 0 |
| SMOKE-08 | Workflow passes the token, stays read-only, four pinned actions, `cancel-in-progress: false` | unit (text) | `scripts/live-smoke-gate.test.ts` | exists, extend |
| Docs | Exit table rows 0-4, wording phrases kept | unit | `scripts/runbook.test.ts` | exists |

### Sampling Rate
- Per task commit: the quick command above.
- Per wave merge: the full `scripts` projects, `pnpm lint:workflows`, `pnpm check`.
- Before the proof pushes: rebuild all three targets, `pnpm smoke:local` green at HEAD (also measures post-change volume with the emulator counter).
- Phase gate: three consecutive green `workflow_run` live-smoke runs recorded, then `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] Request counter in `scripts/serve-pages.mjs` (opt-in) and a place to record its output
- [ ] `classifyServed` + injectable compare in `scripts/smoke.mjs` and its tests
- [ ] Live-sample pin test; fixture volume/429 needle pins
- [ ] Runbook volume table and an oracle assertion for it

## Security Domain

| ASVS category | Applies | Control |
|---------------|---------|---------|
| V5 Input validation | yes | Served version must match 40-hex before it is sent to the compare API (never interpolate raw `version.json` content into a URL) |
| V6/V2/V3/V4 | no | No auth, sessions or crypto added |
| Secrets handling | yes | Only the Actions-issued read token in env; no `secrets.`, no write scope, no gh CLI; never log it |

| Threat | STRIDE | Mitigation |
|--------|--------|------------|
| A hostile or odd `version.json` body steering the compare URL | Tampering | Strict `^[0-9a-f]{40}$` check, repository from `GITHUB_REPOSITORY` |
| Superseded path masking a real failure | Repudiation | Only an explicit `ahead`; fail closed otherwise; superseded runs never count as proof |
| Smoke accidentally writing/calling providers | Tampering | Existing `monitor` fixture and `smoke-readonly.test.ts` stay unchanged |

## Sources

### Primary (HIGH)
- GitHub Pages limits page, fetched 2026-11-22: https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
- Run logs read with `gh run view --log`: 44812409812 (green), 44932727516 (red), 44959696791 (red); `gh run list --workflow live-smoke`
- Repository files: `scripts/smoke.mjs`, `apps/web/tests/smoke/*`, `apps/web/playwright.smoke.config.ts`, `.github/workflows/live-smoke.yml`, `.github/workflows/ci.yml`, `scripts/live-smoke-gate.test.ts`, `scripts/smoke.test.ts`, `scripts/runbook.test.ts`, `docs/RUNBOOK.md`, `.planning/phases/16-toolchain-pnpm-12-sveltekit-3-vitest-5/16-01-SUMMARY.md`, `.planning/milestones/v1.1-MILESTONE-AUDIT.md`
- One `curl -I` of the live `_app/version.json` (headers only)

### Secondary (MEDIUM)
- GitHub REST rate limits (60 unauthenticated per hour, token 1,000 per hour per repository) as reported by search, https://docs.github.com/en/rest/overview/rate-limits-for-the-rest-api

### Tertiary (LOW)
- Community threads on 429s from other GitHub hosts: https://github.com/orgs/community/discussions/159645, https://github.com/orgs/community/discussions/157887

## Metadata

**Confidence breakdown:**
- Failure shape and volume breakdown: MEDIUM-HIGH (logs plus 16-01 measurements; Kit 3 per-spec counts not re-measured)
- CDN threshold: LOW (unpublished, variable)
- Recommended reduction: MEDIUM (arithmetic is solid; effect on the limiter is empirical, proven only by the three runs)
- Superseded handling: MEDIUM (design sound; compare API response shape to be verified once)

**Research date:** 2026-11-21
**Valid until:** 2026-12-21 (the CDN behaviour can change without notice)
