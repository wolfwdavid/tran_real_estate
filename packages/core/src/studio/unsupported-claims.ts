/**
 * Unsupported-feature check for listing drafts (STU-01, 09-RESEARCH Pattern 5).
 *
 * A deterministic, warn-level guard: any listing-vocabulary term in the generated text whose
 * concept the agent did not select as a chip or type in a free-text fact is reported, so an
 * invented amenity ("fireplace") is caught before the draft leaves the app.
 *
 * Room names that are safe-harbor phrases in Fair Housing advertising guidance (for example a
 * walk-in closet or a primary bedroom) are either covered by a chip or simply absent from the
 * vocabulary, so they are never reported when the matching fact is present.
 *
 * Matching is case-insensitive with Unicode letter/number boundaries; inner spaces in a term
 * match any run of whitespace; within a concept the longest term wins.
 */

import { LISTING_FEATURES, type ListingFacts } from './listing-facts';

export interface FeatureConcept {
	id: string;
	terms: readonly string[];
}

export const FEATURE_VOCAB: readonly FeatureConcept[] = [
	{ id: 'pool', terms: ['pool', 'swimming pool', 'poolside'] },
	{ id: 'hot-tub', terms: ['hot tub', 'spa', 'jacuzzi'] },
	{ id: 'garage', terms: ['garage', 'attached garage'] },
	{ id: 'parking', terms: ['off-street parking', 'driveway', 'parking space', 'carport'] },
	{ id: 'fireplace', terms: ['fireplace', 'fireplaces', 'wood stove'] },
	{ id: 'hardwood', terms: ['hardwood', 'hardwoods', 'wood floors'] },
	{ id: 'granite', terms: ['granite'] },
	{ id: 'quartz', terms: ['quartz'] },
	{ id: 'marble', terms: ['marble'] },
	{ id: 'stainless', terms: ['stainless', 'stainless steel'] },
	{ id: 'island', terms: ['kitchen island'] },
	{ id: 'renovated', terms: ['renovated', 'remodeled', 'updated', 'upgraded', 'new kitchen'] },
	{ id: 'new-roof', terms: ['new roof'] },
	{ id: 'view', terms: ['views', 'city view', 'mountain view', 'water view'] },
	{ id: 'waterfront', terms: ['waterfront', 'lakefront', 'oceanfront', 'beachfront'] },
	{ id: 'basement', terms: ['basement', 'finished basement'] },
	{ id: 'attic', terms: ['attic'] },
	{ id: 'deck', terms: ['deck'] },
	{ id: 'patio', terms: ['patio'] },
	{ id: 'balcony', terms: ['balcony'] },
	{ id: 'porch', terms: ['porch'] },
	{ id: 'yard', terms: ['yard', 'backyard', 'fenced yard'] },
	{ id: 'solar', terms: ['solar', 'solar panels'] },
	{ id: 'ev-charger', terms: ['ev charger', 'electric vehicle charger', 'charging station'] },
	{ id: 'laundry', terms: ['in-unit laundry', 'laundry', 'washer', 'dryer'] },
	{ id: 'central-air', terms: ['central air', 'air conditioning'] },
	{ id: 'heat-pump', terms: ['heat pump'] },
	{ id: 'walk-in-closet', terms: ['walk-in closet', 'walk-in closets'] },
	{ id: 'vaulted', terms: ['vaulted ceilings', 'cathedral ceilings', 'vaulted'] },
	{ id: 'skylight', terms: ['skylight', 'skylights'] },
	{ id: 'gym', terms: ['gym', 'fitness center'] },
	{ id: 'elevator', terms: ['elevator'] },
	{ id: 'doorman', terms: ['doorman', 'concierge'] },
	{ id: 'storage', terms: ['storage', 'extra storage'] },
	{ id: 'office', terms: ['home office', 'office', 'den'] },
	{ id: 'primary-suite', terms: ['primary suite', 'master suite', 'en suite', 'ensuite'] },
	{ id: 'smart-home', terms: ['smart home', 'smart thermostat'] },
	{ id: 'efficient-windows', terms: ['energy-efficient windows', 'double-pane windows'] },
	{ id: 'step-free', terms: ['step-free', 'no-step entry', 'single-level'] },
	{ id: 'first-floor-bedroom', terms: ['first-floor bedroom'] },
	{ id: 'sauna', terms: ['sauna'] },
	{ id: 'wine-cellar', terms: ['wine cellar'] },
	{ id: 'workshop', terms: ['workshop'] },
	{ id: 'shed', terms: ['shed'] },
	{
		id: 'accessory-suite',
		terms: ['guest suite', 'accessory suite', 'in-law suite', 'guest house']
	},
	{ id: 'dishwasher', terms: ['dishwasher'] },
	{ id: 'sprinkler', terms: ['sprinkler system'] },
	{ id: 'gated', terms: ['gated', 'gated entry'] }
];

