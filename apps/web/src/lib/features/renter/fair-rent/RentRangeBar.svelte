<script lang="ts">
	// 06-UI-SPEC "RentRangeBar": decorative (aria-hidden), because the comparison sentence above it
	// carries the meaning. An 8px track; the estimated range as a segment; the estimate as a 4x16px
	// marker captioned below; the asking rent as a 12px dot captioned above. The two captions sit on
	// opposite sides of the track, so they never overlap however close the markers are.
	//
	// Scale and clamping come from @tran/core's rangeBarScale (never divides by zero). Each caption
	// uses left: p% with translateX(-p%), which keeps it inside the track at both ends and centred
	// over its marker in the middle. Positions are style attribute writes (CSP style-src-attr allows).
	import { rangeBarScale } from '@tran/core/renter/fair-rent';
	import { formatRent } from '@tran/core/renter/format';

	interface Props {
		low: number;
		high: number;
		estimate: number;
		asking: number;
	}

	let { low, high, estimate, asking }: Props = $props();

	const scale = $derived(rangeBarScale(low, high, asking));
	const pct = (v: number) => Math.round(scale.pos(v) * 10000) / 100;
	const lowP = $derived(pct(low));
	const highP = $derived(pct(high));
	const estP = $derived(pct(estimate));
	const askP = $derived(pct(asking));
</script>

<div aria-hidden="true" class="grid gap-1 select-none" data-rent-range-bar>
	<div class="relative h-5">
		<span
			class="absolute top-0 text-label whitespace-nowrap text-foreground tabular-nums"
			style:left="{askP}%"
			style:transform="translateX(-{askP}%)"
			data-caption="asking">Asking {formatRent(asking)}</span
		>
	</div>
	<div class="relative h-4">
		<div class="absolute inset-x-0 top-1 h-2 rounded-full border border-input bg-surface"></div>
		<div
			class="absolute top-1 h-2 rounded-full border border-secondary bg-secondary-surface"
			style:left="{lowP}%"
			style:width="{Math.max(highP - lowP, 0)}%"
			data-segment="range"
		></div>
		<div
			class="absolute top-0 h-4 w-1 -translate-x-1/2 bg-secondary"
			style:left="{estP}%"
			data-marker="estimate"
		></div>
		<div
			class="absolute top-0.5 size-3 -translate-x-1/2 rounded-full bg-foreground"
			style:left="{askP}%"
			data-marker="asking"
		></div>
	</div>
	<div class="relative h-5">
		<span
			class="absolute top-0 text-label whitespace-nowrap text-foreground tabular-nums"
			style:left="{estP}%"
			style:transform="translateX(-{estP}%)"
			data-caption="estimate">Estimate {formatRent(estimate)}</span
		>
	</div>
</div>
