import { describe, expect, it } from 'vitest';

import * as studio from './index';

// Every Phase 9 core module is reachable from the one `@tran/core/studio` barrel.
const EXPECTED = [
	'formatDisclosure',
	'assemblePost',
	'PLATFORM_LIMITS',
	'missingFor',
	'DISCLOSURE_FIELD_LABELS',
	'LICENSE_TYPE_OPTIONS',
	'validateTeamName',
	'validateLicenseTitle',
	'allowedSet',
	'validateListingFacts',
	'findUnsupportedFeatures',
	'buildSnapshotMetrics',
	'aggregateListings',
	'snapshotAllowedNumbers',
	'factsForPrompt',
	'parseSocialPack',
	'REEL_TEMPLATES',
	'timeBeats',
	'RESULTS_PLACEHOLDER'
] as const;

describe('@tran/core/studio barrel', () => {
	it.each(EXPECTED)('exports %s', (name) => {
		expect(typeof (studio as Record<string, unknown>)[name]).not.toBe('undefined');
	});
});
