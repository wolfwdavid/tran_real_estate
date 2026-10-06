// The only spend path for market statistics in UI code (INV-05). loadMarket runs from click
// handlers (Watch ZIP, Refresh); readMarketOnMount is the free read views use when they open.
//
// Over-cap: the port spends through runtime.requestSpend, whose CapPrompt (rendered once by
// DataShell as CapConfirmDialog) already asks before going past the cap and issues the single-use
// grant itself. When the user answers "Not now" the request rejects with BudgetCapReached
// (detail 'dismissed'): nothing was spent, so callers keep what is on screen. Any other
// BudgetCapReached (a second over-cap request while a prompt is open) is shown with GatewayError,
// whose "Continue past cap" action calls `retry`, which asks again through the same prompt.
import { isGatewayError, type GatewayError } from '$lib/data';
import type { MarketResult, MarketsPort } from './markets-port';

export type LoadOutcome =
	| { ok: true; result: MarketResult }
	| {
			ok: false;
			kind: 'cap';
			error: GatewayError;
			/** true when the user said "Not now" on the over-cap prompt (nothing was spent). */
			dismissed: boolean;
			retry: () => Promise<LoadOutcome>;
	  }
	| { ok: false; kind: 'error'; error: unknown };

/** Click handlers only: fresh cache or one call (refresh: always one call). Never throws. */
export async function loadMarket(
	port: MarketsPort,
	zip: string,
	opts: { refresh?: boolean } = {}
): Promise<LoadOutcome> {
	try {
		return { ok: true, result: await port.load(zip, opts) };
	} catch (error) {
		if (isGatewayError(error) && error.kind === 'BudgetCapReached') {
			return {
				ok: false,
				kind: 'cap',
				error,
				dismissed: error.detail === 'dismissed',
				retry: () => loadMarket(port, zip, opts)
			};
		}
		return { ok: false, kind: 'error', error };
	}
}

/**
 * The free read a view does when it opens, the same in both modes: peek only. In live mode peek
 * reads the 30-day cache; in sample mode the gateway answers peek from the in-memory fixtures, so the
 * sample read is 0 calls by construction without going through the spend path. A cached error
 * (for example RentCast's 404 for a ZIP with no data) is thrown for the caller to render.
 */
export async function readMarketOnMount(
	port: MarketsPort,
	zip: string
): Promise<MarketResult | undefined> {
	return port.peek(zip);
}
