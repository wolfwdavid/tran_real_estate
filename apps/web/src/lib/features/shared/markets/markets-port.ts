// The ONE place shared markets code (Phase 7 watched ZIPs, Phase 6 renter fair-rent, Phase 9
// agent reports) reaches RentCast market statistics. Every market-stats request is built by
// marketStatsRequest with the canonical parameters { zipCode, dataType: 'All', historyRange: 24 },
// so every portal hits the same 30-day cache entry:
//   markets?dataType=All&historyRange=24&zipCode=<zip>
//
// Spending rule (Phase 4, 04-07/04-18): peek and estimateCost are free (cache / fixtures only) and
// are what views call on mount; load spends at most one call and must only run from a click
// handler. It goes through runtime.requestSpend, so the over-cap confirm prompt (CapPrompt)
// applies; the port never issues over-cap grants itself.
import type { MarketStatsInput } from '@tran/core/markets';
import type { MarketStats } from '@tran/core/listings';
import {
	getDataRuntime,
	type CostEstimate,
	type DataRequest,
	type DataRuntime,
	type Provenance
} from '$lib/data';
import { toMarketStatsInput } from './market-input';

export type { CostEstimate, Provenance };
export { toMarketStatsInput };

/** Months of history every market-stats request asks for (canonical; shared with Phase 9). */
export const MARKET_HISTORY_MONTHS = 24;

/** The canonical RentCast market-statistics request for one ZIP. */
export function marketStatsRequest(zip: string): DataRequest {
	return {
		endpoint: 'markets',
		params: { zipCode: zip, dataType: 'All', historyRange: MARKET_HISTORY_MONTHS }
	};
}

export interface MarketResult {
	stats: MarketStatsInput;
	provenance: Provenance;
}

/** The narrow slice of the Phase 4 DataRuntime the ports use (a fake in tests). */
export type PortRuntime = Pick<DataRuntime, 'gateway' | 'requestSpend'>;

export interface MarketsPort {
	/** Free. What loading this ZIP would cost: 0 when cached or in sample mode. */
	estimateCost(zip: string): Promise<CostEstimate>;
	/** Free (cache / fixtures only). undefined when nothing is cached; a cached error is thrown. */
	peek(zip: string): Promise<MarketResult | undefined>;
	/** Click handlers only: fresh cache or one call (refresh: always one call). */
	load(zip: string, opts?: { refresh?: boolean }): Promise<MarketResult>;
}

export class DataRuntimeNotStartedError extends Error {
	constructor() {
		super('data-runtime-not-started');
		this.name = 'DataRuntimeNotStartedError';
	}
}

export function createMarketsPort(runtime: PortRuntime): MarketsPort {
	const gateway = () => {
		if (!runtime.gateway) throw new DataRuntimeNotStartedError();
		return runtime.gateway;
	};
	return {
		estimateCost: async (zip) => gateway().estimateCost(marketStatsRequest(zip)),

		async peek(zip) {
			const r = await gateway().peek<MarketStats>(marketStatsRequest(zip));
			if (!r) return undefined;
			if (r.kind === 'error') throw r.error;
			return { stats: toMarketStatsInput(r.result.data), provenance: r.result.provenance };
		},

		async load(zip, opts = {}) {
			const r = await runtime.requestSpend<MarketStats>(
				marketStatsRequest(zip),
				opts.refresh ? 'refresh' : 'get'
			);
			return { stats: toMarketStatsInput(r.data), provenance: r.provenance };
		}
	};
}

/**
 * The port over the app's data runtime. The runtime lives in Svelte context (set by the app
 * layout), so call this during component initialisation (top level of a component script), then
 * use the port from onMount (peek / estimateCost) and click handlers (load).
 */
export function useMarketsPort(): MarketsPort {
	return createMarketsPort(getDataRuntime());
}
