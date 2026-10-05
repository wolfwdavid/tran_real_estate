import { describe, expect, test } from 'vitest';

import { checkFairHousing } from './check.js';
import { LEXICON } from './lexicon.js';
import { BAD_PHRASES, NEUTRAL_PHRASES, type BadPhrase } from './suite.js';
import type { Category, Finding } from './types.js';

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** Every member across findings, flattened. */
const members = (findings: Finding[]) => findings.flatMap((f) => f.members);

/** True when some member matches the row's entry, category and severity. */
function flags(text: string, row: BadPhrase): boolean {
	return members(checkFairHousing(text)).some(
		(m) => m.entryId === row.entryId && m.category === row.category && m.severity === row.severity
	);
}

const STATE_CATEGORIES: readonly Category[] = [
	'source-of-income',
	'age',
	'marital-status',
	'sogi'
];

describe('suite sizes (non-vacuous)', () => {
	test('at least 30 bad and 30 neutral phrases', () => {
		expect(BAD_PHRASES.length).toBeGreaterThanOrEqual(30);
		expect(NEUTRAL_PHRASES.length).toBeGreaterThanOrEqual(30);
		expect(BAD_PHRASES).toHaveLength(42);
		expect(NEUTRAL_PHRASES).toHaveLength(40);
	});

	test('CONTEXT examples are covered by name', () => {
		const bad = BAD_PHRASES.map((r) => r.text);
		for (const t of [
			'perfect for young professionals',
			'no kids',
			'Christian community',
			'walking distance to church',
			'no Section 8',
			'able-bodied'
		]) {
			expect(bad).toContain(t);
		}
		for (const t of [
			'two bedrooms',
			'near transit',
			'pet policy on request',
			'wheelchair accessible entrance'
		]) {
			expect(NEUTRAL_PHRASES).toContain(t);
		}
	});
});

describe('known-bad phrases are flagged', () => {
	test.each(BAD_PHRASES)('alone: "$text" -> $entryId', (row) => {
		expect(flags(row.text, row)).toBe(true);
	});

	test.each(BAD_PHRASES)('inside a sentence: "$text"', (row) => {
		expect(flags(`Bright unit. ${row.text}. Call today.`, row)).toBe(true);
	});

	test.each(BAD_PHRASES)('sentence-initial capitalized: "$text"', (row) => {
		expect(flags(`${cap(row.text)} today.`, row)).toBe(true);
	});
});

describe('neutral phrases pass', () => {
	test.each(NEUTRAL_PHRASES)('alone: "%s"', (phrase) => {
		expect(checkFairHousing(phrase)).toEqual([]);
	});

	test.each(NEUTRAL_PHRASES)('inside a sentence: "%s"', (phrase) => {
		expect(checkFairHousing(`Listing note: ${phrase}.`)).toEqual([]);
	});
});

describe('lexicon shape', () => {
	test('41 entries with unique ids', () => {
		expect(LEXICON).toHaveLength(41);
		expect(new Set(LEXICON.map((e) => e.id)).size).toBe(41);
	});

	test.each(LEXICON.map((e) => [e.id, e] as const))('%s is well-formed', (_id, entry) => {
		expect(entry.explanation.trim()).not.toBe('');
		expect(entry.source.trim()).not.toBe('');
		expect(entry.source).not.toContain('2024');
		expect(entry.examples.length).toBeGreaterThanOrEqual(1);
		expect(entry.scope).toBe(STATE_CATEGORIES.includes(entry.category) ? 'state' : 'federal');
	});

	test.each(LEXICON.map((e) => [e.id, e] as const))('%s matches its own examples', (_id, entry) => {
		for (const ex of entry.examples) {
			expect(checkFairHousing(ex, [entry])).not.toEqual([]);
		}
	});

	test('every BAD row points at a lexicon entry, and every entry has a BAD row', () => {
		const ids = new Set(LEXICON.map((e) => e.id));
		for (const row of BAD_PHRASES) expect(ids).toContain(row.entryId);
		const covered = new Set(BAD_PHRASES.map((r) => r.entryId));
		for (const id of ids) expect(covered).toContain(id);
	});
});

describe('UI-SPEC mapping', () => {
	test('block + warn in one sentence gives two findings', () => {
		const findings = checkFairHousing(
			'Perfect for young professionals, walking distance to church.'
		);
		expect(findings).toHaveLength(2);
		expect(findings.map((f) => f.severity)).toEqual(['block', 'warn']);
	});

	test("'no Section 8' removes and is state scope", () => {
		const [m] = members(checkFairHousing('no Section 8'));
		expect(m?.entryId).toBe('soi.no-section-8');
		expect(m?.alternative).toBe('');
		expect(m?.scope).toBe('state');
	});

	test("'walking distance to church' warns with a replacement", () => {
		const [m] = members(checkFairHousing('walking distance to church'));
		expect(m?.severity).toBe('warn');
		expect(m?.alternative).toBe('walkable to shops and parks');
	});

	test("'perfect for young professionals' blocks with a replacement", () => {
		const [m] = members(checkFairHousing('perfect for young professionals'));
		expect(m?.severity).toBe('block');
		expect(m?.alternative).toBe('close to transit and downtown');
	});
});
