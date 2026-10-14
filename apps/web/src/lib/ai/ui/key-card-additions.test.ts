// SSR structural tests for the AI additions to the Phase 3 ProviderKeyCard (05-14): the Model
// override field, the Test connection result line, and the card wiring. The card itself needs the
// Settings context, so its wiring is asserted on the source (plan fallback) and the RentCast
// branch is checked to be unchanged.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Component } from 'svelte';
import { render } from 'svelte/server';
import { describe, expect, test } from 'vitest';
import AiModelField, { modelFieldError, modelSavedAnnouncement } from './AiModelField.svelte';
import TestConnectionResult from './TestConnectionResult.svelte';

const decode = (s: string) =>
	s
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&amp;/g, '&');
const strip = (h: string) =>
	decode(h.replace(/<!--[\s\S]*?-->/g, '').replace(/<(?:[^>"']|"[^"]*"|'[^']*')*>/g, ' '));
const text = (h: string) =>
	strip(h)
		.replace(/\s+/g, ' ')
		.replace(/ ([.,])/g, '$1')
		.trim();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function html(component: Component<any>, props: Record<string, unknown>): string {
	return render(component, { props }).body.replace(/<!--[\s\S]*?-->/g, '');
}

const FAKE_KEY = 'sk-test-0000000000000000000000000000';

describe('AiModelField', () => {
	const base = { provider: 'openai', onSave: () => {} };

	test('label, input attributes, helper; no Use default at the default model', () => {
		const body = html(AiModelField, { ...base, value: 'gpt-6.1-sol' });
		expect(body).toMatch(/<label\b[^>]*for="([^"]+)"[^>]*>\s*Model\s*<\/label>/);
		const input = body.match(/<input\b[^>]*>/)?.[0] ?? '';
		expect(input).toContain('autocomplete="off"');
		expect(input).toContain('spellcheck="false"');
		expect(input).toContain('autocapitalize="off"');
		expect(input).toContain('value="gpt-6.1-sol"');
		expect(input).toMatch(/aria-describedby="[^"]+"/);
		expect(text(body)).toContain(
			'Default: gpt-6.1-sol. Change this only if you want a different model from OpenAI.'
		);
		expect(body).toMatch(/<code[^>]*>gpt-6\.1-sol<\/code>/);
		expect(text(body)).not.toContain('Use default');
	});

	test('a non-default value shows Use default', () => {
		const body = html(AiModelField, { ...base, value: 'gpt-5.6-terra' });
		expect(body).toMatch(/<button\b[^>]*>\s*Use default\s*<\/button>/);
	});

	test('modelFieldError', () => {
		expect(modelFieldError('', 'OpenAI')).toBe('Enter a model name, or choose Use default.');
		expect(modelFieldError('   ', 'OpenAI')).toBe('Enter a model name, or choose Use default.');
		expect(modelFieldError('gpt 5', 'OpenAI')).toBe(
			"Model names don't contain spaces. Copy the exact name from OpenAI."
		);
		expect(modelFieldError('gpt-5.6-terra', 'OpenAI')).toBeNull();
	});

	test('modelSavedAnnouncement', () => {
		expect(modelSavedAnnouncement('OpenAI', 'gpt-5.6-terra')).toBe(
			'OpenAI model set to gpt-5.6-terra.'
		);
		expect(modelSavedAnnouncement('OpenAI', null)).toBe('OpenAI model reset to the default.');
	});
});

describe('TestConnectionResult', () => {
	const base = { provider: 'openai', model: 'gpt-6.1-sol', testing: false };
	const line = (result: unknown, over: Record<string, unknown> = {}) =>
		html(TestConnectionResult, { ...base, result, ...over });

	test('testing', () => {
		expect(text(line(null, { testing: true }))).toBe('Testing…');
	});

	test('nothing before the first test', () => {
		expect(text(line(null))).toBe('');
	});

	test('ok, model listed', () => {
		const body = line({ outcome: 'ok', modelListed: true });
		expect(text(body)).toContain('OpenAI accepted this key.');
		expect(text(body)).toContain('Model gpt-6.1-sol is available.');
		expect(body).toMatch(/<code[^>]*>gpt-6\.1-sol<\/code>/);
		expect(body).toContain('text-secondary');
	});

	test('ok, model not listed', () => {
		const body = line({ outcome: 'ok', modelListed: false });
		expect(text(body)).toContain(
			"OpenAI didn't list gpt-6.1-sol for this key. Check the name, or choose Use default."
		);
		expect(body).toContain('text-foreground');
	});

	test('cors-blocked links to the OpenRouter card', () => {
		const body = line({ outcome: 'cors-blocked' });
		expect(text(body)).toContain(
			'OpenAI is blocking browser access from this site right now. Try OpenRouter, which can run the same kinds of models from your browser.'
		);
		const link = body.match(/<a\b[^>]*href="([^"]*)"[^>]*>\s*Set up OpenRouter\s*<\/a>/);
		expect(link?.[1]).toMatch(/#key-openrouter$/);
		expect(body).toContain('text-destructive');
	});

	test('auth, quota and network lines', () => {
		expect(text(line({ outcome: 'auth' }))).toBe(
			"OpenAI didn't accept this key. Check that you copied all of it, or create a new key."
		);
		expect(text(line({ outcome: 'quota' }))).toBe(
			"Your OpenAI account has hit a usage or billing limit. Check your plan and credit in your OpenAI account, or wait a minute if it's a rate limit, then try again."
		);
		const net = line({ outcome: 'network' });
		expect(text(net)).toBe("Couldn't reach api.openai.com. Check your connection, then try again.");
		expect(net).toMatch(/<code[^>]*>api\.openai\.com<\/code>/);
	});

	test('never echoes key material', () => {
		for (const outcome of ['ok', 'cors-blocked', 'auth', 'quota', 'network']) {
			const body = line({ outcome, modelListed: true }, { key: FAKE_KEY });
			expect(body).not.toContain('sk-');
			expect(body).not.toContain(FAKE_KEY);
		}
	});
});

describe('ProviderKeyCard AI wiring (source)', () => {
	const src = readFileSync(
		fileURLToPath(
			new URL('../../features/shared/settings/ProviderKeyCard.svelte', import.meta.url)
		),
		'utf8'
	);

	test('card ids key-{provider} for every provider', () => {
		expect(src).toContain('id="key-{provider.id}"');
	});

	test('AI cards render the Model field and TestConnectionResult', () => {
		expect(src).toMatch(/import AiModelField from '\$lib\/ai\/ui\/AiModelField\.svelte'/);
		expect(src).toMatch(
			/import TestConnectionResult from '\$lib\/ai\/ui\/TestConnectionResult\.svelte'/
		);
		expect(src).toMatch(/<AiModelField\b/);
		expect(src).toMatch(/<TestConnectionResult\b/);
		expect(src).toContain('{#if aiId && ctx.ready}');
	});

	test('AI test button reads Test connection; RentCast keeps Test key with its cost', () => {
		expect(src).toContain('Test connection');
		expect(src).toContain('Test key <CostLabel estimate="free" />');
		expect(src).toMatch(/\{:else if isAi\}\s*Test connection\s*\{:else\}\s*Test key/);
	});

	test('RentCast branch keeps its result line and pointer', () => {
		expect(src).toContain('<RentCastKeyTestResult result={rentCastKeyTest.current} />');
		expect(src).toContain("const POINTER = 'Usage, cap, and data source are in RentCast usage.';");
		expect(src).toContain('href="{settingsBase}#rentcast-usage"');
		// Off Settings (e.g. /setup/rentcast/) the card's section links point at the Settings page.
		expect(src).toContain('href="{settingsBase}#key-security"');
		expect(src).not.toMatch(/href="#(?:rentcast-usage|key-security)"/);
	});
});
