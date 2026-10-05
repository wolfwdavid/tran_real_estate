<script lang="ts">
	// 06-UI-SPEC "ListingCard" (RENT-02): an <article> named by its address link. The whole card is
	// clickable through the stretched address link (Phase 2 PortalCard pattern: one tab stop for the
	// link, plus the shortlist toggle above it). No photos and no availability claims: the card says
	// what RentCast reported and when, and every sample row carries its own Sample data chip.
	//
	// Generic props (row/provenance/now) so the map preview (06-19) and Phase 7 can reuse it.
	import BellDot from '@lucide/svelte/icons/bell-dot';
	import { resolve } from '$app/paths';
	import type { Listing } from '@tran/core/listings';
	import { formatRent, formatSqft, relativeListed } from '@tran/core/renter/format';
	import { propertyTypeLabel } from '@tran/core/renter';
	import { listingStatus } from '@tran/core/renter/listing-status';
	import type { Provenance } from '$lib/data';
	import ProvenanceChip from '$lib/features/shared/data/ProvenanceChip.svelte';
	import ListingStatusChip from '$lib/features/shared/listings/ListingStatusChip.svelte';
	import PropertyTypeMark from '$lib/features/shared/listings/PropertyTypeMark.svelte';
	import { placeLine, streetLine } from '../listing/address';
	import ShortlistToggle from '../shortlist/ShortlistToggle.svelte';

	interface Props {
		row: Listing;
		provenance: Provenance;
		now?: Date;
		/** New since the last visit (06-20 supplies the ids). */
		isNew?: boolean;
		/** Linked to the map selection: outline + aria-current. */
		selected?: boolean;
		/** Hovered/focused from the map: the same outline, no aria-current. */
		highlighted?: boolean;
		/** Split-view list column: no mark disc. */
		compact?: boolean;
		/** Pointer hover (hover-capable devices only) and keyboard focus within the card. */
		onhover?: (id: string | null) => void;
	}

	let {
		row,
		provenance,
		now = new Date(),
		isNew = false,
		selected = false,
		highlighted = false,
		compact = false,
		onhover
	}: Props = $props();

	// Constants: Svelte trims the leading space of literal element text.
	const A_MONTH = ' a month';
	const SINCE_LAST_VISIT = ' since your last visit';
	const SEP = ' · ';
	const NBSP = ' ';

	const addrId = $derived(`card-${row.id}-addr`);
	const street = $derived(streetLine(row));
	const place = $derived(placeLine(row));
	const rent = $derived(formatRent(row.price));
	const type = $derived(propertyTypeLabel(row.propertyType));
	const listed = $derived(relativeListed(row.listedDate, now));
	const sqft = $derived(formatSqft(row.squareFootage));
	const href = $derived(
		`${resolve('/renter/listing/')}?${new URLSearchParams({ id: row.id }).toString()}`
	);

	const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

	/** "$1,650 a month, 2 bedrooms, 1.5 bathrooms, Condo, listed 7 days ago." (missing parts left out) */
	const summary = $derived.by(() => {
		const parts: string[] = [rent ? `${rent} a month` : 'Rent not listed'];
		if (row.bedrooms === 0) parts.push('studio');
		else if (row.bedrooms !== null) parts.push(plural(row.bedrooms, 'bedroom'));
		if (row.bathrooms !== null) parts.push(plural(row.bathrooms, 'bathroom'));
		if (sqft) parts.push(`${sqft} square feet`);
		parts.push(type);
		parts.push(listed ? `listed ${listed}` : 'listing date not shown');
		return `${parts.join(', ')}.`;
	});

	interface Fact {
		key: 'studio' | 'beds' | 'baths' | 'sqft';
		value?: string;
	}

	/** "2 bd · 1 ba · 850 sq ft" / "Studio · 1 ba": missing parts are left out, never shown as 0. */
	const facts = $derived.by(() => {
		const out: Fact[] = [];
		if (row.bedrooms === 0) out.push({ key: 'studio' });
		else if (row.bedrooms !== null) out.push({ key: 'beds', value: String(row.bedrooms) });
		if (row.bathrooms !== null) out.push({ key: 'baths', value: String(row.bathrooms) });
		if (sqft) out.push({ key: 'sqft', value: sqft });
		return out;
	});

	const status = $derived(listingStatus(row, now));
	const hasChips = $derived(provenance.source === 'sample' || isNew || status.kind !== 'recent');

	function hoverCapable(): boolean {
		return typeof matchMedia === 'function' && matchMedia('(hover: hover)').matches;
	}

	function onFocusOut(e: FocusEvent): void {
		const card = e.currentTarget as HTMLElement;
		if (!card.contains(e.relatedTarget as Node | null)) onhover?.(null);
	}
