// Runtime RentCast mocks for renter E2E specs (06-09). A plain module, not a spec.
//
// Every body is built at request time from the committed synthetic Phase 4 fixtures
// (src/lib/data/fixtures/*.json) through the sample-mode transport createFixtureFetch (04-12), so
// live-mode specs see exactly the rows, dates (rebased to now), filters, estimates and market
// stats that sample mode serves. Nothing here writes a fixture or introduces a literal address,
// phone or email: variants (the 500-row page, extra rows, trimmed comps) are derived at runtime.
//
// Register AFTER the net fixture's deny-all (i.e. inside the test), so this route wins. Only
// https://api.rentcast.io/v1/** is answered; anything else on that host stays denied.
import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { createFixtureFetch, type FixtureSet } from '../../../src/lib/data/fixtures/fixture-fetch';
import { recordRequest, type Net } from './network';

export const RENTCAST_V1_ROUTE = 'https://api.rentcast.io/v1/**';
export const RENTAL_LISTINGS_PATH = '/v1/listings/rental/long-term';
export const RENT_ESTIMATE_PATH = '/v1/avm/rent/long-term';
export const MARKETS_PATH = '/v1/markets';
/** The Settings "Test key" probe ZIP: answered 404 (a valid key, nothing found, 0 billed). */
export const PROBE_ZIP = '00000';

type Row = Record<string, unknown>;

export interface MockRentCastOptions {
	/** 'fixtures' (default): the matching fixture rows. 'many500': exactly 500 rows (clones). */
	rows?: 'fixtures' | 'many500';
	/** Rows appended to matching listing pages (e.g. "N new" tests); also served by id. */
	extraRows?: Row[];
	/** Rent-estimate comparables are sliced to this many (default: all fixture comps). */
	estimateComps?: number;
	/** 'none' answers every market-stats request 404. Default 'fixtures'. */
	markets?: 'fixtures' | 'none';
	/** Answer every by-id listing request 404. */
	byIdMissing?: boolean;
}

const FIXTURE_DIR = new URL('../../../src/lib/data/fixtures/', import.meta.url);

function readFixture(name: string): unknown {
	return JSON.parse(readFileSync(new URL(`${name}.json`, FIXTURE_DIR), 'utf8'));
}

/** The six committed fixture files, read once per worker (createFixtureFetch deep-copies). */
let fixtureSet: FixtureSet | undefined;
export function rentcastFixtures(): FixtureSet {
	fixtureSet ??= {
		meta: readFixture('meta'),
		metros: readFixture('metros'),
		rentals: readFixture('rentals'),
		sales: readFixture('sales'),
		estimates: readFixture('estimates'),
		markets: readFixture('markets')
	} as FixtureSet;
	return fixtureSet;
}

const CORS = {
	'access-control-allow-origin': '*',
	'access-control-allow-methods': 'GET',
	'access-control-allow-headers': 'x-api-key, accept'
};
const JSON_HEADERS = { ...CORS, 'content-type': 'application/json' };
const NOT_FOUND = { error: 'resource/not-found', message: 'No sample data matches this request.' };

type Result = { status: number; body: unknown };

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;
const MANY = 500;

function pageWindow(params: URLSearchParams): { offset: number; limit: number } {
	const limit = Number(params.get('limit') ?? DEFAULT_LIMIT);
	const offset = Number(params.get('offset') ?? 0);
	return {
		limit: Number.isFinite(limit) ? Math.min(MAX_LIMIT, Math.max(1, Math.trunc(limit))) : 50,
		offset: Number.isFinite(offset) ? Math.max(0, Math.trunc(offset)) : 0
	};
}

/** Extra rows a listing query should include: same ZIP / city / state when those are given. */
function matchingExtras(extra: Row[], params: URLSearchParams): Row[] {
	const zip = params.get('zipCode');
	const city = params.get('city');
	const state = params.get('state');
	return extra.filter(
		(r) =>
			(zip === null || r.zipCode === zip) &&
			(city === null || r.city === city) &&
			(state === null || r.state === state)
	);
}

/**
 * Installs the RentCast mock on `page`. Every non-preflight request is counted in `net.counts`
 * (host + pathname) and `net.requests`, then answered from the fixtures as described above.
 */
export async function mockRentCast(
	page: Page,
	net: Net,
	opts: MockRentCastOptions = {}
): Promise<void> {
	const fixtureFetch = createFixtureFetch(rentcastFixtures(), Date.now);
	const extra = opts.extraRows ?? [];

	async function fromFixtures(url: URL): Promise<Result> {
		const res = await fixtureFetch(url);
		return { status: res.status, body: await res.json() };
	}

	async function listings(url: URL): Promise<Result> {
		const params = url.searchParams;
		const { offset, limit } = pageWindow(params);
		let rows: Row[];
		if (opts.rows === 'many500') {
			// Every matching fixture row (one full page), cloned to exactly 500 with ids `-c{n}`.
			const all = new URL(url);
			all.searchParams.set('limit', String(MAX_LIMIT));
			all.searchParams.set('offset', '0');
			const base = await fromFixtures(all);
			const pool = base.status === 200 ? (base.body as Row[]) : [];
			rows = [];
			for (let n = 0; pool.length > 0 && rows.length < MANY; n++) {
				for (const row of pool) {
					if (rows.length === MANY) break;
					rows.push({ ...row, id: `${String(row.id)}-c${n}` });
				}
			}
			rows = rows.slice(offset, offset + limit);
		} else {
			const base = await fromFixtures(url);
			if (base.status !== 200 && base.status !== 404) return base;
			rows = base.status === 200 ? (base.body as Row[]) : [];
		}
		// Extra rows ride on the first page only, so paging never duplicates them.
		if (offset === 0) rows = [...rows, ...matchingExtras(extra, params)];
		return rows.length === 0 ? { status: 404, body: NOT_FOUND } : { status: 200, body: rows };
	}

	async function answer(url: URL): Promise<Result> {
		const path = url.pathname.replace(/\/+$/, '');
		if (path === MARKETS_PATH) {
			if (url.searchParams.get('zipCode') === PROBE_ZIP) return { status: 404, body: {} };
			if (opts.markets === 'none') return { status: 404, body: NOT_FOUND };
			return fromFixtures(url);
		}
		if (path === RENTAL_LISTINGS_PATH) return listings(url);
		if (path.startsWith(`${RENTAL_LISTINGS_PATH}/`)) {
			if (opts.byIdMissing) return { status: 404, body: NOT_FOUND };
			const id = decodeURIComponent(path.slice(RENTAL_LISTINGS_PATH.length + 1));
			const added = extra.find((r) => r.id === id);
			return added ? { status: 200, body: added } : fromFixtures(url);
		}
		if (path === RENT_ESTIMATE_PATH) {
			const result = await fromFixtures(url);
			if (result.status === 200 && opts.estimateComps !== undefined) {
				const body = result.body as Row & { comparables?: Row[] };
				return {
					status: 200,
					body: { ...body, comparables: (body.comparables ?? []).slice(0, opts.estimateComps) }
				};
			}
			return result;
		}
		return fromFixtures(url);
	}

	await page.route(RENTCAST_V1_ROUTE, async (route) => {
		const request = route.request();
		if (request.method() === 'OPTIONS') {
			await route.fulfill({ status: 204, headers: CORS });
			return;
		}
		recordRequest(net, request);
		const result = await answer(new URL(request.url()));
		await route.fulfill({
			status: result.status,
			headers: JSON_HEADERS,
			body: JSON.stringify(result.body)
		});
	});
}
