import { describe, expect, it } from 'vitest';
import { NOT_AVAILABLE, longDate, monthYear, ratio, usd, usdRange } from '../format/index.js';
import type {
	MarketBreakdown,
	MarketHistoryPoint,
	MarketSide,
	MarketStats
} from '../listings/types.js';
import { checkNumbers } from '../numbers/index.js';
import {
	factsForPrompt,
	formatSignedPct,
	snapshotAllowedNumbers,
	snapshotFactLines,
	snapshotFigureValues
} from './snapshot-facts.js';
import {
	buildSnapshotMetrics,
	type AggregatedSample,
	type SnapshotMetrics
} from './snapshot-metrics.js';

// Fixture S, repeated here so this file stands alone. Fictional ZIP 00199; values are made up.

const bd = (bedrooms: number, median: number, totalListings: number): MarketBreakdown => ({
	bedrooms,
	propertyType: null,
	average: null,
	median,
	min: null,
	max: null,
	totalListings
});

const side = (over: Partial<MarketSide>): MarketSide => ({
	average: null,
	median: null,
	min: null,
	max: null,
	averagePerSquareFoot: null,
	averageDaysOnMarket: null,
	medianDaysOnMarket: null,
	newListings: null,
	totalListings: null,
	byBedrooms: [],
	byPropertyType: [],
	history: [],
	lastUpdatedDate: null,
	...over
});

function rentalHistory(): MarketHistoryPoint[] {
	const months = [
		'2025-09',
		'2026-02',
		'2025-03',
		'2025-12',
		'2025-05',
		'2025-04',
		'2026-01',
		'2025-07',
		'2025-06',
		'2025-11',
		'2025-08',
		'2025-10'
	];
	return months.map((month) => ({
		month,
		average: null,
		median: month === '2025-03' ? 1800 : month === '2026-02' ? 1850 : 1825,
		totalListings: 60
	}));
}

function fixtureS(): MarketStats {
	return {
		zipCode: '00199',
		sale: side({ median: 333000, medianDaysOnMarket: 41, totalListings: 120, newListings: 18 }),
		rental: side({
			median: 1850,
			medianDaysOnMarket: 23,
			totalListings: 64,
			newListings: 15,
			byBedrooms: [
				bd(0, 1250, 8),
				bd(1, 1500, 20),
				bd(2, 1850, 22),
				bd(3, 2300, 10),
				bd(4, 2900, 3),
				bd(5, 3400, 1)
			],
			history: rentalHistory()
		})
	};
}

const metricsS = (): SnapshotMetrics => buildSnapshotMetrics(fixtureS());
const AS_OF = '2026-03-05';

const SAMPLE: AggregatedSample = {
	kind: 'sale',
	seenAt: '2026-03-04',
	total: 7,
	byBedroom: [
		{ beds: 1, count: 1, min: 1250, max: 1250, median: 1250, medianDom: 5 },
		{ beds: 2, count: 3, min: 1700, max: 2000, median: 1850, medianDom: 17 },
		{ beds: 4, count: 3, min: 3000, max: 3600, median: 3300, medianDom: null }
	]
};

describe('formatSignedPct', () => {
	it('signs positives, uses a true minus for negatives and leaves zero unsigned', () => {
		expect(formatSignedPct(2.8)).toBe('+2.8%');
		expect(formatSignedPct(-1.4)).toBe('−1.4%');
		expect(formatSignedPct(-1.4)).toBe('−1.4%');
		expect(formatSignedPct(0)).toBe('0.0%');
		expect(formatSignedPct(0.04)).toBe('0.0%');
		expect(formatSignedPct(-0.04)).toBe('0.0%');
	});
});

describe('snapshotFigureValues', () => {
	it('formats every figure with the shared Phase 7 formatters', () => {
		const v = snapshotFigureValues(metricsS());
		expect(v.medianRent).toBe(usd(185000));
		expect(v.medianPrice).toBe(usd(33300000));
		expect(v.priceToRent).toBe(ratio(15, 1));
		expect(v.priceToRent).toBe('15.0');
		expect(v.rentChange).toBe('+2.8%');
		expect(v.saleDom).toBe('41');
		expect(v.rentalDom).toBe('23');
		expect(v.saleTotal).toBe('120');
		expect(v.saleNew).toBe('18');
		expect(v.rentalTotal).toBe('64');
		expect(v.rentalNew).toBe('15');
	});

	it('renders a missing figure as the em dash', () => {
		const s = fixtureS();
		s.rental = null;
		s.sale = null;
		const v = snapshotFigureValues(buildSnapshotMetrics(s));
		for (const value of Object.values(v)) expect(value).toBe(NOT_AVAILABLE);
	});

	it('groups thousands in counts', () => {
		const s = fixtureS();
		s.sale!.totalListings = 1234;
		expect(snapshotFigureValues(buildSnapshotMetrics(s)).saleTotal).toBe('1,234');
	});
});

