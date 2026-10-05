import { describe, expect, it } from 'vitest';
import { LlmError, isAbort } from '@tran/core/ai';
import type { LlmEvent, LlmRequest } from '../ports.js';
import { fakeRouteFetch, fakeSseFetch } from './fake-sse.js';
import { openrouterProbe, openrouterProvider } from './openrouter.js';
import { runTestConnection } from './test-connection.js';

const HOST = 'openrouter.ai';
const CHAT_URL = `https://${HOST}/api/v1/chat/completions`;
const KEY_URL = `https://${HOST}/api/v1/key`;
const MODELS_URL = `https://${HOST}/api/v1/models`;
const MODEL = 'anthropic/claude-sonnet-5.5';

const sse = (o: unknown): string => `data: ${JSON.stringify(o)}\n\n`;
const DONE = 'data: [DONE]\n\n';
const delta = (content: unknown, finish_reason: string | null = null) =>
	sse({ choices: [{ index: 0, delta: content, finish_reason }] });

function req(over: Partial<LlmRequest> = {}): LlmRequest {
	return {
		model: MODEL,
		system: 'You are careful.',
		user: 'Write a follow-up.',
		maxTokens: 300,
		containsClientData: true,
		...over
	};
}

async function collect(it: AsyncIterable<LlmEvent>, out: LlmEvent[] = []): Promise<LlmEvent[]> {
	for await (const e of it) out.push(e);
	return out;
}

async function rejection(p: Promise<unknown>): Promise<unknown> {
	try {
		await p;
	} catch (err) {
		return err;
	}
	throw new Error('expected a rejection');
}

const OK_FRAMES = [delta({ content: 'Hi' }, 'stop'), DONE];

function provider(frames: string[], o: Parameters<typeof fakeSseFetch>[1] = {}) {
	const { fetchImpl, calls } = fakeSseFetch(frames, o);
	return { p: openrouterProvider({ fetch: fetchImpl, getKey: async () => 'k' }), calls };
}

describe('openrouterProvider request', () => {
	it('posts chat completions with exact headers and a no-data-collection provider policy', async () => {
		const { p, calls } = provider(OK_FRAMES);
		await collect(p.stream(req(), new AbortController().signal));
		expect(p.id).toBe('openrouter');
		expect(calls).toHaveLength(1);
		expect(calls[0].url).toBe(CHAT_URL);
		expect(new URL(calls[0].url).host).toBe(HOST);
		expect(calls[0].init.method).toBe('POST');
		expect(calls[0].init.headers).toEqual({
			authorization: 'Bearer k',
			'content-type': 'application/json',
			'x-openrouter-title': 'Tran Real Estate Tools'
		});
		expect(JSON.parse(String(calls[0].init.body))).toEqual({
			model: MODEL,
			messages: [
				{ role: 'system', content: 'You are careful.' },
				{ role: 'user', content: 'Write a follow-up.' }
			],
			max_tokens: 300,
			stream: true,
			provider: { data_collection: 'deny' }
		});
		expect(calls[0].url).not.toContain('k');
	});

	it('rejects locked when no key is available, without fetching', async () => {
		const { fetchImpl, calls } = fakeSseFetch(OK_FRAMES);
		const p = openrouterProvider({ fetch: fetchImpl, getKey: async () => null });
		const err = await rejection(collect(p.stream(req(), new AbortController().signal)));
		expect((err as LlmError).kind).toBe('locked');
		expect(calls).toHaveLength(0);
	});
});

describe('openrouterProvider stream mapping', () => {
	it('drops comments and reasoning, maps finish then provider-reported cost, ends on [DONE]', async () => {
		const { p } = provider(
			[
				': OPENROUTER PROCESSING\n\n',
				delta({ role: 'assistant', content: 'Hel' }),
				delta({ content: 'lo' }),
				delta({ reasoning: 'x' }),
				delta({ content: '' }, 'stop'),
				sse({
					choices: [],
					usage: { prompt_tokens: 11, completion_tokens: 4, cost: 0.00023 }
				}),
				DONE
			],
			{ splitEvery: 5 }
		);
		const events = await collect(p.stream(req(), new AbortController().signal));
		expect(events).toEqual([
			{ type: 'text', text: 'Hel' },
			{ type: 'text', text: 'lo' },
			{ type: 'finish', reason: 'stop' },
			{ type: 'usage', usage: { inputTokens: 11, outputTokens: 4, costUsd: 0.00023 } }
		]);
		expect(JSON.stringify(events)).not.toContain('"x"');
	});

	it.each([
		['length', 'length'],
		['content_filter', 'refused']
	])('finish_reason %s → %s', async (fr, reason) => {
		const { p } = provider([delta({ content: 'a' }, fr), DONE]);
		const events = await collect(p.stream(req(), new AbortController().signal));
		expect(events.at(-1)).toEqual({ type: 'finish', reason });
	});

	it("finish_reason 'error' → interrupted", async () => {
		const { p } = provider([delta({ content: 'a' }, 'error'), DONE]);
		const err = await rejection(collect(p.stream(req(), new AbortController().signal)));
		expect((err as LlmError).kind).toBe('interrupted');
		expect((err as LlmError).code).toBe('finish-error');
	});

	it('an error as the only chunk of a 200 stream is reported, never an empty draft', async () => {
		const { p } = provider([
			sse({ error: { code: 502, message: 'Provider returned error' } }),
			DONE
		]);
		const out: LlmEvent[] = [];
		const err = await rejection(collect(p.stream(req(), new AbortController().signal), out));
		expect(err).toBeInstanceOf(LlmError);
		expect((err as LlmError).kind).toBe('interrupted');
		expect((err as LlmError).code).toBe('502');
		expect((err as LlmError).message).not.toContain('Provider returned error');
		expect(out).toEqual([]);
	});

	it('a stream ending with no [DONE] and no finish_reason → interrupted truncated', async () => {
		const { p } = provider([delta({ content: 'a' })]);
		const err = await rejection(collect(p.stream(req(), new AbortController().signal)));
		expect((err as LlmError).kind).toBe('interrupted');
		expect((err as LlmError).code).toBe('truncated');
	});

	it('[DONE] without any finish_reason → interrupted truncated', async () => {
		const { p } = provider([DONE]);
		const err = await rejection(collect(p.stream(req(), new AbortController().signal)));
		expect((err as LlmError).kind).toBe('interrupted');
		expect((err as LlmError).code).toBe('truncated');
	});

	it('unparseable data → interrupted bad-json', async () => {
		const { p } = provider(['data: {nope\n\n']);
		const err = await rejection(collect(p.stream(req(), new AbortController().signal)));
		expect((err as LlmError).code).toBe('bad-json');
	});
});

