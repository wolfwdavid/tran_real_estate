// Initial-JS budget oracle over a prerendered build directory (10-RESEARCH Pattern 7).
//
// The bytes a browser loads up front for a route are the <link rel="modulepreload"> set, plus the
// import("….js") targets inside inline boot scripts, plus every <script src>. Dynamic import() from
// components is excluded, which is exactly how the heavy portal libraries stay off marketing pages.
// Each file is gzipped at level 9 and counted once per route. A reference that does not resolve to a
// built file is an error, never a silent 0.
//
// Tool pages (tools/ and tools/<slug>/) are gated at 60 KB gz; the landing, audience, legal and
// feedback pages are measured and reported only (UI-SPEC). Every other route is skipped.
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';

export const BUDGET_BYTES = 60 * 1024;
export const HARD = [/^tools\/index\.html$/, /^tools\/[^/]+\/index\.html$/];
export const REPORT = [
	/^index\.html$/,
	/^for-[^/]+\/index\.html$/,
	/^legal\/[^/]+\/index\.html$/,
	/^feedback\/index\.html$/
];

const walk = (d) =>
	readdirSync(d).flatMap((f) =>
		statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]
	);

const attr = (tag, name) => new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, 'i').exec(tag)?.[1];
const decode = (s) => s.replace(/&amp;/g, '&');

/** gzip -9 size of every distinct ref, resolved relative to the page's directory. */
function gzSum(dir, page, refs) {
	const root = resolve(dir);
	const base = dirname(join(root, page));
	let sum = 0;
	for (const ref of new Set(refs)) {
		if (/^[a-z][a-z0-9+.-]*:/i.test(ref) || ref.startsWith('/')) {
			throw new Error(`${page}: cannot measure non-relative ref ${ref}`);
		}
		const file = resolve(base, ref.split(/[?#]/)[0]);
		const rel = relative(root, file);
		if (rel.startsWith('..') || rel === '') {
			throw new Error(`${page}: ref ${ref} resolves outside the build directory`);
		}
		if (!existsSync(file) || !statSync(file).isFile()) {
			throw new Error(`${page}: referenced file ${ref} does not exist`);
		}
		sum += gzipSync(readFileSync(file), { level: 9 }).length;
	}
	return sum;
}

/**
 * Initial JS bytes (gzip -9) a browser loads for `page` (build-relative path of an .html file).
 * @param {string} dir
 * @param {string} page
 * @returns {number}
 */
export function initialJs(dir, page) {
	const html = readFileSync(join(dir, page), 'utf8');
	const refs = [];
	for (const [tag] of html.matchAll(/<link\b[^>]*>/gi)) {
		const href = attr(tag, 'href');
		if (/^modulepreload$/i.test(attr(tag, 'rel') ?? '') && href) refs.push(decode(href));
	}
	for (const [, attrs, body] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
		const src = attr(attrs, 'src');
		if (src) {
			refs.push(decode(src));
			continue;
		}
		for (const [, target] of body.matchAll(/import\(\s*["']([^"']+\.js)["']\s*\)/g))
			refs.push(target);
	}
	return gzSum(dir, page, refs);
}

/**
 * Initial CSS bytes (gzip -9) from every <link rel="stylesheet" href>.
 * @param {string} dir
 * @param {string} page
 * @returns {number}
 */
export function initialCss(dir, page) {
	const html = readFileSync(join(dir, page), 'utf8');
	const refs = [];
	for (const [tag] of html.matchAll(/<link\b[^>]*>/gi)) {
		const href = attr(tag, 'href');
		if (/^stylesheet$/i.test(attr(tag, 'rel') ?? '') && href) refs.push(decode(href));
	}
	return gzSum(dir, page, refs);
}

const kb = (bytes) => (bytes / 1024).toFixed(1);
/** A budget in KB without a pointless .0 (60 * 1024 -> "60"). */
const kbLimit = (bytes) => String(Math.round((bytes / 1024) * 10) / 10);

/**
 * @typedef {{ route: string; jsGz: number; cssGz: number; budget: number | null; result: 'PASS' | 'FAIL' | 'REPORT' }} Row
 */

/**
 * Measures every gated and reported route.
 * @param {string} dir
 * @param {{ limit?: number }} [opts]
 * @returns {{ rows: Row[]; errors: string[] }}
 */
export function checkBudget(dir, { limit = BUDGET_BYTES } = {}) {
	/** @type {Row[]} */
	const rows = [];
	/** @type {string[]} */
	const errors = [];
	if (!existsSync(dir)) return { rows, errors: [`${dir}: build directory missing`] };
	const pages = walk(dir)
		.filter((f) => f.endsWith('index.html'))
		.map((f) => relative(dir, f).split(sep).join('/'))
		.sort();
	for (const route of pages) {
		const hard = HARD.some((r) => r.test(route));
		if (!hard && !REPORT.some((r) => r.test(route))) continue;
		let jsGz;
		let cssGz;
		try {
			jsGz = initialJs(dir, route);
			cssGz = initialCss(dir, route);
		} catch (e) {
			errors.push(e.message);
			continue;
		}
		if (!hard) {
			rows.push({ route, jsGz, cssGz, budget: null, result: 'REPORT' });
			continue;
		}
		const result = jsGz > limit ? 'FAIL' : 'PASS';
		rows.push({ route, jsGz, cssGz, budget: limit, result });
		if (result === 'FAIL') {
			errors.push(`${route}: initial JS ${kb(jsGz)} KB gz exceeds the ${kbLimit(limit)} KB budget`);
		}
	}
	return { rows, errors };
}

/** The table the CLI prints. */
export function formatRows(rows) {
	const lines = [['route', 'JS gz KB', 'CSS gz KB', 'budget', 'result']];
	for (const r of rows) {
		lines.push([
			r.route,
			kb(r.jsGz),
			kb(r.cssGz),
			r.budget === null ? '-' : `${kbLimit(r.budget)} KB`,
			r.result
		]);
	}
	const widths = lines[0].map((_, i) => Math.max(...lines.map((l) => l[i].length)));
	return lines.map((l) => l.map((c, i) => c.padEnd(widths[i])).join(' | ')).join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const usage = 'usage: node scripts/assert-budget.mjs <dir> [--json <file>] [--require-tools]';
	const args = process.argv.slice(2);
	const j = args.indexOf('--json');
	const jsonFile = j === -1 ? undefined : args[j + 1];
	if (j !== -1 && (!jsonFile || jsonFile.startsWith('--'))) {
		console.error(`--json needs a file\n${usage}`);
		process.exit(2);
	}
	const requireTools = args.includes('--require-tools');
	const dir = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--json') ?? 'build';
	const { rows, errors } = checkBudget(dir);
	if (rows.length) console.log(formatRows(rows));
	if (jsonFile) writeFileSync(jsonFile, JSON.stringify(rows, null, '\t') + '\n');
	const hardRows = rows.filter((r) => r.budget !== null).length;
	if (requireTools && hardRows === 0) {
		errors.push(`${dir}: no tools pages found (--require-tools)`);
	}
	if (errors.length) {
		console.error(`Budget assertion failed (${errors.length}):\n- ` + errors.join('\n- '));
		process.exit(1);
	}
	console.log(
		`Budget assertion passed: ${hardRows} gated route(s) within ${kbLimit(BUDGET_BYTES)} KB, ${rows.length - hardRows} reported, in ${dir}`
	);
}
