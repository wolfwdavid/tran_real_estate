<script lang="ts">
	import { fade } from 'svelte/transition';
	import { Button } from '$lib/components/ui/button/index.js';
	import { getSettingsContext } from './settings-context.svelte';

	// Stub: 03-14 replaces the status body (persistence, usage). The disclosure below is the Phase 1
	// CSP probe (csp.spec.ts drives its test ids and the fade transition): keep both test ids, the
	// transition, and render it without a ctx.ready guard so it is in the prerendered HTML.
	const ctx = getSettingsContext();
	let open = $state(false);
</script>

<section id="storage" aria-labelledby="storage-heading">
	<h2 id="storage-heading" tabindex="-1" class="font-display text-heading font-semibold">
		Storage
	</h2>
	<p class="mt-4 text-body">
		Browsers can clear a site's saved data to free up space. Safari can also clear it after 7 days
		without a visit. Here's how this browser treats Tran.
	</p>
	{#if !ctx.ready}
		<p class="mt-4 text-label text-muted-foreground">Checking this browser…</p>
	{/if}
	<Button
		variant="link"
		class="mt-4"
		data-testid="csp-transition-toggle"
		aria-expanded={open}
		aria-controls="storage-data-details"
		onclick={() => (open = !open)}
	>
		What counts as Tran's data?
	</Button>
	{#if open}
		<p
			id="storage-data-details"
			data-testid="csp-transition-target"
			transition:fade
			class="text-body"
		>
			Your API keys, saved searches, deals, contacts, and settings. Backups include everything
			except API keys.
		</p>
	{/if}
</section>
