// Independent CSP / security-carrier oracle over a prerendered build directory.
//
// The allowlist below is a deliberate literal duplicate of apps/web/svelte.config.js:
// changing the policy must produce a reviewed two-file diff, never a silent pass.
// The Phase 10 first-party analytics host is accepted only through the validated env
// (resolveAnalytics, optionally overlaid with a --target build env): the same rule the build uses
// in apps/web/src/lib/csp-policy.js, so a host in the build but not the env (or the reverse) fails.
// JSON-LD data blocks (Phase 10) need no script-src hash, but must parse as JSON and carry no raw
// < or &; every other inline script still needs its hash.
// img-src gains exactly one host (OSM tiles, Phase 6). Never data:.
// img-src allows same-origin blob: object URLs for the agent logo (Phase 8); data: stays banned.
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { resolveAnalytics } from '../apps/web/src/lib/site-config.js';
import { targetEnv } from './lib/build-targets.mjs';

export const CONNECT =
	"'self' https://api.rentcast.io https://api.anthropic.com https://api.openai.com https://generativelanguage.googleapis.com https://openrouter.ai https://api.web3forms.com".split(
		' '
	);

export const EXACT = {
	'default-src': ["'self'"],
	'object-src': ["'none'"],
	'base-uri': ["'self'"],
	'form-action': ["'self'", 'https://api.web3forms.com'],
	'connect-src': CONNECT,
	'img-src': ["'self'", 'https://tile.openstreetmap.org', 'blob:']
};

export const EXPECTED_PAGES = [
	'index.html',
	'renter/index.html',
	'renter/listing/index.html',
	'renter/shortlist/index.html',
	'renter/affordability/index.html',
	'investor/index.html',
	'agent/index.html',
	'settings/index.html',
	'print/index.html',
	'for-renters/index.html',
	'for-investors/index.html',
	'for-agents/index.html',
	'legal/privacy/index.html',
	'legal/terms/index.html',
	'legal/fair-housing/index.html',
	'legal/data-coverage/index.html',
	// Phase 7 investor portal sub-pages and the memo printout.
	'investor/analyze/index.html',
	'investor/deals/index.html',
	'investor/compare/index.html',
	'investor/memo/index.html',
	'investor/buy-boxes/index.html',
	'investor/markets/index.html',
	'investor/market/index.html',
	'print/memo/index.html',
	// Phase 8 agent portal sub-pages.
	'agent/today/index.html',
	'agent/pipeline/index.html',
	'agent/contacts/index.html',
	'agent/contact/index.html',
	'agent/import/index.html',
	'agent/profile/index.html',
	// Phase 8 public inquiry page (chrome-free (public) route group).
	'agent/inquire/index.html',
	// Phase 9 agent Studio (hub and four tools) and the Market Snapshot printout.
	'agent/studio/index.html',
	'agent/studio/listing/index.html',
	'agent/studio/social/index.html',
	'agent/studio/reel/index.html',
	'agent/studio/snapshot/index.html',
	'print/snapshot/index.html',
	'404.html'
];

// Non-page files every build must ship: Pages/anti-framing carriers plus the PWA install set.
export const CARRIERS = [
	'.nojekyll',
	'frame-guard.js',
	'pwa-capture.js',
	'manifest.webmanifest',
	'icons/icon-192.png',
	'icons/icon-512.png',
	'icons/icon-maskable-512.png',
	'icons/apple-touch-icon-180.png',
	'service-worker.js'
];

// Linked from app.html (not the manifest); checked for its declared size alongside manifest icons.
const APPLE_TOUCH_ICON = { src: 'icons/apple-touch-icon-180.png', sizes: '180x180' };

// Directives a <meta> CSP silently ignores; their presence is a false sense of safety.
const META_IGNORED = ['frame-ancestors', 'report-uri', 'sandbox'];

// A JSON-LD data block: the type attribute itself (not a data-* attribute naming it) is ld+json.
const LD_JSON = /(?:^|\s)type\s*=\s*(["']?)application\/ld\+json\1(?=\s|\/|$)/i;

const walk = (d) =>
	readdirSync(d).flatMap((f) =>
		statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]
	);
const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
const decode = (s) =>
	s
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&amp;/g, '&');

const parsePolicy = (content) =>
	Object.fromEntries(
		decode(content)
			.split(';')
			.map((d) => d.trim().split(/\s+/))
			.filter((p) => p[0])
			.map(([k, ...v]) => [k, v])
	);

/**
 * Returns [] when the page satisfies the contract; otherwise one string per fault.
 * `analyticsHost` (an origin, or '') is the one extra connect-src origin the build may carry.
 */
