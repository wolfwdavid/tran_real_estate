// DEBT-04 (audit low finding; 13 D-04): the extension's TRAN_SITE_URL / PRIVACY_URL, evaluated from the real module, equal the web helper resolveSiteUrl(); mutation proof in 14-04-SUMMARY.md.
//
// site-url.test.ts group (c) pins the source shape of site.ts as text. This file evaluates it: the
// define each config computes is stubbed in as the global the bundler folds in, the real module is
// imported fresh, and its exports are compared with what the web app composes for the same env.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, test, vi } from 'vitest';

const ROOT = join(import.meta.dirname, '..');
const PRIVACY_PAGE = join(
	ROOT,
	'apps',
	'web',
	'src',
	'routes',
	'(marketing)',
	'legal',
	'privacy',
	'+page.svelte'
);

type Env = { PUBLIC_SITE_URL?: string; BASE_PATH?: string };
type WxtVite = { vite: (env: unknown) => { define: Record<string, string> } };
type ViteConfig = { define?: Record<string, string> };

const CASES: Array<[string, Env]> = [
	['A: PUBLIC_SITE_URL and BASE_PATH unset', {}],
	['B: the live project site base path', { BASE_PATH: '/tran_real_estate' }],
	['C: a custom origin and base path', { PUBLIC_SITE_URL: 'https://example.org', BASE_PATH: '/x' }]
];

// Undefined deletes the variable for the case, so case A is genuinely unset.
const stubSiteEnv = (env: Env): void => {
	vi.stubEnv('PUBLIC_SITE_URL', env.PUBLIC_SITE_URL);
	vi.stubEnv('BASE_PATH', env.BASE_PATH);
};

const expectedSiteUrl = async (): Promise<string> => {
	vi.resetModules();
	const { resolveSiteUrl } = await import('../apps/web/src/lib/site-config.js');
	return resolveSiteUrl(process.env);
};

// Copied from site-url.test.ts (a test file exports nothing): WXT's vite() runs per build, so the
// define reads the env at call time. Returns the parsed string the bundler substitutes.
const wxtDefine = async (): Promise<string> => {
	vi.resetModules();
	const { default: config } = await import('../apps/extension/wxt.config.ts');
	const cfg = config as unknown as WxtVite;
	const define = cfg.vite({ mode: 'production', command: 'build' } as never).define;
	return JSON.parse(define.__TRAN_SITE_URL__) as string;
};

// The two extension Vitest configs compute their define at module load, so each import follows a
// module reset under the stubbed env. Function-form configs are resolved the same way as WXT's.
const vitestDefine = async (load: () => Promise<{ default: unknown }>): Promise<string> => {
	vi.resetModules();
	const { default: exported } = await load();
	const config = (
		typeof exported === 'function'
			? await (exported as (env: unknown) => unknown)({ mode: 'test', command: 'serve' })
			: exported
	) as ViteConfig;
	const raw = config.define?.__TRAN_SITE_URL__;
	expect(raw, '__TRAN_SITE_URL__ define missing').toBeTypeOf('string');
	return JSON.parse(raw as string) as string;
};

afterEach(() => {
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
	vi.resetModules();
});

describe.each(CASES)('origin parity, %s', (_name, env) => {
	test('the WXT define equals resolveSiteUrl()', async () => {
		stubSiteEnv(env);
		const expected = await expectedSiteUrl();
		expect(await wxtDefine()).toBe(expected);
	});

	test('the evaluated site.ts exports TRAN_SITE_URL and PRIVACY_URL from that define', async () => {
		stubSiteEnv(env);
		const expected = await expectedSiteUrl();
		const define = await wxtDefine();
		vi.stubGlobal('__TRAN_SITE_URL__', define); // what the bundler folds in
		vi.resetModules();
		const site = await import('../apps/extension/src/lib/site.ts');
		expect(site.TRAN_SITE_URL).toBe(expected);
		expect(site.PRIVACY_URL).toBe(`${expected}/legal/privacy/#browser-extension`);
	});

	test('the WXT and both extension Vitest defines agree', async () => {
		stubSiteEnv(env);
		const expected = await expectedSiteUrl();
		const wxt = await wxtDefine();
		const unit = await vitestDefine(() => import('../apps/extension/vitest.config.ts'));
		const browser = await vitestDefine(() => import('../apps/extension/vitest.browser.config.ts'));
		expect([wxt, unit, browser]).toEqual([expected, expected, expected]);
	});
});

describe('the privacy anchor PRIVACY_URL targets', () => {
	test('the privacy page source carries the browser-extension heading id', () => {
		const src = readFileSync(PRIVACY_PAGE, 'utf8');
		expect(src).toMatch(/<h2 id="browser-extension">/);
	});
});
