<script lang="ts">
	// 06-UI-SPEC "SearchForm" filter fieldsets (RENT-01). Every change applies locally at once
	// through search.setFilters (0 calls, no submit). Chips are real radios/checkboxes visually
	// hidden inside the <label> that draws the chip.
	import { untrack } from 'svelte';
	import Check from '@lucide/svelte/icons/check';
	import {
		LISTED_WITHIN,
		propertyTypeLabel,
		RENTER_PROPERTY_TYPES,
		type BedsFilter,
		type ListedWithin,
		type RenterPropertyType
	} from '@tran/core/renter';
	import type { RenterSearch } from './search-state.svelte';

	let { search }: { search: RenterSearch } = $props();

	const BEDS: readonly { value: BedsFilter; label: string }[] = [
		{ value: 'any', label: 'Any' },
		{ value: 0, label: 'Studio' },
		{ value: 1, label: '1' },
		{ value: 2, label: '2' },
		{ value: 3, label: '3' },
		{ value: '4+', label: '4+' }
	];
	const DAYS: readonly { value: ListedWithin; label: string }[] = [
		{ value: 'any', label: 'Any time' },
		...LISTED_WITHIN.map((d) => ({ value: d, label: `${d} days` }))
	];

	const RENT_ERROR =
		'The minimum is higher than the maximum. Lower the minimum or raise the maximum.';

	/** Whole dollars from "2,000" / "$2000"; blank or anything else is no bound. */
	function parseDollars(text: string): number | null {
		const digits = text.replace(/[\s,$]/g, '');
		if (!/^\d+$/.test(digits)) return null;
		const n = Number(digits);
		return Number.isSafeInteger(n) ? n : null;
	}
	const show = (n: number | null): string => (n === null ? '' : String(n));

	// The inputs keep what the user typed ("2,000"); they resync only when the filter changes from
	// elsewhere (a removed chip, Clear filters, URL restore).
	let minText = $state(untrack(() => show(search.filters.priceMin)));
	let maxText = $state(untrack(() => show(search.filters.priceMax)));
	$effect(() => {
		const min = search.filters.priceMin;
		const max = search.filters.priceMax;
		untrack(() => {
			if (parseDollars(minText) !== min) minText = show(min);
			if (parseDollars(maxText) !== max) maxText = show(max);
		});
	});

	function setRent(which: 'min' | 'max', text: string) {
		if (which === 'min') minText = text;
		else maxText = text;
		const value = parseDollars(text);
		search.setFilters(
			which === 'min'
				? { ...search.filters, priceMin: value }
				: { ...search.filters, priceMax: value }
		);
	}

	function toggleType(type: RenterPropertyType, checked: boolean) {
		const types = checked
			? [...search.filters.types, type]
			: search.filters.types.filter((t) => t !== type);
		// Canonical UI order whatever the click order.
		search.setFilters({
			...search.filters,
			types: RENTER_PROPERTY_TYPES.filter((t) => types.includes(t))
		});
	}

	const chip = (checked: boolean) =>
		[
			'relative inline-flex min-h-11 cursor-pointer touch-manipulation items-center gap-1 rounded-full border px-4 text-base leading-[1.6]',
			'has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-ring',
			checked
				? 'border-foreground bg-foreground font-semibold text-card'
				: 'border-input bg-card font-normal text-foreground'
		].join(' ');

	// The native control covers its chip invisibly: it stays the click/focus target (keyboard and
	// pointer reach the real radio/checkbox) while the label draws the chip.
	const HIDDEN_INPUT = 'absolute inset-0 m-0 size-full cursor-pointer appearance-none opacity-0';

	const legend = 'text-base leading-[1.6] font-semibold text-foreground';
	const helper = 'text-label text-muted-foreground';
	const fieldset = 'min-w-0 lg:border-l lg:border-border lg:pl-4 lg:first:border-l-0 lg:first:pl-0';
</script>

