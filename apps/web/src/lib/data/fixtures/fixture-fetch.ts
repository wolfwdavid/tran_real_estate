/**
 * Sample-mode transport: a fetch-compatible function that answers RentCast requests from the
 * committed synthetic fixtures, so sample mode runs the real client, schemas and mappers.
 *
 * Fixture dates are relative to ANCHOR and are shifted to the current clock at load
 * (RESEARCH Pattern 5; Phase 6 requirement). Listing dates move by the exact `now − anchor`
 * shift; market `YYYY-MM` history keys move by whole months.
 *
 * It never calls the network and never relabels a fixture row with a place the user typed:
 * a location outside the three sample metros answers `404 sample/outside-coverage`.
 */
import { ENDPOINT_PATHS, type EndpointId } from '@tran/core/request';

export interface FixtureSet {
	meta: { anchor: string; seed: number; version: number };
	metros: unknown[];
	rentals: Record<string, unknown>[];
	sales: Record<string, unknown>[];
	estimates: { rent: Record<string, unknown>[]; sale: Record<string, unknown>[] };
	markets: Record<string, unknown>[];
}

type Row = Record<string, unknown>;

interface Metro {
	city: string;
	state: string;
	zipCodes: string[];
	centroid: { latitude: number; longitude: number };
}

const DAY_MS = 86_400_000;
const SAMPLE_ZIP3 = ['742', '702', '858'] as const;
/** A point counts as "inside a sample metro" within this many miles of its centroid. */
const COVERAGE_RADIUS_MILES = 25;
const DEFAULT_RADIUS_MILES = 5;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;
const LISTING_DATE_FIELDS = ['listedDate', 'createdDate', 'lastSeenDate', 'removedDate'] as const;
const HISTORY_DATE_FIELDS = ['listedDate', 'removedDate'] as const;
const NUMERIC_FILTERS = [
	'bedrooms',
	'bathrooms',
	'squareFootage',
	'lotSize',
	'yearBuilt',
	'price'
] as const;

export const OUTSIDE_COVERAGE = {
	error: 'sample/outside-coverage',
	message: 'Sample data covers Harlow Springs, OK; Bayou Verde, LA; and Juniper Mesa, AZ.'
} as const;
const NOT_FOUND = { error: 'resource/not-found', message: 'No sample data matches this request.' };

// ---------------------------------------------------------------------------------------------
// Date rebasing
// ---------------------------------------------------------------------------------------------

function shiftIso(value: unknown, shiftMs: number): unknown {
	if (typeof value !== 'string') return value;
	const t = Date.parse(value);
	return Number.isNaN(t) ? value : new Date(t + shiftMs).toISOString();
}

function shiftDayKey(key: string, shiftMs: number): string {
	const t = Date.parse(`${key}T00:00:00.000Z`);
	return Number.isNaN(t) ? key : new Date(t + shiftMs).toISOString().slice(0, 10);
}

function monthIndex(t: number): number {
	const d = new Date(t);
	return d.getUTCFullYear() * 12 + d.getUTCMonth();
}

function shiftMonthKey(key: string, months: number): string {
	const match = /^(\d{4})-(\d{2})$/.exec(key);
	if (!match) return key;
	const index = Number(match[1]) * 12 + (Number(match[2]) - 1) + months;
	const year = Math.floor(index / 12);
	const month = (index % 12) + 1;
	return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
}

function shiftIsoByMonths(value: unknown, months: number): unknown {
	if (typeof value !== 'string') return value;
	const t = Date.parse(value);
	if (Number.isNaN(t)) return value;
	const d = new Date(t);
	d.setUTCMonth(d.getUTCMonth() + months);
	return d.toISOString();
}

function rebaseListing(row: Row, shiftMs: number): Row {
	const out: Row = { ...row };
	for (const field of LISTING_DATE_FIELDS) {
		if (field in out) out[field] = shiftIso(out[field], shiftMs);
	}
	const history = row.history;
	if (history && typeof history === 'object') {
		const next: Record<string, Row> = {};
		for (const [key, entry] of Object.entries(history as Record<string, Row>)) {
			const moved: Row = { ...entry };
			for (const field of HISTORY_DATE_FIELDS) {
				if (field in moved) moved[field] = shiftIso(moved[field], shiftMs);
			}
			next[shiftDayKey(key, shiftMs)] = moved;
		}
		out.history = next;
	}
	return out;
}

