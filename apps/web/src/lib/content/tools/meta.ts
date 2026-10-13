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
 * /tools/affordability/ ships in 10-14. Until then the hub card and the "Other free calculators"
 * link to it stay hidden, so the prerender crawl (handleHttpError: 'fail') never hits a 404.
 * 10-14 flips this to true.
 */
export const AFFORDABILITY_READY = false;

/** Breadcrumb labels (UI-SPEC "Tool pages > Shared strings"). */
export const CRUMBS = { home: 'Home', tools: 'Tools' } as const;

export const OG_EYEBROW = 'FREE CALCULATOR';
export const OG_SUBLINE = 'Runs in your browser. No sign-up, no API key.';
