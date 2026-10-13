<script lang="ts">
	// 10-UI-SPEC "CalculatorShell" field: label (unit in the accessible name), 48px input group with
	// an aria-hidden adornment, optional helper and a text + icon error slot linked by
	// aria-describedby. Plain elements only, no headless primitives.
	import ToolIcon from './ToolIcon.svelte';
	import type { ToolField } from '$lib/content/tools/shared';

	interface Props {
		field: ToolField;
		/** DOM id of the input (prefixed per calculator so ids never collide). */
		id: string;
		value: string;
		error: string | null;
		onblur: () => void;
		/** Enter only re-runs validation. The form has several text fields and no submit button, so
		 * browsers never submit it implicitly; the field reports Enter instead. */
		onenter: () => void;
	}

	let { field, id, value = $bindable(''), error, onblur, onenter }: Props = $props();

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
			onkeydown={(e) => {
				if (e.key === 'Enter') {
					e.preventDefault();
					onenter();
				}
			}}
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
			<ToolIcon name="circle-alert" class="size-4 shrink-0" />
			{error}
		{/if}
	</p>
</div>
