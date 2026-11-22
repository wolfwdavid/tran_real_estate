---
phase: 18-live-smoke-stability
plan: 03
subsystem: testing
tags: [smoke, playwright, github-pages, rate-limit, service-worker, github-actions]

requires:
  - phase: 18-live-smoke-stability
    provides: Probe A (which requests the context listeners see) and the rate-limited install facts (18-01); the single install and the API-only seo spec (18-02)
provides:
  - 429 evidence from every source (navigation, sub-resource, service worker install, API-context request)
  - A fast, named failure of installedPrecache when the install is rate-limited
  - Superseded handling in scripts/smoke.mjs (classifyServed, githubCompare, supersededLookup, checkSuperseded) with injected lookups
  - GITHUB_TOKEN on the smoke step, pinned by the gate test
affects: [18-04, 18-05]

tech-stack:
  added: []
  patterns:
    - "Two 429 observers: the context response listener plus a Proxy over the request fixture, because neither sees everything"
    - "Network lookups are injected (get, compare), so the superseded decision is unit-tested without a network"

key-files:
  created: []
  modified:
    - apps/web/tests/smoke/fixtures.ts
    - scripts/smoke.mjs
    - scripts/smoke.test.ts
    - .github/workflows/live-smoke.yml
    - scripts/live-smoke-gate.test.ts

key-decisions:
  - "The context listener logs every 429 response with no source restriction; the request fixture is wrapped for API-context traffic"
  - "installedPrecache fails at once on a 429 response event, not by inspecting the worker state"
  - "The compare lookup exists only when GITHUB_EVENT_NAME is workflow_run and a repository and a token are set; everything else keeps the red path"
  - "checkSuperseded returns the newer SHA or null (not a boolean) so the notice can name it"

patterns-established:
  - "Prove a fixture's 429 handling against a loopback proxy in front of the emulator that answers 429 on one path"

requirements-completed: [] # SMOKE-07 closes with the 18-05 proof runs. SMOKE-08 is implemented and pinned here but left open: see "Requirement status"

duration: 20min
completed: 2026-11-22
---

# Phase 18 Plan 03: No 429 Ignored and the Superseded Outcome Summary

**Every HTTP 429 in the live smoke now reaches the exit-2 path whatever its source, and a chained run whose commit was overtaken by a newer deploy ends with exit 0 and a notice instead of a false red**

## Performance

- **Duration:** about 20 min
- **Started:** 2026-11-22T14:17Z
- **Completed:** 2026-11-22T14:37Z
- **Tasks:** 3
- **Files modified:** 5 (plus this summary)

## Accomplishments

- `fixtures.ts` records a 429 from a navigation, a sub-resource, the service worker's install and an API-context request.
- `installedPrecache` fails in about a second with a named error when the install is rate-limited, instead of polling for 20 s.
- `scripts/smoke.mjs` classifies a newer served commit as superseded, during the version poll and again after a failed suite, only for chained runs and only on an explicit `ahead`.
- `live-smoke.yml` gained one env line; the token is removed from the env given to Playwright.

## Task Commits

1. **Task 1: log 429 from every source** - `a40bb58` (test)
2. **Task 2: superseded classification with injected lookups** - `4a5901e` (fix)
3. **Task 3: token env on the smoke step and its gate pin** - `77081a8` (ci)

## What each 429 source does now

| Source | Seen by | Result |
| --- | --- | --- |
| Page navigation | context response listener | URL appended to SMOKE_429_LOG, a failed suite exits 2 |
| Sub-resource of a page (script, style, image) | context response listener (new: no navigation restriction) | same |
| Service worker install (`cache.addAll`) | context response listener (new) | logged, and `installedPrecache` throws `HTTP 429 during the service worker install: <url>` at once; exit 2 |
| API-context request (`request` fixture: seo, csp, version, routing, the manifest GET) | Proxy over the `request` fixture wrapping `get`, `head` and `fetch` (new) | logged; the response is returned untouched; exit 2 |
| `page.request`, `context.request`, a new request context | nothing | not used by any smoke spec; a unit pin fails if one is added |

