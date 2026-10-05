import { describe, expect, test } from 'vitest';

import { OWNER_LOCAL, SyncableSchema, newSyncable, tombstone, touch } from './syncable.js';

const ID = '00000000-0000-4000-8000-000000000001';
const CREATED = new Date(2026, 9, 1, 9, 30);
const LATER = new Date(2026, 9, 10, 12, 0);

const valid = {
	id: ID,
	ownerId: 'local',
	createdAt: CREATED.toISOString(),
	updatedAt: CREATED.toISOString(),
	schemaVersion: 1
};

describe('SyncableSchema', () => {
	test('accepts a minimal Syncable record', () => {
		expect(SyncableSchema.safeParse(valid).success).toBe(true);
	});

	test('accepts a tombstone and keeps extra fields (loose object)', () => {
		const parsed = SyncableSchema.safeParse({
			...valid,
			deletedAt: LATER.toISOString(),
			title: 'Saved search'
		});
		expect(parsed.success).toBe(true);
		expect(parsed.data).toMatchObject({ title: 'Saved search' });
	});

	test.each([
		['ownerId remote', { ownerId: 'remote' }],
		['non-uuid id', { id: 'abc-123' }],
		['schemaVersion 0', { schemaVersion: 0 }],
		['schemaVersion 1.5', { schemaVersion: 1.5 }],
		['date-only createdAt', { createdAt: '2026-10-04' }],
		['date-only deletedAt', { deletedAt: '2026-10-04' }]
	])('rejects %s', (_label, patch) => {
		expect(SyncableSchema.safeParse({ ...valid, ...patch }).success).toBe(false);
	});

	test.each(['id', 'ownerId', 'createdAt', 'updatedAt', 'schemaVersion'])(
		'rejects a record missing %s',
		(field) => {
			const rec: Record<string, unknown> = { ...valid };
			delete rec[field];
			expect(SyncableSchema.safeParse(rec).success).toBe(false);
		}
	);
});

describe('newSyncable', () => {
	test('stamps createdAt and updatedAt with the same ISO instant and owner local', () => {
		const rec = newSyncable({ id: ID, now: CREATED, schemaVersion: 2 });
		expect(rec).toEqual({
			id: ID,
			ownerId: OWNER_LOCAL,
			createdAt: CREATED.toISOString(),
			updatedAt: CREATED.toISOString(),
			schemaVersion: 2
		});
		expect('deletedAt' in rec).toBe(false);
		expect(SyncableSchema.safeParse(rec).success).toBe(true);
	});
});

describe('touch', () => {
	test('returns a new record with a fresh updatedAt and the original createdAt', () => {
		const rec = { ...newSyncable({ id: ID, now: CREATED, schemaVersion: 1 }), title: 'x' };
		const snapshot = JSON.parse(JSON.stringify(rec)) as typeof rec;
		const next = touch(rec, LATER);
		expect(next).not.toBe(rec);
		expect(next.updatedAt).toBe(LATER.toISOString());
		expect(next.createdAt).toBe(CREATED.toISOString());
		expect(next.title).toBe('x');
		expect(rec).toEqual(snapshot);
	});
});

describe('tombstone', () => {
	test('sets deletedAt and updatedAt without mutating the input', () => {
		const rec = newSyncable({ id: ID, now: CREATED, schemaVersion: 1 });
		const snapshot = JSON.parse(JSON.stringify(rec)) as typeof rec;
		const dead = tombstone(rec, LATER);
		expect(dead).not.toBe(rec);
		expect(dead.deletedAt).toBe(LATER.toISOString());
		expect(dead.updatedAt).toBe(LATER.toISOString());
		expect(dead.createdAt).toBe(CREATED.toISOString());
		expect(rec).toEqual(snapshot);
		expect(SyncableSchema.safeParse(dead).success).toBe(true);
	});
});

describe('ISO ordering', () => {
	test('toISOString() strings compare like the instants they encode', () => {
		const a = new Date(2026, 0, 2, 3, 4).toISOString();
		const b = new Date(2026, 10, 2, 3, 4).toISOString();
		expect(a < b).toBe(true);
	});
});
