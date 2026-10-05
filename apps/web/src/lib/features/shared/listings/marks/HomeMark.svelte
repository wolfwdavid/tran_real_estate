<!-- Plain gabled home outline with no windows: the fallback for unknown property types. Decorative only. -->
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
	<path class="fill-surface stroke-foreground" d="M18 56V33l14-14 14 14v23Z" />
	<path class="fill-none stroke-foreground" d="M14 37 32 19l18 18" />
	<path class="fill-none stroke-foreground" d="M12 56h40" />
</svg>
