<script lang="ts">
	// 06-UI-SPEC "AffordabilityResult" (RENT-08): the guideline range, its breakdown, the
	// "Try a rent amount" slider paired with a number input, and the search CTA. All copy is the
	// UI-SPEC contract; it describes a general guideline and never tells the renter what to do.
	// Props only: no storage, no data layer, no network. The CTA only links to the search page.
	import { resolve } from '$app/paths';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import Search from '@lucide/svelte/icons/search';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import ButtonLink from '$lib/components/ui/ButtonLink.svelte';
	import { Slider } from '$lib/components/ui/slider/index.js';
	import {
		landlordIncome,
		moveInCash,
		rentFeedback,
		sliderMax,
		type AffordabilityResult
	} from '@tran/core/renter/affordability';
	import { formatRent } from '@tran/core/renter/format';

	interface Props {
		result: AffordabilityResult | null;
		debts: number;
		savings: number;
		/** The rent being tried; `null` means the top of the range. */
		tried?: number | null;
		idPrefix?: string;
	}

	let { result, debts, savings, tried = $bindable(null), idPrefix = 'afford' }: Props = $props();

	const EMPTY = 'Enter your income to see a rent range.';
	const TRY_LABEL = 'Try a rent amount';
	const STEP = 25;

	const money = (n: number): string => formatRent(n) ?? '$0';

	const headingId = $derived(`${idPrefix}-result`);
	const tryLabelId = $derived(`${idPrefix}-try-label`);
	const tryInputId = $derived(`${idPrefix}-try-input`);
	const tryUnitId = $derived(`${idPrefix}-try-unit`);
	const feedbackId = $derived(`${idPrefix}-try-feedback`);

	const heading = $derived(
		result === null
			? ''
			: result.onlyTop
				? `Rent that fits: up to ${money(result.high)} a month`
				: `Rent that fits: ${money(result.low)} to ${money(result.high)} a month`
	);

	const max = $derived(result ? sliderMax(result.high) : 0);
	const rent = $derived(
		result === null ? 0 : Math.min(max, Math.max(0, tried ?? Math.max(0, result.high)))
	);

	const feedback = $derived.by(() => {
		if (result === null) return null;
		const f = rentFeedback(rent, result.monthlyIncome, debts);
		const r = money(rent);
		if (f.kind === 'aboveDebt') {
			return {
				kind: f.kind,
				text: `At ${r}, rent plus debts would be ${f.totalPct}% of your income, above the 40% check.`
			};
		}
		if (f.kind === 'above30') {
			return {
				kind: f.kind,
				text: `At ${r}, rent is ${f.rentPct}% of your income, above the 30% guideline.`
			};
		}
		return {
			kind: f.kind,
			text: `At ${r}, rent is ${f.rentPct}% of your income, within the 30% guideline.`
		};
	});

	const landlordLine = $derived(
		`Many landlords look for income of about 40 times the monthly rent: ${money(landlordIncome(rent))} a year at this rent.`
	);
	const moveInLine = $derived(
		`Moving in at this rent takes about ${money(moveInCash(rent))} for the first month and a one-month deposit.` +
			(savings > 0 ? ` Your savings cover ${money(savings)}.` : '')
	);
	const debtsNote = $derived(
		result
			? `Your monthly debts take up most of the 40% check, so the range tops out at ${money(result.high)}.`
			: ''
	);

	const searchHref = $derived(result ? resolve('/renter/') + '?max=' + result.high : '');

	function onRentInput(event: Event & { currentTarget: HTMLInputElement }) {
		const value = event.currentTarget.valueAsNumber;
		if (Number.isFinite(value)) tried = Math.min(max, Math.max(0, Math.round(value)));
	}
</script>

