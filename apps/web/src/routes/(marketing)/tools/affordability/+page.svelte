<script lang="ts">
	// /tools/affordability/ (GTM-03): the Phase 6 renter calculator, unchanged, inside the shared
	// ToolPage frame. The component is import-clean (shared/affordability: core math, UI primitives,
	// icons only), keeps every input in its own $state and makes no network calls.
	import ToolPage from '$lib/components/tools/ToolPage.svelte';
	import { AffordabilityCalculator } from '$lib/features/shared/affordability';
	import { affordability } from '$lib/content/tools/affordability';
</script>

<ToolPage tool={affordability}><AffordabilityCalculator /></ToolPage>
