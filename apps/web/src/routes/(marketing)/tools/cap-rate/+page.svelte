<script lang="ts">
	import ToolPage from '$lib/components/tools/ToolPage.svelte';
	import CapRateCalculator from '$lib/components/tools/CapRateCalculator.svelte';
	import { capRate } from '$lib/content/tools/cap-rate';
</script>

<ToolPage tool={capRate}><CapRateCalculator /></ToolPage>
