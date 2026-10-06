<script lang="ts">
	// 06-UI-SPEC "ConfidenceBadge": shown when the estimate rests on fewer than 3 comparables
	// (the caller decides with @tran/core estimateConfidence), with a one-line explanation.
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import { Badge } from '$lib/features/shared/data/platform-ui';

	let { count }: { count: number } = $props();

	const label = $derived(count === 1 ? '1 comparable' : `${count} comparables`);
</script>

<div class="grid justify-items-start gap-1" data-confidence-badge>
	<Badge class="text-foreground tabular-nums">
		<TriangleAlert size={14} aria-hidden="true" />
		Low confidence: {label}
	</Badge>
	<p class="text-label text-muted-foreground">
		RentCast found few similar rentals nearby, so this estimate could be well off.
	</p>
</div>
