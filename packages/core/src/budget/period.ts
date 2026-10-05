/**
 * Billing period math. The RentCast free-tier period is treated as the UTC
 * calendar month (RESEARCH Open Question 5). The clock is always a parameter.
 */

function assertRenewalDay(renewalDay: number): void {
	if (renewalDay !== 1) {
		throw new RangeError('renewalDay other than 1 is not supported in v1');
	}
}

/** 'YYYY-MM' of the UTC calendar month containing `now`. */
export function periodKey(now: number, renewalDay = 1): string {
	assertRenewalDay(renewalDay);
	const d = new Date(now);
	const month = String(d.getUTCMonth() + 1).padStart(2, '0');
	return `${d.getUTCFullYear()}-${month}`;
}

/** Epoch ms of the next period start: the 1st of the next UTC month, 00:00:00.000Z. */
export function resetsAt(now: number, renewalDay = 1): number {
	assertRenewalDay(renewalDay);
	const d = new Date(now);
	return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
}

/** Number of days in the UTC calendar month containing `now`. */
export function daysInPeriod(now: number): number {
	const d = new Date(now);
	return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
}
