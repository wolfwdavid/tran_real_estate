/**
 * Listing description (STU-01), prompt `studio/listing.v1` v1 (fixture text from `sample`).
 *
 * Facts in, description out. The model receives ONLY the whitelisted listing facts as a JSON
 * <facts> block (pickListingFacts: no tone, length or character limit inside it) plus the tone
 * and target length. Input that fails validateListingFacts (for example an extra `schools` key)
 * is refused before anything is built, so an off-whitelist field can never become prompt context.
 * The registry prepends the property-not-people guardrail.
 *
 * `sample` is the keyless Fixture text: a deterministic template filled only from the agent's own
 * facts, so it passes the Fair Housing checker, the number check and the unsupported-feature check
 * that gate the real draft (09-RESEARCH Pitfall 4).
 */
import { usd } from '@tran/core/format';
import {
	LENGTH_WORDS,
	pickListingFacts,
	validateListingFacts,
	type ListingFacts,
	type ListingFeature,
	type StudioPropertyType
} from '@tran/core/studio';
import type { PromptDef } from '../types.js';

export const STUDIO_LISTING_PROMPT_ID = 'studio/listing.v1';
export const STUDIO_LISTING_FEATURE = 'studio-listing';

export const STUDIO_LISTING_SYSTEM = [
	'Write a real estate listing description using ONLY the facts in <facts>.',
	'Do not add any feature, amenity, number, measurement, date, or price that is not in <facts>.',
	'Use numerals exactly as given. Do not round, convert, or estimate.',
	'Never describe who should live here, the neighbors, schools, safety, crime, religion, or demographics.',
	'Never promise value, appreciation, or returns. No superlatives like "best" or "#1".',
	'Do not write a disclosure, license number, brokerage name, or hashtags; they are added separately.',
	'Output plain text only. No headings, no markdown, no emoji.'
].join('\n');

/** Validates, then returns the facts the prompt may use. Throws on any validation error. */
function validated(input: unknown): ListingFacts {
	const r = validateListingFacts(input, new Date());
	if (!r.ok) {
		const fields = [...r.unknownKeys, ...Object.keys(r.errors).filter((k) => k !== '_unknown')];
		throw new Error(`Listing facts are not valid: ${fields.join(', ')}`);
	}
	return r.value;
}

/** The user message: the JSON facts block, then tone and target length. */
export function renderListingUser(input: ListingFacts): string {
	const f = validated(input);
	return (
		`<facts>\n${JSON.stringify(pickListingFacts(f), null, 2)}\n</facts>\n` +
		`Tone: ${f.tone}. Length: about ${LENGTH_WORDS[f.length]} words.`
	);
}

// ---------------------------------------------------------------------------------------------
// Keyless sample

const TYPE_PHRASE: Record<StudioPropertyType, string> = {
	'Single family': 'single-family home',
	Condo: 'condo',
	Townhouse: 'townhouse',
	'Multi-family': 'multi-family property',
	Manufactured: 'manufactured home'
};

/** Feature chips as they read mid-sentence. */
const FEATURE_PHRASE: Record<ListingFeature, string> = {
	'Updated kitchen': 'an updated kitchen',
	'Hardwood floors': 'hardwood floors',
	'In-unit laundry': 'in-unit laundry',
	'Central air': 'central air',
	Garage: 'a garage',
	'Off-street parking': 'off-street parking',
	'Private outdoor space': 'private outdoor space',
	Fireplace: 'a fireplace',
	'Walk-in closets': 'walk-in closets',
	'Primary suite': 'a primary suite',
	'Home office': 'a home office',
	'Energy-efficient windows': 'energy-efficient windows',
	'Solar panels': 'solar panels',
	Pool: 'a pool',
	'Extra storage': 'extra storage',
	'Step-free entry': 'step-free entry'
};

const COUNT = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const count = (n: number): string => COUNT.format(n);
const money = (n: number): string => usd(Math.round(n * 100));

const cap = (s: string): string => (s === '' ? s : s[0]!.toUpperCase() + s.slice(1));

