import { describe, expect, it, vi } from 'vitest';
import { LlmError, isAbort } from '@tran/core/ai';
import type { LlmEvent, LlmRequest } from '../ports.js';
import { fakeRouteFetch, fakeSseFetch } from './fake-sse.js';
import { geminiProbe, geminiProvider } from './gemini.js';
import { runTestConnection } from './test-connection.js';

const HOST = 'generativelanguage.googleapis.com';
const STREAM_URL = `https://${HOST}/v1beta/models/gemini-3.8-flash:streamGenerateContent?alt=sse`;

const sse = (o: unknown): string => `data: ${JSON.stringify(o)}\n\n`;

function req(over: Partial<LlmRequest> = {}): LlmRequest {
	return {
		model: 'gemini-3.8-flash',
		system: 'You are careful.',
		user: 'Write a listing blurb.',
		maxTokens: 400,
		containsClientData: false,
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

const DONE_FRAMES = [
	sse({ candidates: [{ content: { parts: [{ text: 'Hi' }] }, finishReason: 'STOP' }] })
];

function expectNoKeyInUrls(calls: { url: string }[]): void {
	expect(calls.length).toBeGreaterThan(0);
	for (const c of calls) {
		expect(c.url).not.toMatch(/[?&]key=/);
		expect(new URL(c.url).host).toBe(HOST);
	}
}

describe('geminiProvider request', () => {
	it('posts to the native SSE endpoint with the key in a header only', async () => {
		const { fetchImpl, calls } = fakeSseFetch(DONE_FRAMES);
		const p = geminiProvider({ fetch: fetchImpl, getKey: async () => 'k' });
		await collect(p.stream(req(), new AbortController().signal));

		expect(p.id).toBe('gemini');
		expect(calls).toHaveLength(1);
		expect(calls[0].url).toBe(STREAM_URL);
		expectNoKeyInUrls(calls);
		expect(calls[0].init.method).toBe('POST');
		expect(calls[0].init.headers).toEqual({
			'content-type': 'application/json',
			'x-goog-api-key': 'k'
		});
	});

	it('percent-encodes the model in the path', async () => {
		const { fetchImpl, calls } = fakeSseFetch(DONE_FRAMES);
		const p = geminiProvider({ fetch: fetchImpl, getKey: async () => 'k' });
		await collect(p.stream(req({ model: 'tuned/x y' }), new AbortController().signal));
		expect(calls[0].url).toBe(
			`https://${HOST}/v1beta/models/tuned%2Fx%20y:streamGenerateContent?alt=sse`
		);
		expectNoKeyInUrls(calls);
	});

	it('builds the body with systemInstruction, contents and generationConfig extras', async () => {
		const { fetchImpl, calls } = fakeSseFetch(DONE_FRAMES);
		const p = geminiProvider({ fetch: fetchImpl, getKey: async () => 'k' });
		await collect(p.stream(req(), new AbortController().signal));
		const body = JSON.parse(String(calls[0].init.body)) as Record<string, unknown>;
		expect(body).toEqual({
			systemInstruction: { parts: [{ text: 'You are careful.' }] },
			contents: [{ role: 'user', parts: [{ text: 'Write a listing blurb.' }] }],
			generationConfig: { maxOutputTokens: 400, thinkingConfig: { thinkingLevel: 'low' } }
		});
		expect(body).not.toHaveProperty('thinkingConfig');
	});

	it('adds no thinkingConfig for a model without extras', async () => {
		const { fetchImpl, calls } = fakeSseFetch(DONE_FRAMES);
		const p = geminiProvider({ fetch: fetchImpl, getKey: async () => 'k' });
		await collect(p.stream(req({ model: 'gemini-3.5-flash-lite' }), new AbortController().signal));
		const body = JSON.parse(String(calls[0].init.body)) as { generationConfig: unknown };
		expect(body.generationConfig).toEqual({ maxOutputTokens: 400 });
		expectNoKeyInUrls(calls);
	});

	it('rejects locked when no key is available, without fetching', async () => {
		const { fetchImpl, calls } = fakeSseFetch(DONE_FRAMES);
		const p = geminiProvider({ fetch: fetchImpl, getKey: async () => undefined });
		const err = await rejection(collect(p.stream(req(), new AbortController().signal)));
		expect(err).toBeInstanceOf(LlmError);
		expect((err as LlmError).kind).toBe('locked');
		expect(calls).toHaveLength(0);
	});
});

describe('geminiProvider consent guard', () => {
	it('refuses client data without an explicit ack, before the key or any fetch', async () => {
		const { fetchImpl, calls } = fakeSseFetch(DONE_FRAMES);
		const getKey = vi.fn(async () => 'k');
		const p = geminiProvider({ fetch: fetchImpl, getKey });
		const err = await rejection(
			collect(p.stream(req({ containsClientData: true }), new AbortController().signal))
		);
		expect(err).toBeInstanceOf(LlmError);
		expect((err as LlmError).kind).toBe('consent-required');
		expect(getKey).not.toHaveBeenCalled();
		expect(calls.length).toBe(0);
	});

	it('refuses client data when the ack is anything but true', async () => {
		const { fetchImpl, calls } = fakeSseFetch(DONE_FRAMES);
		const p = geminiProvider({ fetch: fetchImpl, getKey: async () => 'k' });
		const err = await rejection(
			collect(
				p.stream(
					req({ containsClientData: true, clientDataAck: false }),
					new AbortController().signal
				)
			)
		);
		expect((err as LlmError).kind).toBe('consent-required');
		expect(calls.length).toBe(0);
	});

	it('sends client data when the ack is true', async () => {
		const { fetchImpl, calls } = fakeSseFetch(DONE_FRAMES);
		const p = geminiProvider({ fetch: fetchImpl, getKey: async () => 'k' });
		await collect(
			p.stream(req({ containsClientData: true, clientDataAck: true }), new AbortController().signal)
		);
		expect(calls.length).toBe(1);
		expectNoKeyInUrls(calls);
	});

	it('sends non-client prompts without an ack', async () => {
		const { fetchImpl, calls } = fakeSseFetch(DONE_FRAMES);
		const p = geminiProvider({ fetch: fetchImpl, getKey: async () => 'k' });
		await collect(p.stream(req({ containsClientData: false }), new AbortController().signal));
		expect(calls.length).toBe(1);
	});
});

describe('geminiProvider stream mapping', () => {
	it('hides thought parts and bills candidates plus thoughts', async () => {
		const { fetchImpl, calls } = fakeSseFetch(
			[
				sse({
					candidates: [{ content: { parts: [{ text: 'plan', thought: true }, { text: 'Hello' }] } }]
				}),
				sse({
					candidates: [{ content: { parts: [{ text: ' there' }] }, finishReason: 'STOP' }],
					usageMetadata: { promptTokenCount: 9, candidatesTokenCount: 5, thoughtsTokenCount: 20 }
				})
			],
			{ splitEvery: 7 }
		);
		const p = geminiProvider({ fetch: fetchImpl, getKey: async () => 'k' });
		const events = await collect(p.stream(req(), new AbortController().signal));
		expect(events).toEqual([
			{ type: 'text', text: 'Hello' },
			{ type: 'text', text: ' there' },
			{ type: 'usage', usage: { inputTokens: 9, outputTokens: 25, reasoningTokens: 20 } },
			{ type: 'finish', reason: 'stop' }
		]);
		expect(JSON.stringify(events)).not.toContain('plan');
		expectNoKeyInUrls(calls);
	});

	it.each([
		['MAX_TOKENS', 'length'],
		['SAFETY', 'refused'],
		['PROHIBITED_CONTENT', 'refused'],
		['BLOCKLIST', 'refused'],
		['SPII', 'refused'],
		['RECITATION', 'refused'],
		['OTHER', 'stop']
	])('finishReason %s → %s', async (finishReason, reason) => {
		const { fetchImpl } = fakeSseFetch([
			sse({ candidates: [{ content: { parts: [{ text: 'x' }] }, finishReason }] })
		]);
		const p = geminiProvider({ fetch: fetchImpl, getKey: async () => 'k' });
		const events = await collect(p.stream(req(), new AbortController().signal));
		expect(events.at(-1)).toEqual({ type: 'finish', reason });
	});

	it('promptFeedback.blockReason with no candidates → refused', async () => {
		const { fetchImpl } = fakeSseFetch([
			sse({ promptFeedback: { blockReason: 'SAFETY' }, usageMetadata: { promptTokenCount: 3 } })
		]);
		const p = geminiProvider({ fetch: fetchImpl, getKey: async () => 'k' });
		const events = await collect(p.stream(req(), new AbortController().signal));
		expect(events.at(-1)).toEqual({ type: 'finish', reason: 'refused' });
		expect(events.filter((e) => e.type === 'text')).toHaveLength(0);
	});

	it('a top-level error in a data frame → interrupted with a sanitized code', async () => {
		const { fetchImpl } = fakeSseFetch([
			sse({ candidates: [{ content: { parts: [{ text: 'a' }] } }] }),
			sse({ error: { code: 500, status: 'INTERNAL', message: 'secret provider text' } })
		]);
		const p = geminiProvider({ fetch: fetchImpl, getKey: async () => 'k' });
		const err = await rejection(collect(p.stream(req(), new AbortController().signal)));
		expect(err).toBeInstanceOf(LlmError);
		expect((err as LlmError).kind).toBe('interrupted');
		expect((err as LlmError).code).toBe('INTERNAL');
		expect((err as LlmError).message).not.toContain('secret');
	});

	it('a body ending without a finishReason → interrupted truncated', async () => {
		const { fetchImpl } = fakeSseFetch([
			sse({ candidates: [{ content: { parts: [{ text: 'a' }] } }] })
		]);
		const p = geminiProvider({ fetch: fetchImpl, getKey: async () => 'k' });
		const err = await rejection(collect(p.stream(req(), new AbortController().signal)));
		expect((err as LlmError).kind).toBe('interrupted');
		expect((err as LlmError).code).toBe('truncated');
	});

	it('unparseable data → interrupted bad-json', async () => {
		const { fetchImpl } = fakeSseFetch(['data: {not json\n\n']);
		const p = geminiProvider({ fetch: fetchImpl, getKey: async () => 'k' });
		const err = await rejection(collect(p.stream(req(), new AbortController().signal)));
		expect((err as LlmError).kind).toBe('interrupted');
		expect((err as LlmError).code).toBe('bad-json');
	});
});

describe('geminiProvider HTTP errors', () => {
	it('400 API_KEY_INVALID served as text/event-stream with a JSON body → auth', async () => {
		const body =
			'{"error":{"code":400,"status":"INVALID_ARGUMENT","message":"API key not valid. Please pass a valid API key.","details":[{"reason":"API_KEY_INVALID"}]}}';
		const { fetchImpl, calls } = fakeSseFetch([body], {
			status: 400,
			headers: { 'content-type': 'text/event-stream' }
		});
		const p = geminiProvider({ fetch: fetchImpl, getKey: async () => 'k' });
		const err = await rejection(collect(p.stream(req(), new AbortController().signal)));
		expect(err).toBeInstanceOf(LlmError);
		expect((err as LlmError).kind).toBe('auth');
		expect((err as LlmError).message).not.toContain('API key not valid');
		expectNoKeyInUrls(calls);
	});

	it('403 PERMISSION_DENIED → auth', async () => {
		const { fetchImpl } = fakeSseFetch(
			['{"error":{"code":403,"status":"PERMISSION_DENIED","message":"denied"}}'],
			{ status: 403 }
		);
		const p = geminiProvider({ fetch: fetchImpl, getKey: async () => 'k' });
		const err = await rejection(collect(p.stream(req(), new AbortController().signal)));
		expect((err as LlmError).kind).toBe('auth');
	});

	it('429 RESOURCE_EXHAUSTED → quota', async () => {
		const { fetchImpl } = fakeSseFetch(
			['{"error":{"code":429,"status":"RESOURCE_EXHAUSTED","message":"slow down"}}'],
			{ status: 429 }
		);
		const p = geminiProvider({ fetch: fetchImpl, getKey: async () => 'k' });
		const err = await rejection(collect(p.stream(req(), new AbortController().signal)));
		expect((err as LlmError).kind).toBe('quota');
	});
});

describe('geminiProvider stop', () => {
	it('keeps yielded text and rejects with an abort', async () => {
		const { fetchImpl } = fakeSseFetch(
			[sse({ candidates: [{ content: { parts: [{ text: 'Partial' }] } }] })],
			{ holdOpen: true }
		);
		const p = geminiProvider({ fetch: fetchImpl, getKey: async () => 'k' });
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

describe('geminiProbe', () => {
	const LIST = `https://${HOST}/v1beta/models?pageSize=1000`;

	it('follows nextPageToken with the key in the header, and the canary carries no key', async () => {
		const { fetchImpl, calls } = fakeRouteFetch([
			{
				match: (u) => u === `${LIST}&pageToken=p2`,
				respond: { status: 200, body: { models: [{ name: 'models/gemini-3.8-flash' }] } }
			},
			{
				match: (u) => u === LIST,
				respond: {
					status: 200,
					body: { models: [{ name: 'models/gemini-3.5-flash-lite' }], nextPageToken: 'p2' }
				}
			},
			{
				match: (u, i) => u === STREAM_URL && i.method === 'POST',
				respond: { status: 403, body: { error: { code: 403, status: 'PERMISSION_DENIED' } } }
			}
		]);
		const r = await runTestConnection(geminiProbe, 'k', 'gemini-3.8-flash', { fetch: fetchImpl });
		expect(r).toEqual({ outcome: 'ok', modelListed: true });
		expectNoKeyInUrls(calls);

		const keyed = calls.filter(
			(c) => (c.init.headers as Record<string, string> | undefined)?.['x-goog-api-key'] === 'k'
		);
		expect(keyed.map((c) => c.url)).toEqual([LIST, `${LIST}&pageToken=p2`]);

		const canary = calls.find((c) => c.url === STREAM_URL);
		expect(canary?.init.body).toBe('{}');
		expect(canary?.init.headers).toEqual({ 'content-type': 'application/json' });
		expect(JSON.stringify(canary?.init)).not.toContain('"k"');
	});

	it('reports the model unlisted after at most 5 pages', async () => {
		let n = 0;
		const { fetchImpl, calls } = fakeRouteFetch([
			{
				match: (u) => u.startsWith(LIST),
				respond: {
					status: 200,
					body: { models: [{ name: 'models/other' }], nextPageToken: 'more' }
				}
			},
			{ match: (u) => u === STREAM_URL, respond: { status: 403 } }
		]);
		const r = await runTestConnection(geminiProbe, 'k', 'gemini-3.8-flash', {
			fetch: (i, init) => {
				n++;
				return fetchImpl(i, init);
			}
		});
		expect(r).toEqual({ outcome: 'ok', modelListed: false });
		expect(calls.filter((c) => c.url.startsWith(LIST))).toHaveLength(5);
		expect(n).toBe(6);
		expectNoKeyInUrls(calls);
	});

	it('keyCheck 400 API_KEY_INVALID → auth', async () => {
		const { fetchImpl, calls } = fakeRouteFetch([
			{
				match: (u) => u === LIST,
				respond: {
					status: 400,
					body: {
						error: {
							code: 400,
							status: 'INVALID_ARGUMENT',
							message: 'API key not valid. Please pass a valid API key.',
							details: [{ reason: 'API_KEY_INVALID' }]
						}
					}
				}
			}
		]);
		const r = await runTestConnection(geminiProbe, 'bad', 'gemini-3.8-flash', {
			fetch: fetchImpl
		});
		expect(r).toEqual({ outcome: 'auth' });
		expectNoKeyInUrls(calls);
	});

	it('exposes its id and host', () => {
		expect(geminiProbe.id).toBe('gemini');
		expect(geminiProbe.host).toBe(HOST);
	});
});
