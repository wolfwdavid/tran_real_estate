// Map validated RentCast payloads into the core domain rows every portal renders (DATA-01).
// The cache stores the validated raw payload and maps on read (04-RESEARCH Pattern 9), so a
// mapper change costs 0 calls. Every field is read defensively: unknown enum values become
// 'Other', anything that is not a finite number or a string becomes null.
import {
	PROPERTY_TYPES,
	type Comparable,
	type Listing,
	type ListingContact,
	type MarketBreakdown,
	type MarketHistoryPoint,
	type MarketSide,
	type MarketStats,
	type PriceEstimate,
	type PriceEvent,
	type PropertyType,
	type RentEstimate
} from '@tran/core/listings';
import type { ValidatedPayload } from './schemas';

export type DomainData = Listing[] | Listing | RentEstimate | PriceEstimate | MarketStats;

type Rec = Record<string, unknown>;

const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const rec = (v: unknown): Rec => (isRec(v) ? v : {});

function num(v: unknown): number | null {
	return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function str(v: unknown): string | null {
	return typeof v === 'string' ? v : null;
}

const KNOWN_TYPES: ReadonlySet<string> = new Set(PROPERTY_TYPES);

function propertyType(v: unknown): PropertyType {
	const s = str(v);
	return s !== null && KNOWN_TYPES.has(s) ? (s as PropertyType) : 'Other';
}

function status(v: unknown): Listing['status'] {
	return v === 'Active' || v === 'Inactive' ? v : 'Other';
}

/** RentCast-style "line1, city, ST zip", skipping null parts. */
function buildAddress(r: Rec): string {
	const line1 = str(r.formattedAddress);
	if (line1) return line1;
	const stateZip = [str(r.state), str(r.zipCode)].filter(Boolean).join(' ');
	return [str(r.addressLine1), str(r.city), stateZip].filter(Boolean).join(', ');
}

function contact(v: unknown): ListingContact | null {
	if (!isRec(v)) return null;
	return { name: str(v.name), phone: str(v.phone), email: str(v.email), website: str(v.website) };
}

function history(v: unknown): PriceEvent[] {
	return Object.entries(rec(v))
		.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
		.map(([date, e]) => {
			const ev = rec(e);
			return {
				date,
				event: str(ev.event) ?? '',
				price: num(ev.price),
				removedDate: str(ev.removedDate)
			};
		});
}

export function mapListing(row: unknown, kind: 'rental' | 'sale'): Listing {
	const r = rec(row);
	return {
		id: str(r.id) ?? '',
		kind,
		formattedAddress: buildAddress(r),
		addressLine1: str(r.addressLine1),
		addressLine2: str(r.addressLine2),
		city: str(r.city),
		state: str(r.state),
		zipCode: str(r.zipCode) ?? '',
		latitude: num(r.latitude),
		longitude: num(r.longitude),
		propertyType: propertyType(r.propertyType),
		bedrooms: num(r.bedrooms),
		bathrooms: num(r.bathrooms),
		squareFootage: num(r.squareFootage),
		yearBuilt: num(r.yearBuilt),
		hoaFee: num(rec(r.hoa).fee),
		price: num(r.price) ?? 0,
		status: status(r.status),
		listingType: str(r.listingType),
		listedDate: str(r.listedDate),
		removedDate: str(r.removedDate),
		lastSeenDate: str(r.lastSeenDate),
		daysOnMarket: num(r.daysOnMarket),
		mlsName: str(r.mlsName),
		mlsNumber: str(r.mlsNumber),
		agent: contact(r.listingAgent),
		office: contact(r.listingOffice),
		history: history(r.history)
	};
}

function mapComparable(v: unknown): Comparable {
	const c = rec(v);
	return {
		id: str(c.id) ?? '',
		formattedAddress: buildAddress(c),
		price: num(c.price) ?? 0,
		distance: num(c.distance),
		daysOld: num(c.daysOld),
		correlation: num(c.correlation),
		bedrooms: num(c.bedrooms),
		bathrooms: num(c.bathrooms),
		squareFootage: num(c.squareFootage),
		propertyType: propertyType(c.propertyType)
	};
}

function mapEstimate<K extends 'rent' | 'price'>(
	data: unknown,
	kind: K
): { kind: K } & Omit<RentEstimate, 'kind'> {
	const d = rec(data);
	const f = kind === 'rent' ? 'rent' : 'price';
	const comps = Array.isArray(d.comparables) ? d.comparables : [];
	return {
		kind,
		estimate: num(d[f]) ?? 0,
		low: num(d[`${f}RangeLow`]),
		high: num(d[`${f}RangeHigh`]),
		subjectAddress: str(rec(d.subjectProperty).formattedAddress),
		comparables: comps.map(mapComparable)
	};
}

type SidePrefix = 'Rent' | 'Price';

function breakdowns(v: unknown, p: SidePrefix): MarketBreakdown[] {
	if (!Array.isArray(v)) return [];
	return v.map((item) => {
		const b = rec(item);
		return {
			bedrooms: num(b.bedrooms),
			propertyType: str(b.propertyType),
			average: num(b[`average${p}`]),
			median: num(b[`median${p}`]),
			min: num(b[`min${p}`]),
			max: num(b[`max${p}`]),
			totalListings: num(b.totalListings)
		};
	});
}

function marketHistory(v: unknown, p: SidePrefix): MarketHistoryPoint[] {
	return Object.entries(rec(v))
		.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
		.map(([month, e]) => {
			const h = rec(e);
			return {
				month,
				average: num(h[`average${p}`]),
				median: num(h[`median${p}`]),
				totalListings: num(h.totalListings),
				byBedrooms: breakdowns(h.dataByBedrooms, p)
			};
		});
}

function marketSide(v: unknown, p: SidePrefix): MarketSide | null {
	if (!isRec(v)) return null;
	return {
		average: num(v[`average${p}`]),
		median: num(v[`median${p}`]),
		min: num(v[`min${p}`]),
		max: num(v[`max${p}`]),
		averagePerSquareFoot: num(v[`average${p}PerSquareFoot`]),
		averageDaysOnMarket: num(v.averageDaysOnMarket),
		medianDaysOnMarket: num(v.medianDaysOnMarket),
		newListings: num(v.newListings),
		totalListings: num(v.totalListings),
		byBedrooms: breakdowns(v.dataByBedrooms, p),
		byPropertyType: breakdowns(v.dataByPropertyType, p),
		history: marketHistory(v.history, p),
		lastUpdatedDate: str(v.lastUpdatedDate)
	};
}

function mapMarket(data: unknown): MarketStats {
	const m = rec(data);
	return {
		zipCode: str(m.zipCode) ?? '',
		sale: marketSide(m.saleData, 'Price'),
		rental: marketSide(m.rentalData, 'Rent')
	};
}

/** Map a payload produced by `parsePayload` to its domain type. Pure, never throws. */
export function mapPayload(payload: ValidatedPayload): DomainData {
	switch (payload.endpoint) {
		case 'rental-listings':
			return payload.rows.map((r) => mapListing(r, 'rental'));
		case 'sale-listings':
			return payload.rows.map((r) => mapListing(r, 'sale'));
		case 'rental-listing-by-id':
			return mapListing(payload.row, 'rental');
		case 'rent-estimate':
			return mapEstimate(payload.data, 'rent') satisfies RentEstimate;
		case 'value-estimate':
			return mapEstimate(payload.data, 'price') satisfies PriceEstimate;
		case 'markets':
			return mapMarket(payload.data);
	}
}
