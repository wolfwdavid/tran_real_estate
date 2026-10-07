/**
 * Phrase-level entries paraphrased in our own words from 24 CFR 100.75 and the
 * HUD Achtenberg memo (1995-01-09, public domain US government work).
 * State-scope entries reflect protections common in state and local law.
 * Never cite HUD's withdrawn advertising guidance (91 FR 17291).
 * Legal review is advised before the public GTM push.
 */
import { p } from './pattern.js';
import type { LexiconEntry } from './types.js';

const A_FAM = 'HUD Achtenberg memo (1995), familial status';
const A_RACE = 'HUD Achtenberg memo (1995), race, color, and national origin';
const A_REL = 'HUD Achtenberg memo (1995), religion';
const A_SEX = 'HUD Achtenberg memo (1995), sex';
const A_DIS = 'HUD Achtenberg memo (1995), handicap';
const CFR = '24 CFR 100.75, discriminatory advertisements';
const HUD89 = 'HUD advertising guidelines (1989, historical)';
const HOPA =
	'Housing for Older Persons Act exemption (42 U.S.C. 3607(b)) and state age protections';
const S_SOI = 'State and local source-of-income protections';
const S_AGE = 'State and local age protections';
const S_MS = 'State and local marital-status protections';
const S_SOGI = 'State and local sexual orientation and gender identity protections';

const E_CHILD =
	'This limits who can live here based on having children. Describe the home instead, such as the number of bedrooms.';
const E_HOUSEHOLD =
	'This names the kind of household you want instead of describing the home. Describe the layout or features instead.';
const E_YOUNG =
	'This describes who should live here instead of the home. It can read as discouraging families with children or older renters.';
const E_RACE =
	'Describing who lives in an area by race or ethnicity states a preference and can steer renters. Describe the location and amenities instead.';
const E_ORIGIN =
	'This excludes people because of where they or their families come from. Remove it.';
const E_LANG =
	'Requiring a language can exclude people by national origin. Remove it, or say which languages you can help in.';
const E_CODE =
	'Older HUD guidance lists words like this as signals about who lives in an area. Describe the setting and features instead.';
const E_SAFE =
	'Calling an area safe can be read as a comment on who lives there. Describe specific features instead.';
const E_RELIGION = 'This states a religious preference. Remove it and describe the home.';
const E_WORSHIP =
	'Naming one place of worship can suggest a preferred religion. Name the distance to general landmarks instead.';
const E_SEX = 'This limits the home to people of one sex. Remove it.';
const E_BACHELOR =
	'This describes a person rather than the home. A bachelor apartment (a unit type) is fine; a preferred tenant is not.';
const E_DISABILITY =
	'This excludes people with disabilities. Describe accessibility features instead, such as stairs, an elevator, or a ramp.';
const E_SOI =
	'Many states and cities protect renters who pay with housing vouchers. Describe the rent and application steps instead.';
const E_SENIOR =
	'Age limits are lawful only for housing that qualifies as housing for older persons. Keep this only if the property qualifies; otherwise remove it.';
const E_AGE = 'Many states protect renters from age discrimination. Remove it.';
const E_MARITAL = 'Many states protect renters from marital-status discrimination. Remove it.';
const E_SOGI =
	'Many states protect renters from discrimination based on sexual orientation or gender identity. Remove it.';

// Phase 9 (content studio): listing-copy hot spots, hashtags and advertising claims.
// An entry's `alternative` is pasted into the copy, so guidance lives in the
// explanation and '' means "Remove phrase".
const AD = 'NY 19 NYCRR 175.25(c)(10); NAR Code of Ethics Art. 12';
const E_WHO =
	'Describes who should live here rather than the home. Describe the space instead, such as three bedrooms and a fenced yard.';
const E_WHO_AGE =
	'Describes who should live here rather than the home, and many states protect renters by age. Describe the space instead, such as single-level living.';
const E_TAG =
	'Hashtags are part of the ad. This one describes who should live here rather than the home.';
const E_STEER =
	'Safety and school claims can steer buyers or renters. Name verifiable features instead, like streetlights or a gated entry.';
const E_JOB =
	'This limits who can apply by job or income source, which many states protect. Remove it and keep income rules to the screening policy.';
const E_ROOM =
	'This casts the space for one sex. Call it what it is, such as a bonus room or a studio.';
const E_HOPA =
	'Only qualified housing-for-older-persons communities may say this. Keep it only if the property qualifies; otherwise remove it.';
