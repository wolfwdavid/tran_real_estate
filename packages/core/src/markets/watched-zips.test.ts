import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { MAX_WATCHED_ZIPS, addWatchedZip, removeWatchedZip, validateZip } from './watched-zips.js';

describe('validateZip', () => {
	it('accepts a 5-digit ZIP and trims whitespace', () => {
		expect(validateZip('79999')).toEqual({ ok: true, zip: '79999' });
		expect(validateZip(' 79999 ')).toEqual({ ok: true, zip: '79999' });
	});

	it.each(['7999', '799999', 'abcde', '00000', '', '7999a', '79999-1234'])('rejects %j', (z) => {
		expect(validateZip(z)).toEqual({ ok: false, error: 'invalid' });
	});
});

describe('addWatchedZip', () => {
	it('adds a valid new ZIP without mutating the input', () => {
		const list = ['10001', '10002'];
		const r = addWatchedZip(list, ' 79999 ');
		expect(r).toEqual({ ok: true, list: ['10001', '10002', '79999'], zip: '79999' });
		expect(list).toEqual(['10001', '10002']);
	});

	it("rejects a duplicate with 'duplicate'", () => {
		expect(addWatchedZip(['10001', '79999'], '79999')).toEqual({
			ok: false,
			error: 'duplicate',
			zip: '79999'
		});
	});

	it("rejects a 6th ZIP with 'limit'", () => {
		expect(MAX_WATCHED_ZIPS).toBe(5);
		const five = ['10001', '10002', '10003', '10004', '10005'];
		expect(addWatchedZip(five, '79998')).toEqual({ ok: false, error: 'limit', zip: '79998' });
		// the 5th is still allowed
		expect(addWatchedZip(five.slice(0, 4), '79998').ok).toBe(true);
	});

	it("rejects invalid input with 'invalid'", () => {
		expect(addWatchedZip([], 'abc')).toEqual({ ok: false, error: 'invalid' });
		expect(addWatchedZip([], '00000')).toEqual({ ok: false, error: 'invalid' });
	});

	it('property: the list never exceeds 5 and never holds duplicates', () => {
		const zipArb = fc.integer({ min: 1, max: 99999 }).map((n) => String(n).padStart(5, '0'));
		fc.assert(
			fc.property(fc.array(zipArb, { maxLength: 30 }), (inputs) => {
				let list: string[] = [];
				for (const z of inputs) {
					const r = addWatchedZip(list, z);
					if (r.ok) list = r.list;
				}
				expect(list.length).toBeLessThanOrEqual(MAX_WATCHED_ZIPS);
				expect(new Set(list).size).toBe(list.length);
			})
		);
	});
});

describe('removeWatchedZip', () => {
	it('removes the ZIP and does not mutate the input', () => {
		const list = ['1', '2'];
		expect(removeWatchedZip(list, '1')).toEqual(['2']);
		expect(list).toEqual(['1', '2']);
		expect(removeWatchedZip(list, '3')).toEqual(['1', '2']);
	});
});
