import { describe, expect, it } from 'vitest';
import { LlmError, isAbort } from '@tran/core/ai';
import type { LlmEvent, LlmRequest } from '../ports.js';
import { anthropicProbe, anthropicProvider } from './anthropic.js';
import { fakeRouteFetch, fakeSseFetch } from './fake-sse.js';
import { runTestConnection } from './test-connection.js';

const MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
const MODELS_URL = 'https://api.anthropic.com/v1/models?limit=1000';

const req = (o: Partial<LlmRequest> = {}): LlmRequest => ({
	model: 'claude-sonnet-5-5',
	system: 'You draft listing copy.',
	user: 'Describe a 2 bed condo.',
	maxTokens: 800,
	containsClientData: false,
	...o
});

const frame = (data: Record<string, unknown>) =>
	`event: ${String(data.type)}\ndata: ${JSON.stringify(data)}\n\n`;

const messageStart = (input = 12) =>
	frame({ type: 'message_start', message: { usage: { input_tokens: input, output_tokens: 1 } } });
const textDelta = (text: string) =>
	frame({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } });
const messageDelta = (stop_reason: string, output = 7) =>
	frame({ type: 'message_delta', delta: { stop_reason }, usage: { output_tokens: output } });
const messageStop = () => frame({ type: 'message_stop' });

const HAPPY = [
	messageStart(12),
	frame({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }),
	textDelta('Hello'),
	frame({
		type: 'content_block_delta',
		index: 0,
		delta: { type: 'thinking_delta', thinking: 'secret' }
	}),
	frame({
		type: 'content_block_delta',
		index: 0,
		delta: { type: 'signature_delta', signature: 'sig' }
	}),
	textDelta(' there'),
	frame({ type: 'ping' }),
	frame({ type: 'content_block_stop', index: 0 }),
	messageDelta('end_turn', 7),
	messageStop()
];

const EXPECTED: LlmEvent[] = [
	{ type: 'usage', usage: { inputTokens: 12 } },
	{ type: 'text', text: 'Hello' },
	{ type: 'text', text: ' there' },
	{ type: 'usage', usage: { outputTokens: 7 } },
	{ type: 'finish', reason: 'stop' }
];

async function collect(it: AsyncIterable<LlmEvent>): Promise<LlmEvent[]> {
	const out: LlmEvent[] = [];
	for await (const e of it) out.push(e);
	return out;
}

async function failure(it: AsyncIterable<LlmEvent>): Promise<unknown> {
	try {
		await collect(it);
	} catch (err) {
		return err;
	}
	throw new Error('expected the stream to throw');
}

const provider = (fetchImpl: typeof fetch, key: string | null = 'k') =>
	anthropicProvider({ getKey: async () => key, fetch: fetchImpl, isOnline: () => true });

const bodyOf = (init: RequestInit) => JSON.parse(String(init.body)) as Record<string, unknown>;

describe('anthropicProvider request', () => {
	it('POSTs the exact browser header set and body to /v1/messages', async () => {
		const { fetchImpl, calls } = fakeSseFetch(HAPPY);
		await collect(provider(fetchImpl).stream(req(), new AbortController().signal));
		expect(calls).toHaveLength(1);
		const [{ url, init }] = calls;
		expect(url).toBe(MESSAGES_URL);
		expect(new URL(url).host).toBe('api.anthropic.com');
		expect(init.method).toBe('POST');
		expect(init.credentials).toBe('omit');
		expect(init.headers).toEqual({
			'content-type': 'application/json',
			'x-api-key': 'k',
			'anthropic-version': '2023-06-01',
			'anthropic-dangerous-direct-browser-access': 'true'
		});
		const body = bodyOf(init);
		expect(body.model).toBe('claude-sonnet-5-5');
		expect(body.max_tokens).toBe(800);
		expect(body.system).toBe('You draft listing copy.');
		expect(body.messages).toEqual([{ role: 'user', content: 'Describe a 2 bed condo.' }]);
		expect(body.stream).toBe(true);
		expect((body.output_config as { effort: string }).effort).toBe('low');
		expect((body.thinking as { type: string }).type).toBe('between_tools');
	});

	it('sends no extras for an overridden model and never sends sampling params', async () => {
		const { fetchImpl, calls } = fakeSseFetch(HAPPY);
		await collect(
			provider(fetchImpl).stream(req({ model: 'claude-opus-5-5' }), new AbortController().signal)
		);
		const body = bodyOf(calls[0].init);
		expect(body.model).toBe('claude-opus-5-5');
		expect(body).not.toHaveProperty('output_config');
		expect(body).not.toHaveProperty('thinking');
		for (const k of ['temperature', 'top_p', 'top_k']) expect(body).not.toHaveProperty(k);
	});

	it('locked vault (null key) throws locked before any fetch', async () => {
		const { fetchImpl, calls } = fakeSseFetch(HAPPY);
		const err = await failure(
			provider(fetchImpl, null).stream(req(), new AbortController().signal)
		);
		expect(err).toBeInstanceOf(LlmError);
		expect((err as LlmError).kind).toBe('locked');
		expect(calls).toHaveLength(0);
	});
});

