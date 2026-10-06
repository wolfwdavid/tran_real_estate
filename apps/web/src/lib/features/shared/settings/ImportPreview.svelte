<script lang="ts">
	import { onMount } from 'svelte';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import type { ImportPreview as Preview } from '$lib/storage/backup';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as RadioGroup from '$lib/components/ui/radio-group/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { announce } from '$lib/components/a11y/announcer.svelte';
	import { getSettingsContext } from './settings-context.svelte';
	import ConfirmDialog from './ConfirmDialog.svelte';
	import SectionError from './SectionError.svelte';
	import type { BackupKit } from './BackupSection.svelte';

	interface Props {
		preview: Preview;
		kit: BackupKit;
		/** Cancel / Close: the parent removes the panel. */
		onClose: () => void;
	}

	let { preview, kit, onClose }: Props = $props();

	const ctx = getSettingsContext();

	let mode = $state<'merge' | 'replace'>('merge');
	let busy = $state(false);
	let confirmOpen = $state(false);
	let result = $state<string | null>(null);
	let failure = $state<{ title: string; body: string } | null>(null);
	let failureSeq = $state(0);
	let headingEl = $state<HTMLElement | null>(null);
	let resultEl = $state<HTMLElement | null>(null);

	const created = $derived.by(() => {
		const d = new Date(preview.exportedAt);
		return Number.isNaN(d.getTime())
			? preview.exportedAt
			: new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(d);
	});
	const caption = $derived(mode === 'merge' ? 'Changes if you merge' : 'Changes if you replace');
	const deleteCount = $derived(preview.replace.totals.delete);
	const addCount = $derived(preview.replace.totals.add);
	const replaceBody = $derived(
		deleteCount > 0
			? [
					`This deletes the ${deleteCount} items stored here, including saved searches, deals, and contacts, and replaces them with the ${addCount} items in ${preview.fileName}. It can't be undone. If you might need what's here now, cancel and download a backup first.`
				]
			: [
					`This browser has no saved items yet, so nothing will be deleted. The ${addCount} items in ${preview.fileName} will be added.`
				]
	);

	onMount(() => headingEl?.focus());

	function errorFor(error: unknown): { title: string; body: string } {
		const code = (error as { code?: unknown } | null)?.code;
		if (code === 'out-of-space') {
			return {
				title: 'Your device is out of space for Tran',
				body: 'Free up some storage on this device, then try again.'
			};
		}
		return {
			title: "Import didn't finish",
			body: 'Nothing was changed, and your data is as it was before. Try again, or choose a different backup file.'
		};
	}

	function showFailure(error: unknown): void {
		failure = errorFor(error);
		failureSeq++;
		// A failed Replace closes the dialog so the error (focused on mount) is reachable.
		confirmOpen = false;
	}

	async function run(chosen: 'merge' | 'replace'): Promise<void> {
		const db = ctx.db;
		if (!db) throw new Error('storage unavailable');
		// Persist first, inside the click's call stack (user activation), then write.
		void kit.requestPersistence();
		const outcome = await kit.applyImport(db, preview, chosen);
		const message =
			outcome.mode === 'merge'
				? `Import complete. ${outcome.added} added, ${outcome.updated} updated, ${outcome.unchanged} unchanged.`
				: `Import complete. This browser now holds the ${outcome.total} items from ${outcome.fileName}.`;
		result = message;
		announce(message);
	}

	async function importMerge(): Promise<void> {
		if (busy) return;
		busy = true;
		failure = null;
		try {
			await run('merge');
		} catch (error) {
			showFailure(error);
		} finally {
			busy = false;
		}
	}

	async function confirmReplace(): Promise<void> {
		busy = true;
		failure = null;
		try {
			await run('replace');
		} finally {
			busy = false;
		}
	}

	function cancel(): void {
		announce('Import canceled. Nothing changed.');
		onClose();
	}

	$effect(() => {
		if (result) resultEl?.focus();
	});
</script>