function rebaseMarketSide(side: unknown, shiftMs: number, months: number): unknown {
	if (!side || typeof side !== 'object') return side;
	const out: Row = { ...(side as Row) };
	if ('lastUpdatedDate' in out) out.lastUpdatedDate = shiftIso(out.lastUpdatedDate, shiftMs);
	const history = out.history;
	if (history && typeof history === 'object') {
		const next: Record<string, Row> = {};
		for (const [key, entry] of Object.entries(history as Record<string, Row>)) {
			next[shiftMonthKey(key, months)] = { ...entry, date: shiftIsoByMonths(entry.date, months) };
		}
		out.history = next;
	}
	return out;
}

/** A pure deep copy of the fixtures with every date moved to the current clock. */
export function rebaseFixtures(data: FixtureSet, now: number): FixtureSet {
	const copy = structuredClone(data);
	const anchor = Date.parse(copy.meta.anchor);
	const shiftMs = now - anchor;
	const months = monthIndex(now) - monthIndex(anchor);
	return {
		...copy,
		rentals: copy.rentals.map((row) => rebaseListing(row, shiftMs)),
		sales: copy.sales.map((row) => rebaseListing(row, shiftMs)),
		markets: copy.markets.map((market) => ({
			...market,
			...('saleData' in market
				? { saleData: rebaseMarketSide(market.saleData, shiftMs, months) }
				: {}),
			...('rentalData' in market
				? { rentalData: rebaseMarketSide(market.rentalData, shiftMs, months) }
				: {})
		}))
	};
}

// ---------------------------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------------------------

function haversineMiles(aLat: number, aLon: number, bLat: number, bLon: number): number {
	const rad = Math.PI / 180;
	const dLat = (bLat - aLat) * rad;
	const dLon = (bLon - aLon) * rad;
	const h =
		Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLon / 2) ** 2;
	return 2 * 3958.8 * Math.asin(Math.sqrt(h));
}

function isSampleZip(zip: string): boolean {
	return /^\d{5}$/.test(zip) && SAMPLE_ZIP3.some((prefix) => zip.startsWith(prefix));
}

function nearMetro(metros: Metro[], lat: number, lon: number): boolean {
	return metros.some(
		(m) =>
			haversineMiles(lat, lon, m.centroid.latitude, m.centroid.longitude) <= COVERAGE_RADIUS_MILES
	);
}

function normalizeAddress(address: string): string {
	return address.trim().replace(/\s+/g, ' ').toLowerCase();
}

function zipOfAddress(address: string): string | undefined {
	return /(\d{5})(?:-\d{4})?\s*$/.exec(address.trim())?.[1];
}

function num(value: string | null): number | undefined {
	if (value === null || value.trim() === '') return undefined;
	const n = Number(value);
	return Number.isFinite(n) ? n : undefined;
}

type Range = { min: number; max: number };

/** RentCast range syntax: `N`, `min:max`, `*` for an open end, pipe-separated alternatives. */
function parseRanges(value: string, singleIsMax = false): Range[] {
	return value.split('|').map((part) => {
		const [lo, hi] = part.split(':');
		if (hi === undefined) {
			const n = Number(lo);
			return singleIsMax ? { min: -Infinity, max: n } : { min: n, max: n };
		}
		return {
			min: lo === '*' || lo === '' ? -Infinity : Number(lo),
			max: hi === '*' || hi === '' ? Infinity : Number(hi)
		};
	});
}

function inRanges(value: unknown, ranges: Range[]): boolean {
	if (typeof value !== 'number') return false;
	return ranges.some((r) => value >= r.min && value <= r.max);
}

type Result = { status: number; body: unknown };

const ok = (body: unknown): Result => ({ status: 200, body });
const notFound = (): Result => ({ status: 404, body: NOT_FOUND });
const outside = (): Result => ({ status: 404, body: OUTSIDE_COVERAGE });
const badRequest = (message: string): Result => ({
	status: 400,
	body: { error: 'resource/bad-request', message }
});

function respond(result: Result): Response {
	return new Response(JSON.stringify(result.body), {
		status: result.status,
		headers: { 'content-type': 'application/json' }
	});
}

// ---------------------------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------------------------

const BY_ID = /^\/v1\/listings\/rental\/long-term\/([^/]+)$/;

function matchRoute(pathname: string): { endpoint: EndpointId; id?: string } | undefined {
	const path = pathname.replace(/\/+$/, '');
	const byId = BY_ID.exec(path);
	if (byId) return { endpoint: 'rental-listing-by-id', id: decodeURIComponent(byId[1]!) };
	for (const [endpoint, template] of Object.entries(ENDPOINT_PATHS) as [EndpointId, string][]) {
		if (!template.includes('{id}') && template === path) return { endpoint };
	}
	return undefined;
}

