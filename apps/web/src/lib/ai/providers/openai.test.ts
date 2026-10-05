import { describe, expect, it } from 'vitest';
import { LlmError, isAbort } from '@tran/core/ai';
import type { LlmEvent, LlmRequest } from '../ports.js';
import { fakeRouteFetch, fakeSseFetch } from './fake-sse.js';
import { openaiProbe, openaiProvider } from './openai.js';
import { runTestConnection } from './test-connection.js';

const RESPONSES_URL = 'https://api.openai.com/v1/responses';
const MODELS_URL = 'https://api.openai.com/v1/models';

const req = (o: Partial<LlmRequest> = {}): LlmRequest => ({
	model: 'gpt-6.1-sol',
	system: 'You draft listing copy.',
	user: 'Describe a 2 bed condo.',
	maxTokens: 900,
	containsClientData: false,
	...o
});

const frame = (data: Record<string, unknown>) =>
	`event: ${String(data.type)}\ndata: ${JSON.stringify(data)}\n\n`;
const created = () => frame({ type: 'response.created', response: { id: 'resp_1' } });
const textDelta = (delta: string) => frame({ type: 'response.output_text.delta', delta });
const completed = (usage: Record<string, unknown>) =>
	frame({ type: 'response.completed', response: { id: 'resp_1', usage } });
const incomplete = (reason: string, usage?: Record<string, unknown>) =>
	frame({
		type: 'response.incomplete',
		response: { incomplete_details: { reason }, ...(usage ? { usage } : {}) }
	});

const HAPPY = [
	created(),
	frame({ type: 'response.in_progress' }),
	frame({ type: 'response.output_item.added', item: { type: 'message' } }),
	frame({ type: 'response.content_part.added', part: { type: 'output_text' } }),
	textDelta('Hi'),
	frame({ type: 'response.reasoning_summary_text.delta', delta: 'hidden' }),
	textDelta(' you'),
	completed({
		input_tokens: 20,
		output_tokens: 30,
		output_tokens_details: { reasoning_tokens: 10 }
	})
];

const EXPECTED: LlmEvent[] = [
	{ type: 'text', text: 'Hi' },
	{ type: 'text', text: ' you' },
	{ type: 'usage', usage: { inputTokens: 20, outputTokens: 30, reasoningTokens: 10 } },
	{ type: 'finish', reason: 'stop' }
];

async function collect(it: AsyncIterable<LlmEvent>): Promise<LlmEvent[]> {
	const out: LlmEvent[] = [];
	for await (const e of it) out.push(e);
	return out;
}

async function failure(it: AsyncIterable<LlmEvent>): Promise<LlmError> {
	try {
		await collect(it);
	} catch (err) {
		expect(err).toBeInstanceOf(LlmError);
		return err as LlmError;
	}
	throw new Error('expected the stream to throw');
}

const provider = (fetchImpl: typeof fetch, o: { key?: string | null; online?: boolean } = {}) =>
	openaiProvider({
		getKey: async () => (o.key === undefined ? 'k' : o.key),
		fetch: fetchImpl,
		isOnline: () => o.online ?? true
	});

const run = (fetchImpl: typeof fetch, r = req(), o?: { key?: string | null; online?: boolean }) =>
	provider(fetchImpl, o).stream(r, new AbortController().signal);

const bodyOf = (init: RequestInit) => JSON.parse(String(init.body)) as Record<string, unknown>;

describe('openaiProvider request', () => {
	it('POSTs to the Responses API with store:false and stream:true', async () => {
		const { fetchImpl, calls } = fakeSseFetch(HAPPY);
		await collect(run(fetchImpl));
		expect(calls).toHaveLength(1);
		const [{ url, init }] = calls;
		expect(url).toBe(RESPONSES_URL);
		expect(new URL(url).host).toBe('api.openai.com');
		expect(init.method).toBe('POST');
		expect(init.credentials).toBe('omit');
		expect(init.headers).toEqual({ authorization: 'Bearer k', 'content-type': 'application/json' });
		const body = bodyOf(init);
		expect(body.model).toBe('gpt-6.1-sol');
		expect(body.instructions).toBe('You draft listing copy.');
		expect(body.input).toBe('Describe a 2 bed condo.');
		expect(body.max_output_tokens).toBe(900);
		expect(body.stream).toBe(true);
		expect(body.store).toBe(false);
		expect(body.reasoning).toEqual({ effort: 'low' });
	});

	it('an overridden model gets no reasoning extras', async () => {
		const { fetchImpl, calls } = fakeSseFetch(HAPPY);
		await collect(run(fetchImpl, req({ model: 'gpt-5.6-terra' })));
		const body = bodyOf(calls[0].init);
		expect(body.model).toBe('gpt-5.6-terra');
		expect(body).not.toHaveProperty('reasoning');
		expect(body.store).toBe(false);
	});

	it('locked vault throws locked before any fetch', async () => {
		const { fetchImpl, calls } = fakeSseFetch(HAPPY);
		expect((await failure(run(fetchImpl, req(), { key: null }))).kind).toBe('locked');
		expect(calls).toHaveLength(0);
	});
});

