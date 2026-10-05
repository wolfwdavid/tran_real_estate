<script lang="ts">
	import Upload from '@lucide/svelte/icons/upload';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import type { ImportPreview as Preview } from '$lib/storage/backup';
	import { announce } from '$lib/components/a11y/announcer.svelte';
	import { getSettingsContext } from './settings-context.svelte';
	import SectionError from './SectionError.svelte';
	import ImportPreview from './ImportPreview.svelte';
	import type { BackupKit } from './BackupSection.svelte';

	interface Props {
		/** Null when storage is blocked: the copy renders without the file picker. */
		kit: BackupKit | null;
	}

	let { kit }: Props = $props();

	const ctx = getSettingsContext();

	// Error copy per BackupError code (UI-SPEC, verbatim).
	const NOT_TRAN = {
		title: "This isn't a Tran backup",
		body: 'Choose the .json file you downloaded from Tran Settings.'
	};
	const UNREADABLE = {
		title: "This backup can't be read",
		body: 'The file is damaged or incomplete, so nothing was imported. Try another copy of your backup.'
	};
	const ERRORS: Record<string, { title: string; body: string } | undefined> = {
		'not-json': NOT_TRAN,
		'not-tran': NOT_TRAN,
		invalid: UNREADABLE,
		newer: {
			title: 'This backup is from a newer version of Tran',
			body: 'Reload the page to update the app, then choose the file again.'
		},
		'too-large': {
			title: 'This file is too large',
			body: "Tran backups are well under 25 MB, so this probably isn't one. Choose a different file."
		}
	};

	let busy = $state(false);
	// Raw: a deep $state proxy would reach IndexedDB inside preview.incoming and fail structured clone.
	let preview = $state.raw<Preview | null>(null);
	let previewSeq = $state(0);
	let failure = $state<{ title: string; body: string } | null>(null);
	let failureSeq = $state(0);
	let inputEl = $state<HTMLInputElement | null>(null);

	async function onFileChange(event: Event): Promise<void> {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		const db = ctx.db;
		if (!file || !kit || !db || busy) {
			input.value = '';
			return;
		}
		busy = true;
		failure = null;
		preview = null;
		try {
			preview = await kit.previewImport(db, file);
			previewSeq++;
			announce('Backup checked. Review the changes before importing.');
		} catch (error) {
			const code = (error as { code?: unknown } | null)?.code;
			failure = (typeof code === 'string' && ERRORS[code]) || UNREADABLE;
			failureSeq++;
		} finally {
			// Reset after every attempt so choosing the same file again fires change.
			input.value = '';
			busy = false;
		}
	}

	function closePreview(): void {
		preview = null;
		inputEl?.focus();
	}
</script>

<div class="flex flex-col gap-4">
	<h3 class="text-body font-semibold">Restore from a backup</h3>
	<p class="text-body">
		Choose a Tran backup file. You'll see what will change before anything is imported.
	</p>
	{#if kit && ctx.db && !ctx.storageBlocked}
		<div>
			<label
				for="backup-file"
				class="inline-flex h-12 cursor-pointer items-center gap-2 rounded-md border border-border-strong px-6 font-semibold focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring hover:bg-surface"
				aria-busy={busy ? 'true' : undefined}
			>
				{#if busy}
					<LoaderCircle class="size-4 motion-safe:animate-spin" aria-hidden="true" />
					Checking file…
				{:else}
					<Upload class="size-4" aria-hidden="true" />
					Choose backup file
				{/if}
				<input
					bind:this={inputEl}
					id="backup-file"
					type="file"
					accept=".json,application/json"
					class="sr-only"
					disabled={busy}
					onchange={onFileChange}
				/>
			</label>
		</div>
	{/if}
	{#key failureSeq}
		{#if failure}
			<SectionError title={failure.title} body={failure.body} />
		{/if}
	{/key}
	{#if preview && kit}
		{#key previewSeq}
			<ImportPreview {preview} {kit} onClose={closePreview} />
		{/key}
	{/if}
</div>
