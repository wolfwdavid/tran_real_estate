import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { analyze } from './analyze.js';
import { REFERENCE_CASES } from './reference-cases.js';
import {
	COMPARE_ROWS,
	MAX_COMPARE,
	MIN_COMPARE,
	bestInRow,
	buildComparison,
	type CompareRow,
	type CompareRowKey
} from './compare.js';

const deal = (id: string) => {
	const c = REFERENCE_CASES.find((r) => r.id === id);
	if (!c) throw new Error(`no case ${id}`);
	return { inputs: c.inputs, analysis: analyze(c.inputs) };
};

const row = (rows: CompareRow[], key: CompareRowKey): CompareRow => {
	const r = rows.find((x) => x.key === key);
	if (!r) throw new Error(`no row ${key}`);
	return r;
};

describe('COMPARE_ROWS', () => {
	it('lists the UI-SPEC rows in order with each direction', () => {
		expect(COMPARE_ROWS.map((r) => [r.key, r.label, r.direction])).toEqual([
			['price', 'Purchase price', null],
			['rent', 'Monthly rent', null],
			['cashNeeded', 'Total cash needed', 'min'],
			['cashFlow', 'Monthly cash flow', 'max'],
			['coc', 'Cash-on-cash return', 'max'],
			['capRate', 'Cap rate', 'max'],
			['noiAnnual', 'Net operating income (annual)', 'max'],
			['dscr', 'DSCR', 'max'],
			['grm', 'GRM', 'min'],
			['rentToPrice', '1% rule (rent-to-price)', 'max']
		]);
		expect(MIN_COMPARE).toBe(2);
		expect(MAX_COMPARE).toBe(3);
	});
});

describe('bestInRow', () => {
	it('marks the extreme by direction, with ties', () => {
		expect(bestInRow([3, 5, 5], 'max')).toEqual([1, 2]);
		expect(bestInRow([3, 5, 1], 'min')).toEqual([2]);
		expect(bestInRow([3, 5, 1], 'max')).toEqual([1]);
		expect(bestInRow([3, 1, 1], 'min')).toEqual([1, 2]);
	});

	it('marks nothing when all values are equal or fewer than 2 values exist', () => {
		expect(bestInRow([4, 4, 4], 'max')).toEqual([]);
		expect(bestInRow([4, 4], 'min')).toEqual([]);
		expect(bestInRow([null, 7, null], 'max')).toEqual([]);
		expect(bestInRow([null, null], 'min')).toEqual([]);
		expect(bestInRow([], 'max')).toEqual([]);
	});

	it('never marks an unavailable value', () => {
		expect(bestInRow([null, 7, 2], 'max')).toEqual([1]);
		expect(bestInRow([null, 7, 2], 'min')).toEqual([2]);
		expect(bestInRow([-1, null, -5], 'max')).toEqual([0]);
	});

	it('treats float values within 1e-12 as ties', () => {
		const a = 20_000_000 / 2_400_000;
		const b = (10_000_000 * 2) / (1_200_000 * 2) + 1e-15;
		expect(bestInRow([a, 13.3, b], 'min')).toEqual([0, 2]);
		expect(bestInRow([0.1 + 0.2, 0.3, 0.1], 'max')).toEqual([0, 1]);
	});

	it('property: marks are non-null, at the extreme, and flip with negation', () => {
		const v = fc.option(fc.integer({ min: -1000, max: 1000 }), { nil: null });
		fc.assert(
			fc.property(fc.array(v, { maxLength: 3 }), fc.constantFrom('max', 'min'), (vals, dir) => {
				const marked = bestInRow(vals, dir as 'max' | 'min');
				const present = vals.filter((x): x is number => x !== null);
				for (const i of marked) expect(vals[i]).not.toBeNull();
				if (marked.length > 0) {
					const ext = dir === 'max' ? Math.max(...present) : Math.min(...present);
					for (const i of marked) expect(vals[i]).toBe(ext);
					expect(marked.length).toBe(present.filter((x) => x === ext).length);
					expect(marked.length).toBeLessThan(present.length);
				}
				const flipped = vals.map((x) => (x === null ? null : -x));
				const other = dir === 'max' ? 'min' : 'max';
				expect(bestInRow(flipped, other)).toEqual(marked);
			})
		);
	});
});

