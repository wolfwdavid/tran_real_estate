// Cross-tab coordination for the key vault.
// Messages NEVER carry key material or last4: only a type and the sending tab's random id.
// sessionStorage is per tab, so one tab cannot clear another tab's copy. Each tab clears ITS OWN
// session store when it receives 'forget-all' or 'locked'; the broadcast is the only way to reach
// the other tabs.

export const VAULT_CHANNEL = 'tran-vault';

export type VaultMessage = {
	type: 'forget-all' | 'locked' | 'mode-changed' | 'keys-changed';
	from: string;
};

export interface ChannelLike {
	postMessage(m: VaultMessage): void;
	addEventListener(t: 'message', l: (e: MessageEvent<VaultMessage>) => void): void;
	close(): void;
}
