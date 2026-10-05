import { afterEach, describe, expect, it, vi } from 'vitest';
import { isAbort } from '@tran/core/ai';
import { checkFairHousing } from '@tran/core/fair-housing';
import { redactPii } from '@tran/core/privacy';
import type { LlmEvent, LlmRequest } from '../ports.js';
import type { BuiltPrompt } from '../prompts/types.js';
import { runGeneration, type RunUpdate } from '../runner.js';
import { FIXTURE_OUTPUTS } from './fixture-outputs.js';
import { fixtureProvider } from './fixture.js';

const DEMO = FIXTURE_OUTPUTS['shared/demo@1']!;

const req = (promptId?: string): LlmRequest => ({
	model: 'sample',
	system: 'SYSTEM',
	user: 'USER',
	maxTokens: 2048,
	containsClientData: true,
	promptId
});

const instant = async () => {};

async function events(it: AsyncIterable<LlmEvent>): Promise<LlmEvent[]> {
	const out: LlmEvent[] = [];
	for await (const ev of it) out.push(ev);
	return out;
}

/** Real-timer sleep that rejects on abort (the shape the default sleep has). */
const abortableSleep = (ms: number, signal: AbortSignal) =>
	new Promise<void>((resolve, reject) => {
		const abort = () => reject(new DOMException('Aborted', 'AbortError'));
		if (signal.aborted) return abort();
		const t = setTimeout(resolve, ms);
		signal.addEventListener(
			'abort',
			() => {
				clearTimeout(t);
				abort();
			},
			{ once: true }
		);
	});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('fixtureProvider', () => {
	it('has the fixture id', () => {
		expect(fixtureProvider().id).toBe('fixture');
	});

	it('streams the demo output word by word, exactly, with no usage and no fetch', async () => {
		const fetchSpy = vi.fn();
		vi.stubGlobal('fetch', fetchSpy);
		const evs = await events(
			fixtureProvider({ sleep: instant }).stream(req('shared/demo@1'), new AbortController().signal)
		);
		const textEvents = evs.filter((e) => e.type === 'text');
		expect(textEvents.length).toBeGreaterThanOrEqual(20);
		expect(textEvents.map((e) => (e.type === 'text' ? e.text : '')).join('')).toBe(DEMO);
		expect(evs.at(-1)).toEqual({ type: 'finish', reason: 'stop' });
		expect(evs.some((e) => e.type === 'usage')).toBe(false);
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it('falls back to the default output for an unknown or missing promptId', async () => {
		for (const id of ['portal/unknown@3', undefined]) {
			const evs = await events(
				fixtureProvider({ sleep: instant }).stream(req(id), new AbortController().signal)
			);
			const text = evs.map((e) => (e.type === 'text' ? e.text : '')).join('');
			expect(text).toBe(FIXTURE_OUTPUTS.default);
		}
	});

	it('preserves leading and trailing whitespace from injected outputs', async () => {
		const outputs = { 'x@1': '  Two words \n', default: 'd' };
		const evs = await events(
			fixtureProvider({ sleep: instant, outputs }).stream(req('x@1'), new AbortController().signal)
		);
		expect(evs.map((e) => (e.type === 'text' ? e.text : '')).join('')).toBe(outputs['x@1']);
	});

	it('waits between 20 and 60 ms between words', async () => {
		for (const [rand, expected] of [
			[0, 20],
			[0.999, 60]
		] as const) {
			const calls: number[] = [];
			const sleep = vi.fn(async (ms: number) => {
				calls.push(ms);
			});
			await events(
				fixtureProvider({ sleep, random: () => rand }).stream(
					req('shared/demo@1'),
					new AbortController().signal
				)
			);
			expect(calls.length).toBeGreaterThanOrEqual(20);
			expect(new Set(calls)).toEqual(new Set([expected]));
		}
	});

	it('rejects with an abort once Stop is pressed mid-stream', async () => {
		const ctrl = new AbortController();
		const it = fixtureProvider({
			sleep: (_ms, signal) => abortableSleep(5, signal)
		})
			.stream(req('shared/demo@1'), ctrl.signal)
			[Symbol.asyncIterator]();
		let texts = 0;
		while (texts < 3) {
			const r = await it.next();
			if (!r.done && r.value.type === 'text') texts++;
		}
		ctrl.abort();
		const err = await it.next().then(
			() => undefined,
			(e: unknown) => e
		);
		expect(err).toBeDefined();
		expect(isAbort(err)).toBe(true);
	});

	it('the default sleep is abortable: through runGeneration Stop keeps a strict prefix', async () => {
		const ctrl = new AbortController();
		const prompt: BuiltPrompt = {
			id: 'shared/demo',
			version: 1,
			promptId: 'shared/demo@1',
			feature: 'demo',
			system: 'SYSTEM',
			user: 'USER',
			redactions: [],
			containsClientData: true,
			maxTokens: 2048,
			inputHash: '0'.repeat(64)
		};
		const updates: RunUpdate[] = [];
		let seenTexts = 0;
		let atAbort = '';
		for await (const u of runGeneration({
			prompt,
			provider: fixtureProvider({ random: () => 0 }),
			model: 'sample',
			signal: ctrl.signal,
			flushMs: 0
		})) {
			updates.push(u);
			if (u.type === 'text' && ++seenTexts === 3) {
				atAbort = u.text;
				ctrl.abort();
			}
		}
		const done = updates.at(-1);
		if (done?.type !== 'done') throw new Error('no done update');
		expect(done.result.status).toBe('stopped');
		expect(done.result.provider).toBe('fixture');
		expect(done.result.estimatedCostUsd).toBeUndefined();
		expect(done.result.text).toBe(atAbort);
		expect(DEMO.startsWith(done.result.text)).toBe(true);
		expect(done.result.text.length).toBeGreaterThan(0);
		expect(done.result.text.length).toBeLessThan(DEMO.length);
	});
});

describe('FIXTURE_OUTPUTS', () => {
	it('every sample output passes the Fair Housing checker', () => {
		for (const [key, text] of Object.entries(FIXTURE_OUTPUTS)) {
			expect({ key, findings: checkFairHousing(text) }).toEqual({ key, findings: [] });
		}
	});

	it('the demo output mirrors the redacted payload: tokens only, no real-looking contact data', () => {
		expect(DEMO).toContain('{client_name}');
		expect(DEMO).toContain('{client_email}');
		expect(DEMO).toContain('{client_phone}');
		for (const text of Object.values(FIXTURE_OUTPUTS)) {
			expect(redactPii(text, []).redactions).toEqual([]);
			expect(text.replace(/\{[a-z_]+\}/g, '')).not.toMatch(/@/);
		}
	});
});
