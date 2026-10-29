# Phase 12 deferred items

- (12-04, out of scope) `scripts/precommit.test.ts > pre-commit gate in an isolated repository` failed once in a full `pnpm test:unit` run while four executors shared the machine; it passed alone (10/10) and the immediate full re-run was 345/345 green. The file spawns real git and touches nothing 12-04 changed. Per lessons ("isolation is not proof of a flake"), reproduce it under artificial load (CPU throttle, parallel git) before calling it load-sensitive; candidate cause is the default 5 s test timeout around real `git commit` spawns.
