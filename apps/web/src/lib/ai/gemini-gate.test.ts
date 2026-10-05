import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AiProviderId } from '@tran/core/ai';
import { GEMINI_ACK_KEY, needsGeminiWarning, readGeminiAck, writeGeminiAck } from './gemini-gate';

describe('needsGeminiWarning', () => {
	const rows: Array<[AiProviderId, boolean, boolean, boolean]> = [];
	for (const provider of ['gemini', 'anthropic'] as const)
		for (const sample of [true, false])
			for (const containsClientData of [true, false])
				for (const acked of [true, false]) rows.push([provider, sample, containsClientData, acked]);

	it('has 16 truth-table rows', () => {
		expect(rows).toHaveLength(16);
	});

	it.each(rows)('provider=%s sample=%s clientData=%s acked=%s', (provider, sample, containsClientData, acked) => {
		const expected = provider === 'gemini' && !sample && containsClientData && !acked;
		expect(needsGeminiWarning({ provider, sample, containsClientData, acked })).toBe(expected);
	});

	it('never warns for the fixture provider', () => {
		expect(
			needsGeminiWarning({ provider: 'fixture', sample: false, containsClientData: true, acked: false })
		).toBe(false);
	});
});

describe('gemini acknowledgement storage', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('uses the documented key', () => {
		expect(GEMINI_ACK_KEY).toBe('tran.ai.gemini-client-data-ack');
	});

	it('writes and reads the acknowledgement', () => {
		const setItem = vi.fn();
		writeGeminiAck({ setItem });
		expect(setItem).toHaveBeenCalledWith('tran.ai.gemini-client-data-ack', '1');
		expect(readGeminiAck({ getItem: (k) => (k === GEMINI_ACK_KEY ? '1' : null) })).toBe(true);
		expect(readGeminiAck({ getItem: () => null })).toBe(false);
	});

	it('treats missing or throwing storage as not acknowledged', () => {
		expect(readGeminiAck(undefined)).toBe(false);
		expect(
			readGeminiAck({
				getItem: () => {
					throw new DOMException('blocked', 'SecurityError');
				}
			})
		).toBe(false);
		expect(() => writeGeminiAck(undefined)).not.toThrow();
		expect(() =>
			writeGeminiAck({
				setItem: () => {
					throw new DOMException('quota', 'QuotaExceededError');
				}
			})
		).not.toThrow();
	});

	it('defaults to sessionStorage resolved at call time', () => {
		const store = new Map<string, string>();
		vi.stubGlobal('sessionStorage', {
			getItem: (k: string) => store.get(k) ?? null,
			setItem: (k: string, v: string) => void store.set(k, v)
		});
		expect(readGeminiAck()).toBe(false);
		writeGeminiAck();
		expect(store.get(GEMINI_ACK_KEY)).toBe('1');
		expect(readGeminiAck()).toBe(true);
	});

	it('never touches localStorage', () => {
		const src = readFileSync(new URL('./gemini-gate.ts', import.meta.url), 'utf8');
		expect(src).not.toContain('localStorage');
	});
});
