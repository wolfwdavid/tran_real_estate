import { describe, expect, test } from 'vitest';

import {
	buildSnapshot,
	countNewSince,
	diffSnapshots,
	type ObservedItem,
	type SnapshotLike
} from './diff.js';

const T1 = 1_760_000_000_000;
const T2 = T1 + 86_400_000;
const T3 = T2 + 86_400_000;

const obs = (
	id: string,
	price: number | null,
	extra: Partial<Omit<ObservedItem, 'id' | 'price'>> = {}
): ObservedItem => ({ id, price, status: 'Active', removedDate: null, ...extra });

const snap = (
	prices: Record<string, number | null>,
	opts: { takenAt?: number; truncated?: boolean } = {}
): SnapshotLike => ({
	takenAt: opts.takenAt ?? T1,
	truncated: opts.truncated ?? false,
	items: Object.fromEntries(
		Object.entries(prices).map(([id, price]) => [
			id,
			{ price, status: 'Active', removedDate: null, firstSeenAt: opts.takenAt ?? T1 }
		])
	)
});

describe('buildSnapshot', () => {
	test('stamps firstSeenAt = takenAt on the first snapshot', () => {
		const s = buildSnapshot(null, [obs('a', 1000)], { takenAt: T1, truncated: false });
		expect(s.takenAt).toBe(T1);
		expect(s.truncated).toBe(false);
		expect(s.items.a).toEqual({ price: 1000, status: 'Active', removedDate: null, firstSeenAt: T1 });
	});

	test('carries firstSeenAt over for kept items and stamps new ones', () => {
		const prev = buildSnapshot(null, [obs('a', 1000)], { takenAt: T1, truncated: false });
		const next = buildSnapshot(prev, [obs('a', 1100), obs('b', 1500)], {
			takenAt: T2,
			truncated: true
		});
		expect(next.items.a?.firstSeenAt).toBe(T1);
		expect(next.items.a?.price).toBe(1100);
		expect(next.items.b?.firstSeenAt).toBe(T2);
		expect(next.truncated).toBe(true);
	});
});

describe('diffSnapshots', () => {
	test('the first run is a baseline, never a flood of "new"', () => {
		expect(diffSnapshots(null, snap({ a: 1000, b: 2000 }))).toEqual({
			new: [],
			priceChanged: [],
			gone: [],
			unknown: []
		});
	});

	test('reports new, price-changed and gone on a complete snapshot', () => {
		const prev = snap({ a: 1000, b: 1500, c: 900 });
		const next = snap({ a: 1000, b: 1600, d: 1200 }, { takenAt: T2 });
		expect(diffSnapshots(prev, next)).toEqual({
			new: ['d'],
			priceChanged: [{ id: 'b', from: 1500, to: 1600 }],
			gone: ['c'],
			unknown: []
		});
	});

	test('a truncated snapshot reports missing ids as unknown, never gone', () => {
		const prev = snap({ a: 1000, b: 1500, c: 900 });
		const next = snap({ a: 1000, b: 1600, d: 1200 }, { takenAt: T2, truncated: true });
		expect(diffSnapshots(prev, next)).toEqual({
			new: ['d'],
			priceChanged: [{ id: 'b', from: 1500, to: 1600 }],
			gone: [],
			unknown: ['c']
		});
	});

	test("an item present with status 'Inactive' is gone even when truncated, not price-changed", () => {
		const prev = snap({ a: 1000, b: 1500 });
		const next = buildSnapshot(prev, [obs('a', 1000), obs('b', 1400, { status: 'Inactive' })], {
			takenAt: T2,
			truncated: true
		});
		const d = diffSnapshots(prev, next);
		expect(d.gone).toEqual(['b']);
		expect(d.priceChanged).toEqual([]);
		expect(d.unknown).toEqual([]);
	});

	test('an item present with a removedDate is gone even when truncated, not price-changed', () => {
		const prev = snap({ a: 1000, b: 1500 });
		const next = buildSnapshot(
			prev,
			[obs('a', 1000), obs('b', 1450, { removedDate: '2026-10-01T00:00:00.000Z' })],
			{ takenAt: T2, truncated: true }
		);
		const d = diffSnapshots(prev, next);
		expect(d.gone).toEqual(['b']);
		expect(d.priceChanged).toEqual([]);
	});

	test('output id arrays are sorted ascending', () => {
		const prev = snap({ z: 1, m: 1, q: 1, y: 5, x: 5 });
		const next = snap({ y: 6, x: 7, c: 1, b: 1, a: 1 }, { takenAt: T2 });
		const d = diffSnapshots(prev, next);
		expect(d.new).toEqual(['a', 'b', 'c']);
		expect(d.gone).toEqual(['m', 'q', 'z']);
		expect(d.priceChanged.map((p) => p.id)).toEqual(['x', 'y']);

		const truncated = diffSnapshots(prev, { ...next, truncated: true });
		expect(truncated.unknown).toEqual(['m', 'q', 'z']);
	});
});

describe('countNewSince', () => {
	const s: SnapshotLike = {
		takenAt: T2,
		truncated: false,
		items: {
			a: { price: 1, status: 'Active', removedDate: null, firstSeenAt: T1 },
			b: { price: 1, status: 'Active', removedDate: null, firstSeenAt: T2 },
			c: { price: 1, status: 'Active', removedDate: null, firstSeenAt: T2 }
		}
	};

	test('is 0 when the user never opened the results', () => {
		expect(countNewSince(s, null)).toBe(0);
	});

	test('counts items first seen strictly after lastSeenAt', () => {
		expect(countNewSince(s, T1)).toBe(2);
		expect(countNewSince(s, T3)).toBe(0);
	});

	test('is 0 without a snapshot', () => {
		expect(countNewSince(null, T1)).toBe(0);
	});
});
