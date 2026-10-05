<script lang="ts">
	// /renter/affordability/ (RENT-08): the shared, persistence-free calculator. Zero API calls;
	// the inputs live only in the component's state, so a reload starts empty.
	import Lock from '@lucide/svelte/icons/lock';
	import { AffordabilityCalculator } from '$lib/features/shared/affordability';

	const PRIVACY = "These numbers stay on this page. Tran doesn't save them.";
</script>

<svelte:head>
	<title>What rent fits your budget: Tran Real Estate Tools</title>
	<meta
		name="description"
		content="Enter your income and monthly debts to see a rent range based on common rules of thumb. A general guideline, not financial advice."
	/>
</svelte:head>

<div class="mx-auto max-w-page px-6 py-12 md:px-8 md:py-16">
	<div class="max-w-reading">
		<h1 class="font-display text-display font-semibold">What rent fits your budget</h1>
		<p class="mt-4 text-body text-muted-foreground">
			Enter your income and monthly debts to see a rent range based on common rules of thumb. It
			uses no API calls.
		</p>
		<p class="mt-2 flex items-center gap-1 text-label text-muted-foreground">
			<Lock size={14} class="shrink-0" aria-hidden="true" />
			{PRIVACY}
		</p>
	</div>
	<div class="mt-8">
		<AffordabilityCalculator />
	</div>
</div>
