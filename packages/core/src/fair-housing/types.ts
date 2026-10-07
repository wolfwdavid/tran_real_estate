/**
 * Fair Housing checker types. Categories follow the FHA §3604(c) protected
 * classes, plus classes many states and cities add (tagged `scope: 'state'`),
 * plus the studio's `advertising` category for guarantee and superlative
 * claims (not a protected class; tagged `scope: 'other'`).
 */
export type Category =
	| 'race'
	| 'color'
	| 'religion'
	| 'sex'
	| 'familial-status'
	| 'national-origin'
	| 'disability'
	| 'source-of-income'
	| 'age'
	| 'marital-status'
	| 'sogi'
	| 'advertising';

export type Severity = 'block' | 'warn';

export interface LexiconEntry {
	/** Stable id, e.g. 'familial.no-kids'. */
	id: string;
	/** RegExp source authored with p``; the matcher adds boundaries and 'giu'. */
	pattern: string;
	category: Category;
	/** 'other' is for non-Fair-Housing advertising rules (no state-law note in the UI). */
	scope: 'federal' | 'state' | 'other';
	severity: Severity;
	/** Plain language, our own words. */
	explanation: string;
	/** '' means "Remove phrase". */
	alternative: string;
	/** e.g. 'HUD Achtenberg memo (1995), familial status'. */
	source: string;
	/** At least one; each MUST be matched by this entry and by no other entry. */
	examples: string[];
	/** Roadmap phase that added the entry; absent for the Phase 5 base lexicon. */
	phase?: number;
}

export interface FindingMember {
	entryId: string;
	/** 'fair-housing' for lexicon hits; other checkers use their own id. */
	checker: string;
	/** A Category for fair-housing; free-form for other checkers. */
	category: string;
	/** User-facing label, e.g. 'Familial status'. */
	categoryLabel: string;
	scope: 'federal' | 'state' | 'other';
	severity: Severity;
	explanation: string;
	alternative: string;
	source: string;
	/** text.slice(start, end) */
	phrase: string;
	start: number;
	end: number;
}

/** One merged group = one <mark> in the UI. */
export interface Finding {
	/** `${start}-${end}` */
	id: string;
	start: number;
	end: number;
	/** Highest among members ('block' > 'warn'). */
	severity: Severity;
	phrase: string;
	/** In start order; ties: block first, then lexicon order. */
	members: FindingMember[];
}

export const CATEGORY_LABELS: Record<Category, string> = {
	race: 'Race',
	color: 'Color',
	religion: 'Religion',
	sex: 'Sex',
	'familial-status': 'Familial status',
	'national-origin': 'National origin',
	disability: 'Disability',
	'source-of-income': 'Source of income',
	age: 'Age',
	'marital-status': 'Marital status',
	sogi: 'Sexual orientation or gender identity',
	advertising: 'Advertising claim'
};

export const STATE_SCOPE_NOTE = 'Protected under many state and local laws.';
