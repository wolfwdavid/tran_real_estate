// The built-in sample Market Snapshot (`?id=sample`, UI-SPEC Planner Note 5). Synthetic data only:
// the fictional sample-metro ZIP 74201 (Harlow Springs, OK, copied as literals from the Phase 4
// fixture metros), round made-up figures, the sample agent (Avery Sample / Sample Realty) and the
// keyless sample notes. No lib/data import, so the sample report renders with zero RentCast calls
// in every mode. Never stored: addSnapshot refuses the non-uuid id 'sample'.
import type { MarketHistoryPoint, MarketSide, MarketStats } from '@tran/core/listings';
import { buildSnapshotMetrics, type AggregatedSample } from '@tran/core/studio';
import { sampleSnapshotNotes } from '$lib/ai/prompts/studio/snapshot.v1';
import { SAMPLE_AGENT_PROFILE } from '$lib/features/shared/agent-profile';
import { SNAPSHOT_SECTION_KEYS, type SnapshotRecord } from '$lib/storage/studio/types';
import { buildSnapshotRecord } from '../snapshot/build-record';

export const SAMPLE_SNAPSHOT_ID = 'sample';
export const SAMPLE_ZIP = '74201';
export const SAMPLE_PLACE_NAME = 'Harlow Springs, OK';
/** When the sample statistics are "as of" (provenance and the notes' asOf). */
export const SAMPLE_FETCHED_AT = '2026-10-01T12:00:00.000Z';

const point = (month: string, median: number, totalListings: number): MarketHistoryPoint => ({
	month,
	average: median,
	median,
	totalListings
});

const bedrooms = (medians: readonly number[], counts: readonly number[]) =>
	medians.map((median, bedrooms) => ({
		bedrooms,
		propertyType: null,
		average: median,
		median,
		min: null,
		max: null,
		totalListings: counts[bedrooms]
	}));

/** Current rental medians and listing counts by bedroom count (Studio .. 4+). */
const RENT_BY_BEDS = [1100, 1300, 1550, 1900, 2400] as const;
const RENT_BED_COUNTS = [10, 30, 45, 25, 10] as const;
/** The overall median the bedroom medians above belong to (the latest month). */
const RENT_NOW = 1615;

/**
 * A rental month with its bedroom breakdown, so the sample rent trend draws one line per bedroom
 * count (the Phase 7 chart reads history[month].dataByBedrooms). Each bedroom median moves by the
 * same dollars as the overall median that month.
 */
const rentPoint = (month: string, median: number, totalListings: number): MarketHistoryPoint => ({
	...point(month, median, totalListings),
	byBedrooms: bedrooms(
		RENT_BY_BEDS.map((m) => m - (RENT_NOW - median)),
		RENT_BED_COUNTS
	)
});

const RENTAL: MarketSide = {
	average: 1620,
	median: 1615,
	min: 900,
	max: 3200,
	averagePerSquareFoot: 1.4,
	averageDaysOnMarket: 24,
	medianDaysOnMarket: 21,
	newListings: 30,
	totalListings: 120,
	lastUpdatedDate: '2026-09-30',
	byBedrooms: bedrooms(RENT_BY_BEDS, RENT_BED_COUNTS),
	byPropertyType: [],
	history: [
		rentPoint('2024-10', 1500, 100),
		rentPoint('2024-11', 1505, 100),
		rentPoint('2024-12', 1510, 100),
		rentPoint('2025-01', 1515, 100),
		rentPoint('2025-02', 1520, 100),
		rentPoint('2025-03', 1525, 100),
		rentPoint('2025-04', 1530, 110),
		rentPoint('2025-05', 1535, 110),
		rentPoint('2025-06', 1540, 110),
		rentPoint('2025-07', 1545, 110),
		rentPoint('2025-08', 1550, 110),
		rentPoint('2025-09', 1555, 110),
		rentPoint('2025-10', 1560, 110),
		rentPoint('2025-11', 1565, 110),
		rentPoint('2025-12', 1570, 110),
		rentPoint('2026-01', 1575, 110),
		rentPoint('2026-02', 1580, 120),
		rentPoint('2026-03', 1585, 120),
		rentPoint('2026-04', 1590, 120),
		rentPoint('2026-05', 1595, 120),
		rentPoint('2026-06', 1600, 120),
		rentPoint('2026-07', 1605, 120),
		rentPoint('2026-08', 1610, 120),
		rentPoint('2026-09', 1615, 120)
	]
};

