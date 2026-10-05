// Renter labels (RENT-01/02/04): property-type display names, removable filter chips, the saved
// search summary line and default name, and the results heading. Every surface that names a filter
// uses these, so a chip, a saved-search row and a prefilled name always read the same.
import { formatRent } from './format.js';
import {
	DEFAULT_FILTERS,
	RENTER_PROPERTY_TYPES,
	type RentalFilters,
	type RenterPropertyType
} from './types.js';

/** UI-SPEC display names for RentCast property types. */
export const PROPERTY_TYPE_LABELS: Readonly<Record<RenterPropertyType, string>> = Object.freeze({
	Apartment: 'Apartment',
	'Single Family': 'Single-family home',
	Condo: 'Condo',
	Townhouse: 'Townhouse',
	'Multi-Family': 'Multi-family',
	Manufactured: 'Manufactured home'
});

/** Unknown or missing types (including RentCast's 'Land') read "Home". */
export function propertyTypeLabel(t: string | null): string {
	return t !== null && Object.hasOwn(PROPERTY_TYPE_LABELS, t)
		? PROPERTY_TYPE_LABELS[t as RenterPropertyType]
		: 'Home';
}

export interface FilterChip {
	/** 'price' | 'beds' | 'days' | `type:${RenterPropertyType}`; pass back to removeChip. */
	key: string;
	label: string;
}

const TYPE_PREFIX = 'type:';
const NAME_MAX = 60;
const SEPARATOR = ' · ';
const COUNT = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

const money = (n: number): string => formatRent(n) ?? `$${n}`;

function priceLabel(min: number | null, max: number | null): string | null {
	if (min !== null && max !== null) return `${money(min)} to ${money(max)}`;
	if (max !== null) return `Up to ${money(max)}`;
	if (min !== null) return `From ${money(min)}`;
	return null;
}

function bedsLabel(beds: RentalFilters['beds']): string | null {
	if (beds === 'any') return null;
	if (beds === 0) return 'Studio';
	if (beds === '4+') return '4+ bedrooms';
	return beds === 1 ? '1 bedroom' : `${beds} bedrooms`;
}

/** Selected types in UI order (RENTER_PROPERTY_TYPES), whatever order they were picked in. */
const orderedTypes = (f: RentalFilters): RenterPropertyType[] =>
	RENTER_PROPERTY_TYPES.filter((t) => f.types.includes(t));

/** One chip per active filter value, ordered price, beds, each type, listed within. */
export function activeFilterChips(f: RentalFilters): FilterChip[] {
	const chips: FilterChip[] = [];
	const price = priceLabel(f.priceMin, f.priceMax);
	if (price !== null) chips.push({ key: 'price', label: price });
	const beds = bedsLabel(f.beds);
	if (beds !== null) chips.push({ key: 'beds', label: beds });
	for (const t of orderedTypes(f))
		chips.push({ key: TYPE_PREFIX + t, label: PROPERTY_TYPE_LABELS[t] });
	if (f.listedWithin !== 'any') {
		chips.push({ key: 'days', label: `Listed within ${f.listedWithin} days` });
	}
	return chips;
}

/** For the "Filters · {n}" disclosure button. */
export function filterCount(f: RentalFilters): number {
	return activeFilterChips(f).length;
}

/** A new filters object with the chip's filter reset to its default; unknown keys change nothing. */
export function removeChip(f: RentalFilters, key: string): RentalFilters {
	if (key === 'price') return { ...f, priceMin: null, priceMax: null };
	if (key === 'beds') return { ...f, beds: DEFAULT_FILTERS.beds };
	if (key === 'days') return { ...f, listedWithin: DEFAULT_FILTERS.listedWithin };
	if (key.startsWith(TYPE_PREFIX)) {
		const type = key.slice(TYPE_PREFIX.length);
		return { ...f, types: f.types.filter((t) => t !== type) };
	}
	return { ...f, types: [...f.types] };
}

/** "{location} · {rent range} · {beds} · {types} · Listed within {n} days", defaults omitted. */
export function savedSearchSummary(locationText: string, f: RentalFilters): string {
	const parts = [locationText];
	const price = priceLabel(f.priceMin, f.priceMax);
	if (price !== null) parts.push(price);
	const beds = bedsLabel(f.beds);
	if (beds !== null) parts.push(beds);
	const types = orderedTypes(f);
	if (types.length > 0) parts.push(types.map((t) => PROPERTY_TYPE_LABELS[t]).join(', '));
	if (f.listedWithin !== 'any') parts.push(`Listed within ${f.listedWithin} days`);
	return parts.join(SEPARATOR);
}

/** Save-search name prefill: "{location} · {main filter}", cut to the 60-character field. */
export function defaultSearchName(locationText: string, f: RentalFilters): string {
	const first = activeFilterChips(f)[0];
	const name = first ? `${locationText}${SEPARATOR}${first.label}` : locationText;
	return name.slice(0, NAME_MAX).trimEnd();
}

/** "87 rentals in X" · "24 of 87 rentals in X" · "1 rental in X". */
export function resultsHeading(o: { total: number; shown: number; location: string }): string {
	const noun = o.total === 1 ? 'rental' : 'rentals';
	const count =
		o.shown < o.total
			? `${COUNT.format(o.shown)} of ${COUNT.format(o.total)}`
			: COUNT.format(o.total);
	return `${count} ${noun} in ${o.location}`;
}
