// The roadmap's call-count proofs (DATA-03): 60 simulated calls at cap 40 block call #41 and
// every later one; over-cap grants are single-use and request-bound; every failure surfaces as
// exactly one taxonomy kind; the key test is metered; no stored or thrown value carries the key.
import { describe, expect, it } from 'vitest';
import { isGatewayError, type DataRequest } from '@tran/core/request';
import { createCacheRepo } from './cache-repo';
import { createDataGateway } from './gateway';
import { createLedgerRepo } from './ledger-repo';
import { createRentCastClient } from './rentcast/client';
import { jsonResponse, makeDb, spyFetch, T0, TEST_KEY } from './testing/harness';
import { listingRows, makeGateway, rentals } from './testing/gateway-harness';

const outcome = async (p: Promise<unknown>): Promise<string> => {
	try {
		await p;
		return 'ok';
	} catch (e) {
		if (isGatewayError(e)) return e.kind;
		throw e;
	}
};

const caught = (p: Promise<unknown>) =>
	p.then(
		() => undefined,
		(e: unknown) => e
	);

/** A gateway whose fetch answers with whatever `respond` returns for each call, in order. */
function scripted(respond: (n: number, url: URL) => Response | Promise<Response>, cap?: number) {
	let n = 0;
	let now = T0;
	const spy = spyFetch((url) => respond(n++, url));
	const h = makeGateway({ fetch: spy.fetch, clock: () => now, cap });
	return {
		...h,
		spy,
		at: (t: number) => {
			now = t;
		}
	};
}

const zip = (i: number) => '742' + String(i).padStart(2, '0');

describe('60 calls at cap 40', () => {
	it('calls 1-40 succeed, #41 and every later one throws BudgetCapReached', async () => {
		const { gateway, spy, ready } = scripted(() => jsonResponse(200, []), 40);
		await ready;
		const results: string[] = [];
		for (let i = 0; i < 60; i++) results.push(await outcome(gateway.get(rentals(zip(i)))));

		expect(results.slice(0, 40)).toEqual(Array(40).fill('ok'));
		expect(results.slice(40)).toEqual(Array(20).fill('BudgetCapReached'));
		expect(spy.calls.length).toBe(40);
		const usage = await gateway.usage();
		expect(usage.billed).toBe(40);
		expect(usage.pending).toBe(0);
	});

	it('BudgetCapReached carries used, cap, resetsAt and requestKey', async () => {
		const { gateway, ready } = scripted(() => jsonResponse(200, []), 40);
		await ready;
		for (let i = 0; i < 40; i++) await gateway.get(rentals(zip(i)));
		const err = await caught(gateway.get(rentals('74299')));
		expect(isGatewayError(err)).toBe(true);
		if (!isGatewayError(err)) return;
		expect(err.kind).toBe('BudgetCapReached');
		expect(err.used).toBe(40);
		expect(err.cap).toBe(40);
		expect(err.resetsAt).toBe(Date.UTC(2026, 10, 1));
		expect(err.requestKey).toBe('rental-listings?limit=500&offset=0&status=Active&zipCode=74299');
	});

	it('a cached repeat still answers at the cap for 0 calls', async () => {
		const { gateway, spy, ready } = scripted(() => jsonResponse(200, []), 40);
		await ready;
		for (let i = 0; i < 40; i++) await gateway.get(rentals(zip(i)));
		expect(await outcome(gateway.get(rentals(zip(0))))).toBe('ok');
		expect(spy.calls.length).toBe(40);
	});
});

