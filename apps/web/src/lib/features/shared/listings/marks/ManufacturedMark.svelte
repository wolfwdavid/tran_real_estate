<!-- Long single-storey manufactured home on a skirting band with a small porch step. Decorative only. -->
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
	<path class="fill-surface stroke-foreground" d="M6 46V30h42v16Z" />
	<path class="fill-deco-terracotta stroke-foreground" d="M4 30h46l-4-6H8Z" />
	<rect class="fill-surface stroke-foreground" x="11" y="34" width="8" height="6" rx="0.5" />
	<rect class="fill-surface stroke-foreground" x="24" y="34" width="8" height="6" rx="0.5" />
	<path class="fill-surface stroke-foreground" d="M38 46V33h6v13Z" />
	<path class="fill-deco-sage stroke-foreground" d="M7 46h40v6H7Z" />
	<path class="fill-none stroke-foreground" d="M15 46v6M23 46v6M31 46v6M39 46v6" />
	<path class="fill-surface stroke-foreground" d="M48 52v-6h5v3h4v3Z" />
	<path class="fill-none stroke-foreground" d="M2 52h60" />
</svg>
