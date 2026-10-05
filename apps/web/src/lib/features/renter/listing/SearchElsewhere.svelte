<script lang="ts">
	// 06-UI-SPEC "SearchElsewhere" (live mode only; the caller decides): three plain same-tab links
	// that open another site's own search for this address. No fetch, no scraping, nothing read back.
	// Sample addresses are made up, so the section is never rendered for sample data.
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import { outboundSearchLinks, type OutboundSearchId } from '@tran/core/renter/contact-links';

	let { fullAddress }: { fullAddress: string } = $props();

	const LABELS: Record<OutboundSearchId, string> = {
		google: 'Search Google',
		zillow: 'Search Zillow',
		apartments: 'Search Apartments.com'
	};
	const EXTERNAL = ' (opens external site)';
	const links = $derived(outboundSearchLinks(fullAddress));
</script>

<section
	class="grid gap-4 rounded-lg border border-border bg-card p-4 sm:p-6"
	aria-labelledby="search-elsewhere-heading"
	data-search-elsewhere
>
	<h2
		id="search-elsewhere-heading"
		class="font-display text-heading font-semibold text-balance text-foreground"
	>
		Look it up elsewhere
	</h2>
	<p class="text-base leading-[1.6] text-foreground">
		Search for this address on other sites. These links open the site's own search. Tran doesn't
		read anything back.
	</p>
	<!-- eslint-disable svelte/no-navigation-without-resolve -- fixed third-party search URLs built by core outboundSearchLinks -->
	<ul class="grid gap-2">
		{#each links as link (link.id)}
			<li>
				<a
					href={link.href}
					rel="noopener noreferrer external"
					class="flex min-h-11 w-full items-center rounded-md text-base leading-[1.6] font-semibold text-primary underline underline-offset-3 hover:text-primary-hover hover:decoration-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:w-auto"
					>{LABELS[link.id]}<ExternalLink size={14} class="ml-1 shrink-0" aria-hidden="true" /><span
						class="sr-only">{EXTERNAL}</span
					></a
				>
			</li>
		{/each}
	</ul>
	<!-- eslint-enable svelte/no-navigation-without-resolve -->
</section>
