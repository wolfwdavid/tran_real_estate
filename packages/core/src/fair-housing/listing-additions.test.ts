import { describe, expect, test } from 'vitest';

import { checkFairHousing } from './check.js';
import { LEXICON } from './lexicon.js';
import { BAD_PHRASES, NEUTRAL_PHRASES } from './suite.js';
import { CATEGORY_LABELS, type LexiconEntry, type Severity } from './types.js';

/**
 * Phase 9 (content studio) additions: listing-copy hot spots, hashtag forms and
 * the advertising category (09-RESEARCH section E and A.5).
 */

/** Must yield a Must fix finding. */
const BAD_BLOCK: readonly string[] = [
	'perfect for young professionals',
	'ideal for families',
	'great for retirees',
	'perfect for empty nesters',
	'no children',
	'adults only',
	'mature couple',
	'Christian community',
	'Jewish neighborhood',
	'no wheelchairs',
	'must be able to climb stairs',
	'not suitable for handicapped',
	'English only',
	'Hispanic neighborhood',
	'no Section 8',
	'no vouchers',
	'professionals only',
	'guaranteed to appreciate',
	'guaranteed return',
	"can't lose",
	'will appreciate',
	'family-friendly neighborhood'
];

/** Must yield a Review finding (and nothing that blocks). */
const BAD_WARN: readonly string[] = [
	'family-friendly',
	'#FamilyHome',
	'#FamilyFriendly',
	'kid-friendly',
	'safe neighborhood',
	'#SafeNeighborhood',
	'low crime',
	'crime-free',
	'up-and-coming',
	'gentrifying',
	'exclusive community',
	'private community',
	'restricted community',
	'great schools',
	'top-rated schools',
	'walking distance to church',
	'bachelor pad',
	'man cave',
	'55+ community',
	'senior community',
	'active adult community',
	'#1 agent',
	'top producer',
	'best investment'
];

/** Achtenberg memo safe-harbor phrases and accessibility features: zero findings. */
const NEUTRAL: readonly string[] = [
	'master bedroom',
	'family room',
	'walk-in closet',
	'walk to bus stop',
	'walk to transit',
	'quiet street',
	'cozy',
	'desirable neighborhood',
	'rare find',
	'wheelchair accessible entrance',
	'step-free entry',
	'great view',
	'fourth-floor walk-up',
	'jogging trails',
	'two bedroom',
	'near Riverside Park',
	'in-law suite',
	'gated entry',
	'Equal Housing Opportunity',
	'single-family home',
	'Buyers will appreciate the updated kitchen'
];

const severityOf = (text: string, lexicon: readonly LexiconEntry[] = LEXICON): Severity | null => {
	const findings = checkFairHousing(text, lexicon);
	if (findings.length === 0) return null;
	return findings.some((f) => f.severity === 'block') ? 'block' : 'warn';
};

const EXPECTED: ReadonlyArray<readonly [string, Severity]> = [
	...BAD_BLOCK.map((t) => [t, 'block'] as const),
	...BAD_WARN.map((t) => [t, 'warn'] as const)
];

/** True when every BAD phrase gets its expected severity from `lexicon`. */
const missedBy = (lexicon: readonly LexiconEntry[]): string[] =>
	EXPECTED.filter(([text, sev]) => severityOf(text, lexicon) !== sev).map(([text]) => text);

const ADDED = LEXICON.filter((e) => e.phase === 9);

describe('Phase 9 bad phrases', () => {
	test('at least 20 new bad phrases across both severities', () => {
		expect(BAD_BLOCK.length + BAD_WARN.length).toBeGreaterThanOrEqual(40);
	});

	test.each(BAD_BLOCK)('"%s" must be fixed', (text) => {
		expect(severityOf(text)).toBe('block');
		expect(severityOf(`Sunny two bedroom, ${text}. Call today.`)).toBe('block');
	});

	test.each(BAD_WARN)('"%s" asks for review', (text) => {
		expect(severityOf(text)).toBe('warn');
		expect(severityOf(`Sunny two bedroom, ${text}. Call today.`)).toBe('warn');
	});

	test('hashtags are checked inside a hashtag block', () => {
		const findings = checkFairHousing('#JustListed #FamilyHome #SafeNeighborhood #FamilyFriendly');
		expect(findings.map((f) => f.phrase)).toEqual([
			'#FamilyHome',
			'#SafeNeighborhood',
			'#FamilyFriendly'
		]);
	});

	test('"family-friendly" alone warns; next to an area noun it blocks', () => {
		expect(severityOf('A family-friendly layout')).toBe('warn');
		expect(severityOf('A family-friendly community')).toBe('block');
		expect(severityOf('A family friendly area')).toBe('block');
	});

	test('"will appreciate" blocks as a value claim but not as ordinary praise', () => {
		expect(severityOf('This home will appreciate.')).toBe('block');
		expect(severityOf('This home will appreciate in value')).toBe('block');
		expect(severityOf('You will appreciate the light')).toBeNull();
	});
});

