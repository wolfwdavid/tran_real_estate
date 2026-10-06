<script lang="ts">
	// 06-UI-SPEC "/renter/listing/?id= layout" (RENT-03). One column below 1024px; from 1024px a
	// main column and a 360px <aside aria-label="Rent and contact"> (sticky when the viewport is tall
	// enough to show all of it). The aside holds the rent and shortlist toggle, the listing contact
	// and, in live mode only, the "look it up elsewhere" links. Below 1024px the aside follows the
	// header, so rent, the shortlist toggle and the contact come before the long sections.
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import { resolve } from '$app/paths';
	import type { Listing } from '@tran/core/listings';
	import type { RawHistory } from '@tran/core/renter/history';
	import { toRawHistory } from './history';
	import type { GatewayError as GatewayErrorType, Provenance } from '$lib/data';
	import GatewayError from '$lib/features/shared/data/GatewayError.svelte';
	import PriceHistory from '$lib/features/shared/listings/PriceHistory.svelte';
	import FairRentCheck from '../fair-rent/FairRentCheck.svelte';
	import OutreachSection from '../outreach/OutreachSection.svelte';
	import { streetLine } from './address';
	import ListingContact from './ListingContact.svelte';
	import ListingFacts from './ListingFacts.svelte';
	import ListingHeader from './ListingHeader.svelte';
	import RentAndActions from './RentAndActions.svelte';
	import SearchElsewhere from './SearchElsewhere.svelte';

	interface Props {
		row: Listing;
		provenance: Provenance;
		mode: 'sample' | 'live';
		onRefresh?: () => Promise<void>;
		refreshError?: GatewayErrorType | null;
		focusHeading?: boolean;
	}

	let {
		row,
		provenance,
		mode,
		onRefresh,
		refreshError = null,
		focusHeading = false
	}: Props = $props();

	const now = new Date();
	const street = $derived(streetLine(row));
	const isSample = $derived(provenance.source === 'sample');

	/** The mapped PriceEvent list back into RentCast's date-keyed shape for PriceHistory. */
	const history = $derived<RawHistory>(toRawHistory(row.history));

	const searchHref = resolve('/renter/');

	/** Back to the results the renter came from (keeps their filters and scroll), else to Search. */
	function back(e: MouseEvent): void {
		if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
			return;
		}
		try {
			const ref = new URL(document.referrer);
			if (
				ref.origin === location.origin &&
				ref.pathname === searchHref &&
				window.history.length > 1
			) {
				e.preventDefault();
				window.history.back();
			}
		} catch {
			// No referrer (direct visit, bookmark): follow the link.
		}
	}
</script>

<div class="grid gap-8">
	<a
		href={searchHref}
		onclick={back}
		class="inline-flex min-h-11 items-center gap-1 self-start justify-self-start text-base leading-[1.6] font-semibold text-primary underline underline-offset-3 hover:text-primary-hover hover:decoration-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
	>
		<ArrowLeft size={16} aria-hidden="true" />
		Back to results
	</a>

	<div class="grid gap-12 md:gap-16 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-x-8">
		<div class="grid gap-4 lg:col-start-1">
			<ListingHeader {row} {provenance} {now} {onRefresh} {focusHeading} />
			{#if refreshError}
				<GatewayError error={refreshError} />
			{/if}
		</div>

		<aside
			aria-label="Rent and contact"
			class="detail-aside grid content-start gap-8 lg:col-start-2 lg:row-span-5 lg:row-start-1 lg:self-start"
		>
			<RentAndActions {row} {provenance} streetLine={street} />
			<ListingContact {row} {provenance} />
			{#if mode === 'live' && !isSample}
				<SearchElsewhere fullAddress={row.formattedAddress} />
			{/if}
		</aside>

		<div class="lg:col-start-1">
			<ListingFacts {row} {now} />
		</div>
		<div class="lg:col-start-1">
			<FairRentCheck {row} {provenance} />
		</div>
		<div class="lg:col-start-1">
			<PriceHistory {history} listedDate={row.listedDate} sample={isSample} />
		</div>
		<div class="lg:col-start-1">
			<OutreachSection {row} {provenance} />
		</div>
	</div>
</div>

<style>
	/* Sticky only where the whole aside fits on screen; a taller aside would hide its own end. */
	@media (min-width: 64rem) and (min-height: 56rem) {
		.detail-aside {
			position: sticky;
			top: 1rem;
		}
	}
</style>
