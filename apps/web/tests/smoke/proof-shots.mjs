// Launch-proof screenshots (13-08, D-20). Captures five viewport screenshots of a deployed base URL
// and records the HTTP facts behind the routing contract (status codes, redirect Location headers,
// the deployed SHA) into checks.json, so the proof bundle is reproducible from any deployed commit.
//
//   pnpm --filter web exec node tests/smoke/proof-shots.mjs \
//     --base-url https://wolfwdavid.github.io/tran_real_estate/ --out ../../docs/launch-proof/<date>
//
// Read-only: navigations and GETs only. Every request carries Sec-GPC: 1 and the browser exposes
// navigator.globalPrivacyControl, so a proof run never counts as a pageview once analytics is on.
// Exit 1 if a fact misses its expected value or the bundle exceeds 5 MB; exit 2 on bad arguments.
import { mkdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const MAX_BUNDLE_BYTES = 5 * 1024 * 1024;
const SHA = /^[0-9a-f]{40}$/;
/** A fixed unknown path, so the 404 shot is the same file on every run. */
const NOT_FOUND_PATH = 'proof-not-found-13/';

/**
 * @typedef {{ baseUrl: string, out: string }} ProofArgs
 * @typedef {{ file: string, url: string, reload?: boolean, ready?: string }} Shot
 *   `ready` is a selector that must be visible before the shot. The 404 is the SPA fallback shell,
 *   which renders its page client-side after `load`, so a shot taken at `load` is blank.
 * @typedef {{ endsWith?: string, startsWith?: string }} LocationExpectation
 * @typedef {{
 *   name: string,
 *   url: string,
 *   expectStatus: number,
 *   expectLocation?: LocationExpectation,
 *   expectVersionSha?: boolean
 * }} Check
 * @typedef {{ shots: Shot[], checks: Check[] }} ProofPlan
 */

/**
 * Parse `--base-url <https url with trailing slash> --out <dir>`. Throws by name on anything else.
 * Mirrors the smoke env gate (env.js): https only, absolute, trailing slash.
 * @param {readonly string[]} argv
 * @returns {ProofArgs}
 */
export function parseProofArgs(argv) {
	/** @type {Record<string, string>} */
	const opts = {};
	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i];
		if (arg !== '--base-url' && arg !== '--out') throw new Error(`unknown argument ${arg}`);
		const value = argv[i + 1];
		if (value === undefined || value.startsWith('--')) throw new Error(`${arg} needs a value`);
		opts[arg] = value;
		i += 1;
	}
	const baseUrl = opts['--base-url'];
	if (!baseUrl) {
		throw new Error(
			'--base-url is required (the deployed origin + base path, with a trailing slash)'
		);
	}
	/** @type {URL} */
	let url;
	try {
		url = new URL(baseUrl);
	} catch {
		throw new Error(`--base-url is not an absolute URL (got ${JSON.stringify(baseUrl)})`);
	}
	if (url.protocol !== 'https:') {
		throw new Error(`--base-url must be https:// (got ${JSON.stringify(baseUrl)})`);
	}
	if (!baseUrl.endsWith('/')) {
		throw new Error(`--base-url must end with / (got ${JSON.stringify(baseUrl)})`);
	}
	const out = opts['--out'];
	if (!out) throw new Error('--out is required (directory for the screenshots and checks.json)');
	return { baseUrl, out };
}

/**
 * The screenshots to take and the HTTP facts to record for one deployed base URL. Pure.
 * @param {string} baseUrl
 * @returns {ProofPlan}
 */
export function proofPlan(baseUrl) {
	return {
		shots: [
			{ file: '01-landing.png', url: baseUrl, ready: 'h1' },
			{ file: '02-renter.png', url: `${baseUrl}renter/`, ready: 'h1' },
			{ file: '03-deep-route-refresh.png', url: `${baseUrl}investor/`, reload: true, ready: 'h1' },
			{ file: '04-not-found.png', url: `${baseUrl}${NOT_FOUND_PATH}`, ready: 'h1' },
			{ file: '05-version-json.png', url: `${baseUrl}_app/version.json` }
		],
		checks: [
			{ name: 'landing', url: baseUrl, expectStatus: 200 },
			{
				name: 'slashless-redirect',
				url: `${baseUrl}renter`,
				expectStatus: 301,
				expectLocation: { endsWith: '/renter/' }
			},
			{ name: 'not-found', url: `${baseUrl}${NOT_FOUND_PATH}`, expectStatus: 404 },
			{
				name: 'http-upgrade',
				url: baseUrl.replace(/^https:/, 'http:'),
				expectStatus: 301,
				expectLocation: { startsWith: 'https://' }
			},
			{
				name: 'version-json',
				url: `${baseUrl}_app/version.json`,
				expectStatus: 200,
				expectVersionSha: true
			}
		]
	};
}

