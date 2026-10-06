// Investor overview counts (07-20). The three live lines on /investor/: saved deals, new buy-box
// matches since the last visit, and watched ZIPs out of 5.
//
// Reads only. Deals and watched ZIPs are Dexie lists; new matches come from the buy-box repo's
// newMatchCount, which compares the Phase 4 snapshot with the CACHED for-sale rows (a peek, never a
// get or refresh). Nothing here can spend a RentCast call. The sources are injected because the
// buy-box repo reads the data runtime from Svelte context (useBuyBoxRepo at component setup);
// a BuyBoxRepo satisfies `buyBoxes`.
import { MAX_WATCHED_ZIPS } from '@tran/core/markets';

export interface OverviewCounts {
	deals: number;
	buyBoxes: number;
	newMatches: number;
	watchedZips: number;
}

export interface OverviewSources {
	listDeals(): Promise<readonly unknown[]>;
	listWatchedZips(): Promise<readonly unknown[]>;
	buyBoxes: {
		listBuyBoxes(): Promise<readonly { id: string }[]>;
		newMatchCount(id: string): Promise<number>;
	};
}

/** Shown in place of each count line until the counts have loaded. */
export const OVERVIEW_LOADING = 'Loading your investor data…';

export async function overviewCounts(src: OverviewSources): Promise<OverviewCounts> {
	const [deals, zips, boxes] = await Promise.all([
		src.listDeals(),
		src.listWatchedZips(),
		src.buyBoxes.listBuyBoxes()
	]);
	// A box whose cache read fails counts 0: the overview still shows the rest, and the buy-boxes
	// page shows that box's error where it can be acted on.
	const perBox = await Promise.all(
		boxes.map((b) => src.buyBoxes.newMatchCount(b.id).catch(() => 0))
	);
	return {
		deals: deals.length,
		buyBoxes: boxes.length,
		newMatches: perBox.reduce((a, n) => a + n, 0),
		watchedZips: zips.length
	};
}

/** The count line for each card (07-UI-SPEC overview copy). */
export function overviewLines(c: OverviewCounts): {
	deals: string;
	buyBoxes: string;
	markets: string;
} {
	let buyBoxes: string;
	if (c.buyBoxes === 0) buyBoxes = 'No buy boxes yet';
	else if (c.newMatches === 0) buyBoxes = 'No new matches';
	else
		buyBoxes = `${c.newMatches} new ${c.newMatches === 1 ? 'match' : 'matches'} since your last visit`;
	return {
		deals: c.deals === 0 ? 'None saved yet' : `${c.deals} saved`,
		buyBoxes,
		markets: `${c.watchedZips} of ${MAX_WATCHED_ZIPS} ZIP codes watched`
	};
}
