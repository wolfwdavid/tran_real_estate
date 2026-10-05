// WebCrypto primitives for the key vault. Same API in browsers and Node 24.
// PBKDF2-HMAC-SHA256 derives a non-extractable AES-GCM-256 key from a passphrase; every seal uses
// a fresh random IV, and the AAD binds each ciphertext to its purpose (one provider, the verifier,
// or the data key) so sealed records cannot be swapped between rows.

/** OWASP PBKDF2-HMAC-SHA256 figure. Never lower in production code; tests inject a low count. */
export const ITERATIONS = 600_000;
export const SALT_BYTES = 16;
export const IV_BYTES = 12;
const NON_EXTRACTABLE = false;

const enc = new TextEncoder();
const dec = new TextDecoder();

export type Box = { iv: Uint8Array<ArrayBuffer>; ct: Uint8Array<ArrayBuffer> };

export const newSalt = (): Uint8Array<ArrayBuffer> =>
	crypto.getRandomValues(new Uint8Array(SALT_BYTES));

/** Passphrase is NFC-normalized so the same text typed on any keyboard derives the same key. */
export async function deriveKey(
	passphrase: string,
	salt: Uint8Array<ArrayBuffer>,
	iterations = ITERATIONS
): Promise<CryptoKey> {
	const base = await crypto.subtle.importKey(
		'raw',
		enc.encode(passphrase.normalize('NFC')),
		'PBKDF2',
		false,
		['deriveKey']
	);
	return crypto.subtle.deriveKey(
		{ name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
		base,
		{ name: 'AES-GCM', length: 256 },
		NON_EXTRACTABLE,
		['encrypt', 'decrypt']
	);
}

export async function sealBytes(
	key: CryptoKey,
	data: Uint8Array<ArrayBuffer>,
	aad: string
): Promise<Box> {
	const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
	const ct = new Uint8Array(
		await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(aad) }, key, data)
	);
	return { iv, ct };
}

/** Rejects (OperationError) on a wrong key OR a wrong AAD. */
export async function openBytes(
	key: CryptoKey,
	box: Box,
	aad: string
): Promise<Uint8Array<ArrayBuffer>> {
	return new Uint8Array(
		await crypto.subtle.decrypt(
			{ name: 'AES-GCM', iv: box.iv, additionalData: enc.encode(aad) },
			key,
			box.ct
		)
	);
}

export async function seal(key: CryptoKey, plaintext: string, aad: string): Promise<Box> {
	return sealBytes(key, enc.encode(plaintext), aad);
}

/** Rejects (OperationError) on a wrong key OR a wrong AAD. */
export async function open(key: CryptoKey, box: Box, aad: string): Promise<string> {
	return dec.decode(await openBytes(key, box, aad));
}

export const aadFor = (provider: string) => `tran-vault:v1:${provider}`;
export const CHECK_AAD = 'tran-vault:v1:check';
export const DEK_AAD = 'tran-vault:v1:dek';

/** Copy at the IndexedDB read boundary (TS 6 BufferSource typing wants an ArrayBuffer backing). */
export const toBytes = (x: ArrayLike<number>): Uint8Array<ArrayBuffer> => new Uint8Array(x);
