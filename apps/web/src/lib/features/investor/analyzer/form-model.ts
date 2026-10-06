// Analyzer form model (07-10, INV-01; 07-UI-SPEC "Analyzer layout" + "Copywriting Contract").
//
// The form holds raw strings exactly as typed. parseForm turns them into DealInputs with the exact
// string parsers from @tran/core/finance. Required fields (price, rent) blank or invalid -> not
// ready. An invalid optional field contributes a safe substitute (0, the default down payment or
// the default term) so the unaffected metrics still compute, and every metric that depends on it is
// reported in `masked`, so the results panel shows "—" + "Needs {field}" instead of a wrong number.
// Pure TypeScript: no Svelte, no DOM.

import {
	DEFAULT_CLOSING,
	DEFAULT_DOWN_BPS,
	DEFAULT_TERM_YEARS,
	MAX_CUSTOM_LINES,
	defaultExpenseLines,
	parseMoneyInput,
	parsePercentInput,
	parseRateInput,
	type ClosingCosts,
	type DealInputs,
	type ExpenseKind,
	type ExpenseLine,
	type ParseResult
} from '@tran/core/finance';

export interface ExpenseLineForm {
	id: string;
	kind: ExpenseKind;
	name: string;
	unit: 'pct' | 'usd';
	amount: string;
}

export type PropertyType =
	'' | 'single-family' | 'condo' | 'townhouse' | 'multi-family' | 'manufactured';

export interface AnalyzerForm {
	name: string;
	address: string;
	propertyType: PropertyType;
	bedrooms: string;
	bathrooms: string;
	squareFeet: string;
	price: string;
	closingAmount: string;
	closingUnit: 'pct' | 'usd';
	repairs: string;
	financing: 'mortgage' | 'cash';
	downPct: string;
	rate: string;
	termYears: string;
	rent: string;
	otherIncome: string;
	expenses: ExpenseLineForm[];
}

export type FieldError =
	| 'not-a-number'
	| 'negative'
	| 'down-range'
	| 'rate-range'
	| 'term-range'
	| 'pct-range'
	| 'bedrooms';

/** UI-SPEC validation copy, verbatim. */
export const FIELD_ERROR_COPY: Record<FieldError, string> = {
	'not-a-number': 'Enter a number, like 250000.',
	negative: 'Use 0 or more.',
	'down-range': 'Use a percent from 0 to 100.',
	'rate-range': 'Use a rate from 0 to 25%.',
	'term-range': 'Use a term from 1 to 40 years.',
	'pct-range': 'Use a percent from 0 to 100.',
	bedrooms: 'Use a whole number from 0 to 20.'
};

export type FieldKey =
	| 'price'
	| 'rent'
	| 'closing'
	| 'repairs'
	| 'downPct'
	| 'rate'
	| 'termYears'
	| 'otherIncome'
	| 'bedrooms'
	| 'bathrooms'
	| 'squareFeet'
	| `expense:${string}`;

/** Lowercase names for "Needs {field}". Expense lines use their own name (see fieldName). */
export const FIELD_NAMES: Record<string, string> = {
	price: 'purchase price',
	rent: 'monthly rent',
	closing: 'closing costs',
	repairs: 'repairs before renting',
	downPct: 'down payment',
	rate: 'interest rate',
	termYears: 'loan term',
	otherIncome: 'other monthly income',
	bedrooms: 'bedrooms',
	bathrooms: 'bathrooms',
	squareFeet: 'square feet'
};

export type ImpactMetric =
	| 'cashFlow'
	| 'coc'
	| 'capRate'
	| 'noi'
	| 'dscr'
	| 'grm'
	| 'onePct'
	| 'cashNeeded'
	| 'loan'
	| 'payment';

const FINANCING_IMPACT: ImpactMetric[] = [
	'loan',
	'payment',
	'cashFlow',
	'coc',
	'dscr',
	'cashNeeded'
];
const INCOME_IMPACT: ImpactMetric[] = ['noi', 'cashFlow', 'coc', 'capRate', 'dscr'];

