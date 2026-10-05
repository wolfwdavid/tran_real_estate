<script lang="ts">
	import KeyRound from '@lucide/svelte/icons/key-round';
	import ServerOff from '@lucide/svelte/icons/server-off';
	import Database from '@lucide/svelte/icons/database';

	// Every statement here is an architectural fact, not a marketing claim.
	const items = [
		{
			icon: KeyRound,
			title: 'Your keys stay in your browser',
			body: 'Each key goes only to the service it belongs to. Tran never receives it.'
		},
		{
			icon: ServerOff,
			title: 'Not a brokerage',
			body: "Tran is software. It doesn't act for buyers, sellers, landlords, or tenants, and it doesn't give investment, legal, or tax advice."
		},
		{
			icon: Database,
			title: 'Legitimate data only',
			body: 'Listings and estimates come from RentCast. No scraping and no MLS feeds.'
		}
	];
</script>

<section aria-labelledby="trust-heading" class="bg-secondary-surface py-12 md:py-16">
	<h2 id="trust-heading" class="sr-only">What Tran is, and isn't</h2>
	<ul class="mx-auto grid max-w-page gap-8 px-6 md:grid-cols-3 md:px-8">
		{#each items as item (item.title)}
			<li>
				<item.icon size={24} class="text-secondary" aria-hidden="true" />
				<h3 class="mt-4 text-body font-semibold">{item.title}</h3>
				<p class="mt-2 text-muted-foreground">{item.body}</p>
			</li>
		{/each}
	</ul>
</section>
