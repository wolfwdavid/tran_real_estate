<script lang="ts">
	import { getSettingsContext } from './settings-context.svelte';

	// Stub: 03-11 replaces the body (provider key cards, forget-all footer).
	const ctx = getSettingsContext();
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
	{/if}
</section>
