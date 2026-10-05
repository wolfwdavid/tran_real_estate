import { describe, expect, test } from 'vitest';
import {
	ALERTS_SKIPPED_LINK,
	DUE_BODY,
	DUE_DECLINED,
	NO_KEY_LINE,
	SAMPLE_LABEL,
	SOURCE_LEGEND,
	SOURCE_OPTIONS,
	STATUS_HYDRATING,
	TEST_KEY_LABEL,
	TESTING,
	alertsSkipped,
	alertsWaiting,
	checkLabel,
	checking,
	dueDone,
	dueFactRows,
	dueFacts,
	dueOverflow,
	duePartial,
	dueTitle,
	keyFormatLine,
	keyTestLine,
	noKeyLink,
	sampleExplanation,
	sourceAnnouncement,
	testedLine
} from './source';

describe('DataStatusBar copy', () => {
	test('hydration and sample label', () => {
		expect(STATUS_HYDRATING).toBe('Checking data source…');
		expect(SAMPLE_LABEL).toBe('Sample data');
	});

	test('sample explanations and their links', () => {
		expect(sampleExplanation('no-key')).toEqual({
			text: 'The places, people, and numbers here are made up.',
			link: { text: 'Add a RentCast key', hash: '#api-keys' }
		});
		expect(sampleExplanation('locked')).toEqual({
			text: "Your RentCast key is locked, so you're seeing made-up places, people, and numbers.",
			link: { text: 'Unlock your keys', hash: '#key-security' }
		});
		expect(sampleExplanation('chosen')).toEqual({
			text: 'You chose sample data. The places, people, and numbers here are made up.',
			link: { text: 'Switch to RentCast', hash: '#rentcast-usage' }
		});
	});

	test('alerts lines', () => {
		expect(alertsSkipped(3)).toBe(
			"Saved searches weren't checked because you've reached your cap. 3 are waiting."
		);
		expect(ALERTS_SKIPPED_LINK).toEqual({ text: 'Change your cap', hash: '#rentcast-usage' });
		expect(alertsWaiting(2)).toBe(
			"2 saved searches are waiting until there's room under your cap."
		);
	});

	test('alerts lines: singular forms [D]', () => {
		expect(alertsSkipped(1)).toBe(
			"Saved searches weren't checked because you've reached your cap. 1 is waiting."
		);
		expect(alertsWaiting(1)).toBe("1 saved search is waiting until there's room under your cap.");
	});
});

describe('DataSourceChoice copy', () => {
	test('legend, options and no-key line', () => {
		expect(SOURCE_LEGEND).toBe('Where portal data comes from');
		expect(SOURCE_OPTIONS).toEqual([
			{
				value: 'rentcast',
				title: 'RentCast, with your key',
				description:
					'Real listings and estimates. Each new search uses calls from your monthly count.'
			},
			{
				value: 'sample',
				title: 'Sample data',
				description: 'Made-up listings and numbers for exploring. Uses no calls.'
			}
		]);
		expect(NO_KEY_LINE).toBe('Using sample data because no RentCast key is available.');
		expect(noKeyLink('none')).toEqual({ text: 'Add a RentCast key', hash: '#api-keys' });
		expect(noKeyLink('locked')).toEqual({ text: 'Unlock your keys', hash: '#key-security' });
	});

	test('announcements', () => {
		expect(sourceAnnouncement('sample')).toBe('Showing sample data.');
		expect(sourceAnnouncement('rentcast')).toBe('Showing RentCast data.');
	});
});

describe('DueSearchesDialog copy', () => {
	test('title, body, partial, overflow', () => {
		expect(dueTitle(5)).toBe('Check 5 saved searches for new listings?');
		expect(DUE_BODY).toBe(
			"These searches haven't been checked in over a day. Checking them uses RentCast calls from your monthly count."
		);
		expect(duePartial(2)).toBe(
			'Only 2 fit under your cap, so Tran will check the 2 that have waited longest. The rest wait until you raise your cap or your count resets.'
		);
		expect(dueOverflow(3)).toBe('and 3 more');
	});

	test('fact list', () => {
		expect(dueFacts(2, 38, 40)).toEqual([
			'Calls this check uses: 2',
			'Used this month: 38 of 50',
			'Left before your cap: 2'
		]);
		expect(dueFactRows(2, 38, 40)[0]).toEqual({ term: 'Calls this check uses', value: '2' });
		// Never negative.
		expect(dueFacts(0, 45, 40)[2]).toBe('Left before your cap: 0');
	});

	test('buttons, progress, outcomes', () => {
		expect(checkLabel(5)).toBe('Check 5 searches');
		expect(checkLabel(1)).toBe('Check 1 search');
		expect(checking(1, 5)).toBe('Checking 1 of 5…');
		expect(DUE_DECLINED).toBe(
			"Saved searches weren't checked. Tran will ask again next time you open it."
		);
		expect(dueDone(5, 0)).toBe('Checked 5 saved searches. Nothing new.');
		expect(dueDone(5, 3)).toBe('Checked 5 saved searches. 3 new listings.');
		expect(dueDone(1, 1)).toBe('Checked 1 saved search. 1 new listing.');
	});
});

describe('KeyTestResult copy', () => {
	test('outcome lines', () => {
		expect(keyTestLine('valid')).toBe("RentCast accepted this key. The test didn't use a call.");
		expect(keyTestLine('valid-billed')).toBe(
			'RentCast accepted this key. The test returned data, so it counted as 1 call.'
		);
		expect(keyTestLine('invalid')).toBe(
			"RentCast didn't accept this key. Check that you copied all of it, or create a new key."
		);
		expect(keyTestLine('restricted')).toBe(
			'RentCast recognized this key but refused the test request. If you limited the key to certain endpoints, make sure it allows rental listings, sale listings, estimates, and market data. Otherwise, check your account at RentCast.'
		);
		expect(keyTestLine('unverified')).toBe(
			"Couldn't check this key, because api.rentcast.io didn't respond. Check your connection, then try again. Your key is still saved."
		);
		expect(keyTestLine('rate-limited')).toBe(
			'RentCast is limiting requests right now. Wait a minute, then try again.'
		);
	});

	test('format lines', () => {
		expect(keyFormatLine('empty')).toBe('Paste a key before saving.');
		expect(keyFormatLine('whitespace')).toBe(
			'This key has spaces or line breaks in it. Copy it again from RentCast and paste it here.'
		);
		const incomplete =
			"This doesn't look like a complete RentCast key. Copy it again from RentCast and paste it here.";
		expect(keyFormatLine('charset')).toBe(incomplete);
		expect(keyFormatLine('length')).toBe(incomplete);
	});

	test('button and tested line', () => {
		expect(TEST_KEY_LABEL).toBe('Test key');
		expect(TESTING).toBe('Testing…');
		expect(testedLine('2 hours ago')).toBe('Tested 2 hours ago');
	});
});
