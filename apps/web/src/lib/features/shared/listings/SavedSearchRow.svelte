<script lang="ts">
	// UI-SPEC "SavedSearchRow + save dialog": one saved search with its "new since your last visit"
	// badge (Phase 4 NewSinceBadge), when it was checked, a Sample chip for fixture runs, and
	// View results / Rename / Delete. Prop-driven so Phase 7 can reuse it; no portal imports.
	// Nothing here spends: View results is a link (the page restores from the cache) and
	// Rename/Delete are storage-only callbacks.
	import CirclePause from '@lucide/svelte/icons/circle-pause';
	import NewSinceBadge from '$lib/features/shared/data/NewSinceBadge.svelte';
	import ProvenanceChip from '$lib/features/shared/data/ProvenanceChip.svelte';
	import { Button, ConfirmDialog, buttonVariants } from '$lib/features/shared/data/platform-ui';

	interface Props {
		/** Heading id (focus target for "Manage in Saved searches"). */
		headingId: string;
		name: string;
		/** Filter summary line, e.g. "74201 · Up to $2,000". */
		summary: string;
		newCount: number;
		checkedAt: number | null;
		source: 'rentcast' | 'sample';
		/** Due, but the scheduler is holding it until there's room under the cap. */
		waiting: boolean;
		/** View results URL (resolve()d by the caller). */
		href: string;
		onRename: () => void;
		onDelete: () => Promise<void>;
		/** Where focus goes after the delete dialog closes (the row is gone by then). */
		onDeleteCloseAutoFocus?: (e: Event) => void;
	}

	let {
		headingId,
		name,
		summary,
		newCount,
		checkedAt,
		source,
		waiting,
		href,
		onRename,
		onDelete,
		onDeleteCloseAutoFocus
	}: Props = $props();

	let confirmOpen = $state(false);
	const deleteBody = $derived([
		`“${name}” and its record of listings you've seen will be removed from this browser. Listings on your shortlist stay there. This can't be undone.`
	]);
</script>

<article class="flex flex-col gap-3 rounded-lg border border-border bg-card p-4" data-saved-search>
	<h3
		id={headingId}
		tabindex="-1"
		class="text-base leading-[1.6] font-semibold text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
	>
		{name}
	</h3>
	<p class="text-label text-muted-foreground">{summary}</p>
	<NewSinceBadge
		newCount={source === 'sample' ? 0 : newCount}
		priceChanged={0}
		gone={0}
		{checkedAt}
		{source}
	/>
	{#if waiting}
		<p class="flex items-center gap-1 text-label text-muted-foreground">
			<CirclePause class="size-3.5 shrink-0" aria-hidden="true" />
			Waiting to be checked until there's room under your cap.
		</p>
	{/if}
	{#if source === 'sample'}
		<div>
			<ProvenanceChip provenance={{ source: 'sample', fetchedAt: checkedAt ?? 0, stale: false }} />
		</div>
	{/if}
	<div class="flex flex-wrap gap-2">
		<!-- eslint-disable svelte/no-navigation-without-resolve -- the caller passes resolve() plus the saved query -->
		<a
			{href}
			aria-label={`View results for ${name}`}
			class={buttonVariants({ variant: 'outline', class: 'min-h-11' })}>View results</a
		>
		<!-- eslint-enable svelte/no-navigation-without-resolve -->
		<Button variant="ghost" class="min-h-11" onclick={onRename}>Rename</Button>
		<ConfirmDialog
			bind:open={confirmOpen}
			title="Delete this saved search?"
			body={deleteBody}
			confirmLabel="Delete search"
			confirmBusyLabel="Deleting…"
			cancelLabel="Keep search"
			onConfirm={onDelete}
			onCloseAutoFocus={onDeleteCloseAutoFocus}
		>
			{#snippet trigger({ props })}
				<Button {...props} variant="destructive-outline" class="min-h-11">Delete</Button>
			{/snippet}
		</ConfirmDialog>
	</div>
</article>
