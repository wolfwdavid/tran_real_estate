// SSR structural tests for GenerationPanel `sections` mode (09-19, STU-02) plus the pure card
// rules: one Copy exit per PlatformCard and no panel-level exits group, the gate priority order,
// the pack announcement, and the disclosure-last property of every copied post.
import { readFileSync } from 'node:fs';
import { render } from 'svelte/server';
import { describe, expect, test } from 'vitest';
import {
	HASHTAG_CAPS,
	PLATFORM_LABELS,
	assemblePost,
	parseSocialPack,
	splitTrailingHashtags,
	type Platform
} from '@tran/core/studio';
import { sampleSocialPack, type SocialPackInputs } from '../prompts/studio/social.v1';
import GenerationPanel from './GenerationPanel.svelte';
import { WARN_REASON, blockReason, type PostCheck } from './panel-controller';
import { PanelState, type PanelDeps, type PanelInitial } from './panel-state.svelte';
import {
	COPIED_META_KEY,
	PARSE_ERROR_BODY,
	cardGate,
	copiedNote,
	withCopied,
	cardPayload,
	countLine,
	packAnnouncement,
	type SectionSpec
} from './PlatformCard.svelte';

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
const attr = (open: string, name: string) =>
	new RegExp(`\\s${name}="([^"]*)"`).exec(open)?.[1] ?? null;

const MID = String.fromCharCode(0xb7);
const DISCLOSURE = `Sample Realty ${MID} Avery Sample, Licensed Real Estate Salesperson ${MID} Lic. #SAMPLE-0000 (NY) ${MID} (555) 010-0100`;
const LABEL = 'Added to the end of this post';
const BRIEF = 'Just listed: 3 bedrooms, 2 baths, updated kitchen, open house Saturday 1 to 3.';
const INPUTS: SocialPackInputs = {
	postType: 'just-listed',
	brief: BRIEF,
	cityOrArea: 'Harlow Springs',
	link: '',
	tone: 'warm',
	disclosure: DISCLOSURE
};
const PACK = sampleSocialPack(INPUTS);
const KEYS: Platform[] = ['instagram', 'facebook', 'linkedin'];
const CONSTRAINT: Record<Platform, string> = {
	instagram: 'Caption up to 2,200 characters. Up to 5 hashtags, in their own block.',
	facebook: 'Conversational. Up to 2 hashtags.',
	linkedin: 'Professional. Up to 3 hashtags at the end.'
};

/** The section specs a social host builds (09-20 builds the real ones the same way). */
function spec(key: Platform, disclosure = DISCLOSURE, postChecks: PostCheck[] = []): SectionSpec {
	return {
		key,
		label: PLATFORM_LABELS[key],
		constraintLine: CONSTRAINT[key],
		emailFooter: { text: disclosure, label: LABEL },
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
			const a = assemblePost(key, split.body, split.tags, disclosure);
			return { ...a, tagsOverCap: Math.max(0, split.tags.length - HASHTAG_CAPS[key]) };
		},
		postChecks
	};
}
const SPECS = KEYS.map((k) => spec(k));

function makeState(deps: Partial<PanelDeps> = {}, initial: PanelInitial = {}): PanelState {
	return new PanelState(
		{
			promptId: 'studio/social.v1',
			inputs: INPUTS,
			feature: 'studio-social',
			resolve: () => Promise.reject(new Error('no resolve in SSR')),
			repo: null,
			announce: () => {},
			...deps
		},
		initial
	);
}

function panel(state: PanelState, props: Record<string, unknown> = {}): string {
	return render(GenerationPanel, {
		props: {
			feature: 'studio-social',
			promptId: 'studio/social.v1',
			inputs: INPUTS,
			title: 'Post pack',
			headingLevel: 2,
			state,
			sections: SPECS,
			...props
		}
	}).body;
}

/** The HTML of one card's <article>. */
function card(html: string, key: Platform): string {
	const m = new RegExp(
		`<article\\b[^>]*data-platform-card="${key}"[^>]*>([\\s\\S]*?)</article>`
	).exec(html);
	expect(m, `${key} card`).toBeTruthy();
	return m![0];
}

