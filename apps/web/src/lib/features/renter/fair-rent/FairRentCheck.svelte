<script lang="ts">
	// Stub: filled by 06-17 (they own this file). 06-14 mounts it on the listing detail with
	// `row` and `provenance`; until 06-17 lands it renders the section heading only.
	import type { Listing } from '@tran/core/listings';
	import type { Provenance } from '$lib/data';

	let { row, provenance }: { row: Listing; provenance: Provenance } = $props();
</script>

<section
	class="grid gap-4 rounded-lg border border-border bg-card p-4 sm:p-6"
	aria-labelledby="fair-rent-heading"
	data-fair-rent={row.id}
	data-fair-rent-source={provenance.source}
>
	<h2
		id="fair-rent-heading"
		class="font-display text-heading font-semibold text-balance text-foreground"
	>
		How this rent compares
	</h2>
</section>
