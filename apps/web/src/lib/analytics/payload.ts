/**
 * First-party pageview payload (GTM-04). The ONLY body the site can send to its analytics host.
 *
 * Whitelisted, non-personal fields mapped onto Umami's `/api/send` contract (RESEARCH Pattern 10):
 * - website: the configured site id (identifies the site, never the visitor)
 * - hostname: the site's own host
 * - url: pathname with the site base stripped, never a query string or fragment
 * - referrer: an external origin URL (`https://host/`), or absent
 * - screen: a coarse class (small | medium | large), never pixel dimensions
 * - data.portal: renter | investor | agent | none
 *
 * No IP, user agent, language, title, timestamp, visitor id or cookie is ever read here.
 */

export const SCREEN_CLASSES = ['small', 'medium', 'large'] as const;
export type ScreenClass = (typeof SCREEN_CLASSES)[number];
export type AnalyticsPortal = 'renter' | 'investor' | 'agent' | 'none';

export interface BeaconBody {
	type: 'event';
	payload: {
		website: string;
		hostname: string;
		url: string;
		referrer?: string;
		screen: ScreenClass;
		data: { portal: AnalyticsPortal };
	};
}

export function screenClass(width: number): ScreenClass {
	if (!Number.isFinite(width) || width < 640) return 'small';
	return width < 1024 ? 'medium' : 'large';
}

/** Path only: cut at the first `?` or `#`, then remove the site base. Always starts with `/`. */
export function stripBase(pathname: string, base: string): string {
	const cut = pathname.search(/[?#]/);
	let p = cut === -1 ? pathname : pathname.slice(0, cut);
	if (base && (p === base || p.startsWith(base + '/'))) p = p.slice(base.length);
	if (!p) return '/';
	return p.startsWith('/') ? p : `/${p}`;
}

export function portalOf(path: string): AnalyticsPortal {
	const seg = path.split('/')[1];
	return seg === 'renter' || seg === 'investor' || seg === 'agent' ? seg : 'none';
}

/** Full origin URL, never a bare host (Pitfall 7); undefined when same-site, non-http(s) or unparseable. */
export function referrerOrigin(ref: string, selfHost: string): string | undefined {
	try {
		const u = new URL(ref);
		if (u.hostname === selfHost || !/^https?:$/.test(u.protocol)) return undefined;
		return `${u.protocol}//${u.hostname}/`;
	} catch {
		return undefined;
	}
}

export function buildPageview(
	loc: { pathname: string; hostname: string },
	referrer: string,
	width: number,
	websiteId: string,
	base = ''
): BeaconBody {
	const url = stripBase(loc.pathname, base);
	const ref = referrerOrigin(referrer, loc.hostname);
	return {
		type: 'event',
		payload: {
			website: websiteId,
			hostname: loc.hostname,
			url,
			...(ref ? { referrer: ref } : {}),
			screen: screenClass(width),
			data: { portal: portalOf(url) }
		}
	};
}
