// SSR tests for the reel page pieces (09-22, STU-03): ReelBeatsForm, ReelScriptView and
// AiDisclosureChecklist, plus the sample beats. svelte/server renders each component to a string
// in the node project; $effect never runs in SSR, so the Fair Housing input note stays empty.
import { render } from 'svelte/server';
import type { Component } from 'svelte';
import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { RESULTS_PLACEHOLDER } from '@tran/core/studio';
import { sampleReel } from '$lib/ai/prompts/studio/reel.v1';
import { numberPostCheck, numberWordsPostCheck, reelAllowedNumbers } from '../post-checks';
import { SAMPLE_REEL_BEATS, SAMPLE_REEL_BEATS_NO_RESULTS } from '../fixtures/sample-reel-beats';
import AiDisclosureChecklist from './AiDisclosureChecklist.svelte';
import { REEL_CHECKLIST, REEL_CHECKLIST_FOOTNOTE } from './checklist';
import { quotePostCheck, resultsBeatPostCheck } from './reel-checks';
import ReelBeatsForm, {
	emptyReelForm,
	restoreReelForm,
	sameStory,
	validateReelForm,
	type ReelForm
} from './ReelBeatsForm.svelte';
import ReelScriptView, { scriptView } from './ReelScriptView.svelte';

const MID = String.fromCharCode(0xb7);