<div class="flex flex-col gap-4 lg:flex-row lg:flex-wrap">
	<fieldset class={fieldset}>
		<legend class={legend}>Rent a month</legend>
		<div class="mt-2 flex flex-col gap-2 sm:flex-row">
			<div class="grid gap-2">
				<label for="renter-rent-min" class="text-base leading-[1.6] text-foreground">Min</label>
				<div class="relative">
					<span
						aria-hidden="true"
						class="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-base leading-[1.6] text-muted-foreground"
						>$</span
					>
					<input
						id="renter-rent-min"
						type="text"
						inputmode="numeric"
						pattern="[0-9,]*"
						autocomplete="off"
						value={minText}
						oninput={(e) => setRent('min', e.currentTarget.value)}
						class="h-12 w-full rounded-md border border-input bg-card pr-4 pl-8 text-base leading-[1.6] text-foreground tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:w-32"
					/>
				</div>
			</div>
			<div class="grid gap-2">
				<label for="renter-rent-max" class="text-base leading-[1.6] text-foreground">Max</label>
				<div class="relative">
					<span
						aria-hidden="true"
						class="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-base leading-[1.6] text-muted-foreground"
						>$</span
					>
					<input
						id="renter-rent-max"
						type="text"
						inputmode="numeric"
						pattern="[0-9,]*"
						autocomplete="off"
						value={maxText}
						oninput={(e) => setRent('max', e.currentTarget.value)}
						aria-invalid={search.rentError ? 'true' : undefined}
						aria-describedby={search.rentError ? 'renter-rent-error' : undefined}
						class="h-12 w-full rounded-md border bg-card pr-4 pl-8 text-base leading-[1.6] text-foreground tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:w-32 {search.rentError
							? 'border-destructive'
							: 'border-input'}"
					/>
				</div>
			</div>
		</div>
		{#if search.rentError}
			<p id="renter-rent-error" class="mt-2 max-w-reading text-label text-destructive">
				{RENT_ERROR}
			</p>
		{/if}
	</fieldset>

	<fieldset class={fieldset}>
		<legend class={legend}>Bedrooms</legend>
		<div class="mt-2 flex flex-wrap gap-2">
			{#each BEDS as option (option.value)}
				{@const checked = search.filters.beds === option.value}
				<label class={chip(checked)}>
					<input
						type="radio"
						name="renter-beds"
						class={HIDDEN_INPUT}
						value={String(option.value)}
						{checked}
						onchange={() => search.setFilters({ ...search.filters, beds: option.value })}
					/>
					{#if checked}<Check class="size-4" aria-hidden="true" />{/if}
					{option.label}
				</label>
			{/each}
		</div>
	</fieldset>

	<fieldset class={fieldset} aria-describedby="renter-type-help">
		<legend class={legend}>Property type</legend>
		<p id="renter-type-help" class={helper}>Leave all unchecked to include every type.</p>
		<div class="mt-2 flex flex-wrap gap-2">
			{#each RENTER_PROPERTY_TYPES as type (type)}
				{@const checked = search.filters.types.includes(type)}
				<label class={chip(checked)}>
					<input
						type="checkbox"
						class={HIDDEN_INPUT}
						value={type}
						{checked}
						onchange={(e) => toggleType(type, e.currentTarget.checked)}
					/>
					{#if checked}<Check class="size-4" aria-hidden="true" />{/if}
					{propertyTypeLabel(type)}
				</label>
			{/each}
		</div>
	</fieldset>

	<fieldset class={fieldset} aria-describedby="renter-days-help">
		<legend class={legend}>Listed within</legend>
		<p id="renter-days-help" class="{helper} max-w-reading">
			RentCast records when a listing first appeared. Recent listings are more likely to still be
			open, but only the listing contact can confirm that.
		</p>
		<div class="mt-2 flex flex-wrap gap-2">
			{#each DAYS as option (option.value)}
				{@const checked = search.filters.listedWithin === option.value}
				<label class={chip(checked)}>
					<input
						type="radio"
						name="renter-days"
						class={HIDDEN_INPUT}
						value={String(option.value)}
						{checked}
						onchange={() => search.setFilters({ ...search.filters, listedWithin: option.value })}
					/>
					{#if checked}<Check class="size-4" aria-hidden="true" />{/if}
					{option.label}
				</label>
			{/each}
		</div>
	</fieldset>
</div>
