<script lang="ts">
	// One 8px series marker as an SVG primitive (07-UI-SPEC "Chart series tokens"). Drawn inside
	// an existing <svg>; colors are token utilities only, so markers match the line and legend.
	import { fillClass, strokeClass, type ChartToken, type MarkerShape } from './series-style';

	let { shape, token, x, y }: { shape: MarkerShape; token: ChartToken; x: number; y: number } =
		$props();

	const fill = $derived(fillClass(token));
</script>

{#if shape === 'diamond'}
	<path d="M{x} {y - 4}L{x + 4} {y}L{x} {y + 4}L{x - 4} {y}Z" class={fill} />
{:else if shape === 'square'}
	<rect x={x - 4} y={y - 4} width="8" height="8" class={fill} />
{:else if shape === 'circle'}
	<circle cx={x} cy={y} r="4" class={fill} />
{:else if shape === 'triangle'}
	<path d="M{x} {y - 4}L{x + 4} {y + 4}L{x - 4} {y + 4}Z" class={fill} />
{:else}
	<circle cx={x} cy={y} r="3" class="fill-card stroke-2 {strokeClass(token)}" />
{/if}