export function checkHtml(relPath, html, { analyticsHost = '' } = {}) {
	const errors = [];
	const err = (msg) => errors.push(`${relPath}: ${msg}`);

	if (!/<html\b[^>]*\shidden[\s>]/i.test(html)) {
		err('<html> must carry the hidden attribute (anti-framing)');
	}

	const head = (/<head>([\s\S]*?)<\/head>/i.exec(html)?.[1] ?? '').replace(/<!--[\s\S]*?-->/g, '');
	const tags = [...head.matchAll(/<([a-z]+)\b[^>]*>/gi)].map((m) => m[0]);
	const i = tags.findIndex((t) => /http-equiv="content-security-policy"/i.test(t));
	if (i === -1) {
		err('CSP meta missing');
		return errors;
	}

	const before = tags.slice(0, i);
	if (!(before.length === 0 || (before.length === 1 && /^<meta charset=/i.test(before[0])))) {
		err(
			`CSP meta must be first in <head> (only <meta charset> may precede it); found ${before.join(' ')}`
		);
	}

	const policy = parsePolicy(/content="([^"]*)"/i.exec(tags[i])?.[1] ?? '');

	const expected = {
		...EXACT,
		'connect-src': analyticsHost ? [...CONNECT, analyticsHost] : CONNECT
	};
	for (const [k, v] of Object.entries(expected)) {
		if (!sameSet(policy[k] ?? [], v)) {
			err(`${k} is [${(policy[k] ?? []).join(' ')}], expected [${v.join(' ')}]`);
		}
	}
	for (const k of META_IGNORED) {
		if (policy[k]) err(`${k} is ignored in meta CSP; remove it`);
	}

	const scriptSrc = policy['script-src'] ?? [];
	for (const t of scriptSrc) {
		if (!(t === "'self'" || /^'sha256-[A-Za-z0-9+/]+=*'$/.test(t))) {
			err(`script-src token ${t} not allowed`);
		}
	}
	for (const t of policy['style-src'] ?? []) {
		if (t !== "'self'") err(`style-src token ${t} not allowed`);
	}
	if (policy['style-src-attr'] && !sameSet(policy['style-src-attr'], ["'unsafe-inline'"])) {
		err("style-src-attr must be exactly 'unsafe-inline'");
	}

	for (const [, attrs, body] of html.matchAll(
		/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/gi
	)) {
		if (LD_JSON.test(attrs)) {
			try {
				JSON.parse(body);
			} catch {
				err('ld+json block is not valid JSON');
			}
			if (/[<&]/.test(body)) err('ld+json block must \\u-escape < and &');
			continue;
		}
		const hash = `'sha256-${createHash('sha256').update(body).digest('base64')}'`;
		if (!scriptSrc.includes(hash)) err(`inline script not covered by script-src hash ${hash}`);
	}

	return errors;
}

