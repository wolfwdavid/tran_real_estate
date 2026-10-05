// Test-only. Wires a live DataGateway over an isolated DataDb with an injected fetch and clock.
// Fake keys only (TEST_KEY); listing rows are synthetic and use fictional addresses.
import type { DataRequest } from '@tran/core/request';
import { createCacheRepo } from '../cache-repo';
import { createDataGateway } from '../gateway';
import { createLedgerRepo } from '../ledger-repo';
import type { DataDb } from '../platform';
import { createRentCastClient } from '../rentcast/client';
import { makeDb, TEST_KEY } from './harness';

export function makeGateway(opts: {
	fetch: typeof fetch;
	clock: () => number;
	cap?: number;
	db?: DataDb;
	reactiveGuard?: () => boolean;
}) {
	const db = opts.db ?? makeDb();
	const ledger = createLedgerRepo(db, opts.clock);
	const cache = createCacheRepo(db);
	const client = createRentCastClient({ fetch: opts.fetch, getKey: () => TEST_KEY });
	const gateway = createDataGateway({
		client,
		cache,
		ledger,
		clock: opts.clock,
		probeFetch: opts.fetch,
		reactiveGuard: opts.reactiveGuard
	});
	return {
		gateway,
		db,
		ledger,
		cache,
		ready: opts.cap === undefined ? Promise.resolve() : ledger.writeCap(opts.cap)
	};
}

/** The fetch-wide rentals search for one ZIP (what buildListingsRequest produces). */
export const rentals = (zip: string): DataRequest => ({
	endpoint: 'rental-listings',
	params: { zipCode: zip, status: 'Active', limit: 500, offset: 0 }
});

/** A minimal schema-valid synthetic RentCast listing row. */
export function listingRow(id: string, zip = '74201', price = 1500): Record<string, unknown> {
	return {
		id,
		price,
		status: 'Active',
		zipCode: zip,
		formattedAddress: `100 Sample Way, Testville, OK ${zip}`,
		addressLine1: '100 Sample Way',
		city: 'Testville',
		state: 'OK',
		propertyType: 'Single Family',
		bedrooms: 2,
		bathrooms: 1
	};
}

/** `n` synthetic listing rows for one ZIP with ids `SAMPLE-<zip>-R001`… */
export const listingRows = (n: number, zip = '74201'): Record<string, unknown>[] =>
	Array.from({ length: n }, (_, i) =>
		listingRow(`SAMPLE-${zip}-R${String(i + 1).padStart(3, '0')}`, zip)
	);
