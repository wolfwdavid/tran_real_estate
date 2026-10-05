import type { LlmUsage, PricingRow } from './types.js';

/**
 * The pricing row in effect at `at`: the row with the latest `from` that is on
 * or before the UTC calendar date of `at`. Row order does not matter.
 */
export function pricingAt(
	rows: readonly PricingRow[] | undefined,
	at: Date
): PricingRow | undefined {
	if (!rows) return undefined;
	const day = at.toISOString().slice(0, 10);
	let best: PricingRow | undefined;
	for (const row of rows) {
		if (row.from <= day && (!best || row.from > best.from)) best = row;
	}
	return best;
}

/**
 * Estimated cost in USD. A provider-reported cost is used as-is; otherwise the
 * date-effective pricing row is applied. Unknown pricing returns undefined so
 * no cost is ever fabricated. `outputTokens` is already the billed output
 * (adapters fold reasoning/thinking in), so `reasoningTokens` is not added again.
 */
export function estimateCostUsd(
	usage: LlmUsage | undefined,
	rows: readonly PricingRow[] | undefined,
	at: Date
): number | undefined {
	if (!usage) return undefined;
	if (typeof usage.costUsd === 'number') return usage.costUsd;
	const row = pricingAt(rows, at);
	if (!row) return undefined;
	return (
		((usage.inputTokens ?? 0) * row.inUsdPerMTok + (usage.outputTokens ?? 0) * row.outUsdPerMTok) /
		1_000_000
	);
}

const USD = new Intl.NumberFormat('en-US', {
	style: 'currency',
	currency: 'USD',
	minimumFractionDigits: 2,
	maximumFractionDigits: 2
});

/** USD with two decimals; amounts above zero but under one cent read "less than $0.01". */
export function formatUsd(n: number): string {
	if (n === 0) return '$0.00';
	if (n > 0 && n < 0.01) return 'less than $0.01';
	return USD.format(n);
}