const strip = (h: string) => h.replace(/<!--[\s\S]*?-->/g, '');
const textOf = (h: string) =>
	strip(h)
		.replace(/<[^>]+>/g, ' ')
		.replace(/&#39;|&apos;/g, "'")
		.replace(/&quot;/g, '"')
		.replace(/&amp;/g, '&')
		.replace(/\s+/g, ' ')
		.trim();
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- each case passes its component's props
const html = <P extends Record<string, any>>(C: Component<P>, props: P) =>
	strip(render(C, { props }).body);

const form = (over: Partial<ReelForm> = {}): ReelForm => ({ ...SAMPLE_REEL_BEATS, ...over });

/** A hand-written six-block script; `over` replaces one block's lines by beat label. */
function script(over: Record<string, string> = {}): string {
	const blocks: [string, string][] = [
		[
			'HOOK',
			'Voiceover: I used to lose messages.\nCaption: I used to lose messages\nB-roll: Phone'
		],
		['MANUAL PAIN', 'Voiceover: Sticky notes.\nCaption: Sticky notes\nB-roll: Desk'],
		['BEFORE AND AFTER', 'Voiceover: One list now.\nCaption: One list now\nB-roll: Dashboard'],
		['RESULTS', 'Voiceover: Faster replies.\nCaption: Faster replies\nB-roll: Calendar'],
		['MISSION', 'Voiceover: Every client heard.\nCaption: Every client heard\nB-roll: Street'],
		['CALL TO ACTION', 'Voiceover: Send me a message.\nCaption: Send me a message\nB-roll: Agent']
	];
	return blocks.map(([label, body]) => `${label}\n${over[label] ?? body}`).join('\n\n');
}

describe('sample beats', () => {
	test('fictional, clean text: the keyless script has zero findings with and without results', () => {
		expect(SAMPLE_REEL_BEATS.results).toBe('Answered every inquiry within an hour last spring.');
		expect(SAMPLE_REEL_BEATS_NO_RESULTS.results).toBe('');
		for (const beats of [SAMPLE_REEL_BEATS, SAMPLE_REEL_BEATS_NO_RESULTS]) {
			for (const length of [30, 60] as const) {
				const text = sampleReel({ ...beats, length });
				const fields: Record<string, string> = { ...beats, length: '' };
				const checks = [
					numberPostCheck('reel', reelAllowedNumbers(fields)),
					resultsBeatPostCheck(!beats.results.trim()),
					numberWordsPostCheck(),
					quotePostCheck()
				];
				for (const check of checks) expect(check(text)).toEqual([]);
				expect(scriptView(text, length).kind).toBe('beats');
			}
		}
		expect(Object.keys(validateReelForm(form()))).toEqual([]);
	});
});

describe('ReelBeatsForm', () => {
	test('legend, length chips, six labelled beats with their 30-second slots, helpers', () => {
		const h = html(ReelBeatsForm, { form: emptyReelForm() });
		const t = textOf(h);
		expect(h).toMatch(/<legend[^>]*>Your story<\/legend>/);
		expect(h).toMatch(/<legend[^>]*>Reel length<\/legend>/);
		expect(h).toMatch(/<input[^>]*id="reel-length-30"[^>]*checked/);
		expect(t).toContain('30 seconds');
		expect(t).toContain('60 seconds');
		const labels = [
			'Hook (optional)',
			'The manual pain',
			'Before and after',
			'Your results (optional)',
			'Your mission',
			'Call to action'
		];
		const order = labels.map((l) => t.indexOf(l));
		expect(order.every((i) => i >= 0)).toBe(true);
		expect([...order].sort((a, b) => a - b)).toEqual(order);
		expect(h.match(/<textarea/g)).toHaveLength(6);
		const slots = [...h.matchAll(/data-reel-slot[^>]*>([^<]+)</g)].map((m) => m[1]);
		expect(slots).toEqual([
			'0:00 to 0:03',
			'0:03 to 0:08',
			'0:08 to 0:15',
			'0:15 to 0:21',
			'0:21 to 0:26',
			'0:26 to 0:30'
		]);
		expect(t).toContain('What was slow or frustrating before?');
		expect(t).toContain('Real outcomes you can show records for, like "Answered every inquiry');
		expect(t).toContain(
			"Only include results you can back up with records. Made-up or exaggerated results can break advertising rules, and Tran won't add any for you."
		);
		expect(t).toContain('0 of 300');
		expect(t).toContain('0 of 120');
		expect(h).toMatch(/maxlength="120"/);
	});

	test('60 seconds: Call to action shows 0:52 to 1:00', () => {
		const h = html(ReelBeatsForm, { form: form({ length: 60 }) });
		const slots = [...h.matchAll(/data-reel-slot[^>]*>([^<]+)</g)].map((m) => m[1]);
		expect(slots[0]).toBe('0:00 to 0:03');
		expect(slots[5]).toBe('0:52 to 1:00');
		expect(h).toMatch(/<input[^>]*id="reel-length-60"[^>]*checked/);
	});

	test('validation copy: four required beats and the length limits', () => {
		expect(validateReelForm(emptyReelForm())).toEqual({
			pain: 'Describe the manual pain.',
			beforeAfter: 'Describe the before and after.',
			mission: 'Describe your mission.',
			cta: 'Add a call to action.'
		});
		const long = validateReelForm(form({ hook: 'x'.repeat(301), cta: 'y'.repeat(121) }));
		expect(long.hook).toBe('Keep this under 300 characters.');
		expect(long.cta).toBe('Keep this under 120 characters.');
		expect(long.results).toBeUndefined();
	});

	test('restore ignores junk; the sample state ignores the length', () => {
		expect(restoreReelForm(JSON.parse(JSON.stringify(form())))).toEqual(form());
		expect(restoreReelForm(null)).toEqual(emptyReelForm());
		const junk = restoreReelForm({ length: 45, pain: 3, clientName: 'x', mission: 'Help.' });
		expect(junk).toEqual({ ...emptyReelForm(), mission: 'Help.' });
		expect(sameStory(form({ length: 60 }), SAMPLE_REEL_BEATS)).toBe(true);
		expect(sameStory(form({ results: '' }), SAMPLE_REEL_BEATS_NO_RESULTS)).toBe(true);
		expect(sameStory(form({ pain: 'Other.' }), SAMPLE_REEL_BEATS)).toBe(false);
	});
});

describe('ReelScriptView', () => {
	test('a parseable 30-second draft: heading, helper, table and stacked cards, B-roll list', () => {
		const draft = sampleReel(SAMPLE_REEL_BEATS);
		const h = html(ReelScriptView, { draft, length: 30 });
		const t = textOf(h);
		expect(h).toMatch(/<h2[^>]*>\s*Script at a glance\s*<\/h2>/);
		expect(t).toContain(
			'Built from the draft above, including your edits. Times are set by Tran for a 30-second reel.'
		);
		expect(h).toMatch(/<table/);
		expect(h).toMatch(/<caption[^>]*>30-second reel, 6 beats<\/caption>/);
		expect(h).toMatch(/tabindex="0"[^>]*aria-label="30-second reel, 6 beats"/);
		const cols = [...h.matchAll(/<th scope="col"[^>]*>\s*([^<]+?)\s*<\/th>/g)].map((m) => m[1]);
		expect(cols).toEqual(['Time', 'Beat', 'Voiceover', 'On-screen caption', 'B-roll']);
		const rows = [...h.matchAll(/<th scope="row"[^>]*>([^<]+)<\/th>/g)].map((m) => m[1]);
		expect(rows).toEqual([
			'Hook',
			'Manual pain',
			'Before and after',
			'Results',
			'Mission',
			'Call to action'
		]);
		const firstTime = h.match(/<tbody>\s*<tr[^>]*>\s*<td[^>]*>([^<]+)<\/td>/);
		expect(firstTime?.[1]).toBe('0:00 to 0:03');
		// The stacked variant is an <ol> with an h3 per beat; the CSS swap hides one variant.
		expect(h).toMatch(/<ol[^>]*lg:hidden[^>]*data-reel-cards/);
		expect(h).toMatch(/class="hidden[^"]*lg:block"/);
		expect(t).toContain(`Hook ${MID} 0:00 to 0:03`);
		expect(t).toContain(`Call to action ${MID} 0:26 to 0:30`);
		expect(h.match(/<dl/g)).toHaveLength(6);
		expect(h).toMatch(/<h3[^>]*>B-roll shot list<\/h3>/);
		const shots = h.match(/<ol[^>]*data-reel-shots[^>]*>[\s\S]*?<\/ol>/)?.[0] ?? '';
		expect(textOf(shots)).toMatch(/^0:00 Close-up of a phone/);
		expect(shots.match(/<li/g)).toHaveLength(6);
	});

	test('row notes: a 20-word hook overruns, a 43-character caption is long', () => {
		const twenty = Array.from({ length: 20 }, (_, i) => `word${i}`).join(' ');
		const caption = `Caption ${'x'.repeat(35)}`;
		expect(caption).toHaveLength(43);
		const draft = script({ HOOK: `Voiceover: ${twenty}\nCaption: ${caption}\nB-roll: Phone` });
		const t = textOf(html(ReelScriptView, { draft, length: 30 }));
		expect(t).toContain('The voiceover runs about 5 seconds long for this beat. Trim a few words.');
		expect(t).toContain(
			'This caption line has more than 42 characters, which can be hard to read on a phone.'
		);
	});

	test('the placeholder results beat shows the literal and its note', () => {
		const draft = sampleReel(SAMPLE_REEL_BEATS_NO_RESULTS);
		const h = html(ReelScriptView, { draft, length: 30 });
		expect(textOf(h)).toContain(RESULTS_PLACEHOLDER);
		expect(h).toContain(`<span class="font-semibold">${RESULTS_PLACEHOLDER}</span>`);
		expect(textOf(h)).toContain('Replace this with a real result before you record.');
		expect(textOf(html(ReelScriptView, { draft: script(), length: 30 }))).not.toContain(
			'Replace this with a real result'
		);
	});

	test('60 seconds retimes from code, whatever the draft says', () => {
		const draft = script({ HOOK: 'Voiceover: 0:00 to 0:09 Hi.\nCaption: Hi\nB-roll: Phone' });
		const h = html(ReelScriptView, { draft, length: 60 });
		expect(h).toContain('60-second reel, 6 beats');
		expect(textOf(h)).toContain(`Call to action ${MID} 0:52 to 1:00`);
		expect(textOf(h)).toContain(`Hook ${MID} 0:00 to 0:03`);
	});

	test('unparseable and empty drafts', () => {
		const bad = textOf(html(ReelScriptView, { draft: 'Just a paragraph.', length: 30 }));
		expect(bad).toContain("Tran couldn't split this script into beats");
		expect(bad).toContain('The script is still above, and you can copy it as is.');
		expect(bad).not.toContain('B-roll shot list');
		const empty = html(ReelScriptView, { draft: '', length: 30 });
		expect(textOf(empty)).toContain('The beat table appears here once a script is written.');
		expect(empty).not.toMatch(/<table/);
	});
});

describe('AiDisclosureChecklist', () => {
	test('heading, exactly 8 checkboxes in order, the footnote, no approval words', () => {
		const h = html(AiDisclosureChecklist, {});
		const t = textOf(h);
		expect(h).toMatch(/<h2[^>]*>\s*Before you post this video\s*<\/h2>/);
		expect(h.match(/type="checkbox"/g)).toHaveLength(8);
		const labels = [...h.matchAll(/<label[^>]*>([\s\S]*?)<\/label>/g)].map((m) => textOf(m[1]));
		expect(labels).toEqual([...REEL_CHECKLIST].map((s) => textOf(s)));
		expect(labels[1]).toContain(`General Business Law ${String.fromCharCode(0xa7)} 396-b`);
		expect(t).toContain(REEL_CHECKLIST_FOOTNOTE);
		expect(t).not.toMatch(/compliant|approved/i);
		expect(h).not.toMatch(/\bchecked\b/);
	});

	test('checkbox state is local: the component imports no storage', () => {
		const src = readFileSync(resolve(import.meta.dirname, 'AiDisclosureChecklist.svelte'), 'utf8');
		expect(src).not.toMatch(/storage|Dexie|localStorage/);
	});
});
