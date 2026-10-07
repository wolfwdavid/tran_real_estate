/**
 * Founder-story reel script (STU-03): parser, code-owned timing, results rule, quote
 * detection and the copied-script format.
 *
 * The model writes six readable blocks in a fixed order, each starting with its label
 * on its own line (HOOK, MANUAL PAIN, BEFORE AND AFTER, RESULTS, MISSION, CALL TO ACTION)
 * and carrying `Voiceover:`, `Caption:` and `B-roll:` lines. The model never writes times:
 * every start and end second comes from REEL_TEMPLATES. Overruns and long caption lines
 * produce notes; text is never shortened.
 */

export type ReelLength = 30 | 60;
export type BeatKey = 'hook' | 'pain' | 'before_after' | 'results' | 'mission' | 'cta';

export const BEAT_KEYS: readonly BeatKey[] = [
	'hook',
	'pain',
	'before_after',
	'results',
	'mission',
	'cta'
] as const;

/** Labels the model writes and the copied script uses. */
export const BEAT_OUTPUT_LABELS: Record<BeatKey, string> = {
	hook: 'HOOK',
	pain: 'MANUAL PAIN',
	before_after: 'BEFORE AND AFTER',
	results: 'RESULTS',
	mission: 'MISSION',
	cta: 'CALL TO ACTION'
};

/** Display names for the UI. */
export const BEAT_NAMES: Record<BeatKey, string> = {
	hook: 'Hook',
	pain: 'Manual pain',
	before_after: 'Before and after',
	results: 'Results',
	mission: 'Mission',
	cta: 'Call to action'
};

/** [beat, startSec, endSec]: contiguous, hook always 0-3, last beat ends at the reel length. */
export const REEL_TEMPLATES: Record<ReelLength, readonly (readonly [BeatKey, number, number])[]> = {
	30: [
		['hook', 0, 3],
		['pain', 3, 8],
		['before_after', 8, 15],
		['results', 15, 21],
		['mission', 21, 26],
		['cta', 26, 30]
	],
	60: [
		['hook', 0, 3],
		['pain', 3, 12],
		['before_after', 12, 25],
		['results', 25, 40],
		['mission', 40, 52],
		['cta', 52, 60]
	]
};

/** About 150 words per minute of conversational voiceover. */
export const WORDS_PER_SECOND = 2.5;
/** On-screen caption convention: at most 42 characters per line. */
export const CAPTION_LINE_MAX = 42;
/** The literal the results beat must carry when the agent typed no results. */
export const RESULTS_PLACEHOLDER = '[Add a real result you can document]';

