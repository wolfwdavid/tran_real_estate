// Analyzer page state (07-12, INV-01). Runes only: the form is $state, the parse and the analysis are
// $derived, so results recompute synchronously on every keystroke with no Calculate button. Manual
// entry spends nothing: this module imports no data gateway or port. Its single $effect
// (startAutosave) hands the plain draft to the autosaver, which writes Dexie, never the network.
import { analyze, type DealAnalysis } from '@tran/core/finance';
import type { DealRecord, DealSources } from '../deals/schema';
import type { ShownEstimates } from './autofill';
import { dealSnapshot, EMPTY_SNAPSHOT } from './deal-data';
import type { AnalyzerDraft, Autosaver, DraftInput } from './draftRepo';
import {
	defaultForm,
	inputsToForm,
	parseForm,
	validateField,
	type AnalyzerForm,
	type FieldError,
	type FieldKey,
	type ParsedForm
} from './form-model';

export class AnalyzerPageState {
	form: AnalyzerForm = $state(defaultForm());
	sources: DealSources = $state({});
	/** The open saved deal, or null for a new analysis. */
	dealId: string | null = $state(null);
	/** dealSnapshot() at the last save/open; null when nothing is saved. */
	savedSnapshot: string | null = $state(null);
	/** ISO time of the last save (for "Saved {relative}"). */
	savedAt: string | null = $state(null);
	/** Errors the user has been shown (on blur or on save), never on each keystroke. */
	shownErrors: Partial<Record<FieldKey, FieldError>> = $state({});
	/** False until the draft/deal restore finished, so the autosave never overwrites a draft. */
	restored = $state(false);
	/**
	 * Estimates shown as EstimateResult under the autofill buttons (07-18: restored from a Deep
	 * analyze draft at 0 calls; kept in the draft so a reload shows them again).
	 */
	estimates: ShownEstimates = $state({});
	/** 07-18: a Deep analyze estimate that failed (gateway error kind), shown in its fieldset. */
	estimateErrors: { rent?: string; value?: string } = $state({});

	readonly parsed: ParsedForm = $derived(parseForm(this.form));
	readonly analysis: DealAnalysis | null = $derived(
		this.parsed.ready && this.parsed.inputs ? analyze(this.parsed.inputs) : null
	);
	readonly snapshot: string = $derived(dealSnapshot(this.form));
	readonly unsaved: boolean = $derived(this.snapshot !== (this.savedSnapshot ?? EMPTY_SNAPSHOT));

	/** Run one field's validation (on blur) and show or clear its error. */
	validate(key: FieldKey): void {
		const error = validateField(this.form, key);
		const next = { ...this.shownErrors };
		if (error) next[key] = error;
		else delete next[key];
		this.shownErrors = next;
	}

	/** Validate every field (on save); returns true when nothing is invalid. */
	validateAll(): boolean {
		this.shownErrors = { ...this.parsed.errors };
		return Object.keys(this.parsed.errors).length === 0;
	}

	/** Replace the whole form (sample, clear, restore). */
	load(form: AnalyzerForm, sources: DealSources = {}): void {
		this.form = form;
		this.sources = sources;
		this.shownErrors = {};
		this.estimates = {};
		this.estimateErrors = {};
	}

	/** Restore a working draft: form, sources, and the estimates a Deep analyze wrote (07-18). */
	loadDraft(d: Pick<AnalyzerDraft, 'form' | 'sources' | 'estimates' | 'estimateErrors'>): void {
		this.load(d.form, d.sources);
		const e = (d.estimates ?? {}) as ShownEstimates;
		this.estimates = {
			...(e.rent ? { rent: e.rent } : {}),
			...(e.value ? { value: e.value } : {})
		};
		this.estimateErrors = { ...(d.estimateErrors ?? {}) };
	}

	/** Open a saved deal: form from its inputs, snapshot so the badge reads Saved. */
	openDeal(deal: DealRecord): void {
		this.load(inputsToForm(deal), structuredClone(deal.sources));
		this.dealId = deal.id;
		this.savedAt = deal.updatedAt;
		this.savedSnapshot = dealSnapshot(this.form);
	}

	/** Record a save: the current form is now what is stored. */
	markSaved(deal: Pick<DealRecord, 'id' | 'updatedAt'>): void {
		this.dealId = deal.id;
		this.savedAt = deal.updatedAt;
		this.savedSnapshot = this.snapshot;
	}

	/** Back to an empty new analysis. */
	reset(): void {
		this.load(defaultForm());
		this.dealId = null;
		this.savedSnapshot = null;
		this.savedAt = null;
	}

	/** The plain (non-proxy) draft for Dexie. */
	draft(): DraftInput {
		return {
			dealId: this.dealId,
			form: $state.snapshot(this.form) as AnalyzerForm,
			sources: $state.snapshot(this.sources) as DealSources,
			savedSnapshot: this.savedSnapshot,
			estimates: $state.snapshot(this.estimates) as ShownEstimates
		};
	}

	/** Call during component init: schedules the autosaver after every change once restored. */
	startAutosave(saver: Pick<Autosaver, 'schedule'>): void {
		$effect(() => {
			const d = this.draft();
			if (!this.restored) return;
			saver.schedule(d);
		});
	}
}
