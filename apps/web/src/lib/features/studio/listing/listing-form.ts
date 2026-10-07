// Listing facts form model (09-UI-SPEC "Listing description"). The form keeps what the agent
// typed (strings, so "1,650" survives a reload); toFactsInput turns it into the untrusted input
// that @tran/core/studio validateListingFacts checks against the closed whitelist. Only the
// whitelisted keys are ever produced, so no other field can reach the prompt.
import {
	LISTING_FACT_KEYS,
	validateListingFacts,
	type ListingFactErrors,
	type ListingFacts,
	type ListingFactsResult,
	type ListingLength,
	type ListingTone
} from '@tran/core/studio';

export interface ListingForm {
	listingType: '' | 'sale' | 'rent';
	propertyType: string;
	bedrooms: string;
	bathrooms: string;
	squareFeet: string;
	yearBuilt: string;
	lotSize: string;
	garageSpaces: string;
	price: string;
	streetOrArea: string;
	features: string[];
	otherFeatures: string;
	nearby: string[];
	nearbyPlaces: string;
	tone: ListingTone;
	length: ListingLength;
	anythingElse: string;
	siteCharLimit: string;
}

export type ListingFactKey = keyof ListingFacts;

export const NUMBER_KEYS = [
	'bedrooms',
	'bathrooms',
	'squareFeet',
	'yearBuilt',
	'garageSpaces',
	'price',
	'siteCharLimit'
] as const satisfies readonly ListingFactKey[];

export type ListingNumberKey = (typeof NUMBER_KEYS)[number];

const TEXT_KEYS = [
	'lotSize',
	'streetOrArea',
	'otherFeatures',
	'nearbyPlaces',
	'anythingElse'
] as const satisfies readonly ListingFactKey[];

/** Numbers shown with thousands separators after blur. */
const GROUPED: ReadonlySet<ListingNumberKey> = new Set(['squareFeet', 'price', 'siteCharLimit']);

export function emptyListingForm(): ListingForm {
	return {
		listingType: '',
		propertyType: '',
		bedrooms: '',
		bathrooms: '',
		squareFeet: '',
		yearBuilt: '',
		lotSize: '',
		garageSpaces: '',
		price: '',
		streetOrArea: '',
		features: [],
		otherFeatures: '',
		nearby: [],
		nearbyPlaces: '',
		tone: 'warm',
		length: 'medium',
		anythingElse: '',
		siteCharLimit: ''
	};
}

/** '' -> undefined; "$1,650" -> 1650; anything else that is not a number -> NaN (an error). */
export function parseNumberText(text: string): number | undefined {
	const t = text.replace(/[\s,$]/g, '');
	if (t === '') return undefined;
	if (!/^-?(\d+\.?\d*|\.\d+)$/.test(t)) return Number.NaN;
	return Number(t);
}

/** Format on blur: grouped figures get separators; anything unparseable stays as typed. */
export function formatNumberText(key: ListingNumberKey, text: string): string {
	const v = parseNumberText(text);
	if (v === undefined || !Number.isFinite(v)) return text.trim();
	if (GROUPED.has(key)) return v.toLocaleString('en-US', { maximumFractionDigits: 2 });
	return String(v);
}

/** The untrusted input for validateListingFacts: whitelisted keys only, blanks omitted. */
export function toFactsInput(form: ListingForm): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	if (form.listingType !== '') out.listingType = form.listingType;
	if (form.propertyType !== '') out.propertyType = form.propertyType;
	for (const key of NUMBER_KEYS) {
		const v = parseNumberText(form[key]);
		if (v !== undefined) out[key] = v;
	}
	for (const key of TEXT_KEYS) {
		const t = form[key].trim();
		if (t !== '') out[key] = t;
	}
	out.features = [...form.features];
	out.nearby = [...form.nearby];
	out.tone = form.tone;
	out.length = form.length;
	return out;
}

export function validateListingForm(form: ListingForm, now: Date): ListingFactsResult {
	return validateListingFacts(toFactsInput(form), now);
}

const show = (v: number | undefined, key: ListingNumberKey): string =>
	v === undefined ? '' : formatNumberText(key, String(v));

/** The form for a set of facts (Fill with sample facts, Draft history reopen). */
export function factsToForm(f: ListingFacts): ListingForm {
	return {
		listingType: f.listingType,
		propertyType: f.propertyType,
		bedrooms: show(f.bedrooms, 'bedrooms'),
		bathrooms: show(f.bathrooms, 'bathrooms'),
		squareFeet: show(f.squareFeet, 'squareFeet'),
		yearBuilt: show(f.yearBuilt, 'yearBuilt'),
		lotSize: f.lotSize ?? '',
		garageSpaces: show(f.garageSpaces, 'garageSpaces'),
		price: show(f.price, 'price'),
		streetOrArea: f.streetOrArea ?? '',
		features: [...f.features],
		otherFeatures: f.otherFeatures ?? '',
		nearby: [...f.nearby],
		nearbyPlaces: f.nearbyPlaces ?? '',
		tone: f.tone,
		length: f.length,
		anythingElse: f.anythingElse ?? '',
		siteCharLimit: show(f.siteCharLimit, 'siteCharLimit')
	};
}

/** True when both forms hold the same values (the "unedited sample facts" test). */
export function sameForm(a: ListingForm, b: ListingForm): boolean {
	return JSON.stringify(a) === JSON.stringify(b);
}

/** A stored studioDraft row back into a form; anything malformed falls back to empty. */
export function restoreListingForm(data: unknown): ListingForm {
	const base = emptyListingForm();
	if (typeof data !== 'object' || data === null || Array.isArray(data)) return base;
	const src = data as Record<string, unknown>;
	const out: Record<string, unknown> = { ...base };
	for (const key of Object.keys(base) as (keyof ListingForm)[]) {
		const v = src[key];
		const want = base[key];
		if (Array.isArray(want)) {
			if (Array.isArray(v) && v.every((x) => typeof x === 'string')) out[key] = [...v];
		} else if (typeof v === 'string') out[key] = v;
	}
	const restored = out as unknown as ListingForm;
	if (!['', 'sale', 'rent'].includes(restored.listingType)) restored.listingType = '';
	if (!['warm', 'concise', 'luxury'].includes(restored.tone)) restored.tone = 'warm';
	if (!['short', 'medium', 'long'].includes(restored.length)) restored.length = 'medium';
	return restored;
}

/** Element id for a fact's control (chip groups: their first chip). */
export function fieldId(key: ListingFactKey): string {
	const slug = key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
	if (key === 'listingType') return 'listing-listing-type-sale';
	if (key === 'tone') return 'listing-tone-warm';
	if (key === 'length') return 'listing-length-short';
	if (key === 'features') return 'listing-features-0';
	if (key === 'nearby') return 'listing-nearby-0';
	return `listing-${slug}`;
}

/** The first failing fact in form order (LISTING_FACT_KEYS order), or null. */
export function firstInvalidKey(errors: ListingFactErrors): ListingFactKey | null {
	return LISTING_FACT_KEYS.find((k) => errors[k] !== undefined) ?? null;
}
