import { checkFairHousing } from './check.js';
import { LEXICON } from './lexicon.js';
import type { Category, LexiconEntry, Severity } from './types.js';

/**
 * Fair Housing test suites. Reused by the Phase 10 checker page as worked
 * examples, so every row is plain listing copy.
 */
export type BadPhrase = { text: string; entryId: string; category: Category; severity: Severity };

/**
 * The suite's comparison: true when checking `text` against `lexicon` yields a
 * member with the row's entry id, category and severity.
 */
export function flagsRow(
	text: string,
	row: BadPhrase,
	lexicon: readonly LexiconEntry[] = LEXICON
): boolean {
	return checkFairHousing(text, lexicon).some((f) =>
		f.members.some(
			(m) => m.entryId === row.entryId && m.category === row.category && m.severity === row.severity
		)
	);
}

/** One row per lexicon example. Each must be flagged by its own entry. */
export const BAD_PHRASES: readonly BadPhrase[] = [
	{ text: 'no kids', entryId: 'familial.no-kids', category: 'familial-status', severity: 'block' },
	{
		text: 'no children',
		entryId: 'familial.no-children',
		category: 'familial-status',
		severity: 'block'
	},
	{
		text: 'adults only',
		entryId: 'familial.adults-only',
		category: 'familial-status',
		severity: 'block'
	},
	{
		text: 'perfect for young professionals',
		entryId: 'familial.young-professionals',
		category: 'familial-status',
		severity: 'block'
	},
	{
		text: 'ideal for couples',
		entryId: 'familial.couples',
		category: 'familial-status',
		severity: 'block'
	},
	{
		text: 'perfect for singles',
		entryId: 'familial.singles',
		category: 'familial-status',
		severity: 'block'
	},
	{
		text: 'great for empty nesters',
		entryId: 'familial.empty-nesters',
		category: 'familial-status',
		severity: 'block'
	},
	{
		text: 'no more than one child',
		entryId: 'familial.child-limit',
		category: 'familial-status',
		severity: 'block'
	},
	{
		text: 'not suitable for children',
		entryId: 'familial.not-for-children',
		category: 'familial-status',
		severity: 'block'
	},
	{
		text: 'family-friendly neighborhood',
		entryId: 'familial.family-friendly-area',
		category: 'familial-status',
		severity: 'block'
	},
	{ text: 'white neighborhood', entryId: 'race.racial-area', category: 'race', severity: 'block' },
	{ text: 'white family home', entryId: 'race.white-family', category: 'race', severity: 'block' },
	{
		text: 'no Irish',
		entryId: 'origin.no-group',
		category: 'national-origin',
		severity: 'block'
	},
	{
		text: 'English speakers only',
		entryId: 'origin.english-speakers-only',
		category: 'national-origin',
		severity: 'block'
	},
	{
		text: 'must speak English',
		entryId: 'origin.must-speak-english',
		category: 'national-origin',
		severity: 'block'
	},
	{
		text: 'Hispanic neighborhood',
		entryId: 'origin.ethnic-area',
		category: 'national-origin',
		severity: 'block'
	},
	{
		text: 'integrated neighborhood',
		entryId: 'race.integrated',
		category: 'race',
		severity: 'warn'
	},
	{ text: 'exclusive neighborhood', entryId: 'race.exclusive', category: 'race', severity: 'warn' },
	{ text: 'safe neighborhood', entryId: 'race.safe-area', category: 'race', severity: 'warn' },
	{
		text: 'Christian community',
		entryId: 'religion.christian-community',
		category: 'religion',
		severity: 'block'
	},
	{
		text: 'Christian home',
		entryId: 'religion.christian-home',
		category: 'religion',
		severity: 'block'
	},
	{
		text: 'Jewish neighborhood',
		entryId: 'religion.faith-area',
		category: 'religion',
		severity: 'block'
	},
	{
		text: 'Catholic family preferred',
		entryId: 'religion.preferred',
		category: 'religion',
		severity: 'block'
	},
	{
		text: 'walking distance to church',
		entryId: 'religion.walking-distance-worship',
		category: 'religion',
		severity: 'warn'
	},
	{
		text: 'near the synagogue',
		entryId: 'religion.near-worship',
		category: 'religion',
		severity: 'warn'
	},
	{
		text: 'female tenants only',
		entryId: 'sex.single-sex-only',
		category: 'sex',
		severity: 'block'
	},
	{ text: 'no men', entryId: 'sex.no-sex', category: 'sex', severity: 'block' },
	{
		text: 'perfect for a bachelor',
		entryId: 'sex.bachelor-preference',
		category: 'sex',
		severity: 'block'
	},
	{
		text: 'no wheelchairs',
		entryId: 'disability.no-wheelchairs',
		category: 'disability',
		severity: 'block'
	},
	{
		text: 'able-bodied tenants',
		entryId: 'disability.able-bodied',
		category: 'disability',
		severity: 'block'
	},
	{
		text: 'able-bodied',
		entryId: 'disability.able-bodied',
		category: 'disability',
		severity: 'block'
	},
	{
		text: 'must be able to climb stairs',
		entryId: 'disability.climb-stairs',
		category: 'disability',
		severity: 'block'
	},
	{
		text: 'not suitable for handicapped persons',
		entryId: 'disability.not-for-disabled',
		category: 'disability',
		severity: 'block'
	},
	{
		text: 'no mentally ill tenants',
		entryId: 'disability.no-mental-illness',
		category: 'disability',
		severity: 'block'
	},
	{
		text: 'no Section 8',
		entryId: 'soi.no-section-8',
		category: 'source-of-income',
		severity: 'block'
	},
	{
		text: 'no vouchers',
		entryId: 'soi.no-vouchers',
		category: 'source-of-income',
		severity: 'block'
	},
	{
		text: 'no housing assistance',
		entryId: 'soi.no-assistance',
		category: 'source-of-income',
		severity: 'block'
	},
	{ text: 'seniors only', entryId: 'age.seniors-only', category: 'age', severity: 'warn' },
	{ text: '55 and older only', entryId: 'age.55-plus-only', category: 'age', severity: 'warn' },
	{ text: 'no retirees', entryId: 'age.no-retirees', category: 'age', severity: 'block' },
	{
		text: 'married couples only',
		entryId: 'marital.married-only',
		category: 'marital-status',
		severity: 'block'
	},
	{
		text: 'straight couples only',
		entryId: 'sogi.straight-only',
		category: 'sogi',
		severity: 'block'
	},
	// Phase 9: listing copy, hashtags and advertising claims
	{
		text: 'ideal for families',
		entryId: 'familial.families',
		category: 'familial-status',
		severity: 'block'
	},
	{
		text: 'mature couple',
		entryId: 'familial.mature',
		category: 'familial-status',
		severity: 'block'
	},
	{
		text: 'family-friendly',
		entryId: 'familial.family-friendly',
		category: 'familial-status',
		severity: 'warn'
	},
	{
		text: '#FamilyFriendly',
		entryId: 'familial.family-friendly',
		category: 'familial-status',
		severity: 'warn'
	},
	{
		text: '#FamilyHome',
		entryId: 'familial.family-home-tag',
		category: 'familial-status',
		severity: 'warn'
	},
	{
		text: 'kid-friendly',
		entryId: 'familial.kid-friendly',
		category: 'familial-status',
		severity: 'warn'
	},
	{
		text: 'English only',
		entryId: 'origin.english-only',
		category: 'national-origin',
		severity: 'block'
	},
	{
		text: '#SafeNeighborhood',
		entryId: 'race.safe-area-tag',
		category: 'race',
		severity: 'warn'
	},
	{
		text: 'low crime',
		entryId: 'race.crime',
		category: 'race',
		severity: 'warn'
	},
	{
		text: 'crime-free',
		entryId: 'race.crime',
		category: 'race',
		severity: 'warn'
	},
	{
		text: 'up-and-coming',
		entryId: 'race.changing-area',
		category: 'race',
		severity: 'warn'
	},
	{
		text: 'gentrifying',
		entryId: 'race.changing-area',
		category: 'race',
		severity: 'warn'
	},
	{
		text: 'private community',
		entryId: 'race.restricted',
		category: 'race',
		severity: 'warn'
	},
	{
		text: 'restricted community',
		entryId: 'race.restricted',
		category: 'race',
		severity: 'warn'
	},
	{
		text: 'great schools',
		entryId: 'race.schools',
		category: 'race',
		severity: 'warn'
	},
	{
		text: 'top-rated schools',
		entryId: 'race.schools',
		category: 'race',
		severity: 'warn'
	},
	{
		text: 'bachelor pad',
		entryId: 'sex.bachelor-pad',
		category: 'sex',
		severity: 'warn'
	},
	{
		text: 'man cave',
		entryId: 'sex.gendered-room',
		category: 'sex',
		severity: 'warn'
	},
	{
		text: 'professionals only',
		entryId: 'soi.professionals-only',
		category: 'source-of-income',
		severity: 'block'
	},
	{
		text: 'great for retirees',
		entryId: 'age.retirees',
		category: 'age',
		severity: 'block'
	},
	{
		text: '55+ community',
		entryId: 'age.hopa',
		category: 'age',
		severity: 'warn'
	},
	{
		text: 'senior community',
		entryId: 'age.hopa',
		category: 'age',
		severity: 'warn'
	},
	{
		text: 'active adult community',
		entryId: 'age.hopa',
		category: 'age',
		severity: 'warn'
	},
	{
		text: 'guaranteed to appreciate',
		entryId: 'ad.guarantee',
		category: 'advertising',
		severity: 'block'
	},
	{
		text: 'guaranteed return',
		entryId: 'ad.guarantee',
		category: 'advertising',
		severity: 'block'
	},
	{
		text: "can't lose",
		entryId: 'ad.cant-lose',
		category: 'advertising',
		severity: 'block'
	},
	{
		text: 'will appreciate in value',
		entryId: 'ad.will-appreciate',
		category: 'advertising',
		severity: 'block'
	},
	{
		text: '#1 agent',
		entryId: 'ad.top-agent',
		category: 'advertising',
		severity: 'warn'
	},
	{
		text: 'top producer',
		entryId: 'ad.top-producer',
		category: 'advertising',
		severity: 'warn'
	},
	{
		text: 'best investment',
		entryId: 'ad.best-investment',
		category: 'advertising',
		severity: 'warn'
	}
];

