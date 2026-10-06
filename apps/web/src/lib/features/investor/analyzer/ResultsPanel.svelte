<script lang="ts">
	// ResultsPanel (07-UI-SPEC "ResultsPanel", INV-01). Pure rendering of a DealAnalysis: headline,
	// metric list with each one-line definition inside its <dd> (no hover tooltip), the missing-inputs
	// note, Show the math and the analyzer disclaimer. Not a live region: the page announces once
	// after a sample, an autofill or an open. Labels and definitions come from METRIC_DEFINITIONS.
	// Negative figures use U+2212 in the normal text color; nothing here is ever red.
	import Calculator from '@lucide/svelte/icons/calculator';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import CircleMinus from '@lucide/svelte/icons/circle-minus';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import {
		METRIC_DEFINITIONS,
		type DealAnalysis,
		type DealInputs,
		type MetricKey,
		type NullReason
	} from '@tran/core/finance';
	import { NOT_AVAILABLE, pct, ratio, usd } from '@tran/core/format';
	import { Button } from '$lib/features/shared/data/platform-ui';
	import { fieldName, type AnalyzerForm, type ParsedForm } from './form-model';

	interface Props {
		analysis: DealAnalysis | null;
		inputs: DealInputs | null;
		masked: ParsedForm['masked'];
		form: AnalyzerForm;
		/** Try a sample deal (empty state). */
		onsample?: () => void;
		/** Move focus to a field by its input id (missing-inputs links). */
		onfocusfield?: (id: string) => void;
		/** Expense line amount input id prefix (ExpenseLines idPrefix). */
		expenseIdPrefix?: string;
	}

	let {
		analysis,
		inputs,
		masked,
		form,
		onsample,
		onfocusfield,
		expenseIdPrefix = 'expense'
	}: Props = $props();

	let heading = $state<HTMLElement | null>(null);

	/** Focus the Results heading (after Try a sample deal). */
	export function focusHeading(): void {
		heading?.focus();
	}

	const REASON: Record<NullReason, string> = {
		'no-loan': 'No loan',
		'no-cash-invested': 'No cash invested',
		'needs-interest-rate': 'Needs interest rate',
		'no-rent': 'Needs monthly rent',
		'no-price': 'Needs purchase price'
	};

	type Cell = { value: string; na?: undefined } | { value?: undefined; na: string };
	type Masked = keyof ParsedForm['masked'];

	function cell(
		metric: Masked | null,
		value: number | null,
		reason: NullReason | undefined,
		fmt: (v: number) => string
	): Cell {
		const key = metric ? masked[metric] : undefined;
		if (key) return { na: `Needs ${fieldName(form, key)}` };
		if (value === null) return { na: REASON[reason ?? 'no-price'] };
		return { value: fmt(value) };
	}

	interface Row {
		key: MetricKey;
		cell: Cell;
	}

	const headline = $derived(
		analysis ? cell('cashFlow', analysis.cashFlowMonthly, analysis.reasons.cashFlow, usd) : null
	);

	const rows = $derived.by((): Row[] => {
		const a = analysis;
		if (!a) return [];
		return [
			{ key: 'coc', cell: cell('coc', a.cocPct, a.reasons.coc, (v) => pct(v, 1)) },
			{
				key: 'capRate',
				cell: cell('capRate', a.capRatePct, a.reasons.capRate, (v) => pct(v, 1))
			},
			{ key: 'noi', cell: cell('noi', a.noiAnnual, undefined, usd) },
			{ key: 'dscr', cell: cell('dscr', a.dscr, a.reasons.dscr, (v) => ratio(v, 2)) },
			{ key: 'grm', cell: cell('grm', a.grm, a.reasons.grm, (v) => ratio(v, 1)) },
			{
				key: 'onePct',
				cell: cell('onePct', a.rentToPricePct, a.reasons.rentToPrice, (v) => pct(v, 2))
			}
		];
	});

	// Missing-inputs note: exactly what is blank, with a link per item that focuses the field.
	const lineInputId = (kind: 'tax' | 'insurance') => {
		const line = form.expenses.find((l) => l.kind === kind);
		return line ? `${expenseIdPrefix}-${line.id}-amount` : null;
	};
	const taxMissing = $derived(analysis?.missing.includes('property-tax') ?? false);
	const insuranceMissing = $derived(analysis?.missing.includes('insurance') ?? false);
	const rateMissing = $derived(analysis?.missing.includes('interest-rate') ?? false);
	const expenseNote = $derived(
		taxMissing && insuranceMissing
			? 'Property tax and insurance are blank, so expenses may be understated.'
			: taxMissing
				? 'Property tax is blank, so expenses may be understated.'
				: insuranceMissing
					? 'Insurance is blank, so expenses may be understated.'
					: null
	);

	const neg = (cents: number) => usd(-cents);

	type MathRow = { label: string; cell: Cell; total?: boolean };
	const monthRows = $derived.by((): MathRow[] => {
		const a = analysis;
		if (!a || !inputs) return [];
		return [
			{ label: 'Rent', cell: { value: usd(inputs.rentCents) } },
			{ label: 'Other income', cell: { value: usd(inputs.otherIncomeCents) } },
			{ label: 'Vacancy allowance', cell: cell('noi', a.vacancyMonthly, undefined, neg) },
			{
				label: 'Effective income',
				cell: cell('noi', a.egiMonthly, undefined, usd),
				total: true
			},
			{
				label: 'Operating expenses before vacancy',
				cell: cell('noi', a.opexMonthly, undefined, neg)
			},
			{
				label: 'Net operating income',
				cell: cell('noi', a.noiMonthly, undefined, usd),
				total: true
			},
			{
				label: 'Loan payment (principal and interest)',
				cell: cell('payment', a.paymentMonthly, a.reasons.payment, neg)
			},
			{
				label: 'Cash flow',
				cell: cell('cashFlow', a.cashFlowMonthly, a.reasons.cashFlow, usd),
				total: true
			}
		];
	});

	const closeRows = $derived.by((): MathRow[] => {
		const a = analysis;
		if (!a) return [];
		return [
			{ label: 'Down payment', cell: cell('cashNeeded', a.downPaymentCents, undefined, usd) },
			{ label: 'Closing costs', cell: cell('cashNeeded', a.closingCents, undefined, usd) },
			{ label: 'Repairs', cell: cell('cashNeeded', a.repairsCents, undefined, usd) },
			{
				label: 'Total cash needed',
				cell: cell('cashNeeded', a.cashInvestedCents, undefined, usd),
				total: true
			},
			{ label: 'Loan amount', cell: cell('loan', a.loanCents, undefined, usd) }
		];
	});

	const figure = 'font-semibold text-foreground tabular-nums';
	const muted = 'text-label text-muted-foreground';
	const link =
		'cursor-pointer text-base leading-[1.6] font-semibold text-foreground underline underline-offset-4 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

	function focusField(e: MouseEvent, id: string | null) {
		if (!id) return;
		e.preventDefault();
		onfocusfield?.(id);
	}
