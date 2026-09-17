<script lang="ts">
	import { fade } from 'svelte/transition';

	let open = $state(false);
</script>

<svelte:head>
	<title>Settings — Tran Real Estate Tools</title>
</svelte:head>

<h1>Settings</h1>
<button type="button" data-testid="csp-transition-toggle" onclick={() => (open = !open)}>
	Toggle details
</button>
{#if open}
	<p data-testid="csp-transition-target" transition:fade>Placeholder settings panel.</p>
{/if}
