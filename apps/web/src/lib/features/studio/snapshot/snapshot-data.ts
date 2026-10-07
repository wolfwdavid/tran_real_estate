// Market Snapshot data path (STU-04, 09-RESEARCH Pattern 7). A thin adapter over the Phase 4
// DataGateway and the Phase 7 shared markets port: it never calls fetch and never builds request
// parameters by hand.
//
// Call budget (ROADMAP SC5): ZIP statistics use marketStatsRequest(zip), the SAME canonical request
// the investor dashboards use, so a ZIP the investor watched is a cache hit (0 calls). A new ZIP is
// 1 call. The optional active-listings summary is the same request a ZIP search makes
// (buildListingsRequest), 1 call, and is reduced to aggregateListings() before it leaves this
// module, so a raw listing never reaches a snapshot. A second snapshot for the same ZIP is 0.
//
// Spending rule (Phase 4): the *Cost functions are free (cache / fixtures only) and are what views
// call on mount; the load functions may spend and must only run from click handlers. They spend
// through runtime.requestSpend, so the ledger cap and the over-cap confirm prompt apply.
// Nothing runs at module load: every request happens only when a function is called.
import {
	buildListingsRequest,
	type Listing,
	type ListingsEndpoint,
	type MarketStats
} from '@tran/core/listings';
import { aggregateListings, type AggregatedSample } from '@tran/core/studio';
import { getDataRuntime, SAMPLE_METROS, type CostEstimate, type DataRequest } from '$lib/data';
import {
	createMarketsPort,
	DataRuntimeNotStartedError,
	marketStatsRequest,
	type PortRuntime
} from '$lib/features/shared/markets/markets-port';

/** Drives the CostLabel text: what the next load would spend. */
export interface CostPreview {
	calls: 0 | 1;
	cached: boolean;
	sample: boolean;
}

export type ListingsKind = 'sale' | 'rental';

export interface ZipData {
	/** The Phase 4 DOMAIN stats (buildSnapshotMetrics input; keeps days on market and new listings). */
	stats: MarketStats;
	/** ISO timestamp of the original fetch (a cache hit keeps the original time). */
	fetchedAt: string;
	source: 'rentcast' | 'sample';
	placeName: string | null;
}

export interface ListingsSummary {
	sample: AggregatedSample;
	fetchedAt: string;
}

export interface SnapshotData {
	snapshotZipCost(zip: string): Promise<CostPreview>;
	loadZipData(zip: string): Promise<ZipData>;
	listingsSummaryCost(zip: string, kind: ListingsKind): Promise<CostPreview>;
	loadListingsSummary(zip: string, kind: ListingsKind): Promise<ListingsSummary>;
}

/** The active-listings request a ZIP search makes (Phase 4 builder, limit 500, status Active). */
export function listingsSummaryRequest(zip: string, kind: ListingsKind): DataRequest {
	const endpoint: ListingsEndpoint = kind === 'sale' ? 'sale-listings' : 'rental-listings';
	return buildListingsRequest({ kind: 'zip', zipCode: zip, label: zip }, endpoint);
}

function toPreview(e: CostEstimate): CostPreview {
	return {
		calls: e.calls > 0 ? 1 : 0,
		cached: e.reason === 'cached',
		sample: e.reason === 'sample'
	};
}

const iso = (ms: number): string => new Date(ms).toISOString();

/** Fictional sample metros only: a live RentCast market response carries no place name. */
function samplePlaceName(zip: string, source: 'rentcast' | 'sample'): string | null {
	if (source !== 'sample') return null;
	return SAMPLE_METROS.find((m) => m.zipCodes.includes(zip))?.label ?? null;
}

export function createSnapshotData(runtime: PortRuntime): SnapshotData {
	const markets = createMarketsPort(runtime);
	const gateway = () => {
		if (!runtime.gateway) throw new DataRuntimeNotStartedError();
		return runtime.gateway;
	};

	return {
		snapshotZipCost: async (zip) => toPreview(await markets.estimateCost(zip)),

		async loadZipData(zip) {
			const r = await runtime.requestSpend<MarketStats>(marketStatsRequest(zip));
			const source = r.provenance.source;
			return {
				stats: r.data,
				fetchedAt: iso(r.provenance.fetchedAt),
				source,
				placeName: samplePlaceName(zip, source)
			};
		},

		listingsSummaryCost: async (zip, kind) =>
			toPreview(await gateway().estimateCost(listingsSummaryRequest(zip, kind))),

		async loadListingsSummary(zip, kind) {
			const r = await runtime.requestSpend<Listing[]>(listingsSummaryRequest(zip, kind));
			const fetchedAt = iso(r.provenance.fetchedAt);
			// Reduced here: only the aggregate (no address, agent, photo or id) leaves the module.
			return { sample: aggregateListings(r.data, kind, fetchedAt), fetchedAt };
		}
	};
}

/**
 * The snapshot data path over the app's data runtime (Svelte context, set by the app layout).
 * Call during component initialisation; use the *Cost functions from onMount and the load
 * functions from click handlers.
 */
export function useSnapshotData(): SnapshotData {
	return createSnapshotData(getDataRuntime());
}
