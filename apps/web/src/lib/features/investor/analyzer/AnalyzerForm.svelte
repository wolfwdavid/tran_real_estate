<script lang="ts">
	// The analyzer with autofill (07-15): 07-12's AnalyzerPage (five fieldsets, results, autosave,
	// save) plus the two AutofillButtons in its slots, value estimate at the end of Purchase and rent
	// estimate at the end of Income. The investor port is created here at component setup; the
	// buttons spend only from their click handlers. open() forwards the route's URL params.
	//
	// 07-21: each AutofillButton reads its free cost label on mount, so it renders once the data
	// runtime has a gateway and is re-keyed when the gateway is rebuilt (a source or key change).
	// Without this a runtime that starts after the analyzer left the label empty until the pointer
	// or focus reached the button (the 07-13 WatchZipForm / 07-20 BuyBoxForm rule). The shown
	// estimate and any Deep analyze error live on the page state, so a remount loses nothing.
	import { getDataRuntime } from '$lib/data';
	import { useInvestorPort } from '../data/investor-port';
	import AnalyzerPage from './AnalyzerPage.svelte';
	import AutofillButton from './AutofillButton.svelte';

	const runtime = getDataRuntime();
	const port = useInvestorPort();
	let page = $state<AnalyzerPage | null>(null);

	/** Restore from the URL (?id= / ?sample=1 / working draft); see AnalyzerPage.open. */
	export async function open(params: URLSearchParams): Promise<void> {
		await page?.open(params);
	}
</script>

<AnalyzerPage bind:this={page}>
	{#snippet purchaseAutofill(s, ctx)}
		{#if runtime.gateway}
			{#key runtime.gateway}
				<AutofillButton {port} {s} target="value" onaddressmissing={ctx.addressMissing} />
			{/key}
		{/if}
	{/snippet}
	{#snippet incomeAutofill(s, ctx)}
		{#if runtime.gateway}
			{#key runtime.gateway}
				<AutofillButton {port} {s} target="rent" onaddressmissing={ctx.addressMissing} />
			{/key}
		{/if}
	{/snippet}
</AnalyzerPage>
