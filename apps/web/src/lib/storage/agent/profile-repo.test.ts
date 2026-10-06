// Agent profile repository (08-12): singleton upsert, validation, access key.
// fake-indexeddb with a fresh IDBFactory per test (freshIdb) through the getDb() singleton.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EMPTY_PROFILE_INPUT, type ProfileInput } from '@tran/core/agent/types';
import { SAMPLE_AGENT_PROFILE } from '@tran/core/agent/fixtures/sample-profile';
import { _resetDb, getDb } from '$lib/storage/db';
import { freshIdb } from '$lib/storage/test-utils';
import { getProfile, saveAccessKey, saveProfile } from './profile-repo';
import { PROFILE_ROW_ID } from './tables';

const T1 = '2026-10-06T12:00:00.000Z';
const T2 = '2026-10-07T09:30:00.000Z';
const KEY = '00000000-0000-4000-8000-000000000000';

beforeEach(() => {
	_resetDb();
	getDb(freshIdb());
});
afterEach(() => _resetDb());

function fullInput(): ProfileInput {
	return {
		...SAMPLE_AGENT_PROFILE,
		postal: { ...SAMPLE_AGENT_PROFILE.postal },
		brandPrimary: '#8A3B12',
		brandAccent: '#E9D8C4',
		logo: { base64: 'iVBORw0KGgo=', mime: 'image/png', width: 64, height: 32, bytes: 8 },
		web3formsAccessKey: KEY
	};
}

describe('profile repo', () => {
	it('returns null before anything is saved', async () => {
		expect(await getProfile()).toBeNull();
	});

	it('round-trips every field, including the logo', async () => {
		const input = fullInput();
		const saved = await saveProfile(input, T1);
		const got = await getProfile();
		expect(got).toEqual(saved);
		expect(got).toMatchObject({ ...input, id: 'profile', createdAt: T1, updatedAt: T1 });
		expect(got?.logo).toEqual({
			base64: 'iVBORw0KGgo=',
			mime: 'image/png',
			width: 64,
			height: 32,
			bytes: 8
		});
		expect(got?.deletedAt).toBeUndefined();
	});

	it('stores the singleton under the fixed uuid row id', async () => {
		await saveProfile(fullInput(), T1);
		const rows = await getDb().agentProfile.toArray();
		expect(rows.map((r) => r.id)).toEqual([PROFILE_ROW_ID]);
	});

	it('a second save keeps createdAt and moves updatedAt', async () => {
		await saveProfile(fullInput(), T1);
		const second = await saveProfile({ ...fullInput(), name: 'Avery Example' }, T2);
		expect(second).toMatchObject({ createdAt: T1, updatedAt: T2, name: 'Avery Example' });
		expect(await getDb().agentProfile.count()).toBe(1);
	});

	it('cleans text fields', async () => {
		const p = await saveProfile({ ...fullInput(), name: '  Avery \u200bSample  ' }, T1);
		expect(p.name).toBe('Avery Sample');
	});

	it("rejects an invalid brand color ('#abc')", async () => {
		await expect(saveProfile({ ...fullInput(), brandPrimary: '#abc' }, T1)).rejects.toThrow(
			'profile-invalid'
		);
		expect(await getProfile()).toBeNull();
	});

	it('saveAccessKey creates the profile from the empty input and lowercases the key', async () => {
		const p = await saveAccessKey(KEY.toUpperCase().replace(/0/g, 'A'), T1);
		expect(p.web3formsAccessKey).toBe(KEY.replace(/0/g, 'a'));
		expect(p).toMatchObject({ ...EMPTY_PROFILE_INPUT, web3formsAccessKey: p.web3formsAccessKey });
		expect(await getProfile()).toEqual(p);
	});

	it('saveAccessKey stores the key on an existing profile without touching other fields', async () => {
		await saveProfile(fullInput(), T1);
		const p = await saveAccessKey(KEY, T2);
		expect(p).toMatchObject({ name: SAMPLE_AGENT_PROFILE.name, web3formsAccessKey: KEY });
		expect(p.createdAt).toBe(T1);
	});

	it("saveAccessKey('nope') rejects and writes nothing", async () => {
		await expect(saveAccessKey('nope', T1)).rejects.toThrow('access-key-invalid');
		expect(await getProfile()).toBeNull();
	});
});
