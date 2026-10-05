<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	let { shortlistCount = null }: { shortlistCount?: number | null } = $props();

	// Route ids, not pathnames, so aria-current is already in the prerendered HTML under any base
	// (the PortalSwitcher pattern). The listing detail belongs to Search.
	const links = [
		{
			href: resolve('/renter/'),
			label: 'Search',
			ids: ['/(app)/renter', '/(app)/renter/listing']
		},
		{ href: resolve('/renter/shortlist/'), label: 'Shortlist', ids: ['/(app)/renter/shortlist'] },
		{
			href: resolve('/renter/affordability/'),
			label: 'Affordability',
			ids: ['/(app)/renter/affordability']
		}
	];

	const current = (ids: string[]) =>
		page.route.id !== null && ids.includes(page.route.id) ? 'page' : undefined;
	// The link reads "Shortlist 3 listings". A variable, because Svelte trims a leading space in
	// literal element text.
	const listingsSuffix = $derived(shortlistCount === 1 ? ' listing' : ' listings');
	const showCount = $derived(typeof shortlistCount === 'number' && shortlistCount > 0);
</script>

<nav aria-label="Renter tools" class="border-b border-border">
	<ul class="mx-auto flex max-w-page flex-wrap items-center px-6 md:px-8">
		{#each links as l (l.label)}
			<li>
				<a
					href={l.href}
					aria-current={current(l.ids)}
					class="inline-flex min-h-11 items-center gap-2 px-4 text-body text-foreground underline-offset-[6px] hover:underline aria-[current=page]:font-semibold aria-[current=page]:underline aria-[current=page]:decoration-primary aria-[current=page]:decoration-2"
					>{l.label}
					{#if l.label === 'Shortlist' && showCount}<span
							class="rounded-full bg-surface px-2 text-label font-semibold tabular-nums"
							>{shortlistCount}<span class="sr-only">{listingsSuffix}</span></span
						>{/if}</a
				>
			</li>
		{/each}
	</ul>
</nav>
