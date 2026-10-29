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
// Exit codes: 0 ok, 1 suite failed, 2 precondition (env, stale/missing build, emulator),
// 3 version not propagated, 4 over the 5-minute budget.
//
// Dependency-free: node: builtins only (the repo bans bare fetch).
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { resolveBasePath } from '../apps/web/src/lib/base-path.js';
import { resolveAnalytics, resolveSiteOrigin } from '../apps/web/src/lib/site-config.js';
import { parseSmokeEnv } from '../apps/web/tests/smoke/env.js';
import { TARGETS, targetEnv } from './lib/build-targets.mjs';

const REPO = path.resolve(import.meta.dirname, '..');
const BUDGET_S = 300;

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
		const base = name === 'sub' ? '/tran_real_estate/' : '/';
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
 * @returns {Promise<{ status: number, body: string }>}
 */
export function httpGet(url) {
	return new Promise((resolve, reject) => {
		const req = (url.startsWith('https:') ? https : http).get(
			url,
			{ headers: { 'cache-control': 'no-cache' } },
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

/**
 * Poll <base>_app/version.json (cache-busted) until it reports `expected`. Never exits the process.
 * @param {string} base origin + base path, with a trailing slash
 * @param {string} expected
 * @param {{ timeoutMs?: number, everyMs?: number, get?: (url: string) => Promise<{ status: number, body: string }> }} [opts]
 * @returns {Promise<'ok' | 'timeout'>}
 */
export async function waitForVersion(
	base,
	expected,
	{ timeoutMs = 600_000, everyMs = 15_000, get = httpGet } = {}
) {
	const deadline = Date.now() + timeoutMs;
	for (;;) {
		const r = await get(`${base}_app/version.json?_=${expected}-${Date.now()}`).catch(() => null);
		if (r?.status === 200) {
			try {
				if (JSON.parse(r.body).version === expected) return 'ok';
			} catch {
				// not JSON yet (a Pages 404 page, a CDN error body): keep polling
			}
		}
		if (Date.now() >= deadline) return 'timeout';
		await new Promise((s) => setTimeout(s, everyMs));
	}
}

/**
 * Run the smoke Playwright config through the pinned pnpm (scripts/build-web.mjs pattern).
 * @param {string[]} passthrough
 * @param {Record<string, string | undefined>} env
 * @returns {number}
 */
function runPlaywright(passthrough, env) {
	const execPath = process.env.npm_execpath;
	const [bin, pre] = execPath ? [process.execPath, [execPath]] : ['corepack', ['pnpm']];
	const shell = !execPath && process.platform === 'win32';
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
	if ((await waitForVersion(smoke.baseUrl, smoke.expectVersion)) === 'timeout') {
		console.error(
			`smoke: ${smoke.baseUrl}_app/version.json never reported ${smoke.expectVersion} within 10 minutes (deploy not propagated)`
		);
		return 3;
	}
	return runPlaywright(passthrough, process.env);
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
