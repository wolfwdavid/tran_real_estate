<script lang="ts" module>
	import type { ReminderResult } from '@tran/core';

	type Kit = {
		db: import('$lib/storage/db').TranDb | null;
		vault: import('$lib/storage/secrets').Vault | null;
		exportBackup: (typeof import('$lib/storage/backup'))['exportBackup'];
		readReminderInput: (typeof import('$lib/storage/meta'))['readReminderInput'];
		setMeta: (typeof import('$lib/storage/meta'))['setMeta'];
		META: (typeof import('$lib/storage/meta'))['META'];
		live: (typeof import('$lib/storage/live.svelte'))['live'];
		backupReminderDue: (typeof import('@tran/core'))['backupReminderDue'];
	};
</script>

<script lang="ts">
	import { onMount } from 'svelte';
	import { base, resolve } from '$app/paths';
	import { page } from '$app/state';
	import Lock from '@lucide/svelte/icons/lock';
	import HardDriveDownload from '@lucide/svelte/icons/hard-drive-download';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import { Button } from '$lib/components/ui/button/index.js';
	import { announce } from '$lib/components/a11y/announcer.svelte';
	import SectionError from '$lib/features/shared/settings/SectionError.svelte';
	import { backupCopy, isSettingsPath, selectNotice, SNOOZE_MS } from './notice-logic';

	// One in-flow notice for every (app) page (03-UI-SPEC "App notice slot"): locked keys first,
	// then an overdue backup. Renders nothing until onMount has loaded the vault and IndexedDB
	// through dynamic import(), so neither enters the prerendered HTML or any marketing chunk.
	// Self-contained on purpose: Phase 4 inserts DataStatusBar before it with a one-line edit.

	let kit = $state<Kit | null>(null);
	let vaultStatus = $state<{ hasLock: boolean; locked: boolean } | null>(null);

	onMount(() => {
		let disposed = false;
		let offVault: (() => void) | undefined;

		void (async () => {
			const [db, meta, backup, liveMod, secrets, core] = await Promise.all([
				import('$lib/storage/db'),
				import('$lib/storage/meta'),
				import('$lib/storage/backup'),
				import('$lib/storage/live.svelte'),
				import('$lib/storage/secrets'),
				import('@tran/core')
			]);

			// Storage blocked or unavailable: no reminder; Settings explains the state.
			const openedDb: Kit['db'] = await db.openDb(db.getDb()).catch(() => null);
			const vault: Kit['vault'] = await secrets.getVault().catch(() => null);
			if (disposed) return;

			if (vault) {
				const v = vault;
				const sync = () => {
					const s = v.getStatus();
					vaultStatus = { hasLock: s.hasLock, locked: s.locked };
				};
				sync();
				offVault = v.onChange(sync);
			}

			kit = {
				db: openedDb,
				vault,
				exportBackup: backup.exportBackup,
				readReminderInput: meta.readReminderInput,
				setMeta: meta.setMeta,
				META: meta.META,
				live: liveMod.live,
				backupReminderDue: core.backupReminderDue
			};
		})();

		return () => {
			disposed = true;
			offVault?.();
		};
	});

	// Live over meta + every backup table: an export, a snooze or an import anywhere in this tab
	// re-evaluates the reminder without a reload. Reading the pathname re-creates the query on each
	// navigation so "now" is fresh.
	const reminder = $derived.by(() => {
		void page.url.pathname;
		const k = kit;
		const db = k?.db;
		if (!k || !db) return null;
		return k.live<ReminderResult | null>(
			async () => k.backupReminderDue(await k.readReminderInput(db, new Date())),
			null
		);
	});

	const kind = $derived(
		kit
			? selectNotice({
					isSettings: isSettingsPath(page.url.pathname, base),
					vault: vaultStatus,
					reminder: reminder?.error ? null : (reminder?.current ?? null)
				})
			: null
	);

	const dueReminder = $derived.by(() => {
		const r = reminder?.current;
		return r?.due ? r : null;
	});

	let busy = $state(false);
	let failure = $state<'key-material' | 'other' | null>(null);
	let failureSeq = $state(0);

	/** The actions disappear with the notice; keep focus on the page instead of <body>. */
	function focusMain(): void {
		document.getElementById('main-content')?.focus({ preventScroll: true });
	}

	async function download(): Promise<void> {
		const k = kit;
		const db = k?.db;
		if (busy || !k || !db) return;
		busy = true;
		failure = null;
		try {
			const vault = k.vault ?? { knownSecrets: () => [] };
			const { filename } = await k.exportBackup(db, vault);
			announce(`Backup downloaded: ${filename}.`);
			focusMain();
		} catch (error) {
			const code = (error as { code?: unknown } | null)?.code;
			failure = code === 'key-material' ? 'key-material' : 'other';
			failureSeq++;
		} finally {
			busy = false;
		}
	}

	async function snooze(): Promise<void> {
		const k = kit;
		const db = k?.db;
		if (!k || !db) return;
		failure = null;
		await k.setMeta(db, k.META.snoozedUntil, new Date(Date.now() + SNOOZE_MS).toISOString());
		announce('Backup reminder hidden until tomorrow.');
		focusMain();
	}
</script>

{#if kind}
	<div class="mx-auto mt-4 max-w-page px-6 md:px-8">
		<div
			role="region"
			aria-labelledby="app-notice-title"
			class="flex gap-3 rounded-lg border-l-4 border-primary bg-accent-surface p-4 sm:p-6"
		>
			{#if kind === 'locked'}
				<Lock size={20} aria-hidden="true" class="shrink-0 text-foreground" />
			{:else}
				<HardDriveDownload size={20} aria-hidden="true" class="shrink-0 text-foreground" />
			{/if}
			<div class="flex flex-col gap-2">
				{#if kind === 'locked'}
					<p id="app-notice-title" class="text-body font-semibold">Your keys are locked</p>
					<p class="text-body">Your remembered keys stay locked until you enter your passphrase.</p>
					<div class="flex flex-col gap-2 sm:flex-row sm:gap-4">
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- resolve() plus a same-page fragment -->
						<a href={`${resolve('/settings/')}#key-security`} class="text-body underline"
							>Unlock in Settings</a
						>
					</div>
				{:else}
					<p id="app-notice-title" class="text-body font-semibold">Back up your saved data</p>
					<p class="text-body">{dueReminder ? backupCopy(dueReminder) : ''}</p>
					<div class="flex flex-col gap-2 sm:flex-row sm:gap-4">
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
								Download backup
							{/if}
						</Button>
						<Button variant="ghost" onclick={snooze}>Remind me tomorrow</Button>
					</div>
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
				{/if}
			</div>
		</div>
	</div>
{/if}