function exitControls(cardHtml: string, key: Platform) {
	const group = new RegExp(`<div\\b([^>]*data-testid="exits-${key}"[^>]*)>([\\s\\S]*?)</div>`).exec(
		cardHtml
	)!;
	const controls = [...group[2]!.matchAll(/<(button|a)\b([^>]*)>([\s\S]*?)<\/\1>/g)].map((m) => ({
		open: m[2]!,
		text: strip(m[3]!)
	}));
	return { groupOpen: group[1]!, controls };
}

describe('sections mode SSR (STU-02)', () => {
	test('one Copy exit per card, no panel-level exits group, no mailto', () => {
		const html = panel(makeState({}, { text: PACK }));
		expect(html).not.toContain('data-testid="generation-exits"');
		expect(html).not.toContain('mailto:');
		expect(html).not.toContain('Mark as sent');
		for (const key of KEYS) {
			const label = PLATFORM_LABELS[key];
			const { groupOpen, controls } = exitControls(card(html, key), key);
			expect(attr(groupOpen, 'role')).toBe('group');
			expect(attr(groupOpen, 'aria-label')).toBe(`Use the ${label} post`);
			expect(controls).toHaveLength(1);
			expect(controls[0]!.text).toBe(`Copy ${label} post`);
			expect(attr(controls[0]!.open, 'aria-disabled')).toBeNull();
		}
		expect(strip(html)).toContain('Copy Instagram post');
	});

	test('cards are articles labelled by their h3, in fixed order, with the disclosure block', () => {
		const html = panel(makeState({}, { text: PACK }));
		const order = [...html.matchAll(/data-platform-card="(\w+)"/g)].map((m) => m[1]);
		expect(order).toEqual(KEYS);
		for (const key of KEYS) {
			const c = card(html, key);
			const labelledBy = attr(/<article\b([^>]*)>/.exec(c)![1]!, 'aria-labelledby')!;
			const h3 = new RegExp(`<h3\\b[^>]*id="${labelledBy}"[^>]*>([\\s\\S]*?)</h3>`).exec(c);
			expect(strip(h3![1]!)).toBe(PLATFORM_LABELS[key]);
			expect(strip(c)).toContain(CONSTRAINT[key]);
			const footer = /data-section-footer="\w+"[^>]*>([\s\S]*?)<\/div>/.exec(c)!;
			expect(strip(footer[1]!)).toBe(`${LABEL} ${DISCLOSURE}`);
			expect(strip(c)).toMatch(/characters, including your disclosure\./);
		}
	});

	test('the count line counts the assembled post, disclosure included', () => {
		const html = panel(makeState({}, { text: PACK }));
		for (const s of SPECS) {
			const a = s.assemble(s.extract(PACK, false).text);
			expect(a.text.endsWith(DISCLOSURE)).toBe(true);
			expect(strip(card(html, s.key))).toContain(countLine(s, a));
		}
		const fb = SPECS[1]!;
		expect(countLine(fb, fb.assemble('Hi'))).toMatch(
			/^\d[\d,]* characters, including your disclosure\. Facebook allows up to 63,206\.$/
		);
	});

	test('the keyless sample has zero findings on all three cards', () => {
		const html = panel(makeState({}, { text: PACK }));
		for (const key of KEYS) {
			expect(card(html, key)).toContain('No Fair Housing problem phrases found');
			expect(card(html, key)).not.toContain('finding--');
		}
	});

	test('a missing section shows the parse error on that card only, with Copy gated', () => {
		const noFacebook = PACK.replace(/=== FACEBOOK ===[\s\S]*?(?==== LINKEDIN ===)/, '');
		const html = panel(makeState({}, { text: noFacebook }));
		const fb = card(html, 'facebook');
		expect(strip(fb)).toContain("The Facebook post didn't come through");
		expect(strip(fb)).toContain(PARSE_ERROR_BODY);
		expect(attr(exitControls(fb, 'facebook').controls[0]!.open, 'aria-disabled')).toBe('true');
		for (const key of ['instagram', 'linkedin'] as const) {
			const c = card(html, key);
			expect(c).not.toContain("didn't come through");
			expect(attr(exitControls(c, key).controls[0]!.open, 'aria-disabled')).toBeNull();
		}
	});

	test('exitDisabled.copy (profile gate) gates every card with that reason', () => {
		const reason = 'Add your license number in your profile so your disclosure can be added.';
		const html = panel(makeState({}, { text: PACK }), { exitDisabled: { copy: reason } });
		for (const key of KEYS) {
			const c = card(html, key);
			const copy = exitControls(c, key).controls[0]!;
			expect(attr(copy.open, 'aria-disabled')).toBe('true');
			const reasonId = attr(copy.open, 'aria-describedby')!;
			expect(c).toMatch(new RegExp(`<p id="${reasonId}"[^>]*tabindex="-1"`));
			expect(strip(c)).toContain(reason);
		}
	});

	test('a Must fix phrase gates only its own card', () => {
		const bad = PACK.replace(
			'=== LINKEDIN ===\n',
			'=== LINKEDIN ===\nPerfect for young professionals. '
		);
		const html = panel(makeState({}, { text: bad }));
		const li = card(html, 'linkedin');
		expect(attr(exitControls(li, 'linkedin').controls[0]!.open, 'aria-disabled')).toBe('true');
		expect(strip(li)).toContain(blockReason(1));
		for (const key of ['instagram', 'facebook'] as const) {
			expect(
				attr(exitControls(card(html, key), key).controls[0]!.open, 'aria-disabled')
			).toBeNull();
		}
	});

	test('before a run every card shows the empty line and a gated Copy', () => {
		const html = panel(makeState());
		for (const key of KEYS) {
			const c = card(html, key);
			expect(strip(c)).toContain(
				'Your Instagram, Facebook, and LinkedIn posts will appear here. Nothing leaves this page until you copy a post.'
			);
			expect(attr(exitControls(c, key).controls[0]!.open, 'aria-disabled')).toBe('true');
		}
	});

	test('What will be sent says the disclosure stays in the browser', () => {
		const html = panel(
			makeState({}, { selection: { kind: 'sample', reason: 'no-key' } as never, text: PACK })
		);
		expect(strip(html)).toContain(
			"Your disclosure is added in this browser after the draft is written. It isn't sent to"
		);
	});

	test('default mode (no sections) still renders the three Phase 5 exits', () => {
		const html = panel(makeState({}, { text: 'Bright two-bedroom near transit.' }), {
			sections: undefined
		});
		const exits = /data-testid="generation-exits"[^>]*>([\s\S]*?)<\/div>/.exec(html)![1]!;
		const names = [...exits.matchAll(/<(button|a)\b[^>]*>([\s\S]*?)<\/\1>/g)].map((m) =>
			strip(m[2]!)
		);
		expect(names).toEqual(['Copy text', 'Open in email app', 'Mark as sent']);
		expect(html).not.toContain('data-platform-card');
	});
});

