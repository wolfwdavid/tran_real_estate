<script lang="ts">
	// Native <select> with input styling. The chevron is an icon element, never a CSS background
	// image (CSP img-src refuses data: URLs).
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import { Label } from '$lib/components/ui/label/index.js';

	let {
		id,
		label,
		value = $bindable(''),
		options,
		invalid = false,
		describedby,
		disabled = false,
		onchange
	}: {
		id: string;
		label: string;
		value?: string;
		options: readonly { value: string; label: string }[];
		invalid?: boolean;
		describedby?: string;
		disabled?: boolean;
		onchange?: (v: string) => void;
	} = $props();
</script>

<div class="flex flex-col gap-2">
	<Label for={id}>{label}</Label>
	<div class="relative">
		<select
			{id}
			bind:value
			{disabled}
			aria-invalid={invalid ? 'true' : undefined}
			aria-describedby={describedby}
			onchange={(e) => onchange?.(e.currentTarget.value)}
			class="h-12 w-full min-w-0 cursor-pointer appearance-none rounded-md border border-input bg-card pr-12 pl-4 text-base leading-[1.6] text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:bg-surface disabled:text-muted-foreground aria-invalid:border-destructive"
		>
			{#each options as option (option.value)}
				<option value={option.value}>{option.label}</option>
			{/each}
		</select>
		<ChevronDown
			size={16}
			aria-hidden="true"
			class="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-foreground"
		/>
	</div>
</div>