describe('openrouterProvider HTTP errors', () => {
	it.each([
		[401, { error: { code: 401, message: 'No auth credentials found' } }, 'auth'],
		[402, { error: { code: 402, message: 'Insufficient credits' } }, 'quota'],
		[
			404,
			{ error: { code: 404, message: 'No endpoints found matching your data policy' } },
			'model-not-found'
		]
	])('HTTP %i → %s', async (status, body, kind) => {
		const { p } = provider([JSON.stringify(body)], {
			status,
			headers: { 'content-type': 'application/json' }
		});
		const err = await rejection(collect(p.stream(req(), new AbortController().signal)));
		expect(err).toBeInstanceOf(LlmError);
		expect((err as LlmError).kind).toBe(kind);
	});
});

describe('openrouterProvider stop', () => {
	it('keeps yielded text and rejects with an abort', async () => {
		const { p } = provider([delta({ content: 'Partial' })], { holdOpen: true });
		const ctrl = new AbortController();
		const out: LlmEvent[] = [];
		const run = (async () => {
			for await (const e of p.stream(req(), ctrl.signal)) {
				out.push(e);
				if (e.type === 'text') ctrl.abort();
			}
		})();
		const err = await rejection(run);
		expect(isAbort(err, ctrl.signal)).toBe(true);
		expect(out).toEqual([{ type: 'text', text: 'Partial' }]);
	});
});

describe('openrouterProbe', () => {
	const hdr = (init: RequestInit) => (init.headers ?? {}) as Record<string, string>;

	it('keys only the /key check; models list and canary are keyless', async () => {
		const { fetchImpl, calls } = fakeRouteFetch([
			{ match: (u) => u === KEY_URL, respond: { status: 200, body: { data: { label: 'x' } } } },
			{
				match: (u) => u === MODELS_URL,
				respond: { status: 200, body: { data: [{ id: 'openai/x' }, { id: MODEL }] } }
			},
			{
				match: (u, i) => u === CHAT_URL && i.method === 'POST',
				respond: { status: 401, body: { error: { code: 401 } } }
			}
		]);
		const r = await runTestConnection(openrouterProbe, 'k', MODEL, { fetch: fetchImpl });
		expect(r).toEqual({ outcome: 'ok', modelListed: true });

		for (const c of calls) expect(new URL(c.url).host).toBe(HOST);
		const key = calls.find((c) => c.url === KEY_URL);
		expect(hdr(key!.init).authorization).toBe('Bearer k');

		const models = calls.find((c) => c.url === MODELS_URL);
		expect(models).toBeDefined();
		expect(hdr(models!.init)).not.toHaveProperty('authorization');

		const canary = calls.find((c) => c.url === CHAT_URL);
		expect(canary?.init.body).toBe('{}');
		expect(hdr(canary!.init)).toEqual({ 'content-type': 'application/json' });
		expect(JSON.stringify(canary?.init)).not.toContain('Bearer');
	});

	it('key 401 → auth', async () => {
		const { fetchImpl } = fakeRouteFetch([
			{ match: (u) => u === KEY_URL, respond: { status: 401, body: { error: { code: 401 } } } }
		]);
		const r = await runTestConnection(openrouterProbe, 'bad', MODEL, { fetch: fetchImpl });
		expect(r).toEqual({ outcome: 'auth' });
	});

	it('exposes its id and host', () => {
		expect(openrouterProbe.id).toBe('openrouter');
		expect(openrouterProbe.host).toBe(HOST);
	});
});
