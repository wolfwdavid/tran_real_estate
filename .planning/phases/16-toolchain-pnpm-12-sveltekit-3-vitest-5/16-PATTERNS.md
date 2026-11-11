# Phase 16: Toolchain: pnpm 12 -> SvelteKit 3 -> Vitest 5 - Pattern Map

**Mapped:** 2026-11-10
**Files analyzed:** 17 groups (new, rewritten, modified) plus the ~1,060-import codemod described once
**Analogs found:** 16 / 17 (one partial: the 429 exit classifier has no direct analog)

All paths are repo-relative to `C:\Users\Mkaru\Documents\Hello_World\hugginface_profile\Websites\Tran\tran_real_estate`. Line numbers are from the tree at mapping time (Kit 2 / Vitest 4, pre-16-00).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `scripts/lib/pnpm-cmd.mjs` (new) | utility | transform (env -> spawn pair) | `scripts/lib/windows-path.mjs` (shape) + the 4 inline pairs (behaviour) | exact (role + shape) |
| `scripts/pnpm-cmd.test.ts` (new) | test | transform + repo-sweep | `scripts/windows-path.test.ts` | exact |
| `scripts/build-web.mjs`, `smoke.mjs`, `audit-evidence.mjs`, `launch-audit.mjs` (modify) | script | request-response (spawn) | themselves (the four identical pairs) | exact |
| `scripts/kit3-migration.test.ts` (new) | test | batch (repo grep sweep) | `scripts/test-lanes.test.ts` (git ls-files sweep) + `scripts/service-worker-guard.test.ts` (non-vacuity) | role-match |
| `scripts/vitest5-migration.test.ts` (new) | test | batch (repo sweep) | `scripts/test-lanes.test.ts` + `scripts/windows-path.test.ts` group (g) | role-match |
| `apps/web/kit.options.js` (new) | config | transform | `apps/web/svelte.config.js` (the content moves) | exact (content) |
| `apps/web/vite.config.ts` (modify) | config | transform | itself, lines 1-56 | exact |
| `apps/web/src/service-worker.ts` -> `src/service-worker/index.ts` (rewrite) | service worker | event-driven | itself, lines 18-51 | exact |
| `scripts/service-worker-guard.test.ts` (rewrite) | test | transform (source-shape guard) | itself, lines 14-78 | exact |
| `scripts/smoke.mjs` 429 relabel (modify) | script | request-response | `smoke.mjs` `staleBuilds` / `waitForVersion` (pure seam style) | partial |
| `scripts/smoke.test.ts` 429 test (extend) | test | request-response | `scripts/smoke.test.ts` `waitForVersion` block | exact |
| `apps/web/playwright.smoke.config.ts` + `tests/smoke/fixtures.ts` (pacing) | config / fixture | event-driven | themselves | exact |
| `scripts/lib/test-lane-rules.mjs` (guard additions) | utility (pure rules) | transform (AST) | itself, `vitestRaiseSites` + `retryFindings` | exact |
| `scripts/test-lane-rules.test.ts` (planted-bypass cases) | test | transform | itself, lines 330-470 | exact |
| `scripts/eslint-rules.test.ts` + `eslint.config.js` (planted violations, `\#lib`) | test / config | transform | itself, lines 1-80, 100-170 | exact |
| `docs/test-evidence/<new date>.md` + `scripts/test-evidence.test.ts` | doc + test | batch | `docs/test-evidence/2026-11-10.md` | exact |
| `scripts/supply-chain.test.ts` lockfile test (rewrite) | test | transform | itself, lines 176-181 | exact |

## Pattern Assignments

### `scripts/lib/pnpm-cmd.mjs` (utility, transform)

**Analog (shape):** `scripts/lib/windows-path.mjs` - one small pure module with a JSDoc contract, parameters defaulting to `process.*` so tests inject env/platform, consumed by many callers, with a test that pins "no inline copy survives".

**Behaviour to extract (the four identical inline pairs):**
- `scripts/build-web.mjs:25-28`
- `scripts/smoke.mjs:171-173`
- `scripts/audit-evidence.mjs:207-208` (shell at 211)
- `scripts/launch-audit.mjs:969-971`

```js
// build-web.mjs 25-28 (the three siblings differ only in how they spell `shell`)
const execPath = process.env.npm_execpath;
const [bin, pre] = execPath ? [process.execPath, [execPath]] : ['corepack', ['pnpm']];
// corepack is a .cmd shim on Windows, so the direct-`node` fallback needs a shell for both spawns.
const shell = !execPath && process.platform === 'win32';
```

**Module shape to copy** (`windows-path.mjs` lines 1-27): header comment saying who calls it, `@param` JSDoc with injectable `env`/`platform`, pure function, no side effects:
```js
export function ensureSystem32OnPath(env = process.env, platform = process.platform) {
	if (platform !== 'win32') return false;
	...
}
```

**Target (RESEARCH Pattern 1):** return `{ bin, pre, shell }`. JS path -> `[process.execPath, [execPath]]`; non-JS (`pnpm.exe`) -> `[execPath, []]` (shell false); unset -> `['corepack', ['pnpm']]` with `shell = win32`. Read the pinned version from `package.json` `packageManager` (replaces the literal `11.27.0` at `build-web.mjs:31-32`); do not hardcode it in the helper.

