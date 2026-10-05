import { describe, expect, it } from 'vitest';
import rentals from '../fixtures/rentals.json';
import sales from '../fixtures/sales.json';
import markets from '../fixtures/markets.json';
import { parsePayload, type ParseResult, type ValidatedPayload } from './schemas';

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

function okPayload(result: ParseResult): { payload: ValidatedPayload; droppedRows: number } {
	if (!result.ok) throw new Error(`expected ok, got issues ${result.issues.join(', ')}`);
	return result;
}

function rowsOf(result: ParseResult): Record<string, unknown>[] {
	const { payload } = okPayload(result);
	if (!('rows' in payload)) throw new Error('expected rows payload');
	return payload.rows as Record<string, unknown>[];
}

const validComp = {
	id: 'SAMPLE-74201-R001',
	formattedAddress: '12 Sample Ln, Sample City, OK 74201',
	price: 1450,
	distance: 0.4,
	daysOld: 12,
	correlation: 0.97,
	bedrooms: 2,
	bathrooms: 1,
	squareFootage: 900,
	propertyType: 'Condo',
	status: 'Active'
};

describe('parsePayload: listings', () => {
	it('accepts every rental fixture row with 0 dropped', () => {
		const result = parsePayload('rental-listings', rentals);
		expect(rowsOf(result)).toHaveLength(60);
		expect(okPayload(result).droppedRows).toBe(0);
	});

	it('accepts every sale fixture row with 0 dropped', () => {
		const result = parsePayload('sale-listings', sales);
		expect(rowsOf(result)).toHaveLength(40);
		expect(okPayload(result).droppedRows).toBe(0);
	});

	it('drops a row missing price and counts it', () => {
		const body = clone(rentals) as Record<string, unknown>[];
		delete body[3].price;
		const result = parsePayload('rental-listings', body);
		expect(rowsOf(result)).toHaveLength(59);
		expect(result).toMatchObject({ ok: true, droppedRows: 1 });
	});

	it('drops a row with neither formattedAddress nor addressLine1', () => {
		const body = clone(rentals) as Record<string, unknown>[];
		body[0].formattedAddress = null;
		delete body[0].addressLine1;
		const result = parsePayload('rental-listings', body);
		expect(rowsOf(result)).toHaveLength(59);
		expect(okPayload(result).droppedRows).toBe(1);
	});

	it('keeps a row with only addressLine1', () => {
		const body = clone(rentals) as Record<string, unknown>[];
		delete body[0].formattedAddress;
		expect(rowsOf(parsePayload('rental-listings', body))).toHaveLength(60);
	});

	it('treats an empty array as a valid empty result', () => {
		expect(parsePayload('rental-listings', [])).toEqual({
			ok: true,
			payload: { endpoint: 'rental-listings', rows: [] },
			droppedRows: 0
		});
	});

	it('fails when the top-level shape is wrong', () => {
		expect(parsePayload('rental-listings', { a: 1 }).ok).toBe(false);
		expect(parsePayload('sale-listings', null).ok).toBe(false);
	});

	it('fails when every row is invalid', () => {
		const result = parsePayload('rental-listings', [{ bogus: true }, { id: 1 }]);
		expect(result.ok).toBe(false);
	});

	it('strips unknown fields from validated rows', () => {
		const body = clone(rentals) as Record<string, unknown>[];
		body[0].futureField = 1;
		const rows = rowsOf(parsePayload('rental-listings', body));
		expect(rows[0]).not.toHaveProperty('futureField');
		expect(rows[0]).not.toHaveProperty('stateFips');
		expect(rows[0].id).toBe(rentals[0].id);
	});

	it('accepts unknown enum-like values as free strings', () => {
		const body = clone(rentals) as Record<string, unknown>[];
		body[0].propertyType = 'Treehouse';
		body[0].status = 'Pending';
		const rows = rowsOf(parsePayload('rental-listings', body));
		expect(rows).toHaveLength(60);
		expect(rows[0].propertyType).toBe('Treehouse');
		expect(rows[0].status).toBe('Pending');
	});

	it('never echoes field values in issues', () => {
		const result = parsePayload('rental-listings', [
			{ id: 'planted-value-xyz', price: 'planted-value-xyz', status: 'planted-value-xyz' }
		]);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.issues.length).toBeGreaterThan(0);
		expect(JSON.stringify(result.issues)).not.toContain('planted-value-xyz');
	});
});

describe('parsePayload: rental-listing-by-id', () => {
	it('accepts a single listing as row', () => {
		const result = parsePayload('rental-listing-by-id', rentals[0]);
		const { payload } = okPayload(result);
		expect(payload.endpoint).toBe('rental-listing-by-id');
		if (payload.endpoint !== 'rental-listing-by-id') return;
		expect((payload.row as { id: string }).id).toBe(rentals[0].id);
	});

	it('rejects an array', () => {
		expect(parsePayload('rental-listing-by-id', [rentals[0]]).ok).toBe(false);
	});

	it('rejects an invalid row', () => {
		expect(parsePayload('rental-listing-by-id', { id: 'x' }).ok).toBe(false);
	});
});

describe('parsePayload: AVM', () => {
	it('keeps valid comparables and drops bad ones', () => {
		const result = parsePayload('rent-estimate', {
			rent: 1500,
			rentRangeLow: null,
			comparables: [validComp, { bogus: true }]
		});
		const { payload, droppedRows } = okPayload(result);
		expect(droppedRows).toBe(1);
		if (payload.endpoint !== 'rent-estimate') throw new Error('wrong endpoint');
		const data = payload.data as { comparables: unknown[] };
		expect(data.comparables).toHaveLength(1);
	});

	it('requires rent', () => {
		expect(parsePayload('rent-estimate', { rentRangeLow: 1 }).ok).toBe(false);
	});

	it('tolerates top-level latitude/longitude present or absent', () => {
		expect(parsePayload('rent-estimate', { rent: 1, latitude: 1, longitude: 2 }).ok).toBe(true);
		expect(parsePayload('rent-estimate', { rent: 1 }).ok).toBe(true);
	});

	it('accepts a minimal value estimate', () => {
		expect(parsePayload('value-estimate', { price: 250000 }).ok).toBe(true);
		expect(parsePayload('value-estimate', { rent: 250000 }).ok).toBe(false);
	});
});

describe('parsePayload: markets', () => {
	it.each(markets.map((m) => [m.zipCode, m] as const))('accepts market fixture %s', (_zip, m) => {
		const result = parsePayload('markets', m);
		expect(result).toMatchObject({ ok: true, droppedRows: 0 });
	});

	it('accepts a minimal market and rejects one without zipCode', () => {
		expect(parsePayload('markets', { zipCode: '74201' }).ok).toBe(true);
		expect(parsePayload('markets', {}).ok).toBe(false);
	});
});
