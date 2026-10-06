// The investor portal's sub-navigation items (07-UI-SPEC "PortalSubNav"). Hrefs are base-less
// pathnames; PortalSubNav resolves them at render time. Compare and memo belong to Deals, the
// one-ZIP dashboard belongs to Markets.
import type { SubNavItem } from '$lib/features/shared/nav/nav';

export const INVESTOR_NAV: readonly SubNavItem[] = [
	{ href: '/investor/', label: 'Overview', match: [] },
	{ href: '/investor/analyze/', label: 'Analyze', match: [] },
	{ href: '/investor/deals/', label: 'Deals', match: ['/investor/compare/', '/investor/memo/'] },
	{ href: '/investor/buy-boxes/', label: 'Buy boxes', match: [] },
	{ href: '/investor/markets/', label: 'Markets', match: ['/investor/market/'] }
];
