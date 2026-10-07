import { describe, expect, test } from 'vitest';

import {
	BROKERAGE_PHONE_STATES,
	DISCLOSURE_FIELD_LABELS,
	HASHTAG_CAPS,
	PLATFORMS,
	PLATFORM_LABELS,
	PLATFORM_LIMITS,
	SAFETY_MARGIN,
	appendDisclosure,
	assemblePost,
	brokerageLine,
	formatDisclosure,
	hashtagBlock,
	missingFor,
	postBudget,
	type DisclosureProfile,
	type Platform
} from './disclosure-format.js';

// Glyphs are built from code points to keep this source ASCII.
const DOT = String.fromCharCode(0xb7);
const SEP = ` ${DOT} `;
const HOUSE = String.fromCodePoint(0x1f3e1);
const LQ = String.fromCharCode(0x201c);
const RQ = String.fromCharCode(0x201d);
const APOS = String.fromCharCode(0x2019);

const P: DisclosureProfile = {
	fullName: 'Avery Sample',
	brokerage: 'Sample Realty',
	licenseType: 'Licensed Real Estate Salesperson',
	licenseNumber: '10401234567',
	licenseState: 'NY',
	brokeragePhone: '(555) 555-0142',
	phone: '(555) 555-0187',
	email: 'avery@example.com',
	website: 'https://example.com'
};

const D = formatDisclosure(P, 'ad-inline').text;

describe('constants', () => {
	test('platform order, limits, caps, labels and margin', () => {
		expect(PLATFORMS).toEqual(['instagram', 'facebook', 'linkedin']);
		expect(PLATFORM_LIMITS).toEqual({ instagram: 2200, facebook: 63206, linkedin: 3000 });
		expect(HASHTAG_CAPS).toEqual({ instagram: 5, facebook: 2, linkedin: 3 });
		expect(PLATFORM_LABELS).toEqual({
			instagram: 'Instagram',
			facebook: 'Facebook',
			linkedin: 'LinkedIn'
		});
		expect(SAFETY_MARGIN).toBe(40);
		expect(BROKERAGE_PHONE_STATES).toEqual(['NY', 'NJ']);
	});

	test('DISCLOSURE_FIELD_LABELS match the UI-SPEC missing-item names', () => {
		expect(DISCLOSURE_FIELD_LABELS).toEqual({
			fullName: 'full name',
			brokerage: 'brokerage',
			licenseType: 'license type',
			licenseNumber: 'license number',
			licenseState: 'license state',
			brokeragePhone: 'brokerage phone'
		});
	});
});

