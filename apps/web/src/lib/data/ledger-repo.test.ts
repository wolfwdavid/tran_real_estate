// Ledger repository: reserve-then-settle under the cap, derived billing, single-use over-cap grants.
// Clock is an injected variable; fake timers are never used with fake-indexeddb (RESEARCH Pitfall 1).
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isGatewayError, type GatewayError } from '@tran/core/request';
import { DEFAULT_CAP } from '@tran/core/budget';
import type { DataDb } from './platform';
import { issueGrant, type OverCapGrant } from './grants';
import { createLedgerRepo, hasSavedCap, type LedgerRepo, type SpendRequest } from './ledger-repo';
import { T0, TEST_KEY, makeDb } from './testing/harness';

let db: DataDb;
let now: number;
let repo: LedgerRepo;

const req = (key = 'rental-listings?city=Austin', intent: SpendRequest['intent'] = 'user') =>
	({ endpoint: 'rental-listings', key, intent }) satisfies SpendRequest;

beforeEach(() => {
	db = makeDb();
	now = T0;
	repo = createLedgerRepo(db, () => now);
});
afterEach(() => db.close());

async function spend(n: number, status = 200): Promise<void> {
	for (let i = 0; i < n; i++) await repo.settle(await repo.reserve(req(`k${i}`)), status);
}

async function capError(p: Promise<unknown>): Promise<GatewayError> {
	try {
		await p;
	} catch (e) {
		if (isGatewayError(e)) return e;
		throw e;
	}
	throw new Error('expected a BudgetCapReached rejection');
}

describe('cap preference', () => {
	it('hasSavedCap is false until a cap is written, even one equal to the default', async () => {
		expect(await hasSavedCap(db)).toBe(false);
		await repo.writeCap(40);
		expect(await hasSavedCap(db)).toBe(true);
	});

	it('defaults to 40 and round-trips a written cap', async () => {
		expect(DEFAULT_CAP).toBe(40);
		expect(await repo.readCap()).toBe(40);
		await repo.writeCap(25);
		expect(await repo.readCap()).toBe(25);
	});

	it('rejects caps outside 1..1000 or non-integers', async () => {
		for (const bad of [0, 1001, 4.5, -3, Number.NaN]) {
			await expect(repo.writeCap(bad)).rejects.toBeInstanceOf(RangeError);
		}
		expect(await repo.readCap()).toBe(40);
	});

	it('stores the cap as a Syncable data-pref row with the fixed id and ISO updatedAt', async () => {
		await repo.writeCap(30);
		const row = await db.dataPrefs.get('rentcastCap');
		expect(row?.id).toBe('6f1c2b1e-4b8a-4d0e-9a51-3c7d2e8f4a01');
		expect(row?.value).toBe(30);
		expect(typeof row?.updatedAt).toBe('string');
		expect(row?.updatedAt).toBe(new Date(T0).toISOString());
	});
});

