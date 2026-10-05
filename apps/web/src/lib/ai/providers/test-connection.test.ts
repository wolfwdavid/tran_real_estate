import { describe, expect, it } from 'vitest';
import { LlmError, type LiveProviderId } from '@tran/core/ai';
import type { ProviderProbe } from '../ports.js';
import { fakeRouteFetch, fakeSseFetch, type FakeRoute } from './fake-sse.js';
import { openStream, safeJson } from './http.js';
import { disambiguateFetchFailure, runTestConnection } from './test-connection.js';

const KEY_URL = 'https://probe.test/key';
const MODELS_URL = 'https://probe.test/models';
const CANARY_URL = 'https://probe.test/canary';

function makeProbe(id: LiveProviderId = 'openai'): ProviderProbe {
	return {
		id,
		host: 'probe.test',
		async keyCheck(key, f) {
			const res = await f(KEY_URL, { headers: { 'x-key': key } });
			return { status: res.status, body: await safeJson(res) };
		},
		async modelListed(key, model, f) {
			const res = await f(MODELS_URL, { headers: { 'x-key': key } });
			const body = (await res.json()) as { data: { id: string }[] };
			return body.data.some((m) => m.id === model);
		},
		async canary(f) {
			const res = await f(CANARY_URL, { method: 'POST', body: '{}' });
			return res.status;
		}
	};
}

type Respond = FakeRoute['respond'];

function routes(o: { key: Respond; models?: Respond; canary?: Respond }) {
	return fakeRouteFetch([
		{ match: (u) => u === KEY_URL, respond: o.key },
		{
			match: (u) => u === MODELS_URL,
			respond: o.models ?? { status: 200, body: { data: [{ id: 'm1' }] } }
		},
		{ match: (u) => u === CANARY_URL, respond: o.canary ?? { status: 401 } }
	]);
}

const online = () => true;
const offline = () => false;

describe('runTestConnection', () => {
	it('key ok + model listed + canary readable → ok, listed', async () => {
		const { fetchImpl } = routes({ key: { status: 200, body: {} } });
		expect(
			await runTestConnection(makeProbe(), 'k-secret', 'm1', {
				fetch: fetchImpl,
				isOnline: online
			})
		).toEqual({ outcome: 'ok', modelListed: true });
	});

	it('key ok + model not listed → ok, not listed', async () => {
		const { fetchImpl } = routes({
			key: { status: 200, body: {} },
			models: { status: 200, body: { data: [{ id: 'other' }] } }
		});
		expect(await runTestConnection(makeProbe(), 'k-secret', 'm1', { fetch: fetchImpl })).toEqual({
			outcome: 'ok',
			modelListed: false
		});
	});

	it('key ok + modelListed throws → ok, listing unknown', async () => {
		const { fetchImpl } = routes({ key: { status: 200, body: {} }, models: 'typeerror' });
		const result = await runTestConnection(makeProbe(), 'k-secret', 'm1', { fetch: fetchImpl });
		expect(result.outcome).toBe('ok');
		expect(result.modelListed).toBeUndefined();
	});

	it('key ok + canary TypeError → cors-blocked', async () => {
		const { fetchImpl } = routes({ key: { status: 200, body: {} }, canary: 'typeerror' });
		expect(await runTestConnection(makeProbe(), 'k-secret', 'm1', { fetch: fetchImpl })).toEqual({
			outcome: 'cors-blocked'
		});
	});

	it.each([
		[401, 'auth'],
		[403, 'auth'],
		[429, 'quota'],
		[402, 'quota'],
		[500, 'network']
	] as const)('key status %i → %s', async (status, outcome) => {
		const { fetchImpl } = routes({ key: { status, body: { error: { message: 'nope' } } } });
		expect(await runTestConnection(makeProbe(), 'k-secret', 'm1', { fetch: fetchImpl })).toEqual({
			outcome
		});
	});

	it('Gemini key 400 API_KEY_INVALID → auth', async () => {
		const { fetchImpl } = routes({
			key: {
				status: 400,
				body: {
					error: {
						code: 400,
						status: 'INVALID_ARGUMENT',
						details: [{ reason: 'API_KEY_INVALID' }]
					}
				}
			}
		});
		expect(
			await runTestConnection(makeProbe('gemini'), 'k-secret', 'm1', { fetch: fetchImpl })
		).toEqual({ outcome: 'auth' });
	});

	it('key check TypeError → network', async () => {
		const { fetchImpl } = routes({ key: 'typeerror' });
		expect(await runTestConnection(makeProbe(), 'k-secret', 'm1', { fetch: fetchImpl })).toEqual({
			outcome: 'network'
		});
	});

	it('never sends the key on the canary and never returns it', async () => {
		const { fetchImpl, calls } = routes({ key: { status: 200, body: {} } });
		const result = await runTestConnection(makeProbe(), 'k-secret', 'm1', { fetch: fetchImpl });
		const canaryCalls = calls.filter((c) => c.url === CANARY_URL);
		expect(canaryCalls).toHaveLength(1);
		for (const c of canaryCalls) {
			expect(c.url).not.toContain('k-secret');
			expect(JSON.stringify(c.init)).not.toContain('k-secret');
			const headers = new Headers(c.init.headers);
			for (const [, v] of headers) expect(v).not.toContain('k-secret');
		}
		// The key did travel on the keyed probe (sanity: the test can see it).
		expect(JSON.stringify(calls[0]?.init)).toContain('k-secret');
		expect(JSON.stringify(result)).not.toContain('k-secret');
	});
});