describe('Phase 9 neutral phrases', () => {
	test('at least 15 safe-harbor neutrals', () => {
		expect(NEUTRAL.length).toBeGreaterThanOrEqual(15);
	});

	test.each(NEUTRAL)('"%s" is clean', (text) => {
		expect(checkFairHousing(text)).toEqual([]);
		expect(checkFairHousing(`Listing note: ${text}.`)).toEqual([]);
	});

	test('the shared suite carries the Phase 9 phrases', () => {
		const bad = BAD_PHRASES.map((r) => r.text);
		for (const t of ['#SafeNeighborhood', '#FamilyHome', 'guaranteed to appreciate', '#1 agent']) {
			expect(bad).toContain(t);
		}
		for (const t of [
			'walk-in closet',
			'quiet street',
			'step-free entry',
			'Equal Housing Opportunity'
		]) {
			expect(NEUTRAL_PHRASES).toContain(t);
		}
	});
});

describe('advertising category', () => {
	test("CATEGORY_LABELS.advertising is 'Advertising claim'", () => {
		expect(CATEGORY_LABELS.advertising).toBe('Advertising claim');
	});

	test('guarantees block and superlatives warn under advertising', () => {
		for (const text of ['guaranteed to appreciate', 'guaranteed return', "can't lose"]) {
			const m = checkFairHousing(text).flatMap((f) => f.members);
			expect(m.map((x) => [x.category, x.severity])).toEqual([['advertising', 'block']]);
			expect(m[0].categoryLabel).toBe('Advertising claim');
		}
		for (const text of ['#1 agent', 'top producer', 'best investment']) {
			const m = checkFairHousing(text).flatMap((f) => f.members);
			expect(m.map((x) => [x.category, x.severity])).toEqual([['advertising', 'warn']]);
		}
	});

	test('advertising entries cite NY 175.25(c)(10) and NAR Art. 12 and carry no state note', () => {
		const ads = LEXICON.filter((e) => e.category === 'advertising');
		expect(ads.length).toBeGreaterThanOrEqual(4);
		for (const e of ads) {
			expect(e.source).toBe('NY 19 NYCRR 175.25(c)(10); NAR Code of Ethics Art. 12');
			expect(e.scope).toBe('other');
		}
	});
});

describe('Phase 9 entries', () => {
	test('there are at least 15 tagged additions', () => {
		expect(ADDED.length).toBeGreaterThanOrEqual(15);
	});

	test.each(ADDED.map((e) => [e.id, e] as const))(
		'%s explains itself and offers a fix',
		(_id, e) => {
			expect(e.explanation.trim()).not.toBe('');
			expect(e.source.trim()).not.toBe('');
			// '' is the "Remove phrase" fix; any other value is inline replacement wording,
			// so it must not read as an instruction (it is pasted into the copy).
			expect(e.alternative).not.toMatch(/[.!?]$/);
			expect(e.alternative).not.toMatch(/^(?:Remove|Describe|Name)\b/);
		}
	);

	test('leave-one-out: removing any Phase 9 entry misses a bad phrase', () => {
		expect(missedBy(LEXICON)).toEqual([]);
		for (const entry of ADDED) {
			const without = LEXICON.filter((e) => e !== entry);
			expect(missedBy(without), entry.id).not.toEqual([]);
		}
	});

	test('no entry targets a memo safe-harbor phrase', () => {
		for (const e of LEXICON) {
			for (const ex of e.examples) {
				expect(['family room', 'master bedroom', 'walk-in closet', 'cozy']).not.toContain(ex);
			}
		}
	});
});
