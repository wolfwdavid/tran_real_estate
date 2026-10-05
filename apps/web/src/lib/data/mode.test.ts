// Mode resolution (which data source is active) and the persisted data-source preference (DATA-01).
import { describe, expect, it } from 'vitest';
import { resolveMode, type DataMode, type ModeReason } from './mode';
import type { RentCastKeyState } from './platform';
import { createPrefsRepo } from './prefs-repo';
import { DATA_PREF_IDS, type DataSourcePref } from './tables';
import { makeDb, T0 } from './testing/harness';

describe('resolveMode', () => {
	const table: [RentCastKeyState, DataSourcePref, DataMode, ModeReason][] = [
		['none', 'rentcast', 'sample', 'no-key'],
		['none', 'sample', 'sample', 'no-key'],
		['locked', 'rentcast', 'sample', 'locked'],
		['locked', 'sample', 'sample', 'locked'],
		['available', 'sample', 'sample', 'chosen'],
		['available', 'rentcast', 'rentcast', 'live']
	];

	it.each(table)('key %s + preference %s -> %s (%s)', (keyState, preference, source, reason) => {
		expect(resolveMode({ keyState, preference })).toEqual({ source, reason });
	});

	it('is pure: same input, same output, input untouched', () => {
		const input = Object.freeze({
			keyState: 'available' as const,
			preference: 'rentcast' as const
		});
		expect(resolveMode(input)).toEqual(resolveMode(input));
	});
});

describe('prefs repo', () => {
	it('defaults to rentcast on a fresh database', async () => {
		const repo = createPrefsRepo(makeDb(), () => T0);
		expect(await repo.readSource()).toBe('rentcast');
	});

	it('round-trips sample and back', async () => {
		const repo = createPrefsRepo(makeDb(), () => T0);
		await repo.writeSource('sample');
		expect(await repo.readSource()).toBe('sample');
		await repo.writeSource('rentcast');
		expect(await repo.readSource()).toBe('rentcast');
	});

	it('stores a Syncable dataSource row with the fixed id and the clock as ISO updatedAt', async () => {
		const db = makeDb();
		let now = T0;
		const repo = createPrefsRepo(db, () => now);
		await repo.writeSource('sample');
		const row = await db.dataPrefs.get('dataSource');
		expect(row).toMatchObject({
			id: DATA_PREF_IDS.dataSource,
			key: 'dataSource',
			value: 'sample',
			updatedAt: new Date(T0).toISOString()
		});
		const createdAt = row?.createdAt;

		now = T0 + 60_000;
		await repo.writeSource('rentcast');
		const next = await db.dataPrefs.get('dataSource');
		expect(next?.updatedAt).toBe(new Date(T0 + 60_000).toISOString());
		// Rewrites keep the original record identity (backup merge-by-id).
		expect(next?.createdAt).toBe(createdAt);
		expect(await db.dataPrefs.count()).toBe(1);
	});

	it('rejects anything other than rentcast or sample with TypeError and writes nothing', async () => {
		const db = makeDb();
		const repo = createPrefsRepo(db, () => T0);
		for (const bad of ['live', '', 'SAMPLE', null, undefined, 1]) {
			await expect(repo.writeSource(bad as unknown as DataSourcePref)).rejects.toBeInstanceOf(
				TypeError
			);
		}
		expect(await db.dataPrefs.count()).toBe(0);
		expect(await repo.readSource()).toBe('rentcast');
	});

	it('does not disturb the cap preference row', async () => {
		const db = makeDb();
		const repo = createPrefsRepo(db, () => T0);
		await repo.writeSource('sample');
		expect(await db.dataPrefs.get('rentcastCap')).toBeUndefined();
	});
});
