<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { announce } from '$lib/components/a11y/announcer.svelte';
	import ConfirmDialog from './ConfirmDialog.svelte';
	import { getSettingsContext } from './settings-context.svelte';

	// Shared by the API keys footer (03-11) and Key security's "Forgot your passphrase?" path (03-12).
	// Clears every key store in this browser and tells other tabs (vault.forgetAll broadcasts).

	interface Props {
		triggerClass?: string;
		onError?: (error: unknown) => void;
	}

	let { triggerClass, onError }: Props = $props();

	const ctx = getSettingsContext();
	let open = $state(false);
	let forgotten = false;

	async function forgetAll(): Promise<void> {
		if (!ctx.vault) return;
		await ctx.vault.forgetAll();
		announce('All API keys forgotten.');
		forgotten = true;
	}

	// After a confirmed forget, focus goes to the API keys heading instead of back to the trigger:
	// the trigger's surroundings changed (and the trigger may no longer render).
	function onCloseAutoFocus(e: Event): void {
		if (!forgotten) return;
		forgotten = false;
		e.preventDefault();
		document.getElementById('api-keys-heading')?.focus();
	}
</script>

<ConfirmDialog
	bind:open
	title="Forget all API keys?"
	body={[
		"This removes every key from this browser: keys for this tab, keys remembered on this device, and your passphrase lock. Other open Tran tabs lose them too. To use RentCast or AI drafting again, you'll need to paste your keys back in. Your saved searches, deals, and contacts are not affected."
	]}
	confirmLabel="Forget all keys"
	confirmBusyLabel="Forgetting…"
	cancelLabel="Keep my keys"
	onConfirm={forgetAll}
	{onError}
	{onCloseAutoFocus}
>
	{#snippet trigger({ props })}
		<Button {...props} variant="destructive-outline" class={triggerClass} disabled={!ctx.vault}>
			Forget all keys
		</Button>
	{/snippet}
</ConfirmDialog>
