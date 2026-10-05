// Independent CSP / security-carrier oracle over a prerendered build directory.
//
// The allowlist below is a deliberate literal duplicate of apps/web/svelte.config.js:
// changing the policy must produce a reviewed two-file diff, never a silent pass.
// The Phase 10 beacon host is NOT accepted here yet (Phase 10 adds it to both files together).
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

export const CONNECT =
	"'self' https://api.rentcast.io https://api.anthropic.com https://api.openai.com https://generativelanguage.googleapis.com https://openrouter.ai https://api.web3forms.com".split(
		' '
	);

export const EXACT = {
	'default-src': ["'self'"],
	'object-src': ["'none'"],
	'base-uri': ["'self'"],
	'form-action': ["'self'", 'https://api.web3forms.com'],
	'connect-src': CONNECT
};

export const EXPECTED_PAGES = [
	'index.html',
	'renter/index.html',
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
	'404.html'
];

// Directives a <meta> CSP silently ignores; their presence is a false sense of safety.
const META_IGNORED = ['frame-ancestors', 'report-uri', 'sandbox'];

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

/** Returns [] when the page satisfies the contract; otherwise one string per fault. */
export function checkHtml(relPath, html) {
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

	for (const [k, v] of Object.entries(EXACT)) {
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

	for (const m of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)) {
		const hash = `'sha256-${createHash('sha256').update(m[1]).digest('base64')}'`;
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

/** Returns [] when every carrier file exists, every .html page passes checkHtml and no built .css/.html embeds a data: URI. */
export function checkBuild(dir) {
	const errors = [];
	for (const f of ['.nojekyll', 'frame-guard.js', ...EXPECTED_PAGES]) {
		if (!existsSync(join(dir, f))) errors.push(`missing ${f}`);
	}
	if (!existsSync(dir)) return errors;
	const pages = walk(dir).filter((f) => f.endsWith('.html'));
	for (const file of pages) {
		const rel = relative(dir, file).split(sep).join('/');
		errors.push(...checkHtml(rel, readFileSync(file, 'utf8')));
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
	const dir = process.argv[2] ?? 'build';
	const errors = checkBuild(dir);
	if (errors.length) {
		console.error(`CSP assertion failed (${errors.length}):\n- ` + errors.join('\n- '));
		process.exit(1);
	}
	console.log(`CSP assertion passed for ${countPages(dir)} pages in ${dir}`);
}
