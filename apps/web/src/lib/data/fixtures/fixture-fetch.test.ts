import { describe, expect, it } from 'vitest';
import estimates from './estimates.json';
import markets from './markets.json';
import meta from './meta.json';
import metros from './metros.json';
import rentals from './rentals.json';
import sales from './sales.json';
import { createFixtureFetch, rebaseFixtures, type FixtureSet } from './fixture-fetch';
import { SAMPLE_METROS } from './sample-metros';

const DATA = { meta, metros, rentals, sales, estimates, markets } as unknown as FixtureSet;
const ANCHOR = Date.parse(meta.anchor);
const DAY = 86_400_000;
const BASE = 'https://api.rentcast.io';

type Row = Record<string, unknown>;

async function call(path: string, now = ANCHOR): Promise<{ res: Response; body: unknown }> {
	const transport = createFixtureFetch(DATA, () => now);
	const res = await transport(BASE + path);
	return { res, body: await res.json() };
}

async function rows(path: string, now = ANCHOR): Promise<Row[]> {
	const { res, body } = await call(path, now);
	expect(res.status).toBe(200);
	expect(Array.isArray(body)).toBe(true);
	return body as Row[];
}

function shifted(iso: unknown, ms: number): unknown {
	return typeof iso === 'string' ? new Date(Date.parse(iso) + ms).toISOString() : iso;
}

function miles(aLat: number, aLon: number, bLat: number, bLon: number): number {
	const rad = Math.PI / 180;
	const dLat = (bLat - aLat) * rad;
	const dLon = (bLon - aLon) * rad;
	const h =
		Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLon / 2) ** 2;
	return 2 * 3958.8 * Math.asin(Math.sqrt(h));
}

const RENTALS = '/v1/listings/rental/long-term';
const SALES = '/v1/listings/sale';

describe('rebaseFixtures', () => {
	it('shifts every listing date and history key by now - anchor, leaving the input untouched', () => {
		const before = structuredClone(DATA);
		const shift = 10 * DAY;
		const out = rebaseFixtures(DATA, ANCHOR + shift);
		expect(DATA).toEqual(before);

		for (const [src, dst] of [
			[before.rentals, out.rentals],
			[before.sales, out.sales]
		] as const) {
			expect(dst).toHaveLength(src.length);
			src.forEach((row, i) => {
				const next = dst[i]!;
				for (const field of ['listedDate', 'createdDate', 'lastSeenDate', 'removedDate']) {
					expect(next[field]).toEqual(shifted(row[field], shift));
				}
				const history = row.history as Record<string, Row>;
				const nextHistory = next.history as Record<string, Row>;
				const expectedKeys = Object.keys(history).map((k) =>
					new Date(Date.parse(`${k}T00:00:00.000Z`) + shift).toISOString().slice(0, 10)
				);
				expect(Object.keys(nextHistory)).toEqual(expectedKeys);
				Object.values(history).forEach((entry, j) => {
					const moved = nextHistory[expectedKeys[j]!]!;
					expect(moved.listedDate).toEqual(shifted(entry.listedDate, shift));
					expect(moved.removedDate).toEqual(shifted(entry.removedDate, shift));
				});
				// Location fields are never rewritten.
				expect(next.city).toBe(row.city);
				expect(next.zipCode).toBe(row.zipCode);
			});
		}
	});

	it('shifts market history YYYY-MM keys by whole months and lastUpdatedDate by the exact shift', () => {
		const now = ANCHOR + 400 * DAY; // 2027-11-05
		const out = rebaseFixtures(DATA, now);
		const market = out.markets[0]!;
		const rental = market.rentalData as Row;
		const keys = Object.keys(rental.history as Row).sort();
		expect(keys.at(-1)).toBe('2027-10');
		expect((rental.history as Record<string, Row>)['2027-10']!.date).toBe(
			'2027-10-01T00:00:00.000Z'
		);
		expect(rental.lastUpdatedDate).toBe(
			shifted((DATA.markets[0]!.rentalData as Row).lastUpdatedDate, 400 * DAY)
		);
	});
});

