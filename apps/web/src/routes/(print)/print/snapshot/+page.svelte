<script lang="ts">
	// /print/snapshot/?id= (STU-04): the chrome-free Market Snapshot printout. The page is a
	// prerendered shell (h1 + "Preparing your printout…"); ?id= is read only in onMount. `sample`
	// renders the built-in sample record with no storage read; any other id is looked up in this
	// browser's saved snapshots. The record is frozen, so the printout spends 0 RentCast calls: this
	// route's module graph never reaches the gateway or lib/data (boundaries.test.ts). Printing starts
	// only from the toolbar button, which stays "Preparing…" until fonts are ready and the agent's
	// logo has decoded.
	import { onMount, tick } from 'svelte';
	import { resolve } from '$app/paths';
	import { buttonVariants } from '$lib/components/ui/button/index.js';
	import NotFoundPanel from '$lib/features/shared/NotFoundPanel.svelte';
	import { SAMPLE_SNAPSHOT_RECORD } from '$lib/features/studio/fixtures/sample-snapshot';
	import SnapshotReport from '$lib/features/studio/snapshot/SnapshotReport.svelte';
	import { snapshotDocumentTitle } from '$lib/features/studio/snapshot/report-copy';
	import type { SnapshotRecord } from '$lib/storage/studio/types';

	type View = 'hydrating' | 'missing' | 'not-found' | 'ready';

	let view = $state<View>('hydrating');
	let record = $state<SnapshotRecord | null>(null);
	let logoUrl = $state<string | null>(null);
	let preparing = $state(true);

	const studioHref = resolve('/agent/studio/snapshot/');

	async function printNow(): Promise<void> {
		await document.fonts.ready;
		window.print();
	}

	/**
	 * Resolves once every stylesheet link in the document has loaded (or failed). After a
	 * client-side navigation (Save and open print view) the report can render before this route's
	 * stylesheet arrives; printing then would drop the brand band and the brand-colored title.
	 */
	function stylesheetsReady(): Promise<void> {
		const pending = [
			...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')
		].filter((link) => link.sheet === null);
		return Promise.all(
			pending.map(
				(link) =>
					new Promise<void>((done) => {
						link.addEventListener('load', () => done(), { once: true });
						link.addEventListener('error', () => done(), { once: true });
					})
			)
		).then(() => undefined);
	}

	/**
	 * Enables the print button once the route's styles and fonts are loaded and the logo (if any)
	 * has decoded.
	 */
	async function settle(isDisposed: () => boolean): Promise<void> {
		await stylesheetsReady();
		await document.fonts.ready;
		await tick();
		const img = document.querySelector<HTMLImageElement>('[data-brand-logo]');
		if (img) await img.decode().catch(() => {});
		if (isDisposed()) return;
		preparing = false;
		await tick();
		document.querySelector<HTMLButtonElement>('[data-print-button]')?.focus();
	}

	async function focusPanel(): Promise<void> {
		await tick();
		const heading = document.querySelector<HTMLElement>('[data-not-found-panel] :is(h2, h3, h4)');
		if (!heading) return;
		// Programmatic focus target only (not in the tab order).
		heading.setAttribute('tabindex', '-1');
		heading.focus();
	}

	onMount(() => {
		let disposed = false;
		let objectUrl: string | null = null;
		const isDisposed = () => disposed;
		const id = new URL(location.href).searchParams.get('id');

		void (async () => {
			if (!id) {
				view = 'missing';
				await focusPanel();
				return;
			}
			let rec: SnapshotRecord | null;
			if (id === 'sample') {
				rec = SAMPLE_SNAPSHOT_RECORD;
			} else {
				const { getSnapshot } = await import('$lib/storage/studio/snapshots-repo');
				rec = await getSnapshot(id);
			}
			if (disposed) return;
			if (!rec) {
				view = 'not-found';
				await focusPanel();
				return;
			}
			// The logo lives in the agent profile (the record only says it had one). Never for the
			// sample record: the sample agent is not the person using this browser.
			if (!rec.sample && rec.agent.hasLogo) {
				const { loadAgentProfile, logoObjectUrl } =
					await import('$lib/features/shared/agent-profile');
				const profile = await loadAgentProfile().catch(() => null);
				if (disposed) return;
				if (profile?.logo) {
					objectUrl = logoObjectUrl(profile.logo);
					logoUrl = objectUrl;
				}
			}
			record = rec;
			document.title = snapshotDocumentTitle(rec);
			view = 'ready';
			await settle(isDisposed);
		})();

		return () => {
			disposed = true;
			if (objectUrl) URL.revokeObjectURL(objectUrl);
		};
	});
</script>

<svelte:head>
	<title>Market Snapshot &middot; Tran Real Estate Tools</title>
	<meta
		name="description"
		content="A printable Market Snapshot report for one ZIP code, branded with your details."
	/>
</svelte:head>

{#if view === 'ready' && record}
	<div data-ready>
		<SnapshotReport {record} {logoUrl} {preparing} onprint={printNow} />
	</div>
{:else}
	<div data-print-hidden class="border-b border-border print:hidden">
		<div class="mx-auto max-w-page px-6 py-4">
			<!-- eslint-disable svelte/no-navigation-without-resolve -- studioHref is built from resolve() -->
			<a href={studioHref} class={buttonVariants({ variant: 'outline' })}>Back to Studio</a>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		</div>
	</div>
	<div class="mx-auto max-w-page px-6 py-8 md:px-8">
		<h1 class="font-display text-display font-semibold">Market Snapshot</h1>
		{#if view === 'hydrating'}
			<p class="mt-4 text-label text-muted-foreground">Preparing your printout&hellip;</p>
		{:else if view === 'missing'}
			<div class="mt-6">
				<NotFoundPanel
					title="Pick a snapshot to print"
					body="Open a saved snapshot from the Studio, or preview the sample report."
					href={studioHref}
					linkLabel="Go to Market Snapshot"
				/>
			</div>
		{:else}
			<div class="mt-6">
				<NotFoundPanel
					title="We couldn't find that snapshot in this browser"
					body="It may have been deleted, or saved in another browser. Snapshots are stored only where you saved them."
					href={studioHref}
					linkLabel="Back to Studio"
				/>
			</div>
		{/if}
	</div>
{/if}
