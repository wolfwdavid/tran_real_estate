import { describe, expect, test } from 'vitest';
import { GatewayError, type GatewayErrorInfo } from '@tran/core/request';
import {
	CAP_CAPTION,
	FREE_PLAN_CAPTION,
	SCOPE_NOTE,
	USAGE_LINK,
	compactHeadline,
	compactStateText,
	meterHeadline,
	meterSubline,
	notCountedLine,
	stateLine,
	thresholdAnnouncement
} from './meter';
import { ACTION_LABELS, countdownLabel, errorCopy, rateLimitAnnouncements } from './errors';

const NOV_1 = Date.parse('2026-11-01T00:00:00Z');
const err = (info: GatewayErrorInfo) => new GatewayError(info);

describe('meter copy', () => {
	test('headline and compact headline', () => {
		expect(meterHeadline(12)).toBe('12 of 50 calls used this month');
		expect(compactHeadline(12)).toBe('RentCast calls: 12 of 50 this month');
	});

	test('sub-line clamps calls left at zero', () => {
		expect(meterSubline({ cap: 40, used: 12, resetsAt: NOV_1 })).toBe(
			'Cap: 40 · 28 left before your cap · Resets Nov 1 (UTC)'
		);
		expect(meterSubline({ cap: 40, used: 45, resetsAt: NOV_1 })).toBe(
			'Cap: 40 · 0 left before your cap · Resets Nov 1 (UTC)'
		);
		expect(meterSubline({ cap: 1000, used: 0, resetsAt: NOV_1 })).toBe(
			'Cap: 1,000 · 1,000 left before your cap · Resets Nov 1 (UTC)'
		);
	});

	test('state lines', () => {
		expect(stateLine('near', 5)).toBe('5 calls left before your cap.');
		expect(stateLine('near', 1)).toBe('1 call left before your cap.');
		expect(stateLine('at')).toBe("You've reached your cap. Tran asks before each extra call.");
		expect(stateLine('past')).toBe(
			"You're past the 50 calls in RentCast's free plan. If your RentCast account has a card on file, RentCast bills each extra call at $0.20, charged to your card."
		);
		expect(stateLine('ok')).toBeNull();
	});

	test('not-counted line and scope note', () => {
		expect(notCountedLine(3)).toBe(
			'Not counted: 3 searches with no results. RentCast bills only requests that return data.'
		);
		expect(SCOPE_NOTE).toBe(
			"This counts calls made from this browser. Calls from other devices or the RentCast dashboard aren't included, and RentCast's own billing cycle may start on a different day. Your RentCast dashboard has the official count."
		);
	});

	test('compact strings', () => {
		expect(compactStateText('near', 3)).toBe('3 left');
		expect(compactStateText('at')).toBe('Cap reached');
		expect(compactStateText('past')).toBe('Past free 50');
		expect(compactStateText('ok')).toBeNull();
		expect(CAP_CAPTION(40)).toBe('Cap 40');
		expect(FREE_PLAN_CAPTION).toBe('Free plan: 50');
		expect(USAGE_LINK).toBe('Usage and cap');
	});

	test('threshold announcements', () => {
		expect(thresholdAnnouncement('near', { left: 4 })).toBe(
			'4 RentCast calls left before your cap.'
		);
		expect(thresholdAnnouncement('at', { used: 40, cap: 40 })).toBe(
			"You've reached your RentCast cap: 40 of 40 calls this month."
		);
		expect(thresholdAnnouncement('past')).toBe("You're past RentCast's free 50 calls this month.");
	});
});

describe('gateway error copy', () => {
	const cases: Array<[GatewayErrorInfo, string, string]> = [
		[
			{ kind: 'InvalidKey' },
			"RentCast didn't accept your key",
			'Check that you copied the whole key in Settings, or create a new one at RentCast. No call was counted.'
		],
		[
			{ kind: 'RestrictedKey', detail: 'restriction' },
			"Your RentCast key can't make this request",
			"RentCast recognized the key but refused this request. The key may be limited to other endpoints, or your RentCast account may need attention. Check the key's settings in your RentCast dashboard. No call was counted."
		],
		[
			{ kind: 'RateLimited', retryInMs: 2000 },
			'RentCast is busy right now',
			'Too many requests reached RentCast at once. Wait a few seconds, then try again. No call was counted.'
		],
		[
			{ kind: 'BudgetCapReached', used: 40, cap: 40, resetsAt: NOV_1 },
			'Stopped at your monthly cap',
			"You've used 40 of your 40-call cap this month, so nothing was spent. Your count resets on Nov 1 (UTC). You can continue for this one call, raise your cap, or keep browsing saved results."
		],
		[
			{ kind: 'NoResults' },
			'No results for this search',
			"RentCast has nothing that matches right now. Try a nearby ZIP code, a wider price range, or fewer filters. This answer is saved for 24 hours, so repeating the same search won't use a call."
		],
		[
			{ kind: 'NetworkError' },
			"Couldn't reach RentCast",
			"Check your connection, then try again. Tran didn't count a call for this."
		],
		[
			{ kind: 'NetworkError', detail: 'server' },
			'RentCast had a problem answering',
			"This is on RentCast's side. Try again in a few minutes. Tran didn't count a call for this."
		],
		[
			{ kind: 'SchemaMismatch' },
			"RentCast sent data Tran couldn't read",
			'RentCast may have changed the format of its results. This call was counted, because RentCast answered. Nothing was saved. Use sample data for now, and try again later.'
		]
	];

	test.each(cases)('%o', (info, title, body) => {
		const copy = errorCopy(err(info));
		expect(copy.title).toBe(title);
		expect(copy.body).toBe(body);
		expect(copy.variant).toBe(info.kind === 'NoResults' ? 'neutral' : 'destructive');
	});

	test('action labels', () => {
		expect(ACTION_LABELS).toEqual({
			checkKey: 'Check your key in Settings',
			useSample: 'Use sample data instead',
			openDashboard: 'Open RentCast dashboard',
			tryAgain: 'Try again (1 call)',
			continuePastCap: 'Continue past cap…',
			changeCap: 'Change your cap',
			editSearch: 'Edit search'
		});
	});

	test('rate-limit countdown strings', () => {
		expect(rateLimitAnnouncements.start(8)).toBe(
			'RentCast is busy. You can try again in 8 seconds.'
		);
		expect(rateLimitAnnouncements.END).toBe('You can try again now.');
		expect(countdownLabel(3)).toBe('Try again in 3s');
	});
});