- **Which plan branch applied:** the request wrapper (the listener does not see API traffic) together with Branch A for the worker (the listener sees the worker's 429), with the listener condition widened as 18-01 finding 1 required. `isNavigationRequest` no longer appears in the fixture.
- **Green runs are unchanged:** `classifySuiteExit` still never relabels a passing suite, and nothing is written unless SMOKE_429_LOG is set (the local run does not set it).
- **The message** printed for exit 2 now says `request(s)` instead of `navigation(s)`.

### Proof against a 429 (loopback only)

A scratch proxy in front of the local emulator answered 429 on one path, and the real fixtures ran against it with SMOKE_429_LOG set (the script is outside the repo and not committed).

| Case | 429 on | Outcome | Log |
| --- | --- | --- | --- |
| Worker install | `/renter/` (precached, not loaded by the page) | pwa test failed after 1.2 s with `HTTP 429 during the service worker install: .../renter/` | one line, that URL |
| API context | `/robots.txt` | seo test failed on its status assertion (received 429) | one line, that URL |

Before this plan the first case would have waited the full 20 s and logged nothing, and the second would have logged nothing.

## Superseded decision table (as implemented)

The lookup exists only when `GITHUB_EVENT_NAME` is `workflow_run` and both `GITHUB_REPOSITORY` and `GITHUB_TOKEN` are non-empty.

| Event | Served version | Compare `expected...served` | During the poll | After a failed suite |
| --- | --- | --- | --- | --- |
| workflow_run | the expected SHA | not asked | continue to the suite | exit 1, or 2 with 429 evidence |
| workflow_run | another 40-hex SHA | `ahead` | exit 0 with `::notice::` | exit 0 with `::notice::` |
| workflow_run | another 40-hex SHA | `behind`, `diverged`, `identical`, any other value | keep polling, exit 3 at 10 minutes | exit 1, or 2 with 429 evidence |
| workflow_run | another 40-hex SHA | lookup failed (non-200, not JSON, network error, 401 or 403, thrown) | keep polling, exit 3 | exit 1 or 2 |
| workflow_run | not a 40-hex string, or unreadable | not asked | keep polling, exit 3 | exit 1 or 2 |
| workflow_run without a token or repository | any | no lookup | today's path | today's path |
| workflow_dispatch, local, any other event | any | no lookup | today's path | today's path |

- The lookup is asked once per distinct served SHA within a poll; a failed answer is not asked again.
- A passing suite is never rechecked. The recheck is one read of `version.json`, placed before the 429 mapping, so 429 evidence with the expected SHA still served stays exit 2.
- No new exit code: `process.exit` is still called with the 0 to 4 mapping.
- The notice text: `::notice::smoke: <expected> superseded by <served>; not smoked (the newer commit's own live-smoke judges it)`.

### Compare API field check (assumption A3)

Two read-only `gh api` calls to the public compare endpoint, with two adjacent commits on `origin/main`:

- `compare/<older>...<newer>` returned `status: "ahead"` (`ahead_by` 1, `behind_by` 0).
- `compare/<newer>...<older>` returned `status: "behind"`.

The field is `status` and it describes the second SHA relative to the first, so `expected...served` answering `ahead` means the served commit is newer. A3 is confirmed.

### Mutation check

`compareStatus === 'ahead'` was changed to `'xx'` in `classifyServed`: `scripts/smoke.test.ts` went to 5 failed, 99 passed (the classifier table, the poll, the once-per-SHA case, the chained case and `checkSuperseded`). The change was reverted and the file is green. The source pins on `remote()` have their own planted cases for a missing notice, a kept token, a missing recheck and a recheck placed after the exit mapping.

## Verification

- **Build SHA:** `77081a8c3d5c9d027cfab3a8171c0eabec329078`, equal to `git rev-parse HEAD` and to `_app/version.json` in all three builds.
- **`pnpm vitest run --project scripts`:** 40 files, 1,346 tests passed (1,271 before; 75 new). Log: `.tools/p18/18-03-scripts.log`.
- **`pnpm lint:workflows`:** exit 0.
- **`pnpm check`:** 0 errors (run after Task 1). **`pnpm lint`:** exit 0, one warning in an unrelated file that predates this plan.
- **`pnpm smoke:local`:** exit 0.

| Target | Tests | Time |
| --- | --- | --- |
| root | 119 passed | 14.0 s |
| sub | 119 passed | 14.3 s |
| configured | 119 passed | 14.2 s |
| **Total** | | **42.5 s** (budget 300 s) |

- Workflow greps: `github.token` 1, `cancel-in-progress: false` 1, `uses: ` 4, and no match for `secrets.`, `gh `, `https://` or `write`.

## Requirement status

- **SMOKE-07:** advanced (no 429 is ignored). It closes with the three proof runs in 18-05.
- **SMOKE-08:** the handling and the tests that pin it are in place, which is what the requirement text asks for (a quick double push is not red, pinned by a test on the smoke entry script and the workflow). It is left unmarked for two reasons: `remote()` itself is covered by source pins rather than executed, and the compare call with the Actions token has not run on a runner yet. The runbook text for the exit-0 outcome is 18-04's. The owner can mark it complete now or after the first chained run that shows the token works.

## Findings for later plans

Nothing here contradicts what 18-04 or 18-05 rest on.

1. **18-04, runbook wording.** Exit row 2 in `docs/RUNBOOK.md` says "a 429 on a smoke navigation". The code now treats a 429 on any smoke request that way, and the printed message says `request(s)`. The header of `smoke.mjs` still carries `precondition`, `not propagated` and `5-minute budget`, and now has a superseded paragraph to mirror.
2. **18-04 and 18-05, how to tell a superseded run.** It concludes success and its log has a `::notice::smoke: <sha> superseded by <sha>` line and no test counts. It must not count toward the three proof runs.
3. **18-05, first real use of the token.** If the compare call fails on the runner, the run stays red exactly as before (exit 3 or 1), so a failure is safe but would mean SMOKE-08 does not work in practice. A dispatch never uses the handling, so only a chained run can show it.
4. **18-05, a 429 in the proof runs is now louder.** A 429 on a sub-resource or an API request used to be invisible unless it broke an assertion; it is now logged, and any failed suite with one exits 2. A passing suite with a 429 line stays green, and the log file is deleted, so "no 429" for a green run still has to be read from the absence of failures.
5. **Suite size is unchanged:** 119 tests in 9 spec files locally, 84 expected live.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] Pin against API-context calls that bypass the wrapper**
- **Found during:** Task 1
- **Issue:** The wrapper covers the `request` fixture only. `page.request`, `context.request` or a new request context would be invisible to both observers.
- **Fix:** A unit pin fails if any smoke spec uses one of them. None does today.
- **Files modified:** scripts/smoke.test.ts
- **Commit:** `a40bb58`

