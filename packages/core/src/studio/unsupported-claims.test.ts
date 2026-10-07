import { describe, expect, test } from 'vitest';
import { LISTING_FEATURES, NEARBY_AMENITIES, type ListingFacts } from './listing-facts';
import { CHIP_CONCEPTS, FEATURE_VOCAB, findUnsupportedFeatures } from './unsupported-claims';

type Facts = Pick<ListingFacts, 'features' | 'nearby'> & { freeText: readonly string[] };
const none: Facts = { features: [], nearby: [], freeText: [] };
const facts = (patch: Partial<Facts>): Facts => ({ ...none, ...patch });

describe('vocabulary', () => {
	test('concept ids are unique and every term is lowercase ASCII', () => {
		const ids = FEATURE_VOCAB.map((c) => c.id);
		expect(new Set(ids).size).toBe(ids.length);
		for (const c of FEATURE_VOCAB) {
			expect(c.terms.length).toBeGreaterThan(0);
			for (const t of c.terms) expect(t).toMatch(/^[a-z][a-z -]*[a-z]$/);
		}
	});

	test('every feature chip and the Waterfront amenity map to existing concepts', () => {
		const ids = new Set(FEATURE_VOCAB.map((c) => c.id));
		for (const label of [...LISTING_FEATURES, 'Waterfront']) {
			const mapped = CHIP_CONCEPTS[label];
			expect(mapped, label).toBeDefined();
			expect(mapped.length, label).toBeGreaterThan(0);
			for (const id of mapped) expect(ids.has(id), `${label} -> ${id}`).toBe(true);
		}
	});

	test('only chip labels are CHIP_CONCEPTS keys', () => {
		const labels: readonly string[] = [...LISTING_FEATURES, ...NEARBY_AMENITIES];
		for (const key of Object.keys(CHIP_CONCEPTS)) expect(labels).toContain(key);
	});

	test('memo-safe room names are not feature claims', () => {
		const terms = FEATURE_VOCAB.flatMap((c) => c.terms);
		expect(terms).not.toContain('family room');
		expect(terms).not.toContain('living room');
	});
});

describe('findUnsupportedFeatures', () => {
	test('an unselected fireplace is one hit with exact offsets', () => {
		const text = 'A cozy fireplace warms the living room.';
		const hits = findUnsupportedFeatures(text, none);
		expect(hits).toEqual([{ start: 7, end: 16, conceptId: 'fireplace', matched: 'fireplace' }]);
		expect(text.slice(hits[0].start, hits[0].end)).toBe('fireplace');
	});

	test('a selected chip supports the concept', () => {
		expect(
			findUnsupportedFeatures(
				'A cozy fireplace warms the living room.',
				facts({ features: ['Fireplace'] })
			)
		).toEqual([]);
	});

	test('typed free text supports the concept', () => {
		expect(
			findUnsupportedFeatures(
				'A cozy fireplace warms the living room.',
				facts({ freeText: ['wood-burning fireplace'] })
			)
		).toEqual([]);
	});

	test('free text supports a concept through any of its terms', () => {
		expect(
			findUnsupportedFeatures('Relax in the jacuzzi.', facts({ freeText: ['Hot tub on the deck'] }))
		).toEqual([]);
		expect(findUnsupportedFeatures('Relax in the jacuzzi.', none)).toEqual([
			{ start: 13, end: 20, conceptId: 'hot-tub', matched: 'jacuzzi' }
		]);
	});

	test('a supported chip leaves other invented features reported', () => {
		const text = 'Enjoy the pool and the granite counters.';
		const hits = findUnsupportedFeatures(text, facts({ features: ['Pool'] }));
		expect(hits).toEqual([{ start: 23, end: 30, conceptId: 'granite', matched: 'granite' }]);
	});

	test('walk-in closets with the chip and a family room are silent', () => {
		expect(
			findUnsupportedFeatures(
				'Walk-in closets and a family room.',
				facts({ features: ['Walk-in closets'] })
			)
		).toEqual([]);
	});

	test('walk-in closets without the chip are reported once', () => {
		const hits = findUnsupportedFeatures('Walk-in closets and a family room.', none);
		expect(hits).toEqual([
			{ start: 0, end: 15, conceptId: 'walk-in-closet', matched: 'Walk-in closets' }
		]);
	});

	test('the Waterfront amenity covers waterfront and views', () => {
		expect(
			findUnsupportedFeatures('Steps from the waterfront.', facts({ nearby: ['Waterfront'] }))
		).toEqual([]);
		expect(
			findUnsupportedFeatures('Water views from the waterfront.', facts({ nearby: ['Waterfront'] }))
		).toEqual([]);
	});

	test('the private outdoor space chip covers yard, patio, deck, balcony and porch', () => {
		const f = facts({ features: ['Private outdoor space'] });
		expect(findUnsupportedFeatures('Private patio', f)).toEqual([]);
		expect(
			findUnsupportedFeatures('A fenced yard, a deck, a balcony and a front porch.', f)
		).toEqual([]);
	});

	test('poolside counts as the pool concept through its explicit term', () => {
		expect(findUnsupportedFeatures('Poolside lounging.', none)).toEqual([
			{ start: 0, end: 8, conceptId: 'pool', matched: 'Poolside' }
		]);
	});

	test('word boundaries: deckhand, garden and spacious are not hits', () => {
		expect(
			findUnsupportedFeatures('The deckhand tends the garden in a spacious setting.', none)
		).toEqual([]);
	});

	test('the longest term wins and overlapping terms of one concept give one hit', () => {
		const hits = findUnsupportedFeatures('A finished basement and a swimming pool.', none);
		expect(hits).toEqual([
			{ start: 2, end: 19, conceptId: 'basement', matched: 'finished basement' },
			{ start: 26, end: 39, conceptId: 'pool', matched: 'swimming pool' }
		]);
	});

	test('matching is case-insensitive and tolerates extra whitespace inside a term', () => {
		const hits = findUnsupportedFeatures('STAINLESS  STEEL appliances.', none);
		expect(hits).toEqual([
			{ start: 0, end: 16, conceptId: 'stainless', matched: 'STAINLESS  STEEL' }
		]);
	});

	test('hits are sorted by start across concepts', () => {
		const hits = findUnsupportedFeatures('Granite, a fireplace, and a pool. More granite.', none);
		expect(hits.map((h) => [h.conceptId, h.start])).toEqual([
			['granite', 0],
			['fireplace', 11],
			['pool', 28],
			['granite', 39]
		]);
	});

	test('a garage chip also covers parking terms', () => {
		expect(
			findUnsupportedFeatures('Attached garage plus a driveway.', facts({ features: ['Garage'] }))
		).toEqual([]);
	});

	test('letters from other scripts count as word characters', () => {
		const e = String.fromCharCode(0xe9);
		expect(findUnsupportedFeatures(`Caf${e}pool and pool${e}`, none)).toEqual([]);
	});

	test('empty text gives no hits', () => {
		expect(findUnsupportedFeatures('', none)).toEqual([]);
	});
});