{#if result}
	<p
		bind:this={resultEl}
		tabindex="-1"
		class="rounded-lg border border-border p-6 text-body"
		data-testid="import-result"
	>
		{result}
	</p>
{:else}
	<div
		class="flex flex-col gap-6 rounded-lg border border-border p-6"
		aria-busy={busy ? 'true' : undefined}
		data-testid="import-preview"
	>
		<h3 bind:this={headingEl} tabindex="-1" class="text-body font-semibold">Review this backup</h3>
		<dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-body">
			<dt class="text-muted-foreground">File</dt>
			<dd class="break-all">{preview.fileName}</dd>
			<dt class="text-muted-foreground">Created</dt>
			<dd>{created}</dd>
			<dt class="text-muted-foreground">Backup version</dt>
			<dd>{preview.schemaVersion}</dd>
		</dl>
		{#if preview.migratedFrom !== null}
			<p class="text-body">
				This backup is from an older version of Tran. It will be updated as it's imported.
			</p>
		{/if}

		<fieldset class="flex flex-col gap-3" disabled={busy}>
			<legend class="mb-3 text-body font-semibold">How to import</legend>
			<RadioGroup.Root bind:value={mode} class="flex flex-col gap-4">
				<div class="flex items-start gap-3">
					<RadioGroup.Item value="merge" id="import-mode-merge" class="mt-1" />
					<div class="flex flex-col gap-1">
						<Label for="import-mode-merge">Merge (recommended)</Label>
						<p class="text-label text-muted-foreground">
							Keep what's here and add what's in the file. When both have the same item, the one
							edited more recently is kept.
						</p>
					</div>
				</div>
				<div class="flex items-start gap-3">
					<RadioGroup.Item value="replace" id="import-mode-replace" class="mt-1" />
					<div class="flex flex-col gap-1">
						<Label for="import-mode-replace">Replace</Label>
						<p class="text-label text-muted-foreground">
							Delete everything stored here and use only what's in the file.
						</p>
					</div>
				</div>
			</RadioGroup.Root>
		</fieldset>

		{#if mode === 'merge' && preview.merge.noChanges}
			<p class="text-body">
				This backup matches what's already in this browser. Importing it wouldn't change anything.
			</p>
			<div>
				<Button variant="outline" onclick={onClose}>Close</Button>
			</div>
		{:else}
			<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
			<div class="relative overflow-x-auto" tabindex="0" role="region" aria-label={caption}>
				<table class="w-full min-w-[22rem] border-collapse text-body">
					<caption class="mb-2 text-left text-label text-muted-foreground">{caption}</caption>
					{#if mode === 'merge'}
						<thead>
							<tr class="border-b border-border">
								<th scope="col" class="py-2 pr-4 text-left font-semibold">Data type</th>
								<th scope="col" class="py-2 pr-4 text-right font-semibold">Add</th>
								<th scope="col" class="py-2 pr-4 text-right font-semibold">Update</th>
								<th scope="col" class="py-2 text-right font-semibold">Unchanged</th>
							</tr>
						</thead>
						<tbody>
							{#each preview.merge.perTable as row (row.table)}
								<tr class="border-b border-border">
									<th scope="row" class="py-2 pr-4 text-left font-normal">{row.label}</th>
									<td class="py-2 pr-4 text-right tabular-nums">{row.add}</td>
									<td class="py-2 pr-4 text-right tabular-nums">{row.update}</td>
									<td class="py-2 text-right tabular-nums">{row.unchanged}</td>
								</tr>
							{/each}
							<tr class="font-semibold">
								<th scope="row" class="py-2 pr-4 text-left">Total</th>
								<td class="py-2 pr-4 text-right tabular-nums">{preview.merge.totals.add}</td>
								<td class="py-2 pr-4 text-right tabular-nums">{preview.merge.totals.update}</td>
								<td class="py-2 text-right tabular-nums">{preview.merge.totals.unchanged}</td>
							</tr>
						</tbody>
					{:else}
						<thead>
							<tr class="border-b border-border">
								<th scope="col" class="py-2 pr-4 text-left font-semibold">Data type</th>
								<th scope="col" class="py-2 pr-4 text-right font-semibold"
									>Delete from this browser</th
								>
								<th scope="col" class="py-2 text-right font-semibold">Add from backup</th>
							</tr>
						</thead>
						<tbody>
							{#each preview.replace.perTable as row (row.table)}
								<tr class="border-b border-border">
									<th scope="row" class="py-2 pr-4 text-left font-normal">{row.label}</th>
									<td class="py-2 pr-4 text-right tabular-nums">{row.delete}</td>
									<td class="py-2 text-right tabular-nums">{row.add}</td>
								</tr>
							{/each}
							<tr class="font-semibold">
								<th scope="row" class="py-2 pr-4 text-left">Total</th>
								<td class="py-2 pr-4 text-right tabular-nums">{deleteCount}</td>
								<td class="py-2 text-right tabular-nums">{addCount}</td>
							</tr>
						</tbody>
					{/if}
				</table>
			</div>

			{#key failureSeq}
				{#if failure}
					<SectionError title={failure.title} body={failure.body} focusOnMount />
				{/if}
			{/key}

			<div class="flex flex-wrap gap-3">
				<Button variant="outline" onclick={cancel} disabled={busy}>Cancel</Button>
				{#if mode === 'merge'}
					<Button
						onclick={importMerge}
						disabled={busy}
						aria-disabled={busy ? 'true' : undefined}
						class="gap-2"
					>
						{#if busy}
							<LoaderCircle class="size-4 motion-safe:animate-spin" aria-hidden="true" />
							Importing…
						{:else}
							Import backup
						{/if}
					</Button>
				{:else}
					<ConfirmDialog
						bind:open={confirmOpen}
						title="Replace all data in this browser?"
						body={replaceBody}
						confirmLabel="Replace all data"
						confirmBusyLabel="Replacing…"
						cancelLabel="Keep my data"
						onConfirm={confirmReplace}
						onError={showFailure}
						onCloseAutoFocus={(e) => {
							if (result || failure) e.preventDefault();
						}}
					>
						{#snippet trigger({ props })}
							<Button {...props} variant="destructive-outline" disabled={busy}>
								Replace all data…
							</Button>
						{/snippet}
					</ConfirmDialog>
				{/if}
			</div>
		{/if}
	</div>
{/if}
