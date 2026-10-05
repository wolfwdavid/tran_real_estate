<script lang="ts">
	import { Checkbox as CheckboxPrimitive } from 'bits-ui';
	import CheckIcon from '@lucide/svelte/icons/check';
	import { cn, type WithoutChildrenOrChild } from '$lib/utils.js';

	let {
		ref = $bindable(null),
		checked = $bindable(false),
		class: className,
		...restProps
	}: WithoutChildrenOrChild<CheckboxPrimitive.RootProps> = $props();
</script>

<CheckboxPrimitive.Root
	bind:ref
	data-slot="checkbox"
	class={cn(
		'grid size-5 shrink-0 cursor-pointer place-items-center rounded-sm border border-input bg-card text-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed aria-invalid:border-destructive data-checked:border-primary data-checked:bg-primary',
		className
	)}
	bind:checked
	{...restProps}
>
	{#snippet children({ checked })}
		{#if checked}
			<CheckIcon size={16} aria-hidden="true" />
		{/if}
	{/snippet}
</CheckboxPrimitive.Root>
