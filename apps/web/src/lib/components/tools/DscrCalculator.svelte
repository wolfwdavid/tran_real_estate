<script lang="ts">
	// DSCR calculator (GTM-03). All math is @tran/core dscrCalc; zero network. A $0 loan is valid
	// and shows the not-applicable state. The interpretation line is plain arithmetic (covers or
	// doesn't cover), never a verdict on the property.
	import { dscrCalc, type DscrInput } from '@tran/core/finance/calculators';
	import { toolMoney, toolRatio } from '@tran/core/finance/tool-inputs';
	import { announce } from '$lib/components/a11y/announcer.svelte';
	import { TOOLS } from '$lib/content/tools';
	import CalculatorShell from './CalculatorShell.svelte';
	import EmptyResult from './EmptyResult.svelte';
	import Headline from './Headline.svelte';
	import ResultRows from './ResultRows.svelte';
	import { createCalculatorForm, fillAnnouncement, markNegative } from './calculator-form.svelte';

	const content = TOOLS.dscr;
	const form = createCalculatorForm(content.fields, { announce, summary: () => summary });

	const result = $derived(
		form.parsed.ok ? dscrCalc(form.parsed.values as unknown as DscrInput) : null
	);
	const dscr = $derived(result?.applicable && result.dscr !== null ? result.dscr : null);
	const noiRow = $derived(
		result
			? { term: 'Net operating income (yearly)', value: markNegative(toolMoney(result.noiYearly)) }
			: null
	);
	const summary = $derived(
		result && dscr !== null
			? fillAnnouncement(content.announce ?? '', toolRatio(dscr) ?? '', toolMoney(result.noiYearly))
			: null
	);
</script>

<CalculatorShell headingId="dscr" fields={content.fields} {form}>
	{#snippet results()}
		{#if result && noiRow}
			{#if dscr !== null}
				<Headline
					label={content.headlineLabel ?? ''}
					value={markNegative(toolRatio(dscr) ?? '')}
					definition={content.definition ?? ''}
				/>
				<p class="mt-2 text-body text-foreground">
					{dscr >= 1 ? content.covers : content.doesNotCover}
				</p>
				<ResultRows
					rows={[
						noiRow,
						{ term: 'Loan payments (yearly)', value: toolMoney(result.debtServiceYearly) },
						{ term: 'Loan payment (monthly)', value: toolMoney(result.monthlyPayment) },
						{
							term: 'Income left after loan payments (yearly)',
							value: markNegative(toolMoney(result.cashAfterDebtYearly))
						}
					]}
				/>
			{:else}
				<p class="text-body font-semibold text-foreground">{content.headlineLabel}</p>
				<p class="text-body text-foreground">{content.notApplicable}</p>
				<ResultRows rows={[noiRow]} />
			{/if}
		{:else}
			<EmptyResult body={content.emptyBody ?? ''} />
		{/if}
	{/snippet}
</CalculatorShell>