/** 3 -> '0:03', 60 -> '1:00'. */
export function formatTime(s: number): string {
	const total = Math.max(0, Math.round(s));
	const minutes = Math.floor(total / 60);
	const seconds = total % 60;
	return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** '0:00 to 0:03'. */
export function formatSlot(start: number, end: number): string {
	return `${formatTime(start)} to ${formatTime(end)}`;
}

export function estimateSpokenSeconds(vo: string): number {
	const words = vo
		.trim()
		.split(/\s+/)
		.filter((w) => w !== '').length;
	return words / WORDS_PER_SECOND;
}

export interface ParsedBeat {
	key: BeatKey;
	voiceover: string;
	caption: string;
	broll: string;
	/** Offsets of the beat block (label line through the text before the next label). */
	start: number;
	end: number;
}

export type ReelParse =
	| { ok: true; beats: ParsedBeat[] }
	| { ok: false; reason: 'missing-beats' | 'out-of-order'; missing: BeatKey[] };

const LABEL_RE =
	/^[ \t]*(HOOK|MANUAL[ \t]+PAIN|BEFORE[ \t]+AND[ \t]+AFTER|RESULTS|MISSION|CALL[ \t]+TO[ \t]+ACTION)[ \t]*:?[ \t]*\r?$/gim;

const FIELD_RE = /^[ \t]*(voiceover|caption|b-?[ \t]?roll)[ \t]*:[ \t]*(.*)$/i;

const LABEL_TO_KEY: Record<string, BeatKey> = {
	HOOK: 'hook',
	'MANUAL PAIN': 'pain',
	'BEFORE AND AFTER': 'before_after',
	RESULTS: 'results',
	MISSION: 'mission',
	'CALL TO ACTION': 'cta'
};

interface LabelHit {
	key: BeatKey;
	/** Start of the label line. */
	start: number;
	/** End of the label line (block body starts here). */
	bodyStart: number;
	/** Start of the next label line, or the end of the text. */
	end: number;
}

function findLabels(text: string): LabelHit[] {
	const re = new RegExp(LABEL_RE.source, LABEL_RE.flags);
	const hits: { key: BeatKey; start: number; bodyStart: number }[] = [];
	for (let m = re.exec(text); m !== null; m = re.exec(text)) {
		const norm = (m[1] ?? '').toUpperCase().replace(/[ \t]+/g, ' ');
		const key = LABEL_TO_KEY[norm];
		if (key !== undefined) hits.push({ key, start: m.index, bodyStart: m.index + m[0].length });
		if (m[0].length === 0) re.lastIndex += 1;
	}
	return hits.map((h, i) => ({ ...h, end: hits[i + 1]?.start ?? text.length }));
}

type FieldName = 'voiceover' | 'caption' | 'broll';

function fieldName(raw: string): FieldName {
	const lower = raw.toLowerCase();
	if (lower === 'voiceover') return 'voiceover';
	if (lower === 'caption') return 'caption';
	return 'broll';
}

/** Field lines may come in any order; non-field lines right after a field continue it. */
function parseFields(body: string): Record<FieldName, string> {
	const out: Record<FieldName, string[]> = { voiceover: [], caption: [], broll: [] };
	let current: FieldName | null = null;
	for (const rawLine of body.split(/\r?\n/)) {
		const m = FIELD_RE.exec(rawLine);
		if (m) {
			current = fieldName(m[1] ?? '');
			out[current] = [(m[2] ?? '').trim()];
			continue;
		}
		const line = rawLine.trim();
		if (line === '') {
			current = null;
			continue;
		}
		if (current !== null) out[current].push(line);
	}
	return {
		voiceover: out.voiceover.join('\n').trim(),
		caption: out.caption.join('\n').trim(),
		broll: out.broll.join('\n').trim()
	};
}

export function parseReel(text: string): ReelParse {
	const firstByKey = new Map<BeatKey, LabelHit>();
	const order: BeatKey[] = [];
	for (const hit of findLabels(text)) {
		if (firstByKey.has(hit.key)) continue;
		firstByKey.set(hit.key, hit);
		order.push(hit.key);
	}
	const missing = BEAT_KEYS.filter((k) => !firstByKey.has(k));
	if (missing.length > 0) return { ok: false, reason: 'missing-beats', missing };
	if (order.some((k, i) => k !== BEAT_KEYS[i])) {
		return { ok: false, reason: 'out-of-order', missing: [] };
	}
	const beats: ParsedBeat[] = [];
	for (const key of BEAT_KEYS) {
		const hit = firstByKey.get(key);
		if (!hit) continue;
		const fields = parseFields(text.slice(hit.bodyStart, hit.end));
		beats.push({ key, ...fields, start: hit.start, end: hit.end });
	}
	return { ok: true, beats };
}

export interface TimedBeat {
	key: BeatKey;
	name: string;
	startSec: number;
	endSec: number;
	slot: string;
	voiceover: string;
	caption: string;
	broll: string;
	/** Estimated seconds the voiceover runs past its slot, or null when it fits. */
	overrunSeconds: number | null;
	/** Caption lines longer than CAPTION_LINE_MAX (reported, never cut). */
	longCaptionLines: string[];
	isPlaceholder: boolean;
}

/** Times come only from REEL_TEMPLATES[length]; the model's text is carried through unchanged. */
export function timeBeats(beats: readonly ParsedBeat[], length: ReelLength): TimedBeat[] {
	return REEL_TEMPLATES[length].map(([key, startSec, endSec]) => {
		const beat = beats.find((b) => b.key === key);
		const voiceover = beat?.voiceover ?? '';
		const caption = beat?.caption ?? '';
		const broll = beat?.broll ?? '';
		const over = estimateSpokenSeconds(voiceover) - (endSec - startSec);
		const overrunSeconds = over > 0 ? Math.max(0.1, Math.round(over * 10) / 10) : null;
		const longCaptionLines = caption
			.split('\n')
			.map((l) => l.trim())
			.filter((l) => l.length > CAPTION_LINE_MAX);
		const isPlaceholder =
			key === 'results' &&
			(voiceover.includes(RESULTS_PLACEHOLDER) || caption.includes(RESULTS_PLACEHOLDER));
		return {
			key,
			name: BEAT_NAMES[key],
			startSec,
			endSec,
			slot: formatSlot(startSec, endSec),
			voiceover,
			caption,
			broll,
			overrunSeconds,
			longCaptionLines,
			isPlaceholder
		};
	});
}

export interface ResultsViolation {
	start: number;
	end: number;
	reason: 'placeholder-missing' | 'digits';
}

/**
 * With an empty results field the RESULTS beat must carry RESULTS_PLACEHOLDER and no digits.
 * Offsets are into `text`. With typed results this returns [] (the number check covers them).
 * A script with no RESULTS block returns [] here; parseReel reports it as missing.
 */
export function checkResultsBeat(text: string, resultsEmpty: boolean): ResultsViolation[] {
	if (!resultsEmpty) return [];
	const hit = findLabels(text).find((h) => h.key === 'results');
	if (!hit) return [];
	const body = text.slice(hit.bodyStart, hit.end);
	const out: ResultsViolation[] = [];
	if (!body.includes(RESULTS_PLACEHOLDER)) {
		const trimmedEnd = hit.bodyStart + body.trimEnd().length;
		out.push({ start: hit.start, end: trimmedEnd, reason: 'placeholder-missing' });
	}
	const digits = /\d+(?:[.,]\d+)*/g;
	for (let m = digits.exec(body); m !== null; m = digits.exec(body)) {
		const start = hit.bodyStart + m.index;
		out.push({ start, end: start + m[0].length, reason: 'digits' });
	}
	return out;
}

/** Curly double quotes, built from code points to keep this source ASCII. */
const LQ = String.fromCharCode(0x201c);
const RQ = String.fromCharCode(0x201d);

/** A straight or curly double-quoted span followed within 20 characters by an attribution verb. */
const QUOTE_RE = new RegExp(
	String.raw`["${LQ}][^"${LQ}${RQ}\n]{1,400}["${RQ}][^"${LQ}${RQ}\n]{0,20}?\b(?:said|says|told me|wrote)\b`,
	'gi'
);

/** Reported speech from clients or buyers, through the end of the sentence. */
const PHRASE_RE =
	/\b(?:my clients? (?:say|said|tell me)|a client (?:said|told me)|one buyer (?:said|told me))\b[^.!?\n]*[.!?]?/gi;

/** Quoted speech attributed to someone else, as merged, sorted ranges. */
export function findAttributedQuotes(text: string): { start: number; end: number }[] {
	const ranges: { start: number; end: number }[] = [];
	for (const source of [QUOTE_RE, PHRASE_RE]) {
		const re = new RegExp(source.source, source.flags);
		for (let m = re.exec(text); m !== null; m = re.exec(text)) {
			ranges.push({ start: m.index, end: m.index + m[0].length });
			if (m[0].length === 0) re.lastIndex += 1;
		}
	}
	ranges.sort((a, b) => a.start - b.start || a.end - b.end);
	const merged: { start: number; end: number }[] = [];
	for (const r of ranges) {
		const last = merged[merged.length - 1];
		if (last && r.start <= last.end) last.end = Math.max(last.end, r.end);
		else merged.push({ ...r });
	}
	return merged;
}

/**
 * Plain-text script for Copy: header, one block per beat with its code-owned slot,
 * the B-roll shot list with start times, then the fixed footer (disclosure + checklist) last.
 */
export function formatReelScript(
	timed: readonly TimedBeat[],
	length: ReelLength,
	footer: string
): string {
	const beatBlocks = timed.map((t) =>
		[
			`${t.slot} ${BEAT_OUTPUT_LABELS[t.key]}`,
			`Voiceover: ${t.voiceover}`,
			`Caption: ${t.caption}`,
			`B-roll: ${t.broll}`
		].join('\n')
	);
	const shots = timed
		.filter((t) => t.broll !== '')
		.map((t, i) => `${i + 1}. ${formatTime(t.startSec)} ${t.broll}`);
	const parts = [
		`REEL SCRIPT (${length} seconds)`,
		beatBlocks.join('\n\n'),
		['B-ROLL SHOT LIST', ...shots].join('\n')
	];
	const tail = footer.trim();
	if (tail !== '') parts.push(tail);
	return parts.join('\n\n');
}
