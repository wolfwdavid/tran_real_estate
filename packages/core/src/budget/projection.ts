import { daysInPeriod } from './period';

/** Projected billed calls by period end, extrapolated from the UTC day-of-month (min 1). */
export function projectedBurn(billed: number, now: number): number {
	const elapsedDays = Math.max(1, new Date(now).getUTCDate());
	return Math.round((billed / elapsedDays) * daysInPeriod(now));
}
