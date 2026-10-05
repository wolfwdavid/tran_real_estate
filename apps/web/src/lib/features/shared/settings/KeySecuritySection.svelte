<script lang="ts">
	import HonestyCallout from './HonestyCallout.svelte';
	import KeyStorageMode from './KeyStorageMode.svelte';
	import PassphraseLock from './PassphraseLock.svelte';
	import { getSettingsContext } from './settings-context.svelte';

	// Storage-mode choice and passphrase lock wait on hydration (they need the vault); the honesty
	// callout is static copy, so it prerenders.
	const ctx = getSettingsContext();
</script>

<section id="key-security" aria-labelledby="key-security-heading">
	<h2 id="key-security-heading" tabindex="-1" class="font-display text-heading font-semibold">
		Key security
	</h2>
	<div class="mt-4 flex flex-col gap-8">
		{#if !ctx.ready}
			<p class="text-label text-muted-foreground">Checking this browser…</p>
		{:else}
			<KeyStorageMode />
			<PassphraseLock />
		{/if}
		<HonestyCallout />
	</div>
</section>
