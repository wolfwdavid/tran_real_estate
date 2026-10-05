import { describe, expect, it } from 'vitest';
import {
	LOW_CONFIDENCE_COMPS,
	MAX_COMPS_SHOWN,
	SAME_THRESHOLD,
	SMALL_SAMPLE,
	compareToMedian,
	compareToRange,
	displayComparables,
	estimateConfidence,
	pickBedroomBucket,
	rangeBarScale,
	sampleCaveat
} from './fair-rent';

describe('constants', () => {
	it('pins the UI-SPEC thresholds', () => {
		expect(SAME_THRESHOLD).toBe(0.02);
		expect(SMALL_SAMPLE).toBe(10);
		expect(LOW_CONFIDENCE_COMPS).toBe(3);
		expect(MAX_COMPS_SHOWN).toBe(10);
	});
});

describe('pickBedroomBucket', () => {
	const buckets = [{ bedrooms: 1 }, { bedrooms: 2 }, { bedrooms: 3 }];

	it('returns the exact bucket when present', () => {
		expect(pickBedroomBucket(buckets, 2)).toEqual({ bucket: { bedrooms: 2 }, exact: true });
	});

	it('falls back to the highest bucket (labelled not exact) when bedrooms exceed every bucket', () => {
		expect(pickBedroomBucket(buckets, 5)).toEqual({ bucket: { bedrooms: 3 }, exact: false });
	});

	it('returns null for no buckets', () => {
		expect(pickBedroomBucket([], 2)).toBeNull();
		expect(pickBedroomBucket(null, 2)).toBeNull();
		expect(pickBedroomBucket(undefined, 2)).toBeNull();
	});

	it('returns null when the listing has no bedroom count', () => {
		expect(pickBedroomBucket(buckets, null)).toBeNull();
	});

	it('reports a missing middle bucket as null instead of guessing', () => {
		expect(pickBedroomBucket([{ bedrooms: 1 }, { bedrooms: 3 }], 2)).toBeNull();
	});

	it('handles studios (0 bedrooms) as an exact bucket', () => {
		expect(pickBedroomBucket([{ bedrooms: 0 }, { bedrooms: 1 }], 0)).toEqual({
			bucket: { bedrooms: 0 },
			exact: true
		});
	});

	it('keeps the full bucket object (generic passthrough)', () => {
		const rich = [{ bedrooms: 2, medianRent: 2000, totalListings: 12 }];
		expect(pickBedroomBucket(rich, 2)?.bucket).toBe(rich[0]);
	});
});

describe('compareToMedian', () => {
	it('above', () => {
		expect(compareToMedian(2150, 2000)).toEqual({ direction: 'above', percent: 8 });
	});

	it('below', () => {
		expect(compareToMedian(1900, 2000)).toEqual({ direction: 'below', percent: 5 });
	});

	it('1.5% (2030 vs 2000) is under 2% so reads the same, though percent rounds to 2', () => {
		expect(compareToMedian(2030, 2000)).toEqual({ direction: 'same', percent: 2 });
	});

	it('exactly 2% (2040 vs 2000) is not "same"', () => {
		expect(compareToMedian(2040, 2000)).toEqual({ direction: 'above', percent: 2 });
		expect(compareToMedian(1960, 2000)).toEqual({ direction: 'below', percent: 2 });
	});

	it('equal rent is the same at 0%', () => {
		expect(compareToMedian(2000, 2000)).toEqual({ direction: 'same', percent: 0 });
	});

	it('returns null for a zero, null, undefined or non-finite median', () => {
		expect(compareToMedian(2000, 0)).toBeNull();
		expect(compareToMedian(2000, null)).toBeNull();
		expect(compareToMedian(2000, undefined)).toBeNull();
		expect(compareToMedian(2000, Number.NaN)).toBeNull();
		expect(compareToMedian(Number.NaN, 2000)).toBeNull();
	});
});

describe('sampleCaveat', () => {
	it('flags fewer than 10 listings as small', () => {
		expect(sampleCaveat(9)).toBe('small');
		expect(sampleCaveat(0)).toBe('small');
	});

	it('10 or more listings carry no caveat', () => {
		expect(sampleCaveat(10)).toBeNull();
		expect(sampleCaveat(250)).toBeNull();
	});

	it('an unknown count is treated as small', () => {
		expect(sampleCaveat(null)).toBe('small');
		expect(sampleCaveat(undefined)).toBe('small');
	});
});

describe('compareToRange', () => {
	it('within the range', () => {
		expect(compareToRange(2150, 1900, 2260)).toEqual({ position: 'within', delta: 0 });
	});

	it('above the range', () => {
		expect(compareToRange(2400, 1900, 2260)).toEqual({ position: 'above', delta: 140 });
	});

	it('below the range', () => {
		expect(compareToRange(1800, 1900, 2260)).toEqual({ position: 'below', delta: 100 });
	});

	it('range edges are inclusive', () => {
		expect(compareToRange(1900, 1900, 2260)).toEqual({ position: 'within', delta: 0 });
		expect(compareToRange(2260, 1900, 2260)).toEqual({ position: 'within', delta: 0 });
	});
});