test('PlatformCard source has no HTML injection, clipboard API, mailto or navigation', () => {
	const s = readFileSync(new URL('./PlatformCard.svelte', import.meta.url), 'utf8');
	for (const banned of ['{@html', 'navigator.clipboard', 'mailto:', 'window.open', 'location.']) {
		expect(s).not.toContain(banned);
	}
	expect(s).toContain("from '../exits'");
});

describe('cardGate priority', () => {
	const base = {
		mustFix: 0,
		unackedReview: 0,
		over: 0,
		tagsOverCap: 0,
		exitDisabledReason: null,
		label: 'Instagram',
		cap: 5,
		limit: 2200
	};
	const profile = 'Add your full name in your profile so your disclosure can be added.';

	test('enabled with nothing to report', () => {
		expect(cardGate(base)).toBeNull();
	});

	test('reasons in UI-SPEC order, the profile reason last', () => {
		const all = { ...base, mustFix: 2, unackedReview: 1, over: 1234, tagsOverCap: 2 };
		expect(cardGate({ ...all, exitDisabledReason: profile })).toBe(blockReason(2));
		expect(cardGate({ ...all, mustFix: 0, exitDisabledReason: profile })).toBe(WARN_REASON);
		expect(cardGate({ ...all, mustFix: 0, unackedReview: 0, exitDisabledReason: profile })).toBe(
			"1,234 characters over Instagram's limit. Shorten the post to copy it."
		);
		expect(
			cardGate({ ...all, mustFix: 0, unackedReview: 0, over: 0, exitDisabledReason: profile })
		).toBe('Instagram uses up to 5 hashtags. Remove 2 to copy this post.');
		expect(cardGate({ ...base, exitDisabledReason: profile })).toBe(profile);
	});

	test('the Facebook hashtag reason uses its own cap', () => {
		expect(cardGate({ ...base, label: 'Facebook', cap: 2, tagsOverCap: 3 })).toBe(
			'Facebook uses up to 2 hashtags. Remove 3 to copy this post.'
		);
	});
});

