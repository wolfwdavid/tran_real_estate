<script lang="ts">
	// /investor/buy-boxes/ (INV-04, ROADMAP SC3). Prerendered shell: buy boxes and matches load in
	// the browser.
	//
	// Opening the page never spends. The box list is a Dexie liveQuery, so the Phase 4 check-on-open
	// pass (DataShell, the ONE scheduler trigger) and Check now show up at once. Each box's matches,
	// New flags and quick metrics are re-read from the cache (loadMatches: peeks only, 0 calls)
	// whenever the list or the data source changes. Spends happen only in click handlers: Save and
	// check now / Check now (checkNow, 1 call unless cached), and the match rows' Load ZIP rents and
	// Deep analyze. "New since last visit" resets (markSeen) when the visit ends, for boxes whose
	// matches were open, so New badges stay visible while the user is here.
	import { onMount, tick, untrack } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import Plus from '@lucide/svelte/icons/plus';
	import { getDataRuntime, isGatewayError, type CostEstimate, type GatewayError } from '$lib/data';
	import { GatewayError as GatewayErrorValue } from '@tran/core/request';
	import { announce, Button } from '$lib/features/shared/data/platform-ui';
	import PortalSubNav from '$lib/features/shared/nav/PortalSubNav.svelte';
	import { INVESTOR_NAV } from '$lib/features/investor/nav';
	import { useInvestorPort } from '$lib/features/investor/data/investor-port';
	import { useMarketsPort } from '$lib/features/shared/markets/markets-port';
	import { useBuyBoxRepo, type BuyBoxView } from '$lib/features/investor/buybox/buyBoxRepo';
	import { loadMatches, type LoadedMatches } from '$lib/features/investor/buybox/matches';
	import BuyBoxCard from '$lib/features/investor/buybox/BuyBoxCard.svelte';
	import BuyBoxForm from '$lib/features/investor/buybox/BuyBoxForm.svelte';
	import { live } from '$lib/storage/live.svelte';

	interface BoxData {
		matches?: LoadedMatches;
		error?: GatewayError;
		newCount: number;
		checkCost: CostEstimate | null;
	}

	// Built during component init: the data runtime lives in Svelte context.
	const runtime = getDataRuntime();
	const repo = useBuyBoxRepo();
	const investor = useInvestorPort();
	const markets = useMarketsPort();

	let boxesLive = $state<{ readonly current: BuyBoxView[] | undefined } | null>(null);
	const boxes = $derived(boxesLive?.current);
	let data = $state<Record<string, BoxData>>({});
	/** null = form closed; 'new' = New buy box; else the id being edited (form replaces its card). */
	let formFor = $state<null | 'new' | string>(null);
	let checking = $state<Record<string, boolean>>({});
	let checkErrors = $state<Record<string, { error: GatewayError; retry?: () => void } | undefined>>(
		{}
	);
	let newButton = $state<HTMLButtonElement | null>(null);
	let emptyHeading = $state<HTMLElement | null>(null);
	/** Boxes whose matches the user opened during this visit (marked seen when it ends). */
	const opened = new SvelteSet<string>();

	const sample = $derived(runtime.mode?.source === 'sample');
	const headingId = (id: string) => `buy-box-${id}`;

	onMount(() => {
		boxesLive = live<BuyBoxView[] | undefined>(() => repo.listBuyBoxes(), undefined);
		const flushSeen = () => {
			for (const id of opened) void repo.markSeen(id).catch(() => undefined);
			opened.clear();
		};
		const onHide = () => {
			if (document.visibilityState === 'hidden') flushSeen();
		};
		document.addEventListener('visibilitychange', onHide);
		window.addEventListener('pagehide', flushSeen);
		return () => {
			document.removeEventListener('visibilitychange', onHide);
			window.removeEventListener('pagehide', flushSeen);
			flushSeen();
		};
	});

	// ------------------------------------------------------------------ free reads (0 calls)

	let seq = 0;

	/** Cache-only: matches, new flags and the Check now cost for every box. */
	async function readAll(list: readonly BuyBoxView[]): Promise<void> {
		const mine = ++seq;
		const entries = await Promise.all(
			list.map(async (box): Promise<[string, BoxData]> => {
				const out: BoxData = { newCount: 0, checkCost: null };
				try {
					const newIds = await repo.newMatchIds(box.id);
					out.newCount = newIds.size;
					out.matches = await loadMatches(box, { investor, markets, newIds });
				} catch (error) {
					if (isGatewayError(error)) out.error = error;
				}
				out.checkCost = await costOf(box);
				return [box.id, out];
			})
		);
		if (mine === seq) data = Object.fromEntries(entries);
	}

	async function costOf(box: BuyBoxView): Promise<CostEstimate | null> {
		try {
			return await investor.estimateCost({ kind: 'sale', location: box.criteria.location });
		} catch {
			return null;
		}
	}

	async function refreshCheckCost(box: BuyBoxView): Promise<void> {
		const cost = await costOf(box);
		const d = data[box.id];
		if (d) data[box.id] = { ...d, checkCost: cost };
	}

	// Re-read from the cache when the list changes (save, delete, a check, the on-open pass) or the
	// data source switches. Peeks only: this never spends.
	$effect(() => {
		const gateway = runtime.gateway;
		const list = boxes;
		if (!gateway || !list) return;
		untrack(() => void readAll(list));
	});

	const rereadAll = async () => {
		if (boxes) await readAll(boxes);
	};

	// ------------------------------------------------------------------ actions (click handlers)

	/** The card may render a moment later (the live list catches up), so wait up to ~1s for it. */
	async function focusHeading(id: string): Promise<void> {
		await tick();
		for (let i = 0; i < 60; i++) {
			const el = document.getElementById(headingId(id));
			if (el) {
				el.focus();
				return;
			}
			await new Promise((r) => requestAnimationFrame(() => r(undefined)));
		}
	}

	async function openNew(): Promise<void> {
		formFor = 'new';
	}

	/** Check now / the second half of Save and check now: the one listings spend. */
	async function check(box: Pick<BuyBoxView, 'id' | 'name'>): Promise<void> {
		if (checking[box.id]) return;
		checking[box.id] = true;
		checkErrors[box.id] = undefined;
		try {
			const { newCount } = await repo.checkNow(box.id);
			announce(
				newCount === 0
					? `Checked ${box.name}. Nothing new.`
					: `Checked ${box.name}. ${newCount} new ${newCount === 1 ? 'match' : 'matches'}.`
			);
		} catch (error) {
			if (isGatewayError(error)) {
				// "Not now" on the over-cap prompt: nothing was spent; keep the card as it is.
				if (error.kind === 'BudgetCapReached' && error.detail === 'dismissed') return;
				checkErrors[box.id] = {
					error,
					retry: error.kind === 'BudgetCapReached' ? () => void check(box) : undefined
				};
			} else {
				checkErrors[box.id] = { error: new GatewayErrorValue({ kind: 'NetworkError' }) };
			}
		} finally {
			checking[box.id] = false;
			await rereadAll();
		}
	}

	async function onSaved(box: BuyBoxView, runCheck: boolean): Promise<void> {
		formFor = null;
		announce(`Buy box saved: ${box.name}.`);
		await focusHeading(box.id);
		if (runCheck) await check(box);
	}

	async function cancelForm(): Promise<void> {
		const was = formFor;
		formFor = null;
		await tick();
		if (was && was !== 'new') await focusHeading(was);
		else newButton?.focus();
	}

	/** Where focus goes after a delete: the next card, else the previous, else the empty state. */
	let afterDelete: string | null = null;

	async function remove(box: BuyBoxView): Promise<void> {
		const list = boxes ?? [];
		const at = list.findIndex((b) => b.id === box.id);
		const rest = list.filter((b) => b.id !== box.id);
		afterDelete = (rest[at] ?? rest[at - 1])?.id ?? null;
		opened.delete(box.id);
		await repo.deleteBuyBox(box.id);
		announce(`Deleted ${box.name}.`);
	}

	async function focusAfterDelete(e: Event): Promise<void> {
		e.preventDefault();
		await tick();
		const next = afterDelete;
		afterDelete = null;
		if (next) await focusHeading(next);
		else if (emptyHeading) emptyHeading.focus();
		else newButton?.focus();
	}
