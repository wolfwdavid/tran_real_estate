import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
	CLEAN_BLOCK,
	CLEAN_LEAD,
	MANGLED,
	SECOND_LEAD,
	TWO_BLOCKS,
	V2_THEN_V1
} from './fixtures/mangled-blocks.js';
import {
	buildLeadBlock,
	canonicalLeadField,
	LEAD_KEYS,
	type LeadBlockFields,
	type ParsedLead,
	parseLeadBlocks
} from './lead-block.js';
import { cleanText, normEmail } from './normalize.js';

const collapse = (s: string): string => s.replace(/\s+/g, ' ').trim();

const okLead = (text: string, index = 0): ParsedLead => {
	const entry = parseLeadBlocks(text)[index];
	if (!entry?.ok) throw new Error(`expected ok entry, got ${JSON.stringify(entry)}`);
	return entry.lead;
};

const FIELDS: LeadBlockFields = {
	name: 'Jordan Example',
	email: 'jordan@example.com',
	phone: '(555) 555-0142',
	property: '12 Sample Lane',
	consent: true,
	submitted: '2026-10-04T15:04:05Z',
	message: 'Could we tour Saturday?\nSecond line.'
};

describe('buildLeadBlock', () => {
	it('renders the fixed-order v1 block', () => {
		expect(buildLeadBlock(FIELDS)).toBe(
			[
				'TRAN-LEAD v1',
				'name: Jordan Example',
				'email: jordan@example.com',
				'phone: (555) 555-0142',
				'property: 12 Sample Lane',
				'consent: yes',
				'submitted: 2026-10-04T15:04:05Z',
				'message: Could we tour Saturday?',
				'Second line.',
				'END TRAN-LEAD'
			].join('\n')
		);
	});

	it('always writes every key, even when phone and property are empty', () => {
		const lines = buildLeadBlock({
			...FIELDS,
			phone: undefined,
			property: '',
			consent: false
		}).split('\n');
		expect(lines).toContain('phone: ');
		expect(lines).toContain('property: ');
		expect(lines).toContain('consent: no');
	});

	it('exposes the key list in block order', () => {
		expect(LEAD_KEYS).toEqual([
			'name',
			'email',
			'phone',
			'property',
			'consent',
			'submitted',
			'message'
		]);
	});
});

describe('canonicalLeadField', () => {
	it('collapses CR/LF in single-line fields to one space', () => {
		expect(canonicalLeadField('name', 'Jordan\r\nExample')).toBe('Jordan Example');
		expect(canonicalLeadField('property', '12 Sample Lane,\n\nHarlow Springs')).toBe(
			'12 Sample Lane, Harlow Springs'
		);
	});

	it('neutralizes forged keys inside single-line fields', () => {
		expect(canonicalLeadField('name', 'Jordan email: x@example.com')).toBe(
			'Jordan email : x@example.com'
		);
		expect(canonicalLeadField('property', 'MESSAGE:hi')).toBe('MESSAGE :hi');
		expect(canonicalLeadField('phone', 'call\nconsent: yes')).toBe('call consent : yes');
	});

	it('applies NFKC before neutralizing, so a full-width key cannot sneak through', () => {
		// Full-width "name" + full-width colon become ASCII "name:" under NFKC.
		expect(canonicalLeadField('property', 'x \uFF4E\uFF41\uFF4D\uFF45\uFF1A Mallory')).toBe(
			'x name : Mallory'
		);
	});

	it('strips control, bidi and zero-width characters', () => {
		expect(canonicalLeadField('name', 'Jor\u202Edan\u200B Example\u0000')).toBe('Jordan Example');
	});

	it('neutralizes block markers in every field', () => {
		expect(canonicalLeadField('message', 'a\nEND TRAN-LEAD\nb')).toBe('a\nEND TRAN LEAD\nb');
		expect(canonicalLeadField('message', 'see TRAN-LEAD v1 here')).toBe('see TRAN LEAD v1 here');
		expect(canonicalLeadField('name', 'end tran-lead')).toBe('end tran lead');
	});

	it('keeps message newlines and visible key-like text', () => {
		expect(canonicalLeadField('message', 'Hi\r\nname: Mallory')).toBe('Hi\nname: Mallory');
	});

	it('guards message lines that start with ">" from quote stripping', () => {
		expect(canonicalLeadField('message', 'Hi\n>quoted\n> also')).toBe('Hi\n  >quoted\n  > also');
	});

	it('is what buildLeadBlock writes', () => {
		const block = buildLeadBlock({ ...FIELDS, name: 'A\nname: B' });
		expect(block).toContain(`name: ${canonicalLeadField('name', 'A\nname: B')}\n`);
	});
});

