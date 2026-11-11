# Lessons

## 2026-10-06: "Agent stalled" can be the machine, not the plan

- Four parallel GSD executors (08-14, 08-15, 08-16 and a flaky-test fix) all stopped with
  "no progress for 600s". The code was fine. Every Node process on the box was dying with
  `Assertion failed: new_time >= loop->time, file src\win\core.c` because the performance
  counter started going backwards across cores after a resume from sleep.
- Rule: before re-running a stalled wave, run a 2-second Node timer loop
  (`node -e "let n=0;const t=setInterval(()=>{if(++n>1500)clearInterval(t)},1)"`).
  If it aborts, fix the environment first (single-core pin via `ProcessorAffinity`, or reboot).
- Rule: when re-launching executors mid-plan, hand them the exact resume state (what is
  committed, what is on disk untracked, the last words of the stalled agent) instead of
  letting them re-derive it from git.
- Rule: in a wave where more than one plan builds and runs Playwright, only one executor may
  own `pnpm build:*` at a time. Have the others stop before the E2E step and release them
  one by one; the build output directory is shared.

## 2026-10-07: Phase 8 close-out

- Rule: a green full `verify` is not the same as a met success criterion. The 08-26 gate passed
  1490 E2E tests, yet the verifier found agent pages could still spend RentCast calls through a
  shared layout, because every "no RentCast" test ran keyless. When a criterion says "with a real
  key", at least one test must seed a real-format key and the data that would trigger spending.
- Rule: `gsd-tools phase complete` and `roadmap update-plan-progress` tick any plan line whose
  text mentions the phase ("Phase 8 boundary scope" ticked 09-10 twice). Diff ROADMAP.md after
  every gsd-tools roadmap write and revert stray ticks before committing.
- Rule: a SendMessage to an executor that is finishing its turn may be queued and dropped. After
  releasing an executor, check git for its stage 2 commits; re-send if nothing moved.
- Rule: serialize build + Playwright across parallel executors with a two-stage handshake
  (implement and unit-verify, stop, then "run E2E" one at a time). It ran 14 plans with zero
  build collisions.

## 2026-10-07: watchdog stalls during long gates

- Rule: the session watchdog kills an agent after 600 s with no progress, and a single tool call
  that runs close to 10 minutes counts as no progress. A Bash timeout of 600000 is therefore a
  trap. Cap every call at 7 minutes (timeout 420000) and size Playwright chunks to about 5 minutes.
- Rule: when a gate agent stalls, check `git log` and `git status` first, then resume the same agent
  with the exact tree state; ask it to commit finished items one by one so a stall loses nothing.

## 2026-10-13: Phase 10 orchestration

- Rule: a test that "passes in isolation" is not proven to be a flake. `guide.spec.ts:107` failed in three
  separate full runs and was written off as load-sensitive; it was a real race (a slow lazy-loaded tour
  panel overwrote a later user action). Before classifying any failure as a flake, reproduce it under an
  artificial delay (route-level delay on the lazy chunk, throttled CPU) and look for a write that can land
  after a newer user action.
- Rule: a lock-wait loop that times out must abort, never fall through to the guarded command. One
  executor's loop expired and it built anyway, clobbering another plan's build output. Use the
  `GOT=1 ... || exit 3` pattern.
- Rule: when executors die from network drops (ENOTFOUND), wait for ~2 minutes of continuous connectivity,
  inspect `git log`, `git status` and the build-lock owner, then resume the SAME agent with the exact tree
  state (its commits, its uncommitted files, whether it still holds the lock). No work was lost across
  four drops this way.
- Rule: per-route JS budgets are spent by shared code. Every change that touches every page (footer,
  layout, a shared helper import) must re-measure the gated routes on the build that production ships
  (analytics on), not only the default build.

## 2026-10-25: Phase 11 orchestration

- Rule: parallel executors add a `Co-Authored-By` model trailer to their first commit unless the prompt
  forbids it explicitly. Two wave-2 agents could not amend because another agent had already committed on
  top. Put the ban in every executor prompt ("no trailer; amend it off while the commit is still HEAD"),
  and after each wave run `git log --format='%h %(trailers:key=Co-Authored-By,valueonly)' <base>..HEAD`.
  If any remain, `git filter-branch --msg-filter 'grep -v "^Co-Authored-By:"' <base>..HEAD` BEFORE the
  first push, then remap the hashes quoted in the SUMMARY files (the subjects are stable, the hashes are not).
- Rule: a sub-package with a stricter generated tsconfig (WXT sets `noUncheckedIndexedAccess`) type-checks
  shared workspace packages under its own rules. `packages/brand` passed its own `tsc` and failed inside
  `apps/extension`. Fix the shared code (it was a real gap), never loosen the generated config.
- Rule: research built from a snapshot of a third-party DOM must be re-checked live before the detector
  plan runs. A read-only browser pass (ten minutes) confirmed the selectors and showed that label text
  never appears today, which changed the primary signal to the ad-slot list items.
- Rule: `pnpm audit --audit-level low` is a moving target. Eleven advisories against pins that were
  unchanged since Phase 10 appeared between 10-14 and 10-26, so a close-out plan can fail `verify` on
  code nobody touched. Run `corepack pnpm audit` FIRST in any close-out or resume, before the long
  chain. Patch-level bumps for devtools (vite/vitest/happy-dom/zod) are safe; a major-only fix
  (Kit 2 -> 3) goes into `scripts/lib/audit-exceptions.mjs` + `pnpm-workspace.yaml` with proof the
  code path never ships (grep src + grep build/_app), and regenerate `docs/LAUNCH-AUDIT.md`.
