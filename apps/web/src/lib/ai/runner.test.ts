import { describe, expect, it } from 'vitest';
import { LlmError, type AiProviderId } from '@tran/core/ai';
import type { LlmEvent, LlmProvider, LlmRequest } from './ports.js';
import type { BuiltPrompt } from './prompts/types.js';
import { runGeneration, type GenerationResult, type RunUpdate } from './runner.js';

// Hand-written provider generators only: no adapters, no fetch, no global fake timers.

const PROMPT: BuiltPrompt = {
	id: 'shared/demo',
	version: 1,
	promptId: 'shared/demo@1',
	feature: 'demo',
	system: 'SYSTEM',
	user: 'USER {client_name}',
	redactions: [{ original: 'Jordan Rivera', token: 'client_name' }],
	containsClientData: true,
	maxTokens: 2048,
	inputHash: '0'.repeat(64)
};

function provider(
	id: AiProviderId,
	stream: (req: LlmRequest, signal: AbortSignal) => AsyncIterable<LlmEvent>
): LlmProvider {
	return { id, stream };
}

async function collect(gen: AsyncGenerator<RunUpdate>): Promise<RunUpdate[]> {
	const out: RunUpdate[] = [];
	for await (const u of gen) out.push(u);
	return out;
}

function resultOf(updates: RunUpdate[]): GenerationResult {
	const last = updates.at(-1);
	if (last?.type !== 'done') throw new Error('no done update');
	return last.result;
}

const texts = (updates: RunUpdate[]) =>
	updates.flatMap((u) => (u.type === 'text' ? [u.text] : []));

async function run(
	p: LlmProvider,
	extra: Partial<Parameters<typeof runGeneration>[0]> = {}
): Promise<RunUpdate[]> {
	return collect(
		runGeneration({
			prompt: PROMPT,
			provider: p,
			model: 'claude-sonnet-5-5',
			signal: new AbortController().signal,
			...extra
		})
	);
}

describe('runGeneration batching', () => {
	it('flushes the full text at most every flushMs, then once more at the end', async () => {
		let t = 0;
		const p = provider('anthropic', async function* () {
			const steps: [number, string][] = [
				[0, 'a'],
				[10, 'b'],
				[20, 'c'],
				[60, 'd'],
				[70, 'e']
			];
			for (const [at, text] of steps) {
				t = at;
				yield { type: 'text', text };
			}
		});
		const updates = await run(p, { now: () => t, flushMs: 50 });
		expect(texts(updates)).toEqual(['a', 'abcd', 'abcde']);

		const firstTokens = updates.filter((u) => u.type === 'first-token');
		expect(firstTokens).toHaveLength(1);
		const ftIndex = updates.findIndex((u) => u.type === 'first-token');
		const firstText = updates.findIndex((u) => u.type === 'text');
		expect(ftIndex).toBeLessThan(firstText);

		const result = resultOf(updates);
		expect(result.text).toBe('abcde');
		expect(result.status).toBe('done');
		expect(result.finish).toBe('stop');
		expect(result.provider).toBe('anthropic');
		expect(result.model).toBe('claude-sonnet-5-5');
		expect(result.promptId).toBe('shared/demo@1');
		expect(result.error).toBeUndefined();
	});

	it('defaults to a 50 ms flush window', async () => {
		let t = 0;
		const p = provider('anthropic', async function* () {
			t = 0;
			yield { type: 'text', text: 'x' };
			t = 49;
			yield { type: 'text', text: 'y' };
			t = 50;
			yield { type: 'text', text: 'z' };
		});
		expect(texts(await run(p, { now: () => t }))).toEqual(['x', 'xyz', 'xyz']);
	});
});

describe('runGeneration request', () => {
	it('builds the provider request from the prompt, model and consent flag', async () => {
		let seen: LlmRequest | undefined;
		const p = provider('gemini', async function* (req) {
			seen = req;
			yield { type: 'text', text: 'ok' };
		});
		await run(p, { model: 'gemini-3.8-flash', clientDataAck: true });
		expect(seen).toEqual({
			model: 'gemini-3.8-flash',
			system: 'SYSTEM',
			user: 'USER {client_name}',
			maxTokens: 2048,
			containsClientData: true,
			clientDataAck: true,
			promptId: 'shared/demo@1'
		});
	});
});

