<script lang="ts">
	// shadcn-svelte slider (v1.6.1, official registry), reconciled to the Phase 2 tokens per
	// 06-UI-SPEC: 8px `surface` track with a 1px `input` border, `primary` range fill, a 20px `card`
	// thumb with a 2px `primary` border inside a 44px hit area, and the Phase 2 outline focus ring.
	// `thumbProps` passes ARIA (aria-valuetext, aria-labelledby) through to the role="slider" thumb.
	import { Slider as SliderPrimitive } from 'bits-ui';
	import { cn, type WithoutChildrenOrChild } from '$lib/utils.js';

	/** ARIA passed to the role="slider" thumb (the primitive owns valuemin/max/now). */
	interface ThumbAria {
		'aria-label'?: string;
		'aria-labelledby'?: string;
		'aria-describedby'?: string;
		'aria-valuetext'?: string;
	}

	let {
		ref = $bindable(null),
		value = $bindable(),
		orientation = 'horizontal',
		class: className,
		thumbProps = {},
		...restProps
	}: WithoutChildrenOrChild<SliderPrimitive.RootProps> & {
		thumbProps?: ThumbAria;
	} = $props();
</script>

<!--
Discriminated Unions + Destructing (required for bindable) do not
get along, so we shut typescript up by casting `value` to `never`.
-->
<SliderPrimitive.Root
	bind:ref
	bind:value={value as never}
	data-slot="slider"
	{orientation}
	class={cn(
		'relative flex h-11 w-full touch-none items-center select-none data-disabled:opacity-50',
		className
	)}
	{...restProps}
>
	{#snippet children({ thumbItems })}
		<span
			data-slot="slider-track"
			data-orientation={orientation}
			class="relative h-2 w-full grow overflow-hidden rounded-full border border-input bg-surface"
		>
			<SliderPrimitive.Range data-slot="slider-range" class="absolute h-full bg-primary" />
		</span>
		{#each thumbItems as thumb (thumb.index)}
			<SliderPrimitive.Thumb
				data-slot="slider-thumb"
				index={thumb.index}
				class="group flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full outline-none select-none disabled:pointer-events-none disabled:opacity-50"
				{...thumbProps}
			>
				<span
					aria-hidden="true"
					class="block size-5 rounded-full border-2 border-primary bg-card shadow-card group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-ring"
				></span>
			</SliderPrimitive.Thumb>
		{/each}
	{/snippet}
</SliderPrimitive.Root>
