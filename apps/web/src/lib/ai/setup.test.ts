import { afterEach, describe, expect, it, vi } from 'vitest';
import { LlmError } from '@tran/core/ai';
import type { LiveProviderId } from '@tran/core/ai';
import { fakeKey } from '../../../tests/support/fake-keys';
import { memoryStorage } from '$lib/storage/test-utils';
import {
	_resetKeyTesters,
	getKeyTester,
	hasKeyTester,
	registerKeyTester,
	type KeyTester
} from '$lib/storage/secrets/testers';
import { PROVIDER_ORDER } from './models';
import type { LlmRequest, TestConnectionResult } from './ports';
import { createAiPrefs, AI_PREF_KEYS } from './prefs.svelte';
import { fakeRouteFetch } from './providers/fake-sse';
import {
	PROBES,
	createLiveProvider,
	defaultPreferred,
	keyStateFrom,
	registerAiTestKeys,
	resolveProvider,
	selectProvider,
	toAiKeyState,
	toKeyTestResult,
	type AiKeyState
} from './setup';

const states =
	(m: Partial<Record<LiveProviderId, AiKeyState>>) =>
	(id: LiveProviderId): AiKeyState =>
		m[id] ?? 'none';

const req: LlmRequest = {
	model: 'm',
	system: 's',
	user: 'u',
	maxTokens: 10,
	containsClientData: false
};

afterEach(() => {
	_resetKeyTesters();
});

describe('toAiKeyState', () => {
	it("maps Phase 3 KeyState: 'session' and 'remembered' are saved", () => {
		expect(toAiKeyState('session')).toBe('saved');
		expect(toAiKeyState('remembered')).toBe('saved');
		expect(toAiKeyState('none')).toBe('none');
		expect(toAiKeyState('locked')).toBe('locked');
	});

	it('keyStateFrom reads a vault status synchronously; a missing provider is none', () => {
		const ks = keyStateFrom({
			getStatus: () =>
				({
					providers: { anthropic: { state: 'remembered' }, openai: { state: 'locked' } }
				}) as never
		});
		expect(ks('anthropic')).toBe('saved');
		expect(ks('openai')).toBe('locked');
		expect(ks('gemini')).toBe('none');
	});
});

describe('selectProvider', () => {
	it("the sample toggle wins: reason 'toggle'", () => {
		expect(
			selectProvider({ preferred: 'openai', sample: true, keyState: states({ openai: 'saved' }) })
		).toEqual({ kind: 'sample', reason: 'toggle', id: 'openai' });
	});

	it("no preference and no keys: sample, reason 'no-key', id null", () => {
		expect(selectProvider({ preferred: null, sample: false, keyState: states({}) })).toEqual({
			kind: 'sample',
			reason: 'no-key',
			id: null
		});
	});

	it("a keyless provider can be chosen; drafts use sample output ('no-key')", () => {
		expect(
			selectProvider({ preferred: 'gemini', sample: false, keyState: states({ gemini: 'none' }) })
		).toEqual({ kind: 'sample', reason: 'no-key', id: 'gemini' });
	});

	it("the chosen provider's locked key gives 'locked'", () => {
		expect(
			selectProvider({
				preferred: 'anthropic',
				sample: false,
				keyState: states({ anthropic: 'locked' })
			})
		).toEqual({ kind: 'locked', id: 'anthropic' });
	});

	it('a saved key gives live', () => {
		expect(
			selectProvider({
				preferred: 'anthropic',
				sample: false,
				keyState: states({ anthropic: 'saved' })
			})
		).toEqual({ kind: 'live', id: 'anthropic' });
	});

	it('with no preference, the first provider in order with a saved key is used', () => {
		const ks = states({ openai: 'saved', openrouter: 'saved', anthropic: 'locked' });
		expect(defaultPreferred(ks)).toBe('openai');
		expect(selectProvider({ preferred: null, sample: false, keyState: ks })).toEqual({
			kind: 'live',
			id: 'openai'
		});
		expect(defaultPreferred(states({}))).toBeNull();
	});
});