{#if result === null}
	<div class="rounded-lg bg-surface p-6">
		<p class="text-base leading-[1.6] text-muted-foreground">{EMPTY}</p>
	</div>
{:else}
	<section
		aria-labelledby={headingId}
		class="grid gap-6 rounded-lg border border-border bg-card p-6"
	>
		<div class="grid gap-2">
			<h2
				id={headingId}
				class="font-display text-heading font-semibold text-foreground tabular-nums"
			>
				{heading}
			</h2>
			{#if result.debtsNote}
				<p class="text-base leading-[1.6] text-foreground">{debtsNote}</p>
			{/if}
		</div>

		<dl class="grid gap-2 text-base leading-[1.6] tabular-nums">
			<div class="flex flex-wrap justify-between gap-x-4 border-b border-border pb-2">
				<dt class="text-muted-foreground">25% of your income</dt>
				<dd class="font-semibold text-foreground">{money(result.pct25)}</dd>
			</div>
			<div class="flex flex-wrap justify-between gap-x-4 border-b border-border pb-2">
				<dt class="text-muted-foreground">30% of your income (a common guideline)</dt>
				<dd class="font-semibold text-foreground">{money(result.pct30)}</dd>
			</div>
			<div class="flex flex-wrap justify-between gap-x-4 border-b border-border pb-2">
				<dt class="text-muted-foreground">Rent + debts at 40% of income</dt>
				<dd class="font-semibold text-foreground">{money(result.debtCheck)}</dd>
			</div>
			<div class="flex flex-wrap justify-between gap-x-4">
				<dt class="text-muted-foreground">Savings cover move-in costs up to</dt>
				<dd class="font-semibold text-foreground">{money(result.savingsCoverRentUpTo)}</dd>
			</div>
		</dl>

		<div class="grid gap-3">
			<div class="flex flex-wrap items-center justify-between gap-3">
				<span id={tryLabelId} class="text-base leading-[1.6] font-semibold text-foreground"
					>{TRY_LABEL}</span
				>
				<div class="flex items-center gap-2">
					<div class="relative">
						<span
							aria-hidden="true"
							class="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-base leading-[1.6] text-muted-foreground"
							>$</span
						>
						<input
							id={tryInputId}
							type="number"
							min="0"
							{max}
							step={STEP}
							value={rent}
							oninput={onRentInput}
							aria-labelledby="{tryLabelId} {tryUnitId}"
							aria-describedby={feedbackId}
							class="h-12 w-36 rounded-md border border-input bg-card pr-3 pl-8 text-base leading-[1.6] text-foreground tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
						/>
					</div>
					<span id={tryUnitId} class="text-base leading-[1.6] text-muted-foreground">a month</span>
				</div>
			</div>
			<Slider
				type="single"
				bind:value={() => rent, (v: number) => (tried = v)}
				min={0}
				{max}
				step={STEP}
				thumbProps={{
					'aria-labelledby': tryLabelId,
					'aria-valuetext': `${money(rent)} a month`,
					'aria-describedby': feedbackId
				}}
			/>
			{#if feedback}
				<p id={feedbackId} class="flex items-start gap-2 text-base leading-[1.6] text-foreground">
					{#if feedback.kind === 'within'}
						<CircleCheck class="mt-0.5 size-5 shrink-0 text-secondary" aria-hidden="true" />
					{:else if feedback.kind === 'above30'}
						<TriangleAlert class="mt-0.5 size-5 shrink-0 text-foreground" aria-hidden="true" />
					{:else}
						<CircleAlert class="mt-0.5 size-5 shrink-0 text-foreground" aria-hidden="true" />
					{/if}
					<span>{feedback.text}</span>
				</p>
			{/if}
			<p class="text-label text-muted-foreground tabular-nums">{landlordLine}</p>
			<p class="text-label text-muted-foreground tabular-nums">{moveInLine}</p>
		</div>

		{#if result.high > 0}
			<div>
				<ButtonLink href={searchHref}>
					<Search size={16} aria-hidden="true" />
					Search rentals up to {money(result.high)}
				</ButtonLink>
			</div>
		{/if}
	</section>
{/if}
