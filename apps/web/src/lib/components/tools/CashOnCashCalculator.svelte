<script lang="ts">
	// Cash-on-cash return calculator (GTM-03). All math is @tran/core cashOnCashCalc; zero network.
	// Negative values keep the U+2212 minus from toolMoney and add the word "(negative)", so the
	// sign never depends on color.
	import { cashOnCashCalc, toolMoney, toolPercent, type CashOnCashInput } from '@tran/core/finance';
	import { announce } from '$lib/components/a11y/announcer.svelte';
	import { TOOLS } from '$lib/content/tools';
	import CalculatorShell from './CalculatorShell.svelte';
	import EmptyResult from './EmptyResult.svelte';
	import Headline from './Headline.svelte';
	import ResultRows from './ResultRows.svelte';
	import { createCalculatorForm, fillAnnouncement, markNegative } from './calculator-form.svelte';

	const content = TOOLS['cash-on-cash'];
	const NO_CASH = 'With no cash invested, there is no cash-on-cash return to show.';
	const form = createCalculatorForm(content.fields, { announce, summary: () => summary });

	// content.negativeSuffix is applied by markNegative.
	const money = (cents: number) => markNegative(toolMoney(cents));

	const result = $derived(
		form.parsed.ok ? cashOnCashCalc(form.parsed.values as unknown as CashOnCashInput) : null
	);
	const percent = $derived(result ? toolPercent(result.cashOnCash) : null);
	const summary = $derived(
		result && percent
			? fillAnnouncement(content.announce ?? '', percent, toolMoney(result.cashFlowYearly))
			: null
	);
</script>

<CalculatorShell headingId="cash-on-cash" fields={content.fields} {form}>
	{#snippet results()}
		{#if result}
			{#if percent}
				<Headline
					label={content.headlineLabel ?? ''}
					value={markNegative(percent)}
					definition={content.definition ?? ''}
				/>
			{:else}
				<p class="text-body font-semibold text-foreground">{content.headlineLabel}</p>
				<p class="text-body text-foreground">{NO_CASH}</p>
			{/if}
			<ResultRows
				rows={[
					{ term: 'Cash flow (yearly)', value: money(result.cashFlowYearly) },
					{ term: 'Cash flow (monthly)', value: money(result.cashFlowMonthly) },
					{ term: 'Total cash invested', value: money(result.totalCashInvested) },
					{
						term: 'Loan payment, principal and interest (monthly)',
						value: money(result.monthlyPayment)
					},
					{ term: 'Net operating income (yearly)', value: money(result.noiYearly) }
				]}
			/>
		{:else}
			<EmptyResult body={content.emptyBody ?? ''} />
		{/if}
	{/snippet}
</CalculatorShell>
