import { describe, expect, test } from 'vitest';
import {
	DEFAULT_SITE_ORIGIN,
	resolveAnalytics,
	resolveContactEmail,
	resolveSiteOrigin,
	resolveSiteUrl,
	resolveWeb3formsKey
} from './site-config.js';

// Low-entropy test UUIDs (gitleaks-safe, 10-RESEARCH Pitfall 10).
const FORM_KEY = '00000000-0000-4000-8000-000000000000';
const WEBSITE_ID = '00000000-0000-4000-8000-000000000001';

/** Runs `fn`, expects it to throw, and returns the error text. */
function errorText(fn: () => unknown): string {
	try {
		fn();
	} catch (err) {
		return String(err);
	}
	throw new Error('expected a throw');
}

describe('resolveSiteOrigin', () => {
	test("defaults to the owner's Pages origin", () => {
		expect(resolveSiteOrigin({})).toBe('https://wolfwdavid.github.io');
		expect(DEFAULT_SITE_ORIGIN).toBe('https://wolfwdavid.github.io');
	});

	test('treats an empty value as unset (CI expands an unset repository variable to empty)', () => {
		expect(resolveSiteOrigin({ PUBLIC_SITE_URL: '' })).toBe(DEFAULT_SITE_ORIGIN);
	});

	test('accepts an https origin', () => {
		expect(resolveSiteOrigin({ PUBLIC_SITE_URL: 'https://example.org' })).toBe(
			'https://example.org'
		);
	});

	test.each(['http://x.org', 'https://x.org/', 'https://x.org/path', 'javascript:alert(1)'])(
		'rejects %j with a named error',
		(value) => {
			expect(() => resolveSiteOrigin({ PUBLIC_SITE_URL: value })).toThrow(/PUBLIC_SITE_URL/);
		}
	);
});

describe('resolveSiteUrl', () => {
	test("defaults to the owner's Pages origin with no base path", () => {
		expect(resolveSiteUrl({})).toBe('https://wolfwdavid.github.io');
	});

	test('joins the validated origin and the validated base path', () => {
		expect(
			resolveSiteUrl({ PUBLIC_SITE_URL: 'https://probe.example', BASE_PATH: '/tran_real_estate' })
		).toBe('https://probe.example/tran_real_estate');
	});

	test('BASE_PATH alone appends to the default origin (the live project site)', () => {
		expect(resolveSiteUrl({ BASE_PATH: '/tran_real_estate' })).toBe(
			'https://wolfwdavid.github.io/tran_real_estate'
		);
	});

	test('treats empty values as unset (CI expands unset repository variables to empty)', () => {
		expect(resolveSiteUrl({ PUBLIC_SITE_URL: '', BASE_PATH: '' })).toBe(
			'https://wolfwdavid.github.io'
		);
	});

	test('rejects a Git Bash path-converted BASE_PATH with the base-path error', () => {
		expect(() => resolveSiteUrl({ BASE_PATH: 'C:/Program Files/Git/tran_real_estate' })).toThrow(
			/BASE_PATH must be/
		);
	});

	test('does not loosen the origin validator: a path in PUBLIC_SITE_URL is still rejected', () => {
		expect(() =>
			resolveSiteUrl({ PUBLIC_SITE_URL: 'https://wolfwdavid.github.io/tran_real_estate' })
		).toThrow(/PUBLIC_SITE_URL must be an https origin/);
	});
});

describe('resolveAnalytics', () => {
	test('is a no-op when neither variable is set', () => {
		expect(resolveAnalytics({})).toEqual({ host: '', websiteId: '' });
	});

	test('is a no-op when both variables are empty', () => {
		expect(
			resolveAnalytics({ PUBLIC_ANALYTICS_HOST: '', PUBLIC_ANALYTICS_WEBSITE_ID: '' })
		).toEqual({ host: '', websiteId: '' });
	});

	test('returns both values when both are valid', () => {
		expect(
			resolveAnalytics({
				PUBLIC_ANALYTICS_HOST: 'https://stats.example.org',
				PUBLIC_ANALYTICS_WEBSITE_ID: WEBSITE_ID
			})
		).toEqual({ host: 'https://stats.example.org', websiteId: WEBSITE_ID });
	});

	test.each(['http://127.0.0.1:4275', 'http://localhost:4275'])(
		'accepts the loopback test host %s',
		(host) => {
			expect(
				resolveAnalytics({ PUBLIC_ANALYTICS_HOST: host, PUBLIC_ANALYTICS_WEBSITE_ID: WEBSITE_ID })
			).toEqual({ host, websiteId: WEBSITE_ID });
		}
	);

	test.each([
		['host only', { PUBLIC_ANALYTICS_HOST: 'https://stats.example.org' }],
		['id only', { PUBLIC_ANALYTICS_WEBSITE_ID: WEBSITE_ID }],
		[
			'non-loopback http host',
			{ PUBLIC_ANALYTICS_HOST: 'http://stats.example.org', PUBLIC_ANALYTICS_WEBSITE_ID: WEBSITE_ID }
		],
		[
			'trailing slash',
			{
				PUBLIC_ANALYTICS_HOST: 'https://stats.example.org/',
				PUBLIC_ANALYTICS_WEBSITE_ID: WEBSITE_ID
			}
		],
		[
			'non-UUID id',
			{
				PUBLIC_ANALYTICS_HOST: 'https://stats.example.org',
				PUBLIC_ANALYTICS_WEBSITE_ID: 'not-a-uuid'
			}
		]
	])('rejects %s', (_label, env) => {
		expect(() => resolveAnalytics(env)).toThrow(/set both or neither/);
	});

	test('never echoes a rejected website id', () => {
		const planted = 'planted-website-id-value-xyz';
		const text = errorText(() =>
			resolveAnalytics({
				PUBLIC_ANALYTICS_HOST: 'https://stats.example.org',
				PUBLIC_ANALYTICS_WEBSITE_ID: planted
			})
		);
		expect(text).toContain('set both or neither');
		expect(text).not.toContain(planted);
	});
});

describe('resolveWeb3formsKey', () => {
	test('defaults to empty', () => {
		expect(resolveWeb3formsKey({})).toBe('');
	});

	test('accepts a UUID access key', () => {
		expect(resolveWeb3formsKey({ PUBLIC_WEB3FORMS_KEY: FORM_KEY })).toBe(FORM_KEY);
	});

	test.each(['abc', ` ${FORM_KEY} `])('rejects %j with a named error', (value) => {
		expect(() => resolveWeb3formsKey({ PUBLIC_WEB3FORMS_KEY: value })).toThrow(
			/PUBLIC_WEB3FORMS_KEY/
		);
	});

	test('never echoes a rejected key', () => {
		const planted = 'planted-form-key-value-xyz';
		const text = errorText(() => resolveWeb3formsKey({ PUBLIC_WEB3FORMS_KEY: planted }));
		expect(text).toContain('PUBLIC_WEB3FORMS_KEY');
		expect(text).not.toContain(planted);
	});
});

describe('resolveContactEmail', () => {
	test('defaults to empty', () => {
		expect(resolveContactEmail({})).toBe('');
	});

	test('accepts a plain address', () => {
		expect(resolveContactEmail({ PUBLIC_CONTACT_EMAIL: 'hello@example.com' })).toBe(
			'hello@example.com'
		);
	});

	test.each(['nope', 'a@b', 'a b@example.com', '<x@example.com>'])(
		'rejects %j with a named error',
		(value) => {
			expect(() => resolveContactEmail({ PUBLIC_CONTACT_EMAIL: value })).toThrow(
				/PUBLIC_CONTACT_EMAIL/
			);
		}
	);
});
