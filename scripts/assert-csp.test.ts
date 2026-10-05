// Mutation tests for scripts/assert-csp.mjs: every protection the oracle claims to enforce is
// proven by injecting exactly one fault into a runtime-generated golden page and asserting the
// oracle reports it. Fixtures live only in memory or under os.tmpdir(); nothing is written into
// the repository.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { CONNECT, EXPECTED_PAGES, checkAssetText, checkBuild, checkHtml } from './assert-csp.mjs';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// A Kit-shaped hydration boot script. Its hash is computed at runtime so the golden page is
// self-consistent and the hash-mismatch fault below is a genuine mismatch rather than a typo.
const BOOT = [
	'',
	'\t\t\t\t{',
	'\t\t\t\t\t__sveltekit_test = { base: "" };',
	'\t\t\t\t\tconst element = document.currentScript.parentElement;',
	'\t\t\t\t\tPromise.all([import("./_app/immutable/entry/start.js")]);',
	'\t\t\t\t}',
	'\t\t\t'
].join('\n');

const sha256 = (body: string) => `'sha256-${createHash('sha256').update(body).digest('base64')}'`;

type Directives = Record<string, string | undefined>;

function policy(overrides: Directives = {}): string {
	const directives: Directives = {
		'default-src': "'self'",
		'connect-src': CONNECT.join(' '),
		'object-src': "'none'",
		'script-src': `'self' ${sha256(BOOT)}`,
		'style-src': "'self'",
		'style-src-attr': "'unsafe-inline'",
		'base-uri': "'self'",
		'form-action': "'self' https://api.web3forms.com",
		...overrides
	};
	return Object.entries(directives)
		.filter(([, v]) => v !== undefined)
		.map(([k, v]) => `${k} ${v}`)
		.join('; ');
}

interface PageOptions {
	htmlTag?: string;
	beforeMeta?: string;
	directives?: Directives;
	meta?: string | null;
	boot?: string;
}

function makePage(o: PageOptions = {}): string {
	const htmlTag = o.htmlTag ?? '<html lang="en" hidden>';
	const meta =
		o.meta === undefined
			? `<meta http-equiv="content-security-policy" content="${policy(o.directives)}">`
			: (o.meta ?? '');
	const boot = o.boot ?? BOOT;
	return [
		'<!doctype html>',
		htmlTag,
		'\t<head>',
		'\t\t<meta charset="utf-8" />',
		`\t\t${o.beforeMeta ?? ''}${meta}`,
		'\t\t<link href="./_app/immutable/entry/start.js" rel="modulepreload">',
		'\t\t<!--skv6c4--><!----><title>Tran Real Estate Tools</title>',
		'\t\t<link href="./_app/immutable/assets/0.css" rel="stylesheet">',
		'\t\t<script src="./frame-guard.js"></script>',
		'\t\t<meta name="viewport" content="width=device-width, initial-scale=1" />',
		'\t</head>',
		'\t<body data-sveltekit-preload-data="hover">',
		'\t\t<div class="app-root"><h1>Tran Real Estate Tools</h1>',
		`\t\t\t<script>${boot}</script>`,
		'\t\t</div>',
		'\t</body>',
		'</html>',
		''
	].join('\n');
}

const golden = makePage();

describe('checkHtml golden page', () => {
	test('a well-formed Kit page passes with no errors', () => {
		expect(checkHtml('index.html', golden)).toEqual([]);
	});

	test('the golden fixture really contains the protections under test', () => {
		expect(golden).toMatch(/<html lang="en" hidden>/);
		expect(golden).toMatch(
			/<meta charset="utf-8" \/>\n\t\t<meta http-equiv="content-security-policy"/
		);
		expect(golden).toContain(`script-src 'self' ${sha256(BOOT)}`);
		expect(golden).toContain(`connect-src ${CONNECT.join(' ')}`);
	});

	test('an entity-encoded policy attribute is decoded before parsing', () => {
		const encoded = golden.replace(
			/content="([^"]*)"/,
			(_m, c: string) => `content="${c.replace(/'/g, '&#39;')}"`
		);
		expect(encoded).toContain('&#39;self&#39;');
		expect(checkHtml('index.html', encoded)).toEqual([]);
	});
});

