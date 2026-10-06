<script lang="ts">
	// The analyzer with autofill (07-15): 07-12's AnalyzerPage (five fieldsets, results, autosave,
	// save) plus the two AutofillButtons in its slots, value estimate at the end of Purchase and rent
	// estimate at the end of Income. The investor port is created here at component setup; the
	// buttons spend only from their click handlers. open() forwards the route's URL params.
	import { useInvestorPort } from '../data/investor-port';
	import AnalyzerPage from './AnalyzerPage.svelte';
	import AutofillButton from './AutofillButton.svelte';

	const port = useInvestorPort();
	let page = $state<AnalyzerPage | null>(null);

	/** Restore from the URL (?id= / ?sample=1 / working draft); see AnalyzerPage.open. */
	export async function open(params: URLSearchParams): Promise<void> {
		await page?.open(params);
	}
</script>

<AnalyzerPage bind:this={page}>
	{#snippet purchaseAutofill(s, ctx)}
		<AutofillButton {port} {s} target="value" onaddressmissing={ctx.addressMissing} />
	{/snippet}
	{#snippet incomeAutofill(s, ctx)}
		<AutofillButton {port} {s} target="rent" onaddressmissing={ctx.addressMissing} />
	{/snippet}
</AnalyzerPage>