const E_PROMISE = "Ads can't promise future value or returns. Remove the promise.";
const E_SUPERLATIVE =
	'Superlatives need proof you can show. Remove it, or state a fact you can document.';

/** The Fair Housing lexicon. Each entry's examples are matched by it and by no other entry. */
export const LEXICON: readonly LexiconEntry[] = [
	// Familial status (federal)
	{
		id: 'familial.no-kids',
		pattern: p`no kids`,
		category: 'familial-status',
		scope: 'federal',
		severity: 'block',
		alternative: '',
		examples: ['no kids'],
		source: A_FAM,
		explanation: E_CHILD
	},
	{
		id: 'familial.no-children',
		pattern: p`no children`,
		category: 'familial-status',
		scope: 'federal',
		severity: 'block',
		alternative: '',
		examples: ['no children'],
		source: A_FAM,
		explanation: E_CHILD
	},
	{
		id: 'familial.adults-only',
		pattern: p`adults? only`,
		category: 'familial-status',
		scope: 'federal',
		severity: 'block',
		alternative: '',
		examples: ['adults only'],
		source: A_FAM,
		explanation: E_CHILD
	},
	{
		id: 'familial.young-professionals',
		pattern: p`(?:perfect|ideal|great) for young professionals?`,
		category: 'familial-status',
		scope: 'federal',
		severity: 'block',
		alternative: 'close to transit and downtown',
		examples: ['perfect for young professionals'],
		source: A_FAM,
		explanation: E_YOUNG
	},
	{
		id: 'familial.couples',
		pattern: p`(?:perfect|ideal|great) for (?:a )?couples?`,
		category: 'familial-status',
		scope: 'federal',
		severity: 'block',
		alternative: 'with an efficient layout',
		examples: ['ideal for couples'],
		source: A_FAM,
		explanation: E_HOUSEHOLD
	},
	{
		id: 'familial.singles',
		pattern: p`(?:perfect|ideal|great) for singles?`,
		category: 'familial-status',
		scope: 'federal',
		severity: 'block',
		alternative: 'with an efficient layout',
		examples: ['perfect for singles'],
		source: A_FAM,
		explanation: E_HOUSEHOLD
	},
	{
		id: 'familial.empty-nesters',
		pattern: p`(?:perfect|ideal|great) for empty nesters?`,
		category: 'familial-status',
		scope: 'federal',
		severity: 'block',
		alternative: 'with low-maintenance living',
		examples: ['great for empty nesters'],
		source: A_FAM,
		explanation: E_HOUSEHOLD
	},
	{
		id: 'familial.child-limit',
		pattern: p`no more than (?:one|two|1|2) (?:child|children|kids?)`,
		category: 'familial-status',
		scope: 'federal',
		severity: 'block',
		alternative: '',
		examples: ['no more than one child'],
		source: A_FAM,
		explanation: E_CHILD
	},
	{
		id: 'familial.not-for-children',
		pattern: p`not (?:suitable|appropriate) for (?:children|kids)`,
		category: 'familial-status',
		scope: 'federal',
		severity: 'block',
		alternative: '',
		examples: ['not suitable for children'],
		source: CFR,
		explanation: E_CHILD
	},
	{
		id: 'familial.family-friendly-area',
		// Phase 9: block in an area context, hashtag form, plurals.
		pattern: p`#?family(?: )?friendly(?: )?(?:neighborhoods?|communit(?:y|ies)|areas?)`,
		category: 'familial-status',
		scope: 'federal',
		severity: 'block',
		alternative: 'near parks and playgrounds',
		examples: ['family-friendly neighborhood'],
		source: CFR,
		explanation: E_HOUSEHOLD
	},

	// Race, color and national origin (federal)
	{
		id: 'race.racial-area',
		pattern: p`(?:white|black) (?:neighborhood|community|area|block)`,
		category: 'race',
		scope: 'federal',
		severity: 'block',
		alternative: '',
		examples: ['white neighborhood'],
		source: A_RACE,
		explanation: E_RACE
	},
	{
		id: 'race.white-family',
		pattern: p`white famil(?:y|ies) (?:home|only|preferred)`,
		category: 'race',
		scope: 'federal',
		severity: 'block',
		alternative: '',
		examples: ['white family home'],
		source: A_RACE,
		explanation: E_RACE
	},
	{
		id: 'origin.no-group',
		pattern: p`no (?:irish|mexicans?|immigrants|foreigners)`,
		category: 'national-origin',
		scope: 'federal',
		severity: 'block',
		alternative: '',
		examples: ['no Irish'],
		source: A_RACE,
		explanation: E_ORIGIN
	},
	{
		id: 'origin.english-speakers-only',
		pattern: p`english speakers? only`,
		category: 'national-origin',
		scope: 'federal',
		severity: 'block',
		alternative: '',
		examples: ['English speakers only'],
		source: CFR,
		explanation: E_LANG
	},
	{
		id: 'origin.must-speak-english',
		pattern: p`must speak english`,
		category: 'national-origin',
		scope: 'federal',
		severity: 'block',
		alternative: '',
		examples: ['must speak English'],
		source: CFR,
		explanation: E_LANG
	},
	{
		id: 'origin.ethnic-area',
		pattern: p`(?:hispanic|latino|latina|asian|italian|chinese|polish|irish|mexican) (?:neighborhood|community|area)`,
		category: 'national-origin',
		scope: 'federal',
		severity: 'block',
		alternative: '',
		examples: ['Hispanic neighborhood'],
		source: A_RACE,
		explanation: E_RACE
	},
	{
		id: 'race.integrated',
		pattern: p`integrated (?:neighborhood|community|building)`,
		category: 'race',
		scope: 'federal',
		severity: 'warn',
		alternative: 'walkable neighborhood',
		examples: ['integrated neighborhood'],
		source: HUD89,
		explanation: E_CODE
	},
	{
		id: 'race.exclusive',
		pattern: p`exclusive (?:neighborhood|community|area)`,
		category: 'race',
		scope: 'federal',
		severity: 'warn',
		alternative: 'quiet residential street',
		examples: ['exclusive neighborhood'],
		source: HUD89,
		explanation: E_CODE
	},
	{
		id: 'race.safe-area',
		// Phase 9: plurals and streets. The hashtag form is race.safe-area-tag.
		pattern: p`safe (?:neighborhoods?|communit(?:y|ies)|areas?|streets?)`,
		category: 'race',
		scope: 'federal',
		severity: 'warn',
		alternative: 'close to shops and parks',
		examples: ['safe neighborhood'],
		source: CFR,
		explanation: E_SAFE
	},

	// Religion (federal)
	{
		id: 'religion.christian-community',
		pattern: p`christian (?:community|neighborhood|area)`,
		category: 'religion',
		scope: 'federal',
		severity: 'block',
		alternative: '',
		examples: ['Christian community'],
		source: A_REL,
		explanation: E_RELIGION
	},
	{
		id: 'religion.christian-home',
		pattern: p`christian (?:home|household|family|building)`,
		category: 'religion',
		scope: 'federal',
		severity: 'block',
		alternative: '',
		examples: ['Christian home'],
		source: A_REL,
		explanation: E_RELIGION
	},
	{
		id: 'religion.faith-area',
		pattern: p`(?:jewish|muslim|catholic|hindu|mormon) (?:neighborhood|community|area)`,
		category: 'religion',
		scope: 'federal',
		severity: 'block',
		alternative: '',
		examples: ['Jewish neighborhood'],
		source: A_REL,
		explanation: E_RELIGION
	},
	{
		id: 'religion.preferred',
		pattern: p`(?:christian|catholic|jewish|muslim|protestant|hindu|mormon)(?: family| tenants?| renters?)? (?:preferred|only)`,
		category: 'religion',
		scope: 'federal',
		severity: 'block',
		alternative: '',
		examples: ['Catholic family preferred'],
		source: A_REL,
		explanation: E_RELIGION
	},
	{
		id: 'religion.walking-distance-worship',
		pattern: p`walking distance (?:to|of|from) (?:the |a )?(?:church|synagogue|mosque|temple)`,
		category: 'religion',
		scope: 'federal',
		severity: 'warn',
		alternative: 'walkable to shops and parks',
		examples: ['walking distance to church'],
		source: A_REL,
		explanation: E_WORSHIP
	},
	{
		id: 'religion.near-worship',
		pattern: p`(?:near|next to|close to|across from) (?:the |a )?(?:church|synagogue|mosque|temple)`,
		category: 'religion',
		scope: 'federal',
		severity: 'warn',
		alternative: 'near shops and parks',
		examples: ['near the synagogue'],
		source: A_REL,
		explanation: E_WORSHIP
	},

	// Sex (federal)
	{
		id: 'sex.single-sex-only',
		pattern: p`(?:female|male|women|men)(?: tenants?| renters?| residents?)? only`,
		category: 'sex',
		scope: 'federal',
		severity: 'block',
		alternative: '',
		examples: ['female tenants only'],
		source: A_SEX,
		explanation: E_SEX
	},
	{
		id: 'sex.no-sex',
		pattern: p`no (?:men|women|males|females)`,
		category: 'sex',
		scope: 'federal',
		severity: 'block',
		alternative: '',
		examples: ['no men'],
		source: A_SEX,
		explanation: E_SEX
	},
	{
		id: 'sex.bachelor-preference',
		pattern: p`(?:perfect|ideal|great) for (?:a )?(?:bachelor|bachelorette)s?`,
		category: 'sex',
		scope: 'federal',
		severity: 'block',
		alternative: 'with an efficient layout',
		examples: ['perfect for a bachelor'],
		source: A_SEX,
		explanation: E_BACHELOR
	},

	// Disability (federal; the memo's term is "handicap")
	{
		id: 'disability.no-wheelchairs',
		pattern: p`no wheelchairs?`,
		category: 'disability',
		scope: 'federal',
		severity: 'block',
		alternative: '',
		examples: ['no wheelchairs'],
		source: A_DIS,
		explanation: E_DISABILITY
	},
	{
		id: 'disability.able-bodied',
		pattern: p`able bodied(?: tenants?| renters?| persons?| people)?`,
		category: 'disability',
		scope: 'federal',
		severity: 'block',
		alternative: '',
		examples: ['able-bodied tenants', 'able-bodied'],
		source: A_DIS,
		explanation: E_DISABILITY
	},
	{
		id: 'disability.climb-stairs',
		pattern: p`must be able to (?:climb|use|walk up) (?:the )?stairs`,
		category: 'disability',
		scope: 'federal',
		severity: 'block',
		alternative: 'walk-up building with no elevator',
		examples: ['must be able to climb stairs'],
		source: CFR,
		explanation: E_DISABILITY
	},
	{
		id: 'disability.not-for-disabled',
		pattern: p`not (?:suitable|appropriate) for (?:the )?(?:handicapped|disabled)(?: persons?| people| tenants?)?`,
		category: 'disability',
		scope: 'federal',
		severity: 'block',
		alternative: '',
		examples: ['not suitable for handicapped persons'],
		source: CFR,
		explanation: E_DISABILITY
	},
	{
		id: 'disability.no-mental-illness',
		pattern: p`no (?:mentally ill|mental illness|psychiatric)(?: tenants?| patients| persons?| people)?`,
		category: 'disability',
		scope: 'federal',
		severity: 'block',
		alternative: '',
		examples: ['no mentally ill tenants'],
		source: CFR,
		explanation: E_DISABILITY
	},

	// Source of income (state and local)
	{
		id: 'soi.no-section-8',
		pattern: p`no section (?:8|eight)`,
		category: 'source-of-income',
		scope: 'state',
		severity: 'block',
		alternative: '',
		examples: ['no Section 8'],
		source: S_SOI,
		explanation: E_SOI
	},
	{
		id: 'soi.no-vouchers',
		pattern: p`no (?:housing )?vouchers?`,
		category: 'source-of-income',
		scope: 'state',
		severity: 'block',
		alternative: '',
		examples: ['no vouchers'],
		source: S_SOI,
		explanation: E_SOI
	},
	{
		id: 'soi.no-assistance',
		pattern: p`no (?:housing|government|public) assistance`,
		category: 'source-of-income',
		scope: 'state',
		severity: 'block',
		alternative: '',
		examples: ['no housing assistance'],
		source: S_SOI,
		explanation: E_SOI
	},

	// Age (state and local; HOPA exemption for qualifying senior housing)
	{
		id: 'age.seniors-only',
		pattern: p`seniors? only`,
		category: 'age',
		scope: 'state',
		severity: 'warn',
		alternative: '',
		examples: ['seniors only'],
		source: HOPA,
		explanation: E_SENIOR
	},
	{
		id: 'age.55-plus-only',
		pattern: p`(?:55|62) and (?:older|over) only`,
		category: 'age',
		scope: 'state',
		severity: 'warn',
		alternative: '',
		examples: ['55 and older only'],
		source: HOPA,
		explanation: E_SENIOR
	},
	{
		id: 'age.no-retirees',
		pattern: p`no retirees`,
		category: 'age',
		scope: 'state',
		severity: 'block',
		alternative: '',
		examples: ['no retirees'],
		source: S_AGE,
		explanation: E_AGE
	},

	// Marital status (state and local)
	{
		id: 'marital.married-only',
		pattern: p`married couples? only`,
		category: 'marital-status',
		scope: 'state',
		severity: 'block',
		alternative: '',
		examples: ['married couples only'],
		source: S_MS,
		explanation: E_MARITAL
	},

	// Sexual orientation and gender identity (state and local)
	{
		id: 'sogi.straight-only',
		pattern: p`(?:straight|heterosexual) couples? only`,
		category: 'sogi',
		scope: 'state',
		severity: 'block',
		alternative: '',
		examples: ['straight couples only'],
		source: S_SOGI,
		explanation: E_SOGI
	},

	// Phase 9: listing copy and hashtags (09-RESEARCH section E)
	{
		id: 'familial.families',
		pattern: p`(?:perfect|ideal|great) for (?:families|kids|children)`,
		category: 'familial-status',
		scope: 'federal',
		severity: 'block',
		alternative: '',
		examples: ['ideal for families'],
		source: A_FAM,
		explanation: E_WHO,
		phase: 9
	},
	{
		id: 'familial.mature',
		pattern: p`mature (?:couples?|persons?|adults?|tenants?|individuals?)`,
		category: 'familial-status',
		scope: 'federal',
		severity: 'block',
		alternative: '',
		examples: ['mature couple'],
		source: A_FAM,
		explanation: E_CHILD,
		phase: 9
	},
	{
		id: 'familial.family-friendly',
		pattern: p`#?family(?: )?friendly(?!(?: )?(?:neighborhood|communit|area))`,
		category: 'familial-status',
		scope: 'federal',
		severity: 'warn',
		alternative: '',
		examples: ['family-friendly', '#FamilyFriendly'],
		source: CFR,
		explanation: E_WHO,
		phase: 9
	},
	{
		id: 'familial.family-home-tag',
		pattern: p`#family(?:homes?|house)`,
		category: 'familial-status',
		scope: 'federal',
		severity: 'warn',
		alternative: '#JustListed',
		examples: ['#FamilyHome'],
		source: CFR,
		explanation: E_TAG,
		phase: 9
	},
	{
		id: 'familial.kid-friendly',
		pattern: p`#?kids?(?: )?friendly`,
		category: 'familial-status',
		scope: 'federal',
		severity: 'warn',
		alternative: '',
		examples: ['kid-friendly'],
		source: CFR,
		explanation: E_WHO,
		phase: 9
	},
	{
		id: 'origin.english-only',
		pattern: p`english(?: speaking)? only`,
		category: 'national-origin',
		scope: 'federal',
		severity: 'block',
		alternative: '',
		examples: ['English only'],
		source: CFR,
		explanation: E_LANG,
		phase: 9
	},
	{
		id: 'race.safe-area-tag',
		pattern: p`#safe(?:neighborhoods?|communit(?:y|ies)|areas?|streets?)`,
		category: 'race',
		scope: 'federal',
		severity: 'warn',
		alternative: '#JustListed',
		examples: ['#SafeNeighborhood'],
		source: CFR,
		explanation: E_STEER,
		phase: 9
	},
	{
		id: 'race.crime',
		pattern: p`(?:low|no|zero) crime(?: rates?| areas?| neighborhoods?)?|crime free`,
		category: 'race',
		scope: 'federal',
		severity: 'warn',
		alternative: '',
		examples: ['low crime', 'crime-free'],
		source: CFR,
		explanation: E_STEER,
		phase: 9
	},
	{
		id: 'race.changing-area',
		pattern: p`up and coming|gentrif(?:ying|ied)|transitional (?:neighborhoods?|areas?)`,
		category: 'race',
		scope: 'federal',
		severity: 'warn',
		alternative: '',
		examples: ['up-and-coming', 'gentrifying'],
		source: HUD89,
		explanation: E_CODE,
		phase: 9
	},
	{
		id: 'race.restricted',
		pattern: p`(?:private|restricted) (?:neighborhoods?|communit(?:y|ies)|areas?)`,
		category: 'race',
		scope: 'federal',
		severity: 'warn',
		alternative: '',
		examples: ['private community', 'restricted community'],
		source: HUD89,
		explanation: E_CODE,
		phase: 9
	},
	{
		id: 'race.schools',
		pattern: p`(?:great|good|best|excellent|top rated|highly rated|award winning) schools?`,
		category: 'race',
		scope: 'federal',
		severity: 'warn',
		alternative: '',
		examples: ['great schools', 'top-rated schools'],
		source: CFR,
		explanation: E_STEER,
		phase: 9
	},
	{
		id: 'sex.bachelor-pad',
		pattern: p`bachelor(?:ette)? pads?`,
		category: 'sex',
		scope: 'federal',
		severity: 'warn',
		alternative: '',
		examples: ['bachelor pad'],
		source: A_SEX,
		explanation: E_ROOM,
		phase: 9
	},
	{
		id: 'sex.gendered-room',
		pattern: p`man caves?|she sheds?`,
		category: 'sex',
		scope: 'federal',
		severity: 'warn',
		alternative: 'bonus room',
		examples: ['man cave'],
		source: A_SEX,
		explanation: E_ROOM,
		phase: 9
	},
	{
		id: 'soi.professionals-only',
		pattern: p`(?:professionals?|employed)(?: tenants?| renters?| applicants?)? only`,
		category: 'source-of-income',
		scope: 'state',
		severity: 'block',
		alternative: '',
		examples: ['professionals only'],
		source: S_SOI,
		explanation: E_JOB,
		phase: 9
	},
	{
		id: 'age.retirees',
		pattern: p`(?:perfect|ideal|great) for retirees?`,
		category: 'age',
		scope: 'state',
		severity: 'block',
		alternative: '',
		examples: ['great for retirees'],
		source: S_AGE,
		explanation: E_WHO_AGE,
		phase: 9
	},
	{
		id: 'age.hopa',
		pattern: p`(?:55|62)[+] (?:communit(?:y|ies)|living|housing)|senior (?:communit(?:y|ies)|living|housing|apartments?)|active adult(?: communit(?:y|ies)| living)?`,
		category: 'age',
		scope: 'state',
		severity: 'warn',
		alternative: '',
		examples: ['55+ community', 'senior community', 'active adult community'],
		source: HOPA,
		explanation: E_HOPA,
		phase: 9
	},

	// Phase 9: advertising claims (09-RESEARCH section A.5). Not a protected class.
	{
		id: 'ad.guarantee',
		pattern: p`guaranteed? (?:to (?:appreciate|increase in value|rise in value)|returns?|profits?|appreciation|cash flow)`,
		category: 'advertising',
		scope: 'other',
		severity: 'block',
		alternative: '',
		examples: ['guaranteed to appreciate', 'guaranteed return'],
		source: AD,
		explanation: E_PROMISE,
		phase: 9
	},
	{
		id: 'ad.cant-lose',
		pattern: p`(?:can't|cannot|can not) lose`,
		category: 'advertising',
		scope: 'other',
		severity: 'block',
		alternative: '',
		examples: ["can't lose"],
		source: AD,
		explanation: E_PROMISE,
		phase: 9
	},
	{
		// A value claim, not praise: "will appreciate" at a clause end or before
		// "in value"; "buyers will appreciate the kitchen" stays clean.
		id: 'ad.will-appreciate',
		pattern: p`will (?:appreciate(?:(?= in value)|(?! [\p{L}\p{N}]))|(?:increase|rise|go up) in value)`,
		category: 'advertising',
		scope: 'other',
		severity: 'block',
		alternative: '',
		examples: ['will appreciate', 'will appreciate in value'],
		source: AD,
		explanation: E_PROMISE,
		phase: 9
	},
	{
		id: 'ad.top-agent',
		pattern: p`(?:#1|number one)(?: )?(?:agent|realtor|broker|team)s?`,
		category: 'advertising',
		scope: 'other',
		severity: 'warn',
		alternative: '',
		examples: ['#1 agent'],
		source: AD,
		explanation: E_SUPERLATIVE,
		phase: 9
	},
	{
		id: 'ad.top-producer',
		pattern: p`top (?:producers?|producing (?:agent|team)|selling (?:agent|team))`,
		category: 'advertising',
		scope: 'other',
		severity: 'warn',
		alternative: '',
		examples: ['top producer'],
		source: AD,
		explanation: E_SUPERLATIVE,
		phase: 9
	},
	{
		id: 'ad.best-investment',
		pattern: p`best investments?`,
		category: 'advertising',
		scope: 'other',
		severity: 'warn',
		alternative: '',
		examples: ['best investment'],
		source: AD,
		explanation: E_SUPERLATIVE,
		phase: 9
	}
];
