// Analyzer page state (07-12): derived results, unsaved tracking and the autosave effect. The
// module must not reach the data layer: manual entry is 0 RentCast calls by construction.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { REFERENCE_CASES } from '@tran/core/finance';
import { AnalyzerPageState } from './analyzer-page.svelte';
import { sampleDealCopy } from './sample-deal';

const A = REFERENCE_CASES.find((c) => c.id === 'A')!;

describe('AnalyzerPageState', () => {
	it('analysis is null until price and rent parse, then recomputes synchronously', () => {
		const s = new AnalyzerPageState();
		expect(s.analysis).toBeNull();
		s.form.price = '200,000';
		expect(s.analysis).toBeNull();
		s.form.rent = '2000';
		expect(s.analysis).not.toBeNull();
		const { form } = sampleDealCopy();
		s.load(form);
		expect(s.analysis!.cashFlowMonthly).toBe(A.expected.ints.cashFlowMonthly);
		s.form.expenses[1].amount = '10';
		expect(s.analysis!.cashFlowMonthly).toBe(18_352 - 3_800);
	});

	it('unsaved: typing on a fresh form, cleared by markSaved, set again by an edit', () => {
		const s = new AnalyzerPageState();
		expect(s.unsaved).toBe(false);
		s.form.name = 'x';
		expect(s.unsaved).toBe(true);
		s.markSaved({ id: 'd1', updatedAt: '2026-10-15T12:00:00.000Z' });
		expect(s.unsaved).toBe(false);
		expect(s.dealId).toBe('d1');
		s.form.rent = '5';
		expect(s.unsaved).toBe(true);
		s.reset();
		expect([s.unsaved, s.dealId, s.savedSnapshot]).toEqual([false, null, null]);
	});

	it('validate shows one field error on blur; validateAll shows every error', () => {
		const s = new AnalyzerPageState();
		s.form.price = 'abc';
		s.form.downPct = '120';
		expect(s.shownErrors).toEqual({});
		s.validate('price');
		expect(s.shownErrors).toEqual({ price: 'not-a-number' });
		expect(s.validateAll()).toBe(false);
		expect(s.shownErrors).toEqual({ price: 'not-a-number', downPct: 'down-range' });
		s.form.price = '1';
		s.validate('price');
		expect(s.shownErrors).toEqual({ downPct: 'down-range' });
	});

	// The autosave $effect itself only runs in a browser (the node project uses Svelte's server
	// build); analyze.spec.ts "draft survives reload" proves it end to end.
	it('draft() is plain, structured-cloneable data', () => {
		const s = new AnalyzerPageState();
		s.load(sampleDealCopy().form, sampleDealCopy().sources);
		s.form.rent = '2,100';
		const d = s.draft();
		expect(d.form.rent).toBe('2,100');
		expect(structuredClone(d)).toEqual(d);
		expect(d).toMatchObject({ dealId: null, savedSnapshot: null });
	});

	it('imports no data gateway or port module', () => {
		const src = readFileSync(new URL('./analyzer-page.svelte.ts', import.meta.url), 'utf8');
		expect(src).not.toMatch(/investor-port|\$lib\/data/);
	});
});
