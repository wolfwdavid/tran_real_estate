<script lang="ts">
	// 10-UI-SPEC "CalculatorShell": inputs card + results card, stacked below 1024px and a 7fr/5fr
	// grid from 1024px. Enter only re-validates (results are live). The results section is a
	// labelled section, NOT a live region: the form announces one debounced summary instead.
	import type { Snippet } from 'svelte';
	import CalculatorIcon from '@lucide/svelte/icons/calculator';
	import { SHARED_TOOL_COPY as C, type ToolField } from '$lib/content/tools';
	import type { CalculatorForm } from './calculator-form.svelte';
	import NumberField from './NumberField.svelte';

	interface Props {
		/** Unique per calculator; prefixes the field ids and the results heading id. */
		headingId: string;
		fields: readonly ToolField[];
		form: CalculatorForm;
		results: Snippet;
	}

	let { headingId, fields, form, results }: Props = $props();

	const inputId = (fieldId: string) => `${headingId}-${fieldId}`;
	const focusInput = (fieldId: string | undefined) => {
		if (fieldId) document.getElementById(inputId(fieldId))?.focus();
	};

	function onsubmit(e: SubmitEvent) {
		e.preventDefault();
		const bad = form.submit();
		if (bad) focusInput(bad);
	}

	function onclear() {
		form.clear();
		focusInput(fields[0]?.id);
	}

	const card = 'rounded-lg border border-border bg-card p-6 shadow-card md:p-8';
	const button =
		'inline-flex h-12 min-w-11 cursor-pointer items-center justify-center gap-1 rounded-md px-6 text-body font-semibold whitespace-nowrap text-foreground hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';
</script>

<div class="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start lg:gap-8">
	<div class={card}>
		<form novalidate {onsubmit} aria-labelledby="{headingId}-inputs">
			<h2 id="{headingId}-inputs" class="font-display text-heading font-semibold text-foreground">
				{C.inputsHeading}
			</h2>
			<div class="mt-6 grid gap-4">
				{#each fields as field (field.id)}
					<NumberField
						{field}
						id={inputId(field.id)}
						bind:value={form.values[field.id]}
						error={form.errors[field.id] ?? null}
						onblur={() => form.blur(field.id)}
					/>
				{/each}
			</div>
			<div class="mt-6 flex flex-wrap gap-3">
				<button
					type="button"
					class="{button} border border-border-strong"
					onclick={() => form.fill()}
				>
					<CalculatorIcon class="size-4" aria-hidden="true" />
					{C.fillExample}
				</button>
				<button type="button" class={button} onclick={onclear}>{C.clear}</button>
			</div>
			{#if form.isExample}
				<p class="mt-2 text-label text-muted-foreground">{C.exampleNote}</p>
			{/if}
		</form>
	</div>
	<section aria-labelledby="{headingId}-results" class="{card} lg:sticky lg:top-6">
		<h2 id="{headingId}-results" class="font-display text-heading font-semibold text-foreground">
			{C.resultsHeading}
		</h2>
		<div class="mt-4">
			{@render results()}
		</div>
	</section>
</div>
