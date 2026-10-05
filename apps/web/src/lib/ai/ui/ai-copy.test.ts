import { describe, expect, it } from 'vitest';
import type { LiveProviderId } from '@tran/core/ai';
import { errorCopy, sampleNotice, statusCopy, testResultCopy } from './ai-copy';

const PROVIDERS: Array<[LiveProviderId, string]> = [
	['openai', 'OpenAI'],
	['gemini', 'Google Gemini'],
	['anthropic', 'Anthropic']
];
const MODEL = 'gpt-5.6-terra';

const ctx = (provider: LiveProviderId, providerLabel: string, openRouterKeySaved = false) => ({
	provider,
	providerLabel,
	model: MODEL,
	openRouterKeySaved
});

const NETWORK = (P: string) => ({
	title: `Couldn't reach ${P}`,
	body: 'Check your internet connection, then try again. Anything written so far is kept above.',
	action: null
});

describe('errorCopy', () => {
	describe.each(PROVIDERS)('%s', (provider, P) => {
		it('cors-blocked without an OpenRouter key points to setup', () => {
			expect(errorCopy('cors-blocked', ctx(provider, P))).toEqual({
				title: `${P} is blocking this site right now`,
				body: `${P} didn't allow a request from your browser. This is on their side and often temporary. OpenRouter can run similar models and works from the browser. Anything written so far is kept above.`,
				action: { label: 'Set up OpenRouter', hash: 'key-openrouter' }
			});
		});

		it('cors-blocked with an OpenRouter key offers the switch', () => {
			expect(errorCopy('cors-blocked', ctx(provider, P, true)).action).toEqual({
				label: 'Switch to OpenRouter in AI drafting',
				hash: 'ai-drafting'
			});
		});

		it('auth deep-links to the provider key card', () => {
			expect(errorCopy('auth', ctx(provider, P))).toEqual({
				title: `${P} didn't accept your key`,
				body: 'The key may be incomplete, deleted, or from a different account. Replace it in Settings, then try again.',
				action: { label: 'Open AI settings', hash: `key-${provider}` }
			});
		});

		it('quota names the provider account, never Tran', () => {
			expect(errorCopy('quota', ctx(provider, P))).toEqual({
				title: `Your ${P} account hit a limit`,
				body: `Your ${P} account is out of credit or over its rate limit. Check your plan and usage with ${P}, or wait a minute and try again. Tran doesn't charge you or set these limits.`,
				action: null
			});
		});

		it('network', () => {
			expect(errorCopy('network', ctx(provider, P))).toEqual(NETWORK(P));
		});

		it('model-not-found', () => {
			expect(errorCopy('model-not-found', ctx(provider, P))).toEqual({
				title: `${P} doesn't recognize this model`,
				body: `${MODEL} isn't available for your key. Choose Use default in Settings, or enter a model ${P} lists for you.`,
				action: { label: 'Open AI settings', hash: `key-${provider}` }
			});
		});

		it('refused', () => {
			expect(errorCopy('refused', ctx(provider, P))).toEqual({
				title: `${P} declined to write this draft`,
				body: "Your provider's own content rules stopped the request. Change the details and try again, or try another provider.",
				action: null
			});
		});

		it('locked', () => {
			expect(errorCopy('locked', ctx(provider, P))).toEqual({
				title: 'Your keys are locked',
				body: `Unlock your keys to draft with ${P}, or use sample output for now.`,
				action: { label: 'Unlock in Settings', hash: 'key-security' }
			});
		});

		it.each(['interrupted', 'consent-required', 'aborted'] as const)(
			'%s falls back to the generic copy',
			(kind) => {
				expect(errorCopy(kind, ctx(provider, P))).toEqual({
					title: "The draft didn't finish",
					body: `${P} stopped responding before the draft was done. Anything written so far is kept above. Try again in a moment.`,
					action: null
				});
			}
		);
	});

	it('OpenRouter never recommends itself on cors-blocked', () => {
		expect(errorCopy('cors-blocked', ctx('openrouter', 'OpenRouter', true))).toEqual(
			NETWORK('OpenRouter')
		);
	});
});

