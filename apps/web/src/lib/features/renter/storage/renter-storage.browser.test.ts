// liveCount in real Chromium IndexedDB: Dexie liveQuery does not emit under fake-indexeddb in the
// Node project, so the nav-badge observable is proven here.
import { afterEach, describe, expect, it } from 'vitest';
import { TranDb } from '$lib/storage/db';
import { createShortlistRepo } from './shortlist-repo';

const T0 = Date.parse('2026-10-15T12:00:00.000Z');

const teardown: (() => Promise<void>)[] = [];
afterEach(async () => {
	while (teardown.length) await teardown.pop()!();
});

async function until(seen: number[], n: number) {
	for (let i = 0; i < 200 && seen.at(-1) !== n; i++) await new Promise((r) => setTimeout(r, 5));
	expect(seen.at(-1)).toBe(n);
}

describe('shortlist liveCount', () => {
	it('emits the live count and follows add / remove / restore', async () => {
		const db = new TranDb({}, `renter-${crypto.randomUUID()}`);
		teardown.push(() => db.delete());
		const repo = createShortlistRepo(db, () => T0);
		const seen: number[] = [];
		const sub = repo.liveCount().subscribe((n) => seen.push(n));
		teardown.push(async () => sub.unsubscribe());

		await until(seen, 0);
		const listing = { id: 'L1', price: 1500 };
		const prov = { source: 'sample' as const, fetchedAt: T0 };
		await repo.add(listing, prov);
		await until(seen, 1);
		await repo.add({ id: 'L2', price: 1600 }, prov);
		await until(seen, 2);
		await repo.remove('L1');
		await until(seen, 1);
		await repo.add(listing, prov);
		await until(seen, 2);
		expect(seen[0]).toBe(0);
	});
});
