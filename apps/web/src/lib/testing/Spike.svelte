<script lang="ts">
	let { planted = false }: { planted?: boolean } = $props();
</script>

<button type="button">Search rentals <span>(1 call)</span></button>
{#if planted}
	<!-- Planted axe violation for the non-vacuity check. -->
	<!-- svelte-ignore a11y_missing_attribute -->
	<img src="/planted.png" />
{/if}