describe('testResultCopy', () => {
	const o = (provider: LiveProviderId, providerLabel: string) => ({
		provider,
		providerLabel,
		model: MODEL,
		host: 'api.openai.com'
	});

	it('ok with the model listed', () => {
		expect(testResultCopy({ outcome: 'ok', modelListed: true }, o('openai', 'OpenAI'))).toEqual({
			tone: 'ok',
			line: 'OpenAI accepted this key.',
			modelLine: `Model ${MODEL} is available.`,
			modelTone: 'ok',
			action: null
		});
	});

	it('ok with the model not listed warns', () => {
		const r = testResultCopy({ outcome: 'ok', modelListed: false }, o('openai', 'OpenAI'));
		expect(r.modelLine).toBe(
			`OpenAI didn't list ${MODEL} for this key. Check the name, or choose Use default.`
		);
		expect(r.modelTone).toBe('warn');
	});

	it('ok without a models list has no model line', () => {
		const r = testResultCopy({ outcome: 'ok' }, o('gemini', 'Google Gemini'));
		expect(r.modelLine).toBeNull();
		expect(r.modelTone).toBeNull();
	});

	it('cors-blocked points to OpenRouter', () => {
		expect(testResultCopy({ outcome: 'cors-blocked' }, o('gemini', 'Google Gemini'))).toEqual({
			tone: 'error',
			line: 'Google Gemini is blocking browser access from this site right now. Try OpenRouter, which can run the same kinds of models from your browser.',
			modelLine: null,
			modelTone: null,
			action: { label: 'Set up OpenRouter', hash: 'key-openrouter' }
		});
	});

	it('cors-blocked on OpenRouter uses the network line', () => {
		const r = testResultCopy(
			{ outcome: 'cors-blocked' },
			{ ...o('openrouter', 'OpenRouter'), host: 'openrouter.ai' }
		);
		expect(r.line).toBe("Couldn't reach openrouter.ai. Check your connection, then try again.");
		expect(r.action).toBeNull();
		expect(r.tone).toBe('error');
	});

	it.each(PROVIDERS)('auth, quota and network for %s', (provider, P) => {
		expect(testResultCopy({ outcome: 'auth' }, o(provider, P)).line).toBe(
			`${P} didn't accept this key. Check that you copied all of it, or create a new key.`
		);
		expect(testResultCopy({ outcome: 'quota' }, o(provider, P)).line).toBe(
			`Your ${P} account has hit a usage or billing limit. Check your plan and credit in your ${P} account, or wait a minute if it's a rate limit, then try again.`
		);
		const net = testResultCopy({ outcome: 'network' }, o(provider, P));
		expect(net.line).toBe("Couldn't reach api.openai.com. Check your connection, then try again.");
		expect(net.tone).toBe('error');
		expect(net.action).toBeNull();
	});
});

describe('statusCopy', () => {
	const P = 'OpenRouter';
	const fs = '1 Fair Housing phrase to review.';
	it.each([
		['connecting', 'Connecting to OpenRouter…', 'Drafting with OpenRouter.'],
		[
			'waiting',
			'Still waiting for OpenRouter. You can keep waiting or stop.',
			'Still waiting for OpenRouter. You can keep waiting or stop.'
		],
		['streaming', 'Writing…', null],
		['sample-streaming', 'Writing sample output…', 'Showing sample output.'],
		['done', 'Draft ready.', `Draft ready. ${fs}`],
		[
			'stopped',
			'Stopped. The partial draft is kept, so you can edit it, use it, or generate again.',
			`Stopped. Partial draft kept. ${fs}`
		],
		[
			'length',
			'Draft ready, but it reached the length limit and may end mid-sentence. Edit the ending, or generate again.',
			'Draft ready, but it reached the length limit and may end mid-sentence. Edit the ending, or generate again.'
		],
		[
			'gemini-canceled',
			'Canceled. Nothing was sent to Google.',
			'Canceled. Nothing was sent to Google.'
		],
		['copied', 'Copied to your clipboard.', 'Copied to your clipboard.'],
		[
			'copy-failed',
			"Your browser didn't allow copying. The draft is selected, so press Ctrl+C or ⌘C to copy it.",
			"Your browser didn't allow copying. The draft is selected, so press Ctrl+C or ⌘C to copy it."
		],
		[
			'emailed',
			"Opened in your email app. Tran doesn't send it. Review it there and press send yourself.",
			"Opened in your email app. Tran doesn't send it. Review it there and press send yourself."
		],
		[
			'marked-sent',
			'Marked as sent on Oct 4, 2026. This is a note in Draft history on this device, not a delivery receipt.',
			'Marked as sent in Draft history.'
		]
	] as const)('%s', (state, line, announce) => {
		expect(
			statusCopy(state, { providerLabel: P, findingsSentence: fs, date: 'Oct 4, 2026' })
		).toEqual({ line, announce });
	});

	it('done without a findings sentence announces just the state', () => {
		expect(statusCopy('done', { providerLabel: P }).announce).toBe('Draft ready.');
	});
});

describe('sampleNotice', () => {
	it('no key', () => {
		expect(sampleNotice('no-key', 'OpenAI')).toEqual({
			text: 'This is sample output, written in advance so you can see how drafting works. Add an AI key to draft your own.',
			link: { label: 'Add an AI key', hash: 'api-keys' }
		});
	});

	it('toggle on', () => {
		expect(sampleNotice('toggle', 'Google Gemini')).toEqual({
			text: 'Sample output is on. Turn it off in AI drafting to use your Google Gemini key.',
			link: { label: 'Turn it off in AI drafting', hash: 'ai-drafting' }
		});
	});
});