describe('createFixtureFetch: listings', () => {
	it('stays fresh 400 days after the anchor (daysOld=*:7 still returns recent rows)', async () => {
		const now = ANCHOR + 400 * DAY;
		const found = await rows(`${RENTALS}?zipCode=74201&daysOld=*:7&limit=500`, now);
		expect(found.length).toBeGreaterThanOrEqual(1);
		for (const row of found) {
			const age = now - Date.parse(row.listedDate as string);
			expect(age).toBeGreaterThanOrEqual(0);
			expect(age).toBeLessThanOrEqual(7 * DAY);
		}
	});

	it('filters by zipCode, sorts by lastSeenDate desc then id, and applies the default limit', async () => {
		const found = await rows(`${RENTALS}?zipCode=74201`);
		expect(found.length).toBeGreaterThan(0);
		expect(found.length).toBeLessThanOrEqual(50);
		for (const row of found) expect(row.zipCode).toBe('74201');
		const order = found.map((r) => `${r.lastSeenDate as string}|${r.id as string}`);
		const expected = [...found]
			.sort((a, b) =>
				a.lastSeenDate === b.lastSeenDate
					? String(a.id).localeCompare(String(b.id))
					: String(b.lastSeenDate).localeCompare(String(a.lastSeenDate))
			)
			.map((r) => `${r.lastSeenDate as string}|${r.id as string}`);
		expect(order).toEqual(expected);
	});

	it('clamps limit to 1..500', async () => {
		expect(await rows(`${RENTALS}?zipCode=74201&limit=3`)).toHaveLength(3);
		expect(await rows(`${RENTALS}?zipCode=74201&limit=0`)).toHaveLength(1);
		const all = await rows(`${RENTALS}?city=Harlow%20Springs&state=OK&limit=9999`);
		expect(all.length).toBe(
			rentals.filter((r) => r.city === 'Harlow Springs' && r.status === 'Active').length
		);
	});

	it('matches city and state case-sensitively', async () => {
		const found = await rows(`${RENTALS}?city=Harlow%20Springs&state=OK&limit=500`);
		expect(found.length).toBeGreaterThan(0);
		for (const row of found) {
			expect(row.city).toBe('Harlow Springs');
			expect(row.state).toBe('OK');
		}
		const { res, body } = await call(`${RENTALS}?city=harlow%20springs&state=OK`);
		expect(res.status).toBe(404);
		expect((body as Row).error).toBe('sample/outside-coverage');
	});

	it('reports a ZIP outside the sample metros as outside coverage', async () => {
		const { res, body } = await call(`${RENTALS}?zipCode=78701`);
		expect(res.status).toBe(404);
		expect((body as Row).error).toBe('sample/outside-coverage');
		expect(String((body as Row).message)).toContain('Harlow Springs, OK');
	});

	it('reports a far-away point as outside coverage and filters a nearby one by radius', async () => {
		const far = await call(`${RENTALS}?latitude=30.2672&longitude=-97.7431&radius=5`);
		expect(far.res.status).toBe(404);
		expect((far.body as Row).error).toBe('sample/outside-coverage');

		const { latitude, longitude } = metros[0]!.centroid;
		const found = await rows(
			`${RENTALS}?latitude=${latitude}&longitude=${longitude}&radius=5&limit=500`
		);
		expect(found.length).toBeGreaterThan(0);
		for (const row of found) {
			expect(
				miles(latitude, longitude, row.latitude as number, row.longitude as number)
			).toBeLessThanOrEqual(5);
		}
	});

	it('applies ranges, open ends and pipe multi-values', async () => {
		const loc = 'city=Harlow%20Springs&state=OK&limit=500';
		const pool = await rows(`${RENTALS}?${loc}`);

		const midExpected = pool.filter(
			(r) => (r.price as number) >= 1000 && (r.price as number) <= 1500
		);
		expect(midExpected.length).toBeGreaterThan(0);
		const mid = await rows(`${RENTALS}?${loc}&price=1000:1500`);
		expect(mid.map((r) => r.id)).toEqual(midExpected.map((r) => r.id));

		const cheap = pool.filter((r) => (r.price as number) <= 1200);
		if (cheap.length > 0) {
			const got = await rows(`${RENTALS}?${loc}&price=*:1200`);
			expect(got.map((r) => r.id)).toEqual(cheap.map((r) => r.id));
		}

		const big = await rows(`${RENTALS}?${loc}&bedrooms=2:*`);
		expect(big.map((r) => r.id)).toEqual(
			pool.filter((r) => (r.bedrooms as number) >= 2).map((r) => r.id)
		);

		const types = pool.filter((r) => r.propertyType === 'Condo' || r.propertyType === 'Apartment');
		const typed = await call(`${RENTALS}?${loc}&propertyType=Condo|Apartment`);
		if (types.length === 0) expect(typed.res.status).toBe(404);
		else expect((typed.body as Row[]).map((r) => r.id)).toEqual(types.map((r) => r.id));
	});

	it('filters by status (Active by default, Inactive on request)', async () => {
		const active = await rows(`${RENTALS}?zipCode=74203&limit=500`);
		for (const row of active) expect(row.status).toBe('Active');
		const inactive = await rows(`${RENTALS}?zipCode=74203&status=Inactive&limit=500`);
		expect(inactive.length).toBeGreaterThan(0);
		for (const row of inactive) expect(row.status).toBe('Inactive');
	});

	it('pages with limit and offset over the sorted set', async () => {
		const loc = 'city=Harlow%20Springs&state=OK';
		const all = await rows(`${RENTALS}?${loc}&limit=500`);
		const page = await rows(`${RENTALS}?${loc}&limit=5&offset=5`);
		expect(page.map((r) => r.id)).toEqual(all.slice(5, 10).map((r) => r.id));
	});

	it('answers 404 resource/not-found when filters match nothing inside coverage', async () => {
		const { res, body } = await call(`${RENTALS}?zipCode=74201&price=1:2`);
		expect(res.status).toBe(404);
		expect((body as Row).error).toBe('resource/not-found');
	});

	it('serves sale listings including Land with null attributes', async () => {
		const found = await rows(`${SALES}?zipCode=74203&propertyType=Land`);
		expect(found.length).toBeGreaterThan(0);
		for (const row of found) {
			expect(row.propertyType).toBe('Land');
			expect(row.bedrooms).toBeNull();
		}
	});

	it('serves a rental listing by id and 404s an unknown id', async () => {
		const { res, body } = await call(`${RENTALS}/SAMPLE-74201-R001`);
		expect(res.status).toBe(200);
		expect((body as Row).id).toBe('SAMPLE-74201-R001');
		const missing = await call(`${RENTALS}/SAMPLE-74201-R999`);
		expect(missing.res.status).toBe(404);
	});

	it('404s an unknown path, and every response is JSON', async () => {
		const transport = createFixtureFetch(DATA, () => ANCHOR);
		for (const path of ['/v1/nope', `${RENTALS}?zipCode=74201`, `${RENTALS}?zipCode=78701`]) {
			const res = await transport(new URL(BASE + path));
			expect(res.headers.get('content-type')).toBe('application/json');
			if (path === '/v1/nope') expect(res.status).toBe(404);
		}
	});
});

