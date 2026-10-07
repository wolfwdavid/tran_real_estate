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
