// Build stamp (LIVE-04): Kit version.name = the commit the build was made from, so
// /_app/version.json identifies a deploy and a post-deploy check can wait for it behind the
// Pages CDN cache. scripts/build-web.mjs passes BUILD_SHA; CI also sets GITHUB_SHA; tools that
// load svelte.config.js directly (svelte-kit sync, svelte-check, vite dev) fall back to git HEAD.
const SHA = /^[0-9a-f]{40}$/;

/**
 * @param {Record<string, string | undefined>} env
 * @param {() => string} readHead returns `git rev-parse HEAD` output (called only when needed)
 * @returns {string}
 */
export function resolveBuildStamp(env, readHead) {
	const v = env.BUILD_SHA || env.GITHUB_SHA || readHead();
	if (!SHA.test(v)) {
		throw new Error(
			`build stamp must be a 40-hex commit SHA (got ${JSON.stringify(v)}); set BUILD_SHA or GITHUB_SHA, or build inside a git checkout`
		);
	}
	return v;
}
