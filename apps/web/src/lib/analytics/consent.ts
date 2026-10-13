/**
 * Opt-out gate for the analytics beacon (GTM-04). Global Privacy Control, or Do Not Track set to
 * '1' / 'yes' (navigator or legacy window property), means no request is made at all.
 */
export interface ConsentNavigator {
	globalPrivacyControl?: boolean;
	doNotTrack?: string | null;
}

export interface ConsentWindow {
	doNotTrack?: string | null;
}

export function trackingAllowed(nav: ConsentNavigator, win: ConsentWindow): boolean {
	if (nav.globalPrivacyControl === true) return false;
	const dnt = nav.doNotTrack ?? win.doNotTrack ?? null;
	return !(dnt === '1' || dnt === 'yes');
}
