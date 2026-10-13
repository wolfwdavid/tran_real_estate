// The one build-target table (10-RESEARCH Pattern 11). build-web.mjs, the CSP oracle and the E2E
// harness all read their per-target env from here, so what CI tests is what it deploys.
//
//   root        the deploy build at the site root; owner settings pass through from the env
//   sub         the /tran_real_estate sub-path build; every owner setting is blank
//   configured  a root-path build with a test value for every owner setting (E2E only)

/** Web3Forms-shaped test key; never a real access key. */
export const TEST_FORM_KEY = '00000000-0000-4000-8000-000000000000';
/** Umami-shaped test website id. */
export const TEST_WEBSITE_ID = '00000000-0000-4000-8000-000000000001';
export const TEST_CONTACT_EMAIL = 'hello@example.com';
export const OWNER_KEYS = [
	'PUBLIC_ANALYTICS_HOST',
	'PUBLIC_ANALYTICS_WEBSITE_ID',
	'PUBLIC_WEB3FORMS_KEY',
	'PUBLIC_CONTACT_EMAIL'
];
export const TARGETS = ['root', 'sub', 'configured'];

/**
 * The env overlay for one build target.
 * @param {string} name
 * @param {Record<string, string | undefined>} [env]
 * @returns {Record<string, string>}
 */
export function targetEnv(name, env = process.env) {
	/** @type {Record<string, string>} */
	const site = env.PUBLIC_SITE_URL === undefined ? {} : { PUBLIC_SITE_URL: env.PUBLIC_SITE_URL };
	if (name === 'root') {
		/** @type {Record<string, string>} */
		const owner = {};
		for (const k of OWNER_KEYS) {
			const v = env[k];
			if (v !== undefined) owner[k] = v;
		}
		return { BASE_PATH: '', BUILD_DIR: 'build', ...owner, ...site };
	}
	if (name === 'sub') {
		return {
			BASE_PATH: '/tran_real_estate',
			BUILD_DIR: 'build-sub',
			...Object.fromEntries(OWNER_KEYS.map((k) => [k, ''])),
			...site
		};
	}
	if (name === 'configured') {
		const port = Number(env.E2E_PORT_ATTACKER ?? 4275);
		return {
			BASE_PATH: '',
			BUILD_DIR: 'build-configured',
			PUBLIC_ANALYTICS_HOST: `http://127.0.0.1:${port}`,
			PUBLIC_ANALYTICS_WEBSITE_ID: TEST_WEBSITE_ID,
			PUBLIC_WEB3FORMS_KEY: TEST_FORM_KEY,
			PUBLIC_CONTACT_EMAIL: TEST_CONTACT_EMAIL,
			...site
		};
	}
	throw new Error(`unknown build target ${JSON.stringify(name)} (expected ${TARGETS.join('|')})`);
}
