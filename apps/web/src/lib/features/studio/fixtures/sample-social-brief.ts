// Sample brief for "Use a sample brief" (09-UI-SPEC "Social post pack"). Synthetic only: the
// fictional Phase 4 metro and made-up facts. The keyless Fixture pack built from it
// (studio/social.v1 sample()) has zero Fair Housing and number findings on all three cards
// (social-sections-spec.test.ts re-asserts it).
import type { SocialBrief } from '../social/social-form';

export const SAMPLE_SOCIAL_BRIEF: Readonly<SocialBrief> = Object.freeze({
	postType: 'just-listed',
	brief: 'Just listed: 3 bedrooms, 2 baths, updated kitchen, open house Saturday 1 to 3.',
	cityOrArea: 'Harlow Springs',
	link: '',
	tone: 'warm'
} satisfies SocialBrief);