describe('formatDisclosure', () => {
	test('ad-inline union format, brokerage first', () => {
		expect(formatDisclosure(P, 'ad-inline').text).toBe(
			`Sample Realty${SEP}Avery Sample, Licensed Real Estate Salesperson${SEP}Lic. #10401234567 (NY)${SEP}(555) 555-0142`
		);
	});

	test('team name renders as "{Team} at {Brokerage}"', () => {
		const team = { ...P, teamName: 'The Sample Team' };
		expect(brokerageLine(team)).toBe('The Sample Team at Sample Realty');
		expect(
			formatDisclosure(team, 'ad-inline').text.startsWith(`The Sample Team at Sample Realty${SEP}`)
		).toBe(true);
	});

	test('blank team name falls back to the brokerage alone', () => {
		expect(brokerageLine({ ...P, teamName: '   ' })).toBe('Sample Realty');
	});

	test('ad-block lines and text', () => {
		const r = formatDisclosure(P, 'ad-block');
		expect(r.lines).toEqual([
			'Sample Realty',
			'Avery Sample, Licensed Real Estate Salesperson',
			'Lic. #10401234567 (NY)',
			'(555) 555-0142'
		]);
		expect(r.text).toBe(r.lines.join('\n'));
		expect(r.variant).toBe('ad-block');
	});

	test('print variant with both phones labels Office and Mobile', () => {
		const r = formatDisclosure(P, 'print');
		expect(r.print).toEqual({
			brokerageLine: 'Sample Realty',
			agentLine: 'Avery Sample, Licensed Real Estate Salesperson',
			licenseLine: 'License #10401234567 (NY)',
			contactLines: [
				'Office (555) 555-0142',
				'Mobile (555) 555-0187',
				'avery@example.com',
				'https://example.com'
			]
		});
		expect(r.lines).toEqual([
			'Sample Realty',
			'Avery Sample, Licensed Real Estate Salesperson',
			'License #10401234567 (NY)',
			'Office (555) 555-0142',
			'Mobile (555) 555-0187',
			'avery@example.com',
			'https://example.com'
		]);
		expect(r.text).toBe(r.lines.join('\n'));
	});

	test('print variant with one phone drops the label', () => {
		const r = formatDisclosure({ ...P, phone: '' }, 'print');
		expect(r.print?.contactLines).toEqual([
			'(555) 555-0142',
			'avery@example.com',
			'https://example.com'
		]);
		const m = formatDisclosure({ ...P, brokeragePhone: '' }, 'print');
		expect(m.print?.contactLines[0]).toBe('(555) 555-0187');
	});

	test('empty optional parts are omitted, never rendered as empty separators', () => {
		const sparse = { ...P, brokeragePhone: '', licenseType: '' };
		const t = formatDisclosure(sparse, 'ad-inline').text;
		expect(t).toBe(`Sample Realty${SEP}Avery Sample${SEP}Lic. #10401234567 (NY)`);
		expect(t.includes(`${SEP}${SEP}`)).toBe(false);
		expect(t.includes(` ${DOT}  ${DOT} `)).toBe(false);
		expect(t.endsWith(SEP)).toBe(false);
		expect(t.endsWith(` ${DOT}`)).toBe(false);
		const noLic = formatDisclosure({ ...P, licenseNumber: '' }, 'ad-inline').text;
		expect(noLic).toBe(
			`Sample Realty${SEP}Avery Sample, Licensed Real Estate Salesperson${SEP}(555) 555-0142`
		);
		const noState = formatDisclosure({ ...P, licenseState: '' }, 'ad-block');
		expect(noState.lines[2]).toBe('Lic. #10401234567');
		const empty = formatDisclosure(
			{ fullName: '', brokerage: '', licenseType: '', licenseNumber: '', licenseState: '' },
			'ad-inline'
		);
		expect(empty.text).toBe('');
		expect(empty.lines).toEqual([]);
	});

	test('formatted result carries the missing fields', () => {
		const r = formatDisclosure({ ...P, brokeragePhone: '' }, 'ad-inline');
		expect(r.missing).toEqual(['brokeragePhone']);
		expect(formatDisclosure(P, 'print').missing).toEqual([]);
	});

	test.each(['FL', 'NJ', 'OH', 'CA', 'NY', 'TX', 'ZZ'])(
		'state %s: brokerage first, license with state',
		(st) => {
			for (const teamName of [undefined, 'The Sample Team']) {
				const prof = { ...P, licenseState: st, teamName };
				const t = formatDisclosure(prof, 'ad-inline').text;
				expect(t.startsWith(brokerageLine(prof))).toBe(true);
				expect(t).toContain(`Lic. #${P.licenseNumber} (${st})`);
				expect(t.indexOf('Sample Realty')).toBeLessThan(t.indexOf('Avery Sample'));
			}
		}
	);
});

describe('missingFor', () => {
	test.each(['NY', 'NJ', 'ny'])('%s requires the brokerage phone', (st) => {
		const prof = { ...P, licenseState: st, brokeragePhone: '' };
		expect(missingFor(prof, 'ad-inline')).toContain('brokeragePhone');
		expect(missingFor({ ...prof, brokeragePhone: undefined }, 'print')).toContain('brokeragePhone');
	});

	test('other states do not require the brokerage phone', () => {
		expect(missingFor({ ...P, licenseState: 'CA', brokeragePhone: '' }, 'ad-inline')).toEqual([]);
	});

	test('every empty required field is reported in field order', () => {
		const blank: DisclosureProfile = {
			fullName: '',
			brokerage: ' ',
			licenseType: '',
			licenseNumber: '',
			licenseState: ''
		};
		expect(missingFor(blank, 'ad-block')).toEqual([
			'fullName',
			'brokerage',
			'licenseType',
			'licenseNumber',
			'licenseState'
		]);
		const nyBlank = { ...blank, licenseState: 'NY' };
		expect(missingFor(nyBlank, 'ad-inline')).toEqual([
			'fullName',
			'brokerage',
			'licenseType',
			'licenseNumber',
			'brokeragePhone'
		]);
	});

	test('missing parts are omitted from text but still reported', () => {
		const r = formatDisclosure({ ...P, fullName: '' }, 'ad-inline');
		expect(r.missing).toEqual(['fullName']);
		expect(r.text).toBe(
			`Sample Realty${SEP}Licensed Real Estate Salesperson${SEP}Lic. #10401234567 (NY)${SEP}(555) 555-0142`
		);
	});
});