**Call-site rewrite:** each of the four sites replaces its 3-line pair with `const { bin, pre, shell } = pnpmCommand();`, keeping its own `spawnSync(bin, [...pre, ...args], {...})`. Leave `spawnSync` options per site untouched (blame-clean, D-05).

---

### `scripts/pnpm-cmd.test.ts` (test, transform + repo sweep)

**Analog:** `scripts/windows-path.test.ts`

**Imports + helpers** (lines 10-17):
```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { ensureSystem32OnPath } from './lib/windows-path.mjs';

const ROOT = join(import.meta.dirname, '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
```

**Pure-branch tests** (lines 30-77): lettered cases `(a)..(f)`, each passes an injected env/platform object and asserts the return plus the mutation. Copy: one case for a `.js` path (`[process.execPath, [path]]`), one `.mjs`/`.cjs`, one `pnpm.exe` path (`[path, []]`, shell false), one unset on win32 (`corepack`, shell true), one unset on linux (shell false).

**Anti re-inline sweep** (lines 105-119): `test.each(CONFIGS)` over an explicit file list; asserts the import line is present and that, after stripping the identifier, the old literal is gone. Reuse this exactly for the four spawners:
```ts
test.each(SPAWNERS)('%s uses the helper and carries no inline pair', (p) => {
	const src = read(p);
	expect(src).toContain("from './lib/pnpm-cmd.mjs'"); // launch-audit/audit-evidence/smoke/build-web are all in scripts/
	expect(src).not.toContain('[process.execPath, [execPath]]');
});
```
Add the research-recommended global form: scan every `scripts/*.mjs` (excluding `lib/pnpm-cmd.mjs`) for `[process.execPath, [execPath]]` (RESEARCH Pitfall 1 "How to avoid"). Add the `git grep -n "11\.27\.0" -- scripts package.json` zero assertion here or in `supply-chain.test.ts` (TOOL-01 row).

**Non-vacuity:** follow `service-worker-guard.test.ts` lines 53-62 (plant, assert the fault is reported) for the sweep: feed the sweep predicate a planted source containing the old pair and assert it returns a finding. Do not assert only on the real files.

---

### `scripts/kit3-migration.test.ts` (test, batch repo grep sweep)

**Analog:** `scripts/test-lanes.test.ts` repo-sweep scaffold.

**Repo enumeration** (lines 111-139) - copy verbatim, including `-z` and the "listed but already deleted" filter:
```ts
const r = spawnSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
	cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024
});
expect(r.status, r.stderr).toBe(0);
repoPaths = r.stdout.split('\0').filter(Boolean)
	.map((p) => p.replace(/\\/g, '/'))
	.filter((p) => existsSync(join(ROOT, p)));
```
Layering to copy from the header of that file (lines 8-11): (1) sweep expects nothing, (2) non-vacuity pins prove the rule still sees a planted case, (3) pins on the mechanism. For each forbidden token (`$lib`, `$service-worker`, `$app/environment`, `$app/stores`, `@migration-task`, `svelte.config.js`): a pure `findings(path, text)` function, the sweep over tracked files, and a planted string that must be reported.

**Allowlist rule:** tests that legitimately contain old spellings as planted strings (this file, `eslint-rules.test.ts`, `kit3-migration` itself, `.planning/`, docs) go in an explicit exact-path allowlist like `TO_PASS_ALLOWLIST` (`test-lane-rules.mjs:35-38`, frozen object, count per path), not a glob.

**Template-literal hygiene** (test-lane-rules.test.ts header lines 4-5): planted sources live inside template literals so the sweep (which parses real calls) never sees them as real code.

---

### `scripts/vitest5-migration.test.ts` (test, batch repo sweep)

**Analog:** `scripts/test-lanes.test.ts` (enumeration) with `ts` parsing precedent from `scripts/lib/test-lane-rules.mjs` (`ts.createSourceFile`, `walk`).

Scoped assertion required by RESEARCH TOOL-04: for each file that imports `vitest-browser-svelte` (36 files today), every `render(` call expression is the operand of an `await`. Do it with the TypeScript AST (a `CallExpression` whose callee is the imported `render` binding, parent must be `AwaitExpression`), not a regex, so SSR `render` from `svelte/server` in the 35 node test files is out of scope by construction (the "198 call sites" figure was wrong, see RESEARCH Pitfall 5). Planted cases: a bare `render(Comp)` in a browser-test source is reported; the same call in a file importing `svelte/server` is not.

Also here: `.gitignore` contains `.vitest/` (read file, regex per line, as `windows-path.test.ts` reads sources via `read()`).

---

### `apps/web/kit.options.js` (config, transform)

**Analog:** `apps/web/svelte.config.js` (lines 1-64). The module body is the same object minus what Kit 3 removes; it is imported by `vite.config.ts` and by tests, so it must stay plugin-free (no `@sveltejs/kit/vite` import).

**Imports to keep** (svelte.config.js 1-6):
```js
import { spawnSync } from 'node:child_process';
import adapter from '@sveltejs/adapter-static';
import { resolveBasePath, resolveBuildDir } from './src/lib/base-path.js';
import { buildCsp } from './src/lib/csp-policy.js';
import { resolveBuildStamp } from './src/lib/build-stamp.js';
import { resolveAnalytics, resolveSiteOrigin } from './src/lib/site-config.js';
```
(Under Kit 3 these `./src/lib/...` relatives stay relative; they are not `$lib` imports.)

