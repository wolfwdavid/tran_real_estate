<script lang="ts">
	const steps = [
		{
			title: 'Pick your portal',
			body: 'Renter, Investor, or Agent. Each one is built around a single job.'
		},
		{
			title: 'Add your own keys',
			body: "Paste a free RentCast key for listings. Add an AI key from Anthropic, OpenAI, Google, or OpenRouter if you want drafting help. Sample data is there if you'd rather look around first."
		},
		{
			title: 'Get to a result',
			body: 'Matching listings, an analyzed deal, or a ready-to-send draft. Nothing is sent until you choose to send it.'
		}
	];
</script>

<section id="how-it-works" aria-labelledby="how-heading" class="bg-surface py-12 md:py-16">
	<div class="mx-auto max-w-page px-6 md:px-8">
		<p class="text-label font-semibold tracking-[0.06em] text-secondary uppercase">How it works</p>
		<h2 id="how-heading" class="mt-2 font-display text-heading font-semibold">
			Three steps, no account
		</h2>
		<ol class="mt-8 grid gap-8 md:grid-cols-3">
			{#each steps as step, i (step.title)}
				<li>
					<span
						aria-hidden="true"
						class="flex size-10 items-center justify-center rounded-full border border-primary font-semibold text-primary tabular-nums"
						>{i + 1}</span
					>
					<h3 class="mt-4 text-body font-semibold">{step.title}</h3>
					<p class="mt-2 text-muted-foreground">{step.body}</p>
				</li>
			{/each}
		</ol>
	</div>
</section>