describe('createLiveProvider / resolveProvider', () => {
	it.each(PROVIDER_ORDER)(
		'%s: provider id matches; a null key rejects with LlmError locked',
		async (id) => {
			const getKey = vi.fn(async () => null);
			const p = createLiveProvider(id, { getKey });
			expect(p.id).toBe(id);
			const it = p.stream(req, new AbortController().signal)[Symbol.asyncIterator]();
			const err = await it.next().catch((e: unknown) => e);
			expect(err).toBeInstanceOf(LlmError);
			expect((err as LlmError).kind).toBe('locked');
			expect(getKey).toHaveBeenCalledOnce();
		}
	);

	it('live selections get the adapter reading the vault key; every other one the fixture', () => {
		const getKey = vi.fn(async () => undefined);
		expect(resolveProvider({ kind: 'live', id: 'gemini' }, { getKey }).id).toBe('gemini');
		expect(resolveProvider({ kind: 'sample', reason: 'toggle', id: 'openai' }, { getKey }).id).toBe(
			'fixture'
		);
		expect(resolveProvider({ kind: 'sample', reason: 'no-key', id: null }, { getKey }).id).toBe(
			'fixture'
		);
		expect(resolveProvider({ kind: 'locked', id: 'anthropic' }, { getKey }).id).toBe('fixture');
		expect(getKey).not.toHaveBeenCalled();
	});

	it("the live adapter asks the vault for its own provider's key", async () => {
		const getKey = vi.fn(async () => undefined);
		const p = resolveProvider({ kind: 'live', id: 'openrouter' }, { getKey });
		await p
			.stream(req, new AbortController().signal)
			[Symbol.asyncIterator]()
			.next()
			.catch(() => undefined);
		expect(getKey).toHaveBeenCalledWith('openrouter');
	});
});

describe('PROBES', () => {
	it('has one probe per live provider, ids aligned', () => {
		expect(Object.keys(PROBES).sort()).toEqual([...PROVIDER_ORDER].sort());
		for (const id of PROVIDER_ORDER) expect(PROBES[id].id).toBe(id);
	});
});

describe('toKeyTestResult', () => {
	const cases: [TestConnectionResult, string][] = [
		[{ outcome: 'ok', modelListed: true }, 'accepted'],
		[{ outcome: 'auth' }, 'rejected'],
		[{ outcome: 'quota' }, 'rate-limited'],
		[{ outcome: 'cors-blocked' }, 'failed'],
		[{ outcome: 'network' }, 'failed']
	];
	it.each(cases)('%o -> %s', (r, status) => {
		expect(toKeyTestResult(r, { line: 'L' })).toEqual({ status, message: 'L', ai: r });
	});
});

describe('registerAiTestKeys', () => {
	it('registers exactly the four AI providers (never rentcast) and returns their unregisters', () => {
		const offs = PROVIDER_ORDER.map(() => vi.fn());
		let i = 0;
		const register = vi.fn<(p: string, fn: KeyTester) => () => void>(() => offs[i++]!);
		const result = registerAiTestKeys(register as unknown as typeof registerKeyTester, {
			model: () => 'm'
		});
		expect(register.mock.calls.map((c) => c[0])).toEqual([
			'anthropic',
			'openai',
			'gemini',
			'openrouter'
		]);
		expect(result).toEqual(offs);
	});

	it('with the Phase 3 hook: Test key appears for the four AI cards and goes away on cleanup', () => {
		const offs = registerAiTestKeys(registerKeyTester, { model: () => 'm' });
		for (const id of PROVIDER_ORDER) expect(hasKeyTester(id)).toBe(true);
		expect(hasKeyTester('rentcast')).toBe(false);
		for (const off of offs) off();
		for (const id of PROVIDER_ORDER) expect(hasKeyTester(id)).toBe(false);
	});

	const MODELS_URL = 'https://api.anthropic.com/v1/models?limit=1000';
	const MESSAGES_URL = 'https://api.anthropic.com/v1/messages';

	it('anthropic tester: accepted, with the provider copy line and the raw result', async () => {
		const { fetchImpl, calls } = fakeRouteFetch([
			{
				match: (u) => u === MODELS_URL,
				respond: { status: 200, body: { data: [{ id: 'claude-sonnet-5-5' }] } }
			},
			{
				match: (u, i) => u === MESSAGES_URL && i.method === 'POST',
				respond: { status: 401, body: { type: 'error', error: { type: 'authentication_error' } } }
			}
		]);
		const model = vi.fn(() => 'claude-sonnet-5-5');
		registerAiTestKeys(registerKeyTester, { model, fetch: fetchImpl });
		const key = fakeKey('anthropic');
		const res = await getKeyTester('anthropic')!(key, new AbortController().signal);
		expect(res).toEqual({
			status: 'accepted',
			message: 'Anthropic accepted this key.',
			ai: { outcome: 'ok', modelListed: true }
		});
		expect(model).toHaveBeenCalledWith('anthropic');
		const keyed = calls.find((c) => c.url === MODELS_URL)!;
		expect((keyed.init.headers as Record<string, string>)['x-api-key']).toBe(key);
	});

	it('a rejected key: status rejected, and the message never contains the key', async () => {
		const { fetchImpl } = fakeRouteFetch([
			{
				match: (u) => u === MODELS_URL,
				respond: { status: 401, body: { error: { type: 'authentication_error' } } }
			}
		]);
		registerAiTestKeys(registerKeyTester, { model: () => 'claude-sonnet-5-5', fetch: fetchImpl });
		const key = fakeKey('anthropic', 'B');
		const res = await getKeyTester('anthropic')!(key, new AbortController().signal);
		expect(res.status).toBe('rejected');
		expect(res.message).toContain("Anthropic didn't accept this key.");
		expect(JSON.stringify(res)).not.toContain(key);
	});

	it('an unreachable host: status failed with the network line', async () => {
		const { fetchImpl } = fakeRouteFetch([{ match: () => true, respond: 'typeerror' }]);
		registerAiTestKeys(registerKeyTester, { model: () => 'gemini-3.8-flash', fetch: fetchImpl });
		const res = await getKeyTester('gemini')!(fakeKey('gemini'), new AbortController().signal);
		expect(res.status).toBe('failed');
		expect(res.message).toContain('generativelanguage.googleapis.com');
	});
});

