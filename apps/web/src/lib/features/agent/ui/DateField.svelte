<script lang="ts">
	// Native date input with input styling. The value is a local calendar date (YYYY-MM-DD) and is
	// passed through untouched; compare it with the helpers in ../dates.ts, never via UTC parsing.
	import { Label } from '$lib/components/ui/label/index.js';

	let {
		id,
		label,
		value = $bindable(''),
		invalid = false,
		describedby,
		required = false,
		disabled = false
	}: {
		id: string;
		label: string;
		value?: string;
		invalid?: boolean;
		describedby?: string;
		required?: boolean;
		disabled?: boolean;
	} = $props();
</script>

<div class="flex flex-col gap-2">
	<Label for={id}>{label}</Label>
	<input
		{id}
		type="date"
		bind:value
		{required}
		{disabled}
		aria-invalid={invalid ? 'true' : undefined}
		aria-describedby={describedby}
		class="h-12 w-full min-w-0 rounded-md border border-input bg-card px-4 text-base leading-[1.6] text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:bg-surface disabled:text-muted-foreground aria-invalid:border-destructive"
	/>
</div>
