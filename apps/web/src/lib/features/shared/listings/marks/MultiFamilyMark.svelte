<!-- Two-unit duplex: the Phase 2 InvestorMark duplex without the ledger card. Decorative only. -->
<script lang="ts">
	let { size = 64 }: { size?: number } = $props();
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 64 64"
	aria-hidden="true"
	focusable="false"
	stroke-width="1.5"
	stroke-linejoin="round"
	stroke-linecap="round"
>
	<path class="fill-deco-sage stroke-foreground" d="M10 54V30l11-10 11 10v24Z" />
	<path class="fill-deco-sage stroke-foreground" d="M32 54V30l11-10 11 10v24Z" />
	<path class="fill-none stroke-foreground" d="M8 31.8 21 20l11 10 11-10 13 11.8" />
	<rect class="fill-surface stroke-foreground" x="16" y="34" width="5" height="6" rx="0.5" />
	<rect class="fill-surface stroke-foreground" x="38" y="34" width="5" height="6" rx="0.5" />
	<path class="fill-surface stroke-foreground" d="M23 54v-9h5v9Z" />
	<path class="fill-surface stroke-foreground" d="M45 54v-9h5v9Z" />
	<path class="fill-none stroke-foreground" d="M6 54h52" />
</svg>
