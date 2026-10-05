// Single-use permission to make ONE RentCast call past the cap, bound to one canonical request key.
// Never persisted, never remembered, never given to the scheduler (CONTEXT: confirmation is per call).
// Only objects minted by issueGrant() are honoured: a structurally identical literal is a forgery.

export interface OverCapGrant {
	readonly requestKey: string;
	readonly consumed: boolean;
}

interface MutableGrant {
	requestKey: string;
	consumed: boolean;
}

const ISSUED = new WeakSet<object>();

export function issueGrant(requestKey: string): OverCapGrant {
	const grant: MutableGrant = { requestKey, consumed: false };
	ISSUED.add(grant);
	return grant;
}

/** True exactly once, and only for an issued, unconsumed grant whose key matches. */
export function consumeGrant(grant: OverCapGrant | undefined, requestKey: string): boolean {
	if (!grant || !ISSUED.has(grant) || grant.consumed || grant.requestKey !== requestKey) {
		return false;
	}
	(grant as MutableGrant).consumed = true;
	return true;
}
