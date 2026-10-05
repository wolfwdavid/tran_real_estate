import { DEK_AAD, ITERATIONS, deriveKey, newSalt, openBytes, sealBytes, type Box } from './crypto';

// Passphrase lock for remembered keys (envelope encryption).
// A random AES-GCM-256 data key (DEK) seals every remembered key. The passphrase only derives a
// key-encryption key (PBKDF2-SHA256, 600k iterations, 16-byte salt) that wraps the DEK. Changing the
// passphrase therefore rewraps one small record instead of re-encrypting every row.
//
// What this protects, honestly:
// - It protects keys AT REST only (a copy of the browser profile or the tran-secrets database).
// - While unlocked, the DEK sits in this tab's sessionStorage so a reload stays unlocked. That is the
//   same exposure as session-only keys: a malicious script on the origin can read it.
// - Someone with disk access can reset the attempt counter. The 600k PBKDF2 cost is the real
//   brute-force defense; the 5-attempt cooldown is a UX guard against online guessing.

/** Byte array backed by a plain buffer (the shape WebCrypto accepts). */
type Bytes = ReturnType<typeof newSalt>;

export const LOCK_MIN_LENGTH = 12;
export const LOCK_MAX_ATTEMPTS = 5;
export const COOLDOWN_BASE_MS = 30_000;
export const COOLDOWN_CAP_MS = 300_000;

export interface VaultLockRecord {
	id: 'vault';
	v: 1;
	kdf: 'PBKDF2-SHA256';
	iterations: number;
	salt: Bytes;
	/** DEK raw bytes sealed under the passphrase-derived KEK (AAD = DEK_AAD). */
	wrapped: Box;
	failedAttempts: number;
	cooldownUntil: number | null;
}

/** 0 for the first 4 failures; from the 5th: 30 s doubling per failure, capped at 300 s. */
export function cooldownFor(failed: number): number {
	if (failed < LOCK_MAX_ATTEMPTS) return 0;
	return Math.min(COOLDOWN_BASE_MS * 2 ** (failed - LOCK_MAX_ATTEMPTS), COOLDOWN_CAP_MS);
}

const AES = { name: 'AES-GCM', length: 256 } as const;
/** Extractable only so the DEK can be stashed in this tab's sessionStorage and rewrapped. */
const DEK_EXTRACTABLE = true;

async function rawDek(dek: CryptoKey): Promise<Bytes> {
	return new Uint8Array(await crypto.subtle.exportKey('raw', dek));
}

async function importRaw(raw: Bytes): Promise<CryptoKey> {
	return crypto.subtle.importKey('raw', raw, 'AES-GCM', DEK_EXTRACTABLE, ['encrypt', 'decrypt']);
}

async function wrap(
	dek: CryptoKey,
	pass: string,
	iterations: number
): Promise<{ salt: Bytes; wrapped: Box }> {
	const salt = newSalt();
	const kek = await deriveKey(pass, salt, iterations);
	const wrapped = await sealBytes(kek, await rawDek(dek), DEK_AAD);
	return { salt, wrapped };
}

export async function createLock(
	pass: string,
	iterations = ITERATIONS
): Promise<{ record: VaultLockRecord; dek: CryptoKey }> {
	const dek = await crypto.subtle.generateKey(AES, DEK_EXTRACTABLE, ['encrypt', 'decrypt']);
	const { salt, wrapped } = await wrap(dek, pass, iterations);
	return {
		record: {
			id: 'vault',
			v: 1,
			kdf: 'PBKDF2-SHA256',
			iterations,
			salt,
			wrapped,
			failedAttempts: 0,
			cooldownUntil: null
		},
		dek
	};
}

/** Rejects (AES-GCM authentication failure) on a wrong passphrase. */
export async function unwrapDek(record: VaultLockRecord, pass: string): Promise<CryptoKey> {
	const kek = await deriveKey(pass, record.salt, record.iterations);
	return importRaw(await openBytes(kek, record.wrapped, DEK_AAD));
}

/** Same DEK under a new passphrase: new salt, new IV, new wrapped box. Counters are carried over. */
export async function rewrap(
	record: VaultLockRecord,
	dek: CryptoKey,
	newPass: string,
	iterations = ITERATIONS
): Promise<VaultLockRecord> {
	const { salt, wrapped } = await wrap(dek, newPass, iterations);
	return { ...record, iterations, salt, wrapped };
}

/** base64 of the raw DEK, for this tab's sessionStorage stash ONLY. Never log or persist it. */
export async function exportDek(dek: CryptoKey): Promise<string> {
	let s = '';
	for (const b of await rawDek(dek)) s += String.fromCharCode(b);
	return btoa(s);
}

export async function importDek(b64: string): Promise<CryptoKey> {
	const bin = atob(b64);
	const raw = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) raw[i] = bin.charCodeAt(i);
	return importRaw(raw);
}
