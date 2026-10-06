/**
 * The one generation pipeline every AI feature uses.
 *
 * Pure TS (no runes). Time-based batching lives here so it is unit-testable; runner.svelte.ts /
 * panel state only writes the latest text into $state.
 *
 * Every `text` update carries the FULL text so far, at most once per `flushMs` (default 50 ms),
 * plus one final flush before `done`, so the UI never misses the tail. Stop (an abort on
 * `signal`) ends the run as 'stopped' and keeps every token already received.
 */
import {
	LlmError,
	estimateCostUsd,
	isAbort,
	toLlmError,
	type AiProviderId,
	type LlmFinish,
	type LlmUsage
} from '@tran/core/ai';
import { pricingFor } from './models.js';
import type { LlmProvider, LlmRequest } from './ports.js';
import type { BuiltPrompt } from './prompts/types.js';

export type RunStatus = 'done' | 'stopped' | 'error';

export type GenerationResult = {
	text: string;
	usage?: LlmUsage;
	status: RunStatus;
	finish: LlmFinish;
	error?: LlmError;
	provider: AiProviderId;
	model: string;
	promptId: string;
	estimatedCostUsd?: number;
};

export type RunUpdate =
	| { type: 'text'; text: string }
	| { type: 'first-token' }
	| { type: 'done'; result: GenerationResult };

export type RunOptions = {
	prompt: BuiltPrompt;
	provider: LlmProvider;
	model: string;
	signal: AbortSignal;
	/** Gemini free-tier client-data acknowledgement, passed through to the adapter. */
	clientDataAck?: boolean;
	/** Monotonic clock in ms (injected in tests). */
	now?: () => number;
	flushMs?: number;
	/** Wall clock for date-effective pricing (injected in tests). */
	at?: () => Date;
};

export async function* runGeneration(o: RunOptions): AsyncGenerator<RunUpdate> {
	const now = o.now ?? (() => performance.now());
	const flushMs = o.flushMs ?? 50;
	const req: LlmRequest = {
		model: o.model,
		system: o.prompt.system,
		user: o.prompt.user,
		maxTokens: o.prompt.maxTokens,
		containsClientData: o.prompt.containsClientData,
		clientDataAck: o.clientDataAck,
		promptId: o.prompt.promptId,
		...(o.prompt.fixtureText !== undefined ? { fixtureText: o.prompt.fixtureText } : {})
	};

	let text = '';
	let last = -Infinity;
	let gotFirst = false;
	let usage: LlmUsage | undefined;
	let finish: LlmFinish = 'stop';
	let status: RunStatus = 'done';
	let error: LlmError | undefined;

	try {
		for await (const ev of o.provider.stream(req, o.signal)) {
			if (ev.type === 'text') {
				text += ev.text;
				if (!gotFirst) {
					gotFirst = true;
					yield { type: 'first-token' };
				}
				const t = now();
				if (t - last >= flushMs) {
					last = t;
					yield { type: 'text', text };
				}
			} else if (ev.type === 'usage') {
				usage = { ...usage, ...ev.usage };
			} else if (ev.type === 'finish') {
				finish = ev.reason;
			}
		}
	} catch (e) {
		if (isAbort(e, o.signal)) {
			status = 'stopped';
		} else {
			status = 'error';
			error = toLlmError(e);
		}
	}

	if (status === 'done' && finish === 'refused') {
		status = 'error';
		error = new LlmError('refused');
	}

	// Final flush: the full text (partial on Stop or error) always reaches the UI.
	yield { type: 'text', text };

	const at = (o.at ?? (() => new Date()))();
	yield {
		type: 'done',
		result: {
			text,
			usage,
			status,
			finish,
			error,
			provider: o.provider.id,
			model: o.model,
			promptId: o.prompt.promptId,
			estimatedCostUsd: estimateCostUsd(usage, pricingFor(o.provider.id, o.model), at)
		}
	};
}
