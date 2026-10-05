<script lang="ts">
	import { fade } from 'svelte/transition';

	let open = $state(false);
</script>

<svelte:head>
	<title>Settings — Tran Real Estate Tools</title>
	<meta
		name="description"
		content="Settings for Tran Real Estate Tools. API key settings arrive in the next release; nothing is stored yet."
	/>
</svelte:head>

<div class="mx-auto max-w-page px-6 py-12 md:px-8 md:py-16">
	<div class="max-w-reading">
		<h1 class="font-display text-display font-semibold">Settings</h1>
		<p class="mt-4 text-body text-muted-foreground">
			Settings for your API keys arrive in the next release. Nothing is stored yet.
		</p>
		<!-- Phase 1 CSP probe: csp.spec.ts drives these testids and the fade transition. Keep both. -->
		<button
			type="button"
			data-testid="csp-transition-toggle"
			aria-expanded={open}
			class="mt-8 inline-flex min-h-11 items-center rounded-md border border-border-strong px-4 text-body font-semibold hover:bg-surface"
			onclick={() => (open = !open)}
		>
			Show what's coming
		</button>
		{#if open}
			<p data-testid="csp-transition-target" class="mt-4 text-muted-foreground" transition:fade>
				The next release adds a place to paste your RentCast and AI keys, a plain-language note on
				where each key goes, and one button to forget them all.
			</p>
		{/if}
	</div>
</div>
