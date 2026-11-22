// Smoke orchestrator (SMOKE-01). Runs the read-only smoke suite (apps/web/playwright.smoke.config.ts)
// against a deployed origin, or against the local GitHub Pages emulator for all three builds.
//
//   pnpm smoke                       remote: SMOKE_BASE_URL + SMOKE_EXPECT_VERSION (+ SMOKE_SITE_URL,
//                                    SMOKE_ANALYTICS_HOST) from the env; waits up to 10 minutes for
//                                    <base>_app/version.json to report the expected SHA, then runs
//   pnpm smoke:local                 local: checks every build dir carries HEAD's stamp, starts
//                                    scripts/serve-pages.mjs, runs root, sub and configured in turn
//   ... --target <root|sub|configured>   (local, repeatable) run only the named targets
//   ... -- <args>                    passed through to `playwright test`
//
// Exit codes: 0 ok, 1 suite failed, 2 precondition (env, stale/missing build, emulator) or a 429 on
// any smoke request (CDN rate-limited, re-dispatch once), 3 version not propagated, 4 over the
// 5-minute budget.
//
// Superseded (exit 0 with a ::notice::, chained workflow_run runs only): when the origin serves a
// different commit that GitHub's compare API reports as ahead of the expected one, this commit is
// not smoked, because the newer commit's own live-smoke judges it. Anything else stays red.
//
// Dependency-free: node: builtins only (the repo bans bare fetch).
import { spawn, spawnSync } from 'node:child_process';
import { appendFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { resolveBasePath } from '../apps/web/src/lib/base-path.js';
import { resolveAnalytics, resolveSiteOrigin } from '../apps/web/src/lib/site-config.js';
import { parseSmokeEnv } from '../apps/web/tests/smoke/env.js';
import { TARGETS, targetEnv } from './lib/build-targets.mjs';
import { pnpmCommand } from './lib/pnpm-cmd.mjs';

const REPO = path.resolve(import.meta.dirname, '..');
const BUDGET_S = 300;
// The live suite stays under this many requests; changing it requires re-measuring and updating docs/RUNBOOK.md.
export const LIVE_REQUEST_CEILING = 1600;

/**
 * @typedef {{ name: string, baseUrl: string, siteUrl: string, analyticsHost: string, dir: string }} LocalTarget
 */

/**
 * The three emulated targets, in TARGETS order: where serve-pages serves each build, which site
 * URL and analytics host it was built with, and its build dir (repo-relative).
 * @param {Record<string, string | undefined>} [env]
 * @returns {LocalTarget[]}
 */
export function localTargets(env = process.env) {
	const ports = {
		root: Number(env.E2E_PORT_ROOT ?? 4273),
		sub: Number(env.E2E_PORT_SUB ?? 4274),
		configured: Number(env.E2E_PORT_CONFIGURED ?? 4276)
	};
	return TARGETS.map((name) => {
		const overlay = targetEnv(name, env);
		// tests/e2e/site-env.ts rule: root = this env, the others = env + the target overlay.
		const e = name === 'root' ? env : { ...env, ...overlay };
		const port = ports[/** @type {'root' | 'sub' | 'configured'} */ (name)];
		// Every overlay carries BASE_PATH ('' | '/tran_real_estate' | the root knob, D-02), so the
		// emulator mount and the smoke base URL come from the same table serve-pages.mjs reads.
		const base = resolveBasePath({ ...env, ...overlay }) + '/';
		return {
			name,
			baseUrl: `http://127.0.0.1:${port}${base}`,
			siteUrl: resolveSiteOrigin(e) + resolveBasePath(e) + '/',
			analyticsHost: resolveAnalytics(e).host,
			dir: `apps/web/${overlay.BUILD_DIR}`
		};
	});
}

/**
 * The build stamp a build dir carries (<dir>/_app/version.json `version`).
 * @param {string} dir absolute, or relative to the repo root
 * @returns {string}
 */
export function readStamp(dir) {
	const file = path.resolve(REPO, dir, '_app', 'version.json');
	let text;
	try {
		text = readFileSync(file, 'utf8');
	} catch {
		const err = new Error(`no build stamp at ${file}`);
		err.name = 'MissingBuildStamp';
		throw err;
	}
	const version = JSON.parse(text).version;
	if (typeof version !== 'string') {
		const err = new Error(`build stamp at ${file} has no version string`);
		err.name = 'MissingBuildStamp';
		throw err;
	}
	return version;
}

/**
 * One message per target whose build is missing or not stamped with `head`. Pure.
 * @param {Pick<LocalTarget, 'name' | 'dir'>[]} targets
 * @param {string} head
 * @param {(dir: string) => string} [read]
 * @returns {string[]}
 */
export function staleBuilds(targets, head, read = readStamp) {
	/** @type {string[]} */
	const out = [];
	for (const t of targets) {
		let stamp;
		try {
			stamp = read(t.dir);
		} catch {
			stamp = 'none';
		}
		if (stamp !== head) {
			out.push(
				`smoke: ${t.dir} is missing or stale (stamp ${stamp}, HEAD ${head}); rebuild: pnpm build:${t.name}`
			);
		}
	}
	return out;
}

/**
 * GET with caching disabled; resolves { status, body }, rejects on a network error or timeout.
 * @param {string} url
 * @param {Record<string, string>} [headers] extra request headers
 * @returns {Promise<{ status: number, body: string }>}
 */
export function httpGet(url, headers = {}) {
	return new Promise((resolve, reject) => {
		const req = (url.startsWith('https:') ? https : http).get(
			url,
			{ headers: { 'cache-control': 'no-cache', ...headers } },
			(res) => {
				let body = '';
				res.setEncoding('utf8');
				res.on('data', (c) => (body += c));
				res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
				res.on('error', reject);
			}
		);
		req.setTimeout(10_000, () => req.destroy(new Error(`timeout fetching ${url}`)));
		req.on('error', reject);
	});
}

const SHA = /^[0-9a-f]{40}$/;

/**
 * What a served version means for a smoke that expects `expected`. Pure, and fail-closed: only an
 * explicit `ahead` from the compare lookup for a different 40-hex SHA is superseded. Behind
 * (propagation lag or a rollback), diverged, identical, a failed lookup and a non-SHA are pending.
 * @param {string} expected
 * @param {unknown} served
 * @param {unknown} compareStatus status of `expected...served` from the compare lookup, or null
 * @returns {'ok' | 'superseded' | 'pending'}
 */
export function classifyServed(expected, served, compareStatus) {
	if (served === expected) return 'ok';
	if (typeof served === 'string' && SHA.test(served) && compareStatus === 'ahead') {
		return 'superseded';
	}
	return 'pending';
}

/**
 * The `status` GitHub's compare API reports for `base...head` (`ahead` means head is newer), or
 * null on any failure. Both SHAs and the repository are validated before a URL is built, because
 * `head` comes from a served file. The token travels in the Authorization header only.
 * @param {string | undefined} repo owner/name
 * @param {string} base
 * @param {string} head
 * @param {string | undefined} token
 * @param {(url: string, headers?: Record<string, string>) => Promise<{ status: number, body: string }>} [get]
 * @returns {Promise<string | null>}
 */
export async function githubCompare(repo, base, head, token, get = httpGet) {
	if (!repo || !/^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(repo)) return null;
	if (!SHA.test(base) || !SHA.test(head)) return null;
	/** @type {Record<string, string>} */
	const headers = { 'user-agent': 'live-smoke', accept: 'application/vnd.github+json' };
	if (token) headers.authorization = `Bearer ${token}`;
	try {
		const r = await get(`https://api.github.com/repos/${repo}/compare/${base}...${head}`, headers);
		if (r.status !== 200) return null;
		const status = JSON.parse(r.body).status;
		return typeof status === 'string' ? status : null;
	} catch {
		return null;
	}
}

/**
 * The compare lookup for a run, or null when superseded detection is off. It is on only for a
 * chained run (GITHUB_EVENT_NAME is workflow_run) that has a repository and a token; a dispatch,
 * a local run or a missing token keeps the red path.
 * @param {Record<string, string | undefined>} env
 * @param {string} expected
 * @param {Parameters<typeof githubCompare>[4]} [get]
 * @returns {((served: string) => Promise<string | null>) | null}
 */
export function supersededLookup(env, expected, get = httpGet) {
	if (env.GITHUB_EVENT_NAME !== 'workflow_run') return null;
	if (!env.GITHUB_REPOSITORY || !env.GITHUB_TOKEN) return null;
	return (served) => githubCompare(env.GITHUB_REPOSITORY, expected, served, env.GITHUB_TOKEN, get);
}

/**
 * One cache-busted read of <base>_app/version.json: its version string, or null on any failure
 * (a network error, a non-200, a Pages 404 page or a CDN error body that is not JSON).
 * @param {string} base
 * @param {string} expected
 * @param {(url: string) => Promise<{ status: number, body: string }>} get
 * @returns {Promise<string | null>}
 */
async function servedVersion(base, expected, get) {
	try {
		const r = await get(`${base}_app/version.json?_=${expected}-${Date.now()}`);
		const version = r.status === 200 ? JSON.parse(r.body).version : null;
		return typeof version === 'string' ? version : null;
	} catch {
		return null;
	}
}

/**
 * The newer SHA when `served` supersedes `expected`, else null. A lookup that throws counts as
 * no answer. `asked` keeps one answer per served SHA.
 * @param {string} expected
 * @param {string | null} served
 * @param {((served: string) => Promise<string | null>) | undefined} compare
 * @param {Map<string, string | null>} [asked]
 * @returns {Promise<string | null>}
 */
async function supersededBy(expected, served, compare, asked = new Map()) {
	if (!compare || !served || served === expected || !SHA.test(served)) return null;
	if (!asked.has(served)) {
		asked.set(
			served,
			await Promise.resolve()
				.then(() => compare(served))
				.catch(() => null)
		);
	}
	return classifyServed(expected, served, asked.get(served)) === 'superseded' ? served : null;
}

/**
 * Poll <base>_app/version.json (cache-busted) until it reports `expected`. Never exits the process.
 * With `compare` (absent by default: no network lookup), a different served SHA that compares
 * ahead ends the poll with 'superseded'; the lookup is asked once per distinct served SHA.
 * @param {string} base origin + base path, with a trailing slash
 * @param {string} expected
 * @param {{ timeoutMs?: number, everyMs?: number, get?: (url: string) => Promise<{ status: number, body: string }>, compare?: (served: string) => Promise<string | null>, onSuperseded?: (served: string) => void }} [opts]
 * @returns {Promise<'ok' | 'timeout' | 'superseded'>}
 */
export async function waitForVersion(
	base,
	expected,
	{ timeoutMs = 600_000, everyMs = 15_000, get = httpGet, compare, onSuperseded } = {}
) {
	const deadline = Date.now() + timeoutMs;
	/** @type {Map<string, string | null>} */
	const asked = new Map();
	for (;;) {
		const served = await servedVersion(base, expected, get);
		if (served === expected) return 'ok';
		const newer = await supersededBy(expected, served, compare, asked);
		if (newer) {
			onSuperseded?.(newer);
			return 'superseded';
		}
		if (Date.now() >= deadline) return 'timeout';
		await new Promise((s) => setTimeout(s, everyMs));
	}
}

/**
 * After a failed suite: one fresh read of version.json. Returns the newer served SHA when it
 * supersedes `expected` (a newer commit deployed mid-run), else null; every failure is null.
 * @param {string} base
 * @param {string} expected
 * @param {{ get?: (url: string) => Promise<{ status: number, body: string }>, compare?: (served: string) => Promise<string | null> }} [opts]
 * @returns {Promise<string | null>}
 */
export async function checkSuperseded(base, expected, { get = httpGet, compare } = {}) {
	return supersededBy(expected, await servedVersion(base, expected, get), compare);
}

/**
 * Map a finished suite's exit status and the number of recorded 429 responses to the exit code.
 * A green run is never relabelled; a failed run with 429 evidence is the Pages CDN rate-limiting
 * the runner (exit 2, re-dispatch once); any other failure keeps its status.
 * @param {number} status
 * @param {number} rateLimitedCount
 * @returns {number}
 */
export function classifySuiteExit(status, rateLimitedCount) {
	if (status === 0) return 0;
	return rateLimitedCount > 0 ? 2 : status;
}

/**
 * Count the evidence lines (one URL per 429 response) in the SMOKE_429_LOG text.
 * @param {string | undefined} text
 * @returns {number}
 */
export function countRateLimited(text) {
	if (!text) return 0;
	return text.split('\n').filter((l) => l.trim() !== '').length;
}

/**
 * Run the smoke Playwright config through the pinned pnpm (scripts/build-web.mjs pattern).
 * @param {string[]} passthrough
 * @param {Record<string, string | undefined>} env
 * @returns {number}
 */
function runPlaywright(passthrough, env) {
	const { bin, pre, shell } = pnpmCommand();
	const args = [
		...pre,
		...['--filter', 'web', 'exec', 'playwright', 'test', '-c', 'playwright.smoke.config.ts'],
		'--fail-on-flaky-tests',
		...passthrough
	];
	const r = spawnSync(bin, args, { stdio: 'inherit', env, shell, cwd: REPO });
	return r.status ?? 1;
}

/** @param {string[]} argv */
function parseArgs(argv) {
	const dash = argv.indexOf('--');
	const own = dash === -1 ? argv : argv.slice(0, dash);
	const passthrough = dash === -1 ? [] : argv.slice(dash + 1);
	const local = own.includes('--local');
	/** @type {string[]} */
	const targets = [];
	for (let i = 0; i < own.length; i++) {
		if (own[i] !== '--target') continue;
		const v = own[i + 1];
		if (!v || !TARGETS.includes(v)) {
			throw new Error(`--target needs one of ${TARGETS.join('|')} (got ${JSON.stringify(v)})`);
		}
		targets.push(v);
		i++;
	}
	return { local, targets, passthrough };
}

/** @param {string[]} passthrough */
async function remote(passthrough) {
	let smoke;
	try {
		smoke = parseSmokeEnv(process.env);
	} catch (e) {
		console.error(`smoke: ${/** @type {Error} */ (e).message}`);
		return 2;
	}
	// Pitfall 3: measure how long the deploy takes to propagate; never raise the 10-minute poll.
	const started = Date.now();
	// Null unless this is a chained workflow_run with a token: a dispatch or a local run never asks.
	const lookup = supersededLookup(process.env, smoke.expectVersion);
	/** @param {string} served */
	const superseded = (served) => {
		console.log(
			`::notice::smoke: ${smoke.expectVersion} superseded by ${served}; not smoked (the newer commit's own live-smoke judges it)`
		);
		return 0;
	};
	let newer = '';
	const waited = await waitForVersion(smoke.baseUrl, smoke.expectVersion, {
		compare: lookup ?? undefined,
		onSuperseded: (served) => (newer = served)
	});
	if (waited === 'superseded') return superseded(newer);
	if (waited === 'timeout') {
		console.error(
			`smoke: ${smoke.baseUrl}_app/version.json never reported ${smoke.expectVersion} within 10 minutes (deploy not propagated)`
		);
		return 3;
	}
	console.log(
		`smoke: ${smoke.expectVersion} live at ${smoke.baseUrl} after ${Math.round((Date.now() - started) / 1000)} s`
	);
	// The fixtures append the URL of every 429 response to this file (workers are separate
	// processes); the file only ever holds public smoke-target URLs and is removed below.
	const dir = mkdtempSync(path.join(tmpdir(), 'smoke-429-'));
	const log = path.join(dir, 'rate-limited.log');
	try {
		appendFileSync(log, '');
		// The token is for the compare lookup only: it never reaches the browser workers or traces.
		const env = { ...process.env, SMOKE_429_LOG: log };
		delete env.GITHUB_TOKEN;
		const status = runPlaywright(passthrough, env);
		if (status !== 0 && lookup) {
			// A newer commit deployed mid-run fails this one's version and cache checks: not its fault.
			const served = await checkSuperseded(smoke.baseUrl, smoke.expectVersion, { compare: lookup });
			if (served) return superseded(served);
		}
		const n = countRateLimited(readFileSync(log, 'utf8'));
		const code = classifySuiteExit(status, n);
		if (code === 2 && status !== 2) {
			console.error(
				`smoke: HTTP 429 from the Pages CDN on ${n} request(s): CDN rate-limited, re-dispatch once (never in a loop; see docs/RUNBOOK.md)`
			);
		}
		return code;
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

/**
 * @param {string[]} names
 * @param {string[]} passthrough
 */
async function local(names, passthrough) {
	const all = localTargets(process.env);
	const selected = names.length ? all.filter((t) => names.includes(t.name)) : all;
	const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: REPO, encoding: 'utf8' })
		.stdout.toString()
		.trim();
	const stale = staleBuilds(selected, head);
	if (stale.length) {
		for (const m of stale) console.error(m);
		return 2;
	}

	const ports = {
		E2E_PORT_ROOT: String(process.env.E2E_PORT_ROOT ?? 4273),
		E2E_PORT_SUB: String(process.env.E2E_PORT_SUB ?? 4274),
		E2E_PORT_ATTACKER: String(process.env.E2E_PORT_ATTACKER ?? 4275),
		E2E_PORT_CONFIGURED: String(process.env.E2E_PORT_CONFIGURED ?? 4276)
	};
	const server = spawn(process.execPath, [path.join(REPO, 'scripts', 'serve-pages.mjs')], {
		cwd: REPO,
		stdio: ['pipe', 'inherit', 'inherit'],
		env: { ...process.env, ...ports, SERVE_PAGES_EXIT_ON_STDIN_END: '1' }
	});
	let exited = false;
	server.on('exit', () => (exited = true));
	const stop = () => {
		server.stdin?.end();
		if (!exited) setTimeout(() => !exited && server.kill(), 2_000).unref();
	};

	const probe = `http://127.0.0.1:${ports.E2E_PORT_ATTACKER}/`;
	const readyBy = Date.now() + 30_000;
	let ready = false;
	while (!ready && !exited && Date.now() < readyBy) {
		const r = await httpGet(probe).catch(() => null);
		if (r?.status === 200) ready = true;
		else await new Promise((s) => setTimeout(s, 250));
	}
	if (!ready || exited) {
		stop();
		console.error(
			'smoke: serve-pages did not start (port in use? never run smoke:local alongside test:e2e)'
		);
		return 2;
	}

	const t0 = Date.now();
	/** @type {{ name: string, ok: boolean, s: number }[]} */
	const results = [];
	for (const t of selected) {
		const start = Date.now();
		const stamp = readStamp(t.dir);
		if (
			(await waitForVersion(t.baseUrl, stamp, { timeoutMs: 30_000, everyMs: 500 })) === 'timeout'
		) {
			stop();
			console.error(`smoke: ${t.baseUrl}_app/version.json never reported ${stamp}`);
			return 3;
		}
		const status = runPlaywright(passthrough, {
			...process.env,
			SMOKE_BASE_URL: t.baseUrl,
			SMOKE_SITE_URL: t.siteUrl,
			SMOKE_EXPECT_VERSION: stamp,
			SMOKE_ANALYTICS_HOST: t.analyticsHost,
			SMOKE_ALLOW_HTTP: '1'
		});
		results.push({ name: t.name, ok: status === 0, s: (Date.now() - start) / 1000 });
		if (exited) break;
	}
	stop();

	const total = (Date.now() - t0) / 1000;
	for (const r of results)
		console.log(`smoke:local ${r.name} ${r.ok ? 'pass' : 'FAIL'} ${r.s.toFixed(1)}s`);
	console.log(`smoke:local total ${total.toFixed(1)}s`);
	if (exited && results.length < selected.length) {
		console.error('smoke: serve-pages exited mid-run');
		return 2;
	}
	if (results.some((r) => !r.ok)) return 1;
	if (selected.length === TARGETS.length && total >= BUDGET_S) {
		console.error('smoke:local exceeded the 5-minute budget; fix the cause, never raise timeouts');
		return 4;
	}
	return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	let args;
	try {
		args = parseArgs(process.argv.slice(2));
	} catch (e) {
		console.error(`smoke: ${/** @type {Error} */ (e).message}`);
		process.exit(2);
	}
	const code = args.local
		? await local(args.targets, args.passthrough)
		: await remote(args.passthrough);
	process.exit(code);
}
