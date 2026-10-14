<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import Check from '@lucide/svelte/icons/check';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import FlaskConical from '@lucide/svelte/icons/flask-conical';
	import { PROVIDERS } from '@tran/core';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import ButtonLink from '$lib/components/ui/ButtonLink.svelte';
	import { SETUP_COPY as COPY } from '$lib/content/onboarding';
	import type { OnboardingPortal } from '$lib/components/onboarding/onboarding-state';
	import { writeOnboarding } from '$lib/components/onboarding/onboarding-state';
	import { parseSetupPortal } from '$lib/components/onboarding/setup-params';
	import { enableRentCastKeyTest, getDataRuntime, hasSavedCap, rentCastKeyTest } from '$lib/data';
	import CapEditor from '$lib/features/shared/data/CapEditor.svelte';
	import ProviderKeyCard from '$lib/features/shared/settings/ProviderKeyCard.svelte';
	import StorageBlockedAlert from '$lib/features/shared/settings/StorageBlockedAlert.svelte';
	import {
		createSettingsContext,
		setSettingsContext
	} from '$lib/features/shared/settings/settings-context.svelte';

	// Guided free RentCast key setup (GTM-01; 10-UI-SPEC "/setup/rentcast/"). Not a wizard: all three
	// steps are visible at once, and every badge comes from real state (vault, key test, ledger), so
	// a visitor who leaves for RentCast's dashboard and comes back sees where they are.
	// Same hydration rule as Settings: the prerendered shell shows the static copy and "Checking this
	// browser…"; the vault and IndexedDB load through dynamic import() in onMount.

	const rentcast = PROVIDERS.find((p) => p.id === 'rentcast');
	if (!rentcast) throw new Error('RentCast provider missing from PROVIDERS');

	// ProviderKeyCard reads the Settings context; this page fills one the way Settings does.
	const ctx = createSettingsContext();
	setSettingsContext(ctx);

	// The app data runtime from DataShell ((app) layout). Read during init, not in onMount.
	const dataRuntime = getDataRuntime();

	const PORTAL_HREFS: Record<OnboardingPortal, string> = {
		renter: resolve('/renter/'),
		investor: resolve('/investor/'),
		agent: resolve('/agent/')
	};

	let portal = $state<OnboardingPortal>('renter');
	const portalHref = $derived(PORTAL_HREFS[portal]);

	let capSaved = $state(false);
	let capChecked = $state(false);

	const keyEntry = $derived(ctx.vaultStatus?.providers.rentcast);
	const keySaved = $derived(keyEntry?.state === 'session' || keyEntry?.state === 'remembered');
	const keyTested = $derived(
		rentCastKeyTest.current?.outcome === 'valid' ||
			rentCastKeyTest.current?.outcome === 'valid-billed'
	);
	const keyReady = $derived(keySaved && keyTested);

	const usage = $derived(dataRuntime.usage);
	const hydrated = $derived(ctx.ready && capChecked && (usage !== null || ctx.storageBlocked));

	async function saveCap(cap: number): Promise<void> {
		await dataRuntime.saveCap(cap);
		capSaved = true;
	}

	// A cap saved in another tab marks step 3 done here too.
	$effect(() => {
		if (dataRuntime.lastRemoteChange?.type === 'cap-changed') untrack(() => (capSaved = true));
	});

	onMount(() => {
		let disposed = false;
		portal = parseSetupPortal(location.search);
		// Arriving here counts as finishing the guide for this portal.
		writeOnboarding({ status: 'done', lastPortal: portal });

		// The RentCast "Test key (0 calls)" hook: registered only while this page is mounted.
		const cleanups: (() => void)[] = [enableRentCastKeyTest(dataRuntime)];

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
				if (ctx.db) {
					const saved = await hasSavedCap(ctx.db).catch(() => false);
					if (!disposed) capSaved ||= saved;
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
			} finally {
				if (!disposed) {
					capChecked = true;
					ctx.ready = true;
				}
			}
		})();

		return () => {
			disposed = true;
			for (const off of cleanups) off();
		};
	});

	const numeral =
		'flex size-10 shrink-0 items-center justify-center rounded-full border border-primary font-display text-body font-semibold text-primary tabular-nums';
	const keySecurityHref = `${resolve('/settings/')}#key-security`;
	const inlineLink = 'text-primary underline underline-offset-3 hover:text-primary-hover';
</script>

<svelte:head>
	<title>Connect a free RentCast key: Tran Real Estate Tools</title>
	<meta name="description" content={COPY.description} />
</svelte:head>

<div
	data-setup-page
	data-hydrated={hydrated ? 'true' : undefined}
	class="mx-auto max-w-reading px-6 py-12 md:py-16"
