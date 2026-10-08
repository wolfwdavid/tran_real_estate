# 09-23 verify progress (step by step, single core 0x100)

`corepack pnpm verify` is run one step at a time in package.json order because of the one-core
machine constraint (Node is pinned to a single core). Each line: step, exit code, wall seconds.
Wall seconds include any host suspend while the step ran.

- check: exit 0, 783 s (wall clock includes a host suspend; svelte-check 2615 files, 0 errors, 0 warnings)
- lint: exit 0, 245 s (prettier --check . clean, eslint . clean)
- banned: exit 0, 3 s (384 files)
- ui:guard: exit 0, 2 s (79 files)
