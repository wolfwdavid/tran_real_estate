// Analyzer form model (07-10, INV-01): raw strings in, DealInputs out. Validation copy is UI-SPEC
// verbatim; an invalid optional field masks only the metrics that depend on it.
import { describe, expect, test } from 'vitest';
import {
	DEFAULT_DOWN_BPS,
	DEFAULT_TERM_YEARS,
	MAX_CUSTOM_LINES,
	REFERENCE_CASES,
	analyze
} from '@tran/core/finance';
import {
	FIELD_ERROR_COPY,
	FIELD_IMPACT,
	FIELD_NAMES,
	addCustomLine,
	defaultForm,
	fieldName,
	formatOnBlur,
	inputsToForm,
	parseForm,
	removeLine,
	validateField,
	type AnalyzerForm,
	type FieldKey
} from './form-model';

const ready = (patch: Partial<AnalyzerForm> = {}): AnalyzerForm => ({
	...defaultForm(),
	price: '$200,000',
	rent: '2000',
	...patch
});

const withExpense = (form: AnalyzerForm, id: string, amount: string): AnalyzerForm => ({
	...form,
	expenses: form.expenses.map((l) => (l.id === id ? { ...l, amount } : l))
});

const DOWN_IMPACT = ['loan', 'payment', 'cashFlow', 'coc', 'dscr', 'cashNeeded'] as const;
const EXPENSE_IMPACT = ['noi', 'cashFlow', 'coc', 'capRate', 'dscr'] as const;

describe('defaultForm', () => {
	test('UI-SPEC defaults', () => {
		const f = defaultForm();
		expect(f).toMatchObject({
			closingAmount: '3',
			closingUnit: 'pct',
			downPct: '25',
			termYears: '30',
			rate: '',
			repairs: '0',
			otherIncome: '0',
			price: '',
			rent: '',
			financing: 'mortgage',
			propertyType: ''
		});
		expect(f.expenses.map((l) => l.amount)).toEqual(['5', '8', '5', '5', '', '', '', '']);
		expect(f.expenses.map((l) => l.unit)).toEqual([
			'pct',
			'pct',
			'pct',
			'pct',
			'usd',
			'usd',
			'usd',
			'usd'
		]);
	});

	test('returns fresh copies', () => {
		const a = defaultForm();
		a.expenses[0].amount = '9';
		expect(defaultForm().expenses[0].amount).toBe('5');
	});
});

describe('FIELD_ERROR_COPY / FIELD_NAMES / FIELD_IMPACT', () => {
	test('validation copy is verbatim', () => {
		expect(FIELD_ERROR_COPY).toEqual({
			'not-a-number': 'Enter a number, like 250000.',
			negative: 'Use 0 or more.',
			'down-range': 'Use a percent from 0 to 100.',
			'rate-range': 'Use a rate from 0 to 25%.',
			'term-range': 'Use a term from 1 to 40 years.',
			'pct-range': 'Use a percent from 0 to 100.',
			bedrooms: 'Use a whole number from 0 to 20.'
		});
	});

	test('lowercase field names for "Needs {field}"', () => {
		expect(FIELD_NAMES).toMatchObject({
			price: 'purchase price',
			rent: 'monthly rent',
			closing: 'closing costs',
			repairs: 'repairs before renting',
			downPct: 'down payment',
			rate: 'interest rate',
			termYears: 'loan term',
			otherIncome: 'other monthly income'
		});
		const f = defaultForm();
		expect(fieldName(f, 'expense:tax')).toBe('property tax');
		expect(fieldName(f, 'downPct')).toBe('down payment');
	});

	test('impact map', () => {
		expect(FIELD_IMPACT.closing).toEqual(['coc', 'cashNeeded']);
		expect(FIELD_IMPACT.repairs).toEqual(['coc', 'cashNeeded']);
		expect(FIELD_IMPACT.downPct).toEqual([...DOWN_IMPACT]);
		expect(FIELD_IMPACT.termYears).toEqual([...DOWN_IMPACT]);
		expect(FIELD_IMPACT.otherIncome).toEqual([...EXPENSE_IMPACT]);
		expect(FIELD_IMPACT.expense).toEqual([...EXPENSE_IMPACT]);
	});
});