describe('factsForPrompt', () => {
	it('lists every figure in the report formatting', () => {
		const lines = factsForPrompt(metricsS(), null, AS_OF).split('\n');
		const expected = [
			'ZIP: 00199',
			`Median rent: ${usd(185000)}`,
			`Median list price: ${usd(33300000)}`,
			'Price-to-rent ratio: 15.0',
			`Rent change from ${monthYear('2025-03')} to ${monthYear('2026-02')}: +2.8%`,
			'Median days on market, homes for sale: 41',
			'Median days on market, rentals: 23',
			'Active homes for sale: 120',
			'New homes for sale last month: 18',
			'Active rentals: 64',
			'New rentals last month: 15',
			`Median rent, studio: ${usd(125000)} (8 listings)`,
			`Median rent, 1 bedroom: ${usd(150000)} (20 listings)`,
			`Median rent, 2 bedrooms: ${usd(185000)} (22 listings)`,
			`Median rent, 3 bedrooms: ${usd(230000)} (10 listings)`,
			`Median rent, 4+ bedrooms: ${usd(290000)} (4 listings)`,
			`Data as of: ${longDate(Date.UTC(2026, 2, 5))}`
		];
		for (const e of expected) expect(lines).toContain(e);
		expect(lines).toContain('Rent change from Mar 2025 to Feb 2026: +2.8%');
		expect(lines).toContain('Median rent, 2 bedrooms: $1,850 (22 listings)');
		expect(lines).toContain('Data as of: Mar 5, 2026');
	});

	it('is built from snapshotFactLines as label: value', () => {
		const m = metricsS();
		expect(factsForPrompt(m, SAMPLE, AS_OF)).toBe(
			snapshotFactLines(m, SAMPLE, AS_OF)
				.map((l) => `${l.label}: ${l.value}`)
				.join('\n')
		);
	});

	it('omits missing figures instead of printing a dash or zero', () => {
		const s = fixtureS();
		s.rental = null;
		const text = factsForPrompt(buildSnapshotMetrics(s), null, AS_OF);
		expect(text).not.toContain(NOT_AVAILABLE);
		expect(text).not.toContain('Median rent');
		expect(text).not.toContain('Rent change');
		expect(text).not.toContain('Price-to-rent');
		expect(text).toContain(`Median list price: ${usd(33300000)}`);
	});

	it('adds the aggregated listings summary when present', () => {
		const lines = factsForPrompt(metricsS(), SAMPLE, AS_OF).split('\n');
		expect(lines).toContain('Active listings summary: 7 homes for sale');
		expect(lines).toContain(
			`Homes for sale, 2 bedrooms: 3 listings, ${usdRange(170000, 200000)}, median ${usd(185000)}, median days on market 17`
		);
		expect(lines).toContain(
			'Homes for sale, 2 bedrooms: 3 listings, $1,700 to $2,000, median $1,850, median days on market 17'
		);
		expect(lines).toContain(
			`Homes for sale, 1 bedroom: 1 listing, ${usd(125000)}, median ${usd(125000)}, median days on market 5`
		);
		expect(lines).toContain(
			`Homes for sale, 4+ bedrooms: 3 listings, ${usdRange(300000, 360000)}, median ${usd(330000)}`
		);
	});

	it('words a rentals summary as rentals', () => {
		const text = factsForPrompt(metricsS(), { ...SAMPLE, kind: 'rental', total: 1 }, AS_OF);
		expect(text).toContain('Active listings summary: 1 rental');
		expect(text).toContain('Rentals, 2 bedrooms: 3 listings');
	});
});

describe('snapshotAllowedNumbers', () => {
	it('contains every displayed figure and label number, and nothing else derived', () => {
		const allowed = snapshotAllowedNumbers(metricsS(), null, AS_OF);
		for (const n of [
			1850, 333000, 15, 2.8, 41, 23, 120, 18, 64, 15, 1250, 1500, 2300, 2900, 8, 20, 22, 10, 4, 0,
			1, 2, 3, 5, 12, 199, 2025, 2026
		]) {
			expect(allowed).toContain(n);
		}
		expect(allowed).not.toContain(1800); // history value, never displayed
		expect(allowed).not.toContain(2450);
		expect(allowed).not.toContain(3400); // collapsed into the 4+ row, never displayed
	});

	it('is de-duplicated, sorted and finite', () => {
		const allowed = snapshotAllowedNumbers(metricsS(), SAMPLE, AS_OF);
		expect(allowed).toEqual([...new Set(allowed)].sort((a, b) => a - b));
		for (const n of allowed) expect(Number.isFinite(n)).toBe(true);
	});

	it('adds every sample number when a listings summary is included', () => {
		const allowed = snapshotAllowedNumbers(metricsS(), SAMPLE, AS_OF);
		for (const n of [7, 1250, 1700, 2000, 1850, 17, 3000, 3600, 3300, 3])
			expect(allowed).toContain(n);
		expect(snapshotAllowedNumbers(metricsS(), null, AS_OF)).not.toContain(3300);
	});

	it('includes the signed and unsigned rent change', () => {
		const s = fixtureS();
		s.rental!.history = [
			{ month: '2025-03', average: null, median: 2000, totalListings: 1 },
			{ month: '2026-02', average: null, median: 1972, totalListings: 1 }
		];
		const allowed = snapshotAllowedNumbers(buildSnapshotMetrics(s), null, AS_OF);
		expect(allowed).toContain(-1.4);
		expect(allowed).toContain(1.4);
	});

	it('passes every figure copied verbatim from the facts through the number check', () => {
		for (const sample of [null, SAMPLE]) {
			const m = metricsS();
			const facts = factsForPrompt(m, sample, AS_OF);
			const allowed = snapshotAllowedNumbers(m, sample, AS_OF);
			const blocks = checkNumbers(facts, allowed).filter((f) => f.severity === 'block');
			expect(blocks).toEqual([]);
		}
	});

	it('flags a number the model derived itself', () => {
		const m = metricsS();
		const allowed = snapshotAllowedNumbers(m, null, AS_OF);
		const findings = checkNumbers('Rent rose $50 a month, to $2,450 for larger homes.', allowed);
		expect(findings.map((f) => f.text)).toEqual(['$50', '$2,450']);
	});
});
