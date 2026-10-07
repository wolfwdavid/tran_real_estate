import { describe, expect, test } from 'vitest';

import {
	BEAT_KEYS,
	BEAT_NAMES,
	BEAT_OUTPUT_LABELS,
	CAPTION_LINE_MAX,
	REEL_TEMPLATES,
	RESULTS_PLACEHOLDER,
	WORDS_PER_SECOND,
	checkResultsBeat,
	estimateSpokenSeconds,
	findAttributedQuotes,
	formatReelScript,
	formatSlot,
	formatTime,
	parseReel,
	timeBeats,
	type ParsedBeat,
	type ReelLength
} from './reel.js';

interface BlockSpec {
	label: string;
	vo: string;
	caption: string;
	broll: string;
}

const SPECS: BlockSpec[] = [
	{ label: 'HOOK', vo: 'I used to do this by hand.', caption: 'By hand', broll: 'Desk of papers' },
	{
		label: 'MANUAL PAIN',
		vo: 'Hours of spreadsheets every night.',
		caption: 'Hours lost',
		broll: 'Laptop at night'
	},
	{
		label: 'BEFORE AND AFTER',
		vo: 'Now the follow-ups write themselves.',
		caption: 'Before and after',
		broll: 'Split screen'
	},
	{
		label: 'RESULTS',
		vo: RESULTS_PLACEHOLDER,
		caption: RESULTS_PLACEHOLDER,
		broll: 'Smiling at the desk'
	},
	{
		label: 'MISSION',
		vo: 'I want every client to feel heard.',
		caption: 'Heard',
		broll: 'Walking a street'
	},
	{
		label: 'CALL TO ACTION',
		vo: 'Send me a message today.',
		caption: 'Message me',
		broll: 'Phone in hand'
	}
];

function block(spec: BlockSpec, labelOverride?: string): string {
	return [
		labelOverride ?? spec.label,
		`Voiceover: ${spec.vo}`,
		`Caption: ${spec.caption}`,
		`B-roll: ${spec.broll}`
	].join('\n');
}

function script(specs: BlockSpec[] = SPECS): string {
	return specs.map((s) => block(s)).join('\n\n');
}

function parsedOk(text: string): ParsedBeat[] {
	const r = parseReel(text);
	if (!r.ok) throw new Error(`parse failed: ${r.reason}`);
	return r.beats;
}

describe('constants', () => {
	test('labels, names and rates', () => {
		expect(BEAT_KEYS).toEqual(['hook', 'pain', 'before_after', 'results', 'mission', 'cta']);
		expect(BEAT_OUTPUT_LABELS).toEqual({
			hook: 'HOOK',
			pain: 'MANUAL PAIN',
			before_after: 'BEFORE AND AFTER',
			results: 'RESULTS',
			mission: 'MISSION',
			cta: 'CALL TO ACTION'
		});
		expect(BEAT_NAMES).toEqual({
			hook: 'Hook',
			pain: 'Manual pain',
			before_after: 'Before and after',
			results: 'Results',
			mission: 'Mission',
			cta: 'Call to action'
		});
		expect(WORDS_PER_SECOND).toBe(2.5);
		expect(CAPTION_LINE_MAX).toBe(42);
		expect(RESULTS_PLACEHOLDER).toBe('[Add a real result you can document]');
	});

	test('exact templates', () => {
		expect(REEL_TEMPLATES[30]).toEqual([
			['hook', 0, 3],
			['pain', 3, 8],
			['before_after', 8, 15],
			['results', 15, 21],
			['mission', 21, 26],
			['cta', 26, 30]
		]);
		expect(REEL_TEMPLATES[60]).toEqual([
			['hook', 0, 3],
			['pain', 3, 12],
			['before_after', 12, 25],
			['results', 25, 40],
			['mission', 40, 52],
			['cta', 52, 60]
		]);
	});

	test.each([30, 60] as const)('template %i is contiguous, hook 0-3, ends at length', (length) => {
		const tpl = REEL_TEMPLATES[length];
		expect(tpl.map(([k]) => k)).toEqual([...BEAT_KEYS]);
		expect(tpl[0]?.[1]).toBe(0);
		expect(tpl[0]?.[2]).toBe(3);
		expect(tpl[tpl.length - 1]?.[2]).toBe(length);
		for (let i = 1; i < tpl.length; i += 1) {
			expect(tpl[i]?.[1]).toBe(tpl[i - 1]?.[2]);
			expect((tpl[i]?.[2] ?? 0) > (tpl[i]?.[1] ?? 0)).toBe(true);
		}
	});
});

