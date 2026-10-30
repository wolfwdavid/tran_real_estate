// Build-time owner settings (10-RESEARCH Pattern 1). Read from Node `process.env` here and nowhere
// else, never through Kit's static public env module (that import fails the build when a variable
// is unset, Pitfall 2). Every setting is optional: unset means "off", a malformed value is a named build
// error. Rejected keys and website ids are never echoed into an error message.
import { resolveBasePath } from './base-path.js';

const ORIGIN = /^https:\/\/[a-z0-9.-]+(:\d+)?$/i;
const LOOPBACK = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[a-z]{2,}$/i;

/** Default site origin: the owner's GitHub Pages origin. The project site lives under BASE_PATH (/tran_real_estate) on it (decision 2026-10-29). */
export const DEFAULT_SITE_ORIGIN = 'https://wolfwdavid.github.io';

/**
 * The site origin from PUBLIC_SITE_URL: an https origin with no path or trailing slash. Empty means
 * unset (CI expands an unset repository variable to ''), like every other owner setting.
 * @param {Record<string, string | undefined>} [env]
 * @returns {string}
 */
export function resolveSiteOrigin(env = process.env) {
	const o = env.PUBLIC_SITE_URL || DEFAULT_SITE_ORIGIN;
	if (!ORIGIN.test(o)) {
		throw new Error(
			`PUBLIC_SITE_URL must be an https origin with no path or trailing slash (got ${JSON.stringify(o)})`
		);
	}
	return o;
}

/**
 * Absolute site URL with no trailing slash: the validated PUBLIC_SITE_URL origin plus the validated
 * BASE_PATH. The one place the web app (__SITE_URL__), the extension (__TRAN_SITE_URL__) and the
 * extension oracle agree on, so an origin/base mismatch is impossible (D-04).
 * @param {Record<string, string | undefined>} [env]
 * @returns {string}
 */
export function resolveSiteUrl(env = process.env) {
	return resolveSiteOrigin(env) + resolveBasePath(env);
}

/**
 * Umami settings. Both set or both empty; anything else is a configuration error, never a silent
 * half-config.
 * @param {Record<string, string | undefined>} [env]
 * @returns {{ host: string; websiteId: string }}
 */
export function resolveAnalytics(env = process.env) {
	const host = env.PUBLIC_ANALYTICS_HOST ?? '';
	const websiteId = env.PUBLIC_ANALYTICS_WEBSITE_ID ?? '';
	if (!host && !websiteId) return { host: '', websiteId: '' };
	if (!(ORIGIN.test(host) || LOOPBACK.test(host)) || !UUID.test(websiteId)) {
		throw new Error(
			'PUBLIC_ANALYTICS_HOST must be an https origin (or a loopback http origin for test builds) and PUBLIC_ANALYTICS_WEBSITE_ID a UUID: set both or neither'
		);
	}
	return { host, websiteId };
}

/**
 * The site's own Web3Forms access key (public by design), or '' when unset.
 * @param {Record<string, string | undefined>} [env]
 * @returns {string}
 */
export function resolveWeb3formsKey(env = process.env) {
	const k = env.PUBLIC_WEB3FORMS_KEY ?? '';
	if (k && !UUID.test(k)) {
		throw new Error('PUBLIC_WEB3FORMS_KEY must be empty or a Web3Forms access key (UUID)');
	}
	return k;
}

/**
 * A public contact address, or '' when unset.
 * @param {Record<string, string | undefined>} [env]
 * @returns {string}
 */
export function resolveContactEmail(env = process.env) {
	const e = env.PUBLIC_CONTACT_EMAIL ?? '';
	if (e && !EMAIL.test(e)) {
		throw new Error(
			`PUBLIC_CONTACT_EMAIL must be empty or a plain address like name@example.com (got ${JSON.stringify(e)})`
		);
	}
	return e;
}