/** The metrics each optional field feeds. */
export const FIELD_IMPACT: Record<
	'closing' | 'repairs' | 'downPct' | 'termYears' | 'otherIncome' | 'expense',
	ImpactMetric[]
> = {
	closing: ['coc', 'cashNeeded'],
	repairs: ['coc', 'cashNeeded'],
	downPct: FINANCING_IMPACT,
	termYears: FINANCING_IMPACT,
	otherIncome: INCOME_IMPACT,
	expense: INCOME_IMPACT
};

export interface ParsedForm {
	ready: boolean;
	inputs: DealInputs | null;
	errors: Partial<Record<FieldKey, FieldError>>;
	masked: Partial<Record<ImpactMetric, FieldKey>>;
}

// ---------------------------------------------------------------------------------------------
// Defaults

const DEFAULT_PCT_AMOUNT = (bps: number | null) => (bps === null ? '' : bpsToText(bps));

/** A fresh form with the UI-SPEC defaults (3% closing, 25% down, 30 years, default lines). */
export function defaultForm(): AnalyzerForm {
	return {
		name: '',
		address: '',
		propertyType: '',
		bedrooms: '',
		bathrooms: '',
		squareFeet: '',
		price: '',
		closingAmount: DEFAULT_CLOSING.unit === 'pct' ? bpsToText(DEFAULT_CLOSING.bps) : '',
		closingUnit: 'pct',
		repairs: '0',
		financing: 'mortgage',
		downPct: bpsToText(DEFAULT_DOWN_BPS),
		rate: '',
		termYears: String(DEFAULT_TERM_YEARS),
		rent: '',
		otherIncome: '0',
		expenses: defaultExpenseLines().map(lineToForm)
	};
}

function lineToForm(l: ExpenseLine): ExpenseLineForm {
	const { id, kind, name, unit } = l;
	const amount =
		l.unit === 'pct' ? DEFAULT_PCT_AMOUNT(l.bps) : l.cents === null ? '' : centsToText(l.cents);
	return { id, kind, name, unit, amount };
}

// ---------------------------------------------------------------------------------------------
// Text <-> numbers

const withCommas = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const stripLeadingZeros = (digits: string) => digits.replace(/^0+(?=\d)/, '');

/** 20000000 -> "200,000"; 123456 -> "1,234.56"; 4050 -> "40.50". */
function centsToText(cents: number): string {
	const whole = Math.trunc(cents / 100);
	const frac = cents % 100;
	return withCommas(String(whole)) + (frac === 0 ? '' : `.${String(frac).padStart(2, '0')}`);
}

/** 2500 -> "25"; 550 -> "5.5"; 125 -> "1.25". */
function bpsToText(bps: number): string {
	const whole = Math.trunc(bps / 100);
	const frac = String(bps % 100)
		.padStart(2, '0')
		.replace(/0+$/, '');
	return frac ? `${whole}.${frac}` : String(whole);
}