**Content that moves** (svelte.config.js 16-25, 29-62): adapter block with `pages: out, assets: out, fallback: '404.html', precompress: false, strict: true`; `paths: { base }`; `version: { name: resolveBuildStamp(process.env, readHead) }`; the `prerender` block with its comment-documented entries list; `csp: buildCsp({ analyticsHost: resolveAnalytics().host })`.

**Changes the planner must encode** (RESEARCH Pattern 2):
- `prerender.origin: resolveSiteOrigin()` (line 35) becomes `paths.origin`.
- Delete `serviceWorker: { files: ... }` (line 28); the dotfile filter moves into the worker.
- Add a JSDoc `@type` on the default export so `svelte-check` accepts `sveltekit(kitOptions)` (spike error at vite.config.ts:26).
- Keep the leading comment on line 3 of `assert-csp.mjs` and `models.test.ts:105` honest: they name `svelte.config.js` and must be re-pointed.

**Importers to re-point** (grep): `scripts/service-worker-guard.test.ts:68`, `scripts/site-url.test.ts:111` (`toContain('origin: resolveSiteOrigin()')` becomes `paths.origin` form), `apps/web/src/lib/csp-policy.test.ts`, `apps/web/src/lib/ai/models.test.ts`, comments in `scripts/assert-csp.mjs:3`.

### `apps/web/vite.config.ts` (config, modify)

**Analog:** itself. Keep the `isVitest` branch pattern (lines 14-18, 25) so Kit's plugin is not loaded under the root Vitest harness:
```ts
const isVitest = process.env.VITEST === 'true';
plugins: isVitest ? [svelte()] : [tailwindcss(), sveltekit()],
```
Kit 3 form: `sveltekit(kitOptions)` in the non-Vitest branch, importing `./kit.options.js`. Remove the `$lib` alias (lines 29) since `#lib/*` resolves natively through `package.json` `imports`; keep the `$app/paths` stub alias (lines 30-32) but point it at the rewritten stub (RESEARCH Pattern 5: `resolve = (id) => id.startsWith('/') ? id : '/' + id`, `asset = (f) => '/' + f`). The `exclude: [..., ...files('web')]` line 53 is the WR-05 behavioural-pin target (see guard section).

---

### `apps/web/src/service-worker/index.ts` (service worker, event-driven; rewritten from `src/service-worker.ts`)

**Analog:** the current `apps/web/src/service-worker.ts`, lines 18-51. Keep everything except the import and the ASSETS construction; the allowlist-only, same-origin GET, no-runtime-cache shape is what the guard test pins.

**Keep verbatim** (lines 20-21, 24-51): `const sw = self as unknown as ServiceWorkerGlobalScope;`, `const CACHE = \`tran-shell-${version}\`;`, the install `caches.open(CACHE).then((c) => c.addAll([...ASSETS]))`, the activate cleanup of other `tran-shell-` keys, and the fetch handler:
```ts
if (req.method !== 'GET') return;
const url = new URL(req.url);
if (url.origin !== sw.location.origin) return;
if (!ASSETS.has(url.pathname)) return;
event.respondWith(caches.open(CACHE).then(async (c) => (await c.match(url.pathname)) ?? fetch(req)));
```
No `skipWaiting`, no `clients.claim` (header comment lines 14-17 explains why; carry it over).

**Replace** line 18 and line 22 with (RESEARCH Pattern 3, spike-validated against `pwa.smoke.ts`):
```ts
import { version } from '$app/env';
import { assets, immutable, prerendered } from '$app/manifest';
import { resolve, asset } from '$app/paths';
const hidden = (p: string) => /(^|[\\/])\./.test(p);
const ASSETS = new Set([
  ...immutable.map((e) => resolve(e.path as never)),
  ...assets.filter((e) => !hidden(e.path)).map((e) => asset(e.path)),
  ...prerendered.map((e) => resolve(e.path as never))
]);
```
The dotfile regex `/(^|[\\/])\./` is the one already at `svelte.config.js:28`; copy it unchanged. Export the filter (or put it in a tiny `precache.ts` imported by the worker) so the guard test can call it, as it calls `serviceWorker.files` today.

**Side files:** `src/service-worker/tsconfig.json` extending `$app/tsconfig/service-worker`; `"exclude": ["src/service-worker"]` in `apps/web/tsconfig.json`; the `/// <reference>` header lines 1-4 move to whatever Kit 3 documents for the worker tsconfig. Build output must stay `build/service-worker.js` (`assert-csp.mjs` CARRIERS unchanged).

---

### `scripts/service-worker-guard.test.ts` (test, transform; rewrite)

**Analog:** itself. The REQUIRED / FORBIDDEN / `guardFaults` / non-vacuity structure stays; only the contents flip.

