import { describe, expect, test } from 'vitest';

import { DEFAULT_SORT, SORT_OPTIONS, sortRentals, type SortId } from './sort.js';
import type { RentalRowLike } from './types.js';

function row(id: string, overrides: Partial<RentalRowLike> = {}): RentalRowLike {
	return {
		id,
		price: 1800,
		bedrooms: 2,
		bathrooms: 1,
		squareFootage: 900,
		propertyType: 'Apartment',
		listedDate: '2026-10-10T00:00:00.000Z',
		lastSeenDate: '2026-10-14T00:00:00.000Z',
		daysOnMarket: 5,
		status: 'Active',
		removedDate: null,
		...overrides
	};
}

const ids = (rows: readonly RentalRowLike[]) => rows.map((r) => r.id);

describe('SORT_OPTIONS', () => {
	test('ids and labels match the UI-SPEC verbatim, newest first', () => {
		expect(SORT_OPTIONS).toEqual([
			{ id: 'newest', label: 'Newest listed' },
			{ id: 'rent-asc', label: 'Rent: low to high' },
			{ id: 'rent-desc', label: 'Rent: high to low' },
			{ id: 'beds', label: 'Most bedrooms' },
			{ id: 'size', label: 'Largest' },
			{ id: 'dom', label: 'Fewest days on market' }
		]);
		expect(DEFAULT_SORT).toBe('newest');
	});
});

describe('sortRentals', () => {
	test('newest: listedDate descending, unparseable and null dates last', () => {
		const rows = [
			row('a', { listedDate: '2026-10-01T00:00:00Z' }),
			row('b', { listedDate: null }),
			row('c', { listedDate: '2026-10-12T00:00:00Z' }),
			row('d', { listedDate: 'not a date' }),
			row('e', { listedDate: '2026-10-05' })
		];
		expect(ids(sortRentals(rows, 'newest'))).toEqual(['c', 'e', 'a', 'b', 'd']);
	});

	test('rent-asc and rent-desc order by price with nulls last in both directions', () => {
		const rows = [
			row('a', { price: 2000 }),
			row('b', { price: null }),
			row('c', { price: 1500 }),
			row('d', { price: 2500 })
		];
		expect(ids(sortRentals(rows, 'rent-asc'))).toEqual(['c', 'a', 'd', 'b']);
		expect(ids(sortRentals(rows, 'rent-desc'))).toEqual(['d', 'a', 'c', 'b']);
	});

	test('beds descending, size descending, dom ascending; nulls last', () => {
		const rows = [
			row('a', { bedrooms: 1, squareFootage: 700, daysOnMarket: 10 }),
			row('b', { bedrooms: null, squareFootage: null, daysOnMarket: null }),
			row('c', { bedrooms: 3, squareFootage: 1400, daysOnMarket: 2 }),
			row('d', { bedrooms: 0, squareFootage: 450, daysOnMarket: 0 })
		];
		expect(ids(sortRentals(rows, 'beds'))).toEqual(['c', 'a', 'd', 'b']);
		expect(ids(sortRentals(rows, 'size'))).toEqual(['c', 'a', 'd', 'b']);
		expect(ids(sortRentals(rows, 'dom'))).toEqual(['d', 'c', 'a', 'b']);
	});

	test('non-finite numbers sort with the nulls', () => {
		const rows = [row('a', { price: Number.NaN }), row('b', { price: 900 })];
		expect(ids(sortRentals(rows, 'rent-asc'))).toEqual(['b', 'a']);
		expect(ids(sortRentals(rows, 'rent-desc'))).toEqual(['b', 'a']);
	});

	test('equal keys (including two nulls) tie-break by id ascending regardless of input order', () => {
		const sorts: SortId[] = ['newest', 'rent-asc', 'rent-desc', 'beds', 'size', 'dom'];
		const tied = [row('z'), row('m'), row('a', {}), row('k')];
		const nulls = [
			row('y', {
				price: null,
				bedrooms: null,
				squareFootage: null,
				daysOnMarket: null,
				listedDate: null
			}),
			row('b', {
				price: null,
				bedrooms: null,
				squareFootage: null,
				daysOnMarket: null,
				listedDate: null
			})
		];
		for (const s of sorts) {
			expect(ids(sortRentals(tied, s))).toEqual(['a', 'k', 'm', 'z']);
			expect(ids(sortRentals([...tied].reverse(), s))).toEqual(['a', 'k', 'm', 'z']);
			expect(ids(sortRentals([...nulls, row('c')], s))).toEqual(['c', 'b', 'y']);
		}
	});

	test('a tie on the key keeps id order within the group, not input order', () => {
		const rows = [
			row('d', { price: 1000 }),
			row('b', { price: 2000 }),
			row('c', { price: 1000 }),
			row('a', { price: 2000 })
		];
		expect(ids(sortRentals(rows, 'rent-asc'))).toEqual(['c', 'd', 'a', 'b']);
		expect(ids(sortRentals(rows, 'rent-desc'))).toEqual(['a', 'b', 'c', 'd']);
	});

	test('does not mutate the input and returns a new array of the same rows', () => {
		const rows = Object.freeze([row('b', { price: 2 }), row('a', { price: 1 })]);
		const out = sortRentals(rows, 'rent-asc');
		expect(out).not.toBe(rows);
		expect(ids(rows)).toEqual(['b', 'a']);
		expect(out[0]).toBe(rows[1]);
	});

	test('preserves extra row fields through the generic', () => {
		const rows = [{ ...row('a'), formattedAddress: '1 Main St' }];
		expect(sortRentals(rows, 'newest')[0]?.formattedAddress).toBe('1 Main St');
	});
});
