/**
 * Reviewed `pnpm audit` exceptions. Each must also appear in pnpm-workspace.yaml audit.ignore
 * (supply-chain.test.ts enforces equality). Only advisories in code that never ships in the
 * adapter-static client output may be listed here; a shipped vulnerability is fixed, not ignored.
 */
export const AUDIT_EXCEPTIONS = Object.freeze([
	{
		ghsa: 'GHSA-gcqx-w48m-w2h4',
		package: 'deepmerge',
		severity: 'low',
		path: '@sveltejs/vite-plugin-svelte@7.3.1 > deepmerge@4.3.1 (apps/web and apps/extension build tooling)',
		why: 'Prototype poisoning in deepmerge.mergeObject(). deepmerge is used only by the Svelte Vite plugin at build time to merge compiler options from trusted config files; no patched version exists (advisory lists none). It never ships: 0 matches for deepmerge/mergeObject in apps/web/build/_app and apps/extension/.output/chrome-mv3. Re-check when vite-plugin-svelte drops or bumps deepmerge.',
		revisitBy: '2027-01-31'
	},
	{
		ghsa: 'GHSA-g3hv-75wg-m249',
		package: 'minimatch',
		severity: 'moderate',
		path: 'eslint / typescript-eslint / wxt dev toolchain > minimatch@10.2.6',
		why: 'Denial of service through globparts amplification in minimatch <11.0.1. Lint- and build-time glob matching on trusted config patterns only; minimatch is not present in apps/web/build/_app nor in the extension output (0 matches in apps/web/build/_app, apps/web/src and apps/extension/.output/chrome-mv3). Checked 2026-11-14 with npm view: eslint 10.15.0 and @eslint/config-array 0.23.6 accept minimatch ^11.0.5, but @typescript-eslint/typescript-estree 8.72.2 (typescript-eslint latest 8.72.2) still declares ^10.2.2 and the lockfile resolves eslint 10.10.0, config-array 0.23.5, typescript-eslint 8.70.0 on minimatch 10.2.6, so no patched version is reachable without a family bump (plan 12 routine bumps). Revisit when typescript-estree moves to minimatch >=11.0.1, and by the date below at the latest.',
		revisitBy: '2026-12-31'
	}
]);