describe('checkHtml injected faults', () => {
	test('Fault 1: missing CSP meta is reported', () => {
		const errors = checkHtml('index.html', makePage({ meta: null }));
		expect(errors.length).toBeGreaterThan(0);
		expect(errors.some((e) => /CSP meta missing/.test(e))).toBe(true);
	});

	test("Fault 2: script-src 'unsafe-inline' is rejected", () => {
		const errors = checkHtml(
			'index.html',
			makePage({ directives: { 'script-src': `'self' 'unsafe-inline' ${sha256(BOOT)}` } })
		);
		expect(errors.length).toBeGreaterThan(0);
		expect(errors.some((e) => e.includes('unsafe-inline'))).toBe(true);
	});

	test("Fault 2b: script-src 'unsafe-eval' is rejected", () => {
		const errors = checkHtml(
			'index.html',
			makePage({ directives: { 'script-src': `'self' 'unsafe-eval' ${sha256(BOOT)}` } })
		);
		expect(errors.some((e) => e.includes('unsafe-eval'))).toBe(true);
	});

	test('Fault 3: a <script> before the CSP meta is rejected', () => {
		const errors = checkHtml(
			'index.html',
			makePage({ beforeMeta: '<script src="./early.js"></script>\n\t\t' })
		);
		expect(errors.length).toBeGreaterThan(0);
		expect(errors.some((e) => e.includes('first in <head>'))).toBe(true);
	});

	test('Fault 3b: a <link> before the CSP meta is rejected too', () => {
		const errors = checkHtml(
			'index.html',
			makePage({ beforeMeta: '<link href="./x.css" rel="stylesheet">\n\t\t' })
		);
		expect(errors.some((e) => e.includes('first in <head>'))).toBe(true);
	});

	test('Fault 4a: an extra connect-src host is rejected', () => {
		const errors = checkHtml(
			'index.html',
			makePage({ directives: { 'connect-src': `${CONNECT.join(' ')} https://evil.example.com` } })
		);
		expect(errors.length).toBeGreaterThan(0);
		expect(errors.some((e) => e.includes('connect-src'))).toBe(true);
	});

	test('Fault 4b: a removed connect-src host is rejected', () => {
		const trimmed = CONNECT.filter((h) => h !== 'https://openrouter.ai');
		expect(trimmed).toHaveLength(CONNECT.length - 1);
		const errors = checkHtml(
			'index.html',
			makePage({ directives: { 'connect-src': trimmed.join(' ') } })
		);
		expect(errors.length).toBeGreaterThan(0);
		expect(errors.some((e) => e.includes('connect-src'))).toBe(true);
	});

	test('Fault 4c: connect-src order does not matter, only the set', () => {
		const shuffled = [...CONNECT].reverse().join(' ');
		expect(checkHtml('index.html', makePage({ directives: { 'connect-src': shuffled } }))).toEqual(
			[]
		);
	});

	test('Fault 5: <html> without the hidden attribute is rejected', () => {
		const errors = checkHtml('index.html', makePage({ htmlTag: '<html lang="en">' }));
		expect(errors.length).toBeGreaterThan(0);
		expect(errors.some((e) => e.includes('hidden'))).toBe(true);
	});

	test.each(['frame-ancestors', 'report-uri', 'sandbox'])(
		'Fault 6: meta-ignored directive %s is rejected',
		(directive) => {
			const value = directive === 'report-uri' ? '/csp-report' : "'none'";
			const errors = checkHtml('index.html', makePage({ directives: { [directive]: value } }));
			expect(errors.some((e) => e.includes(directive))).toBe(true);
		}
	);

	test("Fault 7: style-src 'unsafe-inline' is rejected", () => {
		const errors = checkHtml(
			'index.html',
			makePage({ directives: { 'style-src': "'self' 'unsafe-inline'" } })
		);
		expect(errors.length).toBeGreaterThan(0);
		expect(errors.some((e) => e.includes('style-src'))).toBe(true);
	});

	test("Fault 7b: style-src-attr other than exactly 'unsafe-inline' is rejected", () => {
		const errors = checkHtml(
			'index.html',
			makePage({ directives: { 'style-src-attr': "'self'" } })
		);
		expect(errors.some((e) => e.includes('style-src-attr'))).toBe(true);
	});

	test('Fault 8: an inline script whose hash is not in script-src is rejected', () => {
		const errors = checkHtml(
			'index.html',
			makePage({ boot: BOOT.replace('base: ""', 'base: "/x"') })
		);
		expect(errors.length).toBeGreaterThan(0);
		expect(errors.some((e) => e.includes('hash'))).toBe(true);
	});

	test.each(['default-src', 'object-src', 'base-uri', 'form-action'])(
		'Fault 9: exact-set directive %s drift is rejected',
		(directive) => {
			const errors = checkHtml(
				'index.html',
				makePage({ directives: { [directive]: "'self' https://evil.example.com" } })
			);
			expect(errors.some((e) => e.includes(directive))).toBe(true);
		}
	);
});