describe('appendDisclosure and hashtagBlock', () => {
	test('appendDisclosure trims the draft end and joins with a blank line', () => {
		expect(appendDisclosure('Draft  \n', 'X')).toBe('Draft\n\nX');
		expect(appendDisclosure('Draft', '')).toBe('Draft');
	});

	test('hashtagBlock joins with spaces', () => {
		expect(hashtagBlock(['#A', '#B'])).toBe('#A #B');
		expect(hashtagBlock([])).toBe('');
	});
});

describe('assemblePost', () => {
	const TAGS = ['#A', '#B', '#C', '#D', '#E', '#F', '#G'];
	const body = 'Open house this Saturday.  \n';

	test('instagram keeps 5 tags and appends the disclosure last', () => {
		const r = assemblePost('instagram', body, TAGS, D);
		expect(r.keptTags).toHaveLength(5);
		expect(r.droppedTags).toBe(2);
		expect(r.text).toBe(body.trimEnd() + '\n\n#A #B #C #D #E' + '\n\n' + D);
	});

	test('linkedin keeps 3, facebook keeps 2', () => {
		expect(assemblePost('linkedin', body, TAGS, D).keptTags).toEqual(['#A', '#B', '#C']);
		expect(assemblePost('linkedin', body, TAGS, D).droppedTags).toBe(4);
		expect(assemblePost('facebook', body, TAGS, D).keptTags).toEqual(['#A', '#B']);
		expect(assemblePost('facebook', body, TAGS, D).droppedTags).toBe(5);
	});

	test('extra tags are dropped from the tag list, never from the body', () => {
		const withTags = 'Tour #Z today';
		const r = assemblePost('facebook', withTags, TAGS, D);
		expect(r.text.startsWith(withTags)).toBe(true);
	});

	test('empty tag list adds no tag block', () => {
		const r = assemblePost('instagram', 'Hello', [], D);
		expect(r.text).toBe('Hello' + '\n\n' + D);
		expect(r.droppedTags).toBe(0);
	});

	test('length, limit and over', () => {
		for (const platform of PLATFORMS) {
			const short = assemblePost(platform, 'Hi', ['#A'], D);
			expect(short.length).toBe(short.text.length);
			expect(short.limit).toBe(PLATFORM_LIMITS[platform]);
			expect(short.over).toBe(0);
		}
		const long = assemblePost('instagram', 'x'.repeat(3000), [], D);
		expect(long.over).toBe(long.length - 2200);
		expect(long.text.endsWith(D)).toBe(true);
	});

	test('emoji count as two UTF-16 units', () => {
		const r = assemblePost('instagram', HOUSE, [], 'X');
		expect(r.length).toBe(2 + 2 + 1);
	});

	test.each(PLATFORMS)(
		'property: disclosure is always last and never truncated (%s)',
		(platform: Platform) => {
			let s = 9;
			const next = (): number => {
				s = (s * 1664525 + 1013904223) >>> 0;
				return s;
			};
			const alphabet = ['a', 'Z', ' ', '\n', '.', '7', HOUSE, LQ, RQ, APOS, '#'];
			const limit = PLATFORM_LIMITS[platform];
			for (let i = 0; i < 500; i++) {
				const len = next() % 70001;
				const parts: string[] = [];
				// Build in runs so long bodies stay cheap.
				let built = 0;
				while (built < len) {
					const ch = alphabet[next() % alphabet.length] ?? 'a';
					const run = ch.repeat(1 + (next() % 200));
					parts.push(run);
					built += run.length;
				}
				const bodyText = parts.join('').slice(0, len);
				const tagCount = next() % 10;
				const tags = Array.from({ length: tagCount }, (_, k) => `#tag${k}`);
				const r = assemblePost(platform, bodyText, tags, D);
				expect(r.text.endsWith(D)).toBe(true);
				expect(r.text.indexOf(D)).toBe(r.text.length - D.length);
				expect(r.over > 0).toBe(r.text.length > limit);
				expect(r.keptTags.length).toBe(Math.min(tagCount, HASHTAG_CAPS[platform]));
			}
		}
	);
});

describe('postBudget', () => {
	test('instagram budget subtracts disclosure, capped tag block, separators and margin', () => {
		const tags = ['#A', '#B', '#C', '#D', '#E', '#F', '#G'];
		expect(postBudget('instagram', D, tags)).toBe(
			2200 - D.length - (hashtagBlock(tags.slice(0, 5)).length + 2) - 2 - 40
		);
		expect(postBudget('instagram', D, [])).toBe(2200 - D.length - 2 - 40);
		expect(postBudget('linkedin', D, tags)).toBe(
			3000 - D.length - (hashtagBlock(tags.slice(0, 3)).length + 2) - 2 - 40
		);
	});

	test('budget is floored at 0', () => {
		expect(postBudget('instagram', 'x'.repeat(5000), [])).toBe(0);
	});
});
