// InvestorDataPort: the ONLY module under features/investor that imports $lib/data at runtime
// (other investor files may use type-only imports). It adapts the Phase 4 data runtime to the
// investor portal's needs: AVM rent and value estimates for the analyzer and sale listings for the
// deal finder, with RentCast dollars converted to integer cents exactly once, here.
//
// Spending rule (04-07/04-18): peek* and estimateCost are free (cache / sample fixtures only) and
// are what views call on mount; rentEstimate / valueEstimate / saleListings spend at most one call
// and must only be called from click handlers. They go through runtime.requestSpend, so the
// over-cap confirm prompt applies; the port never issues over-cap grants itself.
import { normalizeLocation, type LocationError } from '@tran/core/location';
import type {
	Comparable as DomainComparable,
	Listing,
	PriceEstimate,
	RentEstimate
} from '@tran/core/listings';
import {
	getDataRuntime,
	type CostEstimate,
	type DataRequest,
	type DataRuntime,
	type GatewayResult,
	type Provenance
} from '$lib/data';
import type { PropertyType } from '../deals/schema';

export type { CostEstimate, Provenance };

/** Comparables requested with each AVM estimate (same as the renter fair-rent tier). */
export const ESTIMATE_COMP_COUNT = 15;
/** Sale listings are fetched wide (one call, location + Active + this limit) and filtered locally. */
export const SALE_LISTINGS_LIMIT = 500;

export interface EstimateQuery {
	address: string;
	propertyType?: PropertyType | null;
	bedrooms?: number | null;
	bathrooms?: number | null;
	squareFeet?: number | null;
}

export interface Comparable {
	address: string;
	amountCents: number;
	bedrooms: number | null;
	bathrooms: number | null;
	squareFeet: number | null;
	distanceMi: number | null;
	/** Epoch ms when the comparable was last seen (fetchedAt minus its age), else null. */
	seenAt: number | null;
}

export interface Estimate {
	amountCents: number;
	rangeLowCents: number | null;
	rangeHighCents: number | null;
	comparables: Comparable[];
	provenance: Provenance;
}

export interface SaleListing {
	id: string;
	address: string;
	zip: string;
	priceCents: number;
	bedrooms: number | null;
	bathrooms: number | null;
	squareFeet: number | null;
	daysOnMarket: number | null;
	hoaMonthlyCents: number | null;
	propertyType: string | null;
	listedAt: number | null;
}

export interface SaleListingsResult {
	listings: SaleListing[];
	truncated: boolean;
	provenance: Provenance;
}

export type InvestorRequest =
	| { kind: 'rent'; q: EstimateQuery }
	| { kind: 'value'; q: EstimateQuery }
	| { kind: 'sale'; location: string };

export interface InvestorDataPort {
	mode(): 'sample' | 'live';
	estimateCost(req: InvestorRequest): Promise<CostEstimate>;
	rentEstimate(q: EstimateQuery): Promise<Estimate>;
	valueEstimate(q: EstimateQuery): Promise<Estimate>;
	peekRent(q: EstimateQuery): Promise<Estimate | undefined>;
	peekValue(q: EstimateQuery): Promise<Estimate | undefined>;
	saleListings(location: string): Promise<SaleListingsResult>;
	peekSaleListings(location: string): Promise<SaleListingsResult | undefined>;
}

/** The narrow slice of the Phase 4 DataRuntime this port uses (a fake in tests). */
export type InvestorRuntime = Pick<DataRuntime, 'gateway' | 'requestSpend' | 'mode'>;

export class DataRuntimeNotStartedError extends Error {
	constructor() {
		super('data-runtime-not-started');
		this.name = 'DataRuntimeNotStartedError';
	}
}

/** The deal-finder location could not be resolved locally (no call is made). */
export class InvalidLocationError extends Error {
	constructor(readonly reason: LocationError) {
		super(`invalid-location:${reason}`);
		this.name = 'InvalidLocationError';
	}
}

// ------------------------------------------------------------------ request builders

/** Analyzer property type -> RentCast's case-sensitive propertyType value. */
const RENTCAST_TYPE: Record<PropertyType, string> = {
	'single-family': 'Single Family',
	condo: 'Condo',
	townhouse: 'Townhouse',
	'multi-family': 'Multi-Family',
	manufactured: 'Manufactured'
};

function estimateRequest(endpoint: 'rent-estimate' | 'value-estimate', q: EstimateQuery) {
	const params: Record<string, string | number> = { address: q.address.trim() };
	if (q.propertyType) params.propertyType = RENTCAST_TYPE[q.propertyType];
	if (q.bedrooms != null) params.bedrooms = q.bedrooms;
	if (q.bathrooms != null) params.bathrooms = q.bathrooms;
	if (q.squareFeet != null) params.squareFootage = q.squareFeet;
	params.compCount = ESTIMATE_COMP_COUNT;
	return { endpoint, params } satisfies DataRequest;
}