const DATA_URL_CSS = /url\(\s*['"]?\s*data:/i;
const DATA_URL_ATTR = /\b(?:src|href|srcset|poster)\s*=\s*["']?\s*data:/i;

/** Returns [] unless built CSS/HTML embeds a data: URI (img-src/font-src fall back to 'self'). */
export function checkAssetText(relPath, text) {
	const errors = [];
	if (DATA_URL_CSS.test(text)) {
		errors.push(`${relPath}: data: URI in url() (set build.assetsInlineLimit: 0)`);
	}
	if (relPath.endsWith('.html') && DATA_URL_ATTR.test(text)) {
		errors.push(`${relPath}: data: URI in an attribute`);
	}
	return errors;
}

// A manifest URL must resolve against the manifest's own URL so one file serves both bases.
const isRelativeUrl = (u) =>
	typeof u === 'string' && u !== '' && !u.startsWith('/') && !/^[a-z][a-z0-9+.-]*:/i.test(u);

/** Returns [] when the web app manifest is valid, relative-URL only and installable. */
export function checkManifest(text) {
	let m;
	try {
		m = JSON.parse(text);
	} catch (e) {
		return [`invalid JSON (${e.message})`];
	}
	if (m === null || typeof m !== 'object' || Array.isArray(m))
		return ['invalid JSON (not an object)'];
	const errors = [];
	for (const k of ['name', 'short_name']) {
		if (typeof m[k] !== 'string' || m[k].trim() === '')
			errors.push(`${k} must be a non-empty string`);
	}
	for (const k of ['id', 'start_url', 'scope']) {
		if (m[k] !== './') errors.push(`${k} is ${JSON.stringify(m[k])}, expected "./"`);
	}
	if (m.display !== 'standalone')
		errors.push(`display is ${JSON.stringify(m.display)}, expected "standalone"`);
	const icons = Array.isArray(m.icons) ? m.icons : [];
	if (icons.length === 0) errors.push('icons must be a non-empty array');
	for (const icon of icons) {
		if (!isRelativeUrl(icon?.src))
			errors.push(`icon src ${JSON.stringify(icon?.src)} must be a relative URL`);
	}
	if (icons.length && !icons.some((i) => i?.sizes === '192x192')) errors.push('no 192x192 icon');
	if (
		icons.length &&
		!icons.some((i) =>
			String(i?.purpose ?? '')
				.split(/\s+/)
				.includes('maskable')
		)
	) {
		errors.push('no maskable icon');
	}
	return errors;
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Reads width/height from a PNG's IHDR chunk; null when the buffer is not a PNG. */
function pngSize(buf) {
	if (buf.length < 24 || !buf.subarray(0, 8).equals(PNG_SIGNATURE)) return null;
	return `${buf.readUInt32BE(16)}x${buf.readUInt32BE(20)}`;
}

/** Manifest validity plus the declared pixel size of every manifest icon and the apple-touch icon. */
function checkPwaAssets(dir) {
	const errors = [];
	const manifestFile = join(dir, 'manifest.webmanifest');
	let icons = [];
	if (existsSync(manifestFile)) {
		const text = readFileSync(manifestFile, 'utf8');
		const faults = checkManifest(text);
		errors.push(...faults.map((e) => `manifest.webmanifest: ${e}`));
		if (faults.length === 0) icons = JSON.parse(text).icons;
	}
	for (const { src, sizes } of [...icons, APPLE_TOUCH_ICON]) {
		const file = join(dir, src);
		if (!existsSync(file)) {
			if (!CARRIERS.includes(src)) errors.push(`missing ${src}`);
			continue;
		}
		const actual = pngSize(readFileSync(file));
		if (actual === null) errors.push(`${src}: not a PNG`);
		else if (actual !== sizes) errors.push(`${src}: is ${actual}, declared ${sizes}`);
	}
	return errors;
}

/** Install carriers every page must link from <head>. */
function checkPwaHead(relPath, html) {
	const head = (/<head>([\s\S]*?)<\/head>/i.exec(html)?.[1] ?? '').replace(/<!--[\s\S]*?-->/g, '');
	const errors = [];
	if (!/<link\b[^>]*\brel="manifest"/i.test(head)) errors.push(`${relPath}: missing manifest link`);
	if (!/<script\b[^>]*\bsrc="[^"]*pwa-capture\.js"/i.test(head)) {
		errors.push(`${relPath}: missing pwa-capture.js`);
	}
	return errors;
}

/** Returns [] when every carrier file exists, the PWA manifest/icons are valid, every .html page passes checkHtml and links the install carriers, and no built .css/.html embeds a data: URI. */
export function checkBuild(dir, opts = {}) {
	const errors = [];
	for (const f of [...CARRIERS, ...EXPECTED_PAGES]) {
		if (!existsSync(join(dir, f))) errors.push(`missing ${f}`);
	}
	if (!existsSync(dir)) return errors;
	errors.push(...checkPwaAssets(dir));
	const pages = walk(dir).filter((f) => f.endsWith('.html'));
	for (const file of pages) {
		const rel = relative(dir, file).split(sep).join('/');
		const html = readFileSync(file, 'utf8');
		errors.push(...checkHtml(rel, html, opts), ...checkPwaHead(rel, html));
	}
	for (const file of walk(dir).filter((f) => f.endsWith('.css') || f.endsWith('.html'))) {
		const rel = relative(dir, file).split(sep).join('/');
		errors.push(...checkAssetText(rel, readFileSync(file, 'utf8')));
	}
	return errors;
}

export const countPages = (dir) =>
	existsSync(dir) ? walk(dir).filter((f) => f.endsWith('.html')).length : 0;

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const args = process.argv.slice(2);
	const t = args.indexOf('--target');
	const target = t === -1 ? undefined : args[t + 1];
	const dir = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--target') ?? 'build';
	let host;
	try {
		if (t !== -1 && !target) throw new Error('--target needs a value');
		({ host } = resolveAnalytics({ ...process.env, ...(target ? targetEnv(target) : {}) }));
	} catch (e) {
		console.error(
			`${e.message}\nusage: node scripts/assert-csp.mjs <dir> [--target root|sub|configured]`
		);
		process.exit(2);
	}
	const errors = checkBuild(dir, { analyticsHost: host });
	if (errors.length) {
		console.error(`CSP assertion failed (${errors.length}):\n- ` + errors.join('\n- '));
		process.exit(1);
	}
	console.log(
		`CSP assertion passed for ${countPages(dir)} pages in ${dir} (analytics host: ${host || 'none'})`
	);
}
