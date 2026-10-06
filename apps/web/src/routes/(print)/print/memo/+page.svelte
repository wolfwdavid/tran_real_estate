<script lang="ts">
	// /print/memo/?id=&memo= (INV-06): the chrome-free printout of a saved deal and its memo. The ids
	// are read only in onMount from location (the page is a prerendered shell). The memo is re-checked
	// on load against the CURRENT deal with Phase 5 runChecks (Fair Housing + the memo post-checks);
	// a Must fix finding, or a Review finding on a draft nobody acknowledged, means no sheet. Printing
	// starts only from the toolbar button, after fonts are ready; the browser saves the PDF.
	import { onMount, tick } from 'svelte';
	import { resolve } from '$app/paths';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import { providerById, type ProviderId } from '@tran/core';
	import { analyze } from '@tran/core/finance';
	import { buttonVariants } from '$lib/components/ui/button/index.js';
	import type { AiArtifact } from '$lib/ai/storage/artifacts';
	import { runChecks } from '$lib/ai/ui/panel-controller';
	import NotFoundPanel from '$lib/features/shared/NotFoundPanel.svelte';
	import PrintReport from '$lib/features/shared/print/PrintReport.svelte';
	import { getDeal } from '$lib/features/investor/deals/dealsRepo';
	import type { DealRecord } from '$lib/features/investor/deals/schema';
	import MemoPrintout from '$lib/features/investor/memo/MemoPrintout.svelte';
	import { createMemoPostChecks } from '$lib/features/investor/memo/memo-checks';
	import { memoFactsForDeal } from '$lib/features/investor/memo/memo-facts-for-deal';
	import {
		dealIsSample,
		inputTables,
		keyFigures,
		PRINT_DISCLAIMER,
		PRINT_DISCLAIMER_FULL,
		printTitle,
		provenanceSentence
	} from '$lib/features/investor/memo/print-model';

	type View = 'hydrating' | 'not-found' | 'blocked' | 'ready';

	let view = $state<View>('hydrating');
	let deal = $state<DealRecord | null>(null);
	let memo = $state<AiArtifact | null>(null);
	let dealId = $state('');
	const preparedAt = new Date();

	const analysis = $derived(deal ? analyze(deal.inputs) : null);
	const backHref = $derived(
		dealId
			? `${resolve('/investor/memo/')}?id=${encodeURIComponent(dealId)}`
			: resolve('/investor/memo/')
	);
	const memoMeta = $derived(
		memo
			? {
					provider: providerById(memo.provider as ProviderId)?.label ?? memo.provider,
					model: memo.model,
					sample: memo.sample
				}
			: null
	);

	/** Phase 5 gate, re-run here: any Must fix, or a Review finding never acknowledged. */
	function isBlocked(artifact: AiArtifact, current: DealRecord): boolean {
		const findings = runChecks(
			artifact.text,
			createMemoPostChecks(memoFactsForDeal(current, '').allowed)
		);
		return findings.some(
			(f) => f.severity === 'block' || (f.severity === 'warn' && artifact.status === 'draft')
		);
	}

	async function printNow(): Promise<void> {
		await document.fonts.ready;
		window.print();
	}

	onMount(() => {
		let disposed = false;
		const params = new URL(location.href).searchParams;
		const id = params.get('id');
		const memoId = params.get('memo');
		if (!id) {
			view = 'not-found';
			return;
		}
		dealId = id;
		void (async () => {
			const rec = await getDeal(id);
			if (disposed) return;
			if (!rec) {
				view = 'not-found';
				return;
			}
			let artifact: AiArtifact | null = null;
			if (memoId) {
				const { createArtifactRepo } = await import('$lib/ai/storage/artifacts');
				const found = await createArtifactRepo().get(memoId);
				if (disposed) return;
				if (found && !found.deletedAt && found.subjectId === id) artifact = found;
			}
			deal = rec;
			document.title = printTitle(rec.name, preparedAt);
			if (artifact && isBlocked(artifact, rec)) {
				view = 'blocked';
				return;
			}
			memo = artifact;
			view = 'ready';
			await tick();
			document.querySelector<HTMLButtonElement>('[data-print-button]')?.focus();
		})();
		return () => {
			disposed = true;
		};
	});
</script>

<svelte:head>
	<title>Investment memo: Tran Real Estate Tools</title>
	<meta
		name="description"
		content="A printable investment memo for one saved deal, with its figures, inputs and data sources."
	/>
</svelte:head>

{#if view === 'ready' && deal && analysis}
	<div data-ready>
		<PrintReport
			title="Investment memo: {deal.name}"
			subtitle={deal.address || undefined}
			{preparedAt}
			sample={dealIsSample(deal) || (memo?.sample ?? false)}
			provenance={provenanceSentence(deal, memoMeta)}
			disclaimer={PRINT_DISCLAIMER}
			disclaimerFull={PRINT_DISCLAIMER_FULL}
			{backHref}
			backLabel="Back to memo"
			onprint={printNow}
		>
			<MemoPrintout
				memoText={memo?.text ?? null}
				figures={keyFigures(analysis)}
				tables={inputTables(deal, analysis)}
			/>
		</PrintReport>
	</div>
{:else}
	{#if view !== 'blocked'}
		<!-- The toolbar stays while hydrating and on not-found; the blocked panel carries its own link. -->
		<div data-print-hidden class="border-b border-border print:hidden">
			<div class="mx-auto max-w-page px-6 py-4">
				<!-- eslint-disable svelte/no-navigation-without-resolve -- backHref is built from resolve() -->
				<a href={backHref} class={buttonVariants({ variant: 'outline' })}>Back to memo</a>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			</div>
		</div>
	{/if}
	<div class="mx-auto max-w-page px-6 py-6">
		<h1 class="font-display text-heading font-semibold">Investment memo</h1>
		{#if view === 'hydrating'}
			<p class="mt-4 text-label text-muted-foreground">Preparing your printout…</p>
		{:else if view === 'not-found'}
			<div class="mt-6">
				<NotFoundPanel
					title="We couldn't find that deal in this browser"
					body="It may have been deleted, or saved in another browser. Deals are stored only where you saved them."
					href={resolve('/investor/deals/')}
					linkLabel="Back to saved deals"
				/>
			</div>
		{:else}
			<div class="mt-6 flex gap-3 rounded-md bg-surface p-4" data-print-blocked>
				<CircleAlert class="mt-1 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
				<div>
					<h2 class="text-base leading-[1.6] font-semibold text-foreground">
						This memo has flags to fix before printing
					</h2>
					<p class="mt-1 text-base leading-[1.6] text-foreground">
						Go back to the memo, fix the phrases or numbers marked Must fix, and review any others.
						Then open the print view again.
					</p>
					<p class="mt-2">
						<!-- eslint-disable svelte/no-navigation-without-resolve -- backHref is built from resolve() -->
						<a
							href={backHref}
							class="inline-flex min-h-11 items-center text-base leading-[1.6] font-semibold text-foreground underline underline-offset-4 hover:decoration-2"
							>Back to memo</a
						>
						<!-- eslint-enable svelte/no-navigation-without-resolve -->
					</p>
				</div>
			</div>
		{/if}
	</div>
{/if}