**Pattern to keep** (lines 14-40, 53-62):
```ts
const REQUIRED = ["from '$service-worker'", "req.method !== 'GET'", 'url.origin !== sw.location.origin', '!ASSETS.has(url.pathname)', 'tran-shell-'];
const FORBIDDEN = ['cache.put', '.put(', 'skipWaiting', 'clients.claim', 'navigationPreload', 'importScripts', '$app/service-worker', 'http://', 'https://'];
function guardFaults(source: string): string[] { ... 'missing X' / 'forbidden X' ... }
test('non-vacuity: a planted runtime cache write is caught', () => {
	const planted = `${readSw()}\nconst cache = await caches.open('x'); cache.put(req, res);\n`;
	expect(guardFaults(planted)).toContain('forbidden cache.put');
});
test('non-vacuity: dropping the cross-origin early return is caught', () => {
	const planted = readSw().replace('url.origin !== sw.location.origin', 'false');
	expect(guardFaults(planted)).toContain('missing url.origin !== sw.location.origin');
});
```

**Flips (RESEARCH Pattern 3):** REQUIRED `from '$service-worker'` becomes `from '$app/manifest'` (and `$app/env`); FORBIDDEN adds `$service-worker`. Keep the `$app/service-worker` ban. Update `SW_PATH` (line 12) to `src/service-worker/index.ts`. Do not weaken: the flip must be a replacement in both lists, not a deletion.

**Replace the `svelte.config.js serviceWorker.files` describe block** (lines 66-78). Same assertion data, new subject: import the exported filter and run the exact table:
```ts
for (const f of ['.nojekyll', 'sub/.hidden', '.well-known/x', 'sub\\.hidden']) expect(files(f), f).toBe(false);
for (const f of ['frame-guard.js', 'icons/icon-192.png', 'manifest.webmanifest']) expect(files(f), f).toBe(true);
```
Add one planted mutation: the filter given a Kit 3 `assets` entry set that includes `.nojekyll` must drop it (this is the TOOL-03 live-only failure mode, `cache.addAll` rejects when a dotfile 404s).

Keep the OSM tile block (lines 80-109) unchanged except `readSw()` path; its `sw.indexOf('url.origin !== sw.location.origin') < sw.indexOf('respondWith')` ordering check must still hold.

---

### `scripts/smoke.mjs` 429 relabel + `scripts/smoke.test.ts` (script / test, request-response)

**Analog:** `scripts/smoke.mjs` already separates pure seams from the CLI so tests can import it ("Importing the module must never run its CLI", smoke.test.ts line 2; CLI guard at smoke.mjs 319). There is no existing exit-code classifier, so this is a partial match: copy the seam *style* of `staleBuilds` (pure, injectable reader, returns data) and `waitForVersion` (injected `get`, never exits the process).

**Where the exit code is decided today:** `runPlaywright` returns `r.status ?? 1` (smoke.mjs 170-182); `remote()` returns it directly (line 224); `local()` maps `!ok` to `1` (line 311). Exit-code contract is documented in the header, lines 12-13, and the new meaning must be added there:
```
// Exit codes: 0 ok, 1 suite failed, 2 precondition (env, stale/missing build, emulator),
// 3 version not propagated, 4 over the 5-minute budget.
```

**Pattern to add:** a pure exported function, e.g. `classifySuiteExit(status, evidence)`, where `evidence` is whatever the run can report about 429 (a Playwright JSON/line reporter result, or a marker the fixture writes). Return `2` when any navigation answered 429 (message "CDN rate-limited, re-dispatch once"), otherwise pass `status` through (500 stays 1). `remote()` applies it; `local()` has no CDN, but must keep its own semantics unchanged. The detection source (fixtures `page.on('response')` / `context.on('response')` collecting 429 on navigations, mirroring how `fixtures.ts` already records requests with `context.on('request', ...)` at lines 39-46) is the planner's choice; the unit-testable seam is the classifier.

**Test to add (copy structure of `waitForVersion` tests, smoke.test.ts 140-172):** the `vi.fn()` injection style:
```ts
const get = vi.fn().mockResolvedValue({ status: 200, body: JSON.stringify({ version: HEAD }) });
await expect(waitForVersion(BASE, HEAD, { get, timeoutMs: 50, everyMs: 5 })).resolves.toBe('ok');
```
New cases: planted 429 evidence with suite status 1 -> `2`; planted 500 evidence with status 1 -> `1`; no evidence and status 0 -> `0`; 429 evidence but status 0 (nothing failed) -> `0` (do not relabel a green run). Header comment of the test file (lines 1-2) should gain the 429 mention. This is a mutation-test candidate: swap `429` for `500` in the classifier and the planted-429 case must fail.

**Zero retries:** `playwright.smoke.config.ts` line 20 `retries: 0` and `PINNED_RETRIES['apps/web/playwright.smoke.config.ts'] = '0'` (`test-lane-rules.mjs:44`) stay; D-03.

### Pacing (`apps/web/playwright.smoke.config.ts`, `apps/web/tests/smoke/fixtures.ts`)

**Analog:** the config itself. Existing shape for conditional behaviour: `workers: process.env.CI ? 2 : 4` (line 22) and the single `use:` block (lines 25-30). RESEARCH Pitfall 8 recommends `serviceWorkers: 'block'` for specs that are not about the worker; the idiom is a `test.use({ serviceWorkers: 'block' })` per spec or a fixture default, with `pwa.smoke.ts` and `assets.smoke.ts` (which call `installedPrecache` from `fixtures.ts`) left on `'allow'`. Live-only spacing must key off a non-loopback `SMOKE_BASE_URL` (parsed by `tests/smoke/env.js`), never the local emulator, which must stay ~30 s per target.

