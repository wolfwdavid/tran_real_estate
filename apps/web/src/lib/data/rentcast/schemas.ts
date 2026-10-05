// Tolerant RentCast response validation (DATA-05, 04-RESEARCH Pattern 9).
// - Unknown fields are stripped, only the fields every screen needs are required, and enum-like
//   fields (propertyType, status, listingType) are free strings; the mappers normalize them.
// - A bad row inside a list is dropped and counted. SchemaMismatch is reserved for a wrong
//   top-level shape or a list where every row failed.
// - Issues carry Zod paths and codes only, never field values (no listing data in logs).
// Sample mode runs these same schemas over the committed fixtures (DATA-01).
import * as z from 'zod/mini';
import type { EndpointId } from '@tran/core/request';

const str = z.nullish(z.string());
const num = z.nullish(z.number());

const contactSchema = z.object({
	name: str,
	phone: str,
	email: str,
	website: str
});

const historyEventSchema = z.object({
	event: str,
	price: num,
	listingType: str,
	listedDate: str,
	removedDate: str,
	daysOnMarket: num
});

const hasAddress = (r: { formattedAddress?: string | null; addressLine1?: string | null }) =>
	!!(r.formattedAddress || r.addressLine1);

export const listingSchema = z
	.object({
		id: z.string(),
		price: z.number(),
		status: z.string(),
		zipCode: z.string(),
		formattedAddress: str,
		addressLine1: str,
		addressLine2: str,
		city: str,
		state: str,
		county: str,
		propertyType: str,
		listingType: str,
		listedDate: str,
		removedDate: str,
		createdDate: str,
		lastSeenDate: str,
		mlsName: str,
		mlsNumber: str,
		latitude: num,
		longitude: num,
		bedrooms: num,
		bathrooms: num,
		squareFootage: num,
		lotSize: num,
		yearBuilt: num,
		daysOnMarket: num,
		hoa: z.nullish(z.object({ fee: num })),
		listingAgent: z.nullish(contactSchema),
		listingOffice: z.nullish(contactSchema),
		builder: z.nullish(
			z.object({
				name: str,
				development: str,
				phone: str,
				website: str
			})
		),
		history: z.nullish(z.record(z.string(), historyEventSchema))
	})
	.check(z.refine(hasAddress));

export const comparableSchema = z
	.object({
		id: z.string(),
		formattedAddress: str,
		addressLine1: str,
		city: str,
		state: str,
		zipCode: str,
		price: z.number(),
		distance: num,
		daysOld: num,
		correlation: num,
		bedrooms: num,
		bathrooms: num,
		squareFootage: num,
		propertyType: str,
		status: str
	})
	.check(z.refine(hasAddress));

const subjectSchema = z.nullish(z.object({ formattedAddress: str }));

export const rentEstimateSchema = z.object({
	rent: z.number(),
	rentRangeLow: num,
	rentRangeHigh: num,
	// Top-level AVM lat/long is deprecated upstream: tolerated, never required.
	latitude: num,
	longitude: num,
	subjectProperty: subjectSchema,
	comparables: z.nullish(z.array(z.unknown()))
});

export const valueEstimateSchema = z.object({
	price: z.number(),
	priceRangeLow: num,
	priceRangeHigh: num,
	latitude: num,
	longitude: num,
	subjectProperty: subjectSchema,
	comparables: z.nullish(z.array(z.unknown()))
});

// Market sub-objects are read defensively by the mapper, so only the envelope is checked here.
export const marketSchema = z.object({
	zipCode: z.string(),
	id: str,
	saleData: z.nullish(z.record(z.string(), z.unknown())),
	rentalData: z.nullish(z.record(z.string(), z.unknown()))
});

export type RentCastListing = z.infer<typeof listingSchema>;
export type RentCastComparable = z.infer<typeof comparableSchema>;
export type RentCastRentEstimate = z.infer<typeof rentEstimateSchema>;
export type RentCastValueEstimate = z.infer<typeof valueEstimateSchema>;
export type RentCastMarket = z.infer<typeof marketSchema>;

