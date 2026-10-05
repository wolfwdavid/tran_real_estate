// Gemini free-tier client-data gate (AI-03). Free-tier prompts may be used by Google to improve
// its products, so any live Gemini run containing client or lead data asks first (Cancel is the
// default action).
//
// sessionStorage only: never persistent local storage, never Dexie, so the acknowledgement ends
// with the tab and can never enter a backup. There is no 'never ask again'.

import type { AiProviderId } from '@tran/core/ai';

export const GEMINI_ACK_KEY = 'tran.ai.gemini-client-data-ack';

export function needsGeminiWarning(o: {
	provider: AiProviderId;
	sample: boolean;
	containsClientData: boolean;
	acked: boolean;
}): boolean {
	return o.provider === 'gemini' && !o.sample && o.containsClientData && !o.acked;
}

function sessionStore(): Storage | undefined {
	try {
		return globalThis.sessionStorage;
	} catch {
		// Some browsers throw on access when storage is blocked.
		return undefined;
	}
}

export function readGeminiAck(
	storage: Pick<Storage, 'getItem'> | undefined = sessionStore()
): boolean {
	try {
		return storage?.getItem(GEMINI_ACK_KEY) === '1';
	} catch {
		return false;
	}
}

export function writeGeminiAck(
	storage: Pick<Storage, 'setItem'> | undefined = sessionStore()
): void {
	try {
		storage?.setItem(GEMINI_ACK_KEY, '1');
	} catch {
		// Storage full or blocked: the dialog simply asks again next time.
	}
}
