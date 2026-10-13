/**
 * Canonical path for a SvelteKit route id: route groups removed, always a trailing slash
 * (the app uses `trailingSlash: 'always'`). Combine with `SITE_URL` from `$lib/site` for absolute
 * URLs. Never build absolute URLs from `page.url` or the `$app/paths` base: `base` is relative in
 * prerendered pages (RESEARCH Pattern 2 / Pitfall 1).
 */
export function canonicalPath(routeId: string | null): string {
	const withoutGroups = (routeId ?? '/').replace(/\/\([^)]+\)/g, '').replace(/^\([^)]+\)/, '');
	const trimmed = withoutGroups.replace(/\/+$/, '');
	if (trimmed === '') return '/';
	return `${trimmed.startsWith('/') ? '' : '/'}${trimmed}/`;
}