export type ValidatedPayload =
	| { endpoint: 'rental-listings' | 'sale-listings'; rows: unknown[] }
	| { endpoint: 'rental-listing-by-id'; row: unknown }
	| { endpoint: 'rent-estimate' | 'value-estimate' | 'markets'; data: unknown };

export type ParseResult =
	{ ok: true; payload: ValidatedPayload; droppedRows: number } | { ok: false; issues: string[] };

/** Cap on reported issues so a 500-row failure does not produce a huge message. */
const MAX_ISSUES = 20;

type ZodIssueLike = { path: readonly PropertyKey[]; code: string };

function describeIssues(issues: readonly ZodIssueLike[], prefix: PropertyKey[] = []): string[] {
	return issues.map((issue) => {
		const path = [...prefix, ...issue.path].map((p) => String(p)).join('.');
		return `${path || '$'}:${issue.code}`;
	});
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
	typeof v === 'object' && v !== null && !Array.isArray(v);

/** Validate each row; keep the good ones, count the rest, collect issues for the failures. */
function filterRows<T>(
	schema: z.ZodMiniType<T>,
	rows: readonly unknown[],
	prefix: PropertyKey[]
): { kept: T[]; dropped: number; issues: string[] } {
	const kept: T[] = [];
	const issues: string[] = [];
	let dropped = 0;
	rows.forEach((row, i) => {
		const r = schema.safeParse(row);
		if (r.success) {
			kept.push(r.data);
		} else {
			dropped += 1;
			if (issues.length < MAX_ISSUES)
				issues.push(...describeIssues(r.error.issues, [...prefix, i]));
		}
	});
	return { kept, dropped, issues: issues.slice(0, MAX_ISSUES) };
}

function fail(issues: string[]): ParseResult {
	return { ok: false, issues: issues.length > 0 ? issues : ['$:invalid_type'] };
}

function parseListings(endpoint: 'rental-listings' | 'sale-listings', body: unknown): ParseResult {
	if (!Array.isArray(body)) return fail(['$:invalid_type']);
	// 200 with [] is a valid empty result, not a mismatch (Pitfall 8).
	if (body.length === 0) return { ok: true, payload: { endpoint, rows: [] }, droppedRows: 0 };
	const { kept, dropped, issues } = filterRows(listingSchema, body, []);
	if (kept.length === 0) return fail(issues);
	return { ok: true, payload: { endpoint, rows: kept }, droppedRows: dropped };
}

function parseEstimate(endpoint: 'rent-estimate' | 'value-estimate', body: unknown): ParseResult {
	const schema = endpoint === 'rent-estimate' ? rentEstimateSchema : valueEstimateSchema;
	if (!isPlainObject(body)) return fail(['$:invalid_type']);
	const top = schema.safeParse(body);
	if (!top.success) return fail(describeIssues(top.error.issues));
	const comps = top.data.comparables ?? [];
	const { kept, dropped } = filterRows(comparableSchema, comps, ['comparables']);
	return {
		ok: true,
		payload: { endpoint, data: { ...top.data, comparables: kept } },
		droppedRows: dropped
	};
}

/**
 * Validate a RentCast response body for one endpoint. Never throws.
 * `issues` holds `path:code` strings only, so it is safe to log and to show in a SchemaMismatch.
 */
export function parsePayload(endpoint: EndpointId, body: unknown): ParseResult {
	switch (endpoint) {
		case 'rental-listings':
		case 'sale-listings':
			return parseListings(endpoint, body);
		case 'rental-listing-by-id': {
			if (!isPlainObject(body)) return fail(['$:invalid_type']);
			const r = listingSchema.safeParse(body);
			if (!r.success) return fail(describeIssues(r.error.issues));
			return { ok: true, payload: { endpoint, row: r.data }, droppedRows: 0 };
		}
		case 'rent-estimate':
		case 'value-estimate':
			return parseEstimate(endpoint, body);
		case 'markets': {
			if (!isPlainObject(body)) return fail(['$:invalid_type']);
			const r = marketSchema.safeParse(body);
			if (!r.success) return fail(describeIssues(r.error.issues));
			return { ok: true, payload: { endpoint, data: r.data }, droppedRows: 0 };
		}
	}
}