Hazards for the planner (guard interaction): any pacing delay is a hidden wait the Phase 15 guard may flag (`waitForTimeout`, `toPass`, raised timeouts). Prefer reducing requests (blocking the worker) over adding waits; if a delay is unavoidable, make it a config-level worker count/`fullyParallel` change, not a sleep in specs. `workers: process.env.CI ? 2 : 4` is also 15-REVIEW WR-07; do not touch for the local run.

---

### `scripts/lib/test-lane-rules.mjs` guard additions (utility, transform)

**Analog:** itself. The pure-function-over-`{path, text}` design, the AST helpers and the `Finding` shape are the pattern; every addition is a new branch plus a new test case.

**CR-01: `timeout: 0`.** Defect is in `isRaised` (line 150) and `numberOf` (146-147): `0` is a numeric literal not above any default, so it passes every rule, yet Vitest treats `0` as "no timeout" (and Playwright treats `0` as unlimited). Fix at the one choke point:
```js
const numberOf = (n) => n !== undefined && ts.isNumericLiteral(n) ? Number(n.text.replace(/_/g, '')) : null;
const isRaised = (value, max) => value === null || value > max;   // add: || value <= 0
```
`isRaised` is used by `vitestRaiseSites` (line 402), `playwrightTimeoutFindings` (537, 555) and `configTimeoutFindings` (589), so one change covers all four; the tests must prove each caller, not just the helper.

**WR-02: shorthand/reference options.** `propOf` (233-242) already handles shorthand `{ timeout }` (returns the identifier, which `numberOf` treats as non-literal = raised). The gap is an object passed by reference: `test('a', opts, fn)` / `expect.poll(f, opts)` where `opts` is an `Identifier` and is never inspected, because `vitestRaiseSites` only branches on `ts.isObjectLiteralExpression(a)` (lines 428-436 and 417-421). Add an `else if (ts.isIdentifier(a))` (or spread element) branch that pushes a raised site (fail closed, consistent with the file header "Non-literal timeout values always count as raised"). Same for `retries` references in `retryFindings` (651+): inspect how it reads the `retries` property and add the by-reference case.

**WR-03: timeout-raising APIs outside the rule set.** The rule tables are `WAITS` (line 72), `HOOKS` (71), `TEST_ROOTS`/`TEST_MODIFIERS`, and `vi.setConfig` (special-cased at line 415). Add names to the same sets/branches rather than inventing a new mechanism: `page.setDefaultTimeout`, `page.setDefaultNavigationTimeout`, `testInfo.setTimeout`, `testInfo.slow`, `test.slow` (already always flagged for Playwright, per the JSDoc at line 494), and Vitest `vi.setConfig`-style siblings. Dedicated Playwright branch lives in `playwrightTimeoutFindings` (500-570); copy its `report(site, prop, value, detail)` closure (506-516).

**WR-04: `tooling/vitest/lanes.ts` and runner CLI flags outside the sweep.** `fileKind` (116-128) decides what the sweep sees; `tooling/vitest/lanes.ts` falls through every branch (not under `PROJECTS`, not `vite*.config.ts`) and returns `null`. Add a branch above `return null`, in the style of the `playwright-config` line (118):
```js
if (/(^|\/)playwright[\w.-]*\.config\.ts$/.test(path)) return 'playwright-config';
if (/(^|\/)vite(?:st)?(?:\.[\w-]+)*\.config\.ts$/.test(path)) return 'vitest-config';
```
and scan its `serialTest()` return (`lanes.ts:112-121`) with `configTimeoutFindings`/`retryFindings`. For CLI flags copy `RETRY_FLAG` (line 74, `/--retr(?:y|ies)\b/`) and its package.json/workflow/script-mjs scanners (`packageJsonRetries` at 731): add `--testTimeout`, `--timeout`, `--workers`, `--retry` (RESEARCH Pitfall 9) using the same regex-then-line-number structure, plus `continue-on-error` and `|| true` re-run patterns on test steps in workflows.

**WR-05 (RESEARCH extra):** replace the `toContain("files('web')")` substring pin with a behavioural import of the config that asserts `exclude` contains every `files(lane)` entry. Analog for "import the real config and call it": `service-worker-guard.test.ts:67-77` (`await import('../apps/web/svelte.config.js')`).

**WR-08 (RESEARCH extra):** `VITEST_MAX_WORKERS` refusal moved into `serialTest()`; the constant `MAX_WORKERS = process.env.CI ? 3 : 8` is at `lanes.ts:129`.

---

### `scripts/test-lane-rules.test.ts` mutation-tested planted-bypass cases (test, transform)

**Analog:** itself, lines 330-470. This file *is* the mutation test harness: every bypass is a template-literal source, fed to one rule function, and compared against `[rule, line]` pairs through the `rl` helper.

**Helpers to reuse** (lines 24-50):
```ts
const rl = (findings: Finding[]) => findings.map((f) => [f.rule, f.line]);
const NODE: Lane = { project: 'core', serial: false, browser: false };
const BROWSER: Lane = { project: 'web-browser', serial: false, browser: true };
const SERIAL_NODE: Lane = { project: 'web', serial: true, browser: false };
const VT = 'packages/core/src/z.test.ts';
const PW = 'apps/web/tests/e2e/x.spec.ts';
const NOTE = '// Timeout: measured 13.5 s in a full run.\n// Cause: cold ESLint parser.\n';
```

