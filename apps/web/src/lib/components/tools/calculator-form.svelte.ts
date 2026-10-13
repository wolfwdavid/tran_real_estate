// Form state for the free calculators (GTM-03, 10-UI-SPEC "CalculatorShell").
//
// Parsing and validation come from @tran/core (validateToolField); this module only turns the
// typed result codes into UI-SPEC copy and keeps the per-field state. Results update live, but the
// summary is announced once, politely, 750 ms after the last change that produces a valid result.
// Marketing-safe: no storage, data, AI or portal imports, and no network.

import {
	formatMoneyInput,
	toolMoney,
	validateToolField,
	type FieldError
} from '@tran/core/finance';
import { SHARED_TOOL_COPY, TOOLS, type ToolField } from '$lib/content/tools';

const V = SHARED_TOOL_COPY.validation;
const ANNOUNCE_DELAY_MS = 750;

export type FieldValues = Record<string, string>;
export type ParseResult =
	{ ok: true; values: Record<string, number> } | { ok: false; missing: string[] };

const specOf = (f: ToolField) => ({ kind: f.kind, required: f.required, positive: f.positive });

/** A limit in the field's unit: money limits are dollars ("$100,000,000"), others plain numbers. */
const limitText = (f: ToolField, n: number) =>
	f.kind === 'money' ? toolMoney(n * 100) : String(n);

/** UI-SPEC "Field validation" copy for one failed field. */
export function errorMessage(field: ToolField, error: FieldError): string {
	switch (error.code) {
		case 'required':
			return V.required(field.label);
		case 'nan':
			return V.nan;
		case 'min':
			return V.min(limitText(field, error.min ?? 0));
		case 'max':
			return V.max(limitText(field, error.max ?? 0));
		case 'price-zero':
			return V.priceZero;
	}
}

/** Every field valid -> parsed values (money in cents, optional blanks 0); else the failing ids. */
export function parseAll(fields: readonly ToolField[], values: FieldValues): ParseResult {
	const parsed: Record<string, number> = {};
	const missing: string[] = [];
	for (const f of fields) {
		const r = validateToolField(values[f.id] ?? '', specOf(f));
		if (r.ok) parsed[f.id] = r.value;
		else missing.push(f.id);
	}
	return missing.length === 0 ? { ok: true, values: parsed } : { ok: false, missing };
}

/** True exactly while every value still equals its "Fill in an example" value. */
export function isExample(fields: readonly ToolField[], values: FieldValues): boolean {
	return fields.every((f) => values[f.id] === f.example);
}

/** Fills `{x}` and `{y}`; a percent sign already in the template is not doubled. */
export function fillAnnouncement(template: string, x: string, y: string): string {
	const xText = template.includes('{x}%') ? x.replace(/%$/, '') : x;
	return template.replace('{x}', xText).replace('{y}', y);
}

const MINUS = '−';
const NEGATIVE = TOOLS['cash-on-cash'].negativeSuffix ?? '(negative)';

/** "−$53" -> "−$53 (negative)": the sign never depends on color (Accessibility Contract). */
export function markNegative(text: string): string {
	return text.startsWith(MINUS) ? `${text} ${NEGATIVE}` : text;
}

export interface CalculatorFormOptions {
	announce: (message: string) => void;
	/** The announcement for the current values, or null in the empty state. */
	summary: () => string | null;
}

/**
 * Runes-backed form state. Call during component initialisation (it registers an $effect for the
 * debounced announcement, which is cleaned up on destroy).
 */
export function createCalculatorForm(fields: readonly ToolField[], opts: CalculatorFormOptions) {
	const blank = () => Object.fromEntries(fields.map((f) => [f.id, ''])) as FieldValues;
	const untouched = () => Object.fromEntries(fields.map((f) => [f.id, false]));

	const values = $state<FieldValues>(blank());
	const touched = $state<Record<string, boolean>>(untouched());

	// Errors show once a field is touched (blur or submit) and then track the value live, so a
	// fixed field clears without another blur.
	const errors = $derived(
		Object.fromEntries(
			fields.map((f) => {
				if (!touched[f.id]) return [f.id, null];
				const r = validateToolField(values[f.id] ?? '', specOf(f));
				return [f.id, r.ok ? null : errorMessage(f, r)];
			})
		) as Record<string, string | null>
	);
	const parsed = $derived(parseAll(fields, values));
	const example = $derived(isExample(fields, values));

	let lastAnnounced: string | null = null;
	$effect(() => {
		for (const f of fields) void values[f.id];
		const timer = setTimeout(() => {
			const s = opts.summary();
			if (s && s !== lastAnnounced) {
				lastAnnounced = s;
				opts.announce(s);
			}
		}, ANNOUNCE_DELAY_MS);
		return () => clearTimeout(timer);
	});

	return {
		get values() {
			return values;
		},
		get errors() {
			return errors;
		},
		get touched() {
			return touched;
		},
		get parsed() {
			return parsed;
		},
		get isExample() {
			return example;
		},
		/** Validate one field; a valid, non-blank money value is reformatted ("250000" -> "250,000"). */
		blur(id: string) {
			const f = fields.find((x) => x.id === id);
			if (!f) return;
			touched[id] = true;
			const raw = values[id] ?? '';
			const r = validateToolField(raw, specOf(f));
			if (r.ok && f.kind === 'money' && raw.trim() !== '') values[id] = formatMoneyInput(r.value);
		},
		/** Validate every field; returns the first invalid id (the caller focuses it) or null. */
		submit(): string | null {
			for (const f of fields) touched[f.id] = true;
			return parsed.ok ? null : (parsed.missing[0] ?? null);
		},
		fill() {
			for (const f of fields) {
				values[f.id] = f.example;
				touched[f.id] = false;
			}
		},
		clear() {
			for (const f of fields) {
				values[f.id] = '';
				touched[f.id] = false;
			}
			lastAnnounced = null;
			opts.announce(SHARED_TOOL_COPY.cleared);
		}
	};
}

export type CalculatorForm = ReturnType<typeof createCalculatorForm>;
