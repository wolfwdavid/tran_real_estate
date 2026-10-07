/**
 * Listing description facts (STU-01). A closed whitelist: only the keys in `LISTING_FACT_KEYS`
 * can ever reach the listing prompt. Any other key (for example a neighborhood-profile field that
 * could steer buyers or renters) fails validation, so it can never become prompt context
 * (09-RESEARCH Pattern 2, Pitfall 9).
 *
 * Pure and clock-free: the caller passes `now` for the year-built bound.
 * Error copy is verbatim from 09-UI-SPEC "Listing description" validation.
 */

export const LISTING_FEATURES = [
	'Updated kitchen',
	'Hardwood floors',
	'In-unit laundry',
	'Central air',
	'Garage',
	'Off-street parking',
	'Private outdoor space',
	'Fireplace',
	'Walk-in closets',
	'Primary suite',
	'Home office',
	'Energy-efficient windows',
	'Solar panels',
	'Pool',
	'Extra storage',
	'Step-free entry'
] as const;

export const NEARBY_AMENITIES = [
	'Public transit',
	'Parks',
	'Trails',
	'Shops',
	'Restaurants and cafes',
	'Grocery store',
	'Waterfront',
	'Commuting routes',
	'Bike lanes'
] as const;

export const PROPERTY_TYPES_STUDIO = [
	'Single family',
	'Condo',
	'Townhouse',
	'Multi-family',
	'Manufactured'
] as const;

/** Approximate word targets per length chip ("Short is about 75 words, ..."). */
export const LENGTH_WORDS = { short: 75, medium: 150, long: 250 } as const;

export type ListingFeature = (typeof LISTING_FEATURES)[number];
export type NearbyAmenity = (typeof NEARBY_AMENITIES)[number];
export type StudioPropertyType = (typeof PROPERTY_TYPES_STUDIO)[number];
export type ListingTone = 'warm' | 'concise' | 'luxury';
export type ListingLength = keyof typeof LENGTH_WORDS;

export interface ListingFacts {
	listingType: 'sale' | 'rent';
	propertyType: StudioPropertyType;
	bedrooms: number;
	bathrooms: number;
	squareFeet?: number;
	yearBuilt?: number;
	lotSize?: string;
	garageSpaces?: number;
	price?: number;
	streetOrArea?: string;
	features: ListingFeature[];
	otherFeatures?: string;
	nearby: NearbyAmenity[];
	nearbyPlaces?: string;
	tone: ListingTone;
	length: ListingLength;
	anythingElse?: string;
	siteCharLimit?: number;
}

export const LISTING_FACT_KEYS: readonly (keyof ListingFacts)[] = [
	'listingType',
	'propertyType',
	'bedrooms',
	'bathrooms',
	'squareFeet',
	'yearBuilt',
	'lotSize',
	'garageSpaces',
	'price',
	'streetOrArea',
	'features',
	'otherFeatures',
	'nearby',
	'nearbyPlaces',
	'tone',
	'length',
	'anythingElse',
	'siteCharLimit'
];

export type ListingFactErrors = Partial<Record<keyof ListingFacts | '_unknown', string>>;

export type ListingFactsResult =
	| { ok: true; value: ListingFacts }
	| { ok: false; errors: ListingFactErrors; unknownKeys: string[] };

const COPY = {
	unknown: 'Unsupported fact.',
	listingType: 'Choose For sale or For rent.',
	propertyType: 'Choose a property type.',
	bedrooms: 'Enter the number of bedrooms, from 0 to 20.',
	bathrooms: 'Enter the number of bathrooms, like 2 or 2.5.',
	number: 'Enter a number, like 1450.',
	nonNegative: 'Use 0 or more.',
	chips: 'Choose from the listed features.',
	tone: 'Choose a tone.',
	length: 'Choose a length.',
	text: 'Enter text.'
} as const;

const yearCopy = (now: Date) => `Enter a year from 1700 to ${now.getFullYear()}.`;
const maxCopy = (max: number) => `Keep this under ${max} characters.`;

/** Optional text fields and their maximum lengths (UI-SPEC). */
const TEXT_MAX = {
	lotSize: 40,
	streetOrArea: 80,
	otherFeatures: 200,
	nearbyPlaces: 200,
	anythingElse: 500
} as const;

/** Optional non-negative number fields. */
const NUMBER_FIELDS = ['squareFeet', 'garageSpaces', 'price', 'siteCharLimit'] as const;

const TONES: readonly string[] = ['warm', 'concise', 'luxury'];
const LENGTHS: readonly string[] = Object.keys(LENGTH_WORDS);
const KEY_SET: ReadonlySet<string> = new Set(LISTING_FACT_KEYS);

const isAbsent = (v: unknown) =>
	v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

const inRange = (v: number, min: number, max: number) => v >= min && v <= max;

function chipList<T extends string>(v: unknown, allowed: readonly T[]): T[] | null {
	if (v === undefined || v === null) return [];
	if (!Array.isArray(v)) return null;
	const out: T[] = [];
	for (const item of v) {
		if (typeof item !== 'string' || !(allowed as readonly string[]).includes(item)) return null;
		if (!out.includes(item as T)) out.push(item as T);
	}
	return out;
}

