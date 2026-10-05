import { describe, expect, test } from 'vitest';

import { ALLOW_PHRASES } from './allow.js';
import { checkFairHousing, mergeFindings } from './check.js';
import { p } from './pattern.js';
import type { Finding, FindingMember, LexiconEntry } from './types.js';

function entry(
	partial: Partial<LexiconEntry> & Pick<LexiconEntry, 'id' | 'pattern'>
): LexiconEntry {
	return {
		category: 'familial-status',
		scope: 'federal',
		severity: 'block',
		explanation: 'Test explanation.',
		alternative: '',
		source: 'Test source',
		examples: ['example'],
		...partial
	};
}

const T: readonly LexiconEntry[] = [
	entry({ id: 't.kids', pattern: p`no kids`, category: 'familial-status', severity: 'block' }),
	entry({
		id: 't.young',
		pattern: p`perfect for young professionals`,
		category: 'familial-status',
		severity: 'block',
		alternative: 'close to transit and downtown'
	}),
	entry({
		id: 't.prof',
		pattern: p`young professionals`,
		category: 'age',
		scope: 'state',
		severity: 'warn'
	}),
	entry({
		id: 't.church',
		pattern: p`walking distance to church`,
		category: 'religion',
		severity: 'warn',
		alternative: 'walkable to shops and parks'
	}),
	entry({ id: 't.bachelor', pattern: p`bachelor`, category: 'sex', severity: 'block' })
];

function assertWellFormed(text: string, findings: Finding[]): void {
	let previousEnd = -1;
	for (const f of findings) {
		expect(f.id).toBe(`${f.start}-${f.end}`);
		expect(f.phrase).toBe(text.slice(f.start, f.end));
		expect(f.start).toBeGreaterThanOrEqual(previousEnd);
		previousEnd = f.end;
		for (const m of f.members) {
			expect(m.phrase).toBe(text.slice(m.start, m.end));
		}
	}
}

describe('checkFairHousing', () => {
	test('single hit with exact offsets and member metadata', () => {
		const text = 'No kids, please.';
		const findings = checkFairHousing(text, T);
		expect(findings).toHaveLength(1);
		const [f] = findings;
		expect(f.start).toBe(0);
		expect(f.end).toBe(7);
		expect(f.phrase).toBe('No kids');
		expect(f.severity).toBe('block');
		expect(f.members[0].entryId).toBe('t.kids');
		expect(f.members[0].checker).toBe('fair-housing');
		expect(f.members[0].categoryLabel).toBe('Familial status');
		expect(f.members[0].scope).toBe('federal');
		assertWellFormed(text, findings);
	});

	test('offsets stay exact after non-ASCII text (Café 🏠)', () => {
		const text = 'Café 🏠 — no kids here';
		const findings = checkFairHousing(text, T);
		expect(findings).toHaveLength(1);
		expect(text.slice(findings[0].start, findings[0].end)).toBe('no kids');
		assertWellFormed(text, findings);
	});

	test('overlapping hits merge into one block finding with ordered members', () => {
		const text = 'Perfect for young professionals.';
		const findings = checkFairHousing(text, T);
		expect(findings).toHaveLength(1);
		const [f] = findings;
		expect(f.start).toBe(0);
		expect(f.end).toBe(31);
		expect(f.phrase).toBe('Perfect for young professionals');
		expect(f.severity).toBe('block');
		expect(f.members.map((m) => m.entryId)).toEqual(['t.young', 't.prof']);
		expect(f.members[1].categoryLabel).toBe('Age');
		expect(f.members[1].scope).toBe('state');
		assertWellFormed(text, findings);
	});

	test('a warn-only overlap stays warn', () => {
		const findings = checkFairHousing('Great for young professionals.', T);
		expect(findings).toHaveLength(1);
		expect(findings[0].severity).toBe('warn');
	});

	test('non-overlapping hits come back in reading order', () => {
		const text = 'No kids. Walking distance to church.';
		const findings = checkFairHousing(text, T);
		expect(findings.map((f) => f.severity)).toEqual(['block', 'warn']);
		expect(findings.map((f) => f.phrase)).toEqual(['No kids', 'Walking distance to church']);
		assertWellFormed(text, findings);
	});

	test('allow-list suppresses matches fully inside a neutral phrase', () => {
		expect(checkFairHousing('Sunny bachelor apartment.', T, [p`bachelor apartment`])).toEqual([]);
		expect(checkFairHousing('Perfect for a bachelor.', T, [p`bachelor apartment`])).toHaveLength(1);
		// Non-vacuity: without the allow-list the same text is flagged.
		expect(checkFairHousing('Sunny bachelor apartment.', T, [])).toHaveLength(1);
	});

	test('the default allow-list is ALLOW_PHRASES', () => {
		expect(ALLOW_PHRASES.length).toBeGreaterThan(0);
		expect(checkFairHousing('Sunny bachelor apartment.', T)).toEqual([]);
		expect(checkFairHousing('A cozy mother-in-law suite.', T)).toEqual([]);
	});

	test('empty and clean text produce no findings', () => {
		expect(checkFairHousing('', T)).toEqual([]);
		expect(checkFairHousing('Two bedrooms near transit.', T)).toEqual([]);
	});

	test('a repeated phrase yields one finding per occurrence', () => {
		const text = 'no kids, no kids';
		const findings = checkFairHousing(text, T);
		expect(findings).toHaveLength(2);
		assertWellFormed(text, findings);
	});

	test('an empty lexicon finds nothing', () => {
		expect(checkFairHousing('no kids', [])).toEqual([]);
	});

	test('never matches inside a longer word', () => {
		expect(checkFairHousing('Bachelorette party room', T)).toEqual([]);
	});
});