describe('validateField', () => {
	const f = (patch: Partial<AnalyzerForm>) => ({ ...defaultForm(), ...patch });

	test.each<[Partial<AnalyzerForm>, FieldKey, string | null]>([
		[{ price: 'abc' }, 'price', 'not-a-number'],
		[{ price: '-5' }, 'price', 'negative'],
		[{ price: '250,000' }, 'price', null],
		[{ price: '$250,000' }, 'price', null],
		[{ price: '' }, 'price', null],
		[{ rent: '1.234' }, 'rent', 'not-a-number'],
		[{ repairs: '-1' }, 'repairs', 'negative'],
		[{ otherIncome: 'x' }, 'otherIncome', 'not-a-number'],
		[{ downPct: '120' }, 'downPct', 'down-range'],
		[{ downPct: '100' }, 'downPct', null],
		[{ downPct: '0' }, 'downPct', null],
		[{ downPct: '-1' }, 'downPct', 'negative'],
		[{ downPct: 'abc' }, 'downPct', 'not-a-number'],
		[{ rate: '30' }, 'rate', 'rate-range'],
		[{ rate: '25' }, 'rate', null],
		[{ rate: '25.001' }, 'rate', 'rate-range'],
		[{ rate: '6.875' }, 'rate', null],
		[{ rate: '' }, 'rate', null],
		[{ termYears: '0' }, 'termYears', 'term-range'],
		[{ termYears: '2.5' }, 'termYears', 'term-range'],
		[{ termYears: '41' }, 'termYears', 'term-range'],
		[{ termYears: '1' }, 'termYears', null],
		[{ termYears: '40' }, 'termYears', null],
		[{ termYears: 'ten' }, 'termYears', 'not-a-number'],
		[{ closingAmount: '101' }, 'closing', 'pct-range'],
		[{ closingAmount: '100' }, 'closing', null],
		[{ closingAmount: '6,000', closingUnit: 'usd' }, 'closing', null],
		[{ closingAmount: '-6', closingUnit: 'usd' }, 'closing', 'negative'],
		[{ bedrooms: '2.5' }, 'bedrooms', 'bedrooms'],
		[{ bedrooms: '21' }, 'bedrooms', 'bedrooms'],
		[{ bedrooms: '20' }, 'bedrooms', null],
		[{ bedrooms: '0' }, 'bedrooms', null],
		[{ bedrooms: '' }, 'bedrooms', null],
		[{ bathrooms: '2.5' }, 'bathrooms', null],
		[{ bathrooms: 'two' }, 'bathrooms', 'not-a-number'],
		[{ bathrooms: '-1' }, 'bathrooms', 'negative'],
		[{ squareFeet: '1,450' }, 'squareFeet', null],
		[{ squareFeet: '14.5' }, 'squareFeet', 'not-a-number'],
		[{ squareFeet: '' }, 'squareFeet', null]
	])('%o %s -> %s', (patch, key, expected) => {
		expect(validateField(f(patch), key)).toBe(expected);
	});

	test('expense lines: percent range and dollar parsing', () => {
		expect(validateField(withExpense(defaultForm(), 'vacancy', '150'), 'expense:vacancy')).toBe(
			'pct-range'
		);
		expect(validateField(withExpense(defaultForm(), 'vacancy', '100'), 'expense:vacancy')).toBe(
			null
		);
		expect(validateField(withExpense(defaultForm(), 'tax', 'abc'), 'expense:tax')).toBe(
			'not-a-number'
		);
		expect(validateField(withExpense(defaultForm(), 'tax', '-2'), 'expense:tax')).toBe('negative');
		expect(validateField(withExpense(defaultForm(), 'tax', '$250'), 'expense:tax')).toBe(null);
		expect(validateField(defaultForm(), 'expense:nope')).toBe(null);
	});

	test('all cash ignores down payment, rate and term', () => {
		const cash = f({ financing: 'cash', downPct: 'abc', rate: '99', termYears: '0' });
		expect(validateField(cash, 'downPct')).toBe(null);
		expect(validateField(cash, 'rate')).toBe(null);
		expect(validateField(cash, 'termYears')).toBe(null);
	});
});

