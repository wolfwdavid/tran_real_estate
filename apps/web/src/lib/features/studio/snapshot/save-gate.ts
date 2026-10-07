// The Market Snapshot "Save and open print view" gate (STU-04, 09-UI-SPEC "Step 4: Save and print")
// and the builder's other pure helpers (autosaved choices, step 4 summary values).
// Pure: the builder maps its state (step 1 data, step 2 sections, the notes panel's read-only
// bindables and the agent profile) onto SaveGateState, and the first applicable reason, in the
// UI-SPEC's priority order, is the visible reason line. null means Save is allowed.
import type { Finding } from '@tran/core/fair-housing';
import { DISCLOSURE_FIELD_LABELS, type DisclosureField } from '@tran/core/studio';
import { formatCost } from '$lib/features/shared/data/copy/provenance';
import { SNAPSHOT_SECTION_KEYS, type SnapshotSectionKey } from '$lib/storage/studio/types';
import type { ListingsKind } from './snapshot-data';
import {
	DATA_SECTION_KEYS,
	DEFAULT_INCLUDE,
	type SnapshotIncludeValue
} from './SnapshotSectionToggles.svelte';

export type NotesStatus = 'none' | 'streaming' | 'ready';

export interface SaveGateState {
	hasData: boolean;
	/** Checked sections that carry market data (Market notes alone is not one). */
	dataSections: number;
	notesOn: boolean;
	notesStatus: NotesStatus;
	/** Block findings in the market notes. */
	mustFix: number;
	/** Review findings the agent has not acknowledged yet. */
	unackedReview: boolean;
	/** UI names of the missing disclosure fields ("full name", "brokerage", ...). */
	profileMissing: string[];
	/** The ZIP data came from RentCast (sample data uses the sample agent instead). */
	live: boolean;
}

export const NO_DATA_REASON = "Load a ZIP code's data first.";
export const NO_SECTION_REASON = 'Choose at least one section with market data.';
export const NOTES_NOT_DRAFTED_REASON = 'Draft the market notes, or turn them off in step 2.';

export const notesFindingsReason = (n: number): string =>
	`Fix the ${n} items marked Must fix in the market notes, and review any others.`;

export const profileReason = (missing: readonly string[]): string =>
	`Add your ${missing.join(', ')} in your profile so your disclosure can be added.`;

/** The first gating reason in priority order, or null when Save is allowed. */
export function saveGateReason(s: SaveGateState): string | null {
	if (!s.hasData) return NO_DATA_REASON;
	if (s.dataSections < 1) return NO_SECTION_REASON;
	if (s.notesOn && s.notesStatus !== 'ready') return NOTES_NOT_DRAFTED_REASON;
	if (s.notesOn && (s.mustFix > 0 || s.unackedReview)) return notesFindingsReason(s.mustFix);
	if (s.live && s.profileMissing.length > 0) return profileReason(s.profileMissing);
	return null;
}

/** DisclosureField ids to their UI names, in the formatter's order. */
export function missingLabels(fields: readonly DisclosureField[]): string[] {
	return fields.map((f) => DISCLOSURE_FIELD_LABELS[f]);
}

/**
 * The notes panel's read-only bindables mapped onto the gate's notes fields. Findings are reset
 * while a run streams, so text with no verdict yet (not exit-ready, no findings) is "streaming".
 */
export function notesGateFields(panel: {
	draftText: string;
	canExit: boolean;
	findings: readonly Finding[];
}): Pick<SaveGateState, 'notesStatus' | 'mustFix' | 'unackedReview'> {
	const mustFix = panel.findings.filter((f) => f.severity === 'block').length;
	const review = panel.findings.some((f) => f.severity === 'warn');
	const notesStatus: NotesStatus =
		panel.draftText === ''
			? 'none'
			: !panel.canExit && panel.findings.length === 0
				? 'streaming'
				: 'ready';
	return {
		notesStatus,
		mustFix,
		unackedReview: !panel.canExit && mustFix === 0 && review
	};
}

/** The notes panel's read-only outputs the builder mirrors (GenerationPanel bindables). */
export interface NotesPanelOutputs {
	draftText: string;
	canExit: boolean;
	blocked: boolean;
	findings: Finding[];
	artifactId: string | null;
}

/** No draft: the panel's outputs before a run (and after the ZIP is cleared). */
export const emptyPanelOutputs = (): NotesPanelOutputs => ({
	draftText: '',
	canExit: false,
	blocked: false,
	findings: [],
	artifactId: null
});

/**
 * Steps 2-4 after "Choose a different ZIP": no ZIP data, no listings summary, nothing spent.
 * The notes panel unmounts with the data, so its outputs reset too (emptyPanelOutputs).
 */
export const CLEARED_ZIP = Object.freeze({
	loaded: null,
	zipSpend: null,
	listings: null,
	listingsSpend: null
});

/** The builder's state mapped onto the gate (the single place it is assembled). */
export function builderGateState(i: {
	loaded: { source: 'rentcast' | 'sample' } | null;
	sections: readonly SnapshotSectionKey[];
	panel: Pick<NotesPanelOutputs, 'draftText' | 'canExit' | 'findings'>;
	profileMissing: string[];
}): SaveGateState {
	return {
		hasData: i.loaded !== null,
		dataSections: i.sections.filter((k) => DATA_SECTION_KEYS.includes(k)).length,
		notesOn: i.sections.includes('marketNotes'),
		...notesGateFields(i.panel),
		profileMissing: i.profileMissing,
		live: i.loaded?.source === 'rentcast'
	};
}

/** What the builder autosaves: the choices only, never the market data. */
export interface BuilderChoices {
	zip: string | null;
	include: SnapshotIncludeValue;
}

const isKind = (v: unknown): v is ListingsKind => v === 'sale' || v === 'rental';

/** The autosaved form, or null when it is missing or not a builder form. */
export function parseChoices(raw: unknown): BuilderChoices | null {
	if (typeof raw !== 'object' || raw === null) return null;
	const r = raw as Record<string, unknown>;
	if (!Array.isArray(r.sections) || typeof r.eho !== 'boolean') return null;
	if (typeof r.tranFooter !== 'boolean') return null;
	const sections = SNAPSHOT_SECTION_KEYS.filter((k) =>
		(r.sections as unknown[]).includes(k)
	) as SnapshotSectionKey[];
	return {
		zip: typeof r.zip === 'string' && /^\d{5}$/.test(r.zip) ? r.zip : null,
		include: {
			sections,
			eho: r.eho,
			tranFooter: r.tranFooter,
			listingsKind: isKind(r.listingsKind) ? r.listingsKind : null
		}
	};
}

/** The plain value written to the snapshot studioDraft row. */
export function choicesData(zip: string | null, include: SnapshotIncludeValue) {
	return {
		zip,
		sections: [...include.sections],
		eho: include.eho,
		tranFooter: include.tranFooter,
		listingsKind: include.listingsKind
	};
}

export const defaultInclude = (): SnapshotIncludeValue => ({
	...DEFAULT_INCLUDE,
	sections: [...DEFAULT_INCLUDE.sections]
});

/** How a load was paid for: the CostLabel text without its parentheses ("1 call", ...). */
export type Spend = 'network' | 'cached' | 'sample';

export function spendText(spend: Spend): string {
	const label = formatCost({ calls: spend === 'network' ? 1 : 0, reason: spend });
	return label.slice(1, -1);
}

/** Step 4 "Market notes" value. */
export function notesSummary(notesOn: boolean, drafted: boolean): string {
	if (!notesOn) return 'Not included';
	return drafted ? 'Drafted' : 'Not drafted yet';
}