describe('pack announcement', () => {
	test('every card ready on the keyless sample', () => {
		expect(packAnnouncement(SPECS, PACK)).toBe(
			'Post pack ready. Instagram: ready to copy. Facebook: ready to copy. LinkedIn: ready to copy.'
		);
	});

	test('to fix, over the limit, and a missing section announced once', () => {
		const long = sampleSocialPack({
			...INPUTS,
			brief: 'A fenced garden and new counters. '.repeat(70)
		});
		const text = long
			.replace(/=== FACEBOOK ===[\s\S]*?(?==== LINKEDIN ===)/, '')
			.replace('=== LINKEDIN ===\n', '=== LINKEDIN ===\nPerfect for young professionals. ');
		expect(packAnnouncement(SPECS, text)).toBe(
			"Post pack ready. Instagram: over the limit. LinkedIn: 1 to fix. The Facebook post didn't come through."
		);
	});
});

describe('disclosure-last property (Pitfall 2)', () => {
	// Deterministic LCG so a failure is reproducible.
	function rng(seed: number) {
		let s = seed >>> 0;
		return () => {
			s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
			return s / 2 ** 32;
		};
	}
	const WORDS = ['kitchen', 'garden', 'light', 'porch', 'open', 'house', 'Saturday', '2'];

	test('300 random sections: the copy payload is the assembled post and ends with the disclosure', () => {
		const rand = rng(0x5eed);
		for (let i = 0; i < 300; i++) {
			const key = KEYS[Math.floor(rand() * 3)]!;
			const disclosure = rand() < 0.1 ? 'Short Realty' : DISCLOSURE;
			const s = spec(key, disclosure);
			const len = Math.floor(rand() * 70_001);
			let body = '';
			while (body.length < len) body += `${WORDS[Math.floor(rand() * WORDS.length)]} `;
			body = body.slice(0, len);
			const tagCount = Math.floor(rand() * 9);
			const tags = Array.from({ length: tagCount }, (_, n) => `#Tag${n}`).join(' ');
			const text = tags === '' ? body : `${body}\n\n${tags}`;
			const a = s.assemble(text);
			expect(a.text.endsWith(s.emailFooter.text), `iteration ${i}`).toBe(true);
			expect(cardPayload(s, text)).toBe(a.text);
			expect(a.length).toBe(a.text.length);
			expect(a.over).toBe(Math.max(0, a.text.length - a.limit));
		}
	});
});

describe('copied platforms (Draft history row extra)', () => {
	test('withCopied keeps card order and no repeats', () => {
		expect(COPIED_META_KEY).toBe('copied');
		expect(withCopied(undefined, 'linkedin')).toBe('linkedin');
		expect(withCopied('linkedin', 'instagram')).toBe('instagram,linkedin');
		expect(withCopied('instagram,linkedin', 'linkedin')).toBe('instagram,linkedin');
		expect(withCopied('bogus', 'facebook')).toBe('facebook');
	});

	test('copiedNote: "Copied: Instagram, LinkedIn" or null', () => {
		expect(copiedNote({ copied: 'instagram,linkedin' }, PLATFORM_LABELS)).toBe(
			'Copied: Instagram, LinkedIn'
		);
		expect(copiedNote({ copied: '' }, PLATFORM_LABELS)).toBeNull();
		expect(copiedNote(undefined, PLATFORM_LABELS)).toBeNull();
		expect(copiedNote({ analysisHash: 'x' }, PLATFORM_LABELS)).toBeNull();
	});
});
