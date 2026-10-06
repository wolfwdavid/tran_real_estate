# Phase 8 Deferred Items

- **[08-02, 2026-10-06] Repo-wide `corepack pnpm lint` red from 08-01's file.** `packages/core/src/leads/normalize.ts:9` trips `no-control-regex` on the `HOSTILE` character class (`\u0000-\u0008`, `\u000B-\u001F`). This is intentional sanitiser code from plan 08-01, outside 08-02's owned files. Suggested fix: add `// eslint-disable-next-line no-control-regex -- strips hostile C0/C1 controls on purpose` above the regex, or build it with `new RegExp(...)` from escaped strings. Every file 08-02 touched lints clean.