describe('time formatting', () => {
	test('formatTime and formatSlot', () => {
		expect(formatTime(0)).toBe('0:00');
		expect(formatTime(3)).toBe('0:03');
		expect(formatTime(26)).toBe('0:26');
		expect(formatTime(60)).toBe('1:00');
		expect(formatSlot(0, 3)).toBe('0:00 to 0:03');
		expect(formatSlot(52, 60)).toBe('0:52 to 1:00');
	});

	test('estimateSpokenSeconds at 2.5 words per second', () => {
		expect(estimateSpokenSeconds('one two three four five')).toBe(2);
		expect(estimateSpokenSeconds('   ')).toBe(0);
	});
});

describe('parseReel', () => {
	test('six blocks parse in order with their fields', () => {
		const beats = parsedOk(script());
		expect(beats.map((b) => b.key)).toEqual([...BEAT_KEYS]);
		expect(beats[0]).toMatchObject({
			key: 'hook',
			voiceover: 'I used to do this by hand.',
			caption: 'By hand',
			broll: 'Desk of papers'
		});
	});

	test('labels are case-insensitive and fields may come in any order', () => {
		const text = [
			'Here is your script.',
			'Hook:',
			'Caption: By hand',
			'B-roll: Desk',
			'Voiceover: I used to do this by hand.',
			'Manual Pain',
			'Voiceover: Hours.',
			'Caption: Hours',
			'B-roll: Laptop',
			'before and after',
			'Voiceover: Now.',
			'Caption: Now',
			'B-roll: Split',
			'Results',
			`Voiceover: ${RESULTS_PLACEHOLDER}`,
			`Caption: ${RESULTS_PLACEHOLDER}`,
			'B-roll: Desk',
			'MISSION',
			'Voiceover: Heard.',
			'Caption: Heard',
			'B-roll: Street',
			'Call to Action',
			'Voiceover: Message me.',
			'Caption: Message',
			'B-roll: Phone'
		].join('\r\n');
		const beats = parsedOk(text);
		expect(beats.map((b) => b.key)).toEqual([...BEAT_KEYS]);
		expect(beats[0]).toMatchObject({
			voiceover: 'I used to do this by hand.',
			caption: 'By hand',
			broll: 'Desk'
		});
		expect(beats[1]?.key).toBe('pain');
	});

	test('beat offsets cover the block in the source text', () => {
		const text = script();
		const beats = parsedOk(text);
		const hook = beats[0];
		expect(hook && text.slice(hook.start, hook.end).startsWith('HOOK')).toBe(true);
		const cta = beats[5];
		expect(cta?.end).toBe(text.length);
	});

	test('a missing RESULTS block is missing-beats', () => {
		const specs = SPECS.filter((s) => s.label !== 'RESULTS');
		expect(parseReel(script(specs))).toEqual({
			ok: false,
			reason: 'missing-beats',
			missing: ['results']
		});
	});

	test('blocks out of order are out-of-order', () => {
		const specs = [...SPECS];
		const a = specs[1];
		const b = specs[2];
		if (!a || !b) throw new Error('fixture');
		specs[1] = b;
		specs[2] = a;
		const r = parseReel(script(specs));
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.reason).toBe('out-of-order');
	});
});

describe('timeBeats', () => {
	test('30-second slots come from the template', () => {
		const timed = timeBeats(parsedOk(script()), 30);
		expect(timed.map((t) => t.slot)).toEqual([
			'0:00 to 0:03',
			'0:03 to 0:08',
			'0:08 to 0:15',
			'0:15 to 0:21',
			'0:21 to 0:26',
			'0:26 to 0:30'
		]);
		expect(timed[0]).toMatchObject({ key: 'hook', name: 'Hook', startSec: 0, endSec: 3 });
		expect(timed[3]?.isPlaceholder).toBe(true);
		expect(timed[0]?.isPlaceholder).toBe(false);
	});

	test('60-second slots end at 1:00', () => {
		const timed = timeBeats(parsedOk(script()), 60);
		expect(timed[5]?.slot).toBe('0:52 to 1:00');
	});

	test('voiceover overrun is a note and the text is never shortened', () => {
		const twenty = Array.from({ length: 20 }, (_, i) => `w${i}`).join(' ');
		const specs = SPECS.map((s, i) => (i === 0 ? { ...s, vo: twenty } : s));
		const timed = timeBeats(parsedOk(script(specs)), 30);
		expect(timed[0]?.overrunSeconds).toBe(5);
		expect(timed[0]?.voiceover).toBe(twenty);
		expect(timed[1]?.overrunSeconds).toBeNull();
	});

	test('caption lines over 42 characters are listed, not cut', () => {
		const long = 'x'.repeat(43);
		const specs = SPECS.map((s, i) => (i === 2 ? { ...s, caption: long } : s));
		const timed = timeBeats(parsedOk(script(specs)), 30);
		expect(timed[2]?.longCaptionLines).toEqual([long]);
		expect(timed[2]?.caption).toBe(long);
		expect(timed[0]?.longCaptionLines).toEqual([]);
		const exact = 'y'.repeat(42);
		const ok = timeBeats(
			parsedOk(script(SPECS.map((s, i) => (i === 2 ? { ...s, caption: exact } : s)))),
			30
		);
		expect(ok[2]?.longCaptionLines).toEqual([]);
	});

	test('times ignore anything the model wrote', () => {
		const specs = SPECS.map((s, i) => (i === 0 ? { ...s, vo: '0:00 to 0:09 Hi there.' } : s));
		const timed = timeBeats(parsedOk(script(specs)), 30);
		expect(timed[0]?.endSec).toBe(3);
	});
});

