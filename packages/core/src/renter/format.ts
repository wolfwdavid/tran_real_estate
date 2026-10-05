// Shared renter formatters (RENT-03): money, dates and relative times read the same on every
// renter surface. Renter money has no cents. Dates are calendar dates, formatted in UTC.

import { utcDayDiff } from './filters.js';

const USD = new Intl.NumberFormat('en-US', {
	style: 'currency',
	currency: 'USD',
	maximumFractionDigits: 0
});
const INT = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const MONTH_DAY = new Intl.DateTimeFormat('en-US', {
	month: 'short',
	day: 'numeric',
	timeZone: 'UTC'
});
const MONTH_DAY_YEAR = new Intl.DateTimeFormat('en-US', {
	month: 'short',
	day: 'numeric',
	year: 'numeric',
	timeZone: 'UTC'
});
const MONTH_YEAR = new Intl.DateTimeFormat('en-US', {
	month: 'short',
	year: 'numeric',
	timeZone: 'UTC'
});

/** Days at or under which relativeListed says "N days ago"; older dates are shown in full. */
const RELATIVE_MAX_DAYS = 30;

const finite = (n: number | null | undefined): n is number =>
	typeof n === 'number' && Number.isFinite(n);

/** The YYYY-MM-DD date part of an ISO string as a UTC-midnight epoch, or null. */
function utcDay(iso: string | null | undefined): number | null {
	if (typeof iso !== 'string') return null;
	const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
	if (!m) return null;
	const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
	return Number.isNaN(t) ? null : t;
}

const dateFormatter = (f: Intl.DateTimeFormat) => (iso: string | null | undefined) => {
	const t = utcDay(iso);
	return t === null ? null : f.format(t);
};

export function formatRent(n: number | null | undefined): string | null {
	return finite(n) ? USD.format(n) : null;
}

/** "Oct 2" */
export const formatMonthDay = dateFormatter(MONTH_DAY);
/** "Sep 28, 2026" */
export const formatMonthDayYear = dateFormatter(MONTH_DAY_YEAR);
/** "Oct 2026" */
export const formatMonthYear = dateFormatter(MONTH_YEAR);

/** "today" | "yesterday" | "N days ago" | "on Sep 1, 2026" */
export function relativeListed(iso: string | null | undefined, now: Date): string | null {
	if (!iso) return null;
	const days = utcDayDiff(now, iso);
	if (Number.isNaN(days)) return null;
	if (days <= 0) return 'today';
	if (days === 1) return 'yesterday';
	if (days <= RELATIVE_MAX_DAYS) return `${days} days ago`;
	return `on ${formatMonthDayYear(iso)}`;
}

export function formatSqft(n: number | null | undefined): string | null {
	return finite(n) ? INT.format(n) : null;
}

/** One decimal place: "0.4 mi" */
export function formatDistance(miles: number | null | undefined): string | null {
	return finite(miles) ? `${miles.toFixed(1)} mi` : null;
}

/** Whole number: "6%" */
export function formatPercent(n: number | null | undefined): string | null {
	return finite(n) ? `${Math.round(n)}%` : null;
}
