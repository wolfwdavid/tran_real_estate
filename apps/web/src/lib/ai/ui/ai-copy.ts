// Every user-facing AI string for errors, Test connection results and run states, copied
// verbatim from 05-UI-SPEC.md. Plain strings only: components wrap the known model id or host
// in <code> themselves. Quota and billing copy always says "your {Provider} account", never Tran.

import type { AiProviderId, LiveProviderId, LlmErrorKind } from '@tran/core/ai';

/** `hash` has no '#'; the component resolves it against resolve('/settings/'). */
export type CopyLink = { label: string; hash: string };

const SET_UP_OPENROUTER: CopyLink = { label: 'Set up OpenRouter', hash: 'key-openrouter' };

export function errorCopy(
	kind: LlmErrorKind,
	o: { provider: AiProviderId; providerLabel: string; model: string; openRouterKeySaved: boolean }
): { title: string; body: string; action: CopyLink | null } {
	const P = o.providerLabel;
	const keyCard: CopyLink = { label: 'Open AI settings', hash: `key-${o.provider}` };
	const network = {
		title: `Couldn't reach ${P}`,
		body: 'Check your internet connection, then try again. Anything written so far is kept above.',
		action: null
	};

	switch (kind) {
		case 'cors-blocked':
			// OpenRouter never recommends itself.
			if (o.provider === 'openrouter') return network;
			return {
				title: `${P} is blocking this site right now`,
				body: `${P} didn't allow a request from your browser. This is on their side and often temporary. OpenRouter can run similar models and works from the browser. Anything written so far is kept above.`,
				action: o.openRouterKeySaved
					? { label: 'Switch to OpenRouter in AI drafting', hash: 'ai-drafting' }
					: SET_UP_OPENROUTER
			};
		case 'auth':
			return {
				title: `${P} didn't accept your key`,
				body: 'The key may be incomplete, deleted, or from a different account. Replace it in Settings, then try again.',
				action: keyCard
			};
		case 'quota':
			return {
				title: `Your ${P} account hit a limit`,
				body: `Your ${P} account is out of credit or over its rate limit. Check your plan and usage with ${P}, or wait a minute and try again. Tran doesn't charge you or set these limits.`,
				action: null
			};
		case 'network':
			return network;
		case 'model-not-found':
			return {
				title: `${P} doesn't recognize this model`,
				body: `${o.model} isn't available for your key. Choose Use default in Settings, or enter a model ${P} lists for you.`,
				action: keyCard
			};
		case 'refused':
			return {
				title: `${P} declined to write this draft`,
				body: "Your provider's own content rules stopped the request. Change the details and try again, or try another provider.",
				action: null
			};
		case 'locked':
			return {
				title: 'Your keys are locked',
				body: `Unlock your keys to draft with ${P}, or use sample output for now.`,
				action: { label: 'Unlock in Settings', hash: 'key-security' }
			};
		default:
			return {
				title: "The draft didn't finish",
				body: `${P} stopped responding before the draft was done. Anything written so far is kept above. Try again in a moment.`,
				action: null
			};
	}
}

export type TestOutcome = 'ok' | 'cors-blocked' | 'auth' | 'quota' | 'network';

