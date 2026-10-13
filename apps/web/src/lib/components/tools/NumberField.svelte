<script lang="ts">
	// 10-UI-SPEC "CalculatorShell" field: label (unit in the accessible name), 48px input group with
	// an aria-hidden adornment, optional helper and a text + icon error slot linked by
	// aria-describedby. Plain elements only, no headless primitives.
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import type { ToolField } from '$lib/content/tools';

	interface Props {
		field: ToolField;
		/** DOM id of the input (prefixed per calculator so ids never collide). */
		id: string;
		value: string;
		error: string | null;
		onblur: () => void;
	}

	let { field, id, value = $bindable(''), error, onblur }: Props = $props();

	const leading = $derived(field.adornment === '$');
	const describedBy = $derived(field.helper ? `${id}-help ${id}-error` : `${id}-error`);
</script>

<div class="grid gap-2">
	<label for={id} class="text-body font-semibold text-foreground"
		>{field.label}<span class="sr-only">{field.srSuffix}</span></label
	>
	<div
		class="flex h-12 items-center gap-1 rounded-md border bg-card px-4 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring {error
			? 'border-destructive'
			: 'border-border-strong'}"
	>
		{#if leading}
			<span aria-hidden="true" class="text-body text-muted-foreground">$</span>
		{/if}
		<input
			{id}
			bind:value
			{onblur}
			name={field.id}
			type="text"
			inputmode={field.kind === 'years' ? 'numeric' : 'decimal'}
			autocomplete="off"
			aria-invalid={error ? 'true' : undefined}
			aria-describedby={describedBy}
			class="h-full w-full min-w-0 bg-transparent text-body text-foreground tabular-nums outline-none"
		/>
		{#if !leading}
			<span aria-hidden="true" class="text-body text-muted-foreground">{field.adornment}</span>
		{/if}
	</div>
	{#if field.helper}
		<p id="{id}-help" class="text-label text-muted-foreground">{field.helper}</p>
	{/if}
	<p id="{id}-error" class="flex items-center gap-1 text-label text-destructive">
		{#if error}
			<CircleAlert class="size-4 shrink-0" aria-hidden="true" />
			{error}
		{/if}
	</p>
</div>
