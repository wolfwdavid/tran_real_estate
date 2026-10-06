import { describe, expect, it } from 'vitest';
import type { Listing, MarketStats, PriceEstimate, RentEstimate } from '@tran/core/listings';
import rentals from '../fixtures/rentals.json';
import sales from '../fixtures/sales.json';
import markets from '../fixtures/markets.json';
import { mapListing, mapPayload } from './mappers';
import { parsePayload, type ValidatedPayload } from './schemas';

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

function validated(endpoint: Parameters<typeof parsePayload>[0], body: unknown): ValidatedPayload {
	const r = parsePayload(endpoint, body);
	if (!r.ok) throw new Error(r.issues.join(', '));
	return r.payload;
}

const comp = (id: string, extra: Record<string, unknown> = {}) => ({
	id,
	formattedAddress: `${id} Sample Ln, Sample City, OK 74201`,
	price: 1400,
	distance: 0.5,
	daysOld: 3,
	correlation: 0.95,
	bedrooms: 2,
	bathrooms: 1,
	squareFootage: 880,
	propertyType: 'Condo',
	...extra
});

describe('mapPayload: listings', () => {
	it('maps all rental fixture rows to rental Listings', () => {
		const out = mapPayload(validated('rental-listings', rentals)) as Listing[];
		expect(out).toHaveLength(60);
		expect(out.every((l) => l.kind === 'rental')).toBe(true);
		const first = out[0];
		expect(first.id).toBe(rentals[0].id);
		expect(first.formattedAddress).toBe(rentals[0].formattedAddress);
		expect(first.zipCode).toBe(rentals[0].zipCode);
		expect(first.price).toBe(rentals[0].price);
		expect(first.agent?.email?.endsWith('@example.com')).toBe(true);
		expect(first.office?.name).toBe(rentals[0].listingOffice.name);
	});

	it('maps sale fixture rows to sale Listings, keeping land nulls', () => {
		const out = mapPayload(validated('sale-listings', sales)) as Listing[];
		expect(out).toHaveLength(40);
		expect(out.every((l) => l.kind === 'sale')).toBe(true);
		const land = out.find((l) => l.propertyType === 'Land');
		expect(land).toBeDefined();
		expect(land?.bedrooms).toBeNull();
		expect(land?.squareFootage).toBeNull();
	});

	it('maps a by-id row to a single rental Listing', () => {
		const out = mapPayload(validated('rental-listing-by-id', rentals[1])) as Listing;
		expect(out.kind).toBe('rental');
		expect(out.id).toBe(rentals[1].id);
	});
});

describe('mapListing', () => {
	const base = () => clone(rentals[0]) as Record<string, unknown>;

	it('normalizes unknown propertyType and status to Other', () => {
		const row = { ...base(), propertyType: 'Treehouse', status: 'Pending' };
		const l = mapListing(row, 'rental');
		expect(l.propertyType).toBe('Other');
		expect(l.status).toBe('Other');
	});

	it('keeps known propertyType and status values', () => {
		const l = mapListing({ ...base(), propertyType: 'Condo', status: 'Inactive' }, 'sale');
		expect(l.propertyType).toBe('Condo');
		expect(l.status).toBe('Inactive');
		expect(l.kind).toBe('sale');
	});

	it('turns the history object into date-ascending PriceEvents', () => {
		const l = mapListing(
			{
				...base(),
				history: {
					'2026-09-20': { event: 'Rental Listing', price: 1500 },
					'2026-09-01': { event: 'Rental Listing', price: 1550 }
				}
			},
			'rental'
		);
		expect(l.history).toEqual([
			{ date: '2026-09-01', event: 'Rental Listing', price: 1550, removedDate: null },
			{ date: '2026-09-20', event: 'Rental Listing', price: 1500, removedDate: null }
		]);
	});

	it("keeps each history entry's removedDate so a delisting can be shown", () => {
		const l = mapListing(
			{
				...base(),
				history: {
					'2026-08-01': { event: 'Rental Listing', price: 1550, removedDate: '2026-08-20' },
					'2026-09-10': { event: 'Rental Listing', price: 1500, removedDate: null }
				}
			},
			'rental'
		);
		expect(l.history.map((e) => e.removedDate)).toEqual(['2026-08-20', null]);
	});

	it('builds formattedAddress from parts when missing', () => {
		const row = {
			...base(),
			formattedAddress: null,
			addressLine1: '12 Oak St',
			city: 'Sample City',
			state: 'OK',
			zipCode: '74201'
		};
		expect(mapListing(row, 'rental').formattedAddress).toBe('12 Oak St, Sample City, OK 74201');
		expect(mapListing({ ...row, city: null }, 'rental').formattedAddress).toBe(
			'12 Oak St, OK 74201'
		);
	});

	it('maps missing optional fields to null and missing history to []', () => {
		const l = mapListing(
			{ id: 'x', price: 1, status: 'Active', zipCode: '74201', addressLine1: '1 A St' },
			'rental'
		);
		expect(l.bedrooms).toBeNull();
		expect(l.agent).toBeNull();
		expect(l.history).toEqual([]);
		expect(l.propertyType).toBe('Other');
		expect(l.addressLine2).toBeNull();
		expect(l.hoaFee).toBeNull();
	});

	it('keeps the unit line and the monthly HOA fee for the listing detail (06-14)', () => {
		const l = mapListing({ ...base(), addressLine2: 'Apt 4B', hoa: { fee: 155 } }, 'rental');
		expect(l.addressLine2).toBe('Apt 4B');
		expect(l.hoaFee).toBe(155);
		expect(mapListing({ ...base(), hoa: null }, 'rental').hoaFee).toBeNull();
	});
});

