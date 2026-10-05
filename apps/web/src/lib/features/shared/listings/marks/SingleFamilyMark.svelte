<!-- Single-family house: the Phase 2 AgentMark house without the speech bubble. Decorative only. -->
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
	<path class="fill-surface stroke-foreground" d="M18 56V34h28v22Z" />
	<path class="fill-deco-terracotta stroke-foreground" d="M14 35 32 19l18 16Z" />
	<rect class="fill-surface stroke-foreground" x="22" y="40" width="7" height="7" rx="0.5" />
	<path class="fill-deco-terracotta stroke-foreground" d="M34 56V44h7v12Z" />
	<path class="fill-none stroke-foreground" d="M8 56h48" />
</svg>