/**
 * Validates untrusted form input against the closed listing-facts whitelist.
 * Any key outside `LISTING_FACT_KEYS` makes the whole input fail with `errors._unknown`.
 */
export function validateListingFacts(input: unknown, now: Date): ListingFactsResult {
	if (typeof input !== 'object' || input === null || Array.isArray(input)) {
		return { ok: false, errors: { _unknown: COPY.unknown }, unknownKeys: [] };
	}
	const src = input as Record<string, unknown>;
	const errors: ListingFactErrors = {};
	const unknownKeys = Object.keys(src).filter((k) => !KEY_SET.has(k));
	if (unknownKeys.length > 0) errors._unknown = COPY.unknown;

	const value: Partial<ListingFacts> = {};

	const listingType = src.listingType;
	if (listingType === 'sale' || listingType === 'rent') value.listingType = listingType;
	else errors.listingType = COPY.listingType;

	const propertyType = src.propertyType;
	if (
		typeof propertyType === 'string' &&
		(PROPERTY_TYPES_STUDIO as readonly string[]).includes(propertyType)
	) {
		value.propertyType = propertyType as StudioPropertyType;
	} else errors.propertyType = COPY.propertyType;

	const bedrooms = src.bedrooms;
	if (isFiniteNumber(bedrooms) && Number.isInteger(bedrooms) && inRange(bedrooms, 0, 20)) {
		value.bedrooms = bedrooms;
	} else errors.bedrooms = COPY.bedrooms;

	const bathrooms = src.bathrooms;
	if (isFiniteNumber(bathrooms) && Number.isInteger(bathrooms * 2) && inRange(bathrooms, 0, 20)) {
		value.bathrooms = bathrooms;
	} else errors.bathrooms = COPY.bathrooms;

	const yearBuilt = src.yearBuilt;
	if (!isAbsent(yearBuilt)) {
		if (
			isFiniteNumber(yearBuilt) &&
			Number.isInteger(yearBuilt) &&
			inRange(yearBuilt, 1700, now.getFullYear())
		) {
			value.yearBuilt = yearBuilt;
		} else errors.yearBuilt = yearCopy(now);
	}

	for (const key of NUMBER_FIELDS) {
		const v = src[key];
		if (isAbsent(v)) continue;
		if (!isFiniteNumber(v)) errors[key] = COPY.number;
		else if (v < 0) errors[key] = COPY.nonNegative;
		else value[key] = v;
	}

	for (const key of Object.keys(TEXT_MAX) as (keyof typeof TEXT_MAX)[]) {
		const v = src[key];
		if (isAbsent(v)) continue;
		if (typeof v !== 'string') {
			errors[key] = COPY.text;
			continue;
		}
		const text = v.trim();
		if (text.length > TEXT_MAX[key]) errors[key] = maxCopy(TEXT_MAX[key]);
		else value[key] = text;
	}

	const features = chipList(src.features, LISTING_FEATURES);
	if (features) value.features = features;
	else errors.features = COPY.chips;

	const nearby = chipList(src.nearby, NEARBY_AMENITIES);
	if (nearby) value.nearby = nearby;
	else errors.nearby = COPY.chips;

	const tone = src.tone;
	if (isAbsent(tone)) value.tone = 'warm';
	else if (typeof tone === 'string' && TONES.includes(tone)) value.tone = tone as ListingTone;
	else errors.tone = COPY.tone;

	const length = src.length;
	if (isAbsent(length)) value.length = 'medium';
	else if (typeof length === 'string' && LENGTHS.includes(length)) {
		value.length = length as ListingLength;
	} else errors.length = COPY.length;

	if (Object.keys(errors).length > 0) return { ok: false, errors, unknownKeys };
	return { ok: true, value: value as ListingFacts };
}

/** Keys that steer the prompt's style or the UI only; never sent as facts. */
const NON_FACT_KEYS: ReadonlySet<string> = new Set(['tone', 'length', 'siteCharLimit']);

/**
 * The facts block for the listing prompt: whitelisted keys only, style keys excluded,
 * empty strings, empty arrays and undefined dropped (zero is kept: 0 bedrooms is a studio).
 */
export function pickListingFacts(f: ListingFacts): Record<string, string | number | string[]> {
	const out: Record<string, string | number | string[]> = {};
	for (const key of LISTING_FACT_KEYS) {
		if (NON_FACT_KEYS.has(key)) continue;
		const v = f[key];
		if (v === undefined || v === null) continue;
		if (typeof v === 'string') {
			const text = v.trim();
			if (text !== '') out[key] = text;
		} else if (Array.isArray(v)) {
			if (v.length > 0) out[key] = [...v];
		} else if (typeof v === 'number' && Number.isFinite(v)) {
			out[key] = v;
		}
	}
	return out;
}

/** Agent-typed free text that can support a feature mention, in a fixed order. */
export function listingFreeText(f: ListingFacts): string[] {
	return [f.otherFeatures, f.nearbyPlaces, f.anythingElse, f.lotSize, f.streetOrArea]
		.map((s) => (typeof s === 'string' ? s.trim() : ''))
		.filter((s) => s !== '');
}
