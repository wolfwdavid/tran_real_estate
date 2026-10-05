import { describe, expect, test } from 'vitest';

import { KEY_SHAPES, findKeyMaterial } from './key-scan.js';

// Planted keys are assembled at runtime so no source literal matches a real key pattern
// (gitleaks and the pre-commit hook stay quiet). Same builders as apps/web/tests/support/fake-keys.ts.
const PLANTED = {
	anthropic: ['sk', 'ant', 'api03', 'A'.repeat(40)].join('-'),
	openai: ['sk', 'proj', 'B'.repeat(40)].join('-'),
	openrouter: ['sk', 'or', 'v1', 'c'.repeat(40)].join('-'),
	gemini: 'AI' + 'za' + 'D'.repeat(35)
} as const;

function backupWith(value: string): string {
	return JSON.stringify(
		{
			format: 'tran-backup-v1',
			tables: { prefs: [{ key: 'note', value: `before ${value} after` }] }
		},
		null,
		2
	);
}

/** Every 20-char window of the secret, so a partial echo is caught too. */
function substrings(secret: string, len = 20): string[] {
	const out: string[] = [];
	for (let i = 0; i + len <= secret.length; i++) out.push(secret.slice(i, i + len));
	return out;
}

function expectNoEcho(result: readonly string[], secret: string): void {
	const text = JSON.stringify(result);
	expect(text).not.toContain(secret);
	for (const s of substrings(secret)) expect(text).not.toContain(s);
}

describe('findKeyMaterial', () => {
	test.each(Object.entries(PLANTED))('flags a planted %s key by label only', (provider, key) => {
		const result = findKeyMaterial(backupWith(key), []);
		expect(result).toContain(provider);
		expectNoEcho(result, key);
	});

	test('a 64-char lowercase hex string (e.g. a sha256 inputHash) is NOT flagged', () => {
		const hex = '0123456789abcdef'.repeat(4);
		expect(hex).toHaveLength(64);
		expect(findKeyMaterial(backupWith(hex), [])).toEqual([]);
	});

	test('clean data yields no hits', () => {
		expect(findKeyMaterial(backupWith('comfortable'), [])).toEqual([]);
	});

	test('a known vault secret of length >= 8 present verbatim -> vault-value', () => {
		const secret = 'rc' + 'x'.repeat(6);
		expect(secret).toHaveLength(8);
		const result = findKeyMaterial(backupWith(secret), [secret]);
		expect(result).toEqual(['vault-value']);
		expect(JSON.stringify(result)).not.toContain(secret);
	});

	test('a known secret shorter than 8 chars is ignored', () => {
		const short = 'rc' + 'y'.repeat(5);
		expect(short).toHaveLength(7);
		expect(findKeyMaterial(backupWith(short), [short])).toEqual([]);
	});

	test('a known secret that is absent is not reported', () => {
		expect(findKeyMaterial(backupWith('nothing here'), ['rc' + 'z'.repeat(30)])).toEqual([]);
	});

	test('results are deduplicated and never echo any planted key', () => {
		const all = Object.values(PLANTED);
		const json = backupWith(all.join(' ') + ' ' + all.join(' '));
		const result = findKeyMaterial(json, all);
		expect(new Set(result).size).toBe(result.length);
		for (const p of ['anthropic', 'openai', 'openrouter', 'gemini', 'vault-value']) {
			expect(result).toContain(p);
		}
		for (const key of all) expectNoEcho(result, key);
	});

	test('is stable across repeated calls (no lastIndex state from global regexes)', () => {
		const json = backupWith(PLANTED.gemini);
		expect(findKeyMaterial(json, [])).toEqual(findKeyMaterial(json, []));
	});
});

describe('KEY_SHAPES', () => {
	test('is frozen and covers the four LLM providers', () => {
		expect(Object.isFrozen(KEY_SHAPES)).toBe(true);
		expect(KEY_SHAPES.map((s) => s.provider).sort()).toEqual([
			'anthropic',
			'gemini',
			'openai',
			'openrouter'
		]);
	});
});