describe('openaiProvider stream mapping', () => {
	it('yields text and usage in order; reasoning summaries are never shown', async () => {
		const { fetchImpl } = fakeSseFetch(HAPPY);
		const events = await collect(run(fetchImpl));
		expect(events).toEqual(EXPECTED);
		expect(JSON.stringify(events)).not.toContain('hidden');
	});

	it('is identical when split into 1-byte chunks', async () => {
		const { fetchImpl } = fakeSseFetch(HAPPY, { splitEvery: 1, bytes: true });
		expect(await collect(run(fetchImpl))).toEqual(EXPECTED);
	});

	it.each([
		['max_output_tokens', 'length'],
		['content_filter', 'refused']
	] as const)('response.incomplete %s → finish %s', async (reason, finish) => {
		const { fetchImpl } = fakeSseFetch([
			created(),
			textDelta('x'),
			incomplete(reason, { input_tokens: 5, output_tokens: 9 })
		]);
		expect(await collect(run(fetchImpl))).toEqual([
			{ type: 'text', text: 'x' },
			{ type: 'usage', usage: { inputTokens: 5, outputTokens: 9 } },
			{ type: 'finish', reason: finish }
		]);
	});

	it('refusal deltas finish refused once and never yield the refusal text', async () => {
		const { fetchImpl } = fakeSseFetch([
			created(),
			frame({ type: 'response.refusal.delta', delta: 'I cannot help' }),
			frame({ type: 'response.refusal.delta', delta: ' with that.' }),
			frame({ type: 'response.refusal.done', refusal: 'I cannot help with that.' }),
			completed({ input_tokens: 3, output_tokens: 4 })
		]);
		const events = await collect(run(fetchImpl));
		expect(events.filter((e) => e.type === 'finish')).toEqual([
			{ type: 'finish', reason: 'refused' }
		]);
		expect(events.some((e) => e.type === 'text')).toBe(false);
		expect(JSON.stringify(events)).not.toContain('cannot help');
	});

	it('an error event becomes interrupted with its code and no provider text', async () => {
		const { fetchImpl } = fakeSseFetch([
			created(),
			textDelta('Hi'),
			frame({ type: 'error', code: 'server_error', message: 'x' })
		]);
		const err = await failure(run(fetchImpl));
		expect(err.kind).toBe('interrupted');
		expect(err.code).toBe('server_error');
		expect(err.message).toBe('interrupted');
	});

	it('response.failed becomes interrupted', async () => {
		const { fetchImpl } = fakeSseFetch([
			created(),
			frame({
				type: 'response.failed',
				response: { error: { code: 'rate_limit_exceeded', message: 'Slow down' } }
			})
		]);
		const err = await failure(run(fetchImpl));
		expect(err.kind).toBe('interrupted');
		expect(err.code).toBe('rate_limit_exceeded');
		expect(JSON.stringify(err)).not.toContain('Slow down');
	});

	it('no terminal event → interrupted/truncated', async () => {
		const { fetchImpl } = fakeSseFetch([created(), textDelta('Hi')]);
		const err = await failure(run(fetchImpl));
		expect(err.kind).toBe('interrupted');
		expect(err.code).toBe('truncated');
	});

	it('malformed JSON → interrupted/bad-json', async () => {
		const { fetchImpl } = fakeSseFetch([created(), 'data: {oops\n\n']);
		expect((await failure(run(fetchImpl))).code).toBe('bad-json');
	});
});

