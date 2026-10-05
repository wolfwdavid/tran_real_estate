// The ONE adapter between the Phase 4 data layer and the Phase 3 platform (key vault, Dexie DB,
// key-test hook, live announcer). Phase 4 modules import these fixed names only, so a Phase 3
// rename touches this file and nothing else.
//
// Key rules: the RentCast key leaves this module ONLY as getRentCastKey()'s return value. It is
// never logged, never put in an error, an event, a URL or a stored row.
//
// Browser-only at runtime: nothing here touches IndexedDB, sessionStorage or the vault at module
// scope. The vault is loaded with a dynamic import() the first time a key accessor runs in a
// browser, so prerendered pages never pull it in.
import type { ProviderId } from '@tran/core';
import { announce as announceLive } from '$lib/components/a11y/announcer.svelte';
import { TranDb, getDb } from '$lib/storage/db';
import type { KeyState, KeyTestResult, KeyTestStatus } from '$lib/storage/secrets';
import { registerKeyTester } from '$lib/storage/secrets/testers';

export { BACKUP_EXCLUDED_TABLES, listBackupTables } from '$lib/storage/backup-registry';

const RENTCAST: ProviderId = 'rentcast';

// ---------------------------------------------------------------------------------------------
// RentCast key (vault bridge)
// ---------------------------------------------------------------------------------------------

export type RentCastKeyState = 'none' | 'locked' | 'available';

export type RentCastKeyTestOutcome =
	'valid' | 'valid-billed' | 'invalid' | 'restricted' | 'rate-limited' | 'unverified';

/** The slice of the Phase 3 Vault this bridge uses (tests pass a fake). */
export interface RentCastVaultLike {
	getStatus(): { providers: Record<ProviderId, { state: KeyState }> };
	getKey(p: ProviderId): Promise<string | undefined>;
	onChange(cb: () => void): () => void;
}

let key: string | null = null;
let state: RentCastKeyState = 'none';
let bound: { vault: RentCastVaultLike; off: () => void } | null = null;
let connecting: Promise<void> | null = null;
let generation = 0;
const listeners = new Set<() => void>();

function notify(): void {
	for (const listener of [...listeners]) {
		try {
			listener();
		} catch {
			// A failing listener must not stop the others (and must not surface key state).
		}
	}
}

async function refresh(vault: RentCastVaultLike): Promise<void> {
	const gen = ++generation;
	let next: string | null;
	try {
		next = (await vault.getKey(RENTCAST)) ?? null;
	} catch {
		// VaultError('corrupt') or a blocked store: treat as no readable key.
		next = null;
	}
	let nextState: RentCastKeyState = 'none';
	if (next) nextState = 'available';
	else if (vault.getStatus().providers[RENTCAST]?.state === 'locked') nextState = 'locked';
	if (gen !== generation || bound?.vault !== vault) return; // a newer refresh or a rebind won
	const changed = next !== key || nextState !== state;
	key = next;
	state = nextState;
	if (changed) notify();
}

/**
 * Binds the bridge to a vault: mirrors its RentCast key (synchronously readable afterwards) and
 * follows its change events, including cross-tab ones. Resolves once the first read is done.
 */
export async function bindRentCastVault(vault: RentCastVaultLike): Promise<() => void> {
	bound?.off();
	const off = vault.onChange(() => {
		void refresh(vault);
	});
	bound = { vault, off };
	await refresh(vault);
	return () => {
		if (bound?.vault !== vault) return;
		off();
		bound = null;
	};
}

/** Connects to the app vault singleton (browser only; idempotent). */
export function connectRentCastKey(): Promise<void> {
	if (bound) return Promise.resolve();
	if (typeof window === 'undefined') return Promise.resolve();
	connecting ??= import('$lib/storage/secrets')
		.then(({ getVault }) => getVault())
		.then(async (vault) => {
			if (!bound) await bindRentCastVault(vault);
		})
		.catch(() => {
			// Vault unavailable: the data layer runs as "no key" (sample mode).
			connecting = null;
		});
	return connecting;
}