describe('AI prefs', () => {
	const prefs = () => {
		const storage = memoryStorage();
		return { storage, p: createAiPrefs({ window: { localStorage: storage } as never }) };
	};

	it('defaults: no provider, sample off, no overrides; keys are tran.ai.*', () => {
		const { p } = prefs();
		expect(p.provider).toBeNull();
		expect(p.sample).toBe(false);
		expect(p.models).toEqual({});
		expect(AI_PREF_KEYS).toEqual({
			provider: 'tran.ai.provider',
			sample: 'tran.ai.sample',
			models: 'tran.ai.models'
		});
	});

	it('effectiveModel: override or the registry default; null resets', () => {
		const { p } = prefs();
		expect(p.effectiveModel('openai')).toBe('gpt-6.1-sol');
		p.setModel('openai', 'gpt-5.6-terra');
		expect(p.effectiveModel('openai')).toBe('gpt-5.6-terra');
		expect(p.effectiveModel('anthropic')).toBe('claude-sonnet-5-5');
		p.setModel('openai', null);
		expect(p.effectiveModel('openai')).toBe('gpt-6.1-sol');
		expect(p.models).toEqual({});
	});

	it('setModel rejects an invalid id and keeps the stored value', () => {
		const { p } = prefs();
		p.setModel('openai', 'gpt-5.6-terra');
		expect(() => p.setModel('openai', 'gpt 5')).toThrow('spaces');
		expect(() => p.setModel('openai', '  ')).toThrow('empty');
		expect(p.effectiveModel('openai')).toBe('gpt-5.6-terra');
	});

	it('setModel trims the id', () => {
		const { p } = prefs();
		p.setModel('gemini', '  gemini-3.5-flash-lite ');
		expect(p.effectiveModel('gemini')).toBe('gemini-3.5-flash-lite');
	});

	it('persists per device and is read back by a new instance', () => {
		const { storage, p } = prefs();
		p.provider = 'gemini';
		p.sample = true;
		p.setModel('anthropic', 'claude-opus-5-5');
		const again = createAiPrefs({ window: { localStorage: storage } as never });
		expect(again.provider).toBe('gemini');
		expect(again.sample).toBe(true);
		expect(again.effectiveModel('anthropic')).toBe('claude-opus-5-5');
		expect(Object.keys(storage.dump()).sort()).toEqual(
			['tran.ai.models', 'tran.ai.provider', 'tran.ai.sample'].sort()
		);
	});

	it('tampered storage is ignored: unknown provider, non-boolean sample, bad model ids', () => {
		const storage = memoryStorage();
		storage.setItem('tran.ai.provider', JSON.stringify('rentcast'));
		storage.setItem('tran.ai.sample', JSON.stringify('yes'));
		storage.setItem(
			'tran.ai.models',
			JSON.stringify({ openai: 'gpt 5', gemini: 'gemini-x', constructor: 'y', fixture: 'z' })
		);
		const p = createAiPrefs({ window: { localStorage: storage } as never });
		expect(p.provider).toBeNull();
		expect(p.sample).toBe(false);
		expect(p.models).toEqual({ gemini: 'gemini-x' });
		expect(p.effectiveModel('openai')).toBe('gpt-6.1-sol');
	});

	it('provider setter rejects a non-AI provider', () => {
		const { p } = prefs();
		expect(() => {
			p.provider = 'rentcast' as never;
		}).toThrow('ai-provider');
		expect(p.provider).toBeNull();
	});

	it('works without a window (prerender): in-memory defaults', () => {
		const p = createAiPrefs({ window: undefined });
		expect(p.provider).toBeNull();
		p.provider = 'openai';
		expect(p.provider).toBe('openai');
	});
});
