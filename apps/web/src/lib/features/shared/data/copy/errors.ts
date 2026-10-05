// GatewayError strings, verbatim from 04-UI-SPEC "GatewayError messages". Each taxonomy kind maps
// to exactly one message; 5xx (NetworkError detail 'server') has its own variant so the locked
// taxonomy stays unchanged.
import { formatCount, formatMonthDay } from '@tran/core/budget';
import type { GatewayError } from '@tran/core/request';

export type ErrorVariant = 'neutral' | 'destructive';

export interface ErrorCopy {
	title: string;
	body: string;
	variant: ErrorVariant;
}

export const ACTION_LABELS = {
	checkKey: 'Check your key in Settings',
	useSample: 'Use sample data instead',
	openDashboard: 'Open RentCast dashboard',
	tryAgain: 'Try again (1 call)',
	continuePastCap: 'Continue past cap…',
	changeCap: 'Change your cap',
	editSearch: 'Edit search'
} as const;

const NO_CALL = 'No call was counted.';
const NOT_COUNTED = "Tran didn't count a call for this.";

type ErrorLike = Pick<GatewayError, 'kind' | 'detail' | 'used' | 'cap' | 'resetsAt'>;

function titleAndBody(error: ErrorLike): [string, string] {
	switch (error.kind) {
		case 'InvalidKey':
			return [
				"RentCast didn't accept your key",
				`Check that you copied the whole key in Settings, or create a new one at RentCast. ${NO_CALL}`
			];
		case 'RestrictedKey':
			return [
				"Your RentCast key can't make this request",
				`RentCast recognized the key but refused this request. The key may be limited to other endpoints, or your RentCast account may need attention. Check the key's settings in your RentCast dashboard. ${NO_CALL}`
			];
		case 'RateLimited':
			return [
				'RentCast is busy right now',
				`Too many requests reached RentCast at once. Wait a few seconds, then try again. ${NO_CALL}`
			];
		case 'BudgetCapReached': {
			const used = formatCount(error.used ?? 0);
			const cap = formatCount(error.cap ?? 0);
			const resets = error.resetsAt === undefined ? '' : formatMonthDay(error.resetsAt);
			return [
				'Stopped at your monthly cap',
				`You've used ${used} of your ${cap}-call cap this month, so nothing was spent. Your count resets on ${resets} (UTC). You can continue for this one call, raise your cap, or keep browsing saved results.`
			];
		}
		case 'NoResults':
			return [
				'No results for this search',
				"RentCast has nothing that matches right now. Try a nearby ZIP code, a wider price range, or fewer filters. This answer is saved for 24 hours, so repeating the same search won't use a call."
			];
		case 'NetworkError':
			return error.detail === 'server'
				? [
						'RentCast had a problem answering',
						`This is on RentCast's side. Try again in a few minutes. ${NOT_COUNTED}`
					]
				: ["Couldn't reach RentCast", `Check your connection, then try again. ${NOT_COUNTED}`];
		case 'SchemaMismatch':
			return [
				"RentCast sent data Tran couldn't read",
				'RentCast may have changed the format of its results. This call was counted, because RentCast answered. Nothing was saved. Use sample data for now, and try again later.'
			];
	}
}

/** The one title, body and treatment for a gateway error. */
export function errorCopy(error: ErrorLike): ErrorCopy {
	const [title, body] = titleAndBody(error);
	return { title, body, variant: error.kind === 'NoResults' ? 'neutral' : 'destructive' };
}

/** Announced at the start and end of a 429 wait, never per tick. */
export const rateLimitAnnouncements = {
	start: (seconds: number): string =>
		`RentCast is busy. You can try again in ${formatCount(seconds)} seconds.`,
	END: 'You can try again now.'
} as const;

/** Visible (not announced) countdown label on the disabled retry button. */
export const countdownLabel = (seconds: number): string => `Try again in ${formatCount(seconds)}s`;