- Rule: an instant `expect(flag).toBe(true)` on a flag set inside a Playwright route handler is a
  race under load (autofill.spec.ts:200 failed once in 2,327). Use `expect.poll` for anything set by
  an intercepted request; keep instant reads for "this must never have happened" assertions only.
- Rule: when an executor defers a verify step because another agent holds the build/Playwright lock,
  the post-wave orchestrator check must run that exact step before the wave is called green. Oracle
  unit tests only see hand-fed inputs, not what the real bundler emits: `pnpm ext:assert` was red on
  main for two full waves (13-02 added an unconsumed `new URL()` that kept the site URL as a bare
  literal in the popup chunk) and nothing noticed until 13-10 built the real zip.

## 2026-10-30: Phase 13 owner checkpoints

- Rule: never offer a menu option that says "paste it in Other". Picking a labelled option skips the
  free-text box, so the choice arrives without the value (this happened three times: the Umami ID, the
  Web3Forms key, the Search Console tag; the CORS counts were lost the same way). When a checkpoint
  needs data (an ID, a tag, a URL, counts), ask for it in plain chat text and reserve the menu tool for
  decisions whose options are complete in themselves. Verify any "saved to folder" answer with `ls`
  before acting on it.

## 2026-10-31: Phase 13 audit at the deployed commit

- Rule: under `MSYS_NO_PATHCONV=1` in Git Bash call `corepack.cmd pnpm ...`, never the POSIX `corepack` shim;
  the shim resolves its own `$basedir` through the path translation that the flag disables and dies with
  `Cannot find module C:\c\Program Files\nodejs\...`.
- Rule: when regenerating audit evidence at a deployed SHA, export the deploy env (BASE_PATH, PUBLIC_SITE_URL,
  PUBLIC_WEB3FORMS_KEY) for the builds, the E2E shards and `audit:launch` only. Run the Vitest shards without it:
  `ci.yml` gives `test:unit` no env block, and `site.test.ts` / `assert-extension.test.ts` assert the defaults
  (5 + 2 false reds on the first pass).
- Rule: never write `<NAME>_KEY=<value>` in a planning doc or SUMMARY, even for a public-by-design key;
  gitleaks `generic-api-key` fires on the assignment shape and the pre-commit hook rejects the commit. Quote the
  value in a table cell or as a `--body` argument, or name the variable without the value.
- Rule: a Search Console sitemap row that reads "Couldn't fetch" with 0 discovered pages right after submission is
  the pre-processing placeholder (Googlebot-UA curl 200, robots Sitemap line present). Record "submitted, pending"
  with the time and re-check later; never re-submit in a loop.
- Rule: a live-smoke run that fails only with HTTP 429 on `page.goto` is the Pages CDN rate-limiting the runner,
  not a site regression. Probe the routes with curl, then dispatch `live-smoke.yml` once on the same SHA
  (`-f base_url=... -f expect_version=<sha>`). Record both runs; never re-dispatch in a loop. 41220466187 failed
  35 tests with 429 and the dispatch 41220812811 passed 121/121 three minutes later (2026-10-31).

## 2026-11-10: Phase 15 evidence protocol

- Rule: before any long Playwright or `pnpm verify` run on the dev laptop, require 10 consecutive minutes with
  no WLAN-AutoConfig event 8003. The Intel Wi-Fi 7 BE201 driver drops the WLAN every 1-3 minutes in bad
  stretches, and each drop makes Chromium abort every in-flight request, loopback included, with
  `net::ERR_NETWORK_CHANGED` (pages stuck on `<html hidden>`, "Failed to fetch dynamically imported module").
  When a browser run fails, check the 8003 log for the run window before root-causing anything in the repo.
- Rule: a CPU-pressure level is a measured choice, not a constant. 16 burner threads plus four Playwright
  browsers on 16 CPUs starved Chromium's network path (2.5-5 s per small chunk while the server answered in
  3 ms) and failed default 5 s expectations around lazy imports. Prove the server is not the bottleneck, reproduce
  with an artificial delay, then lower the pressure (12 threads, 75% of CPUs) rather than raise timeouts.

## 2026-11-11: pnpm 12 is a native binary

- Rule: pnpm 12 sets `npm_execpath` to `pnpm.exe`, so `node $npm_execpath ...` dies with
  ERR_UNKNOWN_FILE_EXTENSION. Scripts that spawn pnpm go through `scripts/lib/pnpm-cmd.mjs`
  (`pnpmCommand()`); never re-inline the `[process.execPath, [execPath]]` pair (a sweep test fails on it).
- Rule: a pnpm 12 lockfile has two YAML documents (boot document first, project document last). Regenerate it
  once with a non-frozen install in the same commit as the pin, and check that the second document is
  byte-identical to the previous lockfile.
- Rule: on a machine whose global pnpm is still 11, `corepack.cmd pnpm <script>` fails inside any script that
  runs `pnpm ...` (audit:deps, verify): the inner PATH `pnpm` is the global 11 and refuses to run under
  corepack ("Your current pnpm is v11.27.0"). Run the gate with a plain `pnpm`, which self-switches to the pin
  and puts pnpm 12 in the children's environment. Do not change the global tool to fix it.
