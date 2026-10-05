<script lang="ts">
	import { onMount, type Component } from 'svelte';
	import { announce } from '$lib/components/a11y/announcer.svelte';
	import { availableSections } from '$lib/features/shared/settings/sections';
	import {
		createSettingsContext,
		setSettingsContext
	} from '$lib/features/shared/settings/settings-context.svelte';
	import SettingsNav from '$lib/features/shared/settings/SettingsNav.svelte';
	import StorageBlockedAlert from '$lib/features/shared/settings/StorageBlockedAlert.svelte';
	import ApiKeysSection from '$lib/features/shared/settings/ApiKeysSection.svelte';
	import KeySecuritySection from '$lib/features/shared/settings/KeySecuritySection.svelte';
	import BackupSection from '$lib/features/shared/settings/BackupSection.svelte';
	import StorageSection from '$lib/features/shared/settings/StorageSection.svelte';
	import InstallSection from '$lib/features/shared/settings/InstallSection.svelte';

	// Prerendered shell: every section's static copy renders at build time. The vault, IndexedDB
	// and Storage API code load only after hydration, through dynamic import() in onMount, so they
	// never enter the prerender or any other route's entry chunk.

	// Phase 3 sections. Later phases add their slot's component here and flip `available` in
	// sections.ts; the registry order decides placement.
	const SECTION_COMPONENTS: Record<string, Component> = {
		'api-keys': ApiKeysSection,
		'key-security': KeySecuritySection,
		backup: BackupSection,
		storage: StorageSection,
		install: InstallSection
	};
	const sections = availableSections().filter((s) => s.id in SECTION_COMPONENTS);

	const ctx = createSettingsContext();
	setSettingsContext(ctx);

	// Announced when another Tran tab changes the vault (VaultEvent.remote).
	const REMOTE_MESSAGES: Record<string, string | undefined> = {
		forgotten: 'Your keys were forgotten in another Tran tab.',
		locked: 'Your keys were locked in another Tran tab.',
		'mode-changed': 'Key storage was changed in another Tran tab.'
	};

	onMount(() => {
		let disposed = false;
		const cleanups: (() => void)[] = [];

		void (async () => {
			try {
				const [{ getVault, createVaultState }, { getDb, openDb, StorageBlockedError }] =
					await Promise.all([import('$lib/storage/secrets'), import('$lib/storage/db')]);

				try {
					ctx.db = await openDb(getDb());
				} catch (err) {
					if (err instanceof StorageBlockedError) ctx.storageBlocked = true;
					else throw err;
				}

				const vault = await getVault();
				if (disposed) return;
				ctx.vault = vault;

				const state = createVaultState(vault);
				ctx.vaultStatus = state.status;
				const offStatus = vault.onChange(() => {
					ctx.vaultStatus = state.status;
				});
				cleanups.push(state.dispose, offStatus);
				ctx.storageBlocked ||= vault.getStatus().storageBlocked;

				const offRemote = vault.onChange((e) => {
					if (!e.remote) return;
					const message = REMOTE_MESSAGES[e.kind];
					if (message) announce(message);
				});
				cleanups.push(offRemote);
			} finally {
				if (!disposed) ctx.ready = true;
			}
		})();

		return () => {
			disposed = true;
			for (const off of cleanups) off();
		};
	});
</script>

<svelte:head>
	<title>Settings: Tran Real Estate Tools</title>
	<meta
		name="description"
		content="Manage your API keys, key security, backups, storage, and app install for Tran Real Estate Tools. Everything stays in this browser."
	/>
</svelte:head>

<div
	data-hydrated={ctx.ready ? 'true' : undefined}
	class="mx-auto max-w-page px-6 py-12 md:px-8 md:py-16"
>
	<h1 class="font-display text-display font-semibold">Settings</h1>
	<p class="mt-4 mb-12 max-w-reading text-body text-muted-foreground">
		Your API keys and saved data live in this browser, not on a Tran server. Manage them, protect
		them, and back them up here.
	</p>

	<div class="lg:grid lg:grid-cols-[240px_1fr] lg:gap-16">
		<div class="lg:sticky lg:top-6 lg:self-start">
			<SettingsNav />
		</div>
		<div class="max-w-reading">
			{#if ctx.storageBlocked}
				<StorageBlockedAlert />
			{/if}
			{#each sections as section, i (section.id)}
				{@const Section = SECTION_COMPONENTS[section.id]}
				<div class={i === 0 ? undefined : 'mt-12 border-t border-border pt-12 md:mt-16 md:pt-16'}>
					<Section />
				</div>
			{/each}
		</div>
	</div>
</div>
