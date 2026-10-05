import { VAULT_CHANNEL, type ChannelLike } from './channel';
import { memoryStorage } from './memory-storage';
import { createSecretsDb } from './secrets-db';
import { SESSION_KEY, Vault } from './vault';

// Browser-only singleton. NEVER import this at module scope of a route: Settings and AppNotice
// load it with a dynamic import() inside onMount, so prerendered marketing pages never touch it.

let pending: Promise<Vault> | undefined;

export function getVault(): Promise<Vault> {
	return (pending ??= (async () => {
		let session: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
		try {
			session = window.sessionStorage;
			session.getItem(SESSION_KEY);
		} catch {
			// Storage blocked: keys live in this page's memory only.
			session = memoryStorage();
		}
		const channel =
			typeof BroadcastChannel === 'function' ? new BroadcastChannel(VAULT_CHANNEL) : null;
		const vault = new Vault({
			session,
			openDb: () => createSecretsDb(),
			channel: channel as ChannelLike | null
		});
		await vault.init();
		return vault;
	})());
}

export {
	Vault,
	VaultError,
	SESSION_KEY,
	type VaultStatus,
	type VaultEvent,
	type VaultErrorCode,
	type KeyState
} from './vault';
export {
	registerKeyTester,
	getKeyTester,
	hasKeyTester,
	KEY_TEST_STATUSES,
	type KeyTestResult,
	type KeyTestStatus,
	type KeyTester
} from './testers';
export { createVaultState } from './vault-state.svelte';
export { VAULT_CHANNEL, type ChannelLike, type VaultMessage } from './channel';