describe('disambiguateFetchFailure', () => {
	it('keyed probe 401 → auth (the OpenAI bad-key trap)', async () => {
		const { fetchImpl } = routes({ key: { status: 401, body: { error: {} } } });
		expect(
			await disambiguateFetchFailure(makeProbe(), 'k', { fetch: fetchImpl, isOnline: online })
		).toBe('auth');
	});

	it('keyed probe 429 → quota', async () => {
		const { fetchImpl } = routes({ key: { status: 429 } });
		expect(await disambiguateFetchFailure(makeProbe(), 'k', { fetch: fetchImpl })).toBe('quota');
	});

	it('keyed probe 200 → cors-blocked', async () => {
		const { fetchImpl } = routes({ key: { status: 200, body: {} } });
		expect(await disambiguateFetchFailure(makeProbe(), 'k', { fetch: fetchImpl })).toBe(
			'cors-blocked'
		);
	});

	it('probe unreachable while offline → network', async () => {
		const { fetchImpl } = routes({ key: 'typeerror' });
		expect(
			await disambiguateFetchFailure(makeProbe(), 'k', { fetch: fetchImpl, isOnline: offline })
		).toBe('network');
	});

	it('probe unreachable while online → cors-blocked', async () => {
		const { fetchImpl } = routes({ key: 'typeerror' });
		expect(
			await disambiguateFetchFailure(makeProbe(), 'k', { fetch: fetchImpl, isOnline: online })
		).toBe('cors-blocked');
	});

	it('isOnline defaults to treating an unknown navigator as online', async () => {
		const { fetchImpl } = routes({ key: 'typeerror' });
		expect(await disambiguateFetchFailure(makeProbe(), 'k', { fetch: fetchImpl })).toBe(
			'cors-blocked'
		);
	});
});

describe('openStream', () => {
	const init = (signal?: AbortSignal): RequestInit => ({ method: 'POST', body: '{}', signal });

	it('returns the OK response with credentials omitted and no cache', async () => {
		const { fetchImpl, calls } = fakeSseFetch(['data: x\n\n']);
		const res = await openStream({
			probe: makeProbe(),
			key: 'k',
			url: 'https://gen.test/',
			init: init(),
			deps: { fetch: fetchImpl }
		});
		expect(res.ok).toBe(true);
		expect(calls[0]?.init).toMatchObject({
			credentials: 'omit',
			cache: 'no-store',
			method: 'POST'
		});
	});

	it('classifies a non-OK JSON body served as text/event-stream', async () => {
		const { fetchImpl } = fakeSseFetch(
			['{"error":{"code":400,"details":[{"reason":"API_KEY_INVALID"}]}}'],
			{ status: 400 }
		);
		const err = await openStream({
			probe: makeProbe('gemini'),
			key: 'k',
			url: 'https://gen.test/',
			init: init(),
			deps: { fetch: fetchImpl }
		}).catch((e: unknown) => e);
		expect(err).toBeInstanceOf(LlmError);
		expect((err as LlmError).kind).toBe('auth');
	});

	it('a generation TypeError with a keyed probe 401 → auth, not cors-blocked', async () => {
		const { fetchImpl } = fakeRouteFetch([
			{ match: (u) => u === 'https://gen.test/', respond: 'typeerror' },
			{ match: (u) => u === KEY_URL, respond: { status: 401, body: { error: {} } } }
		]);
		const err = await openStream({
			probe: makeProbe(),
			key: 'k',
			url: 'https://gen.test/',
			init: init(),
			deps: { fetch: fetchImpl, isOnline: online }
		}).catch((e: unknown) => e);
		expect(err).toBeInstanceOf(LlmError);
		expect((err as LlmError).kind).toBe('auth');
		expect((err as LlmError).message).toBe('auth');
	});

	it('aborts propagate untouched (no probe)', async () => {
		const { fetchImpl, calls } = fakeRouteFetch([{ match: () => true, respond: { status: 200 } }]);
		const ctrl = new AbortController();
		ctrl.abort();
		const err = await openStream({
			probe: makeProbe(),
			key: 'k',
			url: 'https://gen.test/',
			init: init(ctrl.signal),
			deps: { fetch: fetchImpl }
		}).catch((e: unknown) => e);
		expect((err as { name?: string }).name).toBe('AbortError');
		expect(calls).toHaveLength(1);
	});
});
