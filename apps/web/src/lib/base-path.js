const VALID_BASE = /^\/[A-Za-z0-9._~-]+(\/[A-Za-z0-9._~-]+)*$/;

/**
 * Resolve and validate SvelteKit's `paths.base` from the environment.
 * @param {Record<string, string | undefined>} [env]
 * @returns {string}
 */
export function resolveBasePath(env = process.env) {
	const base = env.BASE_PATH ?? '';
	if (base !== '' && !VALID_BASE.test(base)) {
		throw new Error(
			`BASE_PATH must be '' or a root-relative path like '/tran_real_estate' (got ${JSON.stringify(base)}). ` +
				`On Git Bash set MSYS_NO_PATHCONV=1 or use scripts/build-web.mjs.`
		);
	}
	return base;
}

/**
 * @param {Record<string, string | undefined>} [env]
 * @returns {string}
 */
export function resolveBuildDir(env = process.env) {
	return env.BUILD_DIR ?? 'build';
}
