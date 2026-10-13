// The CSP builder must reproduce the pre-Phase-10 policy byte-for-byte when no analytics host is
// configured, and add exactly one connect-src origin when one is (10-RESEARCH Pattern 11).
import { describe, expect, test } from 'vitest';
import { buildCsp } from './csp-policy.js';

// Loaded through a computed URL so svelte-check (checkJs) does not type-check the untyped Node
// oracle as part of the web project; the oracle is type-free plain JS by design.
const ORACLE = new URL('../../../../scripts/assert-csp.mjs', import.meta.url).href;
const { CONNECT } = (await import(/* @vite-ignore */ ORACLE)) as { CONNECT: string[] };

// The kit.csp literal that svelte.config.js carried before Phase 10, copied verbatim.
const PRE_PHASE_10 = {
	mode: 'hash',
	directives: {
		'default-src': ['self'],
		'script-src': ['self'],
		'style-src': ['self'],
		'style-src-attr': ['unsafe-inline'],
		'img-src': ['self', 'https://tile.openstreetmap.org', 'blob:'],
		'connect-src': [
			'self',
			'https://api.rentcast.io',
			'https://api.anthropic.com',
			'https://api.openai.com',
			'https://generativelanguage.googleapis.com',
			'https://openrouter.ai',
			'https://api.web3forms.com'
		],
		'object-src': ['none'],
		'base-uri': ['self'],
		'form-action': ['self', 'https://api.web3forms.com']
	}
};

const HOST = 'https://stats.example.org';
const unquote = (t: string) => t.replace(/^'(.*)'$/, '$1');

describe('buildCsp', () => {
	test('with no options it deep-equals the pre-Phase-10 policy', () => {
		expect(buildCsp()).toEqual(PRE_PHASE_10);
	});

	test('an empty analytics host is the same as no host', () => {
		expect(buildCsp({ analyticsHost: '' })).toEqual(PRE_PHASE_10);
	});

	test('connect-src matches the independent oracle literal as a set', () => {
		const ours = buildCsp().directives['connect-src'];
		const oracle = CONNECT.map(unquote);
		expect([...ours].sort()).toEqual([...oracle].sort());
	});

	test('a configured analytics host adds exactly that origin to connect-src', () => {
		const base = buildCsp().directives['connect-src'];
		const withHost = buildCsp({ analyticsHost: HOST }).directives['connect-src'];
		expect(withHost).toHaveLength(base.length + 1);
		expect(withHost).toEqual([...base, HOST]);
	});

	test('a configured analytics host changes no other directive', () => {
		const withHost = buildCsp({ analyticsHost: HOST }).directives;
		const base = buildCsp().directives;
		const rest = Object.fromEntries(Object.entries(withHost).filter(([k]) => k !== 'connect-src'));
		const baseRest = Object.fromEntries(Object.entries(base).filter(([k]) => k !== 'connect-src'));
		expect(Object.keys(rest)).toHaveLength(Object.keys(base).length - 1);
		expect(rest).toEqual(baseRest);
		expect(rest['form-action']).toEqual(['self', 'https://api.web3forms.com']);
		expect(rest['script-src']).toEqual(['self']);
		expect(buildCsp({ analyticsHost: HOST }).mode).toBe('hash');
	});

	test('each call returns a fresh object', () => {
		const first = buildCsp();
		first.directives['connect-src'].push('https://evil.example.com');
		first.directives['img-src'].push('data:');
		expect(buildCsp()).toEqual(PRE_PHASE_10);
	});
});
