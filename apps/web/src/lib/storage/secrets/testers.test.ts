import { afterEach, describe, expect, it } from 'vitest';
import {
	KEY_TEST_STATUSES,
	_resetKeyTesters,
	getKeyTester,
	hasKeyTester,
	registerKeyTester,
	type KeyTestResult,
	type KeyTester
} from './testers';

afterEach(() => _resetKeyTesters());

const ok: KeyTester = async () => ({ status: 'accepted' });

describe('key tester hook', () => {
	it('starts with no testers (Phase 3 registers none)', () => {
		for (const p of ['rentcast', 'anthropic', 'openai', 'gemini', 'openrouter'] as const) {
			expect(hasKeyTester(p)).toBe(false);
			expect(getKeyTester(p)).toBeUndefined();
		}
	});

	it('registers, exposes and unregisters a tester', () => {
		const off = registerKeyTester('rentcast', ok);
		expect(hasKeyTester('rentcast')).toBe(true);
		expect(getKeyTester('rentcast')).toBe(ok);
		expect(hasKeyTester('openai')).toBe(false);
		off();
		expect(hasKeyTester('rentcast')).toBe(false);
	});

	it('last registration wins, and a stale unregister does not remove the replacement', () => {
		const first: KeyTester = async () => ({ status: 'failed' });
		const offFirst = registerKeyTester('anthropic', first);
		registerKeyTester('anthropic', ok);
		expect(getKeyTester('anthropic')).toBe(ok);
		offFirst();
		expect(getKeyTester('anthropic')).toBe(ok);
	});

	it('lists exactly the four result statuses', () => {
		expect([...KEY_TEST_STATUSES]).toEqual(['accepted', 'rejected', 'rate-limited', 'failed']);
	});

	it('passes the key and an AbortSignal and returns a typed result', async () => {
		let seen: { key: string; aborted: boolean } | undefined;
		registerKeyTester('gemini', async (key, signal) => {
			seen = { key, aborted: signal.aborted };
			return { status: 'rate-limited', message: 'Try again in a minute.' };
		});
		const result: KeyTestResult = await getKeyTester('gemini')!('k', new AbortController().signal);
		expect(seen).toEqual({ key: 'k', aborted: false });
		expect(result).toEqual({ status: 'rate-limited', message: 'Try again in a minute.' });
	});

	it('_resetKeyTesters clears all', () => {
		registerKeyTester('openai', ok);
		registerKeyTester('openrouter', ok);
		_resetKeyTesters();
		expect(hasKeyTester('openai')).toBe(false);
		expect(hasKeyTester('openrouter')).toBe(false);
	});
});
