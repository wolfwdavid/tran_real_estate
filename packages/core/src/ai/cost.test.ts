import { describe, expect, test } from 'vitest';

import { estimateCostUsd, formatUsd, pricingAt } from './cost.js';
import type { PricingRow } from './types.js';

const GEMINI: PricingRow[] = [
	{ from: '2026-01-01', inUsdPerMTok: 0.75, outUsdPerMTok: 3.75 },
	{ from: '2027-01-01', inUsdPerMTok: 1.5, outUsdPerMTok: 7.5 }
];
const SONNET: PricingRow[] = [{ from: '2026-09-28', inUsdPerMTok: 2, outUsdPerMTok: 10 }];

const LAST_2026 = new Date('2026-12-31T23:59:59Z');
const FIRST_2027 = new Date('2027-01-01T00:00:00Z');
const D = new Date('2026-10-04T00:00:00Z');

describe('pricingAt', () => {
	test('Gemini 3.8 Flash price doubles on 2027-01-01 (UTC)', () => {
		expect(pricingAt(GEMINI, LAST_2026)?.inUsdPerMTok).toBe(0.75);
		expect(pricingAt(GEMINI, FIRST_2027)?.inUsdPerMTok).toBe(1.5);
	});

	test('unsorted rows still pick the latest effective row', () => {
		const reversed = [...GEMINI].reverse();
		expect(pricingAt(reversed, LAST_2026)?.inUsdPerMTok).toBe(0.75);
		expect(pricingAt(reversed, FIRST_2027)?.inUsdPerMTok).toBe(1.5);
		expect(pricingAt(reversed, new Date('2030-06-01T00:00:00Z'))?.inUsdPerMTok).toBe(1.5);
	});

	test('a date before the first row has no pricing', () => {
		expect(pricingAt(GEMINI, new Date('2025-06-01T00:00:00Z'))).toBeUndefined();
	});

	test('undefined or empty rows have no pricing', () => {
		expect(pricingAt(undefined, D)).toBeUndefined();
		expect(pricingAt([], D)).toBeUndefined();
	});
});

describe('estimateCostUsd', () => {
	test('1M in + 1M out on Gemini: 4.5 in 2026, 9 from 2027', () => {
		const usage = { inputTokens: 1_000_000, outputTokens: 1_000_000 };
		expect(estimateCostUsd(usage, GEMINI, LAST_2026)).toBe(4.5);
		expect(estimateCostUsd(usage, GEMINI, FIRST_2027)).toBe(9);
	});

	test('small usage is priced per million tokens', () => {
		const cost = estimateCostUsd(
			{ inputTokens: 1000, outputTokens: 1000 },
			[{ from: '2026-09-28', inUsdPerMTok: 2, outUsdPerMTok: 10 }],
			D
		);
		expect(cost).toBeDefined();
		expect(Math.abs((cost as number) - 0.012)).toBeLessThan(1e-12);
	});

	test('provider-reported cost wins, even with no pricing rows', () => {
		const usage = { inputTokens: 10, outputTokens: 10, costUsd: 0.0042 };
		expect(estimateCostUsd(usage, SONNET, D)).toBe(0.0042);
		expect(estimateCostUsd(usage, undefined, D)).toBe(0.0042);
	});

	test('no usage or unknown pricing yields no number', () => {
		expect(estimateCostUsd(undefined, SONNET, D)).toBeUndefined();
		expect(estimateCostUsd({ inputTokens: 5 }, undefined, D)).toBeUndefined();
		expect(estimateCostUsd({ inputTokens: 5 }, SONNET, new Date('2026-01-01T00:00:00Z'))).toBe(
			undefined
		);
	});

	test('missing token fields count as zero', () => {
		expect(estimateCostUsd({ outputTokens: 1_000_000 }, SONNET, D)).toBe(10);
		expect(estimateCostUsd({ inputTokens: 1_000_000 }, SONNET, D)).toBe(2);
		expect(estimateCostUsd({}, SONNET, D)).toBe(0);
	});

	test('reasoning tokens are not billed twice', () => {
		expect(
			estimateCostUsd({ outputTokens: 1_000_000, reasoningTokens: 500_000 }, SONNET, D)
		).toBe(10);
	});
});

describe('formatUsd', () => {
	test.each([
		[0, '$0.00'],
		[0.004, 'less than $0.01'],
		[0.0123, '$0.01'],
		[0.01, '$0.01'],
		[1.5, '$1.50'],
		[1234.5, '$1,234.50']
	])('%d -> %s', (n, s) => {
		expect(formatUsd(n)).toBe(s);
	});
});
