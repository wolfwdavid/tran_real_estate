// CallMeter strings, verbatim from 04-UI-SPEC ("CallMeter", "RentCast usage section",
// "Live-region announcements"). Numbers go through formatCount, dates through formatMonthDay.
import {
	OVERAGE_USD,
	formatCount,
	formatMonthDay,
	formatUsd,
	type MeterState
} from '@tran/core/budget';

const n = formatCount;

/** Full variant headline: "12 of 50 calls used this month". */
export const meterHeadline = (used: number): string => `${n(used)} of 50 calls used this month`;

/** Compact variant text: "RentCast calls: 12 of 50 this month". */
export const compactHeadline = (used: number): string =>
	`RentCast calls: ${compactCount(used)} this month`;

/** The bold part of the compact text, "12 of 50". */
export const compactCount = (used: number): string => `${n(used)} of 50`;

export interface SublineInput {
	cap: number;
	used: number;
	resetsAt: number;
}

/** "Cap: 40 · 28 left before your cap · Resets Nov 1 (UTC)" */
export const meterSubline = ({ cap, used, resetsAt }: SublineInput): string =>
	`Cap: ${n(cap)} · ${n(Math.max(cap - used, 0))} left before your cap · Resets ${formatMonthDay(resetsAt)} (UTC)`;

/** The always-visible state line under the full meter; null for OK. */
export function stateLine(state: MeterState, left = 0): string | null {
	switch (state) {
		case 'near':
			return left === 1 ? '1 call left before your cap.' : `${n(left)} calls left before your cap.`;
		case 'at':
			return "You've reached your cap. Tran asks before each extra call.";
		case 'past':
			return `You're past the 50 calls in RentCast's free plan. If your RentCast account has a card on file, RentCast bills each extra call at ${formatUsd(OVERAGE_USD)}, charged to your card.`;
		default:
			return null;
	}
}

/** Shown only when unbilled > 0. */
export const notCountedLine = (unbilled: number): string =>
	`Not counted: ${n(unbilled)} searches with no results. RentCast bills only requests that return data.`;

export const SCOPE_NOTE =
	"This counts calls made from this browser. Calls from other devices or the RentCast dashboard aren't included, and RentCast's own billing cycle may start on a different day. Your RentCast dashboard has the official count.";

/** Compact state word; null for OK. */
export function compactStateText(state: MeterState, left = 0): string | null {
	switch (state) {
		case 'near':
			return `${n(left)} left`;
		case 'at':
			return 'Cap reached';
		case 'past':
			return 'Past free 50';
		default:
			return null;
	}
}

/** "Cap 40" (full-variant marker caption and compact cap text). */
export const CAP_CAPTION = (cap: number): string => `Cap ${n(cap)}`;
export const FREE_PLAN_CAPTION = 'Free plan: 50';
export const USAGE_LINK = 'Usage and cap';

/** Polite announcements when the meter crosses into a worse state (never on load). */
export function thresholdAnnouncement(
	state: 'near' | 'at' | 'past',
	values: { left?: number; used?: number; cap?: number } = {}
): string {
	switch (state) {
		case 'near':
			return `${n(values.left ?? 0)} RentCast calls left before your cap.`;
		case 'at':
			return `You've reached your RentCast cap: ${n(values.used ?? 0)} of ${n(values.cap ?? 0)} calls this month.`;
		case 'past':
			return "You're past RentCast's free 50 calls this month.";
	}
}
