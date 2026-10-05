<script lang="ts" module>
	// Browser-only modules the backup sub-groups need. Loaded by dynamic import after hydration so
	// Dexie, the backup service and the Storage API helpers never enter the prerendered page graph.
	export interface BackupKit {
		exportBackup: (typeof import('$lib/storage/backup'))['exportBackup'];
		previewImport: (typeof import('$lib/storage/backup'))['previewImport'];
		applyImport: (typeof import('$lib/storage/backup'))['applyImport'];
		readReminderInput: (typeof import('$lib/storage/meta'))['readReminderInput'];
		live: (typeof import('$lib/storage/live.svelte'))['live'];
		requestPersistence: (typeof import('$lib/storage/persistence'))['requestPersistence'];
		lastBackupAge: (typeof import('@tran/core'))['lastBackupAge'];
	}

	export async function loadBackupKit(): Promise<BackupKit> {
		const [backup, meta, live, persistence, core] = await Promise.all([
			import('$lib/storage/backup'),
			import('$lib/storage/meta'),
			import('$lib/storage/live.svelte'),
			import('$lib/storage/persistence'),
			import('@tran/core')
		]);
		return {
			exportBackup: backup.exportBackup,
			previewImport: backup.previewImport,
			applyImport: backup.applyImport,
			readReminderInput: meta.readReminderInput,
			live: live.live,
			requestPersistence: persistence.requestPersistence,
			lastBackupAge: core.lastBackupAge
		};
	}
</script>

<script lang="ts">
	import { getSettingsContext } from './settings-context.svelte';
	import BackupExport from './BackupExport.svelte';
	import BackupImport from './BackupImport.svelte';
	import SectionError from './SectionError.svelte';

	const ctx = getSettingsContext();

	let kit = $state<BackupKit | null>(null);
	let kitFailed = $state(false);
	let loading = false;

	$effect(() => {
		if (!ctx.ready || ctx.storageBlocked || !ctx.db || kit || loading) return;
		loading = true;
		loadBackupKit()
			.then((k) => (kit = k))
			.catch(() => (kitFailed = true));
	});
</script>

<section id="backup" aria-labelledby="backup-heading">
	<h2 id="backup-heading" tabindex="-1" class="font-display text-heading font-semibold">
		Backup and restore
	</h2>
	<p class="mt-4 text-body">
		Tran keeps your data only in this browser. A backup file is your copy if the browser clears it
		or you switch devices. Backups never include your API keys.
	</p>
	{#if !ctx.ready || (!ctx.storageBlocked && ctx.db && !kit && !kitFailed)}
		<p class="mt-4 text-label text-muted-foreground">Checking this browser…</p>
	{:else if kitFailed}
		<SectionError
			class="mt-4"
			title="Backup couldn't be created"
			body="Nothing was downloaded, and your data in this browser hasn't changed. Reload the page and try again."
		/>
	{:else}
		<div class="mt-6 flex flex-col gap-8">
			<BackupExport {kit} />
			<BackupImport {kit} />
		</div>
	{/if}
</section>