describe('mergeFindings', () => {
	const text = 'abcdefghijklmnop';
	function member(
		partial: Partial<FindingMember> & Pick<FindingMember, 'start' | 'end'>
	): FindingMember {
		return {
			entryId: 'x',
			checker: 'fair-housing',
			category: 'religion',
			categoryLabel: 'Religion',
			scope: 'federal',
			severity: 'warn',
			explanation: '',
			alternative: '',
			source: '',
			phrase: text.slice(partial.start, partial.end),
			...partial
		};
	}

	test('merges members from different checkers', () => {
		const claims = member({
			entryId: 'claims.guaranteed',
			checker: 'claims',
			category: 'claims',
			scope: 'other',
			severity: 'block',
			start: 0,
			end: 5
		});
		const fh = member({ entryId: 'fh.x', severity: 'warn', start: 3, end: 10 });
		const findings = mergeFindings([fh, claims], text);
		expect(findings).toHaveLength(1);
		expect(findings[0]).toMatchObject({
			id: '0-10',
			start: 0,
			end: 10,
			severity: 'block',
			phrase: 'abcdefghij'
		});
		expect(findings[0].members.map((m) => m.checker)).toEqual(['claims', 'fair-housing']);
	});

	test('touching ranges stay separate and never overlap', () => {
		const findings = mergeFindings(
			[member({ start: 5, end: 8 }), member({ start: 0, end: 5 })],
			text
		);
		expect(findings.map((f) => f.id)).toEqual(['0-5', '5-8']);
		assertWellFormed(text, findings);
	});

	test('chained overlaps collapse into one group', () => {
		const findings = mergeFindings(
			[member({ start: 0, end: 4 }), member({ start: 3, end: 7 }), member({ start: 6, end: 9 })],
			text
		);
		expect(findings).toHaveLength(1);
		expect(findings[0].id).toBe('0-9');
		expect(findings[0].members).toHaveLength(3);
	});

	test('same start: longer first, then block before warn', () => {
		const findings = mergeFindings(
			[
				member({ entryId: 'short-warn', start: 0, end: 3, severity: 'warn' }),
				member({ entryId: 'short-block', start: 0, end: 3, severity: 'block' }),
				member({ entryId: 'long', start: 0, end: 6, severity: 'warn' })
			],
			text
		);
		expect(findings[0].members.map((m) => m.entryId)).toEqual([
			'long',
			'short-block',
			'short-warn'
		]);
	});

	test('empty input', () => {
		expect(mergeFindings([], text)).toEqual([]);
	});
});
