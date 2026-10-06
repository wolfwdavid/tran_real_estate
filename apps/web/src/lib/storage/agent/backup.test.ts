// Agent CRM backup registration (08-12): the four tables and labels, the key-free scan with a
// large logo and a Web3Forms access key present, a planted provider key still refused, and an
// export -> import (merge) round trip. fake-indexeddb, fresh IDBFactory per database.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { BackupError, findKeyMaterial } from '@tran/core';
import type { Activity, Contact, Task } from '@tran/core/agent/types';
import { SAMPLE_AGENT_PROFILE } from '@tran/core/agent/fixtures/sample-profile';
import { applyImport, buildBackupText, previewImport } from '$lib/storage/backup';
import {
	BACKUP_EXCLUDED_TABLES,
	listBackupTables,
	_resetBackupRegistry
} from '$lib/storage/backup-registry';
import { TranDb, _resetDb, getDb } from '$lib/storage/db';
import { freshIdb } from '$lib/storage/test-utils';
import { fakeKey } from '../../../../tests/support/fake-keys';
import { getProfile, saveProfile } from './profile-repo';
import { PROFILE_ROW_ID } from './tables';

const T1 = '2026-10-06T12:00:00.000Z';
const ACCESS_KEY = '00000000-0000-4000-8000-000000000000';
const CONTACT_ID = '11111111-1111-4111-8111-111111111111';

const extra: TranDb[] = [];
beforeEach(() => {
	_resetDb();
	getDb(freshIdb());
});
afterEach(() => {
	_resetDb();
	for (const db of extra.splice(0)) db.close();
	_resetBackupRegistry();
});

const rowBase = (id: string) => ({
	id,
	ownerId: 'local' as const,
	createdAt: T1,
	updatedAt: T1,
	schemaVersion: 1
});

function contact(notes = ''): Contact {
	return {
		...rowBase(CONTACT_ID),
		name: 'Jordan Example',
		email: 'jo@example.com',
		emailNorm: 'jo@example.com',
		phone: '(555) 555-0142',
		phoneNorm: '+15555550142',
		stage: 'new',
		stageChangedAt: T1,
		source: 'manual',
		propertyOfInterest: '12 Sample Lane',
		notes,
		consentSource: 'unknown',
		emailOptOutAt: null,
		lastContactedAt: null,
		sample: false
	};
}

const task: Task = {
	...rowBase('22222222-2222-4222-8222-222222222222'),
	contactId: CONTACT_ID,
	title: 'Call back',
	dueDate: '2026-10-07',
	status: 'open',
	doneAt: null,
	sample: false
};

const activity: Activity = {
	...rowBase('33333333-3333-4333-8333-333333333333'),
	contactId: CONTACT_ID,
	type: 'added',
	text: 'Added by hand',
	at: T1,
	sample: false
};

/**
 * ~300 KB of synthetic base64 "logo" bytes. It deliberately contains a run shaped like a Gemini
 * key (assembled at runtime, so no literal in this file matches a key pattern): random base64 can
 * produce exactly that, and the profile's logo path must not make the export refuse.
 */
function bigLogoBase64(): string {
	const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
	let s = '';
	for (let i = 0; s.length < 400_000; i++) s += alphabet[(i * 7919) % 64];
	return s.slice(0, 200_000) + fakeKey('gemini', 'Q') + s.slice(200_000, 399_960);
}

async function seed(notes = '') {
	const db = getDb();
	await saveProfile(
		{
			...SAMPLE_AGENT_PROFILE,
			logo: {
				base64: bigLogoBase64(),
				mime: 'image/png',
				width: 1024,
				height: 512,
				bytes: 300_000
			},
			web3formsAccessKey: ACCESS_KEY
		},
		T1
	);
	await db.contacts.put(contact(notes));
	await db.tasks.put(task);
	await db.activities.put(activity);
	return db;
}

const file = (text: string) => ({
	name: 'tran-backup.json',
	size: text.length,
	text: async () => text
});

describe('agent backup registration', () => {
	it('registers the four agent tables with their labels and record schemas', () => {
		const byName = new Map(listBackupTables().map((t) => [t.name, t]));
		expect(byName.get('contacts')?.label).toBe('Contacts');
		expect(byName.get('tasks')?.label).toBe('Tasks');
		expect(byName.get('activities')?.label).toBe('Activity');
		expect(byName.get('agentProfile')?.label).toBe('Agent profile');
		for (const n of ['contacts', 'tasks', 'activities', 'agentProfile']) {
			expect(byName.get(n)?.schema, n).toBeDefined();
			expect(BACKUP_EXCLUDED_TABLES).not.toContain(n);
		}
		expect(byName.get('agentProfile')?.scanExemptPaths).toEqual([
			'logo.base64',
			'web3formsAccessKey'
		]);
	});

	it('a backup with a 300 KB logo and the Web3Forms access key passes the key-free scan', async () => {
		const db = await seed();
		const { text, counts } = await buildBackupText(db, { now: new Date(T1), knownSecrets: [] });
		expect(counts).toMatchObject({ contacts: 1, tasks: 1, activities: 1, agentProfile: 1 });
		// The file really carries both values, and the raw text alone WOULD trip the shape scan:
		// only the two declared profile paths are exempt.
		expect(text).toContain(ACCESS_KEY);
		expect(text).toContain(fakeKey('gemini', 'Q'));
		expect(findKeyMaterial(text, [])).toEqual(['gemini']);
	});

	it('refuses a backup with a planted provider key in a contact note', async () => {
		const db = await seed(`call me, ${fakeKey('anthropic')}`);
		const err = await buildBackupText(db, { now: new Date(T1), knownSecrets: [] }).catch((e) => e);
		expect(err).toBeInstanceOf(BackupError);
		expect((err as BackupError).code).toBe('key-material');
	});

	it('the exemption is per path: a key-shaped value in a contact note still fails', async () => {
		const db = await seed(fakeKey('gemini', 'Q'));
		await expect(buildBackupText(db, { now: new Date(T1), knownSecrets: [] })).rejects.toThrow();
	});

	it('the exemption does not hide an exact vault value elsewhere in the profile', async () => {
		const db = await seed();
		const vaultValue = 'rc-vault-value-0123456789';
		await saveProfile(
			{ ...SAMPLE_AGENT_PROFILE, website: `https://example.com/${vaultValue}` },
			T1
		);
		await expect(
			buildBackupText(db, { now: new Date(T1), knownSecrets: [vaultValue] })
		).rejects.toThrow();
	});

	it('export -> import (merge) restores contacts, tasks, activities and the profile identically', async () => {
		const db = await seed();
		const profile = await getProfile();
		const { text } = await buildBackupText(db, { now: new Date(T1), knownSecrets: [] });

		const fresh = new TranDb(
			{ indexedDB: new IDBFactory(), IDBKeyRange },
			`t-${crypto.randomUUID()}`
		);
		extra.push(fresh);
		const preview = await previewImport(fresh, file(text));
		await applyImport(fresh, preview, 'merge');

		expect(await fresh.contacts.toArray()).toEqual(await db.contacts.toArray());
		expect(await fresh.tasks.toArray()).toEqual([task]);
		expect(await fresh.activities.toArray()).toEqual([activity]);
		const row = await fresh.agentProfile.get(PROFILE_ROW_ID);
		expect({ ...row, id: 'profile' }).toEqual(profile);
	});
});