describe('openaiProvider failures', () => {
	const routes = (
		gen: 'typeerror' | { status: number; body?: unknown },
		models?: 'typeerror' | { status: number; body?: unknown }
	) =>
		fakeRouteFetch([
			{ match: (u) => u === RESPONSES_URL, respond: gen },
			{ match: (u) => u === MODELS_URL, respond: models ?? { status: 200, body: { data: [] } } }
		]);

	it('THE TRAP: generation "Failed to fetch" + models 401 invalid_api_key → auth, not cors-blocked', async () => {
		const { fetchImpl, calls } = routes('typeerror', {
			status: 401,
			body: { error: { code: 'invalid_api_key', message: 'Incorrect API key provided: sk-...' } }
		});
		const err = await failure(run(fetchImpl));
		expect(err.kind).toBe('auth');
		expect(err.message).toBe('auth');
		expect(calls.map((c) => c.url)).toEqual([RESPONSES_URL, MODELS_URL]);
		expect((calls[1].init.headers as Record<string, string>).authorization).toBe('Bearer k');
	});

	it('generation TypeError + models 200 → cors-blocked', async () => {
		const { fetchImpl } = routes('typeerror');
		expect((await failure(run(fetchImpl))).kind).toBe('cors-blocked');
	});

	it('generation TypeError + models TypeError while offline → network', async () => {
		const { fetchImpl } = routes('typeerror', 'typeerror');
		expect((await failure(run(fetchImpl, req(), { online: false }))).kind).toBe('network');
	});

	it.each([
		[429, { error: { code: 'insufficient_quota', type: 'insufficient_quota' } }, 'quota'],
		[404, { error: { code: 'model_not_found', param: 'model' } }, 'model-not-found'],
		[401, { error: { code: 'invalid_api_key' } }, 'auth'],
		[500, { error: { code: 'server_error' } }, 'interrupted']
	] as const)('HTTP %s → %s', async (status, body, kind) => {
		const { fetchImpl } = routes({ status, body });
		expect((await failure(run(fetchImpl))).kind).toBe(kind);
	});
});

describe('openaiProvider Stop', () => {
	it('abort keeps already-yielded text and rejects with an abort', async () => {
		const { fetchImpl } = fakeSseFetch([created(), textDelta('Hi')], { holdOpen: true });
		const ctrl = new AbortController();
		const it = provider(fetchImpl).stream(req(), ctrl.signal)[Symbol.asyncIterator]();
		const first = await it.next();
		expect(first.value).toEqual({ type: 'text', text: 'Hi' });
		ctrl.abort();
		let caught: unknown;
		try {
			await it.next();
		} catch (err) {
			caught = err;
		}
		expect(isAbort(caught, ctrl.signal)).toBe(true);
	});
});

describe('openaiProbe', () => {
	it('models 200 listing the model + canary 401 → ok/listed; canary carries no key', async () => {
		const { fetchImpl, calls } = fakeRouteFetch([
			{
				match: (u) => u === MODELS_URL,
				respond: {
					status: 200,
					body: { object: 'list', data: [{ id: 'gpt-6.1-sol' }, { id: 'gpt-5.6-terra' }] }
				}
			},
			{
				match: (u, i) => u === RESPONSES_URL && i.method === 'POST',
				respond: {
					status: 401,
					body: { error: { code: null, message: 'You did not provide an API key.' } }
				}
			}
		]);
		expect(await runTestConnection(openaiProbe, 'k', 'gpt-6.1-sol', { fetch: fetchImpl })).toEqual({
			outcome: 'ok',
			modelListed: true
		});
		for (const c of calls) expect(new URL(c.url).host).toBe('api.openai.com');
		const canary = calls.find((c) => c.url === RESPONSES_URL)!;
		expect(canary.init.body).toBe('{}');
		expect(canary.init.headers).toEqual({ 'content-type': 'application/json' });
		const keyed = calls.find((c) => c.url === MODELS_URL)!;
		expect(keyed.init.headers).toEqual({ authorization: 'Bearer k' });
	});

	it('models 401 → auth', async () => {
		const { fetchImpl } = fakeRouteFetch([
			{
				match: (u) => u === MODELS_URL,
				respond: { status: 401, body: { error: { code: 'invalid_api_key' } } }
			}
		]);
		expect(
			await runTestConnection(openaiProbe, 'bad', 'gpt-6.1-sol', { fetch: fetchImpl })
		).toEqual({
			outcome: 'auth'
		});
	});

	it('modelListed is undefined for an unknown body shape', async () => {
		const f = (async () => new Response('{}')) as typeof fetch;
		expect(
			await openaiProbe.modelListed('k', 'gpt-6.1-sol', f, { status: 200, body: {} })
		).toBeUndefined();
		expect(
			await openaiProbe.modelListed('k', 'gpt-6.1-sol', f, {
				status: 200,
				body: { data: [{ id: 'x' }] }
			})
		).toBe(false);
	});
});
