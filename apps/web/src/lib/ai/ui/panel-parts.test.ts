// SSR structural tests for GenerationError, GeminiDataDialog and ProviderChip (05-13 Task 2).
// Components render to a string with svelte/server; onMount and effects never run here.
import { readFileSync } from 'node:fs';
import type { Component } from 'svelte';
import { render } from 'svelte/server';
import { describe, expect, test } from 'vitest';
import { errorCopy } from './ai-copy';
import GeminiDataDialog from './GeminiDataDialog.svelte';
import GenerationError from './GenerationError.svelte';
import ProviderChip from './ProviderChip.svelte';

const decode = (s: string) =>
	s
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&amp;/g, '&');
const strip = (h: string) =>
	decode(h.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, ''))
		.replace(/\s+/g, ' ')
		.trim();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function html(component: Component<any>, props: Record<string, unknown>): string {
	const r = render(component, { props });
	return r.body + r.head;
}

const src = (name: string) => readFileSync(new URL(`./${name}`, import.meta.url), 'utf8');

describe('GenerationError', () => {
	const copy = errorCopy('cors-blocked', {
		provider: 'openai',
		providerLabel: 'OpenAI',
		model: 'gpt-5.6-terra',
		openRouterKeySaved: false
	});

	test('renders title, body and the base-aware Settings link, no alert role', () => {
		const h = html(GenerationError, { ...copy });
		const text = strip(h);
		expect(text).toContain('OpenAI is blocking this site right now');
		expect(text).toContain(copy.body);
		const link = /<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/.exec(h);
		expect(link?.[2]).toBe('Set up OpenRouter');
		expect(link?.[1]).toMatch(/\/settings\/#key-openrouter$/);
		expect(h).not.toContain('role="alert"');
		expect(h).toMatch(/<svg[^>]*class="[^"]*lucide-circle-alert[^"]*"[^>]*aria-hidden="true"/);
	});

	test('wraps the model id in <code>', () => {
		const m = errorCopy('model-not-found', {
			provider: 'anthropic',
			providerLabel: 'Anthropic',
			model: 'claude-x',
			openRouterKeySaved: false
		});
		const h = html(GenerationError, { ...m, model: 'claude-x' });
		expect(h).toContain('<code>claude-x</code>');
		expect(strip(h)).toContain(m.body);
	});

	test('no action renders no link', () => {
		const q = errorCopy('quota', {
			provider: 'openai',
			providerLabel: 'OpenAI',
			model: 'm',
			openRouterKeySaved: false
		});
		expect(html(GenerationError, { ...q })).not.toContain('<a');
	});
});

describe('GeminiDataDialog', () => {
	const props = { open: true, inline: true, onCancel: () => {}, onSend: () => {} };

	test('open: exact copy, unchecked checkbox, link, safe-default button order', () => {
		const h = html(GeminiDataDialog, props);
		const text = strip(h);
		expect(text).toContain('Send client details to Gemini?');
		expect(text).toContain(
			"This draft includes details about a client or lead. If your Gemini key is on Google's free tier, Google may use what you send to improve its products."
		);
		expect(text).toContain(
			"Use a paid-tier Gemini key or another provider for client details. Tran can't tell which tier your key is on, so it asks every time."
		);
		expect(text).toContain("Don't ask again until I close this tab");
		expect(h).toMatch(
			/role="checkbox"[^>]*aria-checked="false"|aria-checked="false"[^>]*role="checkbox"/
		);
		const link = /<a[^>]*href="([^"]*)"[^>]*>Choose another provider<\/a>/.exec(decode(h));
		expect(link?.[1]).toMatch(/#ai-drafting$/);
		const buttons = [...h.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)]
			.map((m) => strip(m[1]!))
			.filter((t) => /Gemini/.test(t));
		expect(buttons).toEqual(["Don't send to Gemini", 'Send to Gemini']);
		expect(text).not.toMatch(/never ask/i);
		expect(h).toContain('role="alertdialog"');
	});

	test('source: initial focus on cancel, Escape cancels, overlay ignored', () => {
		const s = src('GeminiDataDialog.svelte');
		expect(s).toMatch(
			/onOpenAutoFocus=\{\(e\) => \{\s*e\.preventDefault\(\);\s*cancelEl\?\.focus\(\);/
		);
		expect(s).toMatch(/bind:ref=\{cancelEl\}[^>]*>\{DONT_SEND\}/);
		expect(s).toMatch(/function onEscapeKeydown[\s\S]*?cancel\(\);/);
		expect(s).toContain('interactOutsideBehavior="ignore"');
	});
});

describe('ProviderChip', () => {
	test('live: provider · model with the model in <code>', () => {
		const h = html(ProviderChip, {
			kind: 'live',
			providerLabel: 'Anthropic',
			model: 'claude-sonnet-5-5'
		});
		expect(strip(h)).toBe('Anthropic · claude-sonnet-5-5');
		expect(h).toMatch(/<code[^>]*>claude-sonnet-5-5<\/code>/);
		expect(h).toContain('lucide-cpu');
	});

	test('sample: exactly "Sample output" with the Phase 4 sample visual', () => {
		const h = html(ProviderChip, { kind: 'sample' });
		expect(strip(h)).toBe('Sample output');
		expect(h).toContain('bg-accent-surface');
		expect(h).toContain('lucide-flask-conical');
	});
});

test('no component source injects HTML or touches persistent storage', () => {
	for (const f of ['GenerationError.svelte', 'GeminiDataDialog.svelte', 'ProviderChip.svelte']) {
		const s = src(f);
		expect(s).not.toContain('{@html');
		expect(s).not.toContain('localStorage');
	}
});