function withTempBuild(populate: (dir: string) => void, run: (dir: string) => void): void {
	const dir = mkdtempSync(join(tmpdir(), 'csp-'));
	try {
		populate(dir);
		run(dir);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

function writeFullBuild(dir: string): void {
	writeFileSync(join(dir, '.nojekyll'), '');
	writeFileSync(join(dir, 'frame-guard.js'), '(function () {})();\n');
	for (const page of EXPECTED_PAGES) {
		mkdirSync(dirname(join(dir, page)), { recursive: true });
		writeFileSync(join(dir, page), golden);
	}
}

describe('checkBuild over a temp directory', () => {
	test('a complete build passes', () => {
		withTempBuild(writeFullBuild, (dir) => {
			expect(checkBuild(dir)).toEqual([]);
		});
	});

	test('a build missing .nojekyll is rejected', () => {
		withTempBuild(
			(dir) => {
				writeFullBuild(dir);
				rmSync(join(dir, '.nojekyll'));
			},
			(dir) => {
				expect(checkBuild(dir).some((e) => /missing \.nojekyll/.test(e))).toBe(true);
			}
		);
	});

	test('a build missing frame-guard.js is rejected', () => {
		withTempBuild(
			(dir) => {
				writeFullBuild(dir);
				rmSync(join(dir, 'frame-guard.js'));
			},
			(dir) => {
				expect(checkBuild(dir).some((e) => /missing frame-guard\.js/.test(e))).toBe(true);
			}
		);
	});

	test.each(['404.html', 'settings/index.html'])('a build missing %s is rejected', (page) => {
		withTempBuild(
			(dir) => {
				writeFullBuild(dir);
				rmSync(join(dir, page));
			},
			(dir) => {
				expect(checkBuild(dir)).toContain(`missing ${page}`);
			}
		);
	});

	test('a faulty nested page is reported with its build-relative path', () => {
		withTempBuild(
			(dir) => {
				writeFullBuild(dir);
				writeFileSync(join(dir, 'renter', 'index.html'), makePage({ htmlTag: '<html lang="en">' }));
			},
			(dir) => {
				const errors = checkBuild(dir);
				expect(errors).toHaveLength(1);
				expect(errors[0]).toMatch(/^renter\/index\.html: .*hidden/);
			}
		);
	});

	test('a missing directory reports every carrier as missing', () => {
		const errors = checkBuild(join(tmpdir(), 'csp-does-not-exist-' + process.pid));
		expect(errors).toHaveLength(2 + EXPECTED_PAGES.length);
	});
});

describe('data: URI ban', () => {
	test('a data: font in a CSS url() is rejected', () => {
		const errors = checkAssetText('_app/x.css', 'a{src:url(data:font/woff2;base64,AA)}');
		expect(errors).toHaveLength(1);
		expect(errors[0]).toMatch(/data: URI/);
	});

	test('a quoted, padded data: SVG in a CSS url() is rejected', () => {
		expect(
			checkAssetText('_app/x.css', "a{background:url( 'data:image/svg+xml,<svg/>')}")
		).toHaveLength(1);
	});

	test('a data: image in an HTML attribute is rejected', () => {
		expect(checkAssetText('p/index.html', '<img src="data:image/png;base64,AA">')).toHaveLength(1);
	});

	test("Kit's inline boot data object is not a URI", () => {
		expect(
			checkAssetText('index.html', '<script>__sveltekit = { data: [null, null] }</script>')
		).toEqual([]);
	});

	test('data-* attributes are not URIs', () => {
		expect(checkAssetText('index.html', '<body data-sveltekit-preload-data="hover">')).toEqual([]);
	});

	test('checkBuild reports a data: URI in built CSS by relative path', () => {
		withTempBuild(
			(dir) => {
				writeFullBuild(dir);
				const assets = join(dir, '_app', 'immutable', 'assets');
				mkdirSync(assets, { recursive: true });
				writeFileSync(join(assets, '0.css'), '@font-face{src:url(data:font/woff2;base64,AA)}');
			},
			(dir) => {
				const errors = checkBuild(dir);
				expect(errors).toHaveLength(1);
				expect(errors[0]).toMatch(/^_app\/immutable\/assets\/0\.css: data: URI/);
			}
		);
	});
});

describe('drift guard against the real builds', () => {
	test.each(['build', 'build-sub'])('apps/web/%s/index.html passes when present', (name) => {
		const file = join(REPO_ROOT, 'apps', 'web', name, 'index.html');
		if (!existsSync(file)) return;
		expect(checkHtml('index.html', readFileSync(file, 'utf8'))).toEqual([]);
	});
});
