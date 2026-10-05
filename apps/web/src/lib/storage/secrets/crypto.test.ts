import { describe, expect, it } from 'vitest';
import { freshIdb } from '$lib/storage/test-utils';
import {
	CHECK_AAD,
	DEK_AAD,
	ITERATIONS,
	IV_BYTES,
	SALT_BYTES,
	aadFor,
	deriveKey,
	newSalt,
	open,
	openBytes,
	seal,
	sealBytes,
	toBytes
} from './crypto';
import { createSecretsDb } from './secrets-db';
import { memoryStorage } from './memory-storage';

// Tests inject a low PBKDF2 count; only the constant itself is asserted at production strength.
const FAST = 1000;
const fixedSalt = () => new Uint8Array(SALT_BYTES).fill(7);
const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

describe('vault crypto constants', () => {
	it('uses the OWASP PBKDF2-HMAC-SHA256 iteration count in production', () => {
		expect(ITERATIONS).toBe(600_000);
		expect(SALT_BYTES).toBe(16);
		expect(IV_BYTES).toBe(12);
	});

	it('binds AAD strings to a versioned provider namespace', () => {
		expect(aadFor('anthropic')).toBe('tran-vault:v1:anthropic');
		expect(CHECK_AAD).toBe('tran-vault:v1:check');
		expect(DEK_AAD).toBe('tran-vault:v1:dek');
		expect(new Set([aadFor('check'), aadFor('openai'), aadFor('anthropic')]).size).toBe(3);
	});
});

describe('deriveKey / seal / open', () => {
	it('round-trips a secret with the same passphrase and provider', async () => {
		const key = await deriveKey('correct horse battery', fixedSalt(), FAST);
		const box = await seal(key, 'secret', aadFor('anthropic'));
		expect(await open(key, box, aadFor('anthropic'))).toBe('secret');
	});

	it('rejects a key derived from a different passphrase', async () => {
		const salt = fixedSalt();
		const right = await deriveKey('correct horse battery', salt, FAST);
		const wrong = await deriveKey('incorrect horse battery', salt, FAST);
		const box = await seal(right, 'secret', aadFor('anthropic'));
		await expect(open(wrong, box, aadFor('anthropic'))).rejects.toMatchObject({
			name: 'OperationError'
		});
	});

	it('rejects a box opened under another provider AAD (provider binding)', async () => {
		const key = await deriveKey('correct horse battery', fixedSalt(), FAST);
		const box = await seal(key, 'secret', aadFor('anthropic'));
		await expect(open(key, box, aadFor('openai'))).rejects.toMatchObject({
			name: 'OperationError'
		});
	});

	it('draws a fresh 12-byte IV for every seal (50 seals, 50 distinct IVs and ciphertexts)', async () => {
		const key = await deriveKey('pass', fixedSalt(), FAST);
		const boxes = await Promise.all(
			Array.from({ length: 50 }, () => seal(key, 'same plaintext', aadFor('openai')))
		);
		for (const b of boxes) expect(b.iv.byteLength).toBe(12);
		expect(new Set(boxes.map((b) => hex(b.iv))).size).toBe(50);
		expect(new Set(boxes.map((b) => hex(b.ct))).size).toBe(50);
	});

	it('produces a non-extractable key', async () => {
		const key = await deriveKey('pass', fixedSalt(), FAST);
		expect(key.extractable).toBe(false);
		await expect(crypto.subtle.exportKey('raw', key)).rejects.toThrow();
	});

	it('normalizes the passphrase to NFC (composed and decomposed é derive the same key)', async () => {
		const salt = fixedSalt();
		const composed = await deriveKey('café', salt, FAST);
		const decomposed = await deriveKey('café', salt, FAST);
		const a = await seal(composed, 'x', aadFor('gemini'));
		const b = await seal(decomposed, 'y', aadFor('gemini'));
		expect(await open(decomposed, a, aadFor('gemini'))).toBe('x');
		expect(await open(composed, b, aadFor('gemini'))).toBe('y');
	});

	it('round-trips raw bytes with sealBytes/openBytes', async () => {
		const key = await deriveKey('pass', fixedSalt(), FAST);
		const data = crypto.getRandomValues(new Uint8Array(32));
		const box = await sealBytes(key, data, DEK_AAD);
		const out = await openBytes(key, box, DEK_AAD);
		expect(out).toBeInstanceOf(Uint8Array);
		expect(hex(out)).toBe(hex(data));
		await expect(openBytes(key, box, CHECK_AAD)).rejects.toMatchObject({ name: 'OperationError' });
	});

	it('newSalt returns 16 random bytes and never repeats', () => {
		const a = newSalt();
		const b = newSalt();
		expect(a.byteLength).toBe(16);
		expect(hex(a)).not.toBe(hex(b));
	});

	it('toBytes copies into a fresh Uint8Array', () => {
		const src = new Uint8Array([1, 2, 3]);
		const copy = toBytes(src);
		expect(copy).not.toBe(src);
		expect(Array.from(copy)).toEqual([1, 2, 3]);
	});
});

describe('tran-secrets database', () => {
	it('opens a separate Dexie DB with keys(provider) and meta(id)', async () => {
		const db = createSecretsDb(freshIdb());
		await db.open();
		try {
			expect(db.name).toBe('tran-secrets');
			expect(db.keys.schema.primKey.keyPath).toBe('provider');
			expect(db.meta.schema.primKey.keyPath).toBe('id');
		} finally {
			db.close();
		}
	});

	it('stores sealed bytes that read back equal', async () => {
		const db = createSecretsDb(freshIdb());
		try {
			const key = await deriveKey('pass', fixedSalt(), FAST);
			const box = await seal(key, 'stored secret', aadFor('rentcast'));
			await db.keys.put({ provider: 'rentcast', box });
			await db.meta.put({ id: 'mode', value: 'remember' });
			const row = await db.keys.get('rentcast');
			expect(row?.box).toBeDefined();
			const back = { iv: toBytes(row!.box!.iv), ct: toBytes(row!.box!.ct) };
			expect(hex(back.iv)).toBe(hex(box.iv));
			expect(await open(key, back, aadFor('rentcast'))).toBe('stored secret');
			expect((await db.meta.get('mode'))?.value).toBe('remember');
		} finally {
			db.close();
		}
	});
});

describe('production memoryStorage fallback', () => {
	it('behaves like a minimal Storage', () => {
		const s = memoryStorage();
		expect(s.getItem('a')).toBeNull();
		s.setItem('a', '1');
		expect(s.getItem('a')).toBe('1');
		s.removeItem('a');
		expect(s.getItem('a')).toBeNull();
	});
});
