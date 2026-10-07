// Market Snapshot print copy (09-UI-SPEC "Report label decision" and Copywriting "Market Snapshot
// print"). Verbatim strings plus the small builders that fill in dates, names and counts from a
// frozen SnapshotRecord. The label never names the banned terms: it says "comparative market
// analysis" and "professional valuation" in full (Phase 2 precedent, no allowlist). Pure and
// DOM-free, ASCII-only source.
import { providerById, type ProviderId } from '@tran/core';
import { formatCount } from '@tran/core/budget';
import { longDate, NOT_AVAILABLE } from '@tran/core/format';
import type { SnapshotRecord } from '$lib/storage/studio/types';

export const SHORT_LABEL =
	'Market information only. Not a comparative market analysis or a professional valuation of any property.';

export const EHO_TITLE = 'Equal Housing Opportunity.';
export const EHO_STATEMENT =
	'We are pledged to the letter and spirit of U.S. policy for the achievement of equal housing opportunity throughout the Nation.';
export const TRAN_FOOTER = 'Prepared with Tran Real Estate Tools.';
export const SAMPLE_FOOTER = 'Sample data, not a real market.';
export const SAMPLE_SENTENCE =
	'Sample data: the ZIP code statistics, listings summary, and agent details in this printout are made up.';
export const NOTES_AI_NOTE = (agentName: string): string =>
	`Drafted with AI assistance from the figures above and reviewed by ${agentName}.`;
export const PRINT_HELP =
	"In the print dialog, choose Save as PDF as the destination. This toolbar won't appear on the page.";

/** "Mon D, YYYY" (UTC) for an ISO timestamp or YYYY-MM-DD date; the em dash when unparseable. */
export function reportDate(iso: string | null | undefined): string {
	if (!iso) return NOT_AVAILABLE;
	const d = new Date(iso);
	return Number.isFinite(d.getTime()) ? longDate(d) : NOT_AVAILABLE;
}

/** The full report label for the Important block. `notes` only when Market notes are printed. */
export function fullLabel(asOf: string, notes: { agentName: string } | null): string {
	const base =
		`This report summarizes listing-based market statistics from RentCast as of ${reportDate(asOf)}. ` +
		'It is market information only. It is not a comparative market analysis, a professional valuation of any property, or investment, legal, or tax advice. ' +
		'Figures are estimates from listings data, may not include every property, and can be wrong.';
	return notes
		? `${base} The market notes were drafted with AI assistance from the figures in this report and reviewed by ${notes.agentName}.`
		: base;
}

/** True when the record prints its Market notes section (enabled and non-empty). */
export function notesPrinted(r: SnapshotRecord): boolean {
	return (
		r.options.sections.includes('marketNotes') &&
		r.narrative !== null &&
		r.narrative.text.trim() !== ''
	);
}

/** "{Provider} {model}" for the notes provenance, or null when the record carries neither. */
function notesModel(r: SnapshotRecord): string | null {
	const n = r.narrative;
	if (!n) return null;
	const provider = n.provider ? (providerById(n.provider as ProviderId)?.label ?? n.provider) : '';
	const label = [provider, n.model ?? ''].filter((s) => s.trim() !== '').join(' ');
	return label === '' ? null : label;
}

/** The Data sources sentence, built only from the frozen record. */
export function dataSourcesSentence(r: SnapshotRecord): string {
	let out = `Market statistics from RentCast, retrieved ${reportDate(r.fetchedAt)}, based on listings RentCast saw in ZIP ${r.zip}.`;
	const s = r.listingsSample;
	if (s) {
		const kind = s.kind === 'sale' ? 'for-sale' : 'rental';
		out += ` The active listings summary uses ${formatCount(s.total)} RentCast ${kind} listings seen ${reportDate(r.listingsFetchedAt ?? s.seenAt)}.`;
	}
	if (notesPrinted(r) && r.narrative) {
		if (r.narrative.sampleOutput) {
			out += ' Market notes are sample output written in advance.';
		} else {
			const model = notesModel(r);
			out += model
				? ` Market notes drafted with ${model}.`
				: ' Market notes drafted with AI assistance.';
		}
	}
	if (r.sample) out += ' All figures and agent details in this sample report are made up.';
	return out;
}

/** "Prepared {Mon D, YYYY} by {Agent name}, {Brokerage}" (parts that are empty are left out). */
export function preparedLine(createdAt: string, agentName: string, brokerage: string): string {
	const who = [agentName.trim(), brokerage.trim()].filter(Boolean).join(', ');
	const date = reportDate(createdAt);
	return who === '' ? `Prepared ${date}` : `Prepared ${date} by ${who}`;
}

/** The printout's document title (also the browser's PDF file name). */
export function snapshotDocumentTitle(r: SnapshotRecord): string {
	return `Market Snapshot - ZIP ${r.zip} - ${r.createdAt.slice(0, 10)}`;
}