describe('SAMPLE_METROS', () => {
	it('lists the three sample metros with labels that match metros.json', () => {
		expect(SAMPLE_METROS.map((m) => m.label)).toEqual([
			'Harlow Springs, OK',
			'Bayou Verde, LA',
			'Juniper Mesa, AZ'
		]);
		expect(SAMPLE_METROS.map(({ city, state, zipCodes }) => ({ city, state, zipCodes }))).toEqual(
			metros.map(({ city, state, zipCodes }) => ({ city, state, zipCodes }))
		);
	});
});

const RENT_AVM = '/v1/avm/rent/long-term';
const VALUE_AVM = '/v1/avm/value';
const MARKETS = '/v1/markets';
const SALE = sales[0]!;
const RENTAL_ONLY = rentals.find(
	(r) => !sales.some((s) => s.formattedAddress === r.formattedAddress)
)!;
const q = (address: string) => `address=${encodeURIComponent(address)}`;

describe('createFixtureFetch: estimates', () => {
	it('answers a rent estimate with subject property and 5 rebased comparables', async () => {
		const now = ANCHOR + 30 * DAY;
		const { res, body } = await call(`${RENT_AVM}?${q(SALE.formattedAddress)}`, now);
		expect(res.status).toBe(200);
		const est = body as Row;
		for (const key of ['rent', 'rentRangeLow', 'rentRangeHigh', 'latitude', 'longitude']) {
			expect(typeof est[key]).toBe('number');
		}
		const subject = est.subjectProperty as Row;
		expect(subject.formattedAddress).toBe(SALE.formattedAddress);
		for (const key of ['bedrooms', 'bathrooms', 'squareFootage', 'propertyType']) {
			expect(subject).toHaveProperty(key);
		}
		const comps = est.comparables as Row[];
		expect(comps).toHaveLength(5);
		comps.forEach((comp, i) => {
			for (const key of [
				'id',
				'formattedAddress',
				'price',
				'listedDate',
				'lastSeenDate',
				'daysOld',
				'distance',
				'correlation',
				'bedrooms',
				'bathrooms',
				'squareFootage',
				'propertyType',
				'status'
			]) {
				expect(comp).toHaveProperty(key);
			}
			expect(comp.id).not.toBe(SALE.id);
			expect(comp.correlation).toBe(Math.round((0.9 - 0.02 * i) * 100) / 100);
			const original = rentals.find((r) => r.id === comp.id)!;
			expect(comp.lastSeenDate).toBe(shifted(original.lastSeenDate, 30 * DAY));
			expect(comp.daysOld).toBe(Math.floor((now - Date.parse(comp.lastSeenDate as string)) / DAY));
			const d = miles(SALE.latitude, SALE.longitude, original.latitude, original.longitude);
			expect(comp.distance).toBe(Math.round(d * 100) / 100);
		});
	});

	it('matches addresses ignoring case and repeated spaces, and points within 0.0005 degrees', async () => {
		const messy = SALE.formattedAddress.toUpperCase().replace(/ /g, '  ');
		const loose = await call(`${RENT_AVM}?${q(messy)}`);
		expect(loose.res.status).toBe(200);
		expect(((loose.body as Row).subjectProperty as Row).formattedAddress).toBe(
			SALE.formattedAddress
		);

		const point = await call(
			`${RENT_AVM}?latitude=${SALE.latitude + 0.0003}&longitude=${SALE.longitude - 0.0003}`
		);
		expect(point.res.status).toBe(200);
		expect(((point.body as Row).subjectProperty as Row).formattedAddress).toBe(
			SALE.formattedAddress
		);
	});

	it('answers not-found inside coverage and outside-coverage elsewhere', async () => {
		const unknown = await call(`${RENT_AVM}?${q('1 Nowhere St, Harlow Springs, OK 74201')}`);
		expect(unknown.res.status).toBe(404);
		expect((unknown.body as Row).error).toBe('resource/not-found');

		const away = await call(`${RENT_AVM}?${q('100 Congress Ave, Austin, TX 78701')}`);
		expect(away.res.status).toBe(404);
		expect((away.body as Row).error).toBe('sample/outside-coverage');
	});

	it('answers a value estimate for a sale address with 5 sale comparables', async () => {
		const { res, body } = await call(`${VALUE_AVM}?${q(SALE.formattedAddress)}`);
		expect(res.status).toBe(200);
		const est = body as Row;
		for (const key of ['price', 'priceRangeLow', 'priceRangeHigh']) {
			expect(typeof est[key]).toBe('number');
		}
		expect((est.subjectProperty as Row).formattedAddress).toBe(SALE.formattedAddress);
		const comps = est.comparables as Row[];
		expect(comps).toHaveLength(5);
		const saleIds = new Set(sales.map((s) => s.id));
		for (const comp of comps) {
			expect(saleIds.has(comp.id as string)).toBe(true);
			expect(comp.id).not.toBe(SALE.id);
		}

		const rentalOnly = await call(`${VALUE_AVM}?${q(RENTAL_ONLY.formattedAddress)}`);
		expect(rentalOnly.res.status).toBe(404);
	});
});

