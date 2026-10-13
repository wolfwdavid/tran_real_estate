<script lang="ts">
	import ToolPage from '$lib/components/tools/ToolPage.svelte';
	import CashOnCashCalculator from '$lib/components/tools/CashOnCashCalculator.svelte';
	import { cashOnCash } from '$lib/content/tools/cash-on-cash';
</script>

<ToolPage tool={cashOnCash}><CashOnCashCalculator /></ToolPage>
