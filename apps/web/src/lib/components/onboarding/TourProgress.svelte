<script lang="ts">
	import { GUIDE_COPY } from '$lib/content/onboarding';

	let { step }: { step: 1 | 2 | 3 } = $props();
</script>

<div class="flex items-center gap-3">
	<p class="text-label font-semibold text-foreground">{GUIDE_COPY.progress(step)}</p>
	<span class="flex gap-1" aria-hidden="true">
		{#each [1, 2, 3] as i (i)}
			<span class="h-1 w-6 rounded-full {i <= step ? 'bg-primary' : 'bg-border-strong'}"></span>
		{/each}
	</span>
</div>