describe('anthropicProvider stream mapping', () => {
	it('maps text and usage, and never surfaces thinking/signature deltas', async () => {
		const { fetchImpl } = fakeSseFetch(HAPPY);
		const events = await collect(provider(fetchImpl).stream(req(), new AbortController().signal));
		expect(events).toEqual(EXPECTED);
		expect(JSON.stringify(events)).not.toContain('secret');
	});

	it('is identical when split into 1-character chunks', async () => {
		const { fetchImpl } = fakeSseFetch(HAPPY, { splitEvery: 1 });
		expect(await collect(provider(fetchImpl).stream(req(), new AbortController().signal))).toEqual(
			EXPECTED
		);
	});

	it('is identical when split into 1-byte chunks', async () => {
		const { fetchImpl } = fakeSseFetch(HAPPY, { splitEvery: 1, bytes: true });
		expect(await collect(provider(fetchImpl).stream(req(), new AbortController().signal))).toEqual(
			EXPECTED
		);
	});

	it.each([
		['end_turn', 'stop'],
		['stop_sequence', 'stop'],
		['max_tokens', 'length'],
		['refusal', 'refused']
	] as const)('stop_reason %s → finish %s', async (stop, reason) => {
		const { fetchImpl } = fakeSseFetch([
			messageStart(),
			textDelta('x'),
			messageDelta(stop),
			messageStop()
		]);
		const events = await collect(provider(fetchImpl).stream(req(), new AbortController().signal));
		expect(events.at(-1)).toEqual({ type: 'finish', reason });
	});

	it('a mid-stream error event becomes interrupted with a sanitized code and no provider text', async () => {
		const { fetchImpl } = fakeSseFetch([
			messageStart(),
			textDelta('Hel'),
			'event: error\ndata: {"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}\n\n'
		]);
		const err = await failure(provider(fetchImpl).stream(req(), new AbortController().signal));
		expect(err).toBeInstanceOf(LlmError);
		expect((err as LlmError).kind).toBe('interrupted');
		expect((err as LlmError).code).toBe('overloaded_error');
		expect((err as LlmError).message).toBe('interrupted');
		expect(JSON.stringify(err)).not.toContain('Overloaded');
	});

	it('an unsafe error code is dropped', async () => {
		const { fetchImpl } = fakeSseFetch([
			messageStart(),
			frame({ type: 'error', error: { type: 'bad code <script>', message: 'x' } })
		]);
		const err = (await failure(
			provider(fetchImpl).stream(req(), new AbortController().signal)
		)) as LlmError;
		expect(err.kind).toBe('interrupted');
		expect(err.code).toBeUndefined();
	});

	it('a body ending without message_stop is truncated', async () => {
		const { fetchImpl } = fakeSseFetch([messageStart(), textDelta('Hello')]);
		const err = (await failure(
			provider(fetchImpl).stream(req(), new AbortController().signal)
		)) as LlmError;
		expect(err).toBeInstanceOf(LlmError);
		expect(err.kind).toBe('interrupted');
		expect(err.code).toBe('truncated');
	});

	it('malformed JSON in a frame is interrupted/bad-json', async () => {
		const { fetchImpl } = fakeSseFetch([messageStart(), 'data: {not json\n\n']);
		const err = (await failure(
			provider(fetchImpl).stream(req(), new AbortController().signal)
		)) as LlmError;
		expect(err.kind).toBe('interrupted');
		expect(err.code).toBe('bad-json');
	});
});