</script>

<svelte:head>
	<title>Buy boxes: Tran Real Estate Tools</title>
	<meta
		name="description"
		content="Saved searches over homes for sale with your location, price range and target numbers, checked at most once a day."
	/>
</svelte:head>

<div class="mx-auto max-w-page px-6 pt-6 pb-12 md:px-8 md:pb-16">
	<PortalSubNav label="Investor" items={INVESTOR_NAV} />
	<h1 class="font-display text-display font-semibold">Buy boxes</h1>
	<p class="mt-4 max-w-prose text-base leading-[1.6] text-foreground">
		Saved searches over homes for sale. Each one is checked when you open the app, at most once a
		day, and new matches show quick metrics that cost no extra calls.
	</p>

	{#if boxes === undefined}
		<p class="mt-4 text-label text-muted-foreground">Loading your investor data…</p>
	{:else}
		<div class="mt-6 flex flex-col gap-6">
			{#if formFor === 'new'}
				<BuyBoxForm {repo} {investor} editing={null} {onSaved} onCancel={() => void cancelForm()} />
			{:else if boxes.length > 0}
				<div>
					<Button bind:ref={newButton} variant="outline" onclick={() => void openNew()}>
						<Plus class="size-4" aria-hidden="true" />New buy box
					</Button>
				</div>
			{/if}

			{#if boxes.length === 0 && formFor !== 'new'}
				<section
					class="flex flex-col items-start gap-4 rounded-lg border border-border bg-card p-6"
					aria-labelledby="buy-boxes-empty"
				>
					<h2
						id="buy-boxes-empty"
						bind:this={emptyHeading}
						tabindex="-1"
						class="font-display text-heading font-semibold text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
					>
						No buy boxes yet
					</h2>
					<p class="max-w-prose text-base leading-[1.6] text-foreground">
						A buy box is a saved search over homes for sale: a location, a price range, and the
						numbers you're looking for. Tran checks it when you open the app, at most once a day.
					</p>
					<Button bind:ref={newButton} variant="outline" onclick={() => void openNew()}>
						<Plus class="size-4" aria-hidden="true" />New buy box
					</Button>
				</section>
			{:else if boxes.length > 0}
				<ul class="flex flex-col gap-4">
					{#each boxes as box (box.id)}
						<li>
							{#if formFor === box.id}
								<BuyBoxForm
									{repo}
									{investor}
									editing={box}
									{onSaved}
									onCancel={() => void cancelForm()}
								/>
							{:else}
								<BuyBoxCard
									{box}
									headingId={headingId(box.id)}
									matches={data[box.id]?.matches}
									matchesError={data[box.id]?.error ?? null}
									newCount={data[box.id]?.newCount ?? 0}
									checkCost={data[box.id]?.checkCost ?? null}
									checking={checking[box.id] ?? false}
									checkError={checkErrors[box.id] ?? null}
									{sample}
									{investor}
									{markets}
									onCheck={() => void check(box)}
									onCheckCostRefresh={() => void refreshCheckCost(box)}
									onEdit={() => (formFor = box.id)}
									onDelete={() => remove(box)}
									onDeleteCloseAutoFocus={(e) => void focusAfterDelete(e)}
									onMatchesOpened={() => opened.add(box.id)}
									onZipLoaded={rereadAll}
								/>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{/if}
</div>