type FeatureLabel = (typeof LISTING_FEATURES)[number];

const FEATURE_CHIPS: Record<FeatureLabel, readonly string[]> = {
	'Updated kitchen': ['renovated', 'island'],
	'Hardwood floors': ['hardwood'],
	'In-unit laundry': ['laundry'],
	'Central air': ['central-air'],
	Garage: ['garage', 'parking'],
	'Off-street parking': ['parking'],
	'Private outdoor space': ['yard', 'patio', 'deck', 'balcony', 'porch'],
	Fireplace: ['fireplace'],
	'Walk-in closets': ['walk-in-closet'],
	'Primary suite': ['primary-suite'],
	'Home office': ['office'],
	'Energy-efficient windows': ['efficient-windows'],
	'Solar panels': ['solar'],
	Pool: ['pool'],
	'Extra storage': ['storage'],
	'Step-free entry': ['step-free']
};

/** Chip label (feature or nearby amenity) to the vocabulary concepts it supports. */
export const CHIP_CONCEPTS: Record<string, readonly string[]> = {
	...FEATURE_CHIPS,
	Waterfront: ['waterfront', 'view']
};

export interface UnsupportedHit {
	start: number;
	end: number;
	conceptId: string;
	matched: string;
}

export type UnsupportedFacts = Pick<ListingFacts, 'features' | 'nearby'> & {
	freeText: readonly string[];
};

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const termSource = (term: string) => escapeRegExp(term).split(' ').join('\\s+');

const CONCEPT_PATTERNS: readonly { id: string; source: string }[] = FEATURE_VOCAB.map((c) => ({
	id: c.id,
	source:
		'(?<![\\p{L}\\p{N}])(?:' +
		[...c.terms]
			.sort((a, b) => b.length - a.length)
			.map(termSource)
			.join('|') +
		')(?![\\p{L}\\p{N}])'
}));

const conceptRegex = (source: string, flags: 'giu' | 'iu' = 'giu') => new RegExp(source, flags);

function supportedConcepts(facts: UnsupportedFacts): Set<string> {
	const supported = new Set<string>();
	for (const label of [...facts.features, ...facts.nearby]) {
		for (const id of CHIP_CONCEPTS[label] ?? []) supported.add(id);
	}
	for (const { id, source } of CONCEPT_PATTERNS) {
		if (supported.has(id)) continue;
		const re = conceptRegex(source, 'iu');
		if (facts.freeText.some((t) => re.test(t))) supported.add(id);
	}
	return supported;
}

/**
 * Every vocabulary mention in `text` whose concept is not backed by a selected chip or the
 * agent's own free text, sorted by start offset. Overlapping matches of one concept are merged.
 */
export function findUnsupportedFeatures(text: string, facts: UnsupportedFacts): UnsupportedHit[] {
	if (text === '') return [];
	const supported = supportedConcepts(facts);
	const hits: UnsupportedHit[] = [];
	for (const { id, source } of CONCEPT_PATTERNS) {
		if (supported.has(id)) continue;
		let last: UnsupportedHit | undefined;
		for (const m of text.matchAll(conceptRegex(source))) {
			const start = m.index;
			const end = start + m[0].length;
			if (last && start < last.end) {
				if (end > last.end) {
					last.end = end;
					last.matched = text.slice(last.start, end);
				}
				continue;
			}
			last = { start, end, conceptId: id, matched: m[0] };
			hits.push(last);
		}
	}
	return hits.sort((a, b) => a.start - b.start || a.end - b.end);
}
