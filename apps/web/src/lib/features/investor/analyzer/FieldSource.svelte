<script lang="ts">
	// FieldSource chip (07-UI-SPEC "Autofill and field provenance"): shown in a field's label row
	// (NumericField `chip` slot, linked by aria-describedby). Phase 4 Sample data / "RentCast · as of
	// {relative}" chip while an estimate is unchanged, "From listing" for Deep-analyze pre-fills, and
	// "Edited by you" once the user changes a filled value. Typed values get no chip.
	import Pencil from '@lucide/svelte/icons/pencil';
	import Tag from '@lucide/svelte/icons/tag';
	import ProvenanceChip from '$lib/features/shared/data/ProvenanceChip.svelte';
	import type { FieldSource } from '../deals/schema';

	let { source, now }: { source: FieldSource | undefined; now?: number } = $props();

	const CHIP =
		'inline-flex items-center gap-1 rounded-full border border-transparent bg-surface px-2 py-1 text-label font-semibold whitespace-nowrap';
</script>

{#if source?.source === 'rentcast' || source?.source === 'sample'}
	<span data-field-source={source.source}
		><ProvenanceChip
			provenance={{ source: source.source, fetchedAt: source.fetchedAt ?? 0, stale: false }}
			{now}
		/></span
	>
{:else if source?.source === 'listing'}
	<span data-field-source="listing" class="{CHIP} text-foreground"
		><Tag class="size-3.5" aria-hidden="true" />From listing</span
	>
{:else if source?.source === 'edited'}
	<span data-field-source="edited" class="{CHIP} text-muted-foreground"
		><Pencil class="size-3.5" aria-hidden="true" />Edited by you</span
	>
{/if}
