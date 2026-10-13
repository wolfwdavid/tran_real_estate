<script lang="ts">
	// Results empty state: icon + one sentence naming what's missing. Never zeros or dashes.
	import CalculatorIcon from '@lucide/svelte/icons/calculator';
	import { SHARED_TOOL_COPY } from '$lib/content/tools';

	let { body }: { body: string } = $props();
</script>

<p class="flex gap-2 text-body text-muted-foreground">
	<CalculatorIcon class="mt-1 size-5 shrink-0" aria-hidden="true" />
	<span>{body} {SHARED_TOOL_COPY.emptyTail}</span>
</p>
