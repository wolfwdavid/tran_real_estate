// LIVE-08 / LIVE-03 proof. Overlap: Phase 14 item 5.4 (origin parity) is satisfied for TRAN_ORIGIN
// by group (c); Phase 14 keeps only the docs/listing literal checks.
//
// "Changing PUBLIC_SITE_URL alone changes canonical URLs, the sitemap, OG absolute URLs and the
// extension's TRAN_SITE_URL / PRIVACY_URL." This file proves it without building anything (no builds
// in test:unit): (a) no shipped source hard-codes the origin outside DEFAULT_SITE_ORIGIN, (b) the web
// app's absolute URLs come from resolveSiteUrl() and the prerender origin from resolveSiteOrigin(),
// (c) the extension's __TRAN_SITE_URL__ define follows the variable, (d) the configured build target
// carries its own origin, so every configured build + seo:assert run exercises the variable end to
// end, (e) BASE_PATH on its own moves resolveSiteUrl, the extension define and the oracle
// allowlist together (D-04), so a sibling project site on the shared origin is never allowlisted.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, test, vi } from 'vitest';
import {
	DEFAULT_SITE_ORIGIN,
	resolveSiteOrigin,
	resolveSiteUrl
} from '../apps/web/src/lib/site-config.js';
import { urlAllowlist } from './assert-extension.mjs';
import { TEST_SITE_ORIGIN, targetEnv } from './lib/build-targets.mjs';

const ROOT = join(import.meta.dirname, '..');
const HOST = 'wolfwdavid.github.io';
const ORIGIN_HOME = 'apps/web/src/lib/site-config.js';
const SHIPPED = [
	'apps/web/src',
	'apps/web/static',
	'apps/extension/src',
	'apps/extension/public',
	// A bare 'packages/*/src' pathspec matches nothing (the wildcard must cover the whole path).
	':(glob)packages/*/src/**'
];
const TEST_FILE = /\.(?:browser\.test|test|spec)\.ts$/;
const BINARY = /\.(?:png|jpe?g|webp|ico|woff2|pdf)$/i;
const COMMENT = /^(?:\/\/|\*|\/\*|<!--)/;

const read = (rel: string): string => readFileSync(join(ROOT, rel), 'utf8');

/** `path:line` for every non-comment line that names the site host, except the one allowed home. */
function originLiterals(files: { path: string; text: string }[]): string[] {
	const out: string[] = [];
	for (const { path, text } of files) {
		text.split(/\r?\n/).forEach((line, i) => {
			if (!line.includes(HOST)) return;
			const trimmed = line.trim();
			if (COMMENT.test(trimmed)) return;
			if (path === ORIGIN_HOME && trimmed.startsWith('export const DEFAULT_SITE_ORIGIN')) return;
			out.push(`${path}:${i + 1}`);
		});
	}
	return out;
}

function shippedFiles(): { path: string; text: string }[] {
	const r = spawnSync('git', ['ls-files', '--', ...SHIPPED], { cwd: ROOT, encoding: 'utf8' });
	expect(r.status, r.stderr).toBe(0);
	return r.stdout
		.split('\n')
		.filter((p) => p && !TEST_FILE.test(p) && !BINARY.test(p))
		.map((path) => ({ path, text: read(path) }));
}

