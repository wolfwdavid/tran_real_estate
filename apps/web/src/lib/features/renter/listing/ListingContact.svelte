<script lang="ts">
	// 06-UI-SPEC "ListingContact" (RENT-03): who is renting the listing and how to reach them. Every
	// href comes from @tran/core/renter/contact-links, which accepts only a US phone, a bare email
	// and an http(s) URL. A value that fails its check renders NO row (never a raw listing string in
	// an href). Tran never contacts anyone: these links open the renter's own phone or email app.
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import Globe from '@lucide/svelte/icons/globe';
	import Mail from '@lucide/svelte/icons/mail';
	import Phone from '@lucide/svelte/icons/phone';
	import type { Listing } from '@tran/core/listings';
	import { formatPhone, mailtoHref, safeHttpUrl, telHref } from '@tran/core/renter/contact-links';
	import type { Provenance } from '$lib/data';
	import ProvenanceChip from '$lib/features/shared/data/ProvenanceChip.svelte';

	let { row, provenance }: { row: Listing; provenance: Provenance } = $props();

	const people = $derived([row.agent, row.office]);

	/** The first agent-then-office value whose safe href exists. */
	function first<T>(pick: (c: NonNullable<Listing['agent']>) => T | null): T | null {
		for (const c of people) {
			const v = c ? pick(c) : null;
			if (v !== null) return v;
		}
		return null;
	}

	const phone = $derived(
		first((c) => {
			const href = telHref(c.phone);
			const label = formatPhone(c.phone);
			return href && label ? { href, label } : null;
		})
	);
	const email = $derived(
		first((c) => {
			const href = mailtoHref(c.email);
			return href ? { href, label: href.slice('mailto:'.length) } : null;
		})
	);
	const website = $derived(first((c) => safeHttpUrl(c.website)));

	const agentName = $derived(row.agent?.name?.trim() || null);
	const officeName = $derived(row.office?.name?.trim() || null);
	const hasRows = $derived(phone !== null || email !== null || website !== null);

	const NOTE = "Tran doesn't contact anyone for you. These open your phone or email app.";
	const EMPTY =
		"RentCast didn't include contact details for this listing. Look it up elsewhere to find who's renting it.";
	const EXTERNAL = ' (opens external site)';
	const ROW =
		'flex min-h-11 w-full items-center gap-2 rounded-md text-base leading-[1.6] font-semibold text-primary underline underline-offset-3 [overflow-wrap:anywhere] hover:text-primary-hover hover:decoration-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:w-auto';
</script>

<section
	class="grid gap-4 rounded-lg border border-border bg-card p-4 sm:p-6"
	aria-labelledby="listing-contact-heading"
	data-listing-contact
	data-provenance={provenance.source}
>
	<div class="flex flex-wrap items-center gap-2">
		<h2
			id="listing-contact-heading"
			class="font-display text-heading font-semibold text-balance text-foreground"
		>
			Listing contact
		</h2>
		{#if provenance.source === 'sample'}
			<ProvenanceChip {provenance} />
		{/if}
	</div>

	{#if agentName || officeName}
		<div class="grid gap-1 [overflow-wrap:anywhere]">
			{#if agentName}
				<p class="text-base leading-[1.6] font-semibold text-foreground">{agentName}</p>
			{/if}
			{#if officeName}
				<p class="text-base leading-[1.6] text-muted-foreground">{officeName}</p>
			{/if}
		</div>
	{/if}

	{#if hasRows}
		<!-- eslint-disable svelte/no-navigation-without-resolve -- tel:, mailto: and validated http(s) hrefs from contact-links, not app routes -->
		<ul class="grid gap-2">
			{#if phone}
				<li>
					<a class={ROW} href={phone.href}>
						<Phone size={16} class="shrink-0" aria-hidden="true" />
						<span class="tabular-nums">Call {phone.label}</span>
					</a>
				</li>
			{/if}
			{#if email}
				<li>
					<a class={ROW} href={email.href}>
						<Mail size={16} class="shrink-0" aria-hidden="true" />
						<span>Email {email.label}</span>
					</a>
				</li>
			{/if}
			{#if website}
				<li>
					<a class={ROW} href={website} rel="noopener noreferrer external">
						<Globe size={16} class="shrink-0" aria-hidden="true" />
						<span
							>Visit website<ExternalLink
								size={14}
								class="ml-1 inline align-baseline"
								aria-hidden="true"
							/><span class="sr-only">{EXTERNAL}</span></span
						>
					</a>
				</li>
			{/if}
		</ul>
		<!-- eslint-enable svelte/no-navigation-without-resolve -->
		<p class="text-label text-muted-foreground">{NOTE}</p>
	{:else}
		<p class="text-base leading-[1.6] text-foreground">{EMPTY}</p>
	{/if}
</section>
