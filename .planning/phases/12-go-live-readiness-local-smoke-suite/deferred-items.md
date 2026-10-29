# Phase 12 deferred items

- (12-04, out of scope) `scripts/precommit.test.ts > pre-commit gate in an isolated repository` failed once in a full `pnpm test:unit` run while four executors shared the machine; it passed alone (10/10) and the immediate full re-run was 345/345 green. The file spawns real git and touches nothing 12-04 changed. Per lessons ("isolation is not proof of a flake"), reproduce it under artificial load (CPU throttle, parallel git) before calling it load-sensitive; candidate cause is the default 5 s test timeout around real `git commit` spawns.

## Owner decision at the 12-10 gate (2026-10-29): personal account, not a new org

The owner chose to host under the existing GitHub account instead of creating the `tranrealestate` org. Repo: `wolfwdavid/tran_real_estate` (public, created empty by the owner). Consequences handed to Phase 13:

- Live origin becomes `https://wolfwdavid.github.io/tran_real_estate/` (a project site on the shared `wolfwdavid.github.io` origin), so Phase 13 must deploy the **sub-path** build (`BASE_PATH=/tran_real_estate`) and set the `PUBLIC_SITE_URL` repository variable to `https://wolfwdavid.github.io/tran_real_estate` before `PAGES_ENABLED=true`.
- Shared-origin trade-off is accepted by the owner: browser storage (BYOK keys, Dexie data) is shared with the owner's other Pages project sites on that origin. Revisit with a custom domain or an org if that changes.
- `docs/DEPLOY-CHECKLIST.md` Steps 1-2 and `docs/EXTENSION-INSTALL.md` / privacy wording still name the org and `tranrealestate.github.io`; update them in Phase 13 (the checklist test pins Step headings and hosts, not the org name, so this is a doc edit).
- Steps 3-5 were applied through the GitHub API at gate time: Pages build_type = `workflow`, secret scanning + push protection enabled, Dependabot alerts + security updates enabled. Dependabot opened its first update runs immediately after the push.