describe('(a) no shipped source hard-codes the site origin', () => {
	test('the sweep covers the web, extension and package sources', () => {
		const paths = shippedFiles().map((f) => f.path);
		expect(paths).toContain(ORIGIN_HOME);
		expect(paths).toContain('apps/extension/src/lib/site.ts');
		expect(paths.some((p) => p.startsWith('apps/web/static/'))).toBe(true);
		expect(paths.some((p) => /^packages\/[^/]+\/src\//.test(p))).toBe(true);
		expect(paths.some((p) => TEST_FILE.test(p))).toBe(false);
	});

	test('the host appears on a code line only as DEFAULT_SITE_ORIGIN in site-config.js', () => {
		const files = shippedFiles();
		expect(originLiterals(files)).toEqual([]);
		const home = files.find((f) => f.path === ORIGIN_HOME)?.text ?? '';
		expect(home).toContain(`export const DEFAULT_SITE_ORIGIN = 'https://${HOST}';`);
	});

	test('planted: a hard-coded URL is flagged, comment lines are not', () => {
		const planted = [
			{ path: 'apps/web/src/lib/fake.ts', text: `const u = 'https://${HOST}/x';` },
			{
				path: 'apps/web/src/lib/notes.ts',
				text: [
					`// e.g. https://${HOST}`,
					` * see https://${HOST}/legal/`,
					`/* https://${HOST} */`,
					`<!-- https://${HOST} -->`
				].join('\n')
			},
			{
				path: ORIGIN_HOME,
				text: `export const DEFAULT_SITE_ORIGIN = 'https://${HOST}';\nconst other = '${HOST}';`
			}
		];
		expect(originLiterals(planted)).toEqual(['apps/web/src/lib/fake.ts:1', `${ORIGIN_HOME}:2`]);
	});
});

describe('(b) web absolute URLs come from PUBLIC_SITE_URL', () => {
	test('__SITE_URL__ is resolveSiteUrl(): the validated origin plus the base path', () => {
		expect(read('apps/web/vite.config.ts')).toContain(
			'__SITE_URL__: JSON.stringify(resolveSiteUrl())'
		);
	});

	test('the prerender crawl origin is the validated origin', () => {
		expect(read('apps/web/svelte.config.js')).toContain('origin: resolveSiteOrigin()');
	});

	test('resolveSiteOrigin follows PUBLIC_SITE_URL and defaults when unset or empty', () => {
		expect(resolveSiteOrigin({ PUBLIC_SITE_URL: 'https://probe.example' })).toBe(
			'https://probe.example'
		);
		expect(resolveSiteOrigin({})).toBe(DEFAULT_SITE_ORIGIN);
		expect(resolveSiteOrigin({ PUBLIC_SITE_URL: '' })).toBe(DEFAULT_SITE_ORIGIN);
		expect(() => resolveSiteOrigin({ PUBLIC_SITE_URL: 'https://probe.example/' })).toThrow(
			/PUBLIC_SITE_URL/
		);
	});
});

type WxtVite = { vite: (env: unknown) => { define: Record<string, string> } };

const wxtDefine = async (): Promise<Record<string, string>> => {
	const { default: config } = await import('../apps/extension/wxt.config.ts');
	const cfg = config as unknown as WxtVite;
	return cfg.vite({ mode: 'production', command: 'build' } as never).define;
};

describe('(c) the extension site URL follows PUBLIC_SITE_URL', () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	test('__TRAN_SITE_URL__ is the probe origin when PUBLIC_SITE_URL is set', async () => {
		vi.stubEnv('PUBLIC_SITE_URL', 'https://probe.example');
		vi.stubEnv('BASE_PATH', undefined);
		expect((await wxtDefine()).__TRAN_SITE_URL__).toBe('"https://probe.example"');
	});

	test('__TRAN_SITE_URL__ is the probe origin plus the base path when both are set', async () => {
		vi.stubEnv('PUBLIC_SITE_URL', 'https://probe.example');
		vi.stubEnv('BASE_PATH', '/tran_real_estate');
		expect((await wxtDefine()).__TRAN_SITE_URL__).toBe('"https://probe.example/tran_real_estate"');
	});

	test('__TRAN_SITE_URL__ is the default origin when both are unset', async () => {
		vi.stubEnv('PUBLIC_SITE_URL', undefined);
		vi.stubEnv('BASE_PATH', undefined);
		const define = await wxtDefine();
		expect(define.__TRAN_SITE_URL__).toBe(JSON.stringify(DEFAULT_SITE_ORIGIN));
		expect(define.__TRAN_SITE_URL__).toBe('"https://wolfwdavid.github.io"');
		// The site URL is the only define: no legacy origin-only key survives.
		expect(Object.keys(define)).toEqual(['__TRAN_SITE_URL__']);
	});

	test('TRAN_SITE_URL comes from the define; TRAN_ORIGIN and PRIVACY_URL derive from it', () => {
		const site = read('apps/extension/src/lib/site.ts');
		expect(site).toContain('export const TRAN_SITE_URL: string = __TRAN_SITE_URL__;');
		expect(site).toContain('export const TRAN_ORIGIN: string = new URL(TRAN_SITE_URL).origin;');
		expect(site).toContain(
			'export const PRIVACY_URL = `${TRAN_SITE_URL}/legal/privacy/#browser-extension`;'
		);
		// The only build-time global the module declares or reads is the site URL.
		expect(new Set(site.match(/__[A-Z]+(?:_[A-Z]+)*__/g))).toEqual(new Set(['__TRAN_SITE_URL__']));
	});
});

describe('(e) BASE_PATH alone moves every absolute URL', () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	const PROBE_URL = 'https://wolfwdavid.github.io/probe_base';

	test('resolveSiteUrl() appends the base path to the default origin', () => {
		vi.stubEnv('PUBLIC_SITE_URL', undefined);
		vi.stubEnv('BASE_PATH', '/probe_base');
		expect(resolveSiteUrl()).toBe(PROBE_URL);
		expect(resolveSiteUrl().endsWith('/probe_base')).toBe(true);
	});

	test('the extension define follows the base path', async () => {
		vi.stubEnv('PUBLIC_SITE_URL', undefined);
		vi.stubEnv('BASE_PATH', '/probe_base');
		expect((await wxtDefine()).__TRAN_SITE_URL__).toBe(JSON.stringify(PROBE_URL));
	});

	test('the oracle allowlists the project site, not the bare shared origin', () => {
		vi.stubEnv('PUBLIC_SITE_URL', undefined);
		vi.stubEnv('BASE_PATH', '/probe_base');
		const list = urlAllowlist();
		expect(list).toContain(`${PROBE_URL}/`);
		expect(list).not.toContain('https://wolfwdavid.github.io/');
		expect(list).toContain(`${resolveSiteUrl()}/`);
	});
});

describe('(d) the configured target exercises the variable on every run', () => {
	test('its PUBLIC_SITE_URL is a valid origin that is not the default', () => {
		const t = targetEnv('configured', {});
		expect(t.PUBLIC_SITE_URL).toBe(TEST_SITE_ORIGIN);
		expect(resolveSiteOrigin(t)).toBe(TEST_SITE_ORIGIN);
		expect(TEST_SITE_ORIGIN).not.toBe(DEFAULT_SITE_ORIGIN);
	});

	test('an owner PUBLIC_SITE_URL in the env does not replace it', () => {
		const t = targetEnv('configured', { PUBLIC_SITE_URL: 'https://owner.example' });
		expect(t.PUBLIC_SITE_URL).toBe(TEST_SITE_ORIGIN);
	});
});
