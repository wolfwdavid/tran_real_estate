/**
 * First-party analytics transport (GTM-04, RESEARCH Pattern 10). The ONLY fetch in lib/analytics.
 *
 * One CORS-simple POST to Umami's `{host}/api/send`: a string body (text/plain, no custom headers),
 * mode no-cors so no preflight runs, no cookies, no Referer header, never cached, keepalive so it
 * survives navigation. No host or no website id means nothing is ever sent; GPC/DNT means the same.
 * `globalThis.fetch` is resolved lazily inside `send`, so importing this module touches no network.
 */
import { buildPageview, type BeaconBody } from './payload.js';
import { trackingAllowed, type ConsentNavigator, type ConsentWindow } from './consent.js';

export function send(body: BeaconBody, cfg: { host: string }, fetchImpl?: typeof fetch): void {
	if (!cfg.host) return; // no-op build
	try {
		const f = fetchImpl ?? globalThis.fetch;
		void f(`${cfg.host}/api/send`, {
			method: 'POST',
			body: JSON.stringify(body),
			mode: 'no-cors',
			credentials: 'omit',
			keepalive: true,
			referrerPolicy: 'no-referrer',
			cache: 'no-store'
		}).catch(() => {});
	} catch {
		/* analytics must never surface errors */
	}
}

export interface TrackerConfig {
	host: string;
	websiteId: string;
	base: string;
	fetchImpl?: typeof fetch;
	nav?: ConsentNavigator;
	win?: ConsentWindow;
}

export interface Tracker {
	pageview(url: URL, referrer: string, width: number): void;
}

export function createTracker(cfg: TrackerConfig): Tracker {
	const enabled = Boolean(cfg.host && cfg.websiteId);
	return {
		pageview(url, referrer, width) {
			if (!enabled) return;
			const nav: ConsentNavigator = cfg.nav ?? globalThis.navigator ?? {};
			const win: ConsentWindow = cfg.win ?? (globalThis as ConsentWindow);
			if (!trackingAllowed(nav, win)) return;
			send(
				buildPageview(
					{ pathname: url.pathname, hostname: url.hostname },
					referrer,
					width,
					cfg.websiteId,
					cfg.base
				),
				cfg,
				cfg.fetchImpl
			);
		}
	};
}
