// Share-link helpers for the public inquiry page (AGT-02). No $app imports: callers pass the
// absolute page URL (location.origin + resolve('/agent/inquire/')), so the sub-path base is kept
// and these helpers stay unit-testable. Query strings are always built with URLSearchParams,
// never hand-concatenated.
import {
	inquiryParamPairs,
	parseInquiryParams,
	type InquiryConfig,
	type InquiryParse
} from '@tran/core/leads/inquiry-params';

/** The full share link for `c`, on the page URL's origin and path (any query or hash replaced). */
export function buildInquiryUrl(pageUrl: string, c: InquiryConfig): string {
	const url = new URL(pageUrl);
	url.search = new URLSearchParams(inquiryParamPairs(c)).toString();
	url.hash = '';
	return url.toString();
}

/** Parses `location.search` (with or without the leading "?"). Browser-only: call in onMount. */
export function readInquiryParams(search: string): InquiryParse {
	const q: Record<string, string> = {};
	for (const [k, v] of new URLSearchParams(search)) if (!(k in q)) q[k] = v;
	return parseInquiryParams(q);
}