describe('checkResultsBeat', () => {
	test('placeholder present and no digits is clean', () => {
		expect(checkResultsBeat(script(), true)).toEqual([]);
	});

	test("'47 families' in the results beat is a digits violation over '47'", () => {
		const specs = SPECS.map((s) =>
			s.label === 'RESULTS' ? { ...s, vo: `${RESULTS_PLACEHOLDER} We helped 47 families.` } : s
		);
		const text = script(specs);
		const v = checkResultsBeat(text, true);
		expect(v).toHaveLength(1);
		expect(v[0]?.reason).toBe('digits');
		expect(text.slice(v[0]?.start, v[0]?.end)).toBe('47');
	});

	test('a results beat without the placeholder is placeholder-missing', () => {
		const specs = SPECS.map((s) =>
			s.label === 'RESULTS' ? { ...s, vo: 'We helped many families.', caption: 'Many families' } : s
		);
		const v = checkResultsBeat(script(specs), true);
		expect(v.map((x) => x.reason)).toEqual(['placeholder-missing']);
	});

	test('digits elsewhere in the script are not results violations', () => {
		const specs = SPECS.map((s) => (s.label === 'HOOK' ? { ...s, vo: 'In 2019 I started.' } : s));
		expect(checkResultsBeat(script(specs), true)).toEqual([]);
	});

	test('typed results turn the rule off', () => {
		const specs = SPECS.map((s) =>
			s.label === 'RESULTS' ? { ...s, vo: 'We closed 12 homes.', caption: '12 homes' } : s
		);
		expect(checkResultsBeat(script(specs), false)).toEqual([]);
		expect(checkResultsBeat('anything at all 99', false)).toEqual([]);
	});
});

describe('findAttributedQuotes', () => {
	test('a quote followed by said is one range', () => {
		const text = '"Best agent ever," said Maria.';
		const r = findAttributedQuotes(text);
		expect(r).toHaveLength(1);
		expect(text.slice(r[0]?.start, r[0]?.end)).toContain('Best agent ever');
	});

	test("'My clients say I answer fast.' is one range", () => {
		expect(findAttributedQuotes('My clients say I answer fast.')).toHaveLength(1);
	});

	test('other attribution phrases', () => {
		expect(findAttributedQuotes('A client told me it was easy.')).toHaveLength(1);
		expect(findAttributedQuotes('One buyer said the tour helped.')).toHaveLength(1);
		const curly = String.fromCharCode(0x201c) + 'So easy' + String.fromCharCode(0x201d);
		expect(findAttributedQuotes(`${curly} she wrote.`)).toHaveLength(1);
	});

	test('a curly quote with no attribution is not flagged', () => {
		const text = String.fromCharCode(0x201c) + 'Call me today.' + String.fromCharCode(0x201d);
		expect(findAttributedQuotes(text)).toEqual([]);
		expect(findAttributedQuotes('I answer fast.')).toEqual([]);
	});
});

describe('formatReelScript', () => {
	const lengths: ReelLength[] = [30, 60];
	test.each(lengths)('%i-second copied script layout', (length) => {
		const timed = timeBeats(parsedOk(script()), length);
		const out = formatReelScript(timed, length, 'FOOTER');
		expect(out.startsWith(`REEL SCRIPT (${length} seconds)\n`)).toBe(true);
		for (const t of timed) {
			expect(out).toContain(
				`${t.slot} ${BEAT_OUTPUT_LABELS[t.key]}\nVoiceover: ${t.voiceover}\nCaption: ${t.caption}\nB-roll: ${t.broll}`
			);
		}
		expect(out).toContain('\n\nB-ROLL SHOT LIST\n1. 0:00 Desk of papers\n');
		expect(out).toContain(`6. ${formatTime(timed[5]?.startSec ?? 0)} Phone in hand`);
		expect(out.endsWith('\n\nFOOTER')).toBe(true);
	});
});
