// SSR structural tests for GenerationPanel (05-13 Task 3, AI-04). The panel renders with a
// PanelState built from `initial` (no onMount, no network). The exits group must hold exactly
// three controls, in order, and nothing else in the panel may carry a mailto: href.
import { readFileSync } from 'node:fs';
import { render } from 'svelte/server';
import { describe, expect, test } from 'vitest';
import type { Finding, FindingMember } from '@tran/core/fair-housing';
import { DEMO_INPUTS } from '../prompts/shared/demo.v1';
import GenerationPanel from './GenerationPanel.svelte';
import { PanelState, type PanelDeps, type PanelInitial } from './panel-state.svelte';
import { numbersCopy, numbersStub } from './post-check.fixtures';

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
const count = (h: string, re: RegExp) => (h.match(re) ?? []).length;

function makeState(deps: Partial<PanelDeps> = {}, initial: PanelInitial = {}): PanelState {
	return new PanelState(
		{
			promptId: 'shared/demo',
			inputs: DEMO_INPUTS,
			feature: 'demo',
			resolve: () => Promise.reject(new Error('no resolve in SSR')),
			repo: null,
			announce: () => {},
			...deps
		},
		initial
	);
}

function panel(
	state: PanelState,
	props: Record<string, unknown> = {}
): { html: string; exits: string; controls: { tag: string; open: string; text: string }[] } {
	const { body } = render(GenerationPanel, {
		props: {
			feature: 'demo',
			promptId: 'shared/demo',
			inputs: DEMO_INPUTS,
			title: 'Try a draft',
			state,
			...props
		}
	});
	const exits = body.match(/data-testid="generation-exits"[^>]*>([\s\S]*?)<\/div>/)![1]!;
	const controls = [...exits.matchAll(/<(button|a)\b([^>]*)>([\s\S]*?)<\/\1>/g)].map((m) => ({
		tag: m[1]!,
		open: m[2]!,
		text: strip(m[3]!)
	}));
	return { html: body, exits, controls };
}

const attr = (open: string, name: string) =>
	new RegExp(`\\s${name}="([^"]*)"`).exec(open)?.[1] ?? null;

function claimsCheck(text: string): Finding[] {
	const m: FindingMember = {
		entryId: 'claims.best',
		checker: 'claims',
		category: 'claims',
		categoryLabel: 'Unverified claim',
		scope: 'other',
		severity: 'block',
		explanation: 'Superlatives need support.',
		alternative: 'A good',
		source: 'Phase 7 claims check',
		phrase: text.slice(0, 4),
		start: 0,
		end: 4
	};
	return [{ id: '0-4', start: 0, end: 4, severity: 'block', phrase: m.phrase, members: [m] }];
}

const BLOCK_REASON = 'Fix the 1 phrase marked Must fix to copy or email this draft.';

