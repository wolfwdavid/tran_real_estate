/**
 * Lazy entry for the root layout's pageview tracker. The layout reaches this module only through a
 * dynamic import() inside its build-time analytics gate, after hydration (afterNavigate), so neither
 * it nor beacon/payload/consent is modulepreloaded on any route (scripts/assert-budget.mjs counts
 * only the initial JS). Everything the layout used to do per navigation lives here, which keeps the
 * layout's share of every page's initial JS to the afterNavigate call alone.
 *
 * It reads the build-time defines directly instead of importing $lib/site: the tool and marketing
 * pages import $lib/site statically, and a second (dynamic) importer would make the bundler split
 * it into an extra chunk that every one of those pages then preloads. The values match
 * $lib/site's ANALYTICS and SITE_BASE exactly; boot.test.ts pins that.
 */
import { createTracker } from './beacon.js';

export const trackerConfig = Object.freeze({
	host: __ANALYTICS_HOST__,
	websiteId: __ANALYTICS_WEBSITE_ID__,
	base: new URL(__SITE_URL__).pathname.replace(/\/$/, '')
});

export const tracker = createTracker(trackerConfig);

let first = true;

/** One pageview for a completed navigation. The tracker checks GPC / Do Not Track before sending. */
export function pageview(url: URL): void {
	// Only the first load can carry an external referrer; later navigations are same-site.
	const referrer = first ? document.referrer : '';
	first = false;
	tracker.pageview(url, referrer, window.innerWidth);
}
