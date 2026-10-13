// Real-browser checks for GenerationPanel `sections` mode (09-19) that SSR cannot exercise: a run
// streams into three cards and announces the pack once, Copy writes exactly the assembled post
// (disclosure last) through exits.ts, an edit that adds hashtags past the cap gates Copy, and a
// gated Copy moves focus to its reason line. The panel passes axe.
import { describe, expect, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import {
	HASHTAG_CAPS,
	PLATFORM_LABELS,
	assemblePost,
	parseSocialPack,
	splitTrailingHashtags,
	type Platform
} from '@tran/core/studio';
import { axeViolations } from '$lib/testing/axe';
import type { LlmEvent, LlmProvider } from '../ports';
import { sampleSocialPack, type SocialPackInputs } from '../prompts/studio/social.v1';
import GenerationPanel from './GenerationPanel.svelte';
import { PanelState } from './panel-state.svelte';
import PlatformCard, { cardPayload, type SectionSpec } from './PlatformCard.svelte';

const DISCLOSURE = 'Sample Realty, Avery Sample, Lic. #SAMPLE-0000 (NY)';
const INPUTS: SocialPackInputs = {
	postType: 'just-listed',
	brief: 'Just listed: 3 bedrooms, 2 baths, updated kitchen, open house Saturday 1 to 3.',
	cityOrArea: 'Harlow Springs',
	link: '',
	tone: 'warm',
	disclosure: DISCLOSURE
};
const KEYS: Platform[] = ['instagram', 'facebook', 'linkedin'];

function spec(key: Platform): SectionSpec {
	return {
		key,
		label: PLATFORM_LABELS[key],
		constraintLine: 'Constraint.',
		emailFooter: { text: DISCLOSURE, label: 'Added to the end of this post' },
		extract(fullText, streaming) {
			const pack = parseSocialPack(fullText, { streaming });
			const s = pack[key];
			if (s.ok) {
				const text = s.tags.length > 0 ? `${s.body}\n\n${s.tags.join(' ')}` : s.body;
				return { state: streaming && pack.active === key ? 'streaming' : 'ok', text };
			}
			if (streaming) return { state: pack.active === key ? 'streaming' : 'empty', text: '' };
			return { state: fullText === '' ? 'empty' : 'error', text: '' };
		},
		assemble(sectionText) {
			const split = splitTrailingHashtags(sectionText);
			const a = assemblePost(key, split.body, split.tags, DISCLOSURE);
			return { ...a, tagsOverCap: Math.max(0, split.tags.length - HASHTAG_CAPS[key]) };
		}
	};
}

function mount() {
	const pack = sampleSocialPack(INPUTS);
	const provider: LlmProvider = {
		id: 'anthropic',
		async *stream(): AsyncGenerator<LlmEvent> {
			for (const line of pack.split('\n')) yield { type: 'text', text: `${line}\n` };
			yield { type: 'finish', reason: 'stop' };
		}
	};
	const writes: string[] = [];
	const announced: string[] = [];
	const exits: string[] = [];
	const state = new PanelState({
		promptId: 'studio/social.v1',
		inputs: INPUTS,
		feature: 'studio-social',
		resolve: async () => ({
			selection: { kind: 'live', id: 'anthropic' },
			provider,
			model: 'test-model'
		}),
		repo: null,
		announce: (m) => void announced.push(m),
		clipboard: { writeText: async (t) => void writes.push(t) },
		recheckMs: 10
	});
	return { state, writes, announced, exits };
}

const axe = async (root: Element) =>
	(await axeViolations(root)).filter((v) => !v.startsWith('target-size:'));

const buttonNamed = (name: string) =>
	[...document.querySelectorAll<HTMLElement>('button, a')].find(
		(b) => b.textContent?.trim() === name
	);

describe('GenerationPanel sections mode in the browser', () => {
	test('run, announce, copy, edit past the hashtag cap, gated focus', async () => {
		const { state, writes, announced, exits } = mount();
		const { container } = await render(GenerationPanel, {
			props: {
				feature: 'studio-social',
				promptId: 'studio/social.v1',
				inputs: INPUTS,
				title: 'Post pack',
				headingLevel: 2,
				generateLabel: 'Write post pack',
				state,
				sections: KEYS.map(spec),
				onExit: (kind: string, p: { text: string }) => void exits.push(`${kind}:${p.text}`)
			}
		});

		buttonNamed('Write post pack')!.click();
		await vi.waitFor(() => expect(buttonNamed('Generate again')).toBeTruthy());
		await vi.waitFor(() =>
			expect(announced.at(-1)).toBe(
				'Post pack ready. Instagram: ready to copy. Facebook: ready to copy. LinkedIn: ready to copy.'
			)
		);
		expect(container.querySelectorAll('article[data-platform-card]')).toHaveLength(3);
		expect(container.querySelector('[data-testid="generation-exits"]')).toBeNull();

		// Copy LinkedIn: exactly the assembled post, disclosure last.
		const li = spec('linkedin');
		const copyLi = buttonNamed('Copy LinkedIn post')!;
		copyLi.focus();
		await userEvent.keyboard('{Enter}');
		await vi.waitFor(() => expect(writes).toHaveLength(1));
		expect(writes[0]).toBe(li.assemble(li.extract(state.text, false).text).text);
		expect(writes[0]!.endsWith(`\n\n${DISCLOSURE}`)).toBe(true);
		expect(document.activeElement).toBe(copyLi);
		expect(announced.at(-1)).toBe('LinkedIn post copied.');
		expect(exits).toEqual([`copy:${writes[0]}`]);
		const liCard = container.querySelector('article[data-platform-card="linkedin"]')!;
		expect(liCard.textContent).toContain('Copied.');

		// Edit Facebook: three extra tags on the last line gate Copy (5 tags, cap 2).
		const fbCard = container.querySelector('article[data-platform-card="facebook"]')!;
		const fbEdit = [...fbCard.querySelectorAll<HTMLElement>('button')].find(
			(b) => b.textContent?.trim() === 'Edit post'
		)!;
		fbEdit.click();
		const area = await vi.waitFor(() => {
			const el = fbCard.querySelector<HTMLTextAreaElement>('textarea');
			expect(el).toBeTruthy();
			return el!;
		});
		expect(fbCard.querySelector('label')?.textContent?.trim()).toBe('Edit your Facebook post');
		area.focus();
		area.setSelectionRange(area.value.length, area.value.length);
		await userEvent.keyboard(' #TagOne #TagTwo #TagThree');
		const done = [...fbCard.querySelectorAll<HTMLElement>('button')].find(
			(b) => b.textContent?.trim() === 'Done editing'
		)!;
		done.click();
		await vi.waitFor(() => expect(fbCard.querySelector('textarea')).toBeNull());
		const copyFb = buttonNamed('Copy Facebook post')!;
		await vi.waitFor(() => expect(copyFb.getAttribute('aria-disabled')).toBe('true'));
		expect(fbCard.textContent).toContain(
			'Facebook uses up to 2 hashtags. Remove 3 to copy this post.'
		);

		// Gated Copy keeps the control focusable and moves focus to the reason line.
		copyFb.focus();
		await userEvent.keyboard('{Enter}');
		await vi.waitFor(() => expect(document.activeElement?.id).toMatch(/-facebook-reason$/));
		expect(writes).toHaveLength(1);
		expect(announced.at(-1)).toBe('Facebook uses up to 2 hashtags. Remove 3 to copy this post.');
		// The other cards are unaffected.
		expect(buttonNamed('Copy Instagram post')!.getAttribute('aria-disabled')).toBeNull();

		expect(await axe(container)).toEqual([]);
	});
});

describe('PlatformCard Copy inside the recheck window', () => {
	/** One Instagram card in edit mode whose recheck never fires on its own (60 s debounce). */
	async function editCard() {
		const writes: string[] = [];
		const copied: string[] = [];
		const announced: string[] = [];
		await render(PlatformCard, {
			props: {
				spec: spec('instagram'),
				fullText: sampleSocialPack(INPUTS),
				streaming: false,
				hasDraft: true,
				idPrefix: 'gap',
				recheckMs: 60_000,
				announce: (m: string) => void announced.push(m),
				clipboard: { writeText: async (t: string) => void writes.push(t) },
				onCopied: (_k: Platform, t: string) => void copied.push(t)
			}
		});
		buttonNamed('Edit post')!.click();
		const area = await vi.waitFor(() => {
			const el = document.querySelector<HTMLTextAreaElement>('textarea');
			expect(el).toBeTruthy();
			return el!;
		});
		area.focus();
		area.setSelectionRange(0, 0);
		return { area, writes, copied, announced };
	}

	test('a Must-fix phrase copied before the recheck copies nothing and focuses the reason', async () => {
		const { writes, copied, announced } = await editCard();
		await userEvent.keyboard('Perfect for young professionals. ');
		buttonNamed('Copy Instagram post')!.click();
		expect(writes).toEqual([]);
		expect(copied).toEqual([]);
		await vi.waitFor(() => expect(document.activeElement?.id).toBe('gap-instagram-reason'));
		const reason = 'Fix the 1 phrase marked Must fix to copy or email this draft.';
		expect(document.getElementById('gap-instagram-reason')!.textContent?.trim()).toBe(reason);
		expect(announced.at(-1)).toBe(reason);
		expect(buttonNamed('Copy Instagram post')!.getAttribute('aria-disabled')).toBe('true');
		expect(writes).toEqual([]);
	});

	test('a clean edit copied before the recheck copies exactly the checked text', async () => {
		const { area, writes } = await editCard();
		await userEvent.keyboard('Sunny day. ');
		buttonNamed('Copy Instagram post')!.click();
		await vi.waitFor(() => expect(writes).toHaveLength(1));
		expect(writes[0]).toBe(cardPayload(spec('instagram'), area.value));
		expect(writes[0]!.startsWith('Sunny day. ')).toBe(true);
	});
});