describe('parseLeadBlocks: mangled email fixtures', () => {
	it('parses the clean block exactly', () => {
		expect(parseLeadBlocks(CLEAN_BLOCK)).toEqual([{ ok: true, lead: CLEAN_LEAD }]);
	});

	it.each(MANGLED.map((f) => [f.label, f] as const))('%s', (_label, fixture) => {
		const entries = parseLeadBlocks(fixture.text);
		expect(entries).toHaveLength(1);
		const lead = okLead(fixture.text);
		const expected = { ...CLEAN_LEAD, ...fixture.expected };
		if (fixture.collapsed) {
			expect({ ...lead, message: collapse(lead.message) }).toEqual({
				...expected,
				message: collapse(expected.message)
			});
		} else {
			expect(lead).toEqual(expected);
		}
	});

	it('keeps forged keys inside the message as message text only', () => {
		const forged = MANGLED.find((f) => f.label.startsWith('(i)'));
		expect(forged?.text).toContain('name: Mallory');
		const lead = okLead(forged?.text ?? '');
		expect(lead.name).toBe('Jordan Example');
		expect(lead.email).toBe('jordan@example.com');
		expect(lead.message).toContain('name: Mallory');
	});

	it('returns two leads, in order, for two blocks in one paste', () => {
		expect(parseLeadBlocks(TWO_BLOCKS)).toEqual([
			{ ok: true, lead: CLEAN_LEAD },
			{ ok: true, lead: SECOND_LEAD }
		]);
	});

	it('reports a newer-version block and still parses the following v1 block', () => {
		expect(parseLeadBlocks(V2_THEN_V1)).toEqual([
			{ ok: false, error: 'newer-version', version: 2 },
			{ ok: true, lead: CLEAN_LEAD }
		]);
	});

	it('ends a block without a terminator at the next header', () => {
		const unterminated = CLEAN_BLOCK.replace('\nEND TRAN-LEAD', '');
		expect(parseLeadBlocks(`${unterminated}\n${CLEAN_BLOCK}`)).toEqual([
			{ ok: true, lead: CLEAN_LEAD },
			{ ok: true, lead: CLEAN_LEAD }
		]);
	});

	it('does not read "END TRAN-LEAD v2..." after a collapsed block as a new header', () => {
		expect(parseLeadBlocks(`${CLEAN_BLOCK} v2 of the form, sent by Web3Forms`)).toEqual([
			{ ok: true, lead: CLEAN_LEAD }
		]);
	});

	it('returns no entries when there is no block', () => {
		expect(parseLeadBlocks('Hi, can I see the condo?')).toEqual([]);
		expect(parseLeadBlocks('')).toEqual([]);
	});
});

