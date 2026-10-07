<script lang="ts" module>
	import { longDate } from '@tran/core/format';
	import type { SnapshotRecord } from '$lib/storage/studio/types';

	export const LIST_HEADING = 'Your snapshots';
	export const EMPTY_LINE = 'No saved snapshots yet. Build one above, or look at a sample first.';
	export const DELETE_BODY =
		"This removes the saved report from this browser. It can't be undone. PDFs you already saved aren't affected.";

	const DOT = String.fromCharCode(0xb7);
	const MONTH_DAY = new Intl.DateTimeFormat('en-US', {
		month: 'short',
		day: 'numeric',
		timeZone: 'UTC'
	});

	/** ISO timestamp to "Oct 1, 2026" (UTC, like the print view). */
	const dateOf = (iso: string): string => longDate(Date.parse(iso));

	/** "Saved {Mon D, YYYY} · data as of {Mon D, YYYY} · {n} sections". */
	export function snapshotRowLine(r: SnapshotRecord): string {
		const n = r.options.sections.length;
		return `Saved ${dateOf(r.createdAt)} ${DOT} data as of ${dateOf(r.fetchedAt)} ${DOT} ${n} ${n === 1 ? 'section' : 'sections'}`;
	}

	/** "Delete the ZIP {zip} snapshot from {Mon D}?" */
	export function deleteTitle(r: SnapshotRecord): string {
		return `Delete the ZIP ${r.zip} snapshot from ${MONTH_DAY.format(Date.parse(r.createdAt))}?`;
	}

	export const deletedAnnouncement = (zip: string): string => `Deleted the ZIP ${zip} snapshot.`;

	/** Where focus goes after deleting `id`: the next row, else the previous one, else the heading. */
	export function focusTargetAfterDelete(
		records: readonly Pick<SnapshotRecord, 'id'>[],
		id: string
	): string | null {
		const i = records.findIndex((r) => r.id === id);
		if (i < 0) return null;
		return records[i + 1]?.id ?? records[i - 1]?.id ?? null;
	}
</script>

<script lang="ts">
	// 09-UI-SPEC "Your snapshots" (STU-04): saved records newest first, each with Open print view
	// and Delete (ConfirmDialog). Records are frozen, so there is no edit. The host owns the list
	// (read in the browser after mount) and drops a row when onDeleted fires; focus then settles from
	// the $effect below once the row is gone: the next row's heading, else the previous one's, else
	// the section heading.
	import { resolve } from '$app/paths';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import SampleChip from '$lib/components/sample/SampleChip.svelte';
	import {
		announce,
		Button,
		buttonVariants,
		ConfirmDialog
	} from '$lib/features/shared/data/platform-ui';

	interface Props {
		/** Newest first; null while the browser read is pending. */
		records: readonly SnapshotRecord[] | null;
		onDeleted: (id: string) => void;
		/** Deletes one saved snapshot; defaults to the studio snapshots repo (loaded on first use). */
		remove?: (id: string) => Promise<void>;
	}

	let { records, onDeleted, remove }: Props = $props();

	const uid = $props.id();
	const headingId = `${uid}-heading`;
	const rowHeadingId = (id: string) => `${uid}-row-${id}`;

	let pendingFocus = $state<{ deleted: string; target: string | null } | null>(null);

	const printHref = (id: string) => `${resolve('/print/snapshot/')}?id=${encodeURIComponent(id)}`;
	const sampleHref = `${resolve('/print/snapshot/')}?id=sample`;

	async function removeOne(id: string): Promise<void> {
		if (remove) return remove(id);
		const { deleteSnapshot } = await import('$lib/storage/studio/snapshots-repo');
		return deleteSnapshot(id);
	}

	async function confirmDelete(r: SnapshotRecord): Promise<void> {
		const target = focusTargetAfterDelete(records ?? [], r.id);
		await removeOne(r.id);
		pendingFocus = { deleted: r.id, target };
		announce(deletedAnnouncement(r.zip));
		onDeleted(r.id);
	}

	// Focus settles once the host's list no longer holds the deleted row.
	$effect(() => {
		const p = pendingFocus;
		const list = records;
		if (!p || !list || list.some((r) => r.id === p.deleted)) return;
		const el = document.getElementById(
			p.target && list.some((r) => r.id === p.target) ? rowHeadingId(p.target) : headingId
		);
		el?.focus();
		pendingFocus = null;
	});

	/** After a delete the $effect above owns focus; a cancel returns focus to the trigger. */
	function onCloseAutoFocus(e: Event): void {
		if (pendingFocus) e.preventDefault();
	}

	const inlineLink =
		'inline-flex min-h-11 items-center text-base leading-[1.6] font-semibold text-foreground underline underline-offset-4 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';
</script>

<section aria-labelledby={headingId} class="flex flex-col gap-4" data-snapshot-list>
	<h2
		id={headingId}
		tabindex="-1"
		class="font-display text-heading font-semibold text-foreground focus:outline-none"
	>
		{LIST_HEADING}
	</h2>
	{#if records === null}
		<p class="text-label text-muted-foreground">Loading your studio…</p>
	{:else if records.length === 0}
		<p class="text-base leading-[1.6] text-muted-foreground" data-snapshot-list-empty>
			{EMPTY_LINE}
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- resolve() plus ?id=sample -->
			<a href={sampleHref} class={inlineLink}>Preview a sample report</a>
		</p>
	{:else}
		<ul class="flex flex-col gap-4">
			{#each records as r (r.id)}
				<li
					class="flex flex-col gap-3 rounded-lg border border-border bg-card p-4"
					data-snapshot-row={r.id}
				>
					<div class="flex flex-col gap-1">
						<div class="flex flex-wrap items-center gap-2">
							<h3
								id={rowHeadingId(r.id)}
								tabindex="-1"
								class="text-base leading-[1.6] font-semibold text-foreground tabular-nums focus:outline-none"
							>
								ZIP {r.zip}
							</h3>
							{#if r.sample}<SampleChip />{/if}
						</div>
						{#if r.placeName}
							<p class="text-base leading-[1.6] text-muted-foreground">{r.placeName}</p>
						{/if}
						<p class="text-label text-muted-foreground tabular-nums">{snapshotRowLine(r)}</p>
					</div>
					<div class="flex flex-wrap gap-2">
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- resolve() plus ?id= -->
						<a href={printHref(r.id)} class={buttonVariants({ variant: 'outline' })}
							>Open print view<span class="sr-only"> for ZIP {r.zip}</span></a
						>
						<ConfirmDialog
							title={deleteTitle(r)}
							body={[DELETE_BODY]}
							confirmLabel="Delete snapshot"
							confirmBusyLabel="Deleting…"
							cancelLabel="Keep snapshot"
							onConfirm={() => confirmDelete(r)}
							{onCloseAutoFocus}
						>
							{#snippet trigger({ props })}
								<Button {...props} variant="destructive-outline">
									<Trash2 size={16} aria-hidden="true" />
									Delete<span class="sr-only"> the ZIP {r.zip} snapshot</span>
								</Button>
							{/snippet}
						</ConfirmDialog>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</section>