**Case shape to copy** (lines 330-333, one rule, one planted source, one expectation, outside-serial label `OUT = 'raised-timeout-outside-serial'`):
```ts
test('treats an arithmetic value as raised', () => {
	const src = `test('a', { timeout: ROUTES.length * 4_000 }, () => {});`;
	expect(rl(vitestTimeoutFindings(VT, src, NODE))).toEqual([[OUT, 1]]);
});
```

**Cases to add (each is a planted bypass the rule must now flag; pair each with a negative control as the file does at 345-367):**
- CR-01: `test('a', { timeout: 0 }, () => {});` -> `[[OUT, 1]]` in NODE; `test('a', () => {}, 0);` (trailing); `expect.poll(f, { timeout: 0 })`; Playwright `test.setTimeout(0)` and `{ timeout: 0 }` option via `playwrightTimeoutFindings(PW, ...)`; config `testTimeout: 0` via `configTimeoutFindings(VCFG, ...)`.
- WR-02: `const opts = { timeout: 30_000 }; test('a', opts, () => {});` and shorthand `{ timeout }`; `retries` passed by reference to `retryFindings`.
- WR-03: `page.setDefaultTimeout(60_000)`, `testInfo.setTimeout(...)`, `testInfo.slow()`.
- WR-04: `fileKind('tooling/vitest/lanes.ts')` is no longer `null`; planted `serialTest` return with `testTimeout: 60_000` or `retry: 2` is flagged; package.json/workflow lines `--testTimeout=60000`, `--retry=2`, `--workers=1` flagged.
- Prettier-wrapped variants (`expect\n\t.poll(...)`, copy lines 358-396) for every new callee name, since 15-06 found raises hidden that way.

**Mutation proof the 16-00 summary must record:** for each added rule, revert the one-line fix and show the planted case fails, as the repo already does for concurrency guards (CONTEXT code_context "mutation-tested"). Planted sources stay in template literals so the repo sweep in `scripts/test-lanes.test.ts` never counts them (header lines 4-5).

---

### `scripts/eslint-rules.test.ts` + `eslint.config.js` (test / config, transform)

**Analog:** `scripts/eslint-rules.test.ts` itself. Fixtures are in-memory strings linted through `lintText` against a virtual path, never written to disk.

**Harness** (lines 5-45, copy exactly for any new case):
```ts
const eslint = new ESLint({ cwd: repoRoot, overrideConfig: [{ files: ['**/*.svelte', ...], languageOptions: { parserOptions: { projectService: false, project: null } } }] });
async function lint(filePath: string, code: string): Promise<Message[]> {
	const results = await eslint.lintText(code, { filePath: resolve(repoRoot, filePath), warnIgnored: false });
	...
}
const errorsFor = (messages: Message[], ruleId: string) => messages.filter((m) => m.ruleId === ruleId);
const expectNoParseErrors = (messages) => expect(messages.filter((m) => m.ruleId === null)).toEqual([]);
```

**Fixture + assertion shape** (lines 50-56 fixture, 111-118 and 154-160 assertions):
```ts
const crossPortalImport = `import { analyze } from '$lib/features/investor/analyzer';\n\nexport const renterView = () => analyze();\n`;
const messages = await lint(`${WEB}/routes/(app)/renter/__lintfix__/cross-import.ts`, crossPortalImport.replace('investor/analyzer', 'agent/crm'));
expect(errorsFor(messages, 'no-restricted-imports').length).toBeGreaterThanOrEqual(1);
```
Allowlist control (lines 162-168): `sharedImport` must produce `ruleIds(messages) == []`.

**Migration change (RESEARCH Pattern 4):** every `'$lib/...'` fixture (about 60) becomes `'#lib/...'`. In `eslint.config.js` the `no-restricted-imports` `group` globs must be written `'\\#lib/data/**'` and `'!\\#lib/data/tables'` because a leading `#` is a gitignore comment and the group silently matches nothing. The existing assertions (`errorsFor(...).length >= 1`) already fail if a group goes vacuous, as long as the fixtures are migrated *and* each boundary still has a "must report" fixture. Add the explicit non-vacuity case from RESEARCH: a test that reads `eslint.config.js` text (or the resolved config) and fails if any `no-restricted-imports` group begins with an unescaped `#lib`.

**Also planted (RESEARCH Pitfall 6, `eslint-plugin-svelte` bump):** a bare `<a href="/x">` in a `.svelte` fixture must report `svelte/no-navigation-without-resolve` under Kit 3, using the `plainSvelteFetch`/`marketingViolations` fixture style (lines 38-48).

**Regex-over-source boundary tests that need new spelling plus planted cases** (RESEARCH anti-patterns): `apps/web/src/lib/features/investor/data/investor-port.test.ts:310`, `.../analyzer/analyzer-page.svelte.test.ts:68`, `apps/web/src/lib/ai/ui/key-card-additions.test.ts:149-151`, `apps/web/src/lib/features/studio/boundaries.test.ts`, `no-auto-send.test.ts:163` (`startsWith('$lib/')`), `tooling/import-graph.ts:38`, `apps/web/src/lib/ai/import-graph.ts:38`. For each, add a planted `#lib/data/x.ts` import and assert the test's own predicate reports it.

---