describe('over-cap grants', () => {
	async function atCap() {
		const h = scripted(() => jsonResponse(200, []), 40);
		await h.ready;
		for (let i = 0; i < 40; i++) await h.gateway.get(rentals(zip(i)));
		return h;
	}

	it('a grant allows exactly one call past the cap for its own request', async () => {
		const { gateway, spy } = await atCap();
		const reqA = rentals('74270');
		const grant = gateway.grantOverCap(reqA);
		expect(await outcome(gateway.get(reqA, { grant }))).toBe('ok');
		expect(spy.calls.length).toBe(41);
		expect(await outcome(gateway.get(rentals('74271')))).toBe('BudgetCapReached');
		// The consumed grant cannot be reused (refresh forces a call for the same request).
		expect(await outcome(gateway.refresh(reqA, { grant }))).toBe('BudgetCapReached');
		expect(spy.calls.length).toBe(41);
		const rows = await gateway.usage();
		expect(rows.billed).toBe(41);
	});

	it('a grant for request A cannot be used for request B', async () => {
		const { gateway, spy } = await atCap();
		const grant = gateway.grantOverCap(rentals('74280'));
		expect(await outcome(gateway.get(rentals('74281'), { grant }))).toBe('BudgetCapReached');
		expect(spy.calls.length).toBe(40);
		// Unused, it still works for A.
		expect(await outcome(gateway.get(rentals('74280'), { grant }))).toBe('ok');
		expect(spy.calls.length).toBe(41);
	});

	it('a forged grant literal is refused', async () => {
		const { gateway } = await atCap();
		const req = rentals('74290');
		const forged = { requestKey: gateway.grantOverCap(req).requestKey, consumed: false };
		expect(await outcome(gateway.get(rentals('74290'), { grant: forged }))).toBe(
			'BudgetCapReached'
		);
	});
});

describe('error taxonomy', () => {
	it('401 → InvalidKey, not cached, unbilled', async () => {
		const { gateway, spy } = scripted(() => jsonResponse(401, { error: 'auth/api-key-invalid' }));
		expect(await outcome(gateway.get(rentals('74201')))).toBe('InvalidKey');
		expect(await outcome(gateway.get(rentals('74201')))).toBe('InvalidKey');
		expect(spy.calls).toHaveLength(2);
		const usage = await gateway.usage();
		expect(usage.billed).toBe(0);
		expect(usage.failed).toBe(2);
	});

	it('403 billing → RestrictedKey detail billing, not cached, unbilled', async () => {
		const { gateway, spy } = scripted(() =>
			jsonResponse(403, { error: 'billing/subscription-inactive' })
		);
		const err = await caught(gateway.get(rentals('74201')));
		expect(isGatewayError(err) && [err.kind, err.detail]).toEqual(['RestrictedKey', 'billing']);
		await caught(gateway.get(rentals('74201')));
		expect(spy.calls).toHaveLength(2);
		expect((await gateway.usage()).billed).toBe(0);
		expect(await gateway.peek(rentals('74201'))).toBeUndefined();
	});

	it('429 → RateLimited with retryInMs 2000 then 4000; a 200 resets the backoff', async () => {
		const statuses = [429, 429, 200, 429];
		const { gateway, at } = scripted((n) =>
			statuses[n] === 200 ? jsonResponse(200, []) : jsonResponse(429, {})
		);
		const retry = async () => {
			const e = await caught(gateway.refresh(rentals('74201')));
			return isGatewayError(e) ? [e.kind, e.retryInMs] : ['ok', undefined];
		};
		expect(await retry()).toEqual(['RateLimited', 2000]);
		expect(await retry()).toEqual(['RateLimited', 4000]);
		at(T0 + 1);
		expect(await retry()).toEqual(['ok', undefined]);
		expect(await retry()).toEqual(['RateLimited', 2000]);
		expect((await gateway.usage()).billed).toBe(1);
	});

	it('a thrown fetch → NetworkError without detail; failed counts, billed does not', async () => {
		const { gateway } = scripted(() => {
			throw new TypeError('Failed to fetch');
		});
		const err = await caught(gateway.get(rentals('74201')));
		expect(isGatewayError(err) && [err.kind, err.detail]).toEqual(['NetworkError', undefined]);
		const usage = await gateway.usage();
		expect([usage.billed, usage.failed, usage.pending]).toEqual([0, 1, 0]);
	});

	it('503 → NetworkError detail server', async () => {
		const { gateway } = scripted(() => jsonResponse(503, {}));
		const err = await caught(gateway.get(rentals('74201')));
		expect(isGatewayError(err) && [err.kind, err.detail]).toEqual(['NetworkError', 'server']);
		const usage = await gateway.usage();
		expect([usage.billed, usage.failed]).toEqual([0, 1]);
	});

	it('200 that fails the schema → SchemaMismatch, billed, not cached', async () => {
		const { gateway, spy } = scripted(() => jsonResponse(200, { not: 'an array' }));
		const err = await caught(gateway.get(rentals('74201')));
		expect(isGatewayError(err) && err.kind).toBe('SchemaMismatch');
		expect(isGatewayError(err) && err.issues).toEqual(['$:invalid_type']);
		expect((await gateway.usage()).billed).toBe(1);
		expect(await gateway.peek(rentals('74201'))).toBeUndefined();
		await caught(gateway.get(rentals('74201')));
		expect(spy.calls).toHaveLength(2);
		expect((await gateway.usage()).billed).toBe(2);
	});

	it('a missing key throws InvalidKey missing-key with 0 fetches and no pending row', async () => {
		const spy = spyFetch(() => jsonResponse(200, []));
		const db = makeDb();
		const ledger = createLedgerRepo(db, () => T0);
		const gateway = createDataGateway({
			client: createRentCastClient({ fetch: spy.fetch, getKey: () => null }),
			cache: createCacheRepo(db),
			ledger,
			clock: () => T0,
			probeFetch: spy.fetch
		});
		const err = await caught(gateway.get(rentals('74201')));
		expect(isGatewayError(err) && [err.kind, err.detail]).toEqual(['InvalidKey', 'missing-key']);
		expect(spy.calls).toHaveLength(0);
		const usage = await gateway.usage();
		expect([usage.billed, usage.pending]).toEqual([0, 0]);
	});
});

