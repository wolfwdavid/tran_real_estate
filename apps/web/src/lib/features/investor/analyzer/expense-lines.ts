// Pure helpers behind ExpenseLines.svelte (07-10): unit conversion with its announcement and the
// per-line computed text. Kept DOM-free so the copy and the math are unit tested without a browser.

import {
	convertExpenseUnit,
	divRoundHalfAway,
	lineMonthlyCents,
	type DealAnalysis,
	type LineContext
} from '@tran/core/finance';
import { pctTrim, usd } from '@tran/core/format';
import { bpsToText, centsToText, lineFromForm, type ExpenseLineForm } from './form-model';

export const UNIT_LABELS = { pct: '% of rent', usd: '$ per month' } as const;

/** The name used in announcements and "Remove {name}". */
export function lineLabel(line: ExpenseLineForm): string {
	return line.name.trim() || 'This expense line';
}

/**
 * The bases each percent line uses. From the analysis when there is one; otherwise rent stands in
 * for gross and collected income (the analysis exists whenever price and rent are both valid).
 */
export function lineContext(analysis: DealAnalysis | null, rentCents: number | null): LineContext {
	if (analysis) {
		return {
			rentCents: rentCents ?? 0,
			gsiCents: analysis.gsiMonthly,
			egiCents: analysis.egiMonthly
		};
	}
	const rent = rentCents ?? 0;
	return { rentCents: rent, gsiCents: rent, egiCents: rent };
}

/**
 * Switches a line's unit keeping its monthly dollars (core convertExpenseUnit) and builds the
 * UI-SPEC announcement: "{Line} changed to {unit}. Still ${amount} a month." When the amount is
 * blank or invalid, or the base is $0 (dollars to percent), the amount becomes blank and the
 * announcement is the short "{Line} changed to {unit}."
 */
export function convertLineUnit(
	line: ExpenseLineForm,
	to: 'pct' | 'usd',
	ctx: LineContext
): { line: ExpenseLineForm; message: string } {
	const head = `${lineLabel(line)} changed to ${UNIT_LABELS[to]}.`;
	const parsed = lineFromForm(line);
	if (line.unit === to) return { line, message: head };
	if (!parsed) return { line: { ...line, unit: to, amount: '' }, message: head };

	const next = convertExpenseUnit(parsed, to, ctx);
	const value = next.unit === 'pct' ? next.bps : next.cents;
	if (value === null) return { line: { ...line, unit: to, amount: '' }, message: head };

	const amount = next.unit === 'pct' ? bpsToText(value) : centsToText(value);
	const monthly = lineMonthlyCents(next, ctx);
	return {
		line: { ...line, unit: to, amount },
		message: `${head} Still ${usd(monthly)} a month.`
	};
}

/**
 * The computed line under each row: "= $160 a month" for percent lines, "= 10% of rent" for
 * dollar lines (only when rent is entered). Null when there is nothing meaningful to show.
 */
export function computedText(
	line: ExpenseLineForm,
	analysis: DealAnalysis | null,
	rentCents: number | null
): string | null {
	const parsed = lineFromForm(line);
	if (!parsed) return null;
	if (parsed.unit === 'pct') {
		if (parsed.bps === null) return null;
		const fromAnalysis = analysis?.lines.find((l) => l.id === line.id)?.monthlyCents;
		const ctx = lineContext(analysis, rentCents);
		if (fromAnalysis === undefined && ctx.rentCents === 0) return null;
		return `= ${usd(fromAnalysis ?? lineMonthlyCents(parsed, ctx))} a month`;
	}
	if (parsed.cents === null || !rentCents) return null;
	return `= ${pctTrim(divRoundHalfAway(parsed.cents * 10000, rentCents))} of rent`;
}