/**
 * Must produce zero findings. Includes phrases the HUD Achtenberg memo (1995)
 * names as lawful, and accessibility FEATURES (exclusions are flagged).
 */
export const NEUTRAL_PHRASES: readonly string[] = [
	'master bedroom',
	'rare find',
	'desirable neighborhood',
	'apartment complex with chapel',
	'kosher meals available',
	'Merry Christmas',
	'mother-in-law suite',
	'bachelor apartment',
	'great view',
	'fourth-floor walk-up',
	'walk-in closets',
	'jogging trails',
	'walk to bus stop',
	'non-smoking',
	'wheelchair ramp',
	'two bedroom',
	'cozy',
	'family room',
	'no bicycles allowed',
	'quiet streets',
	'two bedrooms',
	'near transit',
	'pet policy on request',
	'wheelchair accessible entrance',
	'elevator building',
	'in-unit laundry',
	'close to shops and parks',
	'grab bars in the bathroom',
	'fenced backyard',
	"children's play area on site",
	'first-floor unit',
	'utilities included',
	'rent is $1,850 per month',
	'Section 8 vouchers welcome',
	'senior center nearby',
	'Christiansen Avenue',
	'English garden',
	'able to schedule tours on weekends',
	'ideal for entertaining',
	'great for a home office',
	// Phase 9: listing safe-harbor phrases
	'walk-in closet',
	'walk to transit',
	'quiet street',
	'step-free entry',
	'near Riverside Park',
	'in-law suite',
	'gated entry',
	'Equal Housing Opportunity',
	'single-family home',
	'Buyers will appreciate the updated kitchen'
];