describe('testKey', () => {
	const KEY = 'k'.repeat(32);

	it('404 → valid with one unbilled key-test ledger row', async () => {
		const { gateway, db, spy } = scripted(() => jsonResponse(404, {}));
		const result = await gateway.testKey(KEY);
		expect(result.outcome).toBe('valid');
		expect(spy.calls).toHaveLength(1);
		const rows = await db.ledger.toArray();
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ intent: 'key-test', status: 404, endpoint: 'markets' });
		expect((await gateway.usage()).billed).toBe(0);
	});

	it('200 → valid-billed and billed +1 even at the cap', async () => {
		const { gateway, ready } = scripted(
			(n) => jsonResponse(200, n < 40 ? [] : { zipCode: '00000' }),
			40
		);
		await ready;
		for (let i = 0; i < 40; i++) await gateway.get(rentals(zip(i)));
		const result = await gateway.testKey(KEY);
		expect(result.outcome).toBe('valid-billed');
		expect((await gateway.usage()).billed).toBe(41);
	});

	it('a bad format → 0 fetches and 0 rows', async () => {
		const { gateway, db, spy } = scripted(() => jsonResponse(404, {}));
		const result = await gateway.testKey('short key');
		expect(result.outcome).toBe('bad-format');
		expect(spy.calls).toHaveLength(0);
		expect(await db.ledger.count()).toBe(0);
	});
});

describe('key hygiene', () => {
	it('no ledger row, cache row or thrown error contains the API key', async () => {
		const statuses = [200, 404, 401, 403, 429, 503, 200];
		const { gateway, db, spy } = scripted((n) =>
			statuses[n] === 200
				? jsonResponse(200, n === 0 ? listingRows(2) : { not: 'an array' })
				: jsonResponse(statuses[n]!, { error: 'x' })
		);
		const errors: unknown[] = [];
		for (let i = 0; i < statuses.length; i++) {
			const req: DataRequest = rentals(zip(i));
			const e = await caught(gateway.get(req));
			if (e) errors.push(e);
		}
		expect(spy.calls.every((c) => c.headers['x-api-key'] === TEST_KEY)).toBe(true);
		expect(errors).toHaveLength(6);
		const dump = JSON.stringify({
			ledger: await db.ledger.toArray(),
			cache: await db.apiCache.toArray(),
			errors: errors.map((e) => ({ ...(e as object), message: (e as Error).message }))
		});
		expect(dump).not.toContain(TEST_KEY);
		await gateway.testKey('k'.repeat(32));
		expect(JSON.stringify(await db.ledger.toArray())).not.toContain('k'.repeat(32));
	});
});
