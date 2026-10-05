import type { Vault } from './vault';

// Thin runes view of the vault status. The web Vitest project compiles .svelte.ts for the server,
// so reactivity is proven in E2E (RESEARCH Pattern 3 / Pitfall 11). Keep this wrapper this thin.
export function createVaultState(vault: Vault) {
	let status = $state(vault.getStatus());
	const off = vault.onChange(() => {
		status = vault.getStatus();
	});
	return {
		get status() {
			return status;
		},
		dispose: off
	};
}