/** The RentCast key when readable (present and not locked), else null. */
export function getRentCastKey(): string | null {
	void connectRentCastKey();
	return key;
}

export function getRentCastKeyState(): RentCastKeyState {
	void connectRentCastKey();
	return state;
}

/** Called after the RentCast key or its locked state changes. Returns an unsubscribe function. */
export function onRentCastKeyChange(listener: () => void): () => void {
	listeners.add(listener);
	void connectRentCastKey();
	return () => {
		listeners.delete(listener);
	};
}

// ---------------------------------------------------------------------------------------------
// "Test key" hook
// ---------------------------------------------------------------------------------------------

const OUTCOME_STATUS: Readonly<Record<RentCastKeyTestOutcome, KeyTestStatus>> = Object.freeze({
	valid: 'accepted',
	'valid-billed': 'accepted',
	invalid: 'rejected',
	restricted: 'rejected',
	'rate-limited': 'rate-limited',
	unverified: 'failed'
});

/** Phase 3 KeyTestResult status for a RentCast probe outcome. */
export function keyTestStatusOf(outcome: RentCastKeyTestOutcome): KeyTestStatus {
	return OUTCOME_STATUS[outcome];
}

let lastTest: { outcome: RentCastKeyTestOutcome; at: number } | null = null;

/**
 * Registers the RentCast "Test key" check with the Phase 3 hook (ProviderKeyCard shows the button
 * only while a tester is registered). The raw outcome is kept for KeyTestResult copy via
 * getLastRentCastKeyTest(). A thrown test counts as 'unverified'. Returns an unregister function.
 */
export function registerRentCastKeyTest(
	test: (key: string, signal?: AbortSignal) => Promise<RentCastKeyTestOutcome>,
	options: { now?: () => number } = {}
): () => void {
	const now = options.now ?? Date.now;
	return registerKeyTester(RENTCAST, async (k, signal): Promise<KeyTestResult> => {
		let outcome: RentCastKeyTestOutcome;
		try {
			outcome = await test(k, signal);
		} catch {
			outcome = 'unverified';
		}
		lastTest = { outcome, at: now() };
		return { status: keyTestStatusOf(outcome) };
	});
}

export function getLastRentCastKeyTest(): { outcome: RentCastKeyTestOutcome; at: number } | null {
	return lastTest;
}

// ---------------------------------------------------------------------------------------------
// Live announcer
// ---------------------------------------------------------------------------------------------

/** Polite screen-reader announcement through the Phase 3 LiveAnnouncer. Fixed copy only. */
export function announce(message: string): void {
	announceLive(message);
}

// ---------------------------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------------------------

/** The Phase 3 app database, carrying the Phase 4 tables (apiCache, ledger, savedSearches, ...). */
export type DataDb = TranDb;

/**
 * A new database connection. Tests pass a fresh fake-indexeddb factory and a unique name; the
 * default is the app database name 'tran'. Not opened: Dexie opens on first use.
 */
export function createDataDb(
	options: { name?: string; indexedDB?: IDBFactory; IDBKeyRange?: typeof IDBKeyRange } = {}
): DataDb {
	const dexieOptions: { indexedDB?: IDBFactory; IDBKeyRange?: typeof IDBKeyRange } = {};
	if (options.indexedDB) dexieOptions.indexedDB = options.indexedDB;
	if (options.IDBKeyRange) dexieOptions.IDBKeyRange = options.IDBKeyRange;
	return new TranDb(dexieOptions, options.name ?? 'tran');
}

/** The app singleton (same instance Phase 3 Settings/backup use). Browser callers only. */
export function getDataDb(): DataDb {
	return getDb();
}

// ---------------------------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------------------------

/** Tests only: drops the vault binding, key mirror, listeners and last test result. */
export function _resetPlatform(): void {
	bound?.off();
	bound = null;
	connecting = null;
	key = null;
	state = 'none';
	generation++;
	listeners.clear();
	lastTest = null;
}
