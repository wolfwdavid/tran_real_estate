/**
 * Renter affordability math (RENT-08).
 *
 * General guideline math only. No persistence, no I/O (Phase 10 reuses this on a marketing page).
 * Zero API calls: everything is derived from the income the visitor types.
 *
 * Model (UI-SPEC AffordabilityCalculator), with M = gross monthly income:
 *   25% of M to 30% of M is the guideline band, capped by a debt check of
 *   40% of M minus monthly debts. Landlords commonly ask for yearly income of
 *   40x the rent, and move-in usually takes about two months of rent in cash.
 */

export type IncomePeriod = 'year' | 'month';
export type MoneyParse = number | null | { error: 'invalid' | 'negative' };

const MONEY_RE = /^(?:\d+\.?\d*|\.\d+)$/;

/**
 * Parses a typed dollar amount. Strips `$`, `,` and spaces. Blank input means
 * no value yet (`null`); anything else that is not a plain decimal (e.g. `'$'`,
 * `'1e5'`) is invalid, so callers never see NaN.
 */
export function parseMoneyInput(s: string): MoneyParse {
	if (s.trim() === '') return null;
	const cleaned = s.replace(/[$,\s]/g, '');
	const negative = cleaned.startsWith('-');
	const digits = negative ? cleaned.slice(1) : cleaned;
	if (!MONEY_RE.test(digits)) return { error: 'invalid' };
	const value = Number(digits);
	if (!Number.isFinite(value)) return { error: 'invalid' };
	if (negative && value !== 0) return { error: 'negative' };
	return value;
}

/** Nearest 25 dollars, ties up. */
export const round25 = (x: number): number => Math.round(x / 25) * 25;
/** Down to the 25 dollars below. */
export const floor25 = (x: number): number => Math.floor(x / 25) * 25;

export const RENT_LOW_SHARE = 0.25;
export const RENT_HIGH_SHARE = 0.3;
export const DEBT_CHECK_SHARE = 0.4;

export interface AffordabilityInput {
	income: number | null;
	period: IncomePeriod;
	debts: number;
	savings: number;
}

export interface AffordabilityResult {
	monthlyIncome: number;
	pct25: number;
	pct30: number;
	debtCheck: number;
	low: number;
	high: number;
	onlyTop: boolean;
	debtsNote: boolean;
	savingsCoverRentUpTo: number;
}

/** The guideline rent range for an income, or `null` until a positive income is entered. */
export function affordability(i: AffordabilityInput): AffordabilityResult | null {
	const { income } = i;
	if (income === null || !Number.isFinite(income) || income <= 0) return null;
	const debts = Number.isFinite(i.debts) && i.debts > 0 ? i.debts : 0;
	const savings = Number.isFinite(i.savings) && i.savings > 0 ? i.savings : 0;
	const M = i.period === 'year' ? income / 12 : income;
	const pct25 = 0.25 * M;
	const pct30 = 0.3 * M;
	const debtCheck = Math.max(0, 0.4 * M - debts);
	const low = round25(pct25);
	const high = round25(Math.min(pct30, debtCheck));
	return {
		monthlyIncome: M,
		pct25,
		pct30,
		debtCheck,
		low,
		high,
		onlyTop: high < low,
		debtsNote: debtCheck < pct25,
		savingsCoverRentUpTo: floor25(savings / 2)
	};
}

export type RentFeedbackKind = 'within' | 'above30' | 'aboveDebt';

/**
 * Feedback for a "try a rent amount" value. Percentages are rounded for
 * display; the thresholds compare the unrounded ratios.
 */
export function rentFeedback(
	rent: number,
	monthlyIncome: number,
	debts: number
): { kind: RentFeedbackKind; rentPct: number; totalPct: number } {
	const rentRatio = rent / monthlyIncome;
	const totalRatio = (rent + debts) / monthlyIncome;
	const kind: RentFeedbackKind =
		totalRatio > DEBT_CHECK_SHARE
			? 'aboveDebt'
			: rentRatio > RENT_HIGH_SHARE
				? 'above30'
				: 'within';
	return { kind, rentPct: Math.round(rentRatio * 100), totalPct: Math.round(totalRatio * 100) };
}

/** Yearly income a landlord commonly looks for: rent * 40. */
export const landlordIncome = (rent: number): number => rent * 40;
/** Cash to move in: first month plus a deposit of about one month. */
export const moveInCash = (rent: number): number => rent * 2;

/** Slider upper bound: max(10,000, 2 x top), rounded up to the next 500. */
export function sliderMax(top: number): number {
	return Math.ceil(Math.max(10000, 2 * top) / 500) * 500;
}
