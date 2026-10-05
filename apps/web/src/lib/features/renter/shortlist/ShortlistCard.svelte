<script lang="ts">
	// 06-UI-SPEC "ShortlistCard" (RENT-05). Rendered from the stored snapshot, so the board works
	// offline at 0 calls. The rent-change line compares the snapshot against the gateway's cached
	// (or sample) row through peekListingById, which never spends. Removing an item that holds notes
	// or a status past Saved asks first; the board moves focus once the card is gone.
	import { tick, type Snippet } from 'svelte';
	import { resolve } from '$app/paths';
	import History from '@lucide/svelte/icons/history';
	import X from '@lucide/svelte/icons/x';
	import type { Listing } from '@tran/core/listings';
	import { formatMonthDay, formatRent, formatSqft } from '@tran/core/renter/format';
	import { listingStatus } from '@tran/core/renter/listing-status';
	import { needsRemoveConfirm, STATUS_LABELS, type ShortlistItem } from '@tran/core/renter/records';
	import type { DataGateway, Provenance } from '$lib/data';
	import ProvenanceChip from '$lib/features/shared/data/ProvenanceChip.svelte';
	import { Button, ConfirmDialog, announce } from '$lib/features/shared/data/platform-ui';
	import ListingStatusChip from '$lib/features/shared/listings/ListingStatusChip.svelte';
	import PropertyTypeMark from '$lib/features/shared/listings/PropertyTypeMark.svelte';
	import { streetLine as toStreetLine } from '../listing/address';
	import { getShortlistRepo } from '../storage/shortlist-repo';
	import NotesEditor from './NotesEditor.svelte';

	interface Props {
		item: ShortlistItem;
		/** Cache-only reads for the rent-change line; null during prerender and in SSR tests. */
		gateway?: Pick<DataGateway, 'peekListingById'> | null;
		/** Called just before the removal is written, so the board can pick the next focus target. */
		onRemoving?: (listingId: string) => void;
		/** Called when a removal failed, so the board drops its pending focus target. */
		onRemoveFailed?: () => void;
		/** The status area (the Status select); defaults to the plain meta line. */
		status?: Snippet<[{ item: ShortlistItem; streetLine: string }]>;
	}

	let { item, gateway = null, onRemoving, onRemoveFailed, status }: Props = $props();

	const listingId = $derived(item.listingId);
	const enc = $derived(encodeURIComponent(item.listingId));
	const titleId = $derived('item-title-' + enc);
	/** The snapshot is a full mapped Listing at save time; read it defensively all the same. */
	const row = $derived(item.listing as unknown as Partial<Listing> & { id: string });

	const street = $derived(
		toStreetLine({
			formattedAddress: row.formattedAddress ?? '',
			addressLine1: row.addressLine1 ?? null,
			addressLine2: row.addressLine2 ?? null,
			city: row.city ?? null,
			state: row.state ?? null,
			zipCode: row.zipCode ?? ''
		}) || 'This listing'
	);

	const detailHref = $derived(
		resolve('/renter/listing/') + '?' + new URLSearchParams({ id: item.listingId }).toString()
	);

	const provenance = $derived<Provenance>({
		source: item.provenance.source,
		fetchedAt: item.provenance.fetchedAt,
		stale: false
	});

	const facts = $derived.by(() => {
		const parts: string[] = [];
		const beds = row.bedrooms;
		if (beds === 0) parts.push('Studio');
		else if (typeof beds === 'number') parts.push(`${beds} bd`);
		if (typeof row.bathrooms === 'number') parts.push(`${row.bathrooms} ba`);
		const sqft = formatSqft(row.squareFootage);
		if (sqft !== null) parts.push(`${sqft} sq ft`);
		return parts.join(' · ');
	});

	// --- Rent change: snapshot price vs a NEWER cached/sample row (0 calls; reads only) ---------
	let fresh = $state<{ listing: Listing; provenance: Provenance } | undefined>(undefined);

	$effect(() => {
		const id = listingId;
		const gw = gateway;
		if (!gw) return;
		let cancelled = false;
		gw.peekListingById(id).then(
			(r) => {
				if (!cancelled) fresh = r;
			},
			() => {
				if (!cancelled) fresh = undefined;
			}
		);
		return () => {
			cancelled = true;
		};
	});

	const newer = $derived(
		fresh !== undefined && fresh.provenance.fetchedAt > item.provenance.fetchedAt
			? fresh
			: undefined
	);

	const rentChange = $derived.by(() => {
		if (!newer) return null;
		const before = row.price;
		const after = newer.listing.price;
		if (typeof before !== 'number' || typeof after !== 'number' || before === after) return null;
		const on =
			formatMonthDay(newer.listing.lastSeenDate) ??
			formatMonthDay(new Date(newer.provenance.fetchedAt).toISOString());
		return `Rent changed from ${formatRent(before)} to ${formatRent(after)} on ${on}.`;
	});

	/** Recency chip from the newest row we hold (the cached one when newer than the snapshot). */
	const statusRow = $derived({
		status: (newer?.listing.status ?? row.status) || null,
		lastSeenDate: (newer?.listing.lastSeenDate ?? row.lastSeenDate) || null,
		removedDate: (newer?.listing.removedDate ?? row.removedDate) || null
	});

	// Cards show the recency chip only when the listing is gone or has not been seen lately.
	const showStatusChip = $derived(listingStatus(statusRow, new Date()).kind !== 'recent');

	const statusMeta = $derived(
		`${STATUS_LABELS[item.status]} ${formatMonthDay(new Date(item.statusChangedAt).toISOString()) ?? ''}`.trim()
	);

	// --- Remove ------------------------------------------------------------------------------
	const confirmFirst = $derived(needsRemoveConfirm(item));
	let confirmOpen = $state(false);
	let removeEl = $state<HTMLElement | null>(null);
	let removed = false;

	const REMOVE_TITLE = 'Remove this listing from your shortlist?';
	const removeBody = $derived([
		`Your status and notes for ${street} will be deleted from this browser. This can't be undone. You can save the listing again later, but your notes won't come back.`
	]);
	const removeName = $derived(`Remove ${street} from shortlist`);

	async function remove(): Promise<void> {
		onRemoving?.(listingId);
		try {
			await getShortlistRepo().remove(listingId);
		} catch (error) {
			onRemoveFailed?.();
			throw error;
		}
		removed = true;
		announce(`Removed ${street} from your shortlist.`);
	}

	/** bits-ui refocuses the trigger; on a removal the board focuses the next card instead. */
	function restoreFocus(e: Event): void {
		e.preventDefault();
		if (!removed) void tick().then(() => removeEl?.focus());
	}

	const A_MONTH = ' a month';
	const LINK =
		'text-base leading-[1.6] font-semibold [overflow-wrap:anywhere] text-foreground underline-offset-3 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';
