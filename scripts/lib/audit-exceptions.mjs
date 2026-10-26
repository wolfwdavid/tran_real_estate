/**
 * Reviewed `pnpm audit` exceptions. Each must also appear in pnpm-workspace.yaml audit.ignore
 * (supply-chain.test.ts enforces equality). Only advisories in code that never ships in the
 * adapter-static client output may be listed here; a shipped vulnerability is fixed, not ignored.
 */
export const AUDIT_EXCEPTIONS = Object.freeze([
	{
		ghsa: 'GHSA-pxg6-pf52-xh8x',
		package: 'cookie',
		severity: 'low',
		path: '@sveltejs/kit > cookie (also via adapter-static, runed > @sveltejs/kit)',
		why: 'Kit 2.x server cookie API only (cookie@0.6.0 pinned ^0.6.0 by @sveltejs/kit 2.70.3); adapter-static output never includes it (no cookie symbols in apps/web/build/_app). Re-check on the Kit 3 migration.',
		revisitBy: '2027-01-31'
	},
	{
		ghsa: 'GHSA-pfhg-q3qv-9q6r',
		package: '@sveltejs/kit',
		severity: 'low',
		path: 'apps/web > @sveltejs/kit (also via adapter-static, runed > @sveltejs/kit)',
		why: 'Open redirect through enhanced form actions (use:enhance) on routes accepting // paths. The site is fully prerendered (adapter-static, prerender = true) and defines no form actions: 0 use:enhance, 0 export const actions in apps/web/src. Fixed only in Kit 3.0.0 (major). Re-check on the Kit 3 migration.',
		revisitBy: '2027-01-31'
	},
	{
		ghsa: 'GHSA-27mw-82g8-phjj',
		package: '@sveltejs/kit',
		severity: 'low',
		path: 'apps/web > @sveltejs/kit (also via adapter-static, runed > @sveltejs/kit)',
		why: 'XSS via an untrusted cache-control value passed to setHeaders on a prerendered page. apps/web/src never calls setHeaders (0 matches); the only cache-control string in build/_app is the Kit client version-check request header, not the unescaped meta tag. Fixed only in Kit 3.0.0 (major). Re-check on the Kit 3 migration.',
		revisitBy: '2027-01-31'
	}
]);