### `docs/test-evidence/<new YYYY-MM-DD>.md` (doc) + `scripts/test-evidence.test.ts` (test)

**Analog:** `docs/test-evidence/2026-11-10.md` (93 lines). The new Vitest 5 file copies its section structure exactly because `scripts/test-evidence.test.ts` parses it by heading prefix and table position.

**Required skeleton** (what `checkEvidence` reads, test-evidence.test.ts 61-90+):
```
HEAD: `<7-40 hex sha>` on `main`. Machine: ..., Node ..., pnpm 12.x, Vitest 5.x, Playwright ...
## Worker caps
## 1. Three consecutive pnpm verify runs      -> first table, rows "1","2","3", column index 3 (Exit) === '0'
## 2. Repeat-each 3 on load-sensitive specs   -> first table: one row per LOAD_SENSITIVE_SPECS entry, col1 'root, sub', col2 passed >= 6, col3 '0', col4 '0'
### Vitest serial lane, three consecutive runs (second table in section 2)
## 3. Full E2E under CPU pressure
## 4. Shuffled unit run
## 5. CI observation
## Attempts
```
Row templates to copy: section 1 row (line 18) `| 1 | 2026-11-10T17:11:46Z | 2026-11-10T17:39:33Z | 0 | Test Files 365 passed (365); Tests 7175 passed (7175) | root+sub+configured: 2350 passed, 4 skipped (20.1m); smoke 121 passed x3; ext 13 passed, 7 passed |`; section 2 row (line 30) `| app-notice.spec.ts | root, sub | 36 | 0 | 0 |`; the serial-lane command is `pnpm vitest run --project "*-serial"`.

**Test behaviour to preserve:** `newestEvidenceFile()` (lines 14-21) sorts `YYYY-MM-DD.md` names and takes the last, so the new file *becomes* the pinned one the moment it is committed; the file must be complete in the same commit. If the pre-existing dated file is kept, its 2026-11-10 content stays as history but is no longer the checked one. If the Vitest 5 run produces different counts (files/tests), nothing in `checkEvidence` hardcodes 365/7175, so no test edit is needed unless a new check is added. Must record the measured protocol facts only (RESEARCH: Phase 15 rules), including host WLAN 8003 gate lines as at line 5, and an Attempts row for any failed run with root cause and "None in code" or the fix commit, per rows 91-93.

---

### `scripts/supply-chain.test.ts` lockfile test (test, transform; rewrite)

