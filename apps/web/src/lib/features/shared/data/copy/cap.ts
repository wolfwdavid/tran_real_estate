import { formatCount, formatUsd, overageCostUsd, PLAN_LIMIT } from '@tran/core/budget';

// Verbatim cap and over-cap confirmation copy (04-UI-SPEC "CapConfirmDialog", "CapAboveLimitDialog",
// "RentCast usage section"). Components never inline these strings.

const PLAN = formatCount(PLAN_LIMIT);
const PER_CALL = '$0.20';

// CapConfirmDialog -------------------------------------------------------------------------------

export const CONFIRM_TITLE = 'This call goes past your cap';

/** Variant A: the call stays inside the 50-call plan. */
export const confirmBodyA = (cap: number, used: number): string =>
	`You set a cap of ${formatCount(cap)} calls this month, and you've used ${formatCount(used)}. This call is still inside the ${PLAN} calls in RentCast's free plan, so it doesn't add a charge. RentCast bills overage at ${PER_CALL} per call, charged to your card if your RentCast account has one on file, once you pass ${PLAN}.`;

/** Variant B: the call would be number 51 or later this month. */
export const confirmBodyB = (used: number): string =>
	`This would be call ${formatCount(used + 1)} this month, past the ${PLAN} in RentCast's free plan. RentCast bills overage at ${PER_CALL} per call. If your RentCast account has a card on file, RentCast charges this call to your card. Tran never bills you. Without a card, RentCast may refuse the call.`;

/** Fact list rows: "Used this month: {U} of 50" · "Your cap: {C}" · "This action: 1 call". */
export const facts = (used: number, cap: number): { term: string; value: string }[] => [
	{ term: 'Used this month', value: `${formatCount(used)} of ${PLAN}` },
	{ term: 'Your cap', value: formatCount(cap) },
	{ term: 'This action', value: '1 call' }
];

export const NOT_NOW = 'Not now';
export const SPEND_ANYWAY = 'Spend 1 call anyway';
export const SPENDING = 'Spending…';
export const NOTHING_SPENT = 'Nothing was spent.';

// CapAboveLimitDialog ----------------------------------------------------------------------------

export const ABOVE_TITLE = "Allow calls past RentCast's free 50?";

export const aboveBody = (n: number): string =>
	`A cap of ${formatCount(n)} lets Tran make up to ${formatCount(n - PLAN_LIMIT)} calls a month past the ${PLAN} in RentCast's free plan. If your RentCast account has a card on file, RentCast bills each of those calls at ${PER_CALL}, charged to your card. That's up to ${formatUsd(overageCostUsd(n))} a month. Tran never bills you. If you're on a paid RentCast plan, check its limits and prices at RentCast.`;

export const TYPE_LABEL = 'Type overage to confirm';
export const typeError = (old: number): string =>
	`Type the word overage to confirm, or choose Keep cap at ${formatCount(old)}.`;
export const keepCap = (old: number): string => `Keep cap at ${formatCount(old)}`;
export const setCap = (n: number): string => `Set cap to ${formatCount(n)}`;
export const SAVING = 'Saving…';

// CapEditor (RentCast usage section) -------------------------------------------------------------

export const CAP_LABEL = 'Monthly call cap';
export const CAP_SUFFIX = 'calls a month';
export const SAVE_CAP = 'Save cap';

export const helperWithin = (n: number): string =>
	`Tran stops before call ${formatCount(n + 1)} and asks you first. RentCast's free plan includes ${PLAN} calls a month. We suggest 40, which leaves room for a few extra searches.`;

export const HELPER_ABOVE =
	"That's more than the 50 calls in RentCast's free plan. You'll be asked to confirm, because RentCast can bill calls past 50.";

export const CAP_ERRORS = {
	empty: 'Enter a number of calls, from 1 to 1,000.',
	'not-integer': 'Use a whole number, like 40.',
	'below-min':
		'The cap has to be at least 1. To stop all RentCast calls, choose Sample data below.',
	'above-max': 'Enter 1,000 or less.'
} as const;

export const capSaved = (n: number): string => `Cap saved: ${formatCount(n)} calls a month.`;

export const belowUsage = (u: number): string =>
	`You've already used ${formatCount(u)} calls this month, so the next call will ask first.`;

/** [D] Discretionary: the UI-SPEC gives no copy for a failed cap write. */
export const SAVE_FAILED = "Couldn't save your cap. Try again.";
