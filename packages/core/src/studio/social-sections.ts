/**
 * Social post pack (STU-02): one generation, three platform sections.
 *
 * The model writes plain text separated by `=== PLATFORM ===` marker lines. This module
 * splits that text into Instagram, Facebook and LinkedIn sections. A missing or empty
 * section is an explicit per-platform error so the UI never shows a silent empty card.
 * Prose before the first marker is ignored.
 *
 * Hashtag candidates come only from the place the agent typed, the property type and
 * generic real-estate tags. They never describe people.
 */

/** Local platform union; structurally identical to `Platform` in disclosure-format.ts. */
type SocialPlatform = 'instagram' | 'facebook' | 'linkedin';

export const SOCIAL_MARKERS = {
	instagram: 'INSTAGRAM',
	instagramHashtags: 'INSTAGRAM HASHTAGS',
	facebook: 'FACEBOOK',
	linkedin: 'LINKEDIN'
} as const;

export type SocialSection =
	{ ok: true; body: string; tags: string[] } | { ok: false; reason: 'missing' | 'empty' };

export interface SocialPack {
	instagram: SocialSection;
	facebook: SocialSection;
	linkedin: SocialSection;
	/** While streaming: the platform whose section is arriving. Otherwise null. */
	active: SocialPlatform | null;
}

type MarkerKey = keyof typeof SOCIAL_MARKERS;

/** The longer INSTAGRAM HASHTAGS alternative is tried first. */
const MARKER_RE =
	/^[ \t]*={3}[ \t]*(INSTAGRAM[ \t]+HASHTAGS|INSTAGRAM|FACEBOOK|LINKEDIN)[ \t]*={3}[ \t]*\r?$/gim;

function markerKey(label: string): MarkerKey {
	const norm = label.toUpperCase().replace(/[ \t]+/g, ' ');
	if (norm === SOCIAL_MARKERS.instagramHashtags) return 'instagramHashtags';
	if (norm === SOCIAL_MARKERS.instagram) return 'instagram';
	if (norm === SOCIAL_MARKERS.facebook) return 'facebook';
	return 'linkedin';
}

function platformOf(key: MarkerKey): SocialPlatform {
	return key === 'instagramHashtags' ? 'instagram' : key;
}

/** '#A #B, #C' -> ['#A', '#B', '#C']; bare '#' and non-hash words are dropped; deduplicated. */
export function parseHashtagLine(line: string): string[] {
	const out: string[] = [];
	for (const token of line.split(/[\s,;]+/)) {
		if (!token.startsWith('#')) continue;
		const rest = token.slice(1).replace(/[^\p{L}\p{N}_]/gu, '');
		if (rest === '') continue;
		const tag = `#${rest}`;
		if (!out.includes(tag)) out.push(tag);
	}
	return out;
}

/** A line made only of hashtags (at least one real tag). */
function isHashtagOnlyLine(line: string): boolean {
	const tokens = line.split(/[\s,;]+/).filter((t) => t !== '');
	if (tokens.length === 0) return false;
	if (!tokens.every((t) => t.startsWith('#'))) return false;
	return parseHashtagLine(line).length > 0;
}

/** Splits trailing hashtag-only lines off a body. The body is trimmed, never shortened otherwise. */
export function splitTrailingHashtags(body: string): { body: string; tags: string[] } {
	const lines = body.trimEnd().split(/\r?\n/);
	const tagLines: string[] = [];
	while (lines.length > 0) {
		const last = lines[lines.length - 1] ?? '';
		if (last.trim() === '' && tagLines.length > 0) {
			lines.pop();
			continue;
		}
		if (!isHashtagOnlyLine(last)) break;
		tagLines.unshift(last);
		lines.pop();
	}
	const tags: string[] = [];
	for (const line of tagLines) {
		for (const tag of parseHashtagLine(line)) if (!tags.includes(tag)) tags.push(tag);
	}
	return { body: lines.join('\n').trim(), tags };
}

function toSection(raw: string | undefined, explicitTags?: string[]): SocialSection {
	if (raw === undefined) return { ok: false, reason: 'missing' };
	const split = splitTrailingHashtags(raw);
	if (split.body === '') return { ok: false, reason: 'empty' };
	return { ok: true, body: split.body, tags: explicitTags ?? split.tags };
}

export function parseSocialPack(text: string, opts?: { streaming?: boolean }): SocialPack {
	const raw: Partial<Record<MarkerKey, string>> = {};
	const re = new RegExp(MARKER_RE.source, MARKER_RE.flags);
	const found: { key: MarkerKey; start: number; end: number }[] = [];
	for (let m = re.exec(text); m !== null; m = re.exec(text)) {
		found.push({ key: markerKey(m[1] ?? ''), start: m.index, end: m.index + m[0].length });
		if (m[0].length === 0) re.lastIndex += 1;
	}
	found.forEach((marker, i) => {
		if (raw[marker.key] !== undefined) return; // first occurrence wins
		const next = found[i + 1];
		raw[marker.key] = text.slice(marker.end, next ? next.start : text.length);
	});

	const igTags =
		raw.instagramHashtags === undefined ? undefined : parseHashtagLine(raw.instagramHashtags);
	const lastMarker = found[found.length - 1];
	return {
		instagram: toSection(raw.instagram, igTags),
		facebook: toSection(raw.facebook),
		linkedin: toSection(raw.linkedin),
		active: opts?.streaming && lastMarker ? platformOf(lastMarker.key) : null
	};
}

export type SocialPostType =
	'just-listed' | 'open-house' | 'price-change' | 'market-update' | 'other';

const POST_TYPE_TAGS: Record<SocialPostType, string | null> = {
	'just-listed': '#JustListed',
	'open-house': '#OpenHouse',
	'price-change': '#PriceImprovement',
	'market-update': '#MarketUpdate',
	other: null
};

const APOSTROPHES = new RegExp(`['${String.fromCharCode(0x2019)}]`, 'g');

/** Words -> PascalCase with apostrophes removed and all other non-alphanumerics as separators. */
function pascal(text: string): string {
	return text
		.replace(APOSTROPHES, '')
		.split(/[^A-Za-z0-9]+/)
		.filter((w) => w !== '')
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join('');
}

function propertyTag(propertyType: string): string | null {
	const key = propertyType.toLowerCase().replace(/[^a-z0-9]/g, '');
	if (key === '') return null;
	if (key === 'singlefamily' || key === 'singlefamilyhome') return '#SingleFamilyHome';
	if (key === 'multifamily') return '#MultiFamily';
	return `#${pascal(propertyType)}`;
}

/**
 * Hashtag candidates in a fixed order: post type, `#{Area}RealEstate`, `#{Area}`,
 * property type, `#RealEstate`. Inputs are places and property kinds only, never people.
 */
export function buildHashtagCandidates(input: {
	cityOrArea: string;
	propertyType?: string;
	postType: SocialPostType;
}): string[] {
	const out: string[] = [];
	const push = (tag: string | null) => {
		if (tag !== null && tag.length > 1 && !out.includes(tag)) out.push(tag);
	};
	push(POST_TYPE_TAGS[input.postType]);
	const area = pascal(input.cityOrArea);
	if (area !== '') {
		push(`#${area}RealEstate`);
		push(`#${area}`);
	}
	push(propertyTag(input.propertyType ?? ''));
	push('#RealEstate');
	return out;
}