describe('createFixtureFetch: markets', () => {
	it('returns rental data only, trimmed to historyRange, ending the month before now', async () => {
		const now = ANCHOR + 400 * DAY; // 2027-11-05
		const { res, body } = await call(
			`${MARKETS}?zipCode=74201&dataType=Rental&historyRange=12`,
			now
		);
		expect(res.status).toBe(200);
		const market = body as Row;
		expect(market.zipCode).toBe('74201');
		expect(market).not.toHaveProperty('saleData');
		const keys = Object.keys((market.rentalData as Row).history as Row).sort();
		expect(keys).toHaveLength(12);
		expect(keys.at(-1)).toBe('2027-10');
		expect(keys[0]).toBe('2026-11');
	});

	it('includes both sides for dataType=All or absent, with a default 12-month history', async () => {
		for (const path of [`${MARKETS}?zipCode=74201&dataType=All`, `${MARKETS}?zipCode=74201`]) {
			const { res, body } = await call(path);
			expect(res.status).toBe(200);
			const market = body as Row;
			expect(Object.keys((market.saleData as Row).history as Row)).toHaveLength(12);
			expect(Object.keys((market.rentalData as Row).history as Row)).toHaveLength(12);
		}
		const sale = await call(`${MARKETS}?zipCode=74201&dataType=Sale&historyRange=3`);
		expect(sale.body).not.toHaveProperty('rentalData');
		expect(Object.keys(((sale.body as Row).saleData as Row).history as Row)).toHaveLength(3);
	});

	it('never succeeds for the key-probe ZIP (zipCode=00000)', async () => {
		const { res, body } = await call(`${MARKETS}?zipCode=00000`);
		expect(res.status).toBe(404);
		expect((body as Row).error).toBe('sample/outside-coverage');
	});
});
