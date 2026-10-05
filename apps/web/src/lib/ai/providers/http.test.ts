import { afterEach, describe, expect, it, vi } from 'vitest';
import { isAbort, type SseEvent } from '@tran/core/ai';
import { readSse, resolveFetch, safeJson } from './http.js';
import { fakeRouteFetch, fakeSseFetch } from './fake-sse.js';

afterEach(() => {
	vi.restoreAllMocks();
});

async function collect(it: AsyncIterable<SseEvent>): Promise<SseEvent[]> {
	const out: SseEvent[] = [];
	for await (const ev of it) out.push(ev);
	return out;
}

describe('resolveFetch', () => {
	it('calls an injected fetch as a free function (no Illegal invocation)', async () => {
		// Mimics the browser: fetch throws when invoked with a foreign `this`.
		function strictFetch(this: unknown): Promise<Response> {
			if (this !== undefined) throw new TypeError('Illegal invocation');
			return Promise.resolve(new Response('ok'));
		}
		const f = resolveFetch({ fetch: strictFetch as unknown as typeof fetch });
		const res = await f('https://example.test/');
		expect(await res.text()).toBe('ok');
	});

	it('resolves globalThis.fetch at call time', async () => {
		const f = resolveFetch();
		// A bare call hits the Vitest no-network thrower.
		await expect(Promise.resolve().then(() => f('https://example.test/'))).rejects.toThrow(
			/Network access is disabled/
		);
		const replacement = vi.fn(async () => new Response('replaced'));
		globalThis.fetch = replacement as unknown as typeof fetch;
		const res = await f('https://example.test/', { method: 'POST' });
		expect(await res.text()).toBe('replaced');
		expect(replacement).toHaveBeenCalledWith('https://example.test/', { method: 'POST' });
	});
});

describe('readSse', () => {
	it('survives multi-byte UTF-8 split across 1-byte chunks', async () => {
		const { fetchImpl } = fakeSseFetch(['data: {"t":"It’s"}\n\n', 'data: {"t":"🏠"}\n\n'], {
			bytes: true,
			splitEvery: 1
		});
		const ctrl = new AbortController();
		const res = await fetchImpl('https://example.test/', { signal: ctrl.signal });
		const events = await collect(readSse(res, ctrl.signal));
		expect(events.map((e) => (JSON.parse(e.data) as { t: string }).t)).toEqual(['It’s', '🏠']);
	});

	it('also survives character-split string chunks', async () => {
		const { fetchImpl } = fakeSseFetch(['event: x\ndata: {"t":"’🏠"}\n\n'], { splitEvery: 1 });
		const ctrl = new AbortController();
		const events = await collect(readSse(await fetchImpl('u'), ctrl.signal));
		expect(events).toEqual([{ event: 'x', data: '{"t":"’🏠"}' }]);
	});

	it('flushes a final event without a trailing blank line', async () => {
		const { fetchImpl } = fakeSseFetch(['data: {"t":"a"}\n\n', 'data: {"t":"b"}']);
		const ctrl = new AbortController();
		const events = await collect(readSse(await fetchImpl('u'), ctrl.signal));
		expect(events.map((e) => e.data)).toEqual(['{"t":"a"}', '{"t":"b"}']);
	});

	it('stops promptly on abort and cancels the reader', async () => {
		const cancel = vi.spyOn(ReadableStreamDefaultReader.prototype, 'cancel');
		const { fetchImpl } = fakeSseFetch(['data: first\n\n'], { holdOpen: true });
		const ctrl = new AbortController();
		const res = await fetchImpl('u', { signal: ctrl.signal });
		const it = readSse(res, ctrl.signal)[Symbol.asyncIterator]();
		expect((await it.next()).value).toEqual({ event: 'message', data: 'first' });

		const pending = it.next();
		ctrl.abort();
		const timeout = new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), 100));
		const outcome = await Promise.race([
			pending.then(
				() => 'resolved' as const,
				(err: unknown) => err
			),
			timeout
		]);
		expect(outcome).not.toBe('timeout');
		expect(outcome).not.toBe('resolved');
		expect(isAbort(outcome, ctrl.signal)).toBe(true);
		expect(cancel).toHaveBeenCalled();
	});
});

describe('safeJson', () => {
	it('parses JSON regardless of content-type', async () => {
		const res = new Response('{"error":{"code":400}}', {
			headers: { 'content-type': 'text/event-stream' }
		});
		expect(await safeJson(res)).toEqual({ error: { code: 400 } });
	});

	it('returns non-JSON text verbatim', async () => {
		expect(await safeJson(new Response('Unauthorized'))).toBe('Unauthorized');
	});

	it('returns undefined for an empty body', async () => {
		expect(await safeJson(new Response(''))).toBeUndefined();
		expect(await safeJson(new Response(null))).toBeUndefined();
	});

	it('never throws, even on a consumed body', async () => {
		const res = new Response('x');
		await res.text();
		await expect(safeJson(res)).resolves.toBeUndefined();
	});
});

describe('fakeRouteFetch', () => {
	it('first matching route wins and calls are recorded', async () => {
		const { fetchImpl, calls } = fakeRouteFetch([
			{ match: (u) => u.includes('/a'), respond: { status: 401, body: { error: 'x' } } },
			{ match: () => true, respond: { status: 200, body: 'plain' } }
		]);
		const a = await fetchImpl('https://h.test/a', { method: 'GET' });
		expect(a.status).toBe(401);
		expect(a.headers.get('content-type')).toBe('application/json');
		expect(await a.json()).toEqual({ error: 'x' });
		const b = await fetchImpl(new URL('https://h.test/b'));
		expect(await b.text()).toBe('plain');
		expect(calls.map((c) => c.url)).toEqual(['https://h.test/a', 'https://h.test/b']);
		expect(calls[0]?.init).toEqual({ method: 'GET' });
	});

	it("'typeerror' throws TypeError('Failed to fetch')", async () => {
		const { fetchImpl } = fakeRouteFetch([{ match: () => true, respond: 'typeerror' }]);
		await expect(fetchImpl('u')).rejects.toThrow(new TypeError('Failed to fetch'));
	});

	it('a pre-aborted signal throws an AbortError', async () => {
		const { fetchImpl } = fakeRouteFetch([{ match: () => true, respond: { status: 200 } }]);
		const ctrl = new AbortController();
		ctrl.abort();
		const err = await fetchImpl('u', { signal: ctrl.signal }).catch((e: unknown) => e);
		expect((err as { name?: string }).name).toBe('AbortError');
	});
});
