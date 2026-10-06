// THE single display formatter for investor figures (INV-01). Every money, percent, ratio and date
// string the investor portal shows, and every figure the AI narration post-check parses back, comes
// from this module. Do not hand-roll another formatter: the post-check parser must round-trip
// exactly these strings.
//
// Rules (07-UI-SPEC Typography):
// - Money is whole dollars; cents are rounded half away from zero, exactly, from integer cents.
// - Negatives use a true minus sign (U+2212), never parentheses and never an ASCII hyphen.
// - A value that rounds to zero is shown unsigned ("$0", "0.0%").
// - Ranges read "$1,700 to $2,000". A missing value is an em dash (NOT_AVAILABLE).
// - Dates are calendar dates formatted in UTC.

import { divRoundHalfAway, type Cents } from '../finance/money.js';

export const MINUS = '\u2212';
export const NOT_AVAILABLE = '\u2014';

const USD_WHOLE = new Intl.NumberFormat('en-US', {
	style: 'currency',
	currency: 'USD',
	minimumFractionDigits: 0,
	maximumFractionDigits: 0
});
const FIXED = {
	1: new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
	2: new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
} as const;
const RATE = new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 });
const MONTH_YEAR = new Intl.DateTimeFormat('en-US', {
	month: 'short',
	year: 'numeric',
	timeZone: 'UTC'
});
const LONG_DATE = new Intl.DateTimeFormat('en-US', {
	month: 'short',
	day: 'numeric',
	year: 'numeric',
	timeZone: 'UTC'
});

/** True when a formatted number has a non-zero digit (so a sign is meaningful). */
const hasNonZeroDigit = (s: string): boolean => /[1-9]/.test(s);

/** Integer cents as whole dollars: 185000 -> "$1,850"; -14200 -> "−$142"; -40 -> "$0". */
export function usd(cents: Cents): string {
	const dollars = divRoundHalfAway(Math.abs(cents), 100);
	const text = USD_WHOLE.format(dollars);
	return cents < 0 && dollars > 0 ? MINUS + text : text;
}

/** "$1,700 to $2,000" */
export function usdRange(loCents: Cents, hiCents: Cents): string {
	return `${usd(loCents)} to ${usd(hiCents)}`;
}

/** Fixed decimals, half away from zero (Intl halfExpand), U+2212 for non-zero negatives. */
function signedFixed(value: number, dp: 1 | 2): string {
	const digits = FIXED[dp].format(Math.abs(value));
	return value < 0 && hasNonZeroDigit(digits) ? MINUS + digits : digits;
}

/** Percent value (already x100): 6.43 -> "6.4%" (dp 1); 0.8213 -> "0.82%" (dp 2). */
export function pct(value: number, dp: 1 | 2): string {
	return `${signedFixed(value, dp)}%`;
}

/** Basis points with trailing zeros trimmed: 2000 -> "20%", 550 -> "5.5%", 525 -> "5.25%". */
export function pctTrim(bps: number): string {
	const sign = bps < 0 ? MINUS : '';
	const abs = Math.abs(Math.trunc(bps));
	const whole = Math.trunc(abs / 100);
	const frac = String(abs % 100)
		.padStart(2, '0')
		.replace(/0+$/, '');
	return `${sign}${whole}${frac ? `.${frac}` : ''}%`;
}

/** Unitless ratio (DSCR, GRM): 1.172403 -> "1.17" (dp 2); -0.2818 -> "−0.28". */
export function ratio(value: number, dp: 1 | 2): string {
	return signedFixed(value, dp);
}

/** Interest rate label, up to 3 decimals: 7 -> "7%", 7.125 -> "7.125%". */
export function rateLabel(pctValue: number): string {
	return `${RATE.format(pctValue)}%`;
}

/** 'YYYY-MM' or a Date -> "Oct 2025" (UTC). */
export function monthYear(ym: string | Date): string {
	if (typeof ym === 'string') {
		const m = /^(\d{4})-(\d{2})/.exec(ym);
		if (!m) return NOT_AVAILABLE;
		return MONTH_YEAR.format(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1));
	}
	return MONTH_YEAR.format(ym);
}

/** Date or epoch ms -> "Oct 1, 2026" (UTC). */
export function longDate(d: Date | number): string {
	return LONG_DATE.format(d);
}