function queryListings(rows: Row[], params: URLSearchParams, metros: Metro[], now: number): Result {
	let pool = rows;

	// Location (at least one is required; every one given must be inside a sample metro).
	const zip = params.get('zipCode');
	const city = params.get('city');
	const state = params.get('state');
	const lat = num(params.get('latitude'));
	const lon = num(params.get('longitude'));
	const address = params.get('address');
	if (zip === null && city === null && state === null && lat === undefined && !address) {
		return badRequest(
			'A location (zipCode, city and state, latitude and longitude, or address) is required.'
		);
	}
	if (zip !== null) {
		if (!isSampleZip(zip)) return outside();
		pool = pool.filter((r) => r.zipCode === zip);
	}
	if (city !== null || state !== null) {
		const covered = metros.some(
			(m) => (city === null || m.city === city) && (state === null || m.state === state)
		);
		if (!covered) return outside();
		pool = pool.filter(
			(r) => (city === null || r.city === city) && (state === null || r.state === state)
		);
	}
	if (lat !== undefined || lon !== undefined) {
		if (lat === undefined || lon === undefined) {
			return badRequest('latitude and longitude must be given together.');
		}
		if (!nearMetro(metros, lat, lon)) return outside();
		const radius = num(params.get('radius')) ?? DEFAULT_RADIUS_MILES;
		pool = pool.filter(
			(r) =>
				typeof r.latitude === 'number' &&
				typeof r.longitude === 'number' &&
				haversineMiles(lat, lon, r.latitude, r.longitude) <= radius
		);
	}
	if (address) {
		const addrZip = zipOfAddress(address);
		if (addrZip !== undefined && !isSampleZip(addrZip)) return outside();
		const wanted = normalizeAddress(address);
		pool = pool.filter(
			(r) =>
				typeof r.formattedAddress === 'string' && normalizeAddress(r.formattedAddress) === wanted
		);
	}

	// Attribute filters.
	const status = params.get('status') ?? 'Active';
	pool = pool.filter((r) => r.status === status);
	const types = params.get('propertyType');
	if (types) {
		const wanted = types.split('|');
		pool = pool.filter(
			(r) => typeof r.propertyType === 'string' && wanted.includes(r.propertyType)
		);
	}
	for (const field of NUMERIC_FILTERS) {
		const raw = params.get(field);
		if (raw) {
			const ranges = parseRanges(raw);
			pool = pool.filter((r) => inRanges(r[field], ranges));
		}
	}
	const daysOld = params.get('daysOld');
	if (daysOld) {
		const ranges = parseRanges(daysOld, true);
		pool = pool.filter(
			(r) =>
				typeof r.listedDate === 'string' &&
				inRanges((now - Date.parse(r.listedDate)) / DAY_MS, ranges)
		);
	}

	// RentCast order: lastSeenDate desc (id breaks ties so pages are stable).
	const sorted = [...pool].sort((a, b) => {
		const la = String(a.lastSeenDate ?? '');
		const lb = String(b.lastSeenDate ?? '');
		if (la !== lb) return la < lb ? 1 : -1;
		return String(a.id).localeCompare(String(b.id));
	});
	const limit = Math.min(
		MAX_LIMIT,
		Math.max(1, Math.trunc(num(params.get('limit')) ?? DEFAULT_LIMIT))
	);
	const offset = Math.max(0, Math.trunc(num(params.get('offset')) ?? 0));
	const page = sorted.slice(offset, offset + limit);
	return page.length === 0 ? notFound() : ok(page);
}

function route(data: FixtureSet, metros: Metro[], url: URL, now: number): Result {
	const matched = matchRoute(url.pathname);
	if (!matched) return notFound();
	const params = url.searchParams;
	switch (matched.endpoint) {
		case 'rental-listings':
			return queryListings(data.rentals, params, metros, now);
		case 'sale-listings':
			return queryListings(data.sales, params, metros, now);
		case 'rental-listing-by-id': {
			const row = data.rentals.find((r) => r.id === matched.id);
			return row ? ok(row) : notFound();
		}
		default:
			return notFound();
	}
}

function urlOf(input: RequestInfo | URL): URL {
	if (typeof input === 'string') return new URL(input);
	if (input instanceof URL) return input;
	return new URL(input.url);
}

/**
 * A fetch-compatible sample transport. Fixtures are rebased once at creation; `now` is read
 * per request for age filters (`daysOld`) and comparables.
 */
export function createFixtureFetch(data: FixtureSet, now: () => number): typeof fetch {
	const rebased = rebaseFixtures(data, now());
	const metros = rebased.metros as Metro[];
	const transport = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
		const method = (
			init?.method ?? (typeof input === 'object' && 'method' in input ? input.method : 'GET')
		).toUpperCase();
		if (method !== 'GET') {
			return respond({ status: 405, body: { error: 'resource/method-not-allowed' } });
		}
		return respond(route(rebased, metros, urlOf(input), now()));
	};
	return transport as typeof fetch;
}