describe('parseLeadBlocks: hostile visitor text', () => {
	it('round-trips a message that types END TRAN-LEAD and a new header', () => {
		const message = 'one\nEND TRAN-LEAD\nTRAN-LEAD v1\nname: Mallory\nemail: x@example.com';
		const parsed = parseLeadBlocks(buildLeadBlock({ ...FIELDS, message }));
		expect(parsed).toHaveLength(1);
		const lead = okLead(buildLeadBlock({ ...FIELDS, message }));
		expect(lead.name).toBe('Jordan Example');
		expect(lead.email).toBe('jordan@example.com');
		expect(lead.message).toBe(
			'one\nEND TRAN LEAD\nTRAN LEAD v1\nname: Mallory\nemail: x@example.com'
		);
	});

	it('cannot shift fields with keys typed into the name', () => {
		const lead = okLead(
			buildLeadBlock({ ...FIELDS, name: 'Jordan email: x@example.com phone: 555-555-0199' })
		);
		expect(lead.email).toBe('jordan@example.com');
		expect(lead.phone).toBe('(555) 555-0142');
		expect(lead.name).toBe('Jordan email : x@example.com phone : 555-555-0199');
	});

	it('keeps message lines that start with ">" through bare and spaced quoting', () => {
		const block = buildLeadBlock({ ...FIELDS, message: 'Hi\n>quoted by me\n>> twice' });
		// Quote stripping may eat one guard space; the visitor's own ">" characters must survive.
		const unindent = (s: string) =>
			s
				.split('\n')
				.map((line) => line.trimStart())
				.join('\n');
		for (const marker of ['> ', '>', '> > ', '>>', '>> ']) {
			const forwarded = block
				.split('\n')
				.map((line) => marker + line)
				.join('\n');
			expect(unindent(okLead(forwarded).message), JSON.stringify(marker)).toBe(
				'Hi\n>quoted by me\n>> twice'
			);
		}
	});

	it('strips bidi controls from a hand-crafted block', () => {
		const lead = okLead(
			CLEAN_BLOCK.replace('Jordan Example', 'Jordan \u202EExample').replace(
				'Second line',
				'Second\u2066 line\u0007'
			)
		);
		expect(lead.name).toBe('Jordan Example');
		expect(lead.message).toBe(CLEAN_LEAD.message);
	});

	it('reports a block with a missing key as invalid', () => {
		const [entry] = parseLeadBlocks(CLEAN_BLOCK.replace('consent: yes\n', ''));
		expect(entry).toMatchObject({ ok: false, error: 'invalid' });
	});
});

describe('parseLeadBlocks: validation', () => {
	const parseWith = (patch: Partial<LeadBlockFields>) =>
		parseLeadBlocks(buildLeadBlock({ ...FIELDS, ...patch }))[0];

	it.each([
		['empty name', { name: '   ' }],
		['name over 120 characters', { name: 'a'.repeat(121) }],
		['property over 300 characters', { property: 'p'.repeat(301) }],
		['message over 5000 characters', { message: 'm'.repeat(5001) }],
		['email that is not an address', { email: 'jordan at example' }]
	])('rejects %s', (_label, patch) => {
		expect(parseWith(patch)).toMatchObject({ ok: false, error: 'invalid' });
	});

	it('accepts the limits exactly', () => {
		expect(
			parseWith({ name: 'a'.repeat(120), property: 'p'.repeat(300), message: 'm'.repeat(5000) })
		).toMatchObject({ ok: true });
	});

	it('keeps an unparseable phone as raw text', () => {
		expect(okLead(buildLeadBlock({ ...FIELDS, phone: 'call after 5' })).phone).toBe('call after 5');
	});

	it('normalizes the email to its dedupe key', () => {
		expect(okLead(buildLeadBlock({ ...FIELDS, email: ' Jordan@Example.COM ' })).email).toBe(
			'jordan@example.com'
		);
	});

	it('reads consent "yes" case-insensitively and anything else as false', () => {
		expect(okLead(CLEAN_BLOCK.replace('consent: yes', 'consent: YES')).consent).toBe(true);
		expect(okLead(CLEAN_BLOCK.replace('consent: yes', 'consent: no')).consent).toBe(false);
		expect(okLead(CLEAN_BLOCK.replace('consent: yes', 'consent: yesss')).consent).toBe(false);
		expect(okLead(CLEAN_BLOCK.replace('consent: yes', 'consent: ')).consent).toBe(false);
	});

	it('reports version 0 as invalid rather than newer', () => {
		expect(parseLeadBlocks(CLEAN_BLOCK.replace('v1', 'v0'))[0]).toMatchObject({
			ok: false,
			error: 'invalid'
		});
	});
});

