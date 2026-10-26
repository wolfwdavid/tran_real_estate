import { badgeFor, type CountPush } from './messages';

/** The slice of `browser.action` the badge needs; injected so tests use plain fakes. */
export interface BadgeApi {
	setBadgeText(d: { tabId: number; text: string }): Promise<void> | void;
	setTitle(d: { tabId: number; title: string }): Promise<void> | void;
	setBadgeBackgroundColor(d: { color: string }): Promise<void> | void;
	setBadgeTextColor?(d: { color: string }): Promise<void> | void;
}

// Brand espresso / ivory (UI-SPEC C, toolbar badge). Lowercase so brand-parity matches tokens.
export const BADGE_BG = '#2b1d16';
export const BADGE_FG = '#fbf7f0';

/** A tab can close between the push and the update; a rejected badge call is not an error. */
function quiet(result: Promise<void> | void): void {
	if (result && typeof (result as Promise<void>).catch === 'function') {
		(result as Promise<void>).catch(() => {});
	}
}

export function initBadgeColors(api: BadgeApi): void {
	quiet(api.setBadgeBackgroundColor({ color: BADGE_BG }));
	if (typeof api.setBadgeTextColor === 'function') {
		quiet(api.setBadgeTextColor({ color: BADGE_FG }));
	}
}

/** Per-tab badge: the dimmed count ('' when off or 0, '99+' above 99) plus the tooltip. */
export function applyBadge(api: BadgeApi, tabId: number, push: CountPush): void {
	const { text, title } = badgeFor(push);
	quiet(api.setBadgeText({ tabId, text }));
	quiet(api.setTitle({ tabId, title }));
}