/** The fetch-wide sale-listings request for a free-text location (Phase 4 normalizer). */
export function saleListingsRequest(location: string): DataRequest {
	const loc = normalizeLocation(location);
	if (!loc.ok) throw new InvalidLocationError(loc.error);
	const where =
		loc.kind === 'zip' ? { zipCode: loc.zipCode } : { city: loc.city, state: loc.state };
	return {
		endpoint: 'sale-listings',
		params: { ...where, status: 'Active', limit: SALE_LISTINGS_LIMIT }
	};
}

/** The exact Phase 4 request a port call makes (shared by cost estimates, peeks and spends). */
export function investorRequest(req: InvestorRequest): DataRequest {
	switch (req.kind) {
		case 'rent':
			return estimateRequest('rent-estimate', req.q);
		case 'value':
			return estimateRequest('value-estimate', req.q);
		case 'sale':
			return saleListingsRequest(req.location);
	}
}

// ------------------------------------------------------------------ mapping (dollars -> cents)

/** The single dollars -> cents conversion at the RentCast boundary. */
export const toCents = (dollars: number): number => Math.round(dollars * 100);
const centsOrNull = (dollars: number | null | undefined) =>
	dollars == null || !Number.isFinite(dollars) ? null : toCents(dollars);

const DAY_MS = 86_400_000;

function toComparable(c: DomainComparable, fetchedAt: number): Comparable {
	return {
		address: c.formattedAddress,
		amountCents: toCents(c.price),
		bedrooms: c.bedrooms,
		bathrooms: c.bathrooms,
		squareFeet: c.squareFootage,
		distanceMi: c.distance,
		seenAt: c.daysOld === null ? null : fetchedAt - c.daysOld * DAY_MS
	};
}

function toEstimate(r: GatewayResult<RentEstimate | PriceEstimate>): Estimate {
	const e = r.data;
	return {
		amountCents: toCents(e.estimate),
		rangeLowCents: centsOrNull(e.low),
		rangeHighCents: centsOrNull(e.high),
		comparables: e.comparables.map((c) => toComparable(c, r.provenance.fetchedAt)),
		provenance: r.provenance
	};
}

function toSaleListing(l: Listing): SaleListing {
	const listedAt = l.listedDate ? Date.parse(l.listedDate) : NaN;
	return {
		id: l.id,
		address: l.formattedAddress,
		zip: l.zipCode,
		priceCents: toCents(l.price),
		bedrooms: l.bedrooms,
		bathrooms: l.bathrooms,
		squareFeet: l.squareFootage,
		daysOnMarket: l.daysOnMarket,
		hoaMonthlyCents: centsOrNull(l.hoaFee),
		propertyType: l.propertyType,
		listedAt: Number.isNaN(listedAt) ? null : listedAt
	};
}

function toSaleResult(r: GatewayResult<Listing[]>): SaleListingsResult {
	return {
		listings: r.data.map(toSaleListing),
		truncated: r.truncated || r.data.length >= SALE_LISTINGS_LIMIT,
		provenance: r.provenance
	};
}

// ------------------------------------------------------------------ port

export function createInvestorPort(runtime: InvestorRuntime): InvestorDataPort {
	const gateway = () => {
		if (!runtime.gateway) throw new DataRuntimeNotStartedError();
		return runtime.gateway;
	};

	async function peek<T, R>(req: DataRequest, map: (r: GatewayResult<T>) => R) {
		const r = await gateway().peek<T>(req);
		if (!r) return undefined;
		if (r.kind === 'error') throw r.error;
		return map(r.result);
	}

	return {
		mode() {
			const source = runtime.gateway?.source ?? runtime.mode?.source;
			return source === 'rentcast' ? 'live' : 'sample';
		},

		estimateCost: async (req) => gateway().estimateCost(investorRequest(req)),

		async rentEstimate(q) {
			return toEstimate(
				await runtime.requestSpend<RentEstimate>(investorRequest({ kind: 'rent', q }))
			);
		},

		async valueEstimate(q) {
			return toEstimate(
				await runtime.requestSpend<PriceEstimate>(investorRequest({ kind: 'value', q }))
			);
		},

		peekRent: async (q) => peek(investorRequest({ kind: 'rent', q }), toEstimate),
		peekValue: async (q) => peek(investorRequest({ kind: 'value', q }), toEstimate),

		async saleListings(location) {
			return toSaleResult(
				await runtime.requestSpend<Listing[]>(investorRequest({ kind: 'sale', location }))
			);
		},

		peekSaleListings: async (location) =>
			peek(investorRequest({ kind: 'sale', location }), toSaleResult)
	};
}

/**
 * The port over the app's data runtime. The runtime lives in Svelte context (set by the app
 * layout), so call this during component initialisation (top level of a component script), then
 * use the port from onMount (peek* / estimateCost) and click handlers (the spending methods).
 */
export function useInvestorPort(): InvestorDataPort {
	return createInvestorPort(getDataRuntime());
}
