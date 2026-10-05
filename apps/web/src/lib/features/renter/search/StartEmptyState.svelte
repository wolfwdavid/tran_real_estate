<script lang="ts">
	// 06-UI-SPEC empty state before any search. In sample mode, "Try a sample search" fills in the
	// first fixture metro and runs it at 0 calls.
	import PropertyTypeMark from '$lib/features/shared/listings/PropertyTypeMark.svelte';
	import { Button } from '$lib/components/ui/button/index.js';

	let { sample, onSample }: { sample: boolean; onSample: () => void } = $props();
</script>

<div class="flex flex-col items-start gap-4 py-12">
	<PropertyTypeMark type="Apartment" size="detail" />
	<h2 class="font-display text-heading font-semibold text-balance">Start with a place</h2>
	<p class="max-w-reading text-base leading-[1.6] text-muted-foreground">
		Enter a city and state or a ZIP code. Filters for rent, bedrooms, type, and how recently a place
		was listed apply right away and don't use calls.
	</p>
	{#if sample}
		<Button variant="outline" onclick={onSample}>Try a sample search</Button>
	{/if}
</div>