const SALE: MarketSide = {
	average: 325000,
	median: 323000,
	min: 150000,
	max: 650000,
	averagePerSquareFoot: 170,
	averageDaysOnMarket: 40,
	medianDaysOnMarket: 35,
	newListings: 20,
	totalListings: 90,
	lastUpdatedDate: '2026-09-30',
	byBedrooms: bedrooms([150000, 200000, 260000, 320000, 420000], [2, 8, 30, 35, 15]),
	byPropertyType: [],
	history: [
		point('2024-10', 300000, 80),
		point('2024-11', 301000, 80),
		point('2024-12', 302000, 80),
		point('2025-01', 303000, 80),
		point('2025-02', 304000, 80),
		point('2025-03', 305000, 80),
		point('2025-04', 306000, 85),
		point('2025-05', 307000, 85),
		point('2025-06', 308000, 85),
		point('2025-07', 309000, 85),
		point('2025-08', 310000, 85),
		point('2025-09', 311000, 85),
		point('2025-10', 312000, 85),
		point('2025-11', 313000, 85),
		point('2025-12', 314000, 85),
		point('2026-01', 315000, 85),
		point('2026-02', 316000, 90),
		point('2026-03', 317000, 90),
		point('2026-04', 318000, 90),
		point('2026-05', 319000, 90),
		point('2026-06', 320000, 90),
		point('2026-07', 321000, 90),
		point('2026-08', 322000, 90),
		point('2026-09', 323000, 90)
	]
};

/** Synthetic Phase 4 domain market statistics for the fictional sample ZIP. */
export const SAMPLE_MARKET_STATS: MarketStats = Object.freeze({
	zipCode: SAMPLE_ZIP,
	sale: SALE,
	rental: RENTAL
});

/** A hand-authored aggregate-only listings summary (no listings behind it at all). */
export const SAMPLE_LISTINGS_SUMMARY: AggregatedSample = Object.freeze({
	kind: 'sale',
	seenAt: SAMPLE_FETCHED_AT,
	total: 12,
	byBedroom: [
		{ beds: 2, count: 4, min: 265000, max: 310000, median: 290000, medianDom: 28 },
		{ beds: 3, count: 6, min: 300000, max: 360000, median: 330000, medianDom: 35 },
		{ beds: 4, count: 2, min: 380000, max: 420000, median: 400000, medianDom: null }
	]
}) as AggregatedSample;

const SAMPLE_METRICS = buildSnapshotMetrics(SAMPLE_MARKET_STATS);

/** The sample report the builder and the print route show for `?id=sample`. */
export const SAMPLE_SNAPSHOT_RECORD: SnapshotRecord = buildSnapshotRecord({
	id: 'sample',
	now: SAMPLE_FETCHED_AT,
	zip: SAMPLE_ZIP,
	placeName: SAMPLE_PLACE_NAME,
	stats: SAMPLE_MARKET_STATS,
	fetchedAt: SAMPLE_FETCHED_AT,
	source: 'sample',
	listings: { sample: SAMPLE_LISTINGS_SUMMARY, fetchedAt: SAMPLE_FETCHED_AT },
	narrative: {
		text: sampleSnapshotNotes({
			metrics: SAMPLE_METRICS,
			sample: SAMPLE_LISTINGS_SUMMARY,
			asOf: SAMPLE_FETCHED_AT
		}),
		artifactId: null,
		provider: null,
		model: null,
		sampleOutput: true
	},
	options: { eho: true, tranFooter: true, sections: [...SNAPSHOT_SECTION_KEYS] },
	profile: SAMPLE_AGENT_PROFILE,
	sample: true
});
