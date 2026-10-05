<script lang="ts">
	import { getSettingsContext } from './settings-context.svelte';

	// Stub: 03-14 replaces the body (install prompt and per-browser instructions).
	const ctx = getSettingsContext();
</script>

<section id="install" aria-labelledby="install-heading">
	<h2 id="install-heading" tabindex="-1" class="font-display text-heading font-semibold">
		Install the app
	</h2>
	{#if !ctx.ready}
		<p class="mt-4 text-label text-muted-foreground">Checking this browser…</p>
	{/if}
</section>
