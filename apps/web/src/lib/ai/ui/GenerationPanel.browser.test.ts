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
