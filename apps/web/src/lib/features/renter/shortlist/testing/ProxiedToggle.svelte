<script lang="ts">
	// Test-only: hands ShortlistToggle a row held in $state (a deep proxy), as the listing page
	// does, so the repo's structuredClone path is exercised with a proxied value.
	import ShortlistToggle from '../ShortlistToggle.svelte';

	let { id, streetLine }: { id: string; streetLine: string } = $props();

	const holder = $state({
		row: { id: '', price: 1500, history: [{ date: '2026-09-01', event: 'Listed', price: 1500 }] },
		provenance: { source: 'sample' as const, fetchedAt: 0 }
	});
	$effect.pre(() => {
		holder.row.id = id;
	});
</script>

<ShortlistToggle row={holder.row} provenance={holder.provenance} variant="detail" {streetLine} />
