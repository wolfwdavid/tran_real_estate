const countFormat = new Intl.NumberFormat('en-US');
const usdFormat = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const monthDayFormat = new Intl.DateTimeFormat('en-US', {
	month: 'short',
	day: 'numeric',
	timeZone: 'UTC'
});

/** 1000 -> "1,000" */
export function formatCount(n: number): string {
	return countFormat.format(n);
}

/** 0.2 -> "$0.20" */
export function formatUsd(n: number): string {
	return usdFormat.format(n);
}

/** UTC month and day, e.g. "Nov 1". */
export function formatMonthDay(epochMs: number): string {
	return monthDayFormat.format(epochMs);
}
