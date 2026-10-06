// "Try a sample deal" (07-12). Reference case A's numbers (07-05: $200,000 price, $2,000 rent, 20%
// down at 7% for 30 years, 3% closing, $200 tax, $100 insurance, default percent lines), so the
// results are known exactly: NOI $1,248 a month and cash flow $184 a month. The address is the first
// for-sale listing in the Phase 4 fixture metro (Harlow Springs, OK 74201): fictional, never real.
//
// Frozen: callers clone it (structuredClone) before putting it into $state.
import { REFERENCE_CASES } from '@tran/core/finance';
import type { DealSources } from '../deals/schema';
import { inputsToForm, type AnalyzerForm } from './form-model';

const A = REFERENCE_CASES.find((c) => c.id === 'A')!;

function deepFreeze<T>(v: T): T {
	if (v && typeof v === 'object') {
		for (const child of Object.values(v)) deepFreeze(child);
		Object.freeze(v);
	}
	return v;
}

export const SAMPLE_DEAL: { readonly form: AnalyzerForm; readonly sources: DealSources } =
	deepFreeze({
		form: inputsToForm({
			name: 'Sample deal',
			address: '5090 Gildenreach Blvd, Harlow Springs, OK 74201',
			propertyType: 'single-family',
			bedrooms: 2,
			bathrooms: 1,
			squareFeet: 1000,
			// Same $6,000 as case A, entered the way the form defaults it: 3% of price.
			inputs: { ...A.inputs, closing: { unit: 'pct', bps: 300 } }
		}),
		sources: { price: { source: 'sample' }, rent: { source: 'sample' } }
	});

/** A mutable copy of the sample deal for the page's $state. */
export function sampleDealCopy(): { form: AnalyzerForm; sources: DealSources } {
	return structuredClone({ form: SAMPLE_DEAL.form, sources: SAMPLE_DEAL.sources });
}