describe('buildComparison', () => {
	const rows = buildComparison([deal('A'), deal('D'), deal('E')]);

	it('marks A, D, E by each metric direction', () => {
		expect(row(rows, 'cashFlow')).toMatchObject({ marked: [0], marker: 'Highest' });
		expect(row(rows, 'cashNeeded')).toMatchObject({ marked: [2], marker: 'Lowest' });
		expect(row(rows, 'dscr')).toMatchObject({ marked: [2], marker: 'Highest' });
		expect(row(rows, 'coc')).toMatchObject({ marked: [2], marker: 'Highest' });
		expect(row(rows, 'capRate')).toMatchObject({ marked: [0], marker: 'Highest' });
		expect(row(rows, 'noiAnnual')).toMatchObject({ marked: [0], marker: 'Highest' });
		expect(row(rows, 'grm')).toMatchObject({ marked: [0, 2], marker: 'Lowest' });
		expect(row(rows, 'rentToPrice')).toMatchObject({ marked: [0, 2], marker: 'Highest' });
		expect(row(rows, 'price')).toMatchObject({ marked: [], marker: null });
		expect(row(rows, 'rent')).toMatchObject({ marked: [], marker: null });
	});

	it('takes values only from inputs and analysis', () => {
		const d = deal('A');
		expect(row(rows, 'price').values[0]).toBe(d.inputs.priceCents);
		expect(row(rows, 'rent').values[0]).toBe(d.inputs.rentCents);
		expect(row(rows, 'cashNeeded').values[0]).toBe(d.analysis.cashInvestedCents);
		expect(row(rows, 'cashFlow').values[0]).toBe(d.analysis.cashFlowMonthly);
		expect(row(rows, 'noiAnnual').values[0]).toBe(d.analysis.noiAnnual);
		expect(row(rows, 'coc').values[0]).toBe(d.analysis.cocPct);
		expect(row(rows, 'capRate').values[0]).toBe(d.analysis.capRatePct);
		expect(row(rows, 'dscr').values[0]).toBe(d.analysis.dscr);
		expect(row(rows, 'grm').values[0]).toBe(d.analysis.grm);
		expect(row(rows, 'rentToPrice').values[0]).toBe(d.analysis.rentToPricePct);
	});

	it('formats each value', () => {
		expect(row(rows, 'price').display[0]).toBe('$200,000');
		expect(row(rows, 'rent').display[0]).toBe('$2,000');
		expect(row(rows, 'cashNeeded').display[0]).toBe('$46,000');
		expect(row(rows, 'cashFlow').display[0]).toBe('$184');
		expect(row(rows, 'cashFlow').display[1]).toBe('−$1,150');
		expect(row(rows, 'coc').display[0]).toBe('4.8%');
		expect(row(rows, 'capRate').display[0]).toBe('7.5%');
		expect(row(rows, 'noiAnnual').display[0]).toBe('$14,976');
		expect(row(rows, 'dscr').display[0]).toBe('1.17');
		expect(row(rows, 'grm').display[0]).toBe('8.3');
		expect(row(rows, 'rentToPrice').display[0]).toBe('1.00%');
	});

	it('shows an all-cash DSCR as unavailable and never marks it', () => {
		const r = row(buildComparison([deal('A'), deal('B')]), 'dscr');
		expect(r.values[1]).toBeNull();
		expect(r.display[1]).toBe('—');
		expect(r.marked).toEqual([]);
		const r3 = row(buildComparison([deal('A'), deal('B'), deal('E')]), 'dscr');
		expect(r3.marked).toEqual([2]);
	});

	it('rejects fewer than 2 or more than 3 deals', () => {
		expect(() => buildComparison([deal('A')])).toThrow(RangeError);
		expect(() => buildComparison([])).toThrow(RangeError);
		expect(() => buildComparison([deal('A'), deal('B'), deal('D'), deal('E')])).toThrow(RangeError);
		expect(() => buildComparison([deal('A'), deal('B')])).not.toThrow();
	});

	it('never marks rows when all values are equal', () => {
		const out = buildComparison([deal('A'), deal('A')]);
		for (const r of out) expect(r.marked).toEqual([]);
	});
});
