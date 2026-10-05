import { getContext, setContext } from 'svelte';
// Types only: a value import would pull the vault and Dexie into the prerendered page graph.
import type { Vault, VaultStatus } from '$lib/storage/secrets';
import type { TranDb } from '$lib/storage/db';

/** Shared state for every Settings section. Filled by the page's onMount (dynamic imports). */
export interface SettingsContext {
	/** True once hydration finished (vault + DB attempted). Sections show "Checking this browser…" until then. */
	ready: boolean;
	/** Site storage (IndexedDB) is blocked: keys work in memory for this tab only. */
	storageBlocked: boolean;
	vault: Vault | null;
	/** Mirrors createVaultState(vault).status. */
	vaultStatus: VaultStatus | null;
	/** Null until opened, and stays null when storage is blocked. */
	db: TranDb | null;
}

const KEY = Symbol('tran-settings');

export function createSettingsContext(): SettingsContext {
	const ctx = $state<SettingsContext>({
		ready: false,
		storageBlocked: false,
		vault: null,
		vaultStatus: null,
		db: null
	});
	return ctx;
}

export function setSettingsContext(ctx: SettingsContext): void {
	setContext(KEY, ctx);
}

/** Throws when used outside the Settings page. */
export function getSettingsContext(): SettingsContext {
	const ctx = getContext<SettingsContext | undefined>(KEY);
	if (!ctx) throw new Error('getSettingsContext() used outside the Settings page');
	return ctx;
}