describe('estimateConfidence', () => {
	it('fewer than 3 comparables is low', () => {
		expect(estimateConfidence(2)).toBe('low');
		expect(estimateConfidence(0)).toBe('low');
	});

	it('3 or more is ok', () => {
		expect(estimateConfidence(3)).toBe('ok');
		expect(estimateConfidence(12)).toBe('ok');
	});
});

describe('displayComparables', () => {
	const subject = { id: 'A', formattedAddress: '1 X St' };

	it('excludes the subject by id and reports subjectIncluded', () => {
		const comps = [
			{ id: 'A', formattedAddress: 'Somewhere else', distance: 0 },
			{ id: 'B', formattedAddress: '2 Y St', distance: 0.4 }
		];
		const out = displayComparables(comps, subject);
		expect(out.rows.map((r) => r.id)).toEqual(['B']);
		expect(out.subjectIncluded).toBe(true);
	});

	it('excludes the subject by address, case- and whitespace-insensitive', () => {
		const comps = [
			{ id: 'Z', formattedAddress: '  1   x st ', distance: 0 },
			{ id: 'B', formattedAddress: '2 Y St', distance: 0.4 }
		];
		const out = displayComparables(comps, subject);
		expect(out.rows.map((r) => r.id)).toEqual(['B']);
		expect(out.subjectIncluded).toBe(true);
	});

	it('reports subjectIncluded false when the subject is absent', () => {
		const out = displayComparables([{ id: 'B', formattedAddress: '2 Y St', distance: 1 }], subject);
		expect(out.subjectIncluded).toBe(false);
		expect(out.rows).toHaveLength(1);
	});

	it('does not treat missing ids/addresses as a match', () => {
		const out = displayComparables(
			[{ id: null, formattedAddress: null, distance: 1 }],
			{ id: null, formattedAddress: null }
		);
		expect(out.rows).toHaveLength(1);
		expect(out.subjectIncluded).toBe(false);
	});

	it('sorts by distance ascending with null distances last', () => {
		const comps = [
			{ id: 'C', distance: 2 },
			{ id: 'N', distance: null },
			{ id: 'B', distance: 0.5 },
			{ id: 'D', distance: 1 }
		];
		expect(displayComparables(comps, subject).rows.map((r) => r.id)).toEqual(['B', 'D', 'C', 'N']);
	});

	it('keeps at most 10 rows (the 10 nearest)', () => {
		const comps = Array.from({ length: 14 }, (_, i) => ({ id: `c${i}`, distance: 14 - i }));
		const rows = displayComparables(comps, subject).rows;
		expect(rows).toHaveLength(10);
		expect(rows[0]!.distance).toBe(1);
		expect(rows[9]!.distance).toBe(10);
	});

	it('handles null/undefined comps and does not mutate the input', () => {
		expect(displayComparables(null, subject)).toEqual({ rows: [], subjectIncluded: false });
		expect(displayComparables(undefined, subject)).toEqual({ rows: [], subjectIncluded: false });
		const comps = [
			{ id: 'C', distance: 2 },
			{ id: 'B', distance: 1 }
		];
		displayComparables(comps, subject);
		expect(comps.map((c) => c.id)).toEqual(['C', 'B']);
	});
});

describe('rangeBarScale', () => {
	it('pads the scale 5% on each side of min(low, asking) and max(high, asking)', () => {
		const s = rangeBarScale(1900, 2260, 2400);
		expect(s.min).toBeCloseTo(1900 * 0.95, 9);
		expect(s.max).toBeCloseTo(2400 * 1.05, 9);
		expect(s.pos(s.min)).toBe(0);
		expect(s.pos(s.max)).toBe(1);
	});

	it('uses the asking rent as the lower end when it is below the range', () => {
		const s = rangeBarScale(1900, 2260, 1500);
		expect(s.min).toBeCloseTo(1500 * 0.95, 9);
		expect(s.max).toBeCloseTo(2260 * 1.05, 9);
	});

	it('clamps positions to [0, 1]', () => {
		const s = rangeBarScale(1900, 2260, 2100);
		expect(s.pos(0)).toBe(0);
		expect(s.pos(1_000_000)).toBe(1);
		const mid = s.pos(2100);
		expect(mid).toBeGreaterThan(0);
		expect(mid).toBeLessThan(1);
	});

	it('does not divide by zero when every value is equal', () => {
		const s = rangeBarScale(0, 0, 0);
		expect(Number.isFinite(s.pos(0))).toBe(true);
	});
});
