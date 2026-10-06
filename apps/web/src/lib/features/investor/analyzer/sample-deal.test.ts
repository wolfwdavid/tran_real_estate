// "Try a sample deal" (07-12): reference case A's numbers on a fictional address taken from the
// Phase 4 sale-listing fixtures, so the sample's results are known exactly.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { analyze, REFERENCE_CASES } from '@tran/core/finance';
import { parseForm } from './form-model';
import { SAMPLE_DEAL } from './sample-deal';

const A = REFERENCE_CASES.find((c) => c.id === 'A')!;

describe('SAMPLE_DEAL', () => {
	it('parses to inputs whose analysis equals reference case A', () => {
		const parsed = parseForm(SAMPLE_DEAL.form);
		expect(parsed.ready).toBe(true);
		expect(parsed.errors).toEqual({});
		expect(parsed.masked).toEqual({});
		const r = analyze(parsed.inputs!);
		expect(r.noiMonthly).toBe(124_800);
		expect(r.cashFlowMonthly).toBe(18_352);
		expect(r.noiMonthly).toBe(A.expected.ints.noiMonthly);
		expect(r.cashFlowMonthly).toBe(A.expected.ints.cashFlowMonthly);
		expect(r.cashInvestedCents).toBe(A.expected.ints.cashInvestedCents);
		expect(r.missing).toEqual([]);
	});

	it('is named "Sample deal" and uses an address from the Phase 4 sale fixtures', () => {
		expect(SAMPLE_DEAL.form.name).toBe('Sample deal');
		const sales = JSON.parse(
			readFileSync(new URL('../../../data/fixtures/sales.json', import.meta.url), 'utf8')
		) as { formattedAddress: string }[];
		expect(sales.map((s) => s.formattedAddress)).toContain(SAMPLE_DEAL.form.address);
	});

	it('marks price and rent as sample data', () => {
		expect(SAMPLE_DEAL.sources.price).toEqual({ source: 'sample' });
		expect(SAMPLE_DEAL.sources.rent).toEqual({ source: 'sample' });
	});

	it('is frozen (callers clone it before editing)', () => {
		expect(Object.isFrozen(SAMPLE_DEAL)).toBe(true);
		expect(Object.isFrozen(SAMPLE_DEAL.form.expenses)).toBe(true);
	});
});
