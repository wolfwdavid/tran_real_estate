<script lang="ts">
	// 07-UI-SPEC "Memo page" (INV-06). A saved deal (?id=, read in onMount) becomes FACTS text, the
	// Phase 5 GenerationPanel drafts a memo from FACTS + notes only, and two extra post-checks
	// (numbers, advice language) join the Fair Housing checker in gating every exit. The print link
	// sits outside the panel's exits group and follows the same gate through the read-only
	// bindables (canExit / blocked / findings / artifactId / draftText); just before navigating it
	// re-runs the checks on the current text, saves it and marks the draft Reviewed.
	import { flushSync, onMount, tick, untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Info from '@lucide/svelte/icons/info';
	import Printer from '@lucide/svelte/icons/printer';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import type { Finding } from '@tran/core/fair-housing';
	import { analysisHash, analyze } from '@tran/core/finance';
	import { NOT_AVAILABLE, pct, ratio, usd } from '@tran/core/format';
	import { announce } from '$lib/components/a11y/announcer.svelte';
	import { buttonVariants } from '$lib/components/ui/button/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import type { AiArtifact, ArtifactRepo } from '$lib/ai/storage/artifacts';
	import DraftHistory from '$lib/ai/ui/DraftHistory.svelte';
	import GenerationPanel from '$lib/ai/ui/GenerationPanel.svelte';
	import { runChecks } from '$lib/ai/ui/panel-controller';
	import NotFoundPanel from '$lib/features/shared/NotFoundPanel.svelte';
	import { getDeal } from '../deals/dealsRepo';
	import type { DealRecord } from '../deals/schema';
	import { createMemoPostChecks, MEMO_CHECK_GROUPS, memoGateReasons } from './memo-checks';
	import { memoFactsForDeal } from './memo-facts-for-deal';

	const FEATURE = 'investor-memo';
	const NOTES_MAX = 1000;
	const STALE =
		'You changed this deal after this memo was drafted. Numbers that no longer match are flagged below. Draft it again to bring them up to date.';
	const DISCLAIMER = 'Not investment, legal, or tax advice. Tran is software, not a brokerage.';
	const inlineLink =
		'inline-flex min-h-11 items-center text-base leading-[1.6] font-semibold text-foreground underline underline-offset-4 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';
	const count = new Intl.NumberFormat('en-US');

	let view = $state<'loading' | 'no-id' | 'not-found' | 'ready'>('loading');
	let deal = $state.raw<DealRecord | null>(null);
	let notes = $state('');
	let notesError = $state(false);
	let repo = $state<ArtifactRepo | null>(null);
	let stale = $state(false);
	let refreshKey = $state(0);
	let panel = $state<ReturnType<typeof GenerationPanel> | null>(null);
	let panelWrap = $state<HTMLElement | null>(null);
	let notesEl = $state<HTMLTextAreaElement | null>(null);

	// Read-only outputs of the panel (Phase 5 + 07-04 bindables).
	let canExit = $state(false);
	let blocked = $state(false);
	let findings = $state<Finding[]>([]);
	let artifactId = $state<string | null>(null);
	let draftText = $state('');
	let checkPending = $state(false);

	const overLimit = $derived(notes.length > NOTES_MAX);
	const facts = $derived(deal ? memoFactsForDeal(deal, overLimit ? '' : notes) : null);
	const hash = $derived(deal ? analysisHash(deal.inputs) : '');
	const postChecks = $derived(createMemoPostChecks(facts?.allowed ?? []));
	const inputs = $derived(
		facts ? { factsText: facts.factsText, notes: facts.notes, facts } : undefined
	);
	const analysis = $derived(deal ? analyze(deal.inputs) : null);
	const metrics = $derived.by(() => {
		const a = analysis;
		if (!a) return [];
		const or = <T,>(v: T | null, f: (v: T) => string) => (v === null ? NOT_AVAILABLE : f(v));
		return [
			{ key: 'cashFlow', label: 'Monthly cash flow', value: or(a.cashFlowMonthly, usd) },
			{ key: 'coc', label: 'Cash-on-cash', value: or(a.cocPct, (v) => pct(v, 1)) },
			{ key: 'capRate', label: 'Cap rate', value: or(a.capRatePct, (v) => pct(v, 1)) },
			{ key: 'dscr', label: 'DSCR', value: or(a.dscr, (v) => ratio(v, 2)) }
		];
	});

	const printHref = $derived(
		deal && artifactId
			? `${resolve('/print/memo/')}?id=${encodeURIComponent(deal.id)}&memo=${encodeURIComponent(artifactId)}`
			: null
	);
	const analysisOnlyHref = $derived(
		deal ? `${resolve('/print/memo/')}?id=${encodeURIComponent(deal.id)}` : ''
	);
	const printEnabled = $derived(canExit && artifactId !== null && printHref !== null);
	// No href while the panel has an unchecked edit: a middle-click or new-tab open skips onPrint.
	const printLive = $derived(printEnabled && !checkPending);
	// No reason line while there is no finished draft (Phase 5 shows none then either).
	const printReasons = $derived(
		printEnabled || !artifactId || draftText === ''
			? []
			: memoGateReasons(findings, blocked, canExit)
	);

	async function refreshStale(): Promise<void> {
		if (!repo || !deal) return;
		const [latest] = await repo.listBySubject(FEATURE, deal.id, { limit: 1 });
		stale = latest !== undefined && latest.meta?.analysisHash !== analysisHash(deal.inputs);
	}

	// Draft history and the stale note reload after the panel saves or opens a draft.
	$effect(() => {
		void artifactId;
		untrack(() => {
			refreshKey++;
			void refreshStale();
		});
	});

	onMount(() => {
		let disposed = false;
		const id = new URL(location.href).searchParams.get('id');
		if (!id) {
			view = 'no-id';
			return;
		}
		void (async () => {
			const [rec, m] = await Promise.all([getDeal(id), import('$lib/ai/storage/artifacts')]);
			if (disposed) return;
			if (!rec) {
				view = 'not-found';
				return;
			}
			deal = rec;
			repo = m.createArtifactRepo();
			view = 'ready';
			await refreshStale();
		})();
		return () => {
			disposed = true;
		};
	});

	function beforeGenerate(): boolean {
		if (!overLimit) return true;
		notesError = true;
		notesEl?.focus();
		return false;
	}

	function onNotesInput(): void {
		if (notesError && !overLimit) notesError = false;
		if (overLimit) notesError = true;
	}

	function focusFindings(reason: string | undefined): void {
		panelWrap?.querySelector<HTMLElement>('[id$="-findings-title"]')?.focus();
		if (reason) announce(reason);
	}

	/** Runs the memo panel's pending edit recheck and writes the result to the DOM before the
	 *  gate is read or focus moves (the findings title node may be replaced). */
	function settlePrint(): void {
		panel?.flushChecks();
		flushSync();
	}

	async function onPrint(e: MouseEvent | KeyboardEvent): Promise<void> {
		e.preventDefault();
		// Read printEnabled and findings for the text as it is right now, not 300 ms ago.
		settlePrint();
		if (!printEnabled || !printHref || !artifactId || !repo) {
			focusFindings(printReasons[0]);
			return;
		}
		// The panel rechecks 300ms after typing stops: check the text as it is right now.
		const fresh = runChecks(draftText, postChecks);
		if (fresh.some((f) => f.severity === 'block')) {
			focusFindings(memoGateReasons(fresh, true, false)[0]);
			return;
		}
		const href = printHref;
		await repo.updateText(artifactId, draftText, fresh);
		const stored = await repo.get(artifactId);
		if (stored?.status === 'draft') await repo.setStatus(artifactId, 'acknowledged', new Date());
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- href is built from resolve()
		await goto(href);
	}

	function onPrintKey(e: KeyboardEvent): void {
		if (e.key !== 'Enter') return;
		settlePrint();
		// A link without an href ignores Enter natively, so run the gated path here. With a live
		// href the native click follows and onPrint handles it (do not call onPrint twice).
		if (!printLive) void onPrint(e);
	}

	async function onOpen(a: AiArtifact): Promise<void> {
		await panel?.openArtifact(a);
		await tick();
	}
</script>

<p class="mt-4 max-w-prose text-base leading-[1.6] text-foreground">
	Turn a saved deal into a short memo you can print or share. The memo uses only your saved figures
	and your notes.
</p>

{#if view === 'loading'}
	<p class="mt-4 text-label text-muted-foreground">Loading your investor data…</p>
{:else if view === 'no-id'}
	<div class="mt-8 flex gap-3 rounded-md bg-surface p-4" data-memo-no-deal>
		<Info class="mt-1 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
		<div>
			<h2 class="text-base leading-[1.6] font-semibold text-foreground">Save a deal first</h2>
			<p class="mt-1 text-base leading-[1.6] text-foreground">
				Memos are written from a saved deal. Analyze a property and save it, then come back here.
			</p>
			<p class="mt-2 flex flex-wrap gap-x-6">
				<a href={resolve('/investor/analyze/')} class={inlineLink}>Analyze a deal</a>
				<a href={resolve('/investor/deals/')} class={inlineLink}>Go to saved deals</a>
			</p>
		</div>
	</div>
{:else if view === 'not-found'}
	<div class="mt-8">
		<NotFoundPanel
			title="We couldn't find that deal in this browser"
			body="It may have been deleted, or saved in another browser. Deals are stored only where you saved them."
			href={resolve('/investor/deals/')}
			linkLabel="Back to saved deals"
		/>
	</div>
{:else if deal && facts}
	<div class="mt-8 flex flex-col gap-8" data-memo-page={deal.id}>
		<!-- 1. Deal summary -->
		<section
			aria-labelledby="memo-deal-name"
			class="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 sm:p-6"
		>
			<div>
				<h2
					id="memo-deal-name"
					class="text-base leading-[1.6] font-semibold [overflow-wrap:anywhere] text-foreground"
				>
					{deal.name}
				</h2>
				<p class="text-base leading-[1.6] [overflow-wrap:anywhere] text-muted-foreground">
					{deal.address}
				</p>
			</div>
			<dl class="grid grid-cols-2 gap-4 sm:grid-cols-4" data-memo-metrics>
				{#each metrics as m (m.key)}
					<div data-metric={m.key}>
						<dt class="text-label text-muted-foreground">{m.label}</dt>
						<dd class="text-base leading-[1.6] font-semibold text-foreground tabular-nums">
							{m.value}
						</dd>
					</div>
				{/each}
			</dl>
			<p>
				<!-- eslint-disable svelte/no-navigation-without-resolve -- resolve() plus a query string -->
				<a
					href={`${resolve('/investor/analyze/')}?id=${encodeURIComponent(deal.id)}`}
					class={buttonVariants({ variant: 'ghost' })}>Open in analyzer</a
				>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			</p>
		</section>

		<!-- 2. What the memo uses -->
		<p class="flex max-w-prose items-start gap-2 text-base leading-[1.6] text-muted-foreground">
			<Info size={16} class="mt-1.5 shrink-0" aria-hidden="true" />
			The AI writes the words. Every number comes from your analysis, and Tran flags any number it didn't
			calculate.
		</p>

		<!-- 3. Notes -->
		<div class="flex max-w-160 flex-col gap-2">
			<label for="memo-notes" class="text-base font-semibold text-foreground"
				>Your notes for the memo (optional)</label
			>
			<Textarea
				id="memo-notes"
				bind:ref={notesEl}
				bind:value={notes}
				oninput={onNotesInput}
				class="min-h-40"
				aria-describedby="memo-notes-help memo-notes-count{notesError ? ' memo-notes-error' : ''}"
				aria-invalid={notesError ? 'true' : undefined}
			/>
			<p id="memo-notes-help" class="text-label text-muted-foreground">
				Add context you want in the memo, like your plans for the property. Describe the property,
				not the people around it.
			</p>
			<p id="memo-notes-count" class="text-label text-muted-foreground" aria-live="off">
				{count.format(notes.length)} of 1,000 characters
			</p>
			{#if notesError}
				<p id="memo-notes-error" class="text-label font-semibold text-destructive">
					Shorten your notes to 1,000 characters.
				</p>
			{/if}
		</div>

		<!-- Stale note -->
		{#if stale}
			<p
				class="flex max-w-160 items-start gap-2 text-base leading-[1.6] text-foreground"
				data-memo-stale
			>
				<TriangleAlert size={16} class="mt-1.5 shrink-0" aria-hidden="true" />
				{STALE}
			</p>
		{/if}

		<!-- 4. Panel -->
		<div bind:this={panelWrap}>
			<GenerationPanel
				bind:this={panel}
				bind:canExit
				bind:blocked
				bind:findings
				bind:artifactId
				bind:draftText
				bind:checkPending
				feature={FEATURE}
				promptId="investor/memo.v1"
				title="Memo draft"
				headingLevel={2}
				generateLabel="Draft memo"
				{inputs}
				mailto={{ subject: 'Investment memo: ' + deal.name }}
				containsClientData={false}
				{postChecks}
				checkGroups={MEMO_CHECK_GROUPS}
				subjectId={deal.id}
				artifactMeta={{ analysisHash: hash }}
				{beforeGenerate}
				onExit={() => refreshKey++}
			/>
		</div>

		<!-- 6. Print region -->
		<section
			aria-labelledby="memo-print-heading"
			class="flex max-w-160 flex-col gap-4 rounded-lg border border-border bg-card p-4 sm:p-6"
			data-memo-print
			data-artifact-id={artifactId ?? ''}
		>
			<h2 id="memo-print-heading" class="font-display text-heading font-semibold text-foreground">
				Print or save as PDF
			</h2>
			<p class="text-base leading-[1.6] text-foreground">
				Open a print-ready page with this memo, your key figures, your inputs, and where the data
				came from. Then use your browser's print dialog to save it as a PDF.
			</p>
			<div class="flex flex-col gap-2">
				<!-- eslint-disable svelte/no-navigation-without-resolve -- printHref is built from resolve() -->
				<a
					href={printLive ? printHref : undefined}
					role={printLive ? undefined : 'link'}
					tabindex={printLive ? undefined : 0}
					aria-disabled={printEnabled ? undefined : 'true'}
					aria-describedby={printReasons.length > 0 ? 'memo-print-reasons' : undefined}
					onpointerdown={settlePrint}
					onclick={onPrint}
					onkeydown={onPrintKey}
					class="{buttonVariants({
						variant: 'outline'
					})} w-full aria-disabled:border aria-disabled:border-border aria-disabled:bg-surface aria-disabled:text-muted-foreground aria-disabled:hover:bg-surface sm:w-auto sm:self-start"
					data-memo-print-link
				>
					<Printer size={16} aria-hidden="true" />Open print view
				</a>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
				{#if printReasons.length > 0}
					<div id="memo-print-reasons" class="flex flex-col gap-1">
						{#each printReasons as r (r)}
							<p class="text-label font-semibold text-foreground">{r}</p>
						{/each}
					</div>
				{/if}
			</div>
			<p>
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- built from resolve() -->
				<a href={analysisOnlyHref} class={inlineLink}>Print the analysis without a memo</a>
			</p>
		</section>

		<!-- 7. Draft history -->
		{#if repo}
			<DraftHistory
				feature={FEATURE}
				{repo}
				headingLevel={3}
				subjectId={deal.id}
				onOpen={(a) => void onOpen(a)}
				{refreshKey}
			/>
		{/if}

		<!-- 8. Disclaimer -->
		<p class="text-label text-foreground">{DISCLAIMER}</p>
	</div>
{/if}
