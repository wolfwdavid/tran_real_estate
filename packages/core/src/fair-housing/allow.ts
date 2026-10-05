import { p } from './pattern.js';

/**
 * Neutral phrases named as lawful in the HUD Achtenberg memo (1995) and
 * accessibility FEATURES. A lexicon match that lies fully inside one of these
 * spans is dropped.
 */
export const ALLOW_PHRASES: readonly string[] = [
	p`master bedroom`,
	p`bachelor apartment`,
	p`mother in law (?:suite|apartment|unit)`,
	p`family room`,
	p`walk(?:ing)? to (?:the )?bus stop`,
	p`kosher meals?`,
	p`chapel`,
	p`wheelchair ramps?`,
	p`wheelchair accessible`,
	p`section (?:8|eight)(?: vouchers?)? (?:welcome|accepted)`,
	p`housing vouchers? (?:welcome|accepted)`,
	p`senior center`,
	p`children's play area`
];