describe('anthropicProvider HTTP errors', () => {
	const httpError = (status: number, body: unknown) =>
		fakeRouteFetch([{ match: (u) => u === MESSAGES_URL, respond: { status, body } }]).fetchImpl;

	it.each([
		[
			401,
			{ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } },
			'auth'
		],
		[
			529,
			{ type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } },
			'interrupted'
		],
		[
			400,
			{
				type: 'error',
				error: {
					type: 'invalid_request_error',
					message: 'You have reached your specified API usage spend limit.'
				}
			},
			'quota'
		]
	] as const)('HTTP %s → %s', async (status, body, kind) => {
		const err = await failure(
			provider(httpError(status, body)).stream(req(), new AbortController().signal)
		);
		expect(err).toBeInstanceOf(LlmError);
		expect((err as LlmError).kind).toBe(kind);
	});

	it('generation TypeError + readable models 200 → cors-blocked', async () => {
		const { fetchImpl } = fakeRouteFetch([
			{ match: (u) => u === MESSAGES_URL, respond: 'typeerror' },
			{ match: (u) => u === MODELS_URL, respond: { status: 200, body: { data: [] } } }
		]);
		const err = await failure(provider(fetchImpl).stream(req(), new AbortController().signal));
		expect((err as LlmError).kind).toBe('cors-blocked');
	});
});

describe('anthropicProvider Stop', () => {
	it('abort after the first text keeps the delivered text and rejects with an abort', async () => {
		const { fetchImpl } = fakeSseFetch([messageStart(), textDelta('Hello')], { holdOpen: true });
		const ctrl = new AbortController();
		const it = provider(fetchImpl).stream(req(), ctrl.signal)[Symbol.asyncIterator]();
		const delivered: string[] = [];
		for (;;) {
			const r = await it.next();
			if (r.done) throw new Error('stream ended unexpectedly');
			if (r.value.type === 'text') {
				delivered.push(r.value.text);
				break;
			}
		}
		ctrl.abort();
		let caught: unknown;
		try {
			await it.next();
		} catch (err) {
			caught = err;
		}
		expect(isAbort(caught, ctrl.signal)).toBe(true);
		expect(delivered).toEqual(['Hello']);
	});
});

describe('anthropicProbe', () => {
	it('Test connection ok; every probe request carries the browser header; canary is keyless', async () => {
		const { fetchImpl, calls } = fakeRouteFetch([
			{
				match: (u) => u === MODELS_URL,
				respond: {
					status: 200,
					body: { data: [{ id: 'claude-sonnet-5-5' }, { id: 'claude-opus-5-5' }] }
				}
			},
			{
				match: (u, i) => u === MESSAGES_URL && i.method === 'POST',
				respond: { status: 401, body: { type: 'error', error: { type: 'authentication_error' } } }
			}
		]);
		expect(
			await runTestConnection(anthropicProbe, 'k', 'claude-sonnet-5-5', { fetch: fetchImpl })
		).toEqual({
			outcome: 'ok',
			modelListed: true
		});
		expect(calls.length).toBeGreaterThanOrEqual(2);
		for (const c of calls) {
			expect(new URL(c.url).host).toBe('api.anthropic.com');
			const h = c.init.headers as Record<string, string>;
			expect(h['anthropic-dangerous-direct-browser-access']).toBe('true');
			expect(h['anthropic-version']).toBe('2023-06-01');
		}
		const canary = calls.find((c) => c.url === MESSAGES_URL)!;
		expect(canary.init.body).toBe('{}');
		expect(canary.init.headers).not.toHaveProperty('x-api-key');
		expect(JSON.stringify(canary)).not.toContain('"k"');
		const keyed = calls.find((c) => c.url === MODELS_URL)!;
		expect((keyed.init.headers as Record<string, string>)['x-api-key']).toBe('k');
	});

	it('modelListed is false when absent and undefined for an unknown shape', async () => {
		const f = (async () => new Response('{}')) as typeof fetch;
		expect(
			await anthropicProbe.modelListed('k', 'claude-sonnet-5-5', f, {
				status: 200,
				body: { data: [{ id: 'claude-opus-5-5' }] }
			})
		).toBe(false);
		expect(
			await anthropicProbe.modelListed('k', 'claude-sonnet-5-5', f, { status: 200, body: 'nope' })
		).toBeUndefined();
	});

	it('models 401 → auth', async () => {
		const { fetchImpl } = fakeRouteFetch([
			{
				match: (u) => u === MODELS_URL,
				respond: { status: 401, body: { error: { type: 'authentication_error' } } }
			}
		]);
		expect(
			await runTestConnection(anthropicProbe, 'bad', 'claude-sonnet-5-5', { fetch: fetchImpl })
		).toEqual({
			outcome: 'auth'
		});
	});
});