export function testResultCopy(
	r: { outcome: TestOutcome; modelListed?: boolean },
	o: { provider: LiveProviderId; providerLabel: string; model: string; host: string }
): {
	tone: 'ok' | 'error';
	line: string;
	modelLine: string | null;
	modelTone: 'ok' | 'warn' | null;
	action: CopyLink | null;
} {
	const P = o.providerLabel;
	const error = (line: string, action: CopyLink | null = null) => ({
		tone: 'error' as const,
		line,
		modelLine: null,
		modelTone: null,
		action
	});
	const networkLine = `Couldn't reach ${o.host}. Check your connection, then try again.`;

	switch (r.outcome) {
		case 'ok':
			return {
				tone: 'ok',
				line: `${P} accepted this key.`,
				modelLine:
					r.modelListed === undefined
						? null
						: r.modelListed
							? `Model ${o.model} is available.`
							: `${P} didn't list ${o.model} for this key. Check the name, or choose Use default.`,
				modelTone: r.modelListed === undefined ? null : r.modelListed ? 'ok' : 'warn',
				action: null
			};
		case 'cors-blocked':
			if (o.provider === 'openrouter') return error(networkLine);
			return error(
				`${P} is blocking browser access from this site right now. Try OpenRouter, which can run the same kinds of models from your browser.`,
				SET_UP_OPENROUTER
			);
		case 'auth':
			return error(
				`${P} didn't accept this key. Check that you copied all of it, or create a new key.`
			);
		case 'quota':
			return error(
				`Your ${P} account has hit a usage or billing limit. Check your plan and credit in your ${P} account, or wait a minute if it's a rate limit, then try again.`
			);
		case 'network':
			return error(networkLine);
	}
}

export type RunStatus =
	| 'connecting'
	| 'waiting'
	| 'streaming'
	| 'sample-streaming'
	| 'done'
	| 'stopped'
	| 'stopped-empty'
	| 'length'
	| 'gemini-canceled'
	| 'copied'
	| 'copy-failed'
	| 'emailed'
	| 'marked-sent';

/** `line` is the persistent status line; `announce` goes to the live region (null = silent). */
export function statusCopy(
	state: RunStatus,
	o: { providerLabel: string; findingsSentence?: string; date?: string }
): { line: string; announce: string | null } {
	const P = o.providerLabel;
	const same = (line: string) => ({ line, announce: line });
	const withFindings = (prefix: string) =>
		o.findingsSentence ? `${prefix} ${o.findingsSentence}` : prefix;

	switch (state) {
		case 'connecting':
			return { line: `Connecting to ${P}…`, announce: `Drafting with ${P}.` };
		case 'waiting':
			return same(`Still waiting for ${P}. You can keep waiting or stop.`);
		case 'streaming':
			return { line: 'Writing…', announce: null };
		case 'sample-streaming':
			return { line: 'Writing sample output…', announce: 'Showing sample output.' };
		case 'done':
			return { line: 'Draft ready.', announce: withFindings('Draft ready.') };
		case 'stopped':
			return {
				line: 'Stopped. The partial draft is kept, so you can edit it, use it, or generate again.',
				announce: withFindings('Stopped. Partial draft kept.')
			};
		case 'stopped-empty':
			// Stop pressed before the first word: there is no partial draft to keep (05-16).
			return same('Stopped before any text arrived. Nothing was saved, so you can generate again.');
		case 'length':
			return same(
				'Draft ready, but it reached the length limit and may end mid-sentence. Edit the ending, or generate again.'
			);
		case 'gemini-canceled':
			return same('Canceled. Nothing was sent to Google.');
		case 'copied':
			return same('Copied to your clipboard.');
		case 'copy-failed':
			return same(
				"Your browser didn't allow copying. The draft is selected, so press Ctrl+C or ⌘C to copy it."
			);
		case 'emailed':
			return same(
				"Opened in your email app. Tran doesn't send it. Review it there and press send yourself."
			);
		case 'marked-sent':
			return {
				line: `Marked as sent on ${o.date ?? ''}. This is a note in Draft history on this device, not a delivery receipt.`,
				announce: 'Marked as sent in Draft history.'
			};
	}
}

export function sampleNotice(
	reason: 'no-key' | 'toggle',
	providerLabel: string
): { text: string; link: CopyLink } {
	return reason === 'no-key'
		? {
				text: 'This is sample output, written in advance so you can see how drafting works. Add an AI key to draft your own.',
				link: { label: 'Add an AI key', hash: 'api-keys' }
			}
		: {
				text: `Sample output is on. Turn it off in AI drafting to use your ${providerLabel} key.`,
				link: { label: 'Turn it off in AI drafting', hash: 'ai-drafting' }
			};
}
