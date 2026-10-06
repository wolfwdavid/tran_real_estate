// Synthetic TRAN-LEAD v1 paste fixtures: the ways email clients mangle a lead email before an
// agent pastes it back. Every value is fictional (@example.com, 555-01xx), and the real-data guard
// scans this directory.
//
// Each MANGLED text must parse to CLEAN_LEAD (or to CLEAN_LEAD merged with `expected`). Fixtures
// flagged `collapsed` lose the message's line structure, so tests compare the message with
// whitespace runs collapsed.

export interface CleanLead {
	name: string;
	email: string;
	phone: string;
	property: string;
	consent: boolean;
	submitted: string;
	message: string;
}

export interface MangledFixture {
	label: string;
	text: string;
	collapsed?: true;
	expected?: Partial<CleanLead>;
}

export const CLEAN_LEAD: CleanLead = {
	name: 'Jordan Example',
	email: 'jordan@example.com',
	phone: '(555) 555-0142',
	property: '12 Sample Lane, Harlow Springs',
	consent: true,
	submitted: '2026-10-04T15:04:05Z',
	message: 'Could we tour Saturday?\nSecond line of the message.'
};

export const CLEAN_BLOCK = [
	'TRAN-LEAD v1',
	'name: Jordan Example',
	'email: jordan@example.com',
	'phone: (555) 555-0142',
	'property: 12 Sample Lane, Harlow Springs',
	'consent: yes',
	'submitted: 2026-10-04T15:04:05Z',
	'message: Could we tour Saturday?',
	'Second line of the message.',
	'END TRAN-LEAD'
].join('\n');

const NBSP = '\u00A0';
const ZWSP = '\u200B';
const KEY_AT_LINE_START = /^(name|email|phone|property|consent|submitted|message):/gm;

const quoteEvery = (text: string, marker: string): string =>
	text
		.split('\n')
		.map((line) => marker + line)
		.join('\n');

export const MANGLED: MangledFixture[] = [
	{ label: '(a) clean multiline block', text: CLEAN_BLOCK },
	{
		label: '(b) every newline collapsed to a single space',
		text: CLEAN_BLOCK.replace(/\n/g, ' '),
		collapsed: true
	},
	{ label: '(c) forwarded: every line quoted with "> "', text: quoteEvery(CLEAN_BLOCK, '> ') },
	{
		label: '(d) forwarded twice: every line quoted with "> > "',
		text: quoteEvery(CLEAN_BLOCK, '> > ')
	},
	{ label: '(e) CRLF line endings', text: CLEAN_BLOCK.replace(/\n/g, '\r\n') },
	{ label: '(f) NBSP after every key colon', text: CLEAN_BLOCK.replace(/: /g, ':' + NBSP) },
	{
		label: '(g) zero-width spaces around every key',
		text: CLEAN_BLOCK.replace(KEY_AT_LINE_START, ZWSP + '$1:' + ZWSP)
	},
	{
		label: '(h) block embedded in the surrounding notification email',
		text: [
			'Hi, you have a new submission from your inquiry page.',
			'',
			'Tran Lead V1: ' + CLEAN_BLOCK,
			'',
			'Sent by Web3Forms'
		].join('\n')
	},
	{
		label: '(i) forged name: and email: lines inside the message',
		text: CLEAN_BLOCK.replace(
			'Second line of the message.',
			'name: Mallory\nemail: x@example.com\nSecond line of the message.'
		),
		expected: {
			message:
				'Could we tour Saturday?\nname: Mallory\nemail: x@example.com\nSecond line of the message.'
		}
	},
	{
		label: '(j) missing END TRAN-LEAD (block runs to the end of the text)',
		text: CLEAN_BLOCK.replace('\nEND TRAN-LEAD', '')
	},
	{
		label: '(k) long lines soft-wrapped by the mail client',
		text: CLEAN_BLOCK.replace('name: Jordan Example', 'name: Jordan\nExample').replace(
			'property: 12 Sample Lane, Harlow Springs',
			'property: 12 Sample Lane, \nHarlow Springs'
		)
	},
	{
		label: '(l) HTML-to-text: blank line after every line, tabs before values',
		text: CLEAN_BLOCK.replace(/: /g, ':\t').replace(/\n/g, '\n\n'),
		collapsed: true
	},
	{
		label: '(m) Outlook forward: CRLF + "> " quoting + NBSP + zero-width',
		text: quoteEvery(
			CLEAN_BLOCK.replace(/: /g, ':' + NBSP).replace(KEY_AT_LINE_START, ZWSP + '$1:'),
			'> '
		).replace(/\n/g, '\r\n')
	}
];

export const SECOND_LEAD: CleanLead = {
	name: 'Riley Sample',
	email: 'riley@example.com',
	phone: '555-555-0107',
	property: '',
	consent: false,
	submitted: '2026-10-05T09:30:00Z',
	message: 'Is the condo still available?'
};

const SECOND_BLOCK = [
	'TRAN-LEAD v1',
	'name: Riley Sample',
	'email: riley@example.com',
	'phone: 555-555-0107',
	'property: ',
	'consent: no',
	'submitted: 2026-10-05T09:30:00Z',
	'message: Is the condo still available?',
	'END TRAN-LEAD'
].join('\n');

/** Two submissions pasted together: two leads, in order. */
export const TWO_BLOCKS = `${CLEAN_BLOCK}\n\nSent by Web3Forms\n\n${SECOND_BLOCK}\n`;

/** A block from a newer format version followed by a v1 block. */
export const V2_THEN_V1 = [
	'TRAN-LEAD v2',
	'fullName: Someone From The Future',
	'email: future@example.com',
	'END TRAN-LEAD',
	'',
	CLEAN_BLOCK
].join('\n');
