// SSR structural tests for the Settings "AI drafting" controls (05-14): the Draft with picker and
// the sample output toggle. Components render to a string with `svelte/server`.
import type { Component } from 'svelte';
import { render } from 'svelte/server';
import { describe, expect, test } from 'vitest';
import type { LiveProviderId } from '@tran/core/ai';
import type { AiKeyState } from '$lib/ai/setup';
import { defaultModel } from '$lib/ai/models';
import AiProviderPicker, { providerAnnouncement } from './AiProviderPicker.svelte';
import SampleOutputToggle, { sampleAnnouncement } from './SampleOutputToggle.svelte';

const decode = (s: string) =>
	s
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&amp;/g, '&');
const strip = (h: string) =>
	decode(h.replace(/<!--[\s\S]*?-->/g, '').replace(/<(?:[^>"']|"[^"]*"|'[^']*')*>/g, ' '));
const text = (h: string) => strip(h).replace(/\s+/g, ' ').replace(/ \./g, '.').trim();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function html(component: Component<any>, props: Record<string, unknown>): string {
	return render(component, { props }).body;
}

const states =
	(m: Partial<Record<LiveProviderId, AiKeyState>>) =>
	(id: LiveProviderId): AiKeyState =>
		m[id] ?? 'none';

/** The `<label>` rows, in document order. */
const rows = (body: string) => [...body.matchAll(/<label\b[\s\S]*?<\/label>/g)].map((m) => m[0]);
/** The value of the checked radio item, if any. */
function checkedValue(body: string): string | null {
	const items = [...body.matchAll(/<button\b[^>]*role="radio"[^>]*>/g)].map((m) => m[0]);
	const on = items.find((b) => /aria-checked="true"/.test(b));
	return on ? (on.match(/value="([^"]*)"/)?.[1] ?? '?') : null;
}

describe('AiProviderPicker', () => {
	test('fieldset with the Draft with legend and four options in fixed order', () => {
		const body = html(AiProviderPicker, { keyState: states({}), selected: null });
		expect(body).toMatch(/<fieldset\b/);
		expect(body).toMatch(/<legend\b[^>]*>\s*Draft with\s*<\/legend>/);
		const titles = rows(body).map((r) => text(r).split(/ (?:Key|No key)/)[0]);
		expect(titles).toEqual(['Anthropic', 'OpenAI', 'Google Gemini', 'OpenRouter']);
	});

	test('option rows are 44px-min labels with a radio, title and description', () => {
		const body = html(AiProviderPicker, { keyState: states({}), selected: null });
		const r = rows(body);
		expect(r).toHaveLength(4);
		for (const row of r) {
			expect(row).toMatch(/^<label\b[^>]*class="[^"]*\bmin-h-11\b/);
			expect(row).toMatch(/role="radio"/);
		}
	});

	test('descriptions per key state, with the model in <code>', () => {
		const body = html(AiProviderPicker, {
			keyState: states({ anthropic: 'saved', openai: 'locked' }),
			selected: 'anthropic'
		});
		const [anthropic, openai, gemini] = rows(body);
		expect(text(anthropic)).toContain(`Key saved. Model: ${defaultModel('anthropic')}.`);
		expect(anthropic).toContain(`<code`);
		expect(anthropic).toMatch(new RegExp(`<code[^>]*>${defaultModel('anthropic')}</code>`));
		expect(text(openai)).toContain('Key locked. Unlock it in Key security to draft with OpenAI.');
		expect(text(gemini)).toContain(
			'No key yet. Drafts use sample output until you add one in API keys.'
		);
	});

	test('no keys and nothing selected: nothing checked, status line with an Add an AI key link', () => {
		const body = html(AiProviderPicker, { keyState: states({}), selected: null });
		expect(checkedValue(body)).toBeNull();
		const t = text(body);
		expect(t).toContain('No AI key yet, so drafts use sample output.');
		expect(t).toContain('to draft with Anthropic, OpenAI, Google Gemini, or OpenRouter.');
		const link = body.match(/<a\b[^>]*href="([^"]*)"[^>]*>\s*Add an AI key\s*<\/a>/);
		expect(link?.[1]).toMatch(/#api-keys$/);
	});

	test('nothing selected but OpenAI and OpenRouter saved: OpenAI is checked', () => {
		const body = html(AiProviderPicker, {
			keyState: states({ openai: 'saved', openrouter: 'saved' }),
			selected: null
		});
		expect(checkedValue(body)).toBe('openai');
		expect(text(body)).not.toContain('No AI key yet');
	});

	test('an explicit keyless selection stays checked (keyless providers are never disabled)', () => {
		const body = html(AiProviderPicker, {
			keyState: states({ openai: 'saved' }),
			selected: 'gemini'
		});
		expect(checkedValue(body)).toBe('gemini');
		expect(body).not.toMatch(/role="radio"[^>]*\sdisabled/);
	});

	test('providerAnnouncement', () => {
		expect(providerAnnouncement('OpenAI')).toBe('OpenAI will write your drafts.');
	});
});

describe('SampleOutputToggle', () => {
	test('unchecked by default with the title and description', () => {
		const body = html(SampleOutputToggle, { checked: false, providerLabel: null });
		const t = text(body);
		expect(t).toContain('Use sample output instead of my AI key');
		expect(t).toContain(
			'Drafts are pre-written samples, so no key is used and nothing is sent. Handy for trying things out.'
		);
		expect(body).toMatch(
			/role="checkbox"[^>]*aria-checked="false"|aria-checked="false"[^>]*role="checkbox"/
		);
		expect(body).toMatch(/<label\b[^>]*class="[^"]*\bmin-h-11\b/);
	});

	test('checked renders aria-checked true', () => {
		const body = html(SampleOutputToggle, { checked: true, providerLabel: 'Anthropic' });
		expect(body).toMatch(/aria-checked="true"/);
	});

	test('sampleAnnouncement', () => {
		expect(sampleAnnouncement(true)).toBe('Sample output turned on.');
		expect(sampleAnnouncement(false, 'Anthropic')).toBe(
			'Sample output turned off. Drafts use your Anthropic key.'
		);
		expect(sampleAnnouncement(false, null)).toBe('Sample output turned off.');
	});
});