</script>

{#snippet notAvailable(reason: string)}
	<span aria-hidden="true">{NOT_AVAILABLE}</span><span class="sr-only">Not available</span>
	<span class="ml-2 text-label font-normal text-muted-foreground">{reason}</span>
{/snippet}

{#snippet value(c: Cell)}
	{#if c.na !== undefined}{@render notAvailable(c.na)}{:else}{c.value}{/if}
{/snippet}

<!-- tabindex 0: while sticky the panel scrolls on its own, so keyboard users must reach it (UI-SPEC). -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<section
	id="results"
	aria-labelledby="results-heading"
	tabindex="0"
	class="results grid scroll-mt-4 gap-6 rounded-lg border border-border bg-card p-4 shadow-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:p-6"
>
	<div>
		<h2
			id="results-heading"
			bind:this={heading}
			tabindex="-1"
			class="font-display text-heading font-semibold text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
		>
			Results
		</h2>
		<p class="mt-1 {muted}">Updates as you type.</p>
	</div>

	{#if !analysis || !headline}
		<div class="flex gap-3 rounded-md bg-surface p-4" data-results-empty>
			<Calculator class="mt-1 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
			<div class="grid justify-items-start gap-4">
				<p class="text-base leading-[1.6] text-foreground">
					Enter a purchase price and monthly rent to see cash flow, cap rate, and the rest. Manual
					entry uses no API calls.
				</p>
				<Button variant="outline" onclick={() => onsample?.()}>Try a sample deal</Button>
			</div>
		</div>
	{:else}
		{#if expenseNote || rateMissing}
			<div class="grid gap-2" data-missing-inputs>
				{#if rateMissing}
					<p class="flex gap-2 text-base leading-[1.6] text-foreground">
						<TriangleAlert class="mt-1 size-4 shrink-0 text-foreground" aria-hidden="true" />
						<span>
							Interest rate is blank, so cash flow, cash-on-cash return, and DSCR are waiting on it.
							<a href="#rate" class={link} onclick={(e) => focusField(e, 'rate')}
								>Enter interest rate</a
							>
						</span>
					</p>
				{/if}
				{#if expenseNote}
					{@const taxId = lineInputId('tax')}
					{@const insId = lineInputId('insurance')}
					<p class="flex gap-2 text-base leading-[1.6] text-foreground">
						<TriangleAlert class="mt-1 size-4 shrink-0 text-foreground" aria-hidden="true" />
						<span>
							{expenseNote}
							<span class="inline-flex flex-wrap gap-x-3">
								{#if taxMissing && taxId}<a
										href="#{taxId}"
										class={link}
										onclick={(e) => focusField(e, taxId)}>Enter property tax</a
									>{/if}
								{#if insuranceMissing && insId}<a
										href="#{insId}"
										class={link}
										onclick={(e) => focusField(e, insId)}>Enter insurance</a
									>{/if}
							</span>
						</span>
					</p>
				{/if}
			</div>
		{/if}

		<div data-headline>
			<p class="text-base leading-[1.6] font-semibold text-foreground">
				{METRIC_DEFINITIONS.cashFlow.resultsLabel}
			</p>
			<p class="text-display leading-[1.2] {figure}" data-metric="cashFlow">
				{@render value(headline)}
			</p>
			<p class="mt-1 {muted}">{METRIC_DEFINITIONS.cashFlow.definition}</p>
		</div>

		<dl class="grid gap-4">
			{#each rows as row (row.key)}
				<div class="grid gap-1 min-[360px]:grid-cols-[minmax(0,1fr)_auto]" data-metric={row.key}>
					<dt
						class="text-base leading-[1.6] font-semibold text-foreground min-[360px]:col-start-1 min-[360px]:row-start-1"
					>
						{METRIC_DEFINITIONS[row.key].resultsLabel}
					</dt>
					<dd
						class="m-0 grid gap-1 min-[360px]:col-span-2 min-[360px]:col-start-1 min-[360px]:row-start-1 min-[360px]:grid-cols-subgrid"
					>
						<span
							class="text-heading leading-[1.2] min-[360px]:col-start-2 min-[360px]:text-right {figure}"
							>{@render value(row.cell)}</span
						>
						{#if row.key === 'onePct' && row.cell.value !== undefined}
							<span class="min-[360px]:col-span-2">
								{#if analysis.meetsOnePct}
									<span
										class="inline-flex items-center gap-1 rounded-full bg-secondary-surface px-2 py-1 text-label font-semibold text-secondary"
										><CircleCheck class="size-4" aria-hidden="true" />Meets the 1% rule</span
									>
								{:else}
									<span
										class="inline-flex items-center gap-1 rounded-full bg-surface px-2 py-1 text-label font-semibold text-foreground"
										><CircleMinus class="size-4 text-muted-foreground" aria-hidden="true" />Below 1%</span
									>
								{/if}
							</span>
						{/if}
						<span class="block min-[360px]:col-span-2 {muted}"
							>{METRIC_DEFINITIONS[row.key].definition}</span
						>
					</dd>
				</div>
			{/each}
		</dl>

		<details class="rounded-md border border-border">
			<summary
				class="flex min-h-11 cursor-pointer touch-manipulation items-center px-4 text-base leading-[1.6] font-semibold text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
			>
				Show the math
			</summary>
			<div class="grid gap-4 px-4 pb-4">
				{#each [{ title: 'Each month', items: monthRows }, { title: 'Cash to close', items: closeRows }] as group (group.title)}
					<div>
						<h3 class="text-base leading-[1.6] font-semibold text-foreground">{group.title}</h3>
						<dl class="mt-2 grid">
							{#each group.items as item (item.label)}
								<div
									class="flex flex-wrap justify-between gap-x-4 border-b border-border py-2 last:border-b-0"
								>
									<dt
										class="text-base leading-[1.6] text-foreground {item.total
											? 'font-semibold'
											: ''}"
									>
										{item.label}
									</dt>
									<dd
										class="m-0 text-right text-base leading-[1.6] text-foreground tabular-nums {item.total
											? 'font-semibold'
											: ''}"
									>
										{@render value(item.cell)}
									</dd>
								</div>
							{/each}
						</dl>
					</div>
				{/each}
			</div>
		</details>
	{/if}

	<p class="border-t border-border pt-4 text-label text-foreground">
		These figures are arithmetic on the numbers you entered. They're not investment, legal, or tax
		advice. Check every number before you rely on it.
	</p>

	<a href="#analyzer-form" class="lg:hidden {link} inline-flex min-h-11 items-center self-start"
		>Back to inputs</a
	>
</section>

<style>
	/* Sticky only where it fits: 1024px+ wide AND 800px+ tall (07-UI-SPEC "Analyzer layout"). */
	@media (min-width: 1024px) and (min-height: 800px) {
		.results {
			position: sticky;
			top: 24px;
			max-height: calc(100dvh - 48px);
			overflow-y: auto;
		}
	}
</style>