describe('runGeneration Stop', () => {
	it('ends as stopped and keeps every token already received', async () => {
		const ctrl = new AbortController();
		const p = provider('anthropic', async function* (_req, signal) {
			yield { type: 'text', text: 'Hello there' };
			await new Promise<never>((_, reject) => {
				const abort = () => reject(new DOMException('Aborted', 'AbortError'));
				if (signal.aborted) return abort();
				signal.addEventListener('abort', abort, { once: true });
			});
			yield { type: 'text', text: ' never' };
		});
		const updates: RunUpdate[] = [];
		for await (const u of runGeneration({
			prompt: PROMPT,
			provider: p,
			model: 'claude-sonnet-5-5',
			signal: ctrl.signal
		})) {
			updates.push(u);
			if (u.type === 'text' && updates.filter((x) => x.type === 'text').length === 1) {
				ctrl.abort();
			}
		}
		const result = resultOf(updates);
		expect(result.status).toBe('stopped');
		expect(result.text).toBe('Hello there');
		expect(result.error).toBeUndefined();
		expect(texts(updates).at(-1)).toBe('Hello there');
	});
});

describe('runGeneration usage and cost', () => {
	const at = () => new Date('2026-10-04T00:00:00Z');

	it('merges usage events and estimates cost from the registry', async () => {
		const p = provider('anthropic', async function* () {
			yield { type: 'usage', usage: { inputTokens: 1000 } };
			yield { type: 'text', text: 'Hi' };
			yield { type: 'usage', usage: { outputTokens: 1000 } };
			yield { type: 'finish', reason: 'stop' };
		});
		const result = resultOf(await run(p, { at }));
		expect(result.usage).toEqual({ inputTokens: 1000, outputTokens: 1000 });
		expect(result.estimatedCostUsd).toBeDefined();
		expect(Math.abs((result.estimatedCostUsd ?? NaN) - 0.012)).toBeLessThan(1e-12);
	});

	it('leaves cost undefined for an unknown model', async () => {
		const p = provider('anthropic', async function* () {
			yield { type: 'usage', usage: { inputTokens: 1000, outputTokens: 1000 } };
		});
		const result = resultOf(await run(p, { model: 'my-model', at }));
		expect(result.estimatedCostUsd).toBeUndefined();
	});

	it('leaves cost undefined for the fixture provider', async () => {
		const p = provider('fixture', async function* () {
			yield { type: 'usage', usage: { inputTokens: 1000, outputTokens: 1000 } };
		});
		const result = resultOf(await run(p, { at }));
		expect(result.estimatedCostUsd).toBeUndefined();
	});

	it('has no usage and no cost when the provider reports none', async () => {
		const p = provider('anthropic', async function* () {
			yield { type: 'text', text: 'Hi' };
		});
		const result = resultOf(await run(p, { at }));
		expect(result.usage).toBeUndefined();
		expect(result.estimatedCostUsd).toBeUndefined();
	});
});

describe('runGeneration finish and errors', () => {
	it('treats a length finish as done', async () => {
		const p = provider('openai', async function* () {
			yield { type: 'text', text: 'Partial' };
			yield { type: 'finish', reason: 'length' };
		});
		const result = resultOf(await run(p));
		expect(result.status).toBe('done');
		expect(result.finish).toBe('length');
	});

	it('turns a refused finish into a refused error and keeps the partial text', async () => {
		const p = provider('anthropic', async function* () {
			yield { type: 'text', text: 'I can' };
			yield { type: 'finish', reason: 'refused' };
		});
		const result = resultOf(await run(p));
		expect(result.status).toBe('error');
		expect(result.finish).toBe('refused');
		expect(result.error).toBeInstanceOf(LlmError);
		expect(result.error?.kind).toBe('refused');
		expect(result.text).toBe('I can');
	});

	it('reports an LlmError thrown mid-stream with the text so far', async () => {
		const p = provider('anthropic', async function* () {
			yield { type: 'text', text: 'Hi' };
			throw new LlmError('auth', { status: 401 });
		});
		const updates = await run(p);
		const result = resultOf(updates);
		expect(result.status).toBe('error');
		expect(result.error?.kind).toBe('auth');
		expect(result.text).toBe('Hi');
		expect(texts(updates).at(-1)).toBe('Hi');
	});

	it('maps a plain Error to interrupted without echoing its message', async () => {
		const p = provider('openai', async function* () {
			yield { type: 'text', text: 'Hi' };
			throw new Error('boom');
		});
		const result = resultOf(await run(p));
		expect(result.status).toBe('error');
		expect(result.error?.kind).toBe('interrupted');
		expect(result.error?.message).not.toContain('boom');
	});

	it('reports consent-required thrown before any text', async () => {
		// eslint-disable-next-line require-yield
		const p = provider('gemini', async function* () {
			throw new LlmError('consent-required');
		});
		const updates = await run(p);
		const result = resultOf(updates);
		expect(result.status).toBe('error');
		expect(result.error?.kind).toBe('consent-required');
		expect(result.text).toBe('');
		expect(updates.some((u) => u.type === 'first-token')).toBe(false);
	});
});
