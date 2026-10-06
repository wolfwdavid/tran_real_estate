// FairRentCheck in real Chromium with a counting fake runtime (06-17, RENT-06). Proves the spend
// contract at the component boundary: rendering reads with peek/estimateCost only (0 spends, even
// with nothing cached), Tier 1 is free when the ZIP's market stats are cached, and each tier's
// button shows "(1 call)" first and spends exactly one call only when clicked.
import { afterEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import type { Listing, MarketStats, RentEstimate } from '@tran/core/listings';
import { GatewayError, type DataRequest, type DataRuntime, type Provenance } from '$lib/data';
import { announce } from '$lib/components/a11y/announcer.svelte';
import { axeViolations } from '$lib/testing/axe';
import FairRentHarness from './testing/FairRentHarness.svelte';

vi.mock('$lib/components/a11y/announcer.svelte', { spy: true });

const LIVE: Provenance = { source: 'rentcast', fetchedAt: Date.now(), stale: false };

const ROW: Listing = {
	id: 'L-1',
	kind: 'rental',
	formattedAddress: '12 Fictional Ln, Harlow Springs, OK 74201',
	addressLine1: '12 Fictional Ln',
	addressLine2: null,
	city: 'Harlow Springs',
	state: 'OK',
	zipCode: '74201',
	latitude: null,
	longitude: null,
	propertyType: 'Condo',
	bedrooms: 2,
	bathrooms: 1,
	squareFootage: 900,
	yearBuilt: null,
	hoaFee: null,
	price: 2160,
	status: 'Active',
	listingType: null,
	listedDate: null,
	removedDate: null,
	lastSeenDate: null,
	daysOnMarket: null,
	mlsName: null,
	mlsNumber: null,
	agent: null,
	office: null,
	history: []
};

const MARKET: MarketStats = {
	zipCode: '74201',
	sale: null,
	rental: {
		average: null,
		median: 1900,
		min: null,
		max: null,
		averagePerSquareFoot: null,
		averageDaysOnMarket: null,
		newListings: null,
		totalListings: 100,
		byBedrooms: [
			{
				bedrooms: 2,
				propertyType: null,
				average: null,
				median: 2000,
				min: null,
				max: null,
				totalListings: 24
			}
		],
		byPropertyType: [],
		history: [],
		lastUpdatedDate: '2026-09-30T00:00:00.000Z'
	}
};

const comp = (i: number, distance: number) => ({
	id: `C-${i}`,
	formattedAddress: `${100 + i} Example St, Harlow Springs, OK 74201`,
	price: 2000,
	distance,
	daysOld: 2,
	correlation: 0.9,
	bedrooms: 2,
	bathrooms: 1,
	squareFootage: 880,
	propertyType: 'Condo' as const
});

const ESTIMATE: RentEstimate = {
	kind: 'rent',
	estimate: 2080,
	low: 1900,
	high: 2260,
	subjectAddress: ROW.formattedAddress,
	comparables: [comp(1, 0.4), comp(2, 0.2)]
};

type Answer = { data: unknown } | { error: GatewayError };

/** A live-mode runtime whose gateway serves `cached` for free and whose spends are recorded. */
function fakeRuntime(opts: {
	cached?: Partial<Record<DataRequest['endpoint'], unknown>>;
	answers: Partial<Record<DataRequest['endpoint'], Answer>>;
}) {
	const cache = new Map(Object.entries(opts.cached ?? {}));
	const spends: DataRequest[] = [];
	const result = (data: unknown) => ({
		data,
		provenance: LIVE,
		truncated: false,
		droppedRows: 0,
		requestKey: 'k'
	});
	const gateway = {
		peek: vi.fn(async (req: DataRequest) =>
			cache.has(req.endpoint)
				? { kind: 'data' as const, result: result(cache.get(req.endpoint)) }
				: undefined
		),
		estimateCost: vi.fn(async (req: DataRequest) =>
			cache.has(req.endpoint)
				? { calls: 0, reason: 'cached' as const }
				: { calls: 1, reason: 'network' as const }
		)
	};
	const runtime = {
		mode: { source: 'rentcast', reason: 'key' },
		gateway,
		requestSpend: vi.fn(async (req: DataRequest) => {
			spends.push(req);
			const answer = opts.answers[req.endpoint];
			if (!answer) throw new Error(`unexpected spend: ${req.endpoint}`);
			if ('error' in answer) throw answer.error;
			cache.set(req.endpoint, answer.data);
			return result(answer.data);
		})
	} as unknown as DataRuntime;
	return { runtime, spends, gateway };
}

/** Visible text with whitespace collapsed (markup line breaks are not part of the copy). */
const flat = (el: Element) => (el.textContent ?? '').replace(/\s+/g, ' ');

const mount = (runtime: DataRuntime) =>
	render(FairRentHarness, { props: { runtime, row: ROW, provenance: LIVE } });

afterEach(() => {
	vi.mocked(announce).mockClear();
});

describe('FairRentCheck spend contract', () => {
	test('cached ZIP stats render Tier 1 at 0 calls; Tier 2 shows "(1 call)" and spends 1 on click', async () => {
		const { runtime, spends } = fakeRuntime({
			cached: { markets: MARKET },
			answers: { 'rent-estimate': { data: ESTIMATE } }
		});
		const { container } = await mount(runtime);

		await expect.element(page.getByText('8% above', { exact: false })).toBeVisible();
		expect(flat(container)).toContain(
			'$2,160 is 8% above the median rent of $2,000 for 2-bedroom rentals in 74201.'
		);
		const button = page.getByRole('button', { name: 'Get rent estimate (1 call)' });
		await expect.element(button).toBeVisible();
		expect(spends).toHaveLength(0);
		expect(await axeViolations(container)).toEqual([]);

		await button.click();
		await expect.element(page.getByText('Estimate: $2,080 a month')).toBeVisible();
		expect(spends.map((r) => r.endpoint)).toEqual(['rent-estimate']);
		expect(spends[0]!.params).toMatchObject({ address: ROW.formattedAddress, compCount: 15 });
		await expect.element(page.getByText('Low confidence: 2 comparables')).toBeVisible();
		expect(vi.mocked(announce)).toHaveBeenCalledWith(
			'Rent estimate ready: $2,080 a month. Low confidence.'
		);
		expect(page.getByRole('button', { name: /Get rent estimate/ }).elements()).toHaveLength(0);
		expect(await axeViolations(container)).toEqual([]);
	});

	test('nothing cached: both buttons show "(1 call)" with 0 spends; Load spends exactly 1 markets call', async () => {
		const { runtime, spends, gateway } = fakeRuntime({ answers: { markets: { data: MARKET } } });
		const { container } = await mount(runtime);

		const load = page.getByRole('button', { name: 'Load 74201 rent data (1 call)' });
		await expect.element(load).toBeVisible();
		await expect
			.element(page.getByRole('button', { name: 'Get rent estimate (1 call)' }))
			.toBeVisible();
		expect(flat(container)).toContain('ZIP data is saved for 30 days');
		expect(gateway.peek).toHaveBeenCalled();
		expect(spends).toHaveLength(0);

		await load.click();
		await expect.element(page.getByText('8% above', { exact: false })).toBeVisible();
		expect(spends).toHaveLength(1);
		expect(spends[0]).toEqual({
			endpoint: 'markets',
			params: { zipCode: '74201', dataType: 'All', historyRange: 24 }
		});
		expect(vi.mocked(announce)).toHaveBeenCalledWith(
			'$2,160 is 8% above the median rent of $2,000 for 2-bedroom rentals in 74201.'
		);
		expect(await axeViolations(container)).toEqual([]);
	});

	test('no ZIP data: Load ends in the Tier 1 NoResults body, with no search actions', async () => {
		const { runtime, spends } = fakeRuntime({
			answers: { markets: { error: new GatewayError({ kind: 'NoResults' }) } }
		});
		const { container } = await mount(runtime);

		await page.getByRole('button', { name: 'Load 74201 rent data (1 call)' }).click();
		await expect
			.element(page.getByText('RentCast has no rent data for 74201 yet.', { exact: false }))
			.toBeVisible();
		expect(spends).toHaveLength(1);
		expect(page.getByRole('button', { name: 'Edit search' }).elements()).toHaveLength(0);
		expect(await axeViolations(container)).toEqual([]);
	});
});
