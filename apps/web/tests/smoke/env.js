// The smoke suite's fail-closed gate (SMOKE-01). Loaded by playwright.smoke.config.ts at config
// load and by scripts/smoke.mjs; a bad environment throws before anything runs.
const LOOPBACK = /^http:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?\//;
const LOOPBACK_ORIGIN = /^http:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/;
const HTTPS_ORIGIN = /^https:\/\/[a-z0-9.-]+(:\d+)?$/i;
const SHA = /^[0-9a-f]{40}$/;

/** @typedef {{ baseUrl: string, siteUrl: string, expectVersion: string, analyticsHost: string }} SmokeEnv */

/**
 * Validate one smoke URL: absolute, trailing slash, https (or loopback http with the flag).
 * @param {string} name
 * @param {string} value
 * @param {boolean} allowHttp
 */
function checkUrl(name, value, allowHttp) {
	/** @type {URL} */
	let url;
	try {
		url = new URL(value);
	} catch {
		throw new Error(`${name} is not an absolute URL (got ${JSON.stringify(value)})`);
	}
	if (!value.endsWith('/')) {
		throw new Error(`${name} must end with / (got ${JSON.stringify(value)})`);
	}
	const httpOk = allowHttp && LOOPBACK.test(value);
	if (url.protocol !== 'https:' && !httpOk) {
		throw new Error(
			`${name} must be https:// (http only for loopback with SMOKE_ALLOW_HTTP=1) (got ${JSON.stringify(value)})`
		);
	}
}

/**
 * Parse and validate the smoke environment. Throws on anything missing or unsafe.
 * @param {Record<string, string | undefined>} env
 * @returns {SmokeEnv}
 */
export function parseSmokeEnv(env) {
	const base = env.SMOKE_BASE_URL;
	if (!base) {
		throw new Error(
			'SMOKE_BASE_URL is required (the deployed origin + base path, with a trailing slash)'
		);
	}
	const allowHttp = env.SMOKE_ALLOW_HTTP === '1';
	checkUrl('SMOKE_BASE_URL', base, allowHttp);
	const siteUrl = env.SMOKE_SITE_URL || base;
	checkUrl('SMOKE_SITE_URL', siteUrl, allowHttp);
	const expectVersion = env.SMOKE_EXPECT_VERSION ?? '';
	if (!SHA.test(expectVersion)) {
		throw new Error('SMOKE_EXPECT_VERSION must be the 40-hex build SHA');
	}
	const analyticsHost = env.SMOKE_ANALYTICS_HOST ?? '';
	if (
		analyticsHost !== '' &&
		!HTTPS_ORIGIN.test(analyticsHost) &&
		!(allowHttp && LOOPBACK_ORIGIN.test(analyticsHost))
	) {
		throw new Error(
			'SMOKE_ANALYTICS_HOST must be empty or an https origin with no path or trailing slash (loopback http only with SMOKE_ALLOW_HTTP=1)'
		);
	}
	return { baseUrl: base, siteUrl, expectVersion, analyticsHost };
}
