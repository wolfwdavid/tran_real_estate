<script lang="ts">
	// Stub: filled by 06-18 (they own this file). 06-14 mounts it on the listing detail with
	// `row` and `provenance`; until 06-18 lands it renders the section heading only.
	import type { Listing } from '@tran/core/listings';
	import type { Provenance } from '$lib/data';

	let { row, provenance }: { row: Listing; provenance: Provenance } = $props();
</script>

<section
	class="grid gap-4 rounded-lg border border-border bg-card p-4 sm:p-6"
	aria-labelledby="outreach-heading"
	data-outreach={row.id}
	data-outreach-source={provenance.source}
>
	<h2
		id="outreach-heading"
		class="font-display text-heading font-semibold text-balance text-foreground"
	>
		Message the listing contact
	</h2>
</section>