/**
 * Compare one recorded response with its check. Returns the reasons it misses, empty when it holds.
 * @param {Check} check
 * @param {{ status: number, location: string | null, version: string | null }} got
 * @returns {string[]}
 */
export function checkMisses(check, got) {
	const misses = [];
	if (got.status !== check.expectStatus) {
		misses.push(`status ${got.status}, expected ${check.expectStatus}`);
	}
	const loc = check.expectLocation;
	if (loc) {
		const location = got.location ?? '';
		if (loc.endsWith && !location.endsWith(loc.endsWith)) {
			misses.push(`Location ${JSON.stringify(location)} does not end with ${loc.endsWith}`);
		}
		if (loc.startsWith && !location.startsWith(loc.startsWith)) {
			misses.push(`Location ${JSON.stringify(location)} does not start with ${loc.startsWith}`);
		}
	}
	if (check.expectVersionSha && !SHA.test(got.version ?? '')) {
		misses.push(`version ${JSON.stringify(got.version)} is not a 40-hex SHA`);
	}
	return misses;
}

async function main() {
	/** @type {ProofArgs} */
	let args;
	try {
		args = parseProofArgs(process.argv.slice(2));
	} catch (e) {
		console.error(`proof-shots: ${e instanceof Error ? e.message : String(e)}`);
		process.exit(2);
	}
	const { baseUrl, out } = args;
	const plan = proofPlan(baseUrl);
	mkdirSync(out, { recursive: true });

	const { chromium, request } = await import('playwright');
	const gpc = { 'Sec-GPC': '1' };
	const browser = await chromium.launch();
	const context = await browser.newContext({
		viewport: { width: 1280, height: 800 },
		reducedMotion: 'reduce',
		extraHTTPHeaders: gpc
	});
	// Same flag the smoke fixtures set: the app's beacon reads navigator.globalPrivacyControl.
	await context.addInitScript(() =>
		Object.defineProperty(Navigator.prototype, 'globalPrivacyControl', { get: () => true })
	);
	const page = await context.newPage();
	for (const shot of plan.shots) {
		await page.goto(shot.url, { waitUntil: 'load' });
		if (shot.reload) await page.reload({ waitUntil: 'load' });
		if (shot.ready) await page.locator(shot.ready).first().waitFor();
		// Viewport only (not fullPage): the bundle must stay small and the proof is "the page loaded".
		await page.screenshot({ path: join(out, shot.file) });
		console.log(`shot  ${shot.file}  ${shot.url}${shot.reload ? '  (reloaded)' : ''}`);
	}
	await browser.close();

	const api = await request.newContext({ extraHTTPHeaders: gpc });
	const results = [];
	let failed = false;
	for (const check of plan.checks) {
		const res = await api.get(check.url, { maxRedirects: 0 });
		const status = res.status();
		const location = res.headers()['location'] ?? null;
		/** @type {string | null} */
		let version = null;
		if (check.expectVersionSha) {
			try {
				version = String((await res.json()).version ?? '');
			} catch {
				version = null;
			}
		}
		const misses = checkMisses(check, { status, location, version });
		if (misses.length) failed = true;
		results.push({
			name: check.name,
			url: check.url,
			expectStatus: check.expectStatus,
			...(check.expectLocation ? { expectLocation: check.expectLocation } : {}),
			status,
			...(location !== null ? { location } : {}),
			...(check.expectVersionSha ? { version } : {}),
			ok: misses.length === 0,
			...(misses.length ? { misses } : {})
		});
		console.log(
			`${misses.length ? 'MISS ' : 'ok   '} ${check.name}  ${status}${location ? `  -> ${location}` : ''}${
				misses.length ? `  (${misses.join('; ')})` : ''
			}`
		);
	}
	await api.dispose();

	const checksFile = join(out, 'checks.json');
	writeFileSync(
		checksFile,
		`${JSON.stringify({ baseUrl, capturedAt: new Date().toISOString(), checks: results }, null, 2)}\n`
	);

	let total = 0;
	for (const file of [...plan.shots.map((s) => s.file), 'checks.json']) {
		const size = statSync(join(out, file)).size;
		total += size;
		console.log(`${String(size).padStart(9)} B  ${file}`);
	}
	console.log(`${String(total).padStart(9)} B  total (limit ${MAX_BUNDLE_BYTES} B)`);
	if (total > MAX_BUNDLE_BYTES) {
		console.error(`proof-shots: bundle is ${total} B, over the ${MAX_BUNDLE_BYTES} B limit`);
		failed = true;
	}
	if (failed) {
		console.error('proof-shots: one or more facts missed their expected value; see checks.json');
		process.exit(1);
	}
	console.log(`proof-shots: ${plan.shots.length} screenshots and ${checksFile} written`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	await main();
}
