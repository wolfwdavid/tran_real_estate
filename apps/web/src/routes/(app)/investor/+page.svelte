<script lang="ts">
	// /investor/ (07-UI-SPEC "Investor overview"). Prerendered shell; the counts load in the
	// browser. Opening the overview never spends: overviewCounts reads Dexie lists and the buy-box
	// repo's cache-only new-match count (a peek), loaded by dynamic import in onMount. The counts
	// are re-read when the buy-box list changes (the Phase 4 check-on-open pass in DataShell
	// updates it) or the data source switches. No gateway get/refresh anywhere on this page.
	import { onMount, untrack } from 'svelte';
	import { getDataRuntime } from '$lib/data';
	import PortalSubNav from '$lib/features/shared/nav/PortalSubNav.svelte';
	import { INVESTOR_NAV } from '$lib/features/investor/nav';
	import { useBuyBoxRepo, type BuyBoxView } from '$lib/features/investor/buybox/buyBoxRepo';
	import InvestorOverview from '$lib/features/investor/overview/InvestorOverview.svelte';
	import type { OverviewCounts } from '$lib/features/investor/overview/overview-counts';
	import { live } from '$lib/storage/live.svelte';

	// Built during component init: the buy-box repo's port reads the data runtime from context.
	const runtime = getDataRuntime();
	const buyBoxes = useBuyBoxRepo();

	let read = $state.raw<(() => Promise<OverviewCounts>) | null>(null);
	let boxesLive = $state<{ readonly current: BuyBoxView[] | undefined } | null>(null);
	let counts = $state<OverviewCounts | null>(null);

	onMount(() => {
		let alive = true;
		boxesLive = live<BuyBoxView[] | undefined>(() => buyBoxes.listBuyBoxes(), undefined);
		void Promise.all([
			import('$lib/features/investor/overview/overview-counts'),
			import('$lib/features/investor/deals/dealsRepo'),
			import('$lib/features/shared/markets/watchedZipsRepo')
		]).then(([{ overviewCounts }, { listDeals }, { listWatchedZips }]) => {
			if (!alive) return;
			read = () => overviewCounts({ listDeals, listWatchedZips, buyBoxes });
		});
		return () => {
			alive = false;
		};
	});

	let seq = 0;
	$effect(() => {
		const gateway = runtime.gateway;
		const list = boxesLive?.current;
		const load = read;
		if (!gateway || !list || !load) return;
		untrack(() => {
			const mine = ++seq;
			void load()
				.then((c) => {
					if (mine === seq) counts = c;
				})
				.catch(() => undefined);
		});
	});
</script>

<svelte:head>
	<title>Investor portal: Tran Real Estate Tools</title>
	<meta
		name="description"
		content="The investor portal of Tran Real Estate Tools: analyze a property, save the deals you want to revisit, and watch the ZIP codes you care about."
	/>
</svelte:head>

<div class="mx-auto max-w-page px-6 pt-6 pb-12 md:px-8 md:pb-16">
	<PortalSubNav label="Investor" items={INVESTOR_NAV} />
	<InvestorOverview {counts} />
</div>
