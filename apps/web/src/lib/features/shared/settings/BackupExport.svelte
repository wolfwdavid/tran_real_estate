<script lang="ts">
	import Download from '@lucide/svelte/icons/download';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import { Button } from '$lib/components/ui/button/index.js';
	import { announce } from '$lib/components/a11y/announcer.svelte';
	import { getSettingsContext } from './settings-context.svelte';
	import SectionError from './SectionError.svelte';
	import type { BackupKit } from './BackupSection.svelte';

	interface Props {
		/** Null when storage is blocked: the copy renders without the button. */
		kit: BackupKit | null;
	}

	let { kit }: Props = $props();

	const ctx = getSettingsContext();

	// One live query over meta + every registered table: the Last backup line and the "nothing to
	// back up" hint both update without a reload after an export or import.
	const reminder = $derived.by(() => {
		const db = ctx.db;
		const k = kit;
		if (!db || !k) return null;
		return k.live(() => k.readReminderInput(db, new Date()), null);
	});

	const lastBackupText = $derived.by(() => {
		const input = reminder?.current;
		if (!input || !kit) return null;
		const age = kit.lastBackupAge(new Date(), input.lastBackupAt);
		if (age.kind === 'never') return 'Last backup: Never';
		if (age.days <= 0) return 'Last backup: today';
		if (age.days === 1) return 'Last backup: yesterday';
		return `Last backup: ${age.days} days ago`;
	});

	let busy = $state(false);
	let failure = $state<'key-material' | 'other' | null>(null);
	let failureSeq = $state(0);

	async function download(): Promise<void> {
		const db = ctx.db;
		if (busy || !kit || !db) return;
		busy = true;
		failure = null;
		try {
			const vault = ctx.vault ?? { knownSecrets: () => [] };
			const { filename } = await kit.exportBackup(db, vault);
			announce(`Backup downloaded: ${filename}.`);
		} catch (error) {
			const code = (error as { code?: unknown } | null)?.code;
			failure = code === 'key-material' ? 'key-material' : 'other';
			failureSeq++;
		} finally {
			busy = false;
		}
	}
</script>

<div class="flex flex-col gap-4">
	<h3 class="text-body font-semibold">Download a backup</h3>
	<p class="text-body">
		Saves your saved searches, deals, contacts, and settings to a file. Each file is checked to
		contain no API keys before it downloads.
	</p>
	{#if lastBackupText}
		<p class="text-label text-muted-foreground" data-testid="last-backup">{lastBackupText}</p>
	{/if}
	{#if reminder?.current && !reminder.current.hasRecords}
		<p class="text-label text-muted-foreground">
			Nothing to back up yet. Saved searches, deals, and contacts will be included as you create
			them.
		</p>
	{/if}
	{#if kit && ctx.db && !ctx.storageBlocked}
		<div>
			<Button
				onclick={download}
				disabled={busy}
				aria-disabled={busy ? 'true' : undefined}
				class="gap-2"
			>
				{#if busy}
					<LoaderCircle class="size-4 motion-safe:animate-spin" aria-hidden="true" />
					Preparing backup…
				{:else}
					<Download class="size-4" aria-hidden="true" />
					Download backup
				{/if}
			</Button>
		</div>
	{/if}
	{#key failureSeq}
		{#if failure === 'key-material'}
			<SectionError
				title="Backup stopped"
				body="The file would have contained text that looks like an API key, so nothing was downloaded. Reload the page and try again. Don't share any earlier backup until you've checked it."
			/>
		{:else if failure === 'other'}
			<SectionError
				title="Backup couldn't be created"
				body="Nothing was downloaded, and your data in this browser hasn't changed. Reload the page and try again."
			/>
		{/if}
	{/key}
</div>
