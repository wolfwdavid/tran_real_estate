import { COPY, badgeTitleCount } from './copy';

export const GET_COUNT = 'tran-slf:get-count';
export const COUNT_PUSH = 'tran-slf:count';

export interface GetCountMessage {
	type: typeof GET_COUNT;
}

export interface CountResponse {
	enabled: boolean;
	count: number;
}

export interface CountPush extends CountResponse {
	type: typeof COUNT_PUSH;
}

const hasType = (m: unknown, type: string): m is Record<string, unknown> =>
	typeof m === 'object' && m !== null && (m as { type?: unknown }).type === type;

export function isGetCount(m: unknown): m is GetCountMessage {
	return hasType(m, GET_COUNT);
}

export function isCountPush(m: unknown): m is CountPush {
	return (
		hasType(m, COUNT_PUSH) &&
		typeof m.enabled === 'boolean' &&
		typeof m.count === 'number' &&
		Number.isInteger(m.count) &&
		m.count >= 0
	);
}

/**
 * runtime.onMessage listener for the content script. Answers through sendResponse and returns
 * true (WXT's fake-browser does not support promise-returning listeners); any other message
 * returns undefined so other listeners stay free to answer.
 */
export function createResponder(
	getStatus: () => CountResponse
): (msg: unknown, sender: unknown, sendResponse: (r: CountResponse) => void) => true | undefined {
	return (msg, _sender, sendResponse) => {
		if (!isGetCount(msg)) return undefined;
		sendResponse(getStatus());
		return true;
	};
}

/** Toolbar badge: '' when off or 0, the count for 1-99, '99+' above. */
export function badgeFor(s: CountResponse): { text: string; title: string } {
	if (!s.enabled) return { text: '', title: COPY.badgeTitleOff };
	const text = s.count <= 0 ? '' : s.count > 99 ? '99+' : String(s.count);
	return { text, title: badgeTitleCount(s.count) };
}
