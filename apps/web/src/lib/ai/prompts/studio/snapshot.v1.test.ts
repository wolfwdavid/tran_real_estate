import { describe, expect, it } from 'vitest';
import { checkFairHousing } from '@tran/core/fair-housing';
import {
	factsForPrompt,
	snapshotAllowedNumbers,
	snapshotFactLines,
	type AggregatedSample,
	type SnapshotMetrics
} from '@tran/core/studio';
import { runChecks } from '$lib/ai/ui/panel-controller';
import { numberPostCheck, numberWordsPostCheck } from '$lib/features/studio/post-checks';
import { HOUSING_COPY_GUARDRAIL } from '../guardrail.js';
import { buildPrompt, getPrompt } from '../registry.js';
import {
	STUDIO_SNAPSHOT_PROMPT_ID,
	STUDIO_SNAPSHOT_SYSTEM,
	renderSnapshotUser,
	sampleSnapshotNotes,
	studioSnapshotV1,
	type SnapshotNotesInputs
} from './snapshot.v1.js';

// Fictional ZIP 00199; every value is made up.
const AS_OF = '2026-10-07T12:00:00.000Z';

const FULL: SnapshotMetrics = {
	zip: '00199',
	lastUpdated: '2026-02-28',
	medianRent: 1850,
	medianPrice: 333000,
	priceToRent: 15,
	rentChangePct: 2.8,
	rentChangeFrom: '2025-03',
	rentChangeTo: '2026-02',
	months: 12,
	saleDom: 41,
	rentalDom: 21,
	saleTotal: 120,
	saleNew: 18,
	rentalTotal: 64,
	rentalNew: 22,
	rentByBedroom: [
		{ beds: 1, median: 1500, listings: 20 },
		{ beds: 2, median: 1850, listings: 30 },
		{ beds: 4, median: 2900, listings: 4 }
	]
};

const NO_RENTAL: SnapshotMetrics = {
	...FULL,
	medianRent: null,
	priceToRent: null,
	rentChangePct: null,
	rentChangeFrom: null,
	rentChangeTo: null,
	months: 0,
	rentalDom: null,
	rentalTotal: null,
	rentalNew: null,
	rentByBedroom: []
};

const SAMPLE: AggregatedSample = {
	kind: 'sale',
	seenAt: '2026-10-06T09:00:00.000Z',
	total: 14,
	byBedroom: [
		{ beds: 2, count: 5, min: 280000, max: 345000, median: 310000, medianDom: 30 },
		{ beds: 3, count: 9, min: 330000, max: 410000, median: 365000, medianDom: null }
	]
};

const FIXTURES: SnapshotNotesInputs[] = [
	{ metrics: FULL, sample: null, asOf: AS_OF },
	{ metrics: NO_RENTAL, sample: null, asOf: AS_OF },
	{ metrics: { ...FULL, rentChangePct: -1.4 }, sample: SAMPLE, asOf: AS_OF }
];

const checksFor = (i: SnapshotNotesInputs) => [
	numberPostCheck('snapshot', snapshotAllowedNumbers(i.metrics, i.sample, i.asOf)),
	numberWordsPostCheck()
];

describe('studio/snapshot.v1 prompt', () => {
	it('is registered with the studio id, no client data and the guardrail', async () => {
		const def = getPrompt('studio/snapshot.v1');
		expect(def).toBe(studioSnapshotV1);
		expect(def.id).toBe(STUDIO_SNAPSHOT_PROMPT_ID);
		expect(def.version).toBe(1);
		expect(def.housingCopy).toBe(true);
		expect(def.containsClientData).toBe(false);
		expect(def.maxTokens).toBeGreaterThanOrEqual(2048);
		const built = await buildPrompt('studio/snapshot.v1', FIXTURES[0]);
		expect(built.system).toBe(`${HOUSING_COPY_GUARDRAIL.text}\n\n${STUDIO_SNAPSHOT_SYSTEM}`);
		expect(built.promptId).toBe('studio/snapshot.v1@1');
		expect(built.fixtureText).toBe(sampleSnapshotNotes(FIXTURES[0]!));
	});

	it('system text requires copied numbers and forbids predictions and advice', () => {
		for (const line of [
			'Every number you write must be copied from <facts> exactly as written.',
			'Write 2-3 short paragraphs: what the numbers show for buyers, for sellers, for renters.',
			"No predictions, no advice, no 'good time to buy/sell'.",
			'Write numbers as digits.'
		]) {
			expect(STUDIO_SNAPSHOT_SYSTEM).toContain(line);
		}
	});

	it('sends only the factsForPrompt lines', () => {
		const i = FIXTURES[2]!;
		expect(renderSnapshotUser(i)).toBe(
			`<facts>\n${factsForPrompt(i.metrics, i.sample, i.asOf)}\n</facts>`
		);
	});
});

describe('studio/snapshot.v1 sample (keyless)', () => {
	it.each(FIXTURES.map((f, n) => [n, f] as const))(
		'fixture %i passes every check with zero findings',
		(_n, i) => {
			const text = sampleSnapshotNotes(i);
			expect(text.length).toBeGreaterThan(0);
			expect(checkFairHousing(text)).toEqual([]);
			for (const check of checksFor(i)) expect(check(text)).toEqual([]);
			expect(runChecks(text, checksFor(i))).toEqual([]);
		}
	);

	it('builds paragraphs from the figures present and skips the missing ones', () => {
		expect(sampleSnapshotNotes(FIXTURES[0]!)).toBe(
			[
				'For renters: median rent in ZIP 00199 is $1,850, and it changed +2.8% from Mar 2025 to Feb 2026. Rentals had a median of 21 days on market, with 64 active rentals and 22 new last month.',
				'For buyers: the median list price is $333,000 and the price-to-rent ratio is 15.0.',
				'For sellers: homes for sale had a median of 41 days on market, with 120 active listings and 18 new last month.'
			].join('\n\n')
		);
		const noRental = sampleSnapshotNotes(FIXTURES[1]!);
		expect(noRental).not.toContain('For renters');
		expect(noRental).not.toContain('price-to-rent');
		expect(noRental).toContain('For buyers: the median list price is $333,000.');
		expect(sampleSnapshotNotes(FIXTURES[2]!)).toContain(
			'The active listings summary in this report covers 14 homes for sale.'
		);
	});

	it("blocks a planted '$2,450' that is not a report figure", () => {
		const i = FIXTURES[0]!;
		const f = checksFor(i)[0]!('Median rent is $2,450.');
		expect(f).toHaveLength(1);
		expect(f[0]!.severity).toBe('block');
		expect(f[0]!.phrase).toBe('$2,450');
		expect(f[0]!.members[0]!.categoryLabel).toBe('Number not in this report');
	});

	it('every factsForPrompt line passes the number check when used as a sentence', () => {
		for (const i of FIXTURES) {
			const [numbers] = checksFor(i);
			for (const line of snapshotFactLines(i.metrics, i.sample, i.asOf)) {
				const text = `${line.label}: ${line.value}.`;
				expect({ text, findings: numbers!(text) }).toEqual({ text, findings: [] });
			}
		}
	});
});