describe('exits group (AI-04)', () => {
	test('exactly three exits, in order, one mailto href on the email link', () => {
		const { html, controls } = panel(makeState({}, { text: 'Bright two-bedroom near transit.' }));
		expect(html).toMatch(
			/role="group"[^>]*aria-label="Use this draft"[^>]*data-testid="generation-exits"/
		);
		expect(controls.map((c) => c.text)).toEqual(['Copy text', 'Open in email app', 'Mark as sent']);
		expect(controls.map((c) => c.tag)).toEqual(['button', 'a', 'button']);
		expect(count(html, /href="mailto:/g)).toBe(1);
		expect(attr(controls[1]!.open, 'href')).toMatch(/^mailto:/);
		for (const c of controls) expect(attr(c.open, 'aria-disabled')).toBeNull();
		expect(strip(html)).toContain(
			'Tran never sends anything for you. Copy the text or open it in your email app, then send it yourself. Mark as sent only updates Draft history in this browser.'
		);
	});

	test('a block finding gates all three with a linked reason and no href', () => {
		const { html, controls } = panel(makeState({}, { text: 'Perfect for young professionals.' }));
		expect(controls).toHaveLength(3);
		const reasonId = /<p id="([^"]+)"[^>]*>(?:(?!<\/p>)[\s\S])*Fix the 1 phrase/.exec(html)?.[1];
		expect(reasonId).toBeTruthy();
		expect(strip(html)).toContain(BLOCK_REASON);
		for (const c of controls) {
			expect(attr(c.open, 'aria-disabled')).toBe('true');
			expect(attr(c.open, 'aria-describedby')?.split(' ')).toContain(reasonId);
			expect(c.open).not.toMatch(/\sdisabled(=|\s|$)/);
		}
		expect(attr(controls[1]!.open, 'href')).toBeNull();
		expect(html).not.toContain('href="mailto:');
	});

	test('a postChecks block gates the same way; the exit count is unchanged', () => {
		const state = makeState({ postChecks: [claimsCheck] }, { text: 'Best deal around.' });
		const { html, controls } = panel(state, { postChecks: [claimsCheck] });
		expect(controls.map((c) => c.text)).toEqual(['Copy text', 'Open in email app', 'Mark as sent']);
		for (const c of controls) expect(attr(c.open, 'aria-disabled')).toBe('true');
		expect(strip(html)).toContain(BLOCK_REASON);
	});

	test('exitDisabled gates only the email link with its own reason', () => {
		const exitDisabled = { email: 'This contact has no email address.' };
		const state = makeState({ exitDisabled }, { text: 'Bright two-bedroom near transit.' });
		const { html, controls } = panel(state, { exitDisabled });
		const [copy, email, sent] = controls;
		expect(attr(email!.open, 'aria-disabled')).toBe('true');
		expect(attr(email!.open, 'href')).toBeNull();
		expect(attr(copy!.open, 'aria-disabled')).toBeNull();
		expect(attr(sent!.open, 'aria-disabled')).toBeNull();
		const reasonId =
			/<p id="([^"]+)"[^>]*>(?:(?!<\/p>)[\s\S])*This contact has no email address\./.exec(
				html
			)?.[1];
		expect(attr(email!.open, 'aria-describedby')?.split(' ')).toContain(reasonId);
	});

	test('emailFooter: mailto body ends with the footer; preview line sits outside the exits', () => {
		const emailFooter = { text: 'Reply STOP to opt out.', label: 'Added to emails' };
		const state = makeState({ emailFooter }, { text: 'Hello there.' });
		const { html, exits, controls } = panel(state, { emailFooter });
		expect(controls).toHaveLength(3);
		expect(decode(attr(controls[1]!.open, 'href')!)).toMatch(
			/%0D%0A%0D%0AReply%20STOP%20to%20opt%20out\.$/
		);
		expect(strip(html)).toContain('Added to emails: Reply STOP to opt out.');
		expect(strip(exits)).not.toContain('Added to emails');
	});

	test('long mailto note renders above the exits', () => {
		const { html } = panel(makeState({}, { text: 'word '.repeat(400).trim() }));
		const note =
			'This draft is long, so some email apps may cut it off. If it arrives incomplete, use Copy text instead.';
		const text = strip(html);
		expect(text).toContain(note);
		expect(text.indexOf(note)).toBeLessThan(text.indexOf('Copy text Open in email app'));
	});

	test('marked as sent: pressed label', () => {
		const { controls } = panel(
			makeState({}, { text: 'Bright two-bedroom near transit.', status: 'sent', artifactId: 'a1' })
		);
		expect(controls[2]!.text).toBe('Marked as sent');
		expect(attr(controls[2]!.open, 'aria-pressed')).toBe('true');
	});
});

describe('panel structure', () => {
	test('tokens are restored in the output box', () => {
		const tokens = { client_first_name: 'Dana' };
		const { html } = panel(makeState({ tokens }, { text: 'Hi {client_first_name}' }), { tokens });
		const output = /data-generation-output=""[^>]*>([\s\S]*?)<\/div>/.exec(html)![1]!;
		expect(strip(output)).toBe('Hi Dana');
	});

	test('empty state: placeholder, Generate draft, all exits gated', () => {
		const { html, controls } = panel(makeState());
		const text = strip(html);
		expect(text).toContain(
			'Your draft will appear here. Nothing leaves this page until you copy it or open it in your email app.'
		);
		expect(text).toContain('Generate draft');
		for (const c of controls) expect(attr(c.open, 'aria-disabled')).toBe('true');
		expect(html).not.toContain('href="mailto:');
	});

	test('output box is focusable by script, labelled Draft, and not a live region', () => {
		const { html } = panel(makeState({}, { text: 'Hello.' }));
		const open = /<div([^>]*data-generation-output=""[^>]*)>/.exec(html)![1]!;
		expect(attr(open, 'tabindex')).toBe('-1');
		expect(attr(open, 'aria-label')).toBe('Draft');
		expect(open).not.toContain('aria-live');
	});

	test('section labelled by its heading; heading level follows the prop', () => {
		const h3 = panel(makeState()).html;
		const id = /<section[^>]*aria-labelledby="([^"]+)"/.exec(h3)![1];
		const h3m = new RegExp(String.raw`<h3[^>]*id="${id}"[^>]*>([\s\S]*?)</h3>`).exec(h3);
		expect(strip(h3m![1]!)).toBe('Try a draft');
		const h2 = panel(makeState(), { headingLevel: 2 }).html;
		expect(strip(/<h2[^>]*>([\s\S]*?)<\/h2>/.exec(h2)![1]!)).toBe('Try a draft');
	});

	test('"What will be sent" is a closed native disclosure', () => {
		const { html } = panel(makeState());
		const details = /<details([^>]*)>/.exec(html)![1]!;
		expect(details).not.toMatch(/\sopen/);
		expect(html).toMatch(/<summary[^>]*>[\s\S]*?What will be sent\s*<\/summary>/);
	});

	test('the panel source has no HTML injection, clipboard, mailto literal or navigation', () => {
		const s = readFileSync(new URL('./GenerationPanel.svelte', import.meta.url), 'utf8');
		for (const banned of ['{@html', 'navigator.clipboard', 'mailto:', 'window.open', 'location.']) {
			expect(s).not.toContain(banned);
		}
	});
});

