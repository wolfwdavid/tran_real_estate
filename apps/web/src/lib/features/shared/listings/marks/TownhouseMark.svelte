<!-- Three narrow attached townhouses with a shared stepped roofline and three doors. Decorative only. -->
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
	<path class="fill-surface stroke-foreground" d="M11 56V26l7-10 7 10v30Z" />
	<path class="fill-deco-sage stroke-foreground" d="M25 56V30l7-10 7 10v26Z" />
	<path class="fill-surface stroke-foreground" d="M39 56V34l7-10 7 10v22Z" />
	<path class="fill-none stroke-foreground" d="M9 28.9 18 16l7 10 7-6 7 10 7-6 9 12.9" />
	<rect class="fill-surface stroke-foreground" x="15.5" y="31" width="5" height="5" rx="0.5" />
	<rect class="fill-surface stroke-foreground" x="29.5" y="35" width="5" height="5" rx="0.5" />
	<rect class="fill-surface stroke-foreground" x="43.5" y="39" width="5" height="4" rx="0.5" />
	<path class="fill-deco-terracotta stroke-foreground" d="M15.5 56v-9h5v9Z" />
	<path class="fill-deco-terracotta stroke-foreground" d="M29.5 56v-9h5v9Z" />
	<path class="fill-deco-terracotta stroke-foreground" d="M43.5 56v-9h5v9Z" />
	<path class="fill-none stroke-foreground" d="M7 56h50" />
</svg>