describe('parseForm', () => {
	test('defaults alone are not ready', () => {
		const p = parseForm(defaultForm());
		expect(p.ready).toBe(false);
		expect(p.inputs).toBeNull();
		expect(p.errors).toEqual({});
	});

	test('price and rent make it ready', () => {
		const p = parseForm(ready());
		expect(p.ready).toBe(true);
		expect(p.errors).toEqual({});
		expect(p.masked).toEqual({});
		const i = p.inputs!;
		expect(i.priceCents).toBe(20_000_000);
		expect(i.rentCents).toBe(200_000);
		expect(i.closing).toEqual({ unit: 'pct', bps: 300 });
		expect(i.repairsCents).toBe(0);
		expect(i.otherIncomeCents).toBe(0);
		expect(i.financing).toEqual({
			kind: 'mortgage',
			downBps: 2500,
			annualRatePct: null,
			termYears: 30
		});
		const byId = Object.fromEntries(i.expenses.map((l) => [l.id, l]));
		expect(byId.vacancy).toMatchObject({ unit: 'pct', bps: 500 });
		expect(byId.management).toMatchObject({ unit: 'pct', bps: 800 });
		expect(byId.tax).toMatchObject({ unit: 'usd', cents: null });
		expect(byId.insurance).toMatchObject({ unit: 'usd', cents: null });
		expect(byId.hoa).toMatchObject({ unit: 'usd', cents: null });
		expect(byId.utilities).toMatchObject({ unit: 'usd', cents: null });
		// Core treats blank HOA/utilities as 0 and only flags tax and insurance as missing.
		expect(analyze(i).missing).toEqual(['property-tax', 'insurance', 'interest-rate']);
	});

	test.each<Partial<AnalyzerForm>>([{ price: '' }, { rent: '' }, { price: 'abc' }, { rent: '-1' }])(
		'required field blank or invalid -> not ready (%o)',
		(patch) => {
			const p = parseForm(ready(patch));
			expect(p.ready).toBe(false);
			expect(p.inputs).toBeNull();
		}
	);

	test('invalid price is reported even when not ready', () => {
		expect(parseForm(ready({ price: 'abc' })).errors).toEqual({ price: 'not-a-number' });
	});

	test('all cash ignores down, rate and term entirely', () => {
		const p = parseForm(ready({ financing: 'cash', downPct: 'abc', rate: '99', termYears: '' }));
		expect(p.inputs!.financing).toEqual({ kind: 'cash' });
		expect(p.errors).toEqual({});
		expect(p.masked).toEqual({});
	});

	test('rate parses to a percent number; invalid rate leaves it null with an error', () => {
		expect(parseForm(ready({ rate: '6.875%' })).inputs!.financing).toMatchObject({
			annualRatePct: 6.875
		});
		const bad = parseForm(ready({ rate: '30' }));
		expect(bad.errors.rate).toBe('rate-range');
		expect(bad.inputs!.financing).toMatchObject({ annualRatePct: null });
	});

	test('invalid down payment masks only its dependent metrics', () => {
		const p = parseForm(ready({ downPct: 'abc', rate: '7' }));
		expect(p.ready).toBe(true);
		expect(p.errors).toEqual({ downPct: 'not-a-number' });
		expect(p.masked).toEqual(Object.fromEntries(DOWN_IMPACT.map((m) => [m, 'downPct'])));
		expect(p.inputs!.financing).toMatchObject({ downBps: DEFAULT_DOWN_BPS });
		expect(p.masked.capRate).toBeUndefined();
		expect(p.masked.noi).toBeUndefined();
	});

	test('blank down payment or term masks without an error', () => {
		const d = parseForm(ready({ downPct: '' }));
		expect(d.errors).toEqual({});
		expect(d.masked.loan).toBe('downPct');
		const t = parseForm(ready({ termYears: '' }));
		expect(t.errors).toEqual({});
		expect(t.masked.payment).toBe('termYears');
		expect(t.inputs!.financing).toMatchObject({ termYears: DEFAULT_TERM_YEARS });
	});

	test('invalid term masks the financing metrics', () => {
		const p = parseForm(ready({ termYears: '2.5' }));
		expect(p.errors).toEqual({ termYears: 'term-range' });
		expect(p.masked).toEqual(Object.fromEntries(DOWN_IMPACT.map((m) => [m, 'termYears'])));
	});

	test('invalid expense masks the income-side metrics with its key', () => {
		const p = parseForm(withExpense(ready(), 'maintenance', '150'));
		expect(p.errors).toEqual({ 'expense:maintenance': 'pct-range' });
		expect(p.masked).toEqual(
			Object.fromEntries(EXPENSE_IMPACT.map((m) => [m, 'expense:maintenance']))
		);
		expect(p.masked.loan).toBeUndefined();
		const line = p.inputs!.expenses.find((l) => l.id === 'maintenance')!;
		expect(line).toMatchObject({ unit: 'pct', bps: null });
	});

	test('invalid closing / repairs / other income substitute and mask', () => {
		const c = parseForm(ready({ closingAmount: 'abc' }));
		expect(c.errors).toEqual({ closing: 'not-a-number' });
		expect(c.masked).toEqual({ coc: 'closing', cashNeeded: 'closing' });
		expect(c.inputs!.closing).toEqual({ unit: 'pct', bps: 300 });
		const cu = parseForm(ready({ closingAmount: 'abc', closingUnit: 'usd' }));
		expect(cu.inputs!.closing).toEqual({ unit: 'usd', cents: 0 });
		const r = parseForm(ready({ repairs: '-1' }));
		expect(r.masked).toEqual({ coc: 'repairs', cashNeeded: 'repairs' });
		expect(r.inputs!.repairsCents).toBe(0);
		const o = parseForm(ready({ otherIncome: 'x' }));
		expect(o.masked).toEqual(Object.fromEntries(EXPENSE_IMPACT.map((m) => [m, 'otherIncome'])));
		expect(o.inputs!.otherIncomeCents).toBe(0);
	});

	test('the first invalid field wins a shared metric', () => {
		const p = parseForm(ready({ closingAmount: 'x', downPct: 'x' }));
		expect(p.masked.coc).toBe('closing');
		expect(p.masked.cashNeeded).toBe('closing');
		expect(p.masked.loan).toBe('downPct');
	});

	test('property metadata errors never mask money metrics', () => {
		const p = parseForm(ready({ bedrooms: '2.5', squareFeet: 'x' }));
		expect(p.ready).toBe(true);
		expect(p.errors).toEqual({ bedrooms: 'bedrooms', squareFeet: 'not-a-number' });
		expect(p.masked).toEqual({});
	});

	test('blank closing, repairs and other income count as 0 without masking', () => {
		const p = parseForm(ready({ closingAmount: '', repairs: '', otherIncome: '' }));
		expect(p.masked).toEqual({});
		expect(p.inputs!.closing).toEqual({ unit: 'pct', bps: 0 });
		expect(p.inputs!.repairsCents).toBe(0);
	});
});

