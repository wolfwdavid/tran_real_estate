// Browser-class detection for the Install the app section. Pure functions over injected objects
// so the Node unit tests can pass fakes; app code passes `navigator` / `window`.

/**
 * iPhone, iPad or iPod. iPadOS 13+ reports a desktop Mac user agent ("Macintosh", platform
 * "MacIntel"), so a MacIntel platform with more than one touch point is treated as an iPad.
 */
export function isIos(nav: {
	userAgent: string;
	platform?: string;
	maxTouchPoints?: number;
}): boolean {
	if (/iPad|iPhone|iPod/.test(nav.userAgent)) return true;
	return nav.platform === 'MacIntel' && (nav.maxTouchPoints ?? 0) > 1;
}

/** Running as an installed app: the standalone display mode, or iOS's navigator.standalone. */
export function isStandalone(win: {
	matchMedia(q: string): { matches: boolean };
	navigator: { standalone?: boolean };
}): boolean {
	return win.matchMedia('(display-mode: standalone)').matches || win.navigator.standalone === true;
}