describe('mapPayload: AVM', () => {
	it('maps a rent estimate', () => {
		const out = mapPayload(
			validated('rent-estimate', {
				rent: 1500,
				rentRangeLow: 1300,
				rentRangeHigh: null,
				subjectProperty: { formattedAddress: '1 Subject St, Sample City, OK 74201' },
				comparables: [comp('C1'), comp('C2', { propertyType: 'Igloo', distance: null })]
			})
		) as RentEstimate;
		expect(out.kind).toBe('rent');
		expect(out.estimate).toBe(1500);
		expect(out.low).toBe(1300);
		expect(out.high).toBeNull();
		expect(out.subjectAddress).toBe('1 Subject St, Sample City, OK 74201');
		expect(out.comparables).toHaveLength(2);
		expect(out.comparables[0]).toEqual({
			id: 'C1',
			formattedAddress: 'C1 Sample Ln, Sample City, OK 74201',
			price: 1400,
			distance: 0.5,
			daysOld: 3,
			correlation: 0.95,
			bedrooms: 2,
			bathrooms: 1,
			squareFootage: 880,
			propertyType: 'Condo'
		});
		expect(out.comparables[1].propertyType).toBe('Other');
		expect(out.comparables[1].distance).toBeNull();
	});

	it('maps a value estimate with no comparables', () => {
		const out = mapPayload(
			validated('value-estimate', { price: 250000, priceRangeLow: 230000, priceRangeHigh: 270000 })
		) as PriceEstimate;
		expect(out).toEqual({
			kind: 'price',
			estimate: 250000,
			low: 230000,
			high: 270000,
			subjectAddress: null,
			comparables: []
		});
	});
});

describe('mapPayload: markets', () => {
	const fixture = markets[0];

	it('maps a market fixture entry to MarketStats', () => {
		const out = mapPayload(validated('markets', fixture)) as MarketStats;
		expect(out.zipCode).toBe(fixture.zipCode);
		const rental = out.rental;
		expect(rental).not.toBeNull();
		expect(rental?.median).toBe(fixture.rentalData.medianRent);
		expect(rental?.average).toBe(fixture.rentalData.averageRent);
		expect(rental?.averagePerSquareFoot).toBe(fixture.rentalData.averageRentPerSquareFoot);
		expect(rental?.lastUpdatedDate).toBe(fixture.rentalData.lastUpdatedDate);
		expect(rental?.byBedrooms).toHaveLength(fixture.rentalData.dataByBedrooms.length);
		expect(rental?.byBedrooms[0]).toEqual({
			bedrooms: fixture.rentalData.dataByBedrooms[0].bedrooms,
			propertyType: null,
			average: fixture.rentalData.dataByBedrooms[0].averageRent,
			median: fixture.rentalData.dataByBedrooms[0].medianRent,
			min: fixture.rentalData.dataByBedrooms[0].minRent,
			max: fixture.rentalData.dataByBedrooms[0].maxRent,
			totalListings: fixture.rentalData.dataByBedrooms[0].totalListings
		});
		expect(rental?.byPropertyType).toHaveLength(fixture.rentalData.dataByPropertyType.length);
		expect(rental?.history).toHaveLength(24);
		const months = rental?.history.map((h) => h.month) ?? [];
		expect(months).toEqual([...months].sort());
		expect(months[0]).toBe('2024-10');

		const sale = out.sale;
		expect(sale?.median).toBe(fixture.saleData.medianPrice);
		expect(sale?.max).toBe(fixture.saleData.maxPrice);
		expect(sale?.byBedrooms).toHaveLength(fixture.saleData.dataByBedrooms.length);
		expect(sale?.byPropertyType[0].propertyType).toBe(
			fixture.saleData.dataByPropertyType[0].propertyType
		);
		expect(sale?.history).toHaveLength(24);
	});

	it('sorts shuffled history by month ascending', () => {
		const m = clone(fixture) as Record<string, unknown> & {
			rentalData: { history: Record<string, unknown> };
		};
		const entries = Object.entries(m.rentalData.history).reverse();
		m.rentalData.history = Object.fromEntries(entries);
		const out = mapPayload(validated('markets', m)) as MarketStats;
		const months = out.rental?.history.map((h) => h.month) ?? [];
		expect(months).toEqual([...months].sort());
	});

	it('maps missing saleData to sale: null and tolerates junk sub-fields', () => {
		const out = mapPayload(
			validated('markets', {
				zipCode: '74201',
				rentalData: { medianRent: 'n/a', dataByBedrooms: 'oops', history: null }
			})
		) as MarketStats;
		expect(out.sale).toBeNull();
		expect(out.rental?.median).toBeNull();
		expect(out.rental?.lastUpdatedDate).toBeNull();
		expect(out.rental?.byBedrooms).toEqual([]);
		expect(out.rental?.history).toEqual([]);
	});
});