**Analog:** itself, lines 176-181:
```ts
describe('lockfile', () => {
	test('pnpm-lock.yaml is a single YAML document', () => {
		const lock = read('pnpm-lock.yaml');
		expect(lock).toMatch(/^lockfileVersion:/m);
		expect(lock.split('\n').filter((l) => l.trimEnd() === '---')).toEqual([]);
	});
});
```
RESEARCH Pitfall 2: pnpm 12 writes two documents (boot document with `packageManagerDependencies`, then the real one; second document byte-identical to today's lockfile). Rewrite keeping the same `read()` + split-on-`---` mechanics: assert exactly two documents, first contains `packageManagerDependencies`, the *last* holds the project `importers` (`apps/web`, `apps/extension`, `packages/*`), no third document. `yaml` is not a dependency; do not add one. Also here: expected audit-exception count moves 5 -> 2 and `AUDIT_EXCEPTIONS` (`scripts/lib/audit-exceptions.mjs`) and `pnpm-workspace.yaml audit.ignore` must stay equal (the existing equality test is the analog, not to be weakened). `scripts/launch-audit.test.ts:250` carries a `pnpm: '11.27.0'` literal; read it from `package.json` instead.

---

## The `$lib` -> `#lib` codemod (~1,060 imports in ~445 files): describe once

**Not a file analog; a procedure with a known failure catalogue.** Mechanism: `npx sv@1.3.0 migrate sveltekit-3 --cwd apps/web --tasks lib-alias --no-install --confirm`, run as its own task group on a clean tree and committed on its own (D-05 blame-clean: only the codemod's output in that commit). Never `--tasks all` (the `svelte-config` task crashes on this repo, RESEARCH Anti-Patterns). The codemod rewrites imports with the per-target extension (`.ts`, `.js`, `.svelte`).

**Hand-fix commit afterwards, in this order of visibility** (RESEARCH Pitfall 3): (a) 2 dynamic imports `Promise.all([import('#lib/...'), import('$lib/storage/db')])` in `routes/(app)/settings/+page.svelte:61` and `routes/(app)/setup/rentcast/+page.svelte:90`; (b) directory modules the extension probe mis-resolved (`#lib/storage/secrets.ts` for `secrets/index.ts`); (c) ~10 `typeof import('#lib/storage/backup')` type queries in `AppNotice.svelte` and `BackupSection.svelte`; (d) 14 `resolve('/...')` calls (`resolve('/')` -> `resolve('')`, `resolve('/x/')` -> `resolve('x/')`; route IDs with `(group)` keep the slash); (e) `page.url` readonly sites `SearchPage.svelte:58`, `(app)/+layout.svelte:72`. Gate per group: `pnpm check` + a build + the narrowest relevant `vitest run`.

**Non-codemod `$lib` users** (the codemod does not touch strings/config; each needs a planted-case proof): `eslint.config.js`, `apps/web/components.json`, `tooling/import-graph.ts`, `apps/web/src/lib/ai/import-graph.ts`, the Vitest alias block in `apps/web/vite.config.ts` and `vitest.browser.config.ts`, the boundary tests listed above, and `scripts/eslint-rules.test.ts` samples. The final proof of completeness is `scripts/kit3-migration.test.ts` returning zero hits.

---

## Shared Patterns

### Plant-and-prove (non-vacuity), applies to every new guard
**Source:** `scripts/service-worker-guard.test.ts:53-62`; `scripts/test-lane-rules.test.ts:330-333`; `scripts/test-evidence.test.ts` header lines 1-4 ("each check is proven non-vacuous by deleting that row from an in-memory copy").
Each new rule or sweep gets (1) the real-tree assertion, (2) a planted violation that must be reported, (3) a negative control that must stay silent. A green suite alone is not accepted (CONTEXT code_context, memory: mutation-test guards).

### Repo-wide sweep scaffold
**Source:** `scripts/test-lanes.test.ts:111-139` (`git ls-files -z --cached --others --exclude-standard`, `existsSync` filter, read once in `beforeAll`).
**Apply to:** `scripts/kit3-migration.test.ts`, `scripts/vitest5-migration.test.ts`, any new "zero occurrences" gate.

### Shared helper + "no inline copy survives" test
**Source:** `scripts/lib/windows-path.mjs` + `scripts/windows-path.test.ts:105-119`.
**Apply to:** `scripts/lib/pnpm-cmd.mjs` and its four callers.

### Source read helper
**Source:** `scripts/windows-path.test.ts:13`: `const read = (p) => readFileSync(join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');` (CRLF normalised; the repo is on Windows). Use for every text-pin test.

### Pure functions with injectable I/O; CLI behind an entrypoint guard
**Source:** `scripts/smoke.mjs` exports `localTargets`, `readStamp(dir)`, `staleBuilds(targets, head, read = readStamp)`, `waitForVersion(base, expected, { get })`, and runs the CLI only under `if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)` (line 319).
**Apply to:** any new smoke logic (429 classifier) and `pnpm-cmd.mjs`.

### Fail closed on what cannot be proven
**Source:** `scripts/lib/test-lane-rules.mjs` header lines 8-11 and `numberOf` (146-147): non-literal values always count as raised.
**Apply to:** CR-01, WR-02, WR-03 additions. A new unrecognised form is a finding, not a pass.

### Template-literal planted sources
**Source:** `scripts/test-lane-rules.test.ts` lines 4-5. Planted violating code lives in strings so the repo sweep never reads it as real code. Also required for planted `$lib` strings in `eslint-rules.test.ts` and `kit3-migration.test.ts` (allowlisted by exact path).

### Zero retries, no hidden waits
**Source:** `apps/web/playwright.smoke.config.ts:20` (`retries: 0`, `failOnFlakyTests: true`), `PINNED_RETRIES` (`test-lane-rules.mjs:41-45`), `smoke.mjs:313` message "fix the cause, never raise timeouts".
**Apply to:** 16-00 pacing, every migration plan's test fixes (Vitest 5 `expect.poll` behaviour changes are the temptation, Pitfall 9).

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| exit-code classifier for 429 in `scripts/smoke.mjs` (new function) | utility | request-response | No existing function maps a Playwright result to an exit code beyond `r.status ?? 1`; copy the pure-seam *style* of `staleBuilds`/`waitForVersion`, design the evidence channel from RESEARCH Pitfall 8 |
| `src/service-worker/tsconfig.json`, `$app/manifest` imports | config | event-driven | Kit 3 only; use RESEARCH Pattern 3 and Kit 3.1.1 docs |
| Kit 3 budget trim (4.2 KB gz) | n/a | n/a | No code analog; forensic task per RESEARCH Pitfall 4; budget not raised (D-04), escalate if blocked |
| `apps/web/src/lib/testing/app-paths.stub.ts` rewrite | test support | transform | Existing stub is the file to change; target semantics are RESEARCH Pattern 5 (not read here; exports `base`, `assets`, `resolve = path => path` today) |

## Metadata

**Analog search scope:** `scripts/`, `scripts/lib/`, `apps/web/` (configs, `src/service-worker.ts`, `tests/smoke/`), `tooling/vitest/lanes.ts`, `docs/test-evidence/`, `.planning/phases/15-*/deferred-items.md`
**Files read for excerpts:** build-web.mjs, smoke.mjs, smoke.test.ts, service-worker.ts, service-worker-guard.test.ts, svelte.config.js, vite.config.ts, lib/test-lane-rules.mjs (lines 1-520), test-lane-rules.test.ts (1-470), eslint-rules.test.ts (1-170), test-lanes.test.ts (1-135), windows-path.mjs, windows-path.test.ts, supply-chain.test.ts (150-181), test-evidence.test.ts (1-90), docs/test-evidence/2026-11-10.md, playwright.smoke.config.ts, tests/smoke/{fixtures,third-party,pwa}.ts (heads)
**Not read (planner should open when editing):** `test-lane-rules.mjs` 520-829 (`configTimeoutFindings`, `retryFindings`, `packageJsonRetries`, `scanFile`), `tooling/vitest/lanes.ts` beyond 112-137, `eslint.config.js`, `apps/web/src/lib/testing/app-paths.stub.ts`
**Pattern extraction date:** 2026-11-10
