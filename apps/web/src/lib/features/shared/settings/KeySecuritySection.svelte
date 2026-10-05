<script lang="ts">
	import { getSettingsContext } from './settings-context.svelte';

	// Stub: 03-12 adds the intro, storage-mode choice and passphrase lock.
	const ctx = getSettingsContext();
</script>

<section id="key-security" aria-labelledby="key-security-heading">
	<h2 id="key-security-heading" tabindex="-1" class="font-display text-heading font-semibold">
		Key security
	</h2>
	{#if !ctx.ready}
		<p class="mt-4 text-label text-muted-foreground">Checking this browser…</p>
	{/if}
</section>
