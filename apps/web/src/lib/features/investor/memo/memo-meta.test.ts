// DEBT-03 (07-HUMAN-UAT S2): notes-only numerals ride in the memo artifact meta; mutation proof in 14-03-SUMMARY.md.
import { describe, expect, it } from 'vitest';
import { allowedFromText } from '@tran/core/numbers';
import { memoArtifactMeta, NOTES_NUMBERS_KEY, notesNumbersFromMeta } from './memo-meta';

const HASH = 'abc12345';
const NOTES = 'Rents rose 12% and the roof cost $8,500.';

/** The same rules the artifact store applies (artifacts.ts isMeta). */
function passesIsMeta(meta: Record<string, string>, extraKeys = 0): boolean {
	const entries = Object.entries(meta);
	return (
		entries.length + extraKeys <= 16 &&
		entries.every(([, v]) => typeof v === 'string' && v.length <= 200)
	);
}

const distinct = (xs: number[]) => [...new Set(xs)];

/** `count` distinct seven-digit numerals separated by spaces. */
const manyNumbers = (count: number) =>
	Array.from({ length: count }, (_, i) => String(1_000_001 + i)).join(' ');

describe('memoArtifactMeta', () => {
	it('empty notes store only the analysis hash (no notesNumbers keys)', () => {
		expect(memoArtifactMeta(HASH, '')).toEqual({ analysisHash: HASH });
		expect(memoArtifactMeta(HASH, 'No figures in here.')).toEqual({ analysisHash: HASH });
	});

	it('round-trips the notes numerals through the meta', () => {
		const meta = memoArtifactMeta(HASH, NOTES);
		const expected = distinct(allowedFromText(NOTES).map((a) => a.value));
		expect(expected.length).toBeGreaterThan(0);
		expect(meta.analysisHash).toBe(HASH);
		expect(meta[NOTES_NUMBERS_KEY]).toBe(expected.map(String).join(' '));
		expect(meta[NOTES_NUMBERS_KEY]!.split(' ').map(Number)).toEqual(expected);
		expect(notesNumbersFromMeta(meta)).toEqual(expected);
	});

	it('stores each value once, in String() form, single-space joined', () => {
		const meta = memoArtifactMeta(HASH, 'Paid $8,500, then $8,500 again; 12% then 12%. Also 0.5%.');
		const tokens = meta[NOTES_NUMBERS_KEY]!.split(' ');
		expect(new Set(tokens).size).toBe(tokens.length);
		for (const t of tokens) expect(String(Number(t))).toBe(t);
		expect(meta[NOTES_NUMBERS_KEY]).not.toMatch(/ {2}|^ | $/);
	});

	it('splits long lists into <= 200-char chunks on value boundaries, keys in order', () => {
		const notes = manyNumbers(100); // 100 x 7 digits + spaces = 799 chars of values
		const meta = memoArtifactMeta(HASH, notes);
		const chunkKeys = Object.keys(meta).filter((k) => k !== 'analysisHash');
		expect(chunkKeys.length).toBeGreaterThan(1);
		expect(chunkKeys).toEqual(
			chunkKeys.map((_, i) => (i === 0 ? NOTES_NUMBERS_KEY : `${NOTES_NUMBERS_KEY}.${i}`))
		);
		for (const k of chunkKeys) {
			const v = meta[k]!;
			expect(v.length).toBeLessThanOrEqual(200);
			for (const t of v.split(' ')) expect(t).toMatch(/^1\d{6}$/); // never a split value
		}
		expect(notesNumbersFromMeta(meta)).toEqual(
			Array.from({ length: 100 }, (_, i) => 1_000_001 + i)
		);
	});

	it('fills up to 12 chunks; past that it stores no notesNumbers at all (print fails closed)', () => {
		// 25 seven-digit values fit one 200-char chunk (25 x 7 + 24 spaces = 199).
		const twelve = memoArtifactMeta(HASH, manyNumbers(300));
		expect(Object.keys(twelve)).toHaveLength(13);
		expect(twelve[`${NOTES_NUMBERS_KEY}.11`]).toBeDefined();
		expect(notesNumbersFromMeta(twelve)).toHaveLength(300);

		expect(memoArtifactMeta(HASH, manyNumbers(301))).toEqual({ analysisHash: HASH });
	});

	it('every produced meta passes the store rules, leaving room for a copied key', () => {
		for (const notes of ['', NOTES, manyNumbers(100), manyNumbers(300), manyNumbers(301)]) {
			expect(passesIsMeta(memoArtifactMeta(HASH, notes), 1)).toBe(true);
		}
	});
});

describe('notesNumbersFromMeta', () => {
	it('missing meta or missing key reads as no numbers', () => {
		expect(notesNumbersFromMeta(undefined)).toEqual([]);
		expect(notesNumbersFromMeta({})).toEqual([]);
		expect(notesNumbersFromMeta({ analysisHash: HASH })).toEqual([]);
	});

	it('drops non-finite tokens', () => {
		expect(notesNumbersFromMeta({ [NOTES_NUMBERS_KEY]: 'x 12' })).toEqual([12]);
		expect(notesNumbersFromMeta({ [NOTES_NUMBERS_KEY]: 'Infinity NaN  -3 abc 0.5' })).toEqual([
			-3, 0.5
		]);
	});

	it('stops at the first missing chunk key and ignores keys past 11', () => {
		expect(
			notesNumbersFromMeta({
				[NOTES_NUMBERS_KEY]: '1',
				[`${NOTES_NUMBERS_KEY}.2`]: '3'
			})
		).toEqual([1]);
		const twelvePlus = Object.fromEntries(
			Array.from({ length: 13 }, (_, i) => [
				i === 0 ? NOTES_NUMBERS_KEY : `${NOTES_NUMBERS_KEY}.${i}`,
				String(i + 1)
			])
		);
		expect(notesNumbersFromMeta(twelvePlus)).toEqual(
			Array.from({ length: 12 }, (_, i) => i + 1)
		);
	});
});
