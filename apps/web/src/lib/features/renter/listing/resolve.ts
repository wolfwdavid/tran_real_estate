// Listing detail resolution (06-14, RENT-03; 06-RESEARCH Pattern 3). The prerendered
// `/renter/listing/?id=` page finds its listing at 0 calls, in this order:
//   1. the shortlist snapshot (a saved listing always opens, even offline or after the cache expires)
//   2. gateway.peekListingById: cached search / by-id rows in live mode, the fixtures in sample mode
//   3. not found: fetchable only in live mode and only for a valid-looking id
// resolveListing NEVER spends. fetchListingById is the only spending path, and it runs from the
// "Look it up again (1 call)" click handler, never from an effect.
import { GatewayError, isGatewayError, type DataRequest, type Provenance } from '$lib/data';
import type { DataGateway, GatewayResult } from '$lib/data';
import type { Listing } from '@tran/core/listings';
import { looksLikeListingId } from '@tran/core/renter/contact-links';
import { listingByIdRequest } from '../data/requests';
import type { ShortlistRepo } from '../storage/shortlist-repo';

export type ListingSource = 'shortlist' | 'cache' | 'sample' | 'network';

export type ResolvedListing =
	| { kind: 'missing-id' }
	| { kind: 'not-found'; canFetch: boolean; error?: GatewayError }
	| { kind: 'found'; source: ListingSource; row: Listing; provenance: Provenance };

export interface ResolveDeps {
	shortlist: Pick<ShortlistRepo, 'getByListingId'>;
	gateway: Pick<DataGateway, 'peekListingById' | 'rentalListingById'>;
	mode: () => 'sample' | 'live';
	/**
	 * The user-spend helper (runtime.requestSpend), so an over-cap lookup opens the cap prompt.
	 * Omitted: gateway.rentalListingById directly.
	 */
	spend?: (req: DataRequest) => Promise<GatewayResult<Listing>>;
}

const canFetch = (id: string, deps: ResolveDeps): boolean =>
	deps.mode() === 'live' && looksLikeListingId(id);

/** 0 calls by construction: reads the shortlist and the gateway's cache only. */
export async function resolveListing(
	id: string | null,
	deps: ResolveDeps
): Promise<ResolvedListing> {
	if (!id) return { kind: 'missing-id' };
	if (!looksLikeListingId(id)) return { kind: 'not-found', canFetch: false };

	const saved = await deps.shortlist.getByListingId(id);
	if (saved) {
		return {
			kind: 'found',
			source: 'shortlist',
			row: saved.listing as unknown as Listing,
			// A snapshot is shown as of the time it was fetched; it is never "stale" in the TTL sense.
			provenance: {
				source: saved.provenance.source,
				fetchedAt: saved.provenance.fetchedAt,
				stale: false
			}
		};
	}

	const cached = await deps.gateway.peekListingById(id);
	if (cached) {
		return {
			kind: 'found',
			source: cached.provenance.source === 'sample' ? 'sample' : 'cache',
			row: cached.listing,
			provenance: cached.provenance
		};
	}

	return { kind: 'not-found', canFetch: canFetch(id, deps) };
}

/** The ONLY spending path: one by-id call, from a click handler. */
export async function fetchListingById(id: string, deps: ResolveDeps): Promise<ResolvedListing> {
	if (!canFetch(id, deps)) return { kind: 'not-found', canFetch: false };
	try {
		const result = deps.spend
			? await deps.spend(listingByIdRequest(id))
			: await deps.gateway.rentalListingById(id);
		return {
			kind: 'found',
			source: 'network',
			row: result.data,
			provenance: result.provenance
		};
	} catch (error) {
		if (!isGatewayError(error)) throw error;
		// RentCast has no listing with this id: looking again would only spend another call.
		if (error.kind === 'NoResults') return { kind: 'not-found', canFetch: false, error };
		// The renter closed the over-cap prompt: nothing went wrong, the button stays.
		if (error.kind === 'BudgetCapReached' && error.detail === 'dismissed') {
			return { kind: 'not-found', canFetch: true };
		}
		return { kind: 'not-found', canFetch: true, error };
	}
}
