<script lang="ts">
	// 06-UI-SPEC "ShortlistToggle" (RENT-05): one control that saves a listing to the shortlist and
	// removes it again. Card variant: 44px outline **Save** / **Saved** above the card's stretched
	// link. Detail variant: primary **Save to shortlist** → outline **On your shortlist** + a link to
	// the item on the shortlist. Removing an item that holds notes or a status past Saved asks first
	// (ConfirmDialog, initial focus on **Keep it**). Storage only: this never calls the gateway.
	import { tick } from 'svelte';
	import { resolve } from '$app/paths';
	import Bookmark from '@lucide/svelte/icons/bookmark';
	import BookmarkCheck from '@lucide/svelte/icons/bookmark-check';
	import type { Provenance } from '$lib/data';
	import { needsRemoveConfirm, type ShortlistItem } from '@tran/core/renter/records';
	import { Button, ConfirmDialog, announce } from '$lib/features/shared/data/platform-ui';
	import { live } from '$lib/storage/live.svelte';
	import { requestPersistence } from '$lib/storage/persistence';
	import { getShortlistRepo, type ShortlistListing } from '../storage/shortlist-repo';

	interface Props {
		row: ShortlistListing;
		provenance: Pick<Provenance, 'source' | 'fetchedAt'>;
		variant: 'card' | 'detail';
		/** The address's street line, used in names, the dialog body and announcements. */
		streetLine: string;
	}

	let { row, provenance, variant, streetLine }: Props = $props();

	// Re-created when the listing changes; the repo is touched only when the query runs (browser).
	const saved = $derived.by(() => {
		const id = row.id;
		return live<ShortlistItem | undefined>(() => getShortlistRepo().getByListingId(id), undefined);
	});
	const item = $derived(saved.current);
	const isSaved = $derived(item !== undefined);
	const confirmFirst = $derived(item !== undefined && needsRemoveConfirm(item));

	let busy = $state(false);
	let confirmOpen = $state(false);
	let buttonEl = $state<HTMLElement | null>(null);

	const shortlistHref = $derived(
		resolve('/renter/shortlist/') + '#item-' + encodeURIComponent(row.id)
	);

	const REMOVE_TITLE = 'Remove this listing from your shortlist?';
	const removeBody = $derived([
		`Your status and notes for ${streetLine} will be deleted from this browser. This can't be undone. You can save the listing again later, but your notes won't come back.`
	]);

	const cardName = $derived(
		isSaved ? `Saved to shortlist: ${streetLine}` : `Save ${streetLine} to shortlist`
	);

	async function remove(): Promise<void> {
		await getShortlistRepo().remove(row.id);
		announce(`Removed ${streetLine} from your shortlist.`);
	}

	/** Set by a confirmed removal: focus the plain button once the liveQuery swaps it in. */
	let focusAfterSwap = $state(false);

	async function confirmRemove(): Promise<void> {
		await remove();
		focusAfterSwap = true;
	}

	$effect(() => {
		if (focusAfterSwap && buttonEl && !confirmFirst) {
			buttonEl.focus();
			focusAfterSwap = false;
		}
	});

	async function toggle(): Promise<void> {
		if (busy) return;
		if (!isSaved) {
			// Phase 3 rule: the first repo save asks for persistent storage, synchronously, first.
			void requestPersistence();
			busy = true;
			try {
				await getShortlistRepo().add(row, provenance);
				announce(`Saved ${streetLine} to your shortlist.`);
			} finally {
				busy = false;
			}
			return;
		}
		busy = true;
		try {
			await remove();
		} finally {
			busy = false;
		}
	}

	/**
	 * bits-ui would refocus the trigger, which a confirmed removal unmounts. Keep it: focus the
	 * same trigger. Remove listing: the effect above focuses the button that replaces it.
	 */
	function restoreFocus(e: Event): void {
		e.preventDefault();
		if (!focusAfterSwap) void tick().then(() => buttonEl?.focus());
	}

	const CARD_CLASS = 'relative z-1 h-11 px-4';
</script>

{#snippet label()}
	{#if variant === 'card'}
		{#if isSaved}
			<BookmarkCheck size={16} aria-hidden="true" />
			Saved
		{:else}
			<Bookmark size={16} aria-hidden="true" />
			Save
		{/if}
	{:else if isSaved}
		<BookmarkCheck size={16} aria-hidden="true" />
		On your shortlist
	{:else}
		<Bookmark size={16} aria-hidden="true" />
		Save to shortlist
	{/if}
{/snippet}

{#snippet control()}
	{#if confirmFirst}
		<ConfirmDialog
			bind:open={confirmOpen}
			title={REMOVE_TITLE}
			body={removeBody}
			confirmLabel="Remove listing"
			confirmBusyLabel="Removing…"
			cancelLabel="Keep it"
			onConfirm={confirmRemove}
			onCloseAutoFocus={restoreFocus}
		>
			{#snippet trigger({ props })}
				<Button
					{...props}
					bind:ref={buttonEl}
					variant="outline"
					class={variant === 'card' ? CARD_CLASS : undefined}
					aria-pressed="true"
					aria-label={variant === 'card' ? cardName : undefined}
					data-shortlist-toggle={variant}
				>
					{@render label()}
				</Button>
			{/snippet}
		</ConfirmDialog>
	{:else}
		<Button
			bind:ref={buttonEl}
			variant={variant === 'detail' && !isSaved ? 'default' : 'outline'}
			class={variant === 'card' ? CARD_CLASS : undefined}
			aria-pressed={isSaved ? 'true' : 'false'}
			aria-label={variant === 'card' ? cardName : undefined}
			data-shortlist-toggle={variant}
			onclick={toggle}
		>
			{@render label()}
		</Button>
	{/if}
{/snippet}

{#if variant === 'card'}
	{@render control()}
{:else}
	<div class="flex flex-col items-start gap-2">
		{@render control()}
		{#if isSaved}
			<!-- eslint-disable svelte/no-navigation-without-resolve -- resolve() plus the item fragment -->
			<a
				href={shortlistHref}
				class="inline-flex min-h-11 items-center text-body text-primary underline underline-offset-3 hover:text-primary-hover hover:decoration-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
			>
				See it on your shortlist
			</a>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		{/if}
	</div>
{/if}
