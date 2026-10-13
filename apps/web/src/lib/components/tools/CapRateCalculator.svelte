<script lang="ts">
	// Cap rate calculator (GTM-03). All math is @tran/core capRateCalc; zero network.
	import { capRateCalc, type CapRateInput } from '@tran/core/finance/calculators';
	import { toolMoney, toolPercent } from '@tran/core/finance/tool-inputs';
	import { announce } from '$lib/components/a11y/announcer.svelte';
	import { capRate } from '$lib/content/tools/cap-rate';
	import CalculatorShell from './CalculatorShell.svelte';
	import EmptyResult from './EmptyResult.svelte';
	import Headline from './Headline.svelte';
	import ResultRows from './ResultRows.svelte';
	import { createCalculatorForm, fillAnnouncement, markNegative } from './calculator-form.svelte';

	const content = capRate;
	const form = createCalculatorForm(content.fields, { announce, summary: () => summary });

	const result = $derived(
		form.parsed.ok ? capRateCalc(form.parsed.values as unknown as CapRateInput) : null
	);
	const headline = $derived(result ? toolPercent(result.capRate) : null);
	const summary = $derived(
		result && headline
			? fillAnnouncement(content.announce ?? '', headline, toolMoney(result.noiYearly))
			: null
	);
</script>

<CalculatorShell headingId="cap-rate" fields={content.fields} {form}>
	{#snippet results()}
		{#if result && headline}
			<Headline
				label={content.headlineLabel ?? ''}
				value={markNegative(headline)}
				definition={content.definition ?? ''}
			/>
			<ResultRows
				rows={[
					{
						term: 'Net operating income (yearly)',
						value: markNegative(toolMoney(result.noiYearly))
					},
					{
						term: 'Effective gross income (yearly)',
						value: markNegative(toolMoney(result.egiYearly))
					},
					{ term: 'Operating expenses (yearly)', value: markNegative(toolMoney(result.opexYearly)) }
				]}
			/>
		{:else}
			<EmptyResult body={content.emptyBody ?? ''} />
		{/if}
	{/snippet}
</CalculatorShell>
