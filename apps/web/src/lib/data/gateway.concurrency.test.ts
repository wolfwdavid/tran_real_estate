// Concurrency guards (mutation-checked, see 04-13-SUMMARY.md):
// - in-flight dedupe: identical concurrent gets share one fetch and one ledger row
// - serial queue: one gateway never has two RentCast requests in flight at once
// - cross-instance: two gateways (two tabs) on one IndexedDB at 39/40 make exactly 1 fetch
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { afterEach, describe, expect, it } from 'vitest';
import { isGatewayError } from '@tran/core/request';
import { createDataDb, type DataDb } from './platform';
import { jsonResponse, spyFetch, T0 } from './testing/harness';
import { makeGateway, rentals } from './testing/gateway-harness';

const open: DataDb[] = [];
afterEach(() => {
	for (const db of open.splice(0)) db.close();
});

const tick = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** A fetch that stays open for `ms` and records the peak number of concurrent requests. */
function slowFetch(ms = 5) {
	let active = 0;
	const stats = { peak: 0 };
	const spy = spyFetch(async () => {
		active += 1;
		stats.peak = Math.max(stats.peak, active);
		await tick(ms);
		active -= 1;
		return jsonResponse(200, []);
	});
	return { ...spy, stats };
}

describe('within one gateway', () => {
	it('dedupes 5 identical concurrent gets into 1 fetch and 1 ledger row', async () => {
		const spy = slowFetch();
		const { gateway, db } = makeGateway({ fetch: spy.fetch, clock: () => T0 });
		const results = await Promise.all(
			Array.from({ length: 5 }, () => gateway.get(rentals('74201')))
		);
		expect(spy.calls).toHaveLength(1);
		expect(await db.ledger.count()).toBe(1);
		expect(new Set(results.map((r) => r.requestKey)).size).toBe(1);
	});

	it('serializes distinct spends: never two requests in flight', async () => {
		const spy = slowFetch();
		const { gateway } = makeGateway({ fetch: spy.fetch, clock: () => T0 });
		await Promise.all(['74201', '74202', '74203', '74204'].map((z) => gateway.get(rentals(z))));
		expect(spy.calls).toHaveLength(4);
		expect(spy.stats.peak).toBe(1);
	});

	it('a failed spend does not stall the queue', async () => {
		let n = 0;
		const spy = spyFetch(() => jsonResponse(n++ === 0 ? 503 : 200, []));
		const { gateway } = makeGateway({ fetch: spy.fetch, clock: () => T0 });
		const settled = await Promise.allSettled([
			gateway.get(rentals('74201')),
			gateway.get(rentals('74202'))
		]);
		expect(settled.map((s) => s.status)).toEqual(['rejected', 'fulfilled']);
	});
});

describe('across gateway instances (two tabs)', () => {
	/** Two gateways whose DataDbs share one IDBFactory and DB name, seeded to `used` billed calls. */
	async function twoTabs(used: number, cap: number) {
		const indexedDB = new IDBFactory();
		const name = `gw-race-${crypto.randomUUID()}`;
		const dbA = createDataDb({ name, indexedDB, IDBKeyRange });
		const dbB = createDataDb({ name, indexedDB, IDBKeyRange });
		open.push(dbA, dbB);
		const spyA = slowFetch(1);
		const spyB = slowFetch(1);
		const a = makeGateway({ fetch: spyA.fetch, clock: () => T0, db: dbA, cap });
		const b = makeGateway({ fetch: spyB.fetch, clock: () => T0, db: dbB });
		await a.ready;
		for (let i = 0; i < used; i++) {
			await a.ledger.record({ endpoint: 'rental-listings', key: `seed-${i}`, intent: 'user' }, 200);
		}
		await dbB.open();
		return { a: a.gateway, b: b.gateway, fetches: () => spyA.calls.length + spyB.calls.length };
	}

	it('at 39/40, two tabs firing together make exactly 1 fetch', async () => {
		const { a, b, fetches } = await twoTabs(39, 40);
		const results = await Promise.allSettled([a.get(rentals('74201')), b.get(rentals('74202'))]);
		expect(fetches()).toBe(1);
		const fulfilled = results.filter((r) => r.status === 'fulfilled');
		const rejected = results.filter((r) => r.status === 'rejected');
		expect(fulfilled).toHaveLength(1);
		expect(rejected).toHaveLength(1);
		const reason: unknown = (rejected[0] as PromiseRejectedResult).reason;
		expect(isGatewayError(reason) && reason.kind).toBe('BudgetCapReached');
		expect((await a.usage()).billed).toBe(40);
	});

	it('holds over 10 fresh races', async () => {
		for (let i = 0; i < 10; i++) {
			const { a, b, fetches } = await twoTabs(39, 40);
			await Promise.allSettled([a.get(rentals('74201')), b.get(rentals('74202'))]);
			expect(fetches()).toBe(1);
		}
	});

	it('is not trivially rejecting: at 38/40 both tabs fetch', async () => {
		const { a, b, fetches } = await twoTabs(38, 40);
		const results = await Promise.allSettled([a.get(rentals('74201')), b.get(rentals('74202'))]);
		expect(results.map((r) => r.status)).toEqual(['fulfilled', 'fulfilled']);
		expect(fetches()).toBe(2);
	});

	it('a tab reads the other tab’s fresh cache for 0 calls', async () => {
		const { a, b, fetches } = await twoTabs(0, 40);
		await a.get(rentals('74201'));
		await b.get(rentals('74201'));
		expect(fetches()).toBe(1);
	});
});