describe('custom lines', () => {
	test('add appends a blank $ per month custom line with a unique id', () => {
		const a = addCustomLine(defaultForm());
		const b = addCustomLine(a);
		const added = b.expenses.slice(8);
		expect(added).toHaveLength(2);
		expect(added[0]).toMatchObject({ kind: 'custom', name: '', unit: 'usd', amount: '' });
		expect(new Set(b.expenses.map((l) => l.id)).size).toBe(10);
	});

	test(`caps at ${MAX_CUSTOM_LINES} custom lines`, () => {
		let f = defaultForm();
		for (let i = 0; i < MAX_CUSTOM_LINES; i++) f = addCustomLine(f);
		expect(f.expenses).toHaveLength(8 + MAX_CUSTOM_LINES);
		expect(addCustomLine(f)).toBe(f);
	});

	test('remove deletes custom lines only', () => {
		const f = addCustomLine(defaultForm());
		const id = f.expenses[8].id;
		expect(removeLine(f, id).expenses).toHaveLength(8);
		expect(removeLine(f, 'tax')).toBe(f);
		// ids stay unique after a removal
		const g = addCustomLine(addCustomLine(removeLine(addCustomLine(f), id)));
		expect(new Set(g.expenses.map((l) => l.id)).size).toBe(g.expenses.length);
	});

	test('custom line names drive "Needs {field}"', () => {
		const f = addCustomLine(defaultForm());
		const id = f.expenses[8].id;
		f.expenses[8].name = 'Lawn Care';
		expect(fieldName(f, `expense:${id}`)).toBe('lawn care');
		f.expenses[8].name = '';
		expect(fieldName(f, `expense:${id}`)).toBe('this expense line');
	});
});

