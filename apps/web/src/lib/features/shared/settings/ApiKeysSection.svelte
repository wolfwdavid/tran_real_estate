<script lang="ts">
	import { tick } from 'svelte';
	import { PROVIDERS } from '@tran/core';
	import ForgetAllDialog from './ForgetAllDialog.svelte';
	import ProviderKeyCard from './ProviderKeyCard.svelte';
	import { getSettingsContext } from './settings-context.svelte';

	// Five provider cards in the registry's fixed order (RentCast first), then the Forget all footer.
	// Static parts (names, hosts, notes, links) prerender; live state waits on ctx.ready.
	const ctx = getSettingsContext();

	const anyKey = $derived(
		PROVIDERS.some((p) => (ctx.vaultStatus?.providers[p.id]?.state ?? 'none') !== 'none')
	);

	// A confirmed Forget all in THIS tab empties the vault, which unmounts the footer's dialog
	// before its close handler can move focus. Focus the section heading once the DOM settles
	// (UI-SPEC focus rule). Remote forgets (other tabs) never move focus here.
	$effect(() => {
		const vault = ctx.vault;
		if (!vault) return;
		return vault.onChange((e) => {
			if (e.kind !== 'forgotten' || e.remote) return;
			void tick().then(() => document.getElementById('api-keys-heading')?.focus());
		});
	});
</script>

<section id="api-keys" aria-labelledby="api-keys-heading">
	<h2 id="api-keys-heading" tabindex="-1" class="font-display text-heading font-semibold">
		API keys
	</h2>
	<p class="mt-4 text-body">
		Each key is sent only from your browser to the service it belongs to. Tran has no server and
		never receives it. For safety, create a key just for Tran, set a spending limit with the
		provider where you can, and delete the key at the provider if you think it was exposed.
	</p>
	{#if !ctx.ready}
		<p class="mt-4 text-label text-muted-foreground">Checking this browser…</p>
	{:else if !anyKey}
		<div class="mt-4">
			<p class="text-body font-semibold">No keys added yet</p>
			<p class="mt-2 text-body">
				You can explore every portal with sample data and no keys. Add a free RentCast key to search
				real listings, and an AI key if you want help drafting messages.
			</p>
		</div>
	{/if}

	<div class="mt-8 flex flex-col gap-4">
		{#each PROVIDERS as provider (provider.id)}
			<ProviderKeyCard {provider} />
		{/each}
	</div>

	<div class="mt-8 border-t border-border pt-6">
		<h3 class="text-body font-semibold">Forget all keys</h3>
		{#if !ctx.ready}
			<p class="mt-2 text-label text-muted-foreground">Checking this browser…</p>
		{:else if anyKey}
			<p class="mt-2 text-body">
				Remove every API key from this browser in one step, including remembered keys and the
				passphrase lock.
			</p>
			<div class="mt-4">
				<ForgetAllDialog />
			</div>
		{:else}
			<p class="mt-2 text-body">No keys are stored in this browser.</p>
		{/if}
	</div>
</section>
