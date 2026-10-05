<!-- Five-storey slim condo tower with balcony rails on alternate floors. Decorative only. -->
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
	<path class="fill-surface stroke-foreground" d="M22 56V10h20v46Z" />
	<path class="fill-none stroke-foreground" d="M19 10h26" />
	<rect class="fill-surface stroke-foreground" x="25" y="12" width="5" height="5" rx="0.5" />
	<rect class="fill-surface stroke-foreground" x="34" y="12" width="5" height="5" rx="0.5" />
	<rect class="fill-surface stroke-foreground" x="25" y="20.5" width="5" height="4.5" rx="0.5" />
	<rect class="fill-surface stroke-foreground" x="34" y="20.5" width="5" height="4.5" rx="0.5" />
	<path class="fill-deco-sage stroke-foreground" d="M19 25h26v3H19Z" />
	<path class="fill-none stroke-foreground" d="M24 25v3M29 25v3M35 25v3M40 25v3" />
	<rect class="fill-surface stroke-foreground" x="25" y="30" width="5" height="5" rx="0.5" />
	<rect class="fill-surface stroke-foreground" x="34" y="30" width="5" height="5" rx="0.5" />
	<rect class="fill-surface stroke-foreground" x="25" y="38.5" width="5" height="4.5" rx="0.5" />
	<rect class="fill-surface stroke-foreground" x="34" y="38.5" width="5" height="4.5" rx="0.5" />
	<path class="fill-deco-sage stroke-foreground" d="M19 43h26v3H19Z" />
	<path class="fill-none stroke-foreground" d="M24 43v3M29 43v3M35 43v3M40 43v3" />
	<path class="fill-deco-terracotta stroke-foreground" d="M29 56v-6a3 3 0 0 1 6 0v6Z" />
	<path class="fill-none stroke-foreground" d="M12 56h40" />
</svg>
