// The live cost of one action for its button's CostLabel (DATA-02/04: every call-spending action
// shows its cost first). Reads gateway.estimateCost only (cache lookup, 0 calls); it never calls
// get/refresh, so it is safe inside $effect. Call during component initialisation.
import type { CostEstimate, DataGateway, DataRequest } from '$lib/data';

export interface CostSource {
	gateway: DataGateway | null;
	/** null: no valid request yet (e.g. an empty location box). */
	request: DataRequest | null;
	/** Re-estimate whenever this changes (the controller bumps it after each load). */
	version: number;
}

export function createCostEstimate(source: () => CostSource) {
	let current = $state<CostEstimate | null>(null);

	$effect(() => {
		const { gateway, request } = source();
		if (!gateway) {
			current = null;
			return;
		}
		if (!request) {
			// Any new location costs one call live; sample data is always free.
			current =
				gateway.source === 'sample'
					? { calls: 0, reason: 'sample' }
					: { calls: 1, reason: 'network' };
			return;
		}
		let cancelled = false;
		gateway.estimateCost(request).then(
			(e) => {
				if (!cancelled) current = e;
			},
			() => {
				if (!cancelled) current = null;
			}
		);
		return () => {
			cancelled = true;
		};
	});

	return {
		get current() {
			return current;
		}
	};
}