describe('Phase 7 post-check groups (checkGroups)', () => {
	const groupsProps = { postChecks: [numbersStub], checkGroups: [numbersCopy] };

	test('a number finding renders its own group after Fair Housing and gates every exit', () => {
		const state = makeState({ postChecks: [numbersStub] }, { text: 'Cash flow is 20%' });
		const { html, controls } = panel(state, groupsProps);
		const text = strip(html);
		expect(text).toContain('Number check: 1 to fix');
		// The popover body ("Category: …") is SSR-tested via FindingDetails; the row shows the label.
		expect(text).toContain('“20%” Number not in your analysis');
		expect(text).toContain('Number check, must fix: ');
		expect(text).not.toContain('Fair Housing problem, must fix: ');
		expect(text).not.toContain('Fair Housing check: 1 to fix');
		const fh = text.indexOf('No Fair Housing problem phrases found');
		expect(fh).toBeGreaterThan(-1);
		expect(fh).toBeLessThan(text.indexOf('Number check: 1 to fix'));
		expect(controls.map((c) => c.text)).toEqual(['Copy text', 'Open in email app', 'Mark as sent']);
		for (const c of controls) expect(attr(c.open, 'aria-disabled')).toBe('true');
		const a = controls.find((c) => c.tag === 'a')!;
		expect(attr(a.open, 'href')).toBeNull();
	});

	test('post-check rows offer Show in draft and Edit it myself, never Remove phrase', () => {
		const state = makeState({ postChecks: [numbersStub] }, { text: 'Cash flow is 20%' });
		const text = strip(panel(state, groupsProps).html);
		expect(text).toContain('Show in draft');
		expect(text).toContain('Edit it myself');
		expect(text).not.toContain('Remove phrase');
		expect(text).not.toContain('Suggested fix: remove this phrase.');
		expect(text).not.toContain('Based on:');
	});

	test('no number findings: the group shows its passed title and note', () => {
		const state = makeState({ postChecks: [numbersStub] }, { text: 'Cash flow is fine.' });
		const text = strip(panel(state, groupsProps).html);
		expect(text).toContain('No Fair Housing problem phrases found');
		expect(text).toContain('Number check passed');
		expect(text).toContain('Every number in this memo matches a figure from your analysis.');
	});

	test('without checkGroups the same finding stays in the Fair Housing group (Phase 5)', () => {
		const state = makeState({ postChecks: [numbersStub] }, { text: 'Cash flow is 20%' });
		const text = strip(panel(state, { postChecks: [numbersStub] }).html);
		expect(text).toContain('Fair Housing check: 1 to fix');
		expect(text).toContain('Fair Housing problem, must fix: ');
		expect(text).not.toContain('Number check');
	});

	test('the panel source exposes read-only bindables and no state callback', () => {
		const s = readFileSync(new URL('./GenerationPanel.svelte', import.meta.url), 'utf8');
		expect(s).toMatch(/artifactId = \$bindable\(null\)/);
		expect(s).toMatch(/draftText = \$bindable\(''\)/);
		expect(s).toContain('checkGroups');
		// Split literals keep the repo-wide grep for these names at zero.
		for (const banned of ['onstate' + 'change', 'PanelGate' + 'State', 'fetch(']) {
			expect(s).not.toContain(banned);
		}
	});
});
