// Data source, status bar, due-search and key-test copy, verbatim from 04-UI-SPEC ("DataStatusBar",
// "RentCast usage section", "DueSearchesDialog", "KeyTestResult", "Live-region announcements").
// `…` is U+2026. Components never inline these strings.
import { formatCount, PLAN_LIMIT } from '@tran/core/budget';
import type { KeyTestOutcome } from '@tran/core/request';

const n = formatCount;

/** An inline link to a Settings section: the caller builds `resolve('/settings/') + hash`. */
export interface SettingsLink {
	text: string;
	hash: '#api-keys' | '#key-security' | '#rentcast-usage';
}

export type SampleReason = 'no-key' | 'locked' | 'chosen';
export type DataSource = 'rentcast' | 'sample';

// DataStatusBar ----------------------------------------------------------------------------------

export const STATUS_HYDRATING = 'Checking data source…';
export const SAMPLE_LABEL = 'Sample data';

const ADD_KEY: SettingsLink = { text: 'Add a RentCast key', hash: '#api-keys' };
const UNLOCK: SettingsLink = { text: 'Unlock your keys', hash: '#key-security' };

const SAMPLE_EXPLANATIONS: Record<SampleReason, { text: string; link: SettingsLink }> = {
	'no-key': { text: 'The places, people, and numbers here are made up.', link: ADD_KEY },
	locked: {
		text: "Your RentCast key is locked, so you're seeing made-up places, people, and numbers.",
		link: UNLOCK
	},
	chosen: {
		text: 'You chose sample data. The places, people, and numbers here are made up.',
		link: { text: 'Switch to RentCast', hash: '#rentcast-usage' }
	}
};

/** The sample variant's explanation and its inline link. */
export const sampleExplanation = (reason: SampleReason): { text: string; link: SettingsLink } =>
	SAMPLE_EXPLANATIONS[reason];

/** Live + alerts at cap. Singular "1 is waiting." is [D] (the spec gives only the plural). */
export const alertsSkipped = (waiting: number): string =>
	`Saved searches weren't checked because you've reached your cap. ${n(waiting)} ${waiting === 1 ? 'is' : 'are'} waiting.`;

export const ALERTS_SKIPPED_LINK: SettingsLink = {
	text: 'Change your cap',
	hash: '#rentcast-usage'
};

/** Live, alerts partially run. Singular form is [D]. */
export const alertsWaiting = (waiting: number): string =>
	waiting === 1
		? "1 saved search is waiting until there's room under your cap."
		: `${n(waiting)} saved searches are waiting until there's room under your cap.`;

// DataSourceChoice -------------------------------------------------------------------------------

export const SOURCE_LEGEND = 'Where portal data comes from';

export const SOURCE_OPTIONS: { value: DataSource; title: string; description: string }[] = [
	{
		value: 'rentcast',
		title: 'RentCast, with your key',
		description: 'Real listings and estimates. Each new search uses calls from your monthly count.'
	},
	{
		value: 'sample',
		title: 'Sample data',
		description: 'Made-up listings and numbers for exploring. Uses no calls.'
	}
];

export const NO_KEY_LINE = 'Using sample data because no RentCast key is available.';

/** The link after NO_KEY_LINE: add a key, or unlock the vault when the key is locked. */
export const noKeyLink = (keyState: 'none' | 'locked'): SettingsLink =>
	keyState === 'locked' ? UNLOCK : ADD_KEY;

export const sourceAnnouncement = (source: DataSource): string =>
	source === 'sample' ? 'Showing sample data.' : 'Showing RentCast data.';

/** Another tab saved a new cap (BroadcastChannel 'tran-data'). */
export const CAP_CHANGED_ELSEWHERE = 'Your RentCast cap was changed in another Tran tab.';

// DueSearchesDialog ------------------------------------------------------------------------------

export const dueTitle = (due: number): string => `Check ${n(due)} saved searches for new listings?`;

export const DUE_BODY =
	"These searches haven't been checked in over a day. Checking them uses RentCast calls from your monthly count.";

export const duePartial = (k: number): string =>
	`Only ${n(k)} fit under your cap, so Tran will check the ${n(k)} that have waited longest. The rest wait until you raise your cap or your count resets.`;

/** Shown after the first 10 names. */
export const DUE_LIST_MAX = 10;
export const dueOverflow = (more: number): string => `and ${n(more)} more`;

/** Fact list rows for the `<dl>`. "Left before your cap" never goes below 0. */
export const dueFactRows = (
	calls: number,
	used: number,
	cap: number
): { term: string; value: string }[] => [
	{ term: 'Calls this check uses', value: n(calls) },
	{ term: 'Used this month', value: `${n(used)} of ${n(PLAN_LIMIT)}` },
	{ term: 'Left before your cap', value: n(Math.max(cap - used, 0)) }
];

/** The fact rows as visible "{term}: {value}" lines. */
export const dueFacts = (calls: number, used: number, cap: number): string[] =>
	dueFactRows(calls, used, cap).map((r) => `${r.term}: ${r.value}`);

/** Confirm verb; the caller appends CostLabel. Singular "Check 1 search" is [D]. */
export const checkLabel = (k: number): string =>
	k === 1 ? 'Check 1 search' : `Check ${n(k)} searches`;

export const checking = (i: number, k: number): string => `Checking ${n(i)} of ${n(k)}…`;

export const DUE_NOT_NOW = 'Not now';

export const DUE_DECLINED =
	"Saved searches weren't checked. Tran will ask again next time you open it.";

/** Scheduled check done. Singular forms are [D]. */
export const dueDone = (k: number, found: number): string => {
	const checked = k === 1 ? 'Checked 1 saved search.' : `Checked ${n(k)} saved searches.`;
	if (found === 0) return `${checked} Nothing new.`;
	return `${checked} ${found === 1 ? '1 new listing.' : `${n(found)} new listings.`}`;
};

// KeyTestResult ----------------------------------------------------------------------------------

export const TEST_KEY_LABEL = 'Test key';
export const TESTING = 'Testing…';

/** The host the unverified line wraps in `<code>`. */
export const RENTCAST_HOST = 'api.rentcast.io';

const KEY_TEST_LINES: Record<KeyTestOutcome, string> = {
	valid: "RentCast accepted this key. The test didn't use a call.",
	'valid-billed': 'RentCast accepted this key. The test returned data, so it counted as 1 call.',
	invalid: "RentCast didn't accept this key. Check that you copied all of it, or create a new key.",
	restricted:
		'RentCast recognized this key but refused the test request. If you limited the key to certain endpoints, make sure it allows rental listings, sale listings, estimates, and market data. Otherwise, check your account at RentCast.',
	unverified: `Couldn't check this key, because ${RENTCAST_HOST} didn't respond. Check your connection, then try again. Your key is still saved.`,
	'rate-limited': 'RentCast is limiting requests right now. Wait a minute, then try again.'
};

export const keyTestLine = (outcome: KeyTestOutcome): string => KEY_TEST_LINES[outcome];

export type KeyFormatError = 'empty' | 'whitespace' | 'charset' | 'length';

/** Phase 3's field-style messages; 'charset' and 'length' share one [D] sentence. */
export function keyFormatLine(error: KeyFormatError): string {
	switch (error) {
		case 'empty':
			return 'Paste a key before saving.';
		case 'whitespace':
			return 'This key has spaces or line breaks in it. Copy it again from RentCast and paste it here.';
		default:
			return "This doesn't look like a complete RentCast key. Copy it again from RentCast and paste it here.";
	}
}

export const testedLine = (relative: string): string => `Tested ${relative}`;
