// Exact integer-cents money primitives for the investor finance core (INV-01).
//
// Every money amount is an integer number of cents. Percentages that feed money math are integer
// basis points (1 bp = 0.01%). Rounding is half away from zero everywhere, and is applied once,
// at the point a fractional cent would otherwise appear. Display rounding lives in
// `@tran/core/format`, never here.

/** An integer number of US cents. */
export type Cents = number;

/** $100,000,000. Keeps `cents * bps` (bps <= 10,000) below 2^53, so the product is exact. */
export const MAX_CENTS = 10_000_000_000;

/** Turns -0 into 0 so results compare cleanly with `Object.is` and `toEqual`. */
const noNegZero = (n: number): number => n + 0;

/** Rounds a float half away from zero: 2.5 -> 3, -2.5 -> -3. */
export function roundHalfAway(x: number): number {
	return noNegZero(Math.sign(x) * Math.round(Math.abs(x)));
}

/**
 * Exact integer division rounded half away from zero. `num` must be a safe integer and `den` a
 * positive safe integer. The quotient comes from a truncating float division (exact enough at
 * these magnitudes) and the remainder is recomputed with integer arithmetic.
 */
export function divRoundHalfAway(num: number, den: number): number {
	const q = Math.trunc(num / den);
	const r = num - q * den;
	return noNegZero(Math.abs(r) * 2 >= den ? q + Math.sign(r) : q);
}

/**
 * `c * bps / 10000`, exact, rounded half away from zero.
 *
 * Why not the obvious float expression: the division by 10000 is inexact in binary floating point,
 * so a product that should land exactly on .5 can come out as .49999 or .50001 and round the
 * wrong way (see the banned form below). Math.round also rounds -2.5 to -2, toward +infinity,
 * not away from zero.
 * The product `c * bps` itself is an exact integer while |c| <= MAX_CENTS.
 */
// Banned form, kept only as a warning: Math.round(c * bps / 10000)
export function mulBps(c: Cents, bps: number): Cents {
	const n = c * bps;
	const q = Math.trunc(n / 10000);
	const r = n - q * 10000;
	return noNegZero(Math.abs(r) >= 5000 ? q + Math.sign(r) : q);
}

export type ParseError = 'not-a-number' | 'negative' | 'too-precise' | 'too-large' | 'out-of-range';

export type ParseResult<T> = { ok: true; value: T | null } | { ok: false; error: ParseError };

const ok = <T>(value: T | null): ParseResult<T> => ({ ok: true, value });
const fail = <T>(error: ParseError): ParseResult<T> => ({ ok: false, error });

/** Leading ASCII hyphen-minus or the typographic minus (U+2212). */
const NEGATIVE = /^[-−]/;
const MONEY_NUMBER = /^(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?$/;
const PLAIN_NUMBER = /^(\d+)(?:\.(\d+))?$/;

/** Parses the digit groups of a validated number into an integer scaled by 10^scale. */
function scaled(whole: string, frac: string, scale: number): number {
	const unit = 10 ** scale;
	return Number(whole) * unit + (scale === 0 ? 0 : Number(frac.padEnd(scale, '0')));
}

/**
 * Parses a user-typed dollar amount into cents with integer string math (never
 * `parseFloat(x) * 100`). Accepts "250000", "250,000", "$250,000", "$1,234.56". Blank -> null.
 */
export function parseMoneyInput(s: string): ParseResult<Cents> {
	let t = s.trim();
	if (t === '') return ok(null);
	if (t.startsWith('$')) t = t.slice(1).trim();
	if (NEGATIVE.test(t)) return fail('negative');
	const m = MONEY_NUMBER.exec(t);
	if (!m) return fail('not-a-number');
	const whole = m[1].replaceAll(',', '');
	const frac = m[2] ?? '';
	if (frac.length > 2) return fail('too-precise');
	// Compare the dollar part first so an absurdly long digit string can't lose precision.
	if (whole.replace(/^0+(?=\d)/, '').length > 12) return fail('too-large');
	const cents = scaled(whole, frac, 2);
	if (cents > MAX_CENTS) return fail('too-large');
	return ok(cents);
}

/** Shared percent parsing: optional trailing "%", no thousands separators. */
function parsePercentLike(s: string, maxDecimals: number): ParseResult<number> | number {
	let t = s.trim();
	if (t === '') return ok(null);
	if (t.endsWith('%')) t = t.slice(0, -1).trim();
	if (NEGATIVE.test(t)) return fail('negative');
	const m = PLAIN_NUMBER.exec(t);
	if (!m) return fail('not-a-number');
	const frac = m[2] ?? '';
	if (frac.length > maxDecimals) return fail('too-precise');
	if (m[1].replace(/^0+(?=\d)/, '').length > 6) return fail('out-of-range');
	return scaled(m[1], frac, maxDecimals);
}

/**
 * Parses a percent ("5", "5.5%", "5.25") into integer basis points. At most 2 decimals.
 * `min`/`max` are in percent and default to 0..100.
 */
export function parsePercentInput(
	s: string,
	opts: { min?: number; max?: number } = {}
): ParseResult<number> {
	const r = parsePercentLike(s, 2);
	if (typeof r !== 'number') return r;
	const min = Math.round((opts.min ?? 0) * 100);
	const max = Math.round((opts.max ?? 100) * 100);
	if (r < min || r > max) return fail('out-of-range');
	return ok(r);
}

/** Parses an annual interest rate in percent ("7", "7.125%"). At most 3 decimals, 0..25. */
export function parseRateInput(s: string): ParseResult<number> {
	const r = parsePercentLike(s, 3);
	if (typeof r !== 'number') return r;
	if (r > 25_000) return fail('out-of-range');
	// r is integer thousandths of a percent; dividing once gives the nearest double to the input.
	return ok(r / 1000);
}
