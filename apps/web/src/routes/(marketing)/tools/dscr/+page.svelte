<script lang="ts">
	import ToolPage from '$lib/components/tools/ToolPage.svelte';
	import DscrCalculator from '$lib/components/tools/DscrCalculator.svelte';
	import { dscr } from '$lib/content/tools/dscr';
</script>

<ToolPage tool={dscr}><DscrCalculator /></ToolPage>