</script>

{#snippet bd()}<abbr title="bedrooms">bd</abbr>{/snippet}
{#snippet ba()}<abbr title="bathrooms">ba</abbr>{/snippet}

<article
	aria-labelledby={addrId}
	aria-current={selected ? 'true' : undefined}
	data-provenance={provenance.source}
	data-listing-card={row.id}
	class="relative flex h-full gap-4 rounded-lg border border-border bg-card p-4 shadow-card transition-[box-shadow,transform] duration-200 ease-out hover:shadow-card-hover has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-ring motion-safe:hover:-translate-y-0.5 {selected ||
	highlighted
		? 'outline-2 outline-offset-2 outline-foreground'
		: ''}"
	onpointerenter={() => {
		if (hoverCapable()) onhover?.(row.id);
	}}
	onpointerleave={() => {
		if (hoverCapable()) onhover?.(null);
	}}
	onfocusin={() => onhover?.(row.id)}
	onfocusout={onFocusOut}
>
	<p class="sr-only">{summary}</p>
	{#if !compact}
		<PropertyTypeMark type={row.propertyType} size="card" />
	{/if}
	<div class="flex min-w-0 flex-1 flex-col gap-2">
		<div class="flex items-start justify-between gap-2">
			<p class="min-w-0 tabular-nums">
				{#if rent}
					<span class="font-display text-heading font-semibold text-foreground">{rent}</span><span
						class="text-base leading-[1.6] text-muted-foreground">{A_MONTH}</span
					>
				{:else}
					<span class="text-base leading-[1.6] font-semibold text-foreground">Rent not listed</span>
				{/if}
			</p>
			<div class="shrink-0">
				<ShortlistToggle {row} {provenance} variant="card" streetLine={street} />
			</div>
		</div>
		{#if facts.length > 0}
			<p class="text-base leading-[1.6] text-foreground tabular-nums">
				{#each facts as fact, i (fact.key)}{#if i > 0}{SEP}{/if}{#if fact.key === 'studio'}Studio{:else if fact.key === 'beds'}{fact.value}{NBSP}{@render bd()}{:else if fact.key === 'baths'}{fact.value}{NBSP}{@render ba()}{:else}{fact.value}{NBSP}sq
						ft{/if}{/each}
			</p>
		{/if}
		<div class="min-w-0">
			<!-- eslint-disable svelte/no-navigation-without-resolve -- resolve() plus the ?id= query -->
			<a
				id={addrId}
				{href}
				class="text-base leading-[1.6] font-semibold [overflow-wrap:anywhere] text-foreground underline-offset-3 after:absolute after:inset-0 after:rounded-lg after:content-[''] hover:underline focus-visible:outline-none"
				>{street}</a
			>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
			{#if place}
				<p class="text-label [overflow-wrap:anywhere] text-muted-foreground">{place}</p>
			{/if}
		</div>
		<p class="text-label text-muted-foreground">
			{#if listed}{type}{SEP}Listed {listed}{:else}{type}{SEP}Listing date not shown{/if}
		</p>
		{#if hasChips}
			<div class="flex flex-wrap items-center gap-2">
				{#if provenance.source === 'sample'}
					<ProvenanceChip {provenance} now={now.getTime()} />
				{/if}
				{#if isNew}
					<span
						data-new-badge
						class="inline-flex items-center gap-1 rounded-full bg-accent-surface px-2 py-1 text-label font-semibold whitespace-nowrap text-foreground"
					>
						<BellDot class="size-3.5" aria-hidden="true" />
						New<span class="sr-only">{SINCE_LAST_VISIT}</span>
					</span>
				{/if}
				<ListingStatusChip {row} {now} context="card" />
			</div>
		{/if}
	</div>
</article>
