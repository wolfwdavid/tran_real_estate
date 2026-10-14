// The few tool facts both the /tools/ hub and the calculator pages need. Kept tiny and apart
// from ./shared: whatever the hub and the calculator pages import in common becomes its own
// chunk, and each extra chunk costs the calculator pages budget (60 KB gz, 10-13).

export type ToolSlug = 'affordability' | 'cap-rate' | 'cash-on-cash' | 'dscr';
export const TOOL_SLUGS: readonly ToolSlug[] = [
	'affordability',
	'cap-rate',
	'cash-on-cash',
	'dscr'
];

/**
 * /tools/affordability/ shipped in 10-14, so the hub card and the "Other free calculators" link to
 * it are shown. Setting this to false hides both again (the prerender crawl fails on a 404 link).
 */
export const AFFORDABILITY_READY = true;

/** Breadcrumb labels (UI-SPEC "Tool pages > Shared strings"). */
export const CRUMBS = { home: 'Home', tools: 'Tools' } as const;

export const OG_EYEBROW = 'FREE CALCULATOR';
export const OG_SUBLINE = 'Runs in your browser. No sign-up, no API key.';