/** "a", "a and b", "a, b and c". */
function list(items: readonly string[]): string {
	if (items.length <= 1) return items.join('');
	return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** Ends a typed fragment with a period unless it already ends a sentence. */
const sentence = (s: string): string => (/[.!?]$/.test(s) ? s : `${s}.`);

function featurePhrases(f: ListingFacts): string[] {
	const spaces = f.garageSpaces ?? 0;
	const out = f.features.map((c) =>
		c === 'Garage' && spaces > 0 ? `a ${count(spaces)}-car garage` : FEATURE_PHRASE[c]
	);
	if (spaces > 0 && !f.features.includes('Garage')) out.push(`a ${count(spaces)}-car garage`);
	return out;
}

function nearbySentence(f: ListingFacts): string {
	const parts: string[] = [];
	if (f.nearby.length > 0) parts.push(`Nearby: ${list(f.nearby.map((n) => n.toLowerCase()))}.`);
	const places = f.nearbyPlaces?.trim();
	if (places) parts.push(sentence(places));
	return parts.join(' ');
}

function priceSentence(f: ListingFacts): string {
	if (f.price === undefined) return '';
	return f.listingType === 'rent'
		? `Available for ${money(f.price)} a month.`
		: `Offered at ${money(f.price)}.`;
}

const yearSentence = (f: ListingFacts): string =>
	f.yearBuilt === undefined ? '' : `Built in ${f.yearBuilt}.`;

/** "3-bedroom, 2-bathroom" or "studio, 1-bathroom" for 0 bedrooms. */
const roomsAdjective = (f: ListingFacts): string =>
	`${f.bedrooms === 0 ? 'studio' : `${count(f.bedrooms)}-bedroom`}, ${count(f.bathrooms)}-bathroom`;

const sqftClause = (f: ListingFacts, lead: string): string =>
	f.squareFeet === undefined ? '' : `${lead}${count(f.squareFeet)} square feet`;

const joinSentences = (parts: readonly string[]): string => parts.filter((p) => p !== '').join(' ');

function warm(f: ListingFacts): string {
	const place = f.streetOrArea?.trim() || 'this home';
	const features = featurePhrases(f);
	return joinSentences([
		`Welcome to ${place}, a ${roomsAdjective(f)} ${TYPE_PHRASE[f.propertyType]}${sqftClause(f, ' with ')}.`,
		features.length > 0 ? `It offers ${list(features)}.` : '',
		nearbySentence(f),
		yearSentence(f),
		priceSentence(f)
	]);
}

function concise(f: ListingFacts): string {
	const beds =
		f.bedrooms === 0
			? 'Studio'
			: `${count(f.bedrooms)} ${f.bedrooms === 1 ? 'bedroom' : 'bedrooms'}`;
	const baths = `${count(f.bathrooms)} ${f.bathrooms === 1 ? 'bathroom' : 'bathrooms'}`;
	const features = featurePhrases(f);
	return joinSentences([
		`${cap(TYPE_PHRASE[f.propertyType])}.`,
		`${beds}, ${baths}${sqftClause(f, ', ')}.`,
		features.length > 0 ? `${cap(list(features))}.` : '',
		nearbySentence(f),
		yearSentence(f),
		priceSentence(f)
	]);
}

function luxury(f: ListingFacts): string {
	const place = f.streetOrArea?.trim() || 'this residence';
	const features = featurePhrases(f);
	const finish = features.length > 0 ? `, finished with ${list(features)}` : '';
	return joinSentences([
		`Presenting ${place}: a ${roomsAdjective(f)} ${TYPE_PHRASE[f.propertyType]}${sqftClause(f, ' with ')}${finish}.`,
		nearbySentence(f),
		yearSentence(f),
		priceSentence(f)
	]);
}

/** Deterministic keyless description built only from the agent's own facts. */
export function sampleListing(f: ListingFacts): string {
	switch (f.tone) {
		case 'concise':
			return concise(f);
		case 'luxury':
			return luxury(f);
		default:
			return warm(f);
	}
}

export const studioListingV1: PromptDef<ListingFacts> = {
	id: STUDIO_LISTING_PROMPT_ID,
	version: 1,
	feature: STUDIO_LISTING_FEATURE,
	housingCopy: true,
	containsClientData: false,
	maxTokens: 2048,
	build: (i) => ({ system: STUDIO_LISTING_SYSTEM, user: renderListingUser(i), known: [] }),
	sample: (i) => sampleListing(i)
};