>
	<h1 class="font-display text-display font-semibold">{COPY.h1}</h1>
	<p class="mt-4 text-body text-muted-foreground">{COPY.lead}</p>

	{#if ctx.storageBlocked}
		<div class="mt-8">
			<StorageBlockedAlert />
		</div>
	{/if}

	<ol class="mt-12 space-y-8">
		<li>
			<section aria-labelledby="step-1-heading" class="border-t border-border pt-8">
				<div class="flex items-center gap-4">
					<span aria-hidden="true" class={numeral}>1</span>
					<h2 id="step-1-heading" class="font-display text-heading font-semibold">
						{COPY.step1.heading}
					</h2>
				</div>
				<ul class="mt-4 list-disc space-y-2 pl-6 text-body">
					{#each COPY.step1.list as item (item)}
						<li>{item}</li>
					{/each}
				</ul>
				<!-- eslint-disable svelte/no-navigation-without-resolve -- off-site RentCast dashboard, same tab -->
				<a
					href="https://app.rentcast.io/app/api"
					class="mt-4 inline-flex min-h-11 items-center gap-1 {inlineLink}"
					>{COPY.step1.dashboardLink}<ExternalLink size={14} aria-hidden="true" /><span
						class="sr-only"
					>
						(opens external site)</span
					></a
				>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
				<p class="mt-2 text-label text-muted-foreground">{COPY.step1.helper}</p>
			</section>
		</li>

		<li>
			<section aria-labelledby="step-2-heading" class="border-t border-border pt-8">
				<div class="flex flex-wrap items-center gap-4">
					<span aria-hidden="true" class={numeral}>2</span>
					<h2 id="step-2-heading" class="font-display text-heading font-semibold">
						{COPY.step2.heading}
					</h2>
					{#if hydrated}
						{#if keyReady}
							<Badge variant="positive"
								><Check size={14} aria-hidden="true" />{COPY.badges.done}</Badge
							>
						{:else}
							<Badge variant="neutral">{COPY.badges.todo}</Badge>
						{/if}
					{/if}
				</div>
				<p class="mt-4 text-body">{COPY.step2.paragraph}</p>
				<div class="mt-6">
					<ProviderKeyCard provider={rentcast} settingsBase={resolve('/settings/')} />
				</div>
				<!-- eslint-disable svelte/no-navigation-without-resolve -- resolve('/settings/') + #fragment -->
				<p class="mt-4 text-label text-muted-foreground">
					{COPY.step2.storageBefore}<a href={keySecurityHref} class={inlineLink}
						>{COPY.step2.storageLink}</a
					>{COPY.step2.storageAfter}
				</p>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			</section>
		</li>

		<li>
			<section aria-labelledby="step-3-heading" class="border-t border-border pt-8">
				<div class="flex flex-wrap items-center gap-4">
					<span aria-hidden="true" class={numeral}>3</span>
					<h2 id="step-3-heading" class="font-display text-heading font-semibold">
						{COPY.step3.heading}
					</h2>
					{#if hydrated}
						{#if capSaved}
							<Badge variant="positive"
								><Check size={14} aria-hidden="true" />{COPY.badges.done}</Badge
							>
						{:else}
							<Badge variant="neutral">{COPY.badges.defaultCap}</Badge>
						{/if}
					{/if}
				</div>
				<p class="mt-4 text-body">{COPY.step3.paragraph}</p>
				<div class="mt-6">
					{#if usage}
						<CapEditor cap={usage.cap} used={usage.countedTowardCap} onSave={saveCap} />
					{:else}
						<p class="text-label text-muted-foreground">Checking this browser…</p>
					{/if}
				</div>
			</section>
		</li>
	</ol>

	<section aria-labelledby="finish-heading" class="mt-8 border-t border-border pt-8">
		<h2 id="finish-heading" class="font-display text-heading font-semibold">
			{COPY.finish.heading}
		</h2>
		<p class="mt-4 flex items-start gap-2 text-body">
			{#if hydrated && keyReady}
				<CircleCheck size={20} aria-hidden="true" class="mt-0.5 shrink-0 text-secondary" />
				{COPY.finish.ready}
			{:else if hydrated}
				<FlaskConical size={20} aria-hidden="true" class="mt-0.5 shrink-0 text-foreground" />
				{COPY.finish.notReady}
			{:else}
				<span class="text-label text-muted-foreground">Checking this browser…</span>
			{/if}
		</p>
		<div class="mt-6 flex flex-col gap-2 sm:flex-row sm:gap-4">
			<ButtonLink href={portalHref} variant="primary">{COPY.finish.open(portal)}</ButtonLink>
			<!-- eslint-disable svelte/no-navigation-without-resolve -- portalHref is resolve() output -->
			<a
				href="{portalHref}?source=sample"
				class="inline-flex min-h-12 touch-manipulation items-center justify-center rounded-md px-6 text-body font-semibold text-primary transition-colors duration-150 ease-out hover:bg-surface"
				>{COPY.finish.sample}</a
			>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		</div>
	</section>
</div>
