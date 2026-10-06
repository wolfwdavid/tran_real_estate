// Buy-box form model (07-18, INV-04; 07-UI-SPEC "Buy boxes" copy). The form holds raw strings as
// typed; toBuyBoxInput turns them into the 07-14 BuyBoxInput (prices in cents, targets in percent,
// expense assumption in basis points) or returns field errors with the approved copy. Pure
// TypeScript: no Svelte, no DOM, no data access.
import { BUY_BOX_EXPENSE_BPS, parseMoneyInput, parsePercentInput } from '@tran/core/finance';
import { usd } from '@tran/core/format';
import { bpsToText, centsToText, FIELD_ERROR_COPY } from '../analyzer/form-model';
import {
	validateBuyBox,
	type BuyBoxError,
	type BuyBoxInput,
	type BuyBoxPropertyType
} from './buyBoxRepo';

export type BedsChoice = '0' | '1' | '2' | '3' | '4';

export interface BuyBoxFormState {
	name: string;
	location: string;
	minPrice: string;
	maxPrice: string;
	minBeds: BedsChoice;
	propertyTypes: BuyBoxPropertyType[];
	minCapRate: string;
	minRentToPrice: string;
	expensePct: string;
}

export type BuyBoxFormErrors = Partial<Record<keyof BuyBoxFormState, string>>;

/** UI-SPEC validation copy, verbatim. */
export const BUY_BOX_ERROR_COPY: Record<BuyBoxError, string> = {
	'name-empty': 'Give this buy box a name.',
	'location-empty': 'Enter a city and state, or a ZIP code.',
	'location-unrecognized': 'Use a format like Austin, TX or 78701.',
	'min-over-max': 'The minimum price is higher than the maximum.'
};

const ERROR_FIELD: Record<BuyBoxError, keyof BuyBoxFormState> = {
	'name-empty': 'name',
	'location-empty': 'location',
	'location-unrecognized': 'location',
	'min-over-max': 'minPrice'
};

/** Labels for the property-type checkboxes and the criteria summary (sentence case). */
export const PROPERTY_TYPE_LABELS: Record<BuyBoxPropertyType, string> = {
	'Single Family': 'Single family',
	Condo: 'Condo',
	Townhouse: 'Townhouse',
	'Multi-Family': 'Multi-family',
	Manufactured: 'Manufactured'
};

export function emptyBuyBoxForm(): BuyBoxFormState {
	return {
		name: '',
		location: '',
		minPrice: '',
		maxPrice: '',
		minBeds: '0',
		propertyTypes: [],
		minCapRate: '',
		minRentToPrice: '',
		expensePct: bpsToText(BUY_BOX_EXPENSE_BPS)
	};
}

/** A saved box back into form strings (Edit). */
export function buyBoxToForm(b: BuyBoxInput): BuyBoxFormState {
	const money = (c: number | null) => (c === null ? '' : centsToText(c));
	const pctText = (v: number | null) => (v === null ? '' : bpsToText(Math.round(v * 100)));
	return {
		name: b.name,
		location: b.criteria.location,
		minPrice: money(b.criteria.minPriceCents),
		maxPrice: money(b.criteria.maxPriceCents),
		minBeds: String(b.criteria.minBeds) as BedsChoice,
		propertyTypes: [...b.criteria.propertyTypes],
		minCapRate: pctText(b.targets.minCapRatePct),
		minRentToPrice: pctText(b.targets.minRentToPricePct),
		expensePct: bpsToText(b.expenseBps)
	};
}

type Parsed = { ok: true; value: number | null } | { ok: false; error: string };

function money(raw: string): Parsed {
	const r = parseMoneyInput(raw);
	if (r.ok) return { ok: true, value: r.value };
	return {
		ok: false,
		error: FIELD_ERROR_COPY[r.error === 'negative' ? 'negative' : 'not-a-number']
	};
}

/** Percent text -> basis points (null when blank). */
function percentBps(raw: string): Parsed {
	const r = parsePercentInput(raw);
	if (r.ok) return { ok: true, value: r.value };
	if (r.error === 'negative') return { ok: false, error: FIELD_ERROR_COPY.negative };
	return {
		ok: false,
		error: FIELD_ERROR_COPY[r.error === 'out-of-range' ? 'pct-range' : 'not-a-number']
	};
}

/** Validates the whole form. `input` is null whenever any error is present. */
export function toBuyBoxInput(f: BuyBoxFormState): {
	input: BuyBoxInput | null;
	errors: BuyBoxFormErrors;
} {
	const errors: BuyBoxFormErrors = {};
	const parsed = {
		minPrice: money(f.minPrice),
		maxPrice: money(f.maxPrice),
		minCapRate: percentBps(f.minCapRate),
		minRentToPrice: percentBps(f.minRentToPrice),
		expensePct: percentBps(f.expensePct)
	};
	for (const [key, r] of Object.entries(parsed) as [keyof typeof parsed, Parsed][]) {
		if (!r.ok) errors[key] = r.error;
	}
	const num = (r: Parsed) => (r.ok ? r.value : null);
	const toPct = (bps: number | null) => (bps === null ? null : bps / 100);

	const input: BuyBoxInput = {
		name: f.name,
		criteria: {
			location: f.location,
			minPriceCents: num(parsed.minPrice),
			maxPriceCents: num(parsed.maxPrice),
			minBeds: Number(f.minBeds) as BuyBoxInput['criteria']['minBeds'],
			propertyTypes: [...f.propertyTypes]
		},
		targets: {
			minCapRatePct: toPct(num(parsed.minCapRate)),
			minRentToPricePct: toPct(num(parsed.minRentToPrice))
		},
		expenseBps: num(parsed.expensePct) ?? BUY_BOX_EXPENSE_BPS
	};
	for (const code of validateBuyBox(input)) {
		const field = ERROR_FIELD[code];
		errors[field] ??= BUY_BOX_ERROR_COPY[code];
	}
	return Object.keys(errors).length > 0 ? { input: null, errors } : { input, errors };
}

/** A whole percent when exact ("6"), else up to 2 decimals ("6.5"). */
const pctNumber = (v: number) => bpsToText(Math.round(v * 100));

/**
 * The card's criteria line, e.g.
 * "Harlow Springs, TX · $200,000 to $350,000 · 3+ beds · Single family · Cap rate 6%+".
 * Parts that are not set are omitted.
 */
export function criteriaSummary(b: BuyBoxInput): string {
	const c = b.criteria;
	const parts: string[] = [c.location.trim()];
	if (c.minPriceCents !== null && c.maxPriceCents !== null) {
		parts.push(`${usd(c.minPriceCents)} to ${usd(c.maxPriceCents)}`);
	} else if (c.minPriceCents !== null) {
		parts.push(`${usd(c.minPriceCents)} or more`);
	} else if (c.maxPriceCents !== null) {
		parts.push(`Up to ${usd(c.maxPriceCents)}`);
	}
	if (c.minBeds > 0) parts.push(`${c.minBeds}+ beds`);
	if (c.propertyTypes.length > 0) {
		parts.push(c.propertyTypes.map((t) => PROPERTY_TYPE_LABELS[t]).join(', '));
	}
	if (b.targets.minCapRatePct !== null)
		parts.push(`Cap rate ${pctNumber(b.targets.minCapRatePct)}%+`);
	if (b.targets.minRentToPricePct !== null) {
		parts.push(`Rent-to-price ${pctNumber(b.targets.minRentToPricePct)}%+`);
	}
	return parts.join(' · ');
}
