// Two tabs racing for the last call under the cap. Two DataDb connections share one IDBFactory
// (= one browser profile), so IndexedDB must serialize their rw transactions. This test fails if
// the usage/cap read in reserve() is moved out of the transaction that appends the row
// (mutation proof recorded in 04-11-SUMMARY.md).
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { afterEach, describe, expect, it } from 'vitest';
import { isGatewayError } from '@tran/core/request';
import { createDataDb, type DataDb } from './platform';
import { createLedgerRepo, type LedgerRepo, type SpendRequest } from './ledger-repo';
import { T0 } from './testing/harness';

const open: DataDb[] = [];
afterEach(() => {
	for (const db of open.splice(0)) db.close();
});

const req = (key: string): SpendRequest => ({ endpoint: 'rental-listings', key, intent: 'user' });

/** Two connections (two "tabs") on one database, seeded with `used` settled 200 rows and `cap`. */
async function twoTabs(used: number, cap: number): Promise<[LedgerRepo, LedgerRepo, DataDb]> {
	const indexedDB = new IDBFactory();
	const name = `race-${crypto.randomUUID()}`;
	const dbA = createDataDb({ name, indexedDB, IDBKeyRange });
	const dbB = createDataDb({ name, indexedDB, IDBKeyRange });
	open.push(dbA, dbB);
	const clock = () => T0;
	const a = createLedgerRepo(dbA, clock);
	const b = createLedgerRepo(dbB, clock);
	await a.writeCap(cap);
	for (let i = 0; i < used; i++) await a.settle(await a.reserve(req(`seed-${i}`)), 200);
	await dbB.open();
	return [a, b, dbA];
}

async function race(used: number, cap: number) {
	const [a, b, db] = await twoTabs(used, cap);
	const results = await Promise.allSettled([a.reserve(req('tab-a')), b.reserve(req('tab-b'))]);
	return { results, rows: await db.ledger.count() };
}

describe('cap reservation across connections', () => {
	it('two tabs at 39/40: exactly one takes call #40', async () => {
		const { results, rows } = await race(39, 40);
		const fulfilled = results.filter((r) => r.status === 'fulfilled');
		const rejected = results.filter((r) => r.status === 'rejected');
		expect(fulfilled).toHaveLength(1);
		expect(rejected).toHaveLength(1);
		const reason: unknown = rejected[0]!.reason;
		expect(isGatewayError(reason) && reason.kind).toBe('BudgetCapReached');
		expect(rows).toBe(40);
	});

	it('holds over 20 fresh races', async () => {
		for (let i = 0; i < 20; i++) {
			const { results, rows } = await race(39, 40);
			expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
			expect(rows).toBe(40);
		}
	});

	it('is not trivially rejecting: cap 41 at 39 lets both through', async () => {
		const { results, rows } = await race(39, 41);
		expect(results.map((r) => r.status)).toEqual(['fulfilled', 'fulfilled']);
		expect(rows).toBe(41);
	});
});
