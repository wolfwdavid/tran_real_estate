/**
 * Cap and meter rules. Every threshold the UI shows is one of these exported
 * constants (RESEARCH Pitfall 16): never re-declare them in components.
 */

/** RentCast Developer (free) plan: calls per month before overage. */
export const PLAN_LIMIT = 50;
/** Default self-imposed hard cap, leaving headroom below the plan limit. */
export const DEFAULT_CAP = 40;
export const CAP_MIN = 1;
export const CAP_MAX = 1000;
/** RentCast Developer-plan overage price per request, in USD. */
export const OVERAGE_USD = 0.2;
/** The meter turns 'near' when calls left under the cap are <= nearMaxLeft. */
export const METER_THRESHOLDS = { nearMaxLeft: 5 } as const;

export type CapValidation =
	| { ok: true; value: number; aboveLimit: boolean }
	| { ok: false; error: 'empty' | 'not-integer' | 'below-min' | 'above-max' };

export function validateCap(input: string): CapValidation {
	const s = input.trim();
	if (s === '') return { ok: false, error: 'empty' };
	if (!/^-?\d+$/.test(s)) return { ok: false, error: 'not-integer' };
	const n = Number(s);
	if (n < CAP_MIN) return { ok: false, error: 'below-min' };
	if (n > CAP_MAX) return { ok: false, error: 'above-max' };
	return { ok: true, value: n, aboveLimit: n > PLAN_LIMIT };
}

/** The typed confirmation word for raising the cap above the plan limit. */
export const matchesOverageWord = (input: string): boolean =>
	input.trim().toLowerCase() === 'overage';

/** True when spending `cost` more calls stays within the cap. */
export const canSpend = (used: number, cap: number, cost = 1): boolean => used + cost <= cap;

export type MeterState = 'ok' | 'near' | 'at' | 'past';

export function meterState(used: number, cap: number, planLimit = PLAN_LIMIT): MeterState {
	if (used >= planLimit) return 'past';
	if (used >= cap) return 'at';
	if (cap - used <= METER_THRESHOLDS.nearMaxLeft) return 'near';
	return 'ok';
}

const RANK = { ok: 0, near: 1, at: 2, past: 3 } as const;

/**
 * The state to announce when the meter worsens. Returns null on first load
 * (prev === null), when nothing changed, or when the state improved.
 */
export function meterTransition(
	prev: MeterState | null,
	next: MeterState
): 'near' | 'at' | 'past' | null {
	if (prev === null || RANK[next] <= RANK[prev]) return null;
	return next === 'ok' ? null : next;
}

/** Which confirm dialog the next call needs: past-plan once that call exceeds the plan limit. */
export const confirmVariant = (
	used: number,
	planLimit = PLAN_LIMIT
): 'within-plan' | 'past-plan' => (used + 1 > planLimit ? 'past-plan' : 'within-plan');

/** Worst-case overage in USD if every call up to `cap` is spent (integer-cents math). */
export const overageCostUsd = (cap: number): number =>
	(Math.max(cap - PLAN_LIMIT, 0) * Math.round(OVERAGE_USD * 100)) / 100;
