// Analyzer autofill controller (07-15, INV-02 autofill half; 07-UI-SPEC "Autofill and field
// provenance"). Everything here is pure except runAutofill, which only awaits the investor port.
//
// Spend rule: runAutofill is the ONLY autofill spend path and runs from a click handler. It never
// makes a request without an address. Over-cap: the port spends through runtime.requestSpend, whose
// CapPrompt (CapConfirmDialog, rendered once by DataShell) asks before going past the cap and issues
// the single-use grant itself, so this module never builds grants (mirrors shared/markets/
// market-load.ts). A "Not now" answer rejects with BudgetCapReached detail 'dismissed': nothing was
// spent and the caller keeps what is on screen.
//
// Fill rule (never destroys user input): an estimate fills an EMPTY target field; a field that
// already holds a number is kept and the estimate is offered with "Use $x" (useEstimate).
import { parseMoneyInput } from '@tran/core/finance';
import { isGatewayError, type GatewayError } from '@tran/core/request';
import type { Estimate, EstimateQuery, InvestorDataPort } from '../data/investor-port';
import type { DealSources, FieldSource, FieldSourceKey } from '../deals/schema';
import { formatOnBlur, type AnalyzerForm } from './form-model';

export type AutofillTarget = 'rent' | 'value';

export type AutofillOutcome =
	| { kind: 'ok'; estimate: Estimate }
	| { kind: 'no-address' }
	| {
			kind: 'cap';
			error: GatewayError;
			/** true when the user said "Not now" on the over-cap prompt (nothing was spent). */
			dismissed: boolean;
			retry: () => Promise<AutofillOutcome>;
	  }
	| { kind: 'error'; error: unknown };

/** The form field an autofill target writes. */
export const TARGET_FIELD = { rent: 'rent', value: 'price' } as const satisfies Record<
	AutofillTarget,
	'rent' | 'price'
>;

function optionalNumber(raw: string, integer: boolean): number | undefined {
	const t = raw.trim().replaceAll(',', '');
	if (t === '' || !/^\d+(\.\d+)?$/.test(t)) return undefined;
	const n = Number(t);
	if (!Number.isFinite(n) || (integer && !Number.isInteger(n))) return undefined;
	return n;
}

/** null when the address is blank; details are included only when present and valid. */
export function estimateQueryFromForm(form: AnalyzerForm): EstimateQuery | null {
	const address = form.address.trim();
	if (address === '') return null;
	const q: EstimateQuery = { address };
	if (form.propertyType) q.propertyType = form.propertyType;
	const bedrooms = optionalNumber(form.bedrooms, true);
	if (bedrooms !== undefined) q.bedrooms = bedrooms;
	const bathrooms = optionalNumber(form.bathrooms, false);
	if (bathrooms !== undefined) q.bathrooms = bathrooms;
	const squareFeet = optionalNumber(form.squareFeet, true);
	if (squareFeet !== undefined) q.squareFeet = squareFeet;
	return q;
}

/** Click handlers only. At most one call (none when cached or sample). Never throws. */
export async function runAutofill(
	port: InvestorDataPort,
	target: AutofillTarget,
	form: AnalyzerForm
): Promise<AutofillOutcome> {
	const q = estimateQueryFromForm(form);
	if (!q) return { kind: 'no-address' };
	try {
		const estimate = target === 'rent' ? await port.rentEstimate(q) : await port.valueEstimate(q);
		return { kind: 'ok', estimate };
	} catch (error) {
		if (isGatewayError(error) && error.kind === 'BudgetCapReached') {
			return {
				kind: 'cap',
				error,
				dismissed: error.detail === 'dismissed',
				retry: () => runAutofill(port, target, form)
			};
		}
		return { kind: 'error', error };
	}
}

/** The whole-dollar field text for an estimate: 185_000 cents -> "1,850". */
export function estimateText(e: Estimate): string {
	return formatOnBlur('money', String(Math.round(e.amountCents / 100)));
}

function sourceFor(e: Estimate): FieldSource {
	const s: FieldSource = {
		source: e.provenance.source === 'sample' ? 'sample' : 'rentcast',
		fetchedAt: e.provenance.fetchedAt
	};
	if (e.rangeLowCents !== null) s.rangeLowCents = e.rangeLowCents;
	if (e.rangeHighCents !== null) s.rangeHighCents = e.rangeHighCents;
	s.comps = e.comparables.length;
	return s;
}

/** True when the field holds a number the user typed (or kept). */
export function fieldHasNumber(raw: string): boolean {
	const r = parseMoneyInput(raw);
	return r.ok && r.value !== null;
}

/** Writes the estimate into its target field, replacing whatever is there. */
export function useEstimate(
	form: AnalyzerForm,
	sources: DealSources,
	target: AutofillTarget,
	e: Estimate
): { form: AnalyzerForm; sources: DealSources } {
	const key = TARGET_FIELD[target];
	return {
		form: { ...form, [key]: estimateText(e) },
		sources: { ...sources, [key]: sourceFor(e) }
	};
}

/** The fill rule: fill an empty field ('filled'), keep a typed number untouched ('kept'). */
export function applyEstimate(
	form: AnalyzerForm,
	sources: DealSources,
	target: AutofillTarget,
	e: Estimate
): { form: AnalyzerForm; sources: DealSources; kind: 'filled' | 'kept' } {
	if (fieldHasNumber(form[TARGET_FIELD[target]])) return { form, sources, kind: 'kept' };
	return { ...useEstimate(form, sources, target, e), kind: 'filled' };
}

/** A filled value the user changed: rentcast/sample/listing -> edited (reference data kept). */
export function markEdited(sources: DealSources, key: FieldSourceKey): DealSources {
	const s = sources[key];
	if (!s || s.source === 'edited') return sources;
	return { ...sources, [key]: { ...s, source: 'edited' } };
}

/** Factual price-vs-estimate line (no judgment). */
export function priceComparison(priceCents: number, estimateCents: number): string {
	if (estimateCents <= 0 || priceCents === estimateCents) {
		return 'Your purchase price matches this estimate.';
	}
	const diff = ((priceCents - estimateCents) / estimateCents) * 100;
	const text = Math.abs(diff).toFixed(1);
	if (text === '0.0') return 'Your purchase price matches this estimate.';
	return `Your purchase price is ${text}% ${diff > 0 ? 'above' : 'below'} this estimate.`;
}
