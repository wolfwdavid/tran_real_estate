<script lang="ts">
	// shadcn-svelte tabs (v1.6.1, official registry), reconciled to the Phase 2 tokens per
	// 06-UI-SPEC "View tabs": bits-ui owns the WAI-ARIA tabs pattern (roving tabindex, arrow keys,
	// Home/End, automatic activation). Horizontal only; no dark mode.
	import { Tabs as TabsPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils.js';

	let {
		ref = $bindable(null),
		value = $bindable(''),
		class: className,
		...restProps
	}: TabsPrimitive.RootProps = $props();
</script>

<TabsPrimitive.Root
	bind:ref
	bind:value
	data-slot="tabs"
	class={cn('flex flex-col gap-4', className)}
	{...restProps}
/>
