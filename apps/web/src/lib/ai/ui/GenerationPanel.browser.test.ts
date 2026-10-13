// Real-browser checks SSR cannot exercise: the run button swaps label in place while streaming,
// gated exits keep focus and move it to the findings title, the Gemini dialog opens with the
// safe default focused and Escape cancels without a request, and the panel passes axe.
import { describe, expect, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import type { AiProviderId } from '@tran/core/ai';
import { axeViolations } from '$lib/testing/axe';
import type { LlmEvent, LlmProvider, LlmRequest } from '../ports';
import { DEMO_INPUTS } from '../prompts/shared/demo.v1';
import type { Selection } from '../setup';
import GenerationPanel from './GenerationPanel.svelte';
import { PanelState } from './panel-state.svelte';
import PanelBindHarness from './testing/PanelBindHarness.svelte';

function scripted(id: AiProviderId, chunks: string[], hold?: Promise<void>) {
	const requests: LlmRequest[] = [];
	const provider: LlmProvider = {
		id,
		async *stream(req): AsyncGenerator<LlmEvent> {
			requests.push(req);
			for (const text of chunks) {
				yield { type: 'text', text };
				if (hold) await hold;
			}
			yield { type: 'finish', reason: 'stop' };
		}
	};
	return { provider, requests };
}

function mount(selection: Selection, provider: LlmProvider) {
	const session = new Map<string, string>();
	const state = new PanelState({
		promptId: 'shared/demo',
		inputs: DEMO_INPUTS,
		feature: 'demo',
		resolve: async () => ({ selection, provider, model: 'test-model' }),
		repo: null,
		announce: () => {},
		session: {
			getItem: (k) => session.get(k) ?? null,
			setItem: (k, v) => void session.set(k, v)
		}
	});
	return { state, session };
}

// Component tests load no CSS, so the 44px <summary> row (min-h-11) renders at its 20px text
// height here and trips target-size. Sizes are a styling concern proven by the E2E axe runs;
// every other WCAG rule still applies.
const axe = async (root: Element) =>
	(await axeViolations(root)).filter((v) => !v.startsWith('target-size:'));

const buttonNamed = (name: string) =>
	[...document.querySelectorAll<HTMLElement>('button, a')].find(
		(b) => b.textContent?.trim() === name
	);

describe('GenerationPanel in the browser', () => {
	test('Generate becomes Stop on the same element; gated exit moves focus to findings', async () => {
		let release!: () => void;
		const hold = new Promise<void>((r) => (release = r));
		const { provider } = scripted('anthropic', ['Perfect for young professionals.'], hold);
		const { state } = mount({ kind: 'live', id: 'anthropic' }, provider);
		const { container } = await render(GenerationPanel, {
			props: { feature: 'demo', promptId: 'shared/demo', inputs: DEMO_INPUTS, title: 'Try', state }
		});

		const run = buttonNamed('Generate draft')!;
		run.focus();
		await userEvent.keyboard('{Enter}');
		await vi.waitFor(() => expect(run.textContent?.trim()).toBe('Stop'));
		expect(document.activeElement).toBe(run);
		release();
		await vi.waitFor(() => expect(run.textContent?.trim()).toBe('Generate again'));
		expect(document.activeElement).toBe(run);

		const copy = buttonNamed('Copy text')!;
		expect(copy.getAttribute('aria-disabled')).toBe('true');
		copy.focus();
		await userEvent.keyboard('{Enter}');
		await vi.waitFor(() => expect(document.activeElement?.id).toMatch(/-findings-title$/));

		expect(await axe(container)).toEqual([]);
	});

	test('Gemini dialog: safe default focused, Escape cancels with zero requests', async () => {
		const { provider, requests } = scripted('gemini', ['Hello.']);
		const { state } = mount({ kind: 'live', id: 'gemini' }, provider);
		await render(GenerationPanel, {
			props: { feature: 'demo', promptId: 'shared/demo', inputs: DEMO_INPUTS, title: 'Try', state }
		});
		const run = buttonNamed('Generate draft')!;
		run.focus();
		await userEvent.keyboard('{Enter}');
		await vi.waitFor(() =>
			expect(document.activeElement?.textContent?.trim()).toBe("Don't send to Gemini")
		);
		expect(await axe(document.body)).toEqual([]);
		await userEvent.keyboard('{Escape}');
		await vi.waitFor(() => expect(document.querySelector('[role="alertdialog"]')).toBeNull());
		await vi.waitFor(() => expect(document.activeElement).toBe(run));
		expect(requests).toHaveLength(0);
		expect(state.statusLine).toBe('Canceled. Nothing was sent to Google.');
	});
});

describe('exits inside the recheck window (real browser)', () => {
	const BLOCK_TYPED = 'Perfect for young professionals. ';
	const BLOCK_REASON = 'Fix the 1 phrase marked Must fix to copy or email this draft.';
	const PROPS = { feature: 'demo', promptId: 'shared/demo', inputs: DEMO_INPUTS, title: 'Try' };

	/** A panel whose edit recheck never fires on its own inside a test (60 s debounce). */
	function windowState() {
		const { provider } = scripted('anthropic', ['Bright two-bedroom near transit.']);
		const writes: string[] = [];
		const exits: { k: string; text: string; href?: string }[] = [];
		const announced: string[] = [];
		const state = new PanelState({
			promptId: 'shared/demo',
			inputs: DEMO_INPUTS,
			feature: 'demo',
			resolve: async () => ({
				selection: { kind: 'live', id: 'anthropic' },
				provider,
				model: 'test-model'
			}),
			repo: null,
			announce: (m) => void announced.push(m),
			recheckMs: 60_000,
			mailto: { to: 'agent@example.com' },
			clipboard: { writeText: async (t) => void writes.push(t) },
			onExit: (k, p) => void exits.push({ k, ...p })
		});
		return { state, writes, exits, announced };
	}

	async function generate(): Promise<void> {
		buttonNamed('Generate draft')!.click();
		await vi.waitFor(() => expect(buttonNamed('Generate again')).toBeTruthy());
	}

	/** Enters edit mode and types at the start of the draft. */
	async function typeAtStart(text: string): Promise<HTMLTextAreaElement> {
		buttonNamed('Edit draft')!.click();
		await vi.waitFor(() => expect(document.querySelector('textarea')).toBeTruthy());
		const ta = document.querySelector('textarea')!;
		ta.focus();
		ta.setSelectionRange(0, 0);
		await userEvent.keyboard(text);
		return ta;
	}

	/** Focus lands on the live findings title and stays there (the node was not swapped out). */
	async function expectFindingsTitleFocused(): Promise<void> {
		await vi.waitFor(() => expect(document.activeElement?.id).toMatch(/-findings-title$/));
		await new Promise((r) => setTimeout(r, 50));
		expect(document.activeElement?.id).toMatch(/-findings-title$/);
		expect(document.activeElement!.isConnected).toBe(true);
	}

	const emailLink = () => buttonNamed('Open in email app') as HTMLAnchorElement;

	/** Records the href and defaultPrevented of a link click, then stops the real navigation. */
	function watchLinkClicks() {
		const seen = { hrefAtClick: undefined as string | null | undefined, prevented: false };
		const listener = (e: MouseEvent) => {
			const a = (e.target as Element).closest('a');
			if (!a) return;
			seen.hrefAtClick = a.getAttribute('href');
			seen.prevented = e.defaultPrevented;
			e.preventDefault();
		};
		window.addEventListener('click', listener);
		return { seen, stop: () => window.removeEventListener('click', listener) };
	}

	test('A: Copy text right after typing a Must-fix phrase copies nothing and focuses findings', async () => {
		const { state, writes } = windowState();
		await render(GenerationPanel, { props: { ...PROPS, state } });
		await generate();
		await typeAtStart(BLOCK_TYPED);
		expect(state.checkPending).toBe(true);
		buttonNamed('Copy text')!.click();
		expect(writes).toEqual([]);
		await vi.waitFor(() =>
			expect(buttonNamed('Copy text')!.getAttribute('aria-disabled')).toBe('true')
		);
		await expectFindingsTitleFocused();
		expect(writes).toEqual([]);
	});

	test('B: the email link has no href while pending; Enter runs the checks and refuses', async () => {
		const { state, exits } = windowState();
		await render(GenerationPanel, { props: { ...PROPS, state } });
		await generate();
		await typeAtStart(BLOCK_TYPED);
		const link = emailLink();
		expect(link.getAttribute('href')).toBeNull();
		expect(link.getAttribute('tabindex')).toBe('0');
		link.focus();
		await userEvent.keyboard('{Enter}');
		expect(exits.some((x) => x.k === 'email')).toBe(false);
		await vi.waitFor(() => expect(link.getAttribute('aria-disabled')).toBe('true'));
		expect(link.getAttribute('href')).toBeNull();
		await expectFindingsTitleFocused();
	});

	test('C: a clean edit opens by keyboard with the checked text in the href', async () => {
		const { state, exits } = windowState();
		await render(GenerationPanel, { props: { ...PROPS, state } });
		await generate();
		await typeAtStart('Sunny ');
		const watch = watchLinkClicks();
		try {
			const link = emailLink();
			expect(link.getAttribute('href')).toBeNull();
			link.focus();
			await userEvent.keyboard('{Enter}');
			await vi.waitFor(() => expect(exits.some((x) => x.k === 'email')).toBe(true));
			expect(watch.seen.hrefAtClick?.startsWith('mailto:agent@example.com?body=')).toBe(true);
			expect(watch.seen.hrefAtClick).toContain(encodeURIComponent('Sunny Bright'));
			expect(watch.seen.prevented).toBe(false);
		} finally {
			watch.stop();
		}
	});

	test('D: Mark as sent on a Must-fix edit inside the window marks nothing and focuses findings', async () => {
		const { state, exits } = windowState();
		await render(GenerationPanel, { props: { ...PROPS, state } });
		await generate();
		await typeAtStart(BLOCK_TYPED);
		buttonNamed('Mark as sent')!.click();
		await expectFindingsTitleFocused();
		expect(state.artifactStatus).toBe('draft');
		expect(exits.some((x) => x.k === 'marked-sent')).toBe(false);
		expect(buttonNamed('Mark as sent')).toBeTruthy();
	});

	test('E: the exported flushChecks runs a pending recheck', async () => {
		const { state } = windowState();
		const { component } = await render(GenerationPanel, { props: { ...PROPS, state } });
		await generate();
		state.setText('Perfect for young professionals.');
		expect(state.checkPending).toBe(true);
		component.flushChecks();
		expect(state.checkPending).toBe(false);
		expect(state.gate.blocked).toBe(true);
	});

	test('F1: a clean edit activated with no pointerdown/keydown is recorded and opens', async () => {
		const { state, exits } = windowState();
		await render(GenerationPanel, { props: { ...PROPS, state } });
		await generate();
		await typeAtStart('Sunny ');
		const watch = watchLinkClicks();
		try {
			const link = emailLink();
			expect(link.getAttribute('href')).toBeNull();
			link.click();
			await vi.waitFor(() => expect(exits.some((x) => x.k === 'email')).toBe(true));
			expect(watch.seen.hrefAtClick?.startsWith('mailto:agent@example.com?body=')).toBe(true);
			expect(watch.seen.hrefAtClick).toContain(encodeURIComponent('Sunny Bright'));
			expect(watch.seen.prevented).toBe(false);
		} finally {
			watch.stop();
		}
	});

	test('F2: a Must-fix edit activated with no pointerdown/keydown is prevented', async () => {
		const { state, exits, announced } = windowState();
		await render(GenerationPanel, { props: { ...PROPS, state } });
		await generate();
		await typeAtStart(BLOCK_TYPED);
		const watch = watchLinkClicks();
		try {
			const link = emailLink();
			link.click();
			expect(exits.some((x) => x.k === 'email')).toBe(false);
			expect(watch.seen.prevented).toBe(true);
			expect(watch.seen.hrefAtClick).toBeNull();
			await vi.waitFor(() => expect(link.getAttribute('aria-disabled')).toBe('true'));
			await expectFindingsTitleFocused();
			expect(announced.at(-1)).toBe(BLOCK_REASON);
		} finally {
			watch.stop();
		}
	});

	test('G: hosts can bind checkPending and call flushChecks', async () => {
		const { state } = windowState();
		const { component } = await render(PanelBindHarness, { props: { ...PROPS, state } });
		await generate();
		const pendingEl = document.querySelector('[data-testid="pending"]')!;
		state.setText('Sunny');
		await vi.waitFor(() => expect(pendingEl.textContent).toBe('true'));
		component.flushChecks();
		await vi.waitFor(() => expect(pendingEl.textContent).toBe('false'));
	});
});