describe('inputsToForm round trip', () => {
	test.each(REFERENCE_CASES.map((c) => [c.id, c] as const))('case %s', (_id, c) => {
		const form = inputsToForm({
			name: c.title,
			address: '1 Example St',
			propertyType: 'single-family',
			bedrooms: 3,
			bathrooms: 2.5,
			squareFeet: 1450,
			inputs: c.inputs
		});
		const p = parseForm(form);
		expect(p.errors).toEqual({});
		expect(p.masked).toEqual({});
		expect(p.inputs).toEqual(c.inputs);
		expect(form).toMatchObject({ bedrooms: '3', bathrooms: '2.5', squareFeet: '1,450' });
	});

	test('reference case A carries its exact strings', () => {
		const a = REFERENCE_CASES.find((c) => c.id === 'A')!;
		const form = inputsToForm({
			name: 'A',
			address: '',
			propertyType: null,
			bedrooms: null,
			bathrooms: null,
			squareFeet: null,
			inputs: a.inputs
		});
		expect(form).toMatchObject({
			price: '200,000',
			rent: '2,000',
			closingAmount: '6,000',
			closingUnit: 'usd',
			downPct: '20',
			rate: '7',
			termYears: '30',
			propertyType: '',
			bedrooms: ''
		});
	});

	test('cash deals keep the mortgage defaults for a later switch', () => {
		const b = REFERENCE_CASES.find((c) => c.inputs.financing.kind === 'cash')!;
		const form = inputsToForm({
			name: '',
			address: '',
			propertyType: null,
			bedrooms: null,
			bathrooms: null,
			squareFeet: null,
			inputs: b.inputs
		});
		expect(form).toMatchObject({ financing: 'cash', downPct: '25', rate: '', termYears: '30' });
	});

	test('custom lines and cent amounts survive', () => {
		const base = REFERENCE_CASES[0].inputs;
		const inputs = {
			...base,
			repairsCents: 123_456,
			expenses: [
				...base.expenses,
				{
					id: 'custom-1',
					kind: 'custom' as const,
					name: 'Lawn',
					unit: 'usd' as const,
					cents: 4_050
				},
				{ id: 'custom-2', kind: 'custom' as const, name: 'Pest', unit: 'pct' as const, bps: 125 }
			]
		};
		const form = inputsToForm({
			name: '',
			address: '',
			propertyType: null,
			bedrooms: null,
			bathrooms: null,
			squareFeet: null,
			inputs
		});
		expect(form.repairs).toBe('1,234.56');
		expect(form.expenses.at(-2)!.amount).toBe('40.50');
		expect(form.expenses.at(-1)!.amount).toBe('1.25');
		expect(parseForm(form).inputs).toEqual(inputs);
	});
});

describe('formatOnBlur', () => {
	test.each<['money' | 'percent' | 'number', string, string]>([
		['money', '250000', '250,000'],
		['money', '$1234.5', '1,234.50'],
		['money', '$250,000', '250,000'],
		['money', ' 1000.00 ', '1,000'],
		['money', '0', '0'],
		['money', '007', '7'],
		['money', 'abc', 'abc'],
		['money', '-5', '-5'],
		['money', '', ''],
		['percent', '5.50', '5.5'],
		['percent', '7.125%', '7.125'],
		['percent', '08', '8'],
		['percent', '5.00', '5'],
		['percent', 'x', 'x'],
		['number', '30', '30'],
		['number', '1450', '1,450'],
		['number', '2.50', '2.5'],
		['number', 'two', 'two']
	])('%s %o -> %o', (kind, raw, out) => {
		expect(formatOnBlur(kind, raw)).toBe(out);
	});
});
