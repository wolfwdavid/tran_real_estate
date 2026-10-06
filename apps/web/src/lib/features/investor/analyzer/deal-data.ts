// Form <-> saved-deal helpers for the analyzer page (07-12). Pure: no Svelte, no DOM, no storage.
//
// dealSnapshot is what the "Unsaved changes" badge compares. It is built from the PARSED inputs, so
// blur formatting ("200000" -> "200,000") is never a change. A form that is not ready yet (price or
// rent missing) snapshots its raw strings, so any typed value on a fresh form counts as unsaved.
// (analysisHash from 07-08 is deliberately not used here: a JSON snapshot of the inputs is enough.)
import type { DealData, DealSources, PropertyType } from '../deals/schema';
import {
	defaultForm,
	parseForm,
	validateField,
	type AnalyzerForm,
	type FieldKey
} from './form-model';

function count(form: AnalyzerForm, key: FieldKey, raw: string): number | null {
	const t = raw.trim();
	if (t === '' || validateField(form, key) !== null) return null;
	return Number(t.replaceAll(',', ''));
}

function details(form: AnalyzerForm) {
	return {
		name: form.name.trim(),
		address: form.address.trim(),
		propertyType: (form.propertyType || null) as PropertyType | null,
		bedrooms: count(form, 'bedrooms', form.bedrooms),
		bathrooms: count(form, 'bathrooms', form.bathrooms),
		squareFeet: count(form, 'squareFeet', form.squareFeet)
	};
}

/** The comparable state of a form: parsed inputs (or raw strings when not ready) + property details. */
export function dealSnapshot(form: AnalyzerForm): string {
	const parsed = parseForm(form);
	const inputs = parsed.ready ? parsed.inputs : { raw: form };
	return JSON.stringify({ inputs, ...details(form) });
}

/** The snapshot of an untouched form. */
export const EMPTY_SNAPSHOT: string = dealSnapshot(defaultForm());

/** True when the form differs from what was last saved (or from an empty form when never saved). */
export function isUnsaved(form: AnalyzerForm, savedSnapshot: string | null): boolean {
	return dealSnapshot(form) !== (savedSnapshot ?? EMPTY_SNAPSHOT);
}

/** The deal's display name: the name, else the address, else "Untitled deal". */
export function dealName(form: Pick<AnalyzerForm, 'name' | 'address'>): string {
	return form.name.trim() || form.address.trim() || 'Untitled deal';
}

/** DealData for createDeal/updateDeal, or null when the form is not ready (price or rent missing). */
export function formToDealData(form: AnalyzerForm, sources: DealSources): DealData | null {
	const parsed = parseForm(form);
	if (!parsed.ready || !parsed.inputs) return null;
	return { ...details(form), name: dealName(form), inputs: parsed.inputs, sources };
}
