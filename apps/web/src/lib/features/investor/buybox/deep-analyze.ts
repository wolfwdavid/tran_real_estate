// Deep analyze (07-18, INV-04 / ROADMAP SC3; 07-RESEARCH Pattern 4 "spend in the click handler,
// then render from cache"). Runs from a buy-box match's click handler ONLY: the rent estimate, then
// the value estimate (sequential, so the runtime's per-call over-cap prompt never stacks), then one
// working-draft write with the listing facts ("From listing" chips) and the estimates (RentCast or
// Sample chips). The caller navigates to the analyzer afterwards; the analyzer restores the draft
// and never re-spends (its autofill cost labels read "(0 calls · cached)").
//
// Spend accounting: estimateCost (free) before each spend, so `calls` is the number of network
// calls this run made: 2 uncached, 1 with one estimate cached, 0 cached or in sample mode.
//
// Over-cap: the port spends through runtime.requestSpend, whose CapPrompt already asks the user.
// A "Not now" answer rejects with BudgetCapReached detail 'dismissed' and that estimate is skipped
// (nothing was spent). Any other BudgetCapReached (for example a prompt already open) awaits
// deps.confirmCap(); on yes the call is retried once (asking through the same prompt), on no it is
// skipped. Either way the other estimate still runs and the draft is still written.
import { isGatewayError } from '@tran/core/request';
import { applyEstimate } from '../analyzer/autofill';
import type { DraftInput } from '../analyzer/draftRepo';
import { centsToText, defaultForm, formatOnBlur, type AnalyzerForm } from '../analyzer/form-model';
import type { Estimate, EstimateQuery, InvestorDataPort, SaleListing } from '../data/investor-port';
import type { DealSources, PropertyType } from '../deals/schema';

export type DeepAnalyzeResult = { rent: 'ok' | 'error'; value: 'ok' | 'error'; calls: number };

export interface DeepAnalyzeDeps {
	/** Asked when a spend hits the cap without the user having answered the runtime prompt. */
	confirmCap: () => Promise<boolean>;
	writeDraft: (d: DraftInput) => Promise<void>;
}

/** RentCast listing property type -> analyzer property type ('' when unknown). */
const ANALYZER_TYPE: Record<string, PropertyType> = {
	'Single Family': 'single-family',
	Condo: 'condo',
	Townhouse: 'townhouse',
	'Multi-Family': 'multi-family',
	Manufactured: 'manufactured'
};

export function analyzerPropertyType(t: string | null): PropertyType | '' {
	return (t !== null && ANALYZER_TYPE[t]) || '';
}

/** The estimate query for a listing: address plus whatever details the listing has. */
export function listingQuery(l: SaleListing): EstimateQuery {
	const q: EstimateQuery = { address: l.address };
	const type = analyzerPropertyType(l.propertyType);
	if (type) q.propertyType = type;
	if (l.bedrooms !== null) q.bedrooms = l.bedrooms;
	if (l.bathrooms !== null) q.bathrooms = l.bathrooms;
	if (l.squareFeet !== null) q.squareFeet = l.squareFeet;
	return q;
}

/** The analyzer form and "From listing" sources for a for-sale listing (no estimates yet). */
export function listingDraft(l: SaleListing): { form: AnalyzerForm; sources: DealSources } {
	const base = defaultForm();
	const fromListing = { source: 'listing' as const, listingId: l.id };
	const sources: DealSources = { address: { ...fromListing }, price: { ...fromListing } };
	const type = analyzerPropertyType(l.propertyType);
	const hoa = l.hoaMonthlyCents;
	const form: AnalyzerForm = {
		...base,
		address: l.address,
		propertyType: type,
		bedrooms: l.bedrooms === null ? '' : String(l.bedrooms),
		bathrooms: l.bathrooms === null ? '' : String(l.bathrooms),
		squareFeet: l.squareFeet === null ? '' : formatOnBlur('number', String(l.squareFeet)),
		price: centsToText(l.priceCents),
		expenses:
			hoa === null
				? base.expenses
				: base.expenses.map((line) =>
						line.kind === 'hoa' ? { ...line, amount: centsToText(hoa) } : line
					)
	};
	if (type) sources.propertyType = { ...fromListing };
	if (l.bedrooms !== null) sources.bedrooms = { ...fromListing };
	if (l.bathrooms !== null) sources.bathrooms = { ...fromListing };
	if (l.squareFeet !== null) sources.squareFeet = { ...fromListing };
	return { form, sources };
}

type Step = { ok: true; estimate: Estimate; calls: number } | { ok: false; error: string };

async function runEstimate(
	port: InvestorDataPort,
	kind: 'rent' | 'value',
	q: EstimateQuery,
	deps: DeepAnalyzeDeps
): Promise<Step> {
	const spend = () => (kind === 'rent' ? port.rentEstimate(q) : port.valueEstimate(q));
	const cost = async () => {
		try {
			return (await port.estimateCost({ kind, q })).calls;
		} catch {
			return 1;
		}
	};
	let retried = false;
	for (;;) {
		const calls = await cost();
		try {
			return { ok: true, estimate: await spend(), calls };
		} catch (error) {
			if (isGatewayError(error) && error.kind === 'BudgetCapReached') {
				if (error.detail === 'dismissed' || retried) return { ok: false, error: error.kind };
				retried = true;
				if (await deps.confirmCap()) continue;
				return { ok: false, error: error.kind };
			}
			return { ok: false, error: isGatewayError(error) ? error.kind : 'NetworkError' };
		}
	}
}

/**
 * Click handlers only. At most 2 calls (rent, then value), then one draft write. Never navigates
 * and never throws for a failed estimate (only a failed draft write rejects).
 */
export async function deepAnalyze(
	port: InvestorDataPort,
	listing: SaleListing,
	deps: DeepAnalyzeDeps
): Promise<DeepAnalyzeResult> {
	const q = listingQuery(listing);
	const rent = await runEstimate(port, 'rent', q, deps);
	const value = await runEstimate(port, 'value', q, deps);

	let { form, sources } = listingDraft(listing);
	const estimates: { rent?: Estimate; value?: Estimate } = {};
	const estimateErrors: { rent?: string; value?: string } = {};
	if (rent.ok) {
		// The rent field is empty in a fresh listing draft, so the estimate always fills it.
		({ form, sources } = applyEstimate(form, sources, 'rent', rent.estimate));
		estimates.rent = rent.estimate;
	} else {
		estimateErrors.rent = rent.error;
	}
	// The value estimate never overwrites the listing price: it is the EstimateResult reference.
	if (value.ok) estimates.value = value.estimate;
	else estimateErrors.value = value.error;

	const draft: DraftInput = {
		dealId: null,
		form,
		sources,
		savedSnapshot: null,
		estimates,
		estimateErrors
	};
	await deps.writeDraft(draft);
	return {
		rent: rent.ok ? 'ok' : 'error',
		value: value.ok ? 'ok' : 'error',
		calls: (rent.ok ? rent.calls : 0) + (value.ok ? value.calls : 0)
	};
}
