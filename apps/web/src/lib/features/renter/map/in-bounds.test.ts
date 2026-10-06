import { describe, expect, it } from 'vitest';
import { rowsInBounds, type MapBounds } from './in-bounds';

const B: MapBounds = { west: -97, south: 30, east: -96, north: 31 };

type Row = { id: string; latitude?: number | null; longitude?: number | null };
const row = (
	id: string,
	latitude: number | null | undefined,
	longitude: number | null | undefined
): Row => ({
	id,
	latitude,
	longitude
});
const ids = (rows: Row[]) => rows.map((r) => r.id);

describe('rowsInBounds', () => {
	it('keeps rows inside the box and preserves input order', () => {
		const rows = [row('c', 30.5, -96.5), row('a', 30.2, -96.9), row('b', 30.9, -96.1)];
		expect(ids(rowsInBounds(rows, B))).toEqual(['c', 'a', 'b']);
	});

	it('is inclusive on every edge and corner', () => {
		const rows = [
			row('south', 30, -96.5),
			row('north', 31, -96.5),
			row('west', 30.5, -97),
			row('east', 30.5, -96),
			row('sw', 30, -97),
			row('ne', 31, -96)
		];
		expect(ids(rowsInBounds(rows, B))).toEqual(['south', 'north', 'west', 'east', 'sw', 'ne']);
	});

	it('drops rows just outside each edge', () => {
		const e = 1e-9;
		const rows = [
			row('south', 30 - e, -96.5),
			row('north', 31 + e, -96.5),
			row('west', 30.5, -97 - e),
			row('east', 30.5, -96 + e)
		];
		expect(rowsInBounds(rows, B)).toEqual([]);
	});

	it('drops rows without usable coordinates', () => {
		const rows = [
			row('null-lat', null, -96.5),
			row('null-lng', 30.5, null),
			row('missing', undefined, undefined),
			row('nan', Number.NaN, -96.5),
			row('inf', 30.5, Number.POSITIVE_INFINITY),
			row('ok', 30.5, -96.5)
		];
		expect(ids(rowsInBounds(rows, B))).toEqual(['ok']);
	});

	it('never reads a missing coordinate as 0 when the view contains 0', () => {
		// null >= -1 is true in JavaScript (null coerces to 0): the finiteness guard must come first.
		const zero: MapBounds = { west: -1, south: -1, east: 1, north: 1 };
		const rows = [row('null-lat', null, 0.5), row('null-lng', 0.5, null), row('ok', 0.5, 0.5)];
		expect(ids(rowsInBounds(rows, zero))).toEqual(['ok']);
	});

	it('does not mistake latitude for longitude', () => {
		// lat/lng swapped: -96.5 is not a latitude in 30..31.
		expect(rowsInBounds([row('swapped', -96.5, 30.5)], B)).toEqual([]);
	});

	it('returns a new array and never mutates the input', () => {
		const rows = [row('a', 30.5, -96.5)];
		const out = rowsInBounds(rows, B);
		expect(out).not.toBe(rows);
		expect(out).toEqual(rows);
	});

	it('returns nothing for an empty input', () => {
		expect(rowsInBounds([], B)).toEqual([]);
	});
});