</script>

<article
	id="item-{enc}"
	aria-labelledby={titleId}
	tabindex="-1"
	data-shortlist-card={item.listingId}
	data-provenance={item.provenance.source}
	class="grid min-w-0 gap-2 rounded-lg border border-border bg-card p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
>
	<div class="flex flex-wrap items-center gap-x-4 gap-y-2">
		<PropertyTypeMark type={row.propertyType ?? null} size="card" />
		<p class="min-w-0 tabular-nums">
			<span class="font-display text-heading font-semibold text-foreground"
				>{formatRent(row.price) ?? 'Rent not listed'}</span
			>{#if typeof row.price === 'number'}<span
					class="text-base leading-[1.6] text-muted-foreground">{A_MONTH}</span
				>{/if}
		</p>
		{#if item.provenance.source === 'sample'}
			<ProvenanceChip {provenance} />
		{/if}
	</div>

	<!-- eslint-disable svelte/no-navigation-without-resolve -- resolve() plus the ?id= query -->
	<a id={titleId} href={detailHref} class={LINK}>{street}</a>
	<!-- eslint-enable svelte/no-navigation-without-resolve -->
	{#if facts}
		<p class="text-label text-muted-foreground tabular-nums">{facts}</p>
	{/if}

	{#if showStatusChip}
		<div class="flex flex-wrap gap-2">
			<ListingStatusChip row={statusRow} context="card" />
		</div>
	{/if}

	{#if rentChange}
		<p class="flex items-start gap-1 text-label text-foreground tabular-nums" data-rent-change>
			<History class="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
			<span>{rentChange}</span>
		</p>
	{/if}

	{#if status}
		{@render status({ item, streetLine: street })}
	{:else}
		<p class="text-label text-muted-foreground tabular-nums" data-status-meta>{statusMeta}</p>
	{/if}

	<NotesEditor listingId={item.listingId} notes={item.notes} streetLine={street} />

	<div>
		{#if confirmFirst}
			<ConfirmDialog
				bind:open={confirmOpen}
				title={REMOVE_TITLE}
				body={removeBody}
				confirmLabel="Remove listing"
				confirmBusyLabel="Removing…"
				cancelLabel="Keep it"
				onConfirm={remove}
				onCloseAutoFocus={restoreFocus}
			>
				{#snippet trigger({ props })}
					<Button {...props} bind:ref={removeEl} variant="ghost" aria-label={removeName}>
						<X size={16} aria-hidden="true" />
						Remove
					</Button>
				{/snippet}
			</ConfirmDialog>
		{:else}
			<Button bind:ref={removeEl} variant="ghost" aria-label={removeName} onclick={remove}>
				<X size={16} aria-hidden="true" />
				Remove
			</Button>
		{/if}
	</div>
</article>