describe('reserve and settle', () => {
	it('allows exactly cap calls, then throws BudgetCapReached and writes no row', async () => {
		await spend(40);
		const err = await capError(repo.reserve(req('k40')));
		expect(err.kind).toBe('BudgetCapReached');
		expect(err.used).toBe(40);
		expect(err.cap).toBe(40);
		expect(err.resetsAt).toBe(Date.parse('2026-11-01T00:00:00.000Z'));
		expect(err.requestKey).toBe('k40');
		expect(await db.ledger.count()).toBe(40);
	});

	it('counts a reserved-but-unsettled row toward the cap', async () => {
		await spend(39);
		await repo.reserve(req('pending'));
		const err = await capError(repo.reserve(req('next')));
		expect(err.kind).toBe('BudgetCapReached');
		expect(err.used).toBe(40);
	});

	it('counts a pending row older than 120 s as billed', async () => {
		await repo.reserve(req());
		expect((await repo.usage()).pending).toBe(1);
		now = T0 + 120_001;
		const u = await repo.usage();
		expect(u.billed).toBe(1);
		expect(u.pending).toBe(0);
	});

	it('derives noResults and failed from the settled status', async () => {
		await repo.settle(await repo.reserve(req('a')), 404);
		let u = await repo.usage();
		expect(u.noResults).toBe(1);
		expect(u.billed).toBe(0);
		await repo.settle(await repo.reserve(req('b')), 0);
		u = await repo.usage();
		expect(u.failed).toBe(1);
		expect(u.billed).toBe(0);
	});

	it('settle records status, settledAt and a fresh ISO updatedAt', async () => {
		const id = await repo.reserve(req());
		now = T0 + 5_000;
		await repo.settle(id, 200);
		const row = await db.ledger.get(id);
		expect(row?.status).toBe(200);
		expect(row?.settledAt).toBe(T0 + 5_000);
		expect(row?.updatedAt).toBe(new Date(T0 + 5_000).toISOString());
		expect(row?.createdAt).toBe(new Date(T0).toISOString());
	});

	it('never stores a billed flag; status is a number or pending', async () => {
		await spend(3);
		await repo.settle(await repo.reserve(req('x')), 404);
		await repo.reserve(req('y'));
		const rows = await db.ledger.toArray();
		expect(rows).toHaveLength(5);
		for (const row of rows) {
			expect('billed' in row).toBe(false);
			expect(row.status === 'pending' || typeof row.status === 'number').toBe(true);
			expect(row.periodKey).toBe('2026-10');
			expect(row.ownerId).toBe('local');
			expect(row.schemaVersion).toBe(1);
		}
	});

	it('starts a new period on the first of the next UTC month', async () => {
		await spend(40);
		now = Date.parse('2026-11-01T00:00:00.000Z');
		const u = await repo.usage();
		expect(u.billed).toBe(0);
		expect(u.periodKey).toBe('2026-11');
		expect(u.resetsAt).toBe(Date.parse('2026-12-01T00:00:00.000Z'));
		await expect(repo.reserve(req('new'))).resolves.toBeTypeOf('string');
	});

	it('usage reports cap, period and reset instant', async () => {
		await repo.writeCap(12);
		await spend(2);
		const u = await repo.usage();
		expect(u).toMatchObject({
			billed: 2,
			countedTowardCap: 2,
			cap: 12,
			periodKey: '2026-10',
			resetsAt: Date.parse('2026-11-01T00:00:00.000Z')
		});
	});
});

describe('over-cap grants', () => {
	it('an issued grant for the same key allows one call past the cap', async () => {
		await spend(40);
		const grant = issueGrant('over');
		const id = await repo.reserve(req('over'), grant);
		const row = await db.ledger.get(id);
		expect(row?.overCap).toBe(true);
		expect(grant.consumed).toBe(true);
	});

	it('a reused grant is rejected', async () => {
		await spend(40);
		const grant = issueGrant('over');
		await repo.reserve(req('over'), grant);
		expect((await capError(repo.reserve(req('over'), grant))).kind).toBe('BudgetCapReached');
	});

	it('a grant for another key is rejected', async () => {
		await spend(40);
		const grant = issueGrant('A');
		expect((await capError(repo.reserve(req('B'), grant))).kind).toBe('BudgetCapReached');
		expect(grant.consumed).toBe(false);
	});

	it('a forged grant literal is rejected', async () => {
		await spend(40);
		const forged = { requestKey: 'over', consumed: false } as OverCapGrant;
		expect((await capError(repo.reserve(req('over'), forged))).kind).toBe('BudgetCapReached');
		expect(await db.ledger.count()).toBe(40);
	});

	it('a grant is not consumed when the call is within the cap', async () => {
		const grant = issueGrant('k');
		const id = await repo.reserve(req('k'), grant);
		expect((await db.ledger.get(id))?.overCap).toBe(false);
		expect(grant.consumed).toBe(false);
	});
});

describe('record (key tests)', () => {
	it('adds an already-settled row even at the cap', async () => {
		await spend(40);
		const id = await repo.record(req('key-test', 'key-test'), 200);
		const row = await db.ledger.get(id);
		expect(row?.status).toBe(200);
		expect(row?.intent).toBe('key-test');
		expect(row?.settledAt).toBe(T0);
		expect((await repo.usage()).billed).toBe(41);
	});

	it('a no-results key test is not a search: noResults stays 0 while a 404 search counts', async () => {
		await repo.record(req('key-test', 'key-test'), 404);
		let u = await repo.usage();
		expect(u.noResults).toBe(0);
		expect(u.billed).toBe(0);
		expect(u.countedTowardCap).toBe(0);
		await repo.settle(await repo.reserve(req('search')), 404);
		u = await repo.usage();
		expect(u.noResults).toBe(1);
		expect(u.billed).toBe(0);
	});
});

describe('secrets', () => {
	it('no ledger or pref row contains the API key', async () => {
		await spend(2);
		await repo.record(req('key-test', 'key-test'), 401);
		await repo.writeCap(20);
		const dump = JSON.stringify([await db.ledger.toArray(), await db.dataPrefs.toArray()]);
		expect(dump).not.toContain(TEST_KEY);
	});
});
