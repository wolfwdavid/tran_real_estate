<script lang="ts">
	// Shared numeric field for MoneyInput / PercentInput / NumberInput (07-UI-SPEC "Analyzer
	// layout"). Plain <label>/<input> with the Phase 3 look (the shared Input/Label drop body size
	// under tailwind-merge). A visible <label for> carries the unit as visually hidden text, so the
	// "$" / "%" / "years" adornments are aria-hidden. Validation runs on blur only: the value is
	// normalized with formatOnBlur, then onvalidate fires. Typing never validates.
	import type { Snippet } from 'svelte';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import { formatOnBlur } from './form-model';

	interface Props {
		id: string;
		label: string;
		value: string;
		kind: 'money' | 'percent' | 'number';
		/** Visually hidden text after the label, e.g. ", in dollars". */
		hiddenUnit?: string;
		prefix?: string;
		suffix?: string;
		inputmode?: 'decimal' | 'numeric';
		helper?: string;
		error?: string | null;
		/** FieldSource chip (07-15), rendered in the label row and linked by aria-describedby. */
		chip?: Snippet;
		onvalidate?: () => void;
		ref?: HTMLInputElement | null;
		/** Keep the label for assistive tech only (expense rows show the line name beside it). */
		labelHidden?: boolean;
	}

	let {
		id,
		label,
		value = $bindable(),
		kind,
		hiddenUnit = '',
		prefix,
		suffix,
		inputmode = 'decimal',
		helper,
		error = null,
		chip,
		onvalidate,
		ref = $bindable(null),
		labelHidden = false
	}: Props = $props();

	const helpId = $derived(`${id}-help`);
	const errorId = $derived(`${id}-error`);
	const chipId = $derived(`${id}-chip`);
	const describedBy = $derived(
		[helper && helpId, error && errorId, chip && chipId].filter(Boolean).join(' ') || undefined
	);

	function handleBlur() {
		value = formatOnBlur(kind, value);
		onvalidate?.();
	}

	const padStart = $derived(prefix ? 'pl-8' : 'pl-4');
	const padEnd = $derived(!suffix ? 'pr-4' : suffix.length > 1 ? 'pr-20' : 'pr-10');
</script>

<div class="grid min-w-0 gap-2">
	<div
		class={labelHidden && !chip ? 'contents' : 'flex flex-wrap items-center justify-between gap-2'}
	>
		<label
			for={id}
			class={labelHidden ? 'sr-only' : 'text-base leading-[1.6] font-semibold text-foreground'}
			>{label}{#if hiddenUnit}<span class="sr-only">{hiddenUnit}</span>{/if}</label
		>
		{#if chip}<span id={chipId} class="inline-flex">{@render chip()}</span>{/if}
	</div>
	<div class="relative">
		{#if prefix}<span
				aria-hidden="true"
				class="pointer-events-none absolute inset-y-0 left-4 flex items-center text-base leading-[1.6] text-muted-foreground"
				>{prefix}</span
			>{/if}
		<input
			{id}
			bind:this={ref}
			bind:value
			type="text"
			{inputmode}
			autocomplete="off"
			spellcheck="false"
			aria-invalid={error ? 'true' : undefined}
			aria-describedby={describedBy}
			onblur={handleBlur}
			class="h-12 w-full min-w-0 rounded-md border bg-card text-base leading-[1.6] text-foreground tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring {padStart} {padEnd} {error
				? 'border-destructive'
				: 'border-input'}"
		/>
		{#if suffix}<span
				aria-hidden="true"
				class="pointer-events-none absolute inset-y-0 right-4 flex items-center text-base leading-[1.6] text-muted-foreground"
				>{suffix}</span
			>{/if}
	</div>
	{#if helper}<p id={helpId} class="text-label text-muted-foreground">{helper}</p>{/if}
	{#if error}
		<p id={errorId} class="flex items-center gap-1 text-label text-destructive">
			<CircleAlert class="size-4 shrink-0" aria-hidden="true" />{error}
		</p>
	{/if}
</div>
