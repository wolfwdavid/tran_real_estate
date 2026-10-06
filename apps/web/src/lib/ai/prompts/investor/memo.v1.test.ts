import { describe, expect, it } from 'vitest';
import { REFERENCE_CASES, analyze, buildMemoFacts, sampleMemo } from '@tran/core/finance';
import { checkFairHousing } from '@tran/core/fair-housing';
import { checkNumbers } from '@tran/core/numbers';
import type { DealRecord } from '$lib/features/investor/deals/schema';
import { memoFactsForDeal } from '$lib/features/investor/memo/memo-facts-for-deal';
import { HOUSING_COPY_GUARDRAIL } from '../guardrail.js';
import { buildPrompt, getPrompt } from '../registry.js';
import { INVESTOR_MEMO_PROMPT_ID, investorMemoV1, type InvestorMemoInputs } from './memo.v1.js';

const A = REFERENCE_CASES.find((c) => c.id === 'A')!;

function dealFrom(inputs = A.inputs, o: Partial<DealRecord> = {}): DealRecord {
	return {
		id: 'deal-a',
		createdAt: '2026-10-01T00:00:00.000Z',
		updatedAt: '2026-10-01T00:00:00.000Z',
		schemaVersion: 1,
		analyzerVersion: 1,
		name: 'Gildenreach duplex',
		address: '5090 Gildenreach Blvd, Harlow Springs, OK 74201',
		propertyType: 'single-family',
		bedrooms: 2,
		bathrooms: 1,
		squareFeet: 1000,
		inputs,
		sources: { price: { source: 'sample' }, rent: { source: 'sample' } },
		...o
	} as DealRecord;
}

function memoInputs(deal: DealRecord, notes = ''): InvestorMemoInputs {
	const facts = memoFactsForDeal(deal, notes);
	return { factsText: facts.factsText, notes: facts.notes, facts };
}

describe('investor/memo.v1', () => {
	it('is registered with version 1, no client data and the housing guardrail', async () => {
		const def = getPrompt(INVESTOR_MEMO_PROMPT_ID);
		expect(INVESTOR_MEMO_PROMPT_ID).toBe('investor/memo.v1');
		expect(def.version).toBe(1);
		expect(def.containsClientData).toBe(false);
		expect(def.housingCopy).toBe(true);
		const built = await buildPrompt(INVESTOR_MEMO_PROMPT_ID, memoInputs(dealFrom()));
		expect(built.system.startsWith(HOUSING_COPY_GUARDRAIL.text)).toBe(true);
		expect(built.system).toContain(
			'Use only numbers that appear in FACTS or NOTES, copied exactly as written.'
		);
		expect(built.system).toContain('Do not recommend buying or selling');
	});

	it('builds a user message from FACTS and NOTES only', () => {
		const i = memoInputs(dealFrom(), 'Plan to repaint before renting.');
		const b = investorMemoV1.build(i);
		expect(b.user).toBe(
			`FACTS:\n${i.factsText}\n\nNOTES FROM THE USER:\nPlan to repaint before renting.`
		);
		expect(b.known).toEqual([]);
		const empty = investorMemoV1.build(memoInputs(dealFrom()));
		expect(empty.user.endsWith('NOTES FROM THE USER:\n(none)')).toBe(true);
	});

	it('never carries other data fields, even when the facts object holds more', () => {
		const i = memoInputs(dealFrom());
		const tampered = {
			...i,
			facts: { ...i.facts, factsText: 'SECRET 123.456789', notes: 'SECRET' }
		};
		const b = investorMemoV1.build(tampered);
		expect(b.user).not.toContain('SECRET');
		expect(b.system).not.toContain('SECRET');
	});

	it('case A: the sent text has the formatted cash flow and no raw floats', async () => {
		const built = await buildPrompt(INVESTOR_MEMO_PROMPT_ID, memoInputs(dealFrom()));
		expect(built.user).toContain('Monthly cash flow: $184');
		expect(built.user).not.toMatch(/\d+\.\d{3,}/);
		expect(built.system).not.toMatch(/\d+\.\d{3,}/);
	});

	it('every reference case: the sample memo passes its own number, Fair Housing checks', () => {
		for (const c of REFERENCE_CASES) {
			const i = memoInputs(dealFrom(c.inputs), 'Roof is 4 years old.');
			const text = investorMemoV1.sample!(i);
			expect(text).toBe(sampleMemo(i.facts));
			expect(checkNumbers(text, i.facts.allowed), c.id).toHaveLength(0);
			expect(checkFairHousing(text), c.id).toHaveLength(0);
		}
	});

	it('buildPrompt carries the sample as fixtureText, not in the sent payload', async () => {
		const i = memoInputs(dealFrom());
		const built = await buildPrompt(INVESTOR_MEMO_PROMPT_ID, i);
		expect(built.fixtureText).toBe(sampleMemo(i.facts));
		expect(built.user).not.toContain(built.fixtureText!.slice(0, 40));
	});
});

describe('memoFactsForDeal', () => {
	it('maps a deal to buildMemoFacts input', () => {
		const deal = dealFrom();
		const facts = memoFactsForDeal(deal, '  my notes  ');
		const expected = buildMemoFacts({
			dealName: deal.name,
			address: deal.address,
			propertyType: 'Single family',
			bedrooms: 2,
			bathrooms: 1,
			squareFeet: 1000,
			inputs: deal.inputs,
			analysis: analyze(deal.inputs),
			sources: { price: { source: 'sample' }, rent: { source: 'sample' } },
			notes: '  my notes  '
		});
		expect(facts).toEqual(expected);
		expect(facts.notes).toBe('my notes');
		expect(facts.factsText).toContain('Property type: Single family');
	});

	it('keeps rentcast/sample/listing sources and maps edited to you', () => {
		const deal = dealFrom(A.inputs, {
			sources: {
				rent: {
					source: 'rentcast',
					fetchedAt: Date.UTC(2026, 8, 1),
					rangeLowCents: 190000,
					rangeHighCents: 210000,
					comps: 8
				},
				price: { source: 'listing', listingId: 'x' }
			}
		});
		const t = memoFactsForDeal(deal, '').factsText;
		expect(t).toContain('Monthly rent source: RentCast estimate as of');
		expect(t).toContain('based on 8 comparables');
		expect(t).toContain('Purchase price source: from the for-sale listing');

		const edited = memoFactsForDeal(
			dealFrom(A.inputs, { sources: { rent: { source: 'edited' } } }),
			''
		).factsText;
		expect(edited).not.toContain('Monthly rent source');
		const none = memoFactsForDeal(dealFrom(A.inputs, { sources: {} }), '').factsText;
		expect(none).not.toContain('source:');
	});
});
