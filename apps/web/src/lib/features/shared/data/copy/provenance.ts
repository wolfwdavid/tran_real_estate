// Provenance, cost and new-since copy, verbatim from 04-UI-SPEC "ProvenanceChip, CostLabel,
// NewSinceBadge" and "Live-region announcements". `·` is U+00B7 and `…` is U+2026.
import { formatCount } from '@tran/core/budget';
import type { Provenance } from '@tran/core/request';

/**
 * Structural twin of the gateway's CostEstimate (04-13), declared here so the primitives do not
 * depend on the gateway module.
 */
export interface CostEstimate {
	calls: number;
	reason: 'sample' | 'cached' | 'network';
}

export const CHIP_SAMPLE = 'Sample data';
export const CHIP_LIVE_PREFIX = 'RentCast · as of ';
export const CHIP_STALE_SUFFIX = ' · may be out of date';

export const REFRESH_LABEL = 'Refresh';
export const REFRESHING = 'Refreshing…';
export const REFRESH_DONE = 'Refreshed from RentCast. 1 call used.';

export const NO_NEW_LISTINGS = 'No new listings';

/** "Sample data" · "RentCast · as of {relative}" · "… · may be out of date". */
export function chipText(p: Provenance, relative: string): string {
	if (p.source === 'sample') return CHIP_SAMPLE;
	return CHIP_LIVE_PREFIX + relative + (p.stale ? CHIP_STALE_SUFFIX : '');
}

/** "(1 call)" · "({n} calls)" · "(0 calls · cached)" · "(0 calls · sample data)" · "(0 calls)". */
export function formatCost(estimate: CostEstimate | 'free'): string {
	if (estimate === 'free') return '(0 calls)';
	if (estimate.reason === 'cached') return '(0 calls · cached)';
	if (estimate.reason === 'sample') return '(0 calls · sample data)';
	const n = estimate.calls;
	return n === 1 ? '(1 call)' : `(${formatCount(n)} calls)`;
}

/** "{n} new since your last visit" or "No new listings". */
export function newSinceText(newCount: number): string {
	return newCount > 0 ? `${formatCount(newCount)} new since your last visit` : NO_NEW_LISTINGS;
}

export interface DiffCounts {
	new: number;
	priceChanged: number;
	gone: number;
}

/** "{n} new, {p} price changes, {g} no longer listed", omitting zero parts ("" when all zero). */
export function detailText(d: DiffCounts): string {
	const parts: string[] = [];
	if (d.new > 0) parts.push(`${formatCount(d.new)} new`);
	if (d.priceChanged > 0) {
		parts.push(
			d.priceChanged === 1 ? '1 price change' : `${formatCount(d.priceChanged)} price changes`
		);
	}
	if (d.gone > 0) parts.push(`${formatCount(d.gone)} no longer listed`);
	return parts.join(', ');
}

export const CHECKED_PREFIX = 'Checked ';

/** The words after `{relative}` in the checked line (lets the UI wrap `{relative}` in <time>). */
export function checkedSuffix(source: Provenance['source']): string {
	return source === 'rentcast' ? ' from RentCast' : ' (sample data)';
}

/** "Checked {relative} from RentCast" or "Checked {relative} (sample data)". */
export function checkedText(relative: string, source: Provenance['source']): string {
	return CHECKED_PREFIX + relative + checkedSuffix(source);
}
