import { describe, expect, it } from 'vitest';
import { IV_BYTES, SALT_BYTES, open, seal } from './crypto';
import {
	COOLDOWN_BASE_MS,
	COOLDOWN_CAP_MS,
	LOCK_MAX_ATTEMPTS,
	LOCK_MIN_LENGTH,
	cooldownFor,
	createLock,
	exportDek,
	importDek,
	rewrap,
	unwrapDek
} from './lock';

// Passphrases are assembled at runtime so no literal secret-shaped string sits in the source.
const PASS = ['correct', 'horse', 'battery', 'staple'].join(' ');
const OTHER = ['tranquil', 'otter', 'reading', 'maps'].join(' ');
const LOW = 1000;

const rejects = async (p: Promise<unknown>) => {
	try {
		await p;
	} catch {
		return true;
	}
	return false;
};

describe('lock constants and cooldown schedule', () => {
	it('uses a 12-character minimum and 5 free attempts', () => {
		expect(LOCK_MIN_LENGTH).toBe(12);
		expect(LOCK_MAX_ATTEMPTS).toBe(5);
		expect(COOLDOWN_BASE_MS).toBe(30_000);
		expect(COOLDOWN_CAP_MS).toBe(300_000);
	});

	it.each([
		[0, 0],
		[1, 0],
		[4, 0],
		[5, 30_000],
		[6, 60_000],
		[7, 120_000],
		[8, 240_000],
		[9, 300_000],
		[20, 300_000]
	])('cooldownFor(%i) === %i', (failed, ms) => {
		expect(cooldownFor(failed)).toBe(ms);
	});
});

describe('createLock / unwrapDek / rewrap', () => {
	it('creates a v1 PBKDF2 record with a wrapped data key and a zeroed counter', async () => {
		const { record, dek } = await createLock(PASS, LOW);
		expect(record.id).toBe('vault');
		expect(record.v).toBe(1);
		expect(record.kdf).toBe('PBKDF2-SHA256');
		expect(record.iterations).toBe(LOW);
		expect(record.salt).toBeInstanceOf(Uint8Array);
		expect(record.salt.byteLength).toBe(SALT_BYTES);
		expect(record.wrapped.iv.byteLength).toBe(IV_BYTES);
		expect(record.wrapped.ct.byteLength).toBeGreaterThan(32);
		expect(record.failedAttempts).toBe(0);
		expect(record.cooldownUntil).toBeNull();
		expect(dek.algorithm.name).toBe('AES-GCM');
		const box = await seal(dek, 'hello', 'aad');
		expect(await open(dek, box, 'aad')).toBe('hello');
	});

	it('unwraps the same data key with the right passphrase and rejects a wrong one', async () => {
		const { record, dek } = await createLock(PASS, LOW);
		const box = await seal(dek, 'payload', 'aad');
		const again = await unwrapDek(record, PASS);
		expect(await open(again, box, 'aad')).toBe('payload');
		expect(await rejects(unwrapDek(record, OTHER))).toBe(true);
	});

	it('rewrap uses a new salt and box; only the new passphrase opens it', async () => {
		const { record, dek } = await createLock(PASS, LOW);
		const box = await seal(dek, 'payload', 'aad');
		const next = await rewrap(record, dek, OTHER, LOW);
		expect(Array.from(next.salt)).not.toEqual(Array.from(record.salt));
		expect(Array.from(next.wrapped.ct)).not.toEqual(Array.from(record.wrapped.ct));
		expect(Array.from(next.wrapped.iv)).not.toEqual(Array.from(record.wrapped.iv));
		const k = await unwrapDek(next, OTHER);
		expect(await open(k, box, 'aad')).toBe('payload');
		expect(await rejects(unwrapDek(next, PASS))).toBe(true);
	});

	it('exportDek / importDek round-trip the data key as base64', async () => {
		const { dek } = await createLock(PASS, LOW);
		const b64 = await exportDek(dek);
		expect(b64).toMatch(/^[A-Za-z0-9+/]+=*$/);
		expect(atob(b64).length).toBe(32);
		const back = await importDek(b64);
		const box = await seal(dek, 'payload', 'aad');
		expect(await open(back, box, 'aad')).toBe('payload');
	});
});
