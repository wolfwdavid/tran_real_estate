// Saved deal -> memo FACTS (INV-06). Outputs are recomputed with the pure analyzer (a deal stores
// inputs only), field sources are mapped to the memo's wording ('edited' becomes 'you', which the
// FACTS builder leaves out), and everything else is the 07-08 core builder.
import { analyze, buildMemoFacts, type FieldSourceFact, type MemoFacts } from '@tran/core/finance';
import type { DealRecord, FieldSource, PropertyType } from '../deals/schema';

/** Same wording as the analyzer's property type select. */
export const PROPERTY_TYPE_LABEL: Record<PropertyType, string> = {
	'single-family': 'Single family',
	condo: 'Condo',
	townhouse: 'Townhouse',
	'multi-family': 'Multi-family',
	manufactured: 'Manufactured'
};

function sourceFact(s: FieldSource | undefined): FieldSourceFact | undefined {
	if (!s) return undefined;
	if (s.source === 'edited') return { source: 'you' };
	const out: FieldSourceFact = { source: s.source };
	if (s.fetchedAt !== undefined) out.asOf = s.fetchedAt;
	if (s.rangeLowCents !== undefined) out.rangeLowCents = s.rangeLowCents;
	if (s.rangeHighCents !== undefined) out.rangeHighCents = s.rangeHighCents;
	if (s.comps !== undefined) out.comps = s.comps;
	return out;
}

export function memoFactsForDeal(deal: DealRecord, notes: string): MemoFacts {
	const rent = sourceFact(deal.sources.rent);
	const price = sourceFact(deal.sources.price);
	return buildMemoFacts({
		dealName: deal.name,
		address: deal.address,
		propertyType: deal.propertyType ? PROPERTY_TYPE_LABEL[deal.propertyType] : null,
		bedrooms: deal.bedrooms,
		bathrooms: deal.bathrooms,
		squareFeet: deal.squareFeet,
		inputs: deal.inputs,
		analysis: analyze(deal.inputs),
		sources: { ...(price ? { price } : {}), ...(rent ? { rent } : {}) },
		notes
	});
}
