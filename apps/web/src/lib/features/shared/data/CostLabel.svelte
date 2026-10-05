<script lang="ts">
	// 04-UI-SPEC "CostLabel": the parenthetical cost inside an action's button label, from
	// gateway.estimateCost(). Body 400 next to the 600 verb, in the same text run, so it is part of
	// the accessible name. Never a tooltip, never visually hidden. Renders nothing while unknown.
	import { formatCost, type CostEstimate } from './copy/provenance';

	let { estimate }: { estimate: CostEstimate | 'free' | null } = $props();
</script>

{#if estimate !== null}<span class="font-normal tabular-nums">{formatCost(estimate)}</span>{/if}
