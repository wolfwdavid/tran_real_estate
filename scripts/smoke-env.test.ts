// The smoke suite's fail-closed env gate (SMOKE-01) and the static shape of its Playwright config.
// The config is read as TEXT, never imported: importing it would run the gate against this
// process's env and pull Playwright into the scripts project.
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { parseSmokeEnv } from '../apps/web/tests/smoke/env.js';

const SHA = 'a'.repeat(40);
const BASE = 'https://wolfwdavid.github.io/';
const ok = (extra: Record<string, string | undefined> = {}) =>
	parseSmokeEnv({ SMOKE_BASE_URL: BASE, SMOKE_EXPECT_VERSION: SHA, ...extra });

describe('parseSmokeEnv: SMOKE_BASE_URL', () => {
	test('missing base throws', () => {
		expect(() => parseSmokeEnv({})).toThrow(/SMOKE_BASE_URL is required/);
		expect(() => parseSmokeEnv({ SMOKE_BASE_URL: '', SMOKE_EXPECT_VERSION: SHA })).toThrow(
			/SMOKE_BASE_URL is required/
		);
	});

	test('a non-URL throws', () => {
		expect(() => ok({ SMOKE_BASE_URL: 'not a url' })).toThrow(/not an absolute URL/);
	});

	test('a non-http(s) scheme throws', () => {
		expect(() => ok({ SMOKE_BASE_URL: 'ftp://x/' })).toThrow(/must be https/);
	});

	test('a base without its trailing slash throws', () => {
		expect(() => ok({ SMOKE_BASE_URL: 'https://wolfwdavid.github.io' })).toThrow(/end with \//);
	});

	test('http on a non-loopback host throws with or without the flag', () => {
		expect(() => ok({ SMOKE_BASE_URL: 'http://example.com/' })).toThrow(/must be https/);
		expect(() => ok({ SMOKE_BASE_URL: 'http://example.com/', SMOKE_ALLOW_HTTP: '1' })).toThrow(
			/must be https/
		);
	});

	test.each(['http://127.0.0.1:4273/', 'http://localhost:4273/', 'http://[::1]:4273/'])(
		'loopback %s needs SMOKE_ALLOW_HTTP=1 exactly',
		(url) => {
			expect(() => ok({ SMOKE_BASE_URL: url })).toThrow(/must be https/);
			expect(() => ok({ SMOKE_BASE_URL: url, SMOKE_ALLOW_HTTP: 'true' })).toThrow(/must be https/);
			expect(ok({ SMOKE_BASE_URL: url, SMOKE_ALLOW_HTTP: '1' }).baseUrl).toBe(url);
		}
	);

	test('a loopback-looking host that is not loopback stays https-only', () => {
		expect(() =>
			ok({ SMOKE_BASE_URL: 'http://127.0.0.1.evil.example/', SMOKE_ALLOW_HTTP: '1' })
		).toThrow(/must be https/);
	});
});

describe('parseSmokeEnv: SMOKE_EXPECT_VERSION', () => {
	test.each([undefined, '', 'abc1234', 'A'.repeat(40), '2026-10-29T12:00:00Z', 'a'.repeat(41)])(
		'%s is rejected',
		(v) => {
			expect(() => ok({ SMOKE_EXPECT_VERSION: v })).toThrow(/40-hex/);
		}
	);
});

describe('parseSmokeEnv: valid env', () => {
	test('a valid https base and version returns the parsed env with defaults', () => {
		expect(ok()).toEqual({ baseUrl: BASE, siteUrl: BASE, expectVersion: SHA, analyticsHost: '' });
	});

	test('SMOKE_SITE_URL is honoured', () => {
		const sub = 'https://wolfwdavid.github.io/tran_real_estate/';
		expect(
			ok({ SMOKE_BASE_URL: sub, SMOKE_SITE_URL: 'https://wolfwdavid.github.io/' }).siteUrl
		).toBe('https://wolfwdavid.github.io/');
	});

	test('SMOKE_SITE_URL without its trailing slash throws', () => {
		expect(() => ok({ SMOKE_SITE_URL: 'https://wolfwdavid.github.io' })).toThrow(
			/SMOKE_SITE_URL must end with \//
		);
	});

	test('SMOKE_SITE_URL over plain http throws', () => {
		expect(() => ok({ SMOKE_SITE_URL: 'http://evil.example/' })).toThrow(
			/SMOKE_SITE_URL must be https/
		);
		expect(() => ok({ SMOKE_SITE_URL: 'http://evil.example/', SMOKE_ALLOW_HTTP: '1' })).toThrow(
			/SMOKE_SITE_URL must be https/
		);
	});
});

describe('parseSmokeEnv: SMOKE_ANALYTICS_HOST', () => {
	test('empty is fine', () => {
		expect(ok({ SMOKE_ANALYTICS_HOST: '' }).analyticsHost).toBe('');
	});

	test('an https origin is fine', () => {
		expect(ok({ SMOKE_ANALYTICS_HOST: 'https://gateway.umami.is' }).analyticsHost).toBe(
			'https://gateway.umami.is'
		);
	});

	test('a loopback http origin needs the flag', () => {
		expect(() => ok({ SMOKE_ANALYTICS_HOST: 'http://127.0.0.1:4275' })).toThrow(
			/SMOKE_ANALYTICS_HOST/
		);
		expect(
			ok({ SMOKE_ANALYTICS_HOST: 'http://127.0.0.1:4275', SMOKE_ALLOW_HTTP: '1' }).analyticsHost
		).toBe('http://127.0.0.1:4275');
	});

	test('a trailing slash or path is rejected', () => {
		expect(() => ok({ SMOKE_ANALYTICS_HOST: 'https://gateway.umami.is/' })).toThrow(
			/SMOKE_ANALYTICS_HOST/
		);
		expect(() => ok({ SMOKE_ANALYTICS_HOST: 'https://gateway.umami.is/api' })).toThrow(
			/SMOKE_ANALYTICS_HOST/
		);
	});

	test('a non-loopback http origin is rejected even with the flag', () => {
		expect(() =>
			ok({ SMOKE_ANALYTICS_HOST: 'http://stats.example.org', SMOKE_ALLOW_HTTP: '1' })
		).toThrow(/SMOKE_ANALYTICS_HOST/);
	});
});

describe('playwright.smoke.config.ts (read as text)', () => {
	const text = readFileSync(
		new URL('../apps/web/playwright.smoke.config.ts', import.meta.url),
		'utf8'
	);

	test('zero retries, fail on flaky, forbid only, 5-minute global timeout', () => {
		expect(text).toContain('retries: 0,');
		expect(text).toContain('failOnFlakyTests: true');
		expect(text).toContain('forbidOnly: true');
		expect(text).toContain('globalTimeout: 300_000');
	});

	test('no web server block: the suite only targets an already-running origin', () => {
		expect(text).not.toContain('web' + 'Server');
	});

	test('the env gate runs at config load, before defineConfig', () => {
		const gate = text.indexOf('parseSmokeEnv(process.env)');
		expect(gate).toBeGreaterThan(-1);
		expect(gate).toBeLessThan(text.indexOf('defineConfig({'));
	});

	test('spec files only, never the e2e suite', () => {
		expect(text).toContain("testDir: 'tests/smoke'");
		expect(text).toContain('testMatch: /\\.smoke\\.ts$/');
	});
});
