// The single build-target table read by build-web.mjs, the CSP oracle and the E2E harness.
import { describe, expect, test } from 'vitest';
import {
	DEFAULT_SITE_ORIGIN,
	resolveAnalytics,
	resolveContactEmail,
	resolveSiteOrigin,
	resolveWeb3formsKey
} from '../apps/web/src/lib/site-config.js';
import {
	OWNER_KEYS,
	TARGETS,
	TEST_CONTACT_EMAIL,
	TEST_FORM_KEY,
	TEST_SITE_ORIGIN,
	TEST_WEBSITE_ID,
	targetEnv
} from './lib/build-targets.mjs';

const OWNER_ENV = {
	PUBLIC_ANALYTICS_HOST: 'https://stats.example.org',
	PUBLIC_ANALYTICS_WEBSITE_ID: '11111111-1111-4111-8111-111111111111',
	PUBLIC_WEB3FORMS_KEY: '22222222-2222-4222-8222-222222222222',
	PUBLIC_CONTACT_EMAIL: 'owner@example.org'
};

describe('build targets', () => {
	test('exactly three named targets and four owner settings', () => {
		expect(TARGETS).toEqual(['root', 'sub', 'configured']);
		expect(OWNER_KEYS).toEqual([
			'PUBLIC_ANALYTICS_HOST',
			'PUBLIC_ANALYTICS_WEBSITE_ID',
			'PUBLIC_WEB3FORMS_KEY',
			'PUBLIC_CONTACT_EMAIL'
		]);
	});

	test('root with an empty env is the deploy build at the site root', () => {
		expect(targetEnv('root', {})).toEqual({ BASE_PATH: '', BUILD_DIR: 'build' });
	});

	test('root passes the owner settings and site URL through (deploy what you test)', () => {
		const env = { ...OWNER_ENV, PUBLIC_SITE_URL: 'https://tools.example.org', HOME: '/home/x' };
		expect(targetEnv('root', env)).toEqual({
			BASE_PATH: '',
			BUILD_DIR: 'build',
			...OWNER_ENV,
			PUBLIC_SITE_URL: 'https://tools.example.org'
		});
	});

	test('sub blanks every owner setting so owner values never leak into it', () => {
		const t = targetEnv('sub', { PUBLIC_WEB3FORMS_KEY: 'x' });
		expect(t).toEqual({
			BASE_PATH: '/tran_real_estate',
			BUILD_DIR: 'build-sub',
			PUBLIC_ANALYTICS_HOST: '',
			PUBLIC_ANALYTICS_WEBSITE_ID: '',
			PUBLIC_WEB3FORMS_KEY: '',
			PUBLIC_CONTACT_EMAIL: ''
		});
		const full = targetEnv('sub', OWNER_ENV);
		for (const k of OWNER_KEYS) expect(full[k]).toBe('');
	});

	test('sub still passes the site URL through', () => {
		expect(targetEnv('sub', { PUBLIC_SITE_URL: 'https://tools.example.org' }).PUBLIC_SITE_URL).toBe(
			'https://tools.example.org'
		);
	});

	test('configured carries a test value for every owner setting and its own site origin', () => {
		expect(targetEnv('configured', {})).toEqual({
			BASE_PATH: '',
			BUILD_DIR: 'build-configured',
			PUBLIC_ANALYTICS_HOST: 'http://127.0.0.1:4275',
			PUBLIC_ANALYTICS_WEBSITE_ID: TEST_WEBSITE_ID,
			PUBLIC_WEB3FORMS_KEY: TEST_FORM_KEY,
			PUBLIC_CONTACT_EMAIL: 'hello@example.com',
			PUBLIC_SITE_URL: 'https://tran-configured.example'
		});
		expect(TEST_CONTACT_EMAIL).toBe('hello@example.com');
		expect(TEST_SITE_ORIGIN).toBe('https://tran-configured.example');
	});

	test('configured ignores owner values and takes the collector port from E2E_PORT_ATTACKER', () => {
		const t = targetEnv('configured', { ...OWNER_ENV, E2E_PORT_ATTACKER: '5123' });
		expect(t.PUBLIC_ANALYTICS_HOST).toBe('http://127.0.0.1:5123');
		expect(t.PUBLIC_WEB3FORMS_KEY).toBe(TEST_FORM_KEY);
		expect(t.PUBLIC_CONTACT_EMAIL).toBe(TEST_CONTACT_EMAIL);
	});

	test('configured ignores an owner PUBLIC_SITE_URL (LIVE-08: every run exercises the variable)', () => {
		const t = targetEnv('configured', { ...OWNER_ENV, PUBLIC_SITE_URL: 'https://owner.example' });
		expect(t.PUBLIC_SITE_URL).toBe(TEST_SITE_ORIGIN);
	});

	test('every configured value passes the matching site-config resolver', () => {
		const t = targetEnv('configured', {});
		expect(resolveAnalytics(t)).toEqual({
			host: 'http://127.0.0.1:4275',
			websiteId: TEST_WEBSITE_ID
		});
		expect(resolveWeb3formsKey(t)).toBe(TEST_FORM_KEY);
		expect(resolveContactEmail(t)).toBe(TEST_CONTACT_EMAIL);
		expect(resolveSiteOrigin(t)).toBe(TEST_SITE_ORIGIN);
		expect(resolveSiteOrigin(t)).not.toBe(DEFAULT_SITE_ORIGIN);
	});

	test('the sub target resolves to everything off', () => {
		const t = targetEnv('sub', OWNER_ENV);
		expect(resolveAnalytics(t)).toEqual({ host: '', websiteId: '' });
		expect(resolveWeb3formsKey(t)).toBe('');
		expect(resolveContactEmail(t)).toBe('');
	});

	test('an unknown target throws', () => {
		expect(() => targetEnv('nope', {})).toThrow(/nope/);
	});

	test('each call returns a fresh object', () => {
		const a = targetEnv('configured', {});
		a.BUILD_DIR = 'mutated';
		expect(targetEnv('configured', {}).BUILD_DIR).toBe('build-configured');
	});
});

describe('BASE_PATH (D-02)', () => {
	test('root with no BASE_PATH is the deploy build at the site root', () => {
		expect(targetEnv('root', {})).toEqual({ BASE_PATH: '', BUILD_DIR: 'build' });
		expect(targetEnv('root', { BASE_PATH: '' }).BASE_PATH).toBe('');
	});

	test('root passes a root-relative BASE_PATH through (the owner knob)', () => {
		expect(targetEnv('root', { BASE_PATH: '/tran_real_estate' }).BASE_PATH).toBe(
			'/tran_real_estate'
		);
	});

	test('root rejects a malformed BASE_PATH by name (Git Bash path conversion)', () => {
		expect(() => targetEnv('root', { BASE_PATH: 'C:/Program Files/Git/tran_real_estate' })).toThrow(
			/BASE_PATH must be/
		);
	});

	test('sub keeps its own base regardless of env.BASE_PATH', () => {
		expect(targetEnv('sub', { BASE_PATH: '/other' }).BASE_PATH).toBe('/tran_real_estate');
	});

	test('configured keeps the site root regardless of env.BASE_PATH', () => {
		expect(targetEnv('configured', { BASE_PATH: '/other' }).BASE_PATH).toBe('');
	});
});