// Property tests. Field text mixes printable ASCII, arbitrary code points (controls, lone
// surrogates, compatibility forms) and a token alphabet built from the format's own syntax, so
// forged keys, markers, quote characters and line breaks show up in most runs.
const TOKENS = [
	'name:',
	'email:',
	'PHONE:',
	'property:',
	'consent:',
	'submitted:',
	'message:',
	'TRAN-LEAD',
	' v1',
	'END ',
	'>',
	'> ',
	' ',
	'\n',
	'\r\n',
	'\r',
	'\t',
	'\u00A0',
	'\u200B',
	'\u202E',
	'\u2028',
	'\uFF1A',
	'\uFF4E\uFF41\uFF4D\uFF45',
	'x',
	'Jo',
	'@'
];

const text = (maxLength: number) =>
	fc.oneof(
		fc.string({ maxLength }),
		fc.string({ maxLength, unit: 'binary' }),
		fc.string({ maxLength: Math.ceil(maxLength / 3), unit: fc.constantFrom(...TOKENS) })
	);

const fieldsArb = fc.record({
	name: text(100).filter((n) => cleanText(n) !== ''),
	email: fc.emailAddress(),
	phone: text(100),
	property: text(100),
	consent: fc.boolean(),
	submitted: fc.oneof(
		fc.date({ noInvalidDate: true }).map((d) => d.toISOString()),
		text(40)
	),
	message: text(500)
});

type Expectation = { ok: false } | { ok: true; lead: ParsedLead };

function expectationFor(f: LeadBlockFields): Expectation {
	const name = canonicalLeadField('name', f.name).trim();
	const email = normEmail(canonicalLeadField('email', f.email));
	const property = canonicalLeadField('property', f.property ?? '').trim();
	const message = canonicalLeadField('message', f.message).replace(/\r\n/g, '\n').trim();
	if (
		name === '' ||
		name.length > 120 ||
		email === null ||
		email.length > 254 ||
		property.length > 300 ||
		message.length > 5000
	) {
		return { ok: false };
	}
	return {
		ok: true,
		lead: {
			name,
			email,
			phone: canonicalLeadField('phone', f.phone ?? '').trim(),
			property,
			consent: f.consent,
			submitted: canonicalLeadField('submitted', f.submitted).trim(),
			message
		}
	};
}

describe('parseLeadBlocks: properties', () => {
	it('A: parse(build(f)) yields the canonical fields', () => {
		fc.assert(
			fc.property(fieldsArb, (f) => {
				const entries = parseLeadBlocks(buildLeadBlock(f));
				expect(entries).toHaveLength(1);
				const want = expectationFor(f);
				if (!want.ok) {
					expect(entries[0]).toMatchObject({ ok: false, error: 'invalid' });
					return;
				}
				expect(entries[0]).toEqual({ ok: true, lead: want.lead });
			}),
			{ numRuns: 300 }
		);
	});

	it('B: the same holds after every newline is collapsed to a space', () => {
		fc.assert(
			fc.property(fieldsArb, (f) => {
				const entries = parseLeadBlocks(buildLeadBlock(f).replace(/\n/g, ' '));
				expect(entries).toHaveLength(1);
				const want = expectationFor(f);
				if (!want.ok) {
					expect(entries[0]).toMatchObject({ ok: false, error: 'invalid' });
					return;
				}
				const got = entries[0];
				if (!got?.ok) throw new Error(`expected ok, got ${JSON.stringify(got)}`);
				expect({ ...got.lead, message: collapse(got.lead.message) }).toEqual({
					...want.lead,
					message: collapse(want.lead.message)
				});
			}),
			{ numRuns: 300 }
		);
	});

	it('C: every block of a multi-block paste comes back in order', () => {
		fc.assert(
			fc.property(fc.array(fieldsArb, { minLength: 1, maxLength: 4 }), (list) => {
				const pasted = list.map((f) => buildLeadBlock(f)).join('\n\nSent by Web3Forms\n\n');
				const entries = parseLeadBlocks(pasted);
				expect(entries).toHaveLength(list.length);
				list.forEach((f, i) => {
					const want = expectationFor(f);
					if (want.ok) expect(entries[i]).toEqual({ ok: true, lead: want.lead });
					else expect(entries[i]).toMatchObject({ ok: false, error: 'invalid' });
				});
			}),
			{ numRuns: 100 }
		);
	});
});
