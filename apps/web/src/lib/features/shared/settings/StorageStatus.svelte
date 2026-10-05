<script lang="ts">
	import { onMount } from 'svelte';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { announce } from '$lib/components/a11y/announcer.svelte';
	// Dependency-free Storage API wrapper: a static import keeps requestPersistence() callable on
	// the first line of the click handler (Firefox only honours persist() with user activation).
	import {
		formatBytes,
		persistenceStatus,
		requestPersistence,
		storageEstimate,
		type PersistStatus
	} from '$lib/storage/persistence';
	import { getSettingsContext } from './settings-context.svelte';

	// Rendered by StorageSection once ctx.ready, so ctx.db is final here. Dexie (live, meta) and
	// @tran/core load through dynamic import() so they never enter the prerendered page graph.
	const ctx = getSettingsContext();

	let status = $state<PersistStatus | null>(null);
	let estimate = $state<{ usage: number; quota: number } | null>(null);
	let asking = $state(false);
	let refused = $state(false);
	let lastBackup = $state<{ readonly current: string | undefined } | null>(null);
	let ageOf = $state<((iso?: string) => string) | null>(null);

	onMount(() => {
		let disposed = false;
		void (async () => {
			const [s, e] = await Promise.all([persistenceStatus(), storageEstimate()]);
			if (disposed) return;
			status = s;
			estimate = e;

			const db = ctx.db;
			if (!db) return;
			const [{ live }, { getMeta, META }, { lastBackupAge }] = await Promise.all([
				import('$lib/storage/live.svelte'),
				import('$lib/storage/meta'),
				import('@tran/core')
			]);
			if (disposed) return;
			lastBackup = live(() => getMeta<string>(db, META.lastBackupAt), undefined);
			ageOf = (iso) => {
				const age = lastBackupAge(new Date(), iso);
				if (age.kind === 'never') return 'Never';
				if (age.days <= 0) return 'Today';
				if (age.days === 1) return 'Yesterday';
				return `${age.days} days ago`;
			};
		})();
		return () => {
			disposed = true;
		};
	});

	function askAgain() {
		// Synchronous first call: no await may precede persist().
		const request = requestPersistence();
		asking = true;
		refused = false;
		void request.then((result) => {
			asking = false;
			status = result;
			if (result === 'granted') {
				announce('Persistent storage granted.');
			} else {
				refused = true;
				announce("The browser didn't grant persistent storage.");
			}
		});
	}
</script>

{#if status}
	<dl class="mt-4 flex flex-col gap-4" data-testid="storage-status">
		<div>
			<dt class="flex flex-wrap items-center gap-2 text-body font-semibold">
				Persistent storage
				{#if status === 'granted'}
					<Badge variant="positive" data-testid="persist-badge">
						<CircleCheck class="size-4" aria-hidden="true" />
						Granted
					</Badge>
				{:else if status === 'not-granted'}
					<Badge variant="attention" data-testid="persist-badge">
						<CircleAlert class="size-4" aria-hidden="true" />
						Not granted
					</Badge>
				{:else}
					<Badge variant="neutral" data-testid="persist-badge">Not reported</Badge>
				{/if}
			</dt>
			<dd class="mt-2 flex flex-col items-start gap-4 text-body">
				{#if status === 'granted'}
					<p>
						This browser has agreed not to clear Tran's data to free up space. You can still clear
						it yourself in your browser settings.
					</p>
				{:else if status === 'not-granted'}
					<p>
						This browser may clear Tran's data when the device is low on space, or after a week
						without a visit in Safari. Keep a recent backup.
					</p>
					<Button
						variant="outline"
						onclick={askAgain}
						disabled={asking}
						aria-disabled={asking ? 'true' : undefined}
						class="gap-2"
					>
						{#if asking}
							<LoaderCircle class="size-4 motion-safe:animate-spin" aria-hidden="true" />
							Asking…
						{:else}
							Ask the browser again
						{/if}
					</Button>
					{#if refused}
						<p>
							The browser said no. Browsers decide this themselves, often based on how much you use
							a site or whether it's installed. Installing the app can help.
						</p>
					{/if}
				{:else}
					<p>This browser doesn't say whether it will keep Tran's data. Keep a recent backup.</p>
				{/if}
			</dd>
		</div>
		{#if estimate}
			<div>
				<dt class="text-body font-semibold">Space used</dt>
				<dd class="mt-2 text-body tabular-nums">
					About {formatBytes(estimate.usage)} of {formatBytes(estimate.quota)}
				</dd>
			</div>
		{/if}
		{#if lastBackup && ageOf}
			<div>
				<dt class="text-body font-semibold">Last backup</dt>
				<dd class="mt-2 text-body">
					<span data-testid="last-backup-age">{ageOf(lastBackup.current)}</span>.
					<a href="#backup" class="text-primary underline underline-offset-4">Download a backup</a>
				</dd>
			</div>
		{/if}
	</dl>
{/if}
