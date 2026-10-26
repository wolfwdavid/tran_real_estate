import { COPY } from './copy';
import {
	COUNT_PUSH,
	GET_COUNT,
	type CountPush,
	type CountResponse,
	type GetCountMessage
} from './messages';

// Pure popup state model. Every browser call arrives through PopupDeps, so this file never
// imports the browser global; the real wiring (tabs.query + tabs.sendMessage, no `tabs` permission)
// lives in the popup entrypoint. UI-SPEC Popup State Matrix: exactly one state renders.

export type PopupState =
	| { kind: 'loading' }
	| { kind: 'counting'; count: number }
	| { kind: 'zero' }
	| { kind: 'off' }
	| { kind: 'not-zillow' }
	| { kind: 'not-running' }
	| { kind: 'storage-error' };

export interface ActiveTab {
	id?: number;
	url?: string;
}

export interface PopupDeps {
	readEnabled(): Promise<boolean>;
	writeEnabled(value: boolean): Promise<void>;
	activeTab(): Promise<ActiveTab | undefined>;
	sendToTab(tabId: number, message: GetCountMessage): Promise<CountResponse>;
	onCountPush(listener: (push: CountPush, senderTabId: number | undefined) => void): () => void;
}

export interface PopupStatus {
	enabled: boolean | null;
	tabId: number | undefined;
	state: PopupState;
}

/** True only for http(s) URLs whose host is zillow.com or a subdomain of it. */
export function isZillowUrl(url: string | undefined): boolean {
	if (!url) return false;
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		return false;
	}
	if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
	const host = parsed.hostname.toLowerCase();
	return host === 'zillow.com' || host.endsWith('.zillow.com');
}

const isCountResponse = (r: unknown): r is CountResponse =>
	typeof r === 'object' &&
	r !== null &&
	typeof (r as CountResponse).enabled === 'boolean' &&
	Number.isInteger((r as CountResponse).count) &&
	(r as CountResponse).count >= 0;

function fromCount(r: CountResponse): PopupState {
	if (!r.enabled) return { kind: 'off' };
	return r.count === 0 ? { kind: 'zero' } : { kind: 'counting', count: r.count };
}

/** Precedence: storage-error, off, not-zillow, not-running, zero/counting. */
export async function loadStatus(deps: PopupDeps): Promise<PopupStatus> {
	let enabled: boolean;
	try {
		enabled = await deps.readEnabled();
	} catch {
		return { enabled: null, tabId: undefined, state: { kind: 'storage-error' } };
	}

	let tab: ActiveTab | undefined;
	try {
		tab = await deps.activeTab();
	} catch {
		tab = undefined;
	}
	const tabId = tab?.id;

	if (!enabled) return { enabled, tabId, state: { kind: 'off' } };
	if (!isZillowUrl(tab?.url)) return { enabled, tabId, state: { kind: 'not-zillow' } };
	if (tabId === undefined) return { enabled, tabId, state: { kind: 'not-running' } };

	try {
		const response = await deps.sendToTab(tabId, { type: GET_COUNT });
		if (!isCountResponse(response)) return { enabled, tabId, state: { kind: 'not-running' } };
		return { enabled, tabId, state: fromCount(response) };
	} catch {
		return { enabled, tabId, state: { kind: 'not-running' } };
	}
}

/**
 * Folds a live count push into the current state. Pushes from any tab other than the active one
 * are ignored, and a push never overrides not-zillow or storage-error.
 */
export function applyPush(
	state: PopupState,
	push: CountPush,
	activeTabId: number | undefined,
	senderTabId: number | undefined
): PopupState {
	if (push.type !== COUNT_PUSH) return state;
	if (activeTabId === undefined || senderTabId !== activeTabId) return state;
	if (state.kind === 'not-zillow' || state.kind === 'storage-error') return state;
	return fromCount(push);
}

const plural = new Intl.PluralRules('en-US');

export function countLabel(n: number): string {
	return plural.select(n) === 'one' ? COPY.countOne : COPY.countOther;
}

export function stateCopy(state: PopupState): string {
	switch (state.kind) {
		case 'loading':
			return '';
		case 'counting':
			return countLabel(state.count);
		case 'zero':
			return COPY.zero;
		case 'off':
			return COPY.off;
		case 'not-zillow':
			return COPY.notZillow;
		case 'not-running':
			return COPY.notRunning;
		case 'storage-error':
			return COPY.storageError;
	}
}
