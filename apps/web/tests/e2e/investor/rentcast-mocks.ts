// Investor RentCast mock bodies (07-03). A plain module, not a spec.
//
// Every body is DERIVED at runtime from the committed synthetic Phase 4 fixtures through the
// sample-mode transport createFixtureFetch (the same source as ../support/rentcast-mocks.ts), so
// no real or new address, phone or email is ever written here. The variants Phase 7 specs need
// (8 or 2 rent comparables, monthly bedroom series with a gap and a thin month) are computed in
// memory.
//
// MOCK_ZIP / MOCK_CITY: the plan's prose says "79999" / "Harlow Springs, TX", but the fixture
// metro is Harlow Springs, OK with ZIPs 74201/74203, and sample-mode answers only fixture ZIPs.
// Specs MUST import these constants instead of writing a ZIP or city literally.
import { createFixtureFetch } from '../../../src/lib/data/fixtures/fixture-fetch';
import { rentcastFixtures } from '../support/rentcast-mocks';

export const MOCK_ZIP = '74201';
export const MOCK_CITY = 'Harlow Springs, OK';

export const SALE_LISTINGS_PATH = '/v1/listings/sale';
export const VALUE_ESTIMATE_PATH = '/v1/avm/value';

const ORIGIN = 'https://api.rentcast.io';

type Row = Record<string, unknown>;
export type MockResult = { status: number; body: unknown };

/** Answers one RentCast URL from the fixtures, exactly as sample mode would. */
export async function fromFixtures(url: URL | string): Promise<MockResult> {
	const res = await createFixtureFetch(rentcastFixtures(), Date.now)(new URL(url));
	return { status: res.status, body: await res.json() };
}

const rentcastUrl = (path: string, params: Record<string, string>) => {
	const url = new URL(path, ORIGIN);
	for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
	return url;
};

/** For-sale listings in MOCK_ZIP (all in MOCK_CITY), straight from the fixtures. */
export async function saleListingsBody(): Promise<Row[]> {
	const r = await fromFixtures(rentcastUrl(SALE_LISTINGS_PATH, { zipCode: MOCK_ZIP, limit: '50' }));
	if (r.status !== 200) throw new Error(`fixture sale listings for ${MOCK_ZIP}: ${r.status}`);
	return r.body as Row[];
}

/** The address every default estimate is for: the first for-sale fixture listing in MOCK_ZIP. */
export async function mockSubjectAddress(): Promise<string> {
	return String((await saleListingsBody())[0].formattedAddress);
}

/** Returns `comps` comparables: the fixture's own, cloned with `-x{n}` ids when more are needed. */
export function withComparables(body: Row, comps: number): Row {
	const pool = Array.isArray(body.comparables) ? (body.comparables as Row[]) : [];
	const out: Row[] = [];
	for (let n = 0; pool.length > 0 && out.length < comps; n++) {
		for (const row of pool) {
			if (out.length === comps) break;
			out.push(n === 0 ? row : { ...row, id: `${String(row.id)}-x${n}` });
		}
	}
	return { ...body, comparables: out };
}

/** A rent AVM for `url` (or the default subject) with exactly `comps` comparables. */
export async function rentEstimateFor(url: URL, comps: number): Promise<MockResult> {
	const r = await fromFixtures(url);
	return r.status === 200 ? { status: 200, body: withComparables(r.body as Row, comps) } : r;
}

async function subjectEstimate(path: string): Promise<Row> {
	return (await fromFixtures(rentcastUrl(path, { address: await mockSubjectAddress() })))
		.body as Row;
}

/** { rent, rentRangeLow, rentRangeHigh, comparables: 8 rows } for the default subject. */
export async function rentEstimateBody(comps = 8): Promise<Row> {
	return withComparables(await subjectEstimate('/v1/avm/rent/long-term'), comps);
}

/** The same estimate with only 2 comparables (the "few comps" confidence state). */
export function fewCompsRentEstimateBody(): Promise<Row> {
	return rentEstimateBody(2);
}

/** { price, priceRangeLow, priceRangeHigh, comparables } for the default subject. */
export function valueEstimateBody(): Promise<Row> {
	return subjectEstimate(VALUE_ESTIMATE_PATH);
}

/** The ZIP whose 3-bedroom series misses a month, and the month whose 2-bedroom count is 3. */
export const GAP_MONTH_OFFSET = 5;
export const THIN_MONTH_OFFSET = 8;
export const THIN_LISTINGS = 3;

type Side = Row & { history?: Record<string, Row>; dataByBedrooms?: Row[] };

/**
 * Gives every history month a `dataByBedrooms` series (bedrooms 0..4) scaled from the side's
 * current breakdown by that month's median, then drops bedrooms 3 from one month (a gap) and sets
 * one month's 2-bedroom totalListings to THIN_LISTINGS (a thin sample). Offsets count back from
 * the latest month.
 */
function withBedroomHistory(side: Side, value: 'Rent' | 'Price'): Side {
	const history = side.history ?? {};
	const keys = Object.keys(history).sort();
	const current = (side.dataByBedrooms ?? []).filter((b) => Number(b.bedrooms) <= 4);
	const latest = Number(side[`median${value}`]) || 1;
	const out: Record<string, Row> = {};
	keys.forEach((key, i) => {
		const month = history[key];
		const ratio = (Number(month[`median${value}`]) || latest) / latest;
		const fromEnd = keys.length - 1 - i;
		let beds = current.map((b) => ({
			...b,
			[`average${value}`]: Math.round(Number(b[`average${value}`]) * ratio),
			[`median${value}`]: Math.round(Number(b[`median${value}`]) * ratio)
		}));
		if (fromEnd === GAP_MONTH_OFFSET) beds = beds.filter((b) => b.bedrooms !== 3);
		if (fromEnd === THIN_MONTH_OFFSET) {
			beds = beds.map((b) => (b.bedrooms === 2 ? { ...b, totalListings: THIN_LISTINGS } : b));
		}
		out[key] = { ...month, dataByBedrooms: beds };
	});
	return { ...side, history: out };
}

/**
 * Market statistics with 24 months of rental and sale history, each month carrying a bedroom
 * breakdown (see withBedroomHistory). null when the fixtures have no market for `zip`.
 */
export async function marketStatsBody(zip: string = MOCK_ZIP): Promise<Row | null> {
	const r = await fromFixtures(rentcastUrl('/v1/markets', { zipCode: zip, historyRange: '24' }));
	if (r.status !== 200) return null;
	const body = r.body as Row & { rentalData?: Side; saleData?: Side };
	return {
		...body,
		...(body.rentalData ? { rentalData: withBedroomHistory(body.rentalData, 'Rent') } : {}),
		...(body.saleData ? { saleData: withBedroomHistory(body.saleData, 'Price') } : {})
	};
}
