import { describe, expect, test } from 'vitest';

import { countNewSince } from '../alerts/diff.js';
import { filteredNewIds, type SnapshotItemLike } from './new-since.js';
import { DEFAULT_FILTERS, type RentalFilters, type RentalRowLike } from './types.js';

const NOW = new Date('2026-10-15T12:00:00Z');
const f = (o: Partial<RentalFilters>): RentalFilters => ({ ...DEFAULT_FILTERS, ...o });

function item(o: Partial<SnapshotItemLike> = {}): SnapshotItemLike {
	return { price: 1800, status: 'Active', removedDate: null, firstSeenAt: 2000, ...o };
}

function row(id: string, o: Partial<RentalRowLike> = {}): RentalRowLike {
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
		...o
	};
}

const rowsOf = (...rows: RentalRowLike[]) => new Map(rows.map((r) => [r.id, r]));
const sorted = (s: Set<string>) => [...s].sort();

describe('filteredNewIds', () => {
	test('lastSeenAt null (first visit) shows nothing as new', () => {
		const items = { a: item(), b: item() };
		expect(filteredNewIds(items, null, rowsOf(row('a'), row('b')), DEFAULT_FILTERS, NOW).size).toBe(
			0
		);
	});

	test('only items first seen strictly after lastSeenAt count', () => {
		const items = {
			before: item({ firstSeenAt: 999 }),
			equal: item({ firstSeenAt: 1000 }),
			after: item({ firstSeenAt: 1001 })
		};
		const rows = rowsOf(row('before'), row('equal'), row('after'));
		expect(sorted(filteredNewIds(items, 1000, rows, DEFAULT_FILTERS, NOW))).toEqual(['after']);
	});

	test('a new item whose cached row no longer matches the saved filters is not counted', () => {
		const items = { cheap: item(), pricey: item(), condo: item(), old: item() };
		const rows = rowsOf(
			row('cheap', { price: 1400 }),
			row('pricey', { price: 3000 }),
			row('condo', { price: 1400, propertyType: 'Condo' }),
			row('old', { price: 1400, listedDate: '2026-08-01T00:00:00Z' })
		);
		const filters = f({ priceMax: 2000, types: ['Apartment'], listedWithin: 30 });
		expect(sorted(filteredNewIds(items, 1000, rows, filters, NOW))).toEqual(['cheap']);
	});

	test('a missing row is included only if its snapshot price satisfies the price bounds', () => {
		const items = {
			inBounds: item({ price: 1800 }),
			tooHigh: item({ price: 2600 }),
			tooLow: item({ price: 900 }),
			noPrice: item({ price: null })
		};
		const bounded = f({ priceMin: 1000, priceMax: 2500, beds: 2 });
		expect(sorted(filteredNewIds(items, 1000, new Map(), bounded, NOW))).toEqual(['inBounds']);
		// Bounds are inclusive; a null price fails any single bound.
		const edges = {
			atMin: item({ price: 1000 }),
			atMax: item({ price: 2500 }),
			noPrice: item({ price: null })
		};
		expect(sorted(filteredNewIds(edges, 1000, new Map(), bounded, NOW))).toEqual([
			'atMax',
			'atMin'
		]);
		expect(filteredNewIds(edges, 1000, new Map(), f({ priceMax: 3000 }), NOW).has('noPrice')).toBe(
			false
		);
		expect(filteredNewIds(edges, 1000, new Map(), f({ priceMin: 0 }), NOW).has('noPrice')).toBe(
			false
		);
		// With no price bounds every missing on-market row counts, a null price included.
		expect(sorted(filteredNewIds(items, 1000, new Map(), DEFAULT_FILTERS, NOW))).toEqual([
			'inBounds',
			'noPrice',
			'tooHigh',
			'tooLow'
		]);
	});

	test('removed or non-Active snapshot items are never new, even with a matching row', () => {
		const items = {
			removed: item({ removedDate: '2026-10-14' }),
			inactive: item({ status: 'Inactive' }),
			unknown: item({ status: null }),
			ok: item()
		};
		const rows = rowsOf(row('removed'), row('inactive'), row('unknown'), row('ok'));
		expect(sorted(filteredNewIds(items, 1000, rows, DEFAULT_FILTERS, NOW))).toEqual(['ok']);
		expect(sorted(filteredNewIds(items, 1000, new Map(), DEFAULT_FILTERS, NOW))).toEqual(['ok']);
	});

	test('with default filters and every row cached it agrees with alerts countNewSince for Active items', () => {
		const items = {
			a: item({ firstSeenAt: 500 }),
			b: item({ firstSeenAt: 1500 }),
			c: item({ firstSeenAt: 2500 }),
			d: item({ firstSeenAt: 2500, removedDate: '2026-10-01' })
		};
		const rows = rowsOf(row('a'), row('b'), row('c'), row('d'));
		const ids = filteredNewIds(items, 1000, rows, DEFAULT_FILTERS, NOW);
		expect(ids.size).toBe(countNewSince({ takenAt: 3000, truncated: false, items }, 1000));
		expect(sorted(ids)).toEqual(['b', 'c']);
	});

	test('inherited object keys are ignored', () => {
		const items = Object.create({ inherited: item() }) as Record<string, SnapshotItemLike>;
		items.own = item();
		expect(sorted(filteredNewIds(items, 1000, new Map(), DEFAULT_FILTERS, NOW))).toEqual(['own']);
	});
});
