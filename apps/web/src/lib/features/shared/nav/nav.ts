// Shared portal sub-navigation model (07-03). Pure and portal-agnostic: each portal passes its own
// item list to PortalSubNav.

export interface SubNavItem {
	/**
	 * Base-less, trailing-slash pathname of the item's page (e.g. '/investor/deals/').
	 * PortalSubNav turns it into a link with resolve() at render time; it is never a resolved URL,
	 * because resolve() is relative while prerendering and would differ from page to page.
	 */
	href: string;
	label: string;
	/** Other base-less pathnames that also mark this item current (e.g. sub-pages of Deals). */
	match: string[];
}

const withSlash = (p: string) => (p.endsWith('/') ? p : `${p}/`);

/** `pathname` without `base` (only a whole leading segment run is stripped), with a trailing slash. */
function baseless(pathname: string, base: string): string {
	const b = base.replace(/\/+$/, '');
	if (b && (pathname === b || pathname.startsWith(`${b}/`))) {
		return withSlash(pathname.slice(b.length) || '/');
	}
	return withSlash(pathname);
}

/** Index of the item `pathname` belongs to (its own page or one of its `match` pages), or -1. */
export function currentItemIndex(
	items: readonly SubNavItem[],
	pathname: string,
	base: string
): number {
	const path = baseless(pathname, base);
	return items.findIndex(
		(item) => withSlash(item.href) === path || item.match.some((m) => withSlash(m) === path)
	);
}

/**
 * The base-less pathname of a route id: '/(app)/investor/market' -> '/investor/market/'. Route
 * ids are known during prerender under either base, so aria-current lands in the static HTML.
 */
export function routeIdToPath(id: string | null): string | null {
	if (id === null) return null;
	const segments = id.split('/').filter((s) => s !== '' && !/^\(.*\)$/.test(s));
	return segments.length === 0 ? '/' : `/${segments.join('/')}/`;
}