const PLAIN = /^(\d+)(?:\.(\d+))?$/;
const GROUPED = /^(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?$/;
const NEGATIVE = /^[-−]/;

/**
 * Normalizes a field on blur: money "250000" -> "250,000", "$1234.5" -> "1,234.50"; percent
 * "5.50" -> "5.5"; number "1450" -> "1,450". Text that doesn't parse is returned unchanged so the
 * user can see and fix what they typed.
 */
export function formatOnBlur(kind: 'money' | 'percent' | 'number', raw: string): string {
	if (kind === 'money') {
		const r = parseMoneyInput(raw);
		return r.ok && r.value !== null ? centsToText(r.value) : raw;
	}
	let t = raw.trim();
	if (kind === 'percent' && t.endsWith('%')) t = t.slice(0, -1).trim();
	const m = (kind === 'percent' ? PLAIN : GROUPED).exec(t);
	if (!m) return raw;
	const whole = stripLeadingZeros(m[1].replaceAll(',', ''));
	const frac = (m[2] ?? '').replace(/0+$/, '');
	const head = kind === 'number' ? withCommas(whole) : whole;
	return frac ? `${head}.${frac}` : head;
}

// ---------------------------------------------------------------------------------------------
// Field parsing

type FieldParse<T> = { ok: true; value: T | null } | { ok: false; error: FieldError };

const good = <T>(value: T | null): FieldParse<T> => ({ ok: true, value });
const bad = <T>(error: FieldError): FieldParse<T> => ({ ok: false, error });

function money(s: string): FieldParse<number> {
	const r = parseMoneyInput(s);
	if (r.ok) return good(r.value);
	return bad(r.error === 'negative' ? 'negative' : 'not-a-number');
}

function percent(s: string, range: FieldError): FieldParse<number> {
	const r: ParseResult<number> = parsePercentInput(s);
	if (r.ok) return good(r.value);
	if (r.error === 'negative') return bad('negative');
	return bad(r.error === 'out-of-range' ? range : 'not-a-number');
}

function rate(s: string): FieldParse<number> {
	const r = parseRateInput(s);
	if (r.ok) return good(r.value);
	if (r.error === 'negative') return bad('negative');
	return bad(r.error === 'out-of-range' ? 'rate-range' : 'not-a-number');
}

function term(s: string): FieldParse<number> {
	const t = s.trim();
	if (t === '') return good(null);
	if (/^\d+$/.test(t)) {
		const n = Number(t);
		return n >= 1 && n <= 40 ? good(n) : bad('term-range');
	}
	// A number outside the whole-year range (2.5, -3) is a range problem, not a typo.
	const unsigned = NEGATIVE.test(t) ? t.slice(1) : t;
	return PLAIN.test(unsigned) ? bad('term-range') : bad('not-a-number');
}

function bedrooms(s: string): FieldParse<number> {
	const t = s.trim();
	if (t === '') return good(null);
	if (/^\d+$/.test(t) && Number(t) <= 20) return good(Number(t));
	if (PLAIN.test(t) || (NEGATIVE.test(t) && PLAIN.test(t.slice(1)))) return bad('bedrooms');
	return bad('not-a-number');
}

function bathrooms(s: string): FieldParse<number> {
	const t = s.trim();
	if (t === '') return good(null);
	if (NEGATIVE.test(t)) return bad('negative');
	return PLAIN.test(t) ? good(Number(t)) : bad('not-a-number');
}

function squareFeet(s: string): FieldParse<number> {
	const t = s.trim();
	if (t === '') return good(null);
	if (NEGATIVE.test(t)) return bad('negative');
	const m = GROUPED.exec(t);
	return m && m[2] === undefined ? good(Number(m[1].replaceAll(',', ''))) : bad('not-a-number');
}

const isMortgage = (form: AnalyzerForm) => form.financing === 'mortgage';

function findLine(form: AnalyzerForm, key: FieldKey): ExpenseLineForm | undefined {
	if (!key.startsWith('expense:')) return undefined;
	const id = key.slice('expense:'.length);
	return form.expenses.find((l) => l.id === id);
}

function parseLine(line: ExpenseLineForm): FieldParse<number> {
	return line.unit === 'pct' ? percent(line.amount, 'pct-range') : money(line.amount);
}

function parseField(form: AnalyzerForm, key: FieldKey): FieldParse<number> {
	switch (key) {
		case 'price':
			return money(form.price);
		case 'rent':
			return money(form.rent);
		case 'repairs':
			return money(form.repairs);
		case 'otherIncome':
			return money(form.otherIncome);
		case 'closing':
			return form.closingUnit === 'pct'
				? percent(form.closingAmount, 'pct-range')
				: money(form.closingAmount);
		case 'downPct':
			return isMortgage(form) ? percent(form.downPct, 'down-range') : good(null);
		case 'rate':
			return isMortgage(form) ? rate(form.rate) : good(null);
		case 'termYears':
			return isMortgage(form) ? term(form.termYears) : good(null);
		case 'bedrooms':
			return bedrooms(form.bedrooms);
		case 'bathrooms':
			return bathrooms(form.bathrooms);
		case 'squareFeet':
			return squareFeet(form.squareFeet);
		default: {
			const line = findLine(form, key);
			return line ? parseLine(line) : good(null);
		}
	}
}

/** Validates one field (on blur and on save). Blank fields never error here. */
export function validateField(form: AnalyzerForm, key: FieldKey): FieldError | null {
	const r = parseField(form, key);
	return r.ok ? null : r.error;
}

/** "Needs {field}" name for a key: the fixed names, or an expense line's own lowercased name. */
export function fieldName(form: AnalyzerForm, key: FieldKey): string {
	if (key.startsWith('expense:')) {
		const name = findLine(form, key)?.name.trim().toLowerCase();
		return name || 'this expense line';
	}
	return FIELD_NAMES[key] ?? key;
}

// ---------------------------------------------------------------------------------------------
// Whole-form parse

const FIXED_KEYS: FieldKey[] = [
	'price',
	'rent',
	'closing',
	'repairs',
	'downPct',
	'rate',
	'termYears',
	'otherIncome',
	'bedrooms',
	'bathrooms',
	'squareFeet'
];

/** Parses the whole form: readiness, DealInputs, per-field errors and masked metrics. */
export function parseForm(form: AnalyzerForm): ParsedForm {
	const errors: ParsedForm['errors'] = {};
	const masked: ParsedForm['masked'] = {};
	const results = new Map<FieldKey, FieldParse<number>>();

	const keys: FieldKey[] = [...FIXED_KEYS, ...form.expenses.map((l) => `expense:${l.id}` as const)];
	for (const key of keys) {
		const r = parseField(form, key);
		results.set(key, r);
		if (!r.ok) errors[key] = r.error;
	}

	const price = results.get('price')!;
	const rent = results.get('rent')!;
	if (!price.ok || price.value === null || !rent.ok || rent.value === null) {
		return { ready: false, inputs: null, errors, masked };
	}

	const mask = (key: FieldKey, metrics: ImpactMetric[]) => {
		for (const m of metrics) masked[m] ??= key;
	};
	/** Valid value, blank -> fallback (no mask), invalid -> substitute and mask. */
	const value = (key: FieldKey, blank: number, substitute: number, impact: ImpactMetric[]) => {
		const r = results.get(key)!;
		if (!r.ok) {
			mask(key, impact);
			return substitute;
		}
		return r.value ?? blank;
	};

	const closingValue = value('closing', 0, Number.NaN, FIELD_IMPACT.closing);
	const closing: ClosingCosts = Number.isNaN(closingValue)
		? form.closingUnit === 'pct'
			? { unit: 'pct', bps: DEFAULT_CLOSING.unit === 'pct' ? DEFAULT_CLOSING.bps : 0 }
			: { unit: 'usd', cents: 0 }
		: form.closingUnit === 'pct'
			? { unit: 'pct', bps: closingValue }
			: { unit: 'usd', cents: closingValue };

	const repairsCents = value('repairs', 0, 0, FIELD_IMPACT.repairs);
	const otherIncomeCents = value('otherIncome', 0, 0, FIELD_IMPACT.otherIncome);

	let financing: DealInputs['financing'] = { kind: 'cash' };
	if (isMortgage(form)) {
		// A blank down payment or term has no safe meaning, so it masks like an invalid one.
		const down = results.get('downPct')!;
		if (!down.ok || down.value === null) mask('downPct', FIELD_IMPACT.downPct);
		const yrs = results.get('termYears')!;
		if (!yrs.ok || yrs.value === null) mask('termYears', FIELD_IMPACT.termYears);
		const r = results.get('rate')!;
		financing = {
			kind: 'mortgage',
			downBps: down.ok && down.value !== null ? down.value : DEFAULT_DOWN_BPS,
			// Blank or invalid rate -> null; the core reports "Needs interest rate".
			annualRatePct: r.ok ? r.value : null,
			termYears: yrs.ok && yrs.value !== null ? yrs.value : DEFAULT_TERM_YEARS
		};
	}

	const expenses: ExpenseLine[] = form.expenses.map((l) => {
		const key = `expense:${l.id}` as const;
		const r = results.get(key)!;
		if (!r.ok) mask(key, FIELD_IMPACT.expense);
		const amount = r.ok ? r.value : null;
		const { id, kind, name } = l;
		return l.unit === 'pct'
			? { id, kind, name, unit: 'pct', bps: amount }
			: { id, kind, name, unit: 'usd', cents: amount };
	});

	return {
		ready: true,
		inputs: {
			priceCents: price.value,
			closing,
			repairsCents,
			financing,
			rentCents: rent.value,
			otherIncomeCents,
			expenses
		},
		errors,
		masked
	};
}

// ---------------------------------------------------------------------------------------------
// Saved deal -> form, custom lines

/** Rebuilds the form strings from a saved deal; parseForm(inputsToForm(d)).inputs equals d.inputs. */
export function inputsToForm(d: {
	name: string;
	address: string;
	propertyType: AnalyzerForm['propertyType'] | null;
	bedrooms: number | null;
	bathrooms: number | null;
	squareFeet: number | null;
	inputs: DealInputs;
}): AnalyzerForm {
	const i = d.inputs;
	const f = i.financing;
	return {
		name: d.name,
		address: d.address,
		propertyType: d.propertyType ?? '',
		bedrooms: d.bedrooms === null ? '' : String(d.bedrooms),
		bathrooms: d.bathrooms === null ? '' : String(d.bathrooms),
		squareFeet: d.squareFeet === null ? '' : withCommas(String(d.squareFeet)),
		price: centsToText(i.priceCents),
		closingAmount:
			i.closing.unit === 'pct' ? bpsToText(i.closing.bps) : centsToText(i.closing.cents),
		closingUnit: i.closing.unit,
		repairs: centsToText(i.repairsCents),
		financing: f.kind,
		downPct: bpsToText(f.kind === 'mortgage' ? f.downBps : DEFAULT_DOWN_BPS),
		rate: f.kind === 'mortgage' && f.annualRatePct !== null ? String(f.annualRatePct) : '',
		termYears: String(f.kind === 'mortgage' ? f.termYears : DEFAULT_TERM_YEARS),
		rent: centsToText(i.rentCents),
		otherIncome: centsToText(i.otherIncomeCents),
		expenses: i.expenses.map(lineToForm)
	};
}

const customCount = (form: AnalyzerForm) => form.expenses.filter((l) => l.kind === 'custom').length;

/** True when another custom line fits under MAX_CUSTOM_LINES. */
export function canAddCustomLine(form: AnalyzerForm): boolean {
	return customCount(form) < MAX_CUSTOM_LINES;
}

/** Appends a blank "$ per month" custom line; at the cap it returns the same form. */
export function addCustomLine(form: AnalyzerForm): AnalyzerForm {
	if (!canAddCustomLine(form)) return form;
	const next = form.expenses.reduce((max, l) => {
		const m = /^custom-(\d+)$/.exec(l.id);
		return m ? Math.max(max, Number(m[1])) : max;
	}, 0);
	const line: ExpenseLineForm = {
		id: `custom-${next + 1}`,
		kind: 'custom',
		name: '',
		unit: 'usd',
		amount: ''
	};
	return { ...form, expenses: [...form.expenses, line] };
}

/** Removes a custom line. Default lines can't be removed (returns the same form). */
export function removeLine(form: AnalyzerForm, id: string): AnalyzerForm {
	const line = form.expenses.find((l) => l.id === id);
	if (!line || line.kind !== 'custom') return form;
	return { ...form, expenses: form.expenses.filter((l) => l.id !== id) };
}
