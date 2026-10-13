<script lang="ts">
	// Results empty state: icon + one sentence naming what's missing. Never zeros or dashes.
	import ToolIcon from './ToolIcon.svelte';
	import { SHARED_TOOL_COPY } from '$lib/content/tools/shared';

	let { body }: { body: string } = $props();
</script>

<p class="flex gap-2 text-body text-muted-foreground">
	<ToolIcon name="calculator" class="mt-1 size-5 shrink-0" />
	<span>{body} {SHARED_TOOL_COPY.emptyTail}</span>
</p>