### Other differences

- **`installedPrecache` fails fast through the 429 response event**, raced against the unchanged poll, not by detecting the redundant worker. Worker state read from the page was not tried: after a failed first install a page cannot reliably tell "failed" from "not registered yet" (not measured here), while the response event is unambiguous and was proven above. No sleep, retry or timeout change. An install that fails for a reason other than a 429 still waits the 20 s.
- **The wrapper also covers `fetch`**, besides the plan's `get` and `head`.
- **`githubCompare` uses the existing `httpGet` with a headers argument** and parses JSON itself; there is no separate `httpGetJson`.
- **`supersededLookup(env, expected)` takes the expected SHA**, since the returned function receives only the served one.
- **`checkSuperseded` returns the newer SHA or null** instead of true or false.
- **Task 1's commit message** names every 429 source, not only API-context requests.
- **The exit-2 message and three comments in `smoke.mjs`** say request or response instead of navigation.
- **The full scripts project ran in the foreground** (a few seconds), not in the background.

## Issues Encountered

- The first run of the 429 proof showed no 429 at all: the proxy lived in a process that was blocked by a synchronous child spawn, and Git Bash rewrote the `/renter/` argument into a Windows path. Both were faults of the scratch script; with an asynchronous spawn and path conversion off, the proxy answered and the fixtures behaved as described.
- A non-vacuity case for the token pin was itself vacuous at first (its text replacement hit the `runPlaywright` definition, not the call). The test failed, which is how it was found, and the replacement now targets the call.
- A shell command that would have reverted the mutation with `git checkout` on a file with uncommitted work was refused by the permission system before it ran. The mutation and its revert were then done with the edit tool. Nothing was lost.

## Not done

- No live run, no push, no workflow dispatch (by rule). `remote()` was not executed end to end; its pieces are unit-tested and its wiring is pinned as text.
- `docs/RUNBOOK.md` and `18-VALIDATION.md` were not changed (18-04).
- `requirements.mark-complete` was not run.

## Self-Check: PASSED

- Files found: apps/web/tests/smoke/fixtures.ts, scripts/smoke.mjs, scripts/smoke.test.ts, .github/workflows/live-smoke.yml, scripts/live-smoke-gate.test.ts
- Commits found: a40bb58, 4a5901e, 77081a8
- Nothing under .tools/ is tracked; .planning/config.json was never staged
