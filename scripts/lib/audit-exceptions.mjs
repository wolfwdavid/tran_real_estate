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
	}
]);
