import { describe, expect, it } from 'vitest';
import { checkFairHousing } from '@tran/core/fair-housing';
import { validateListingFacts } from '@tran/core/studio';
import { sampleListing } from '$lib/ai/prompts/studio/listing.v1';
import { runChecks } from '$lib/ai/ui/panel-controller';
import { SAMPLE_LISTING_FACTS } from '../fixtures/sample-listing-facts';
import {
	listingAllowedNumbers,
	numberPostCheck,
	numberWordsPostCheck,
	unsupportedFeaturePostCheck
} from '../post-checks';
import { countLine, siteLimitLine, withDisclosure, wordCount } from './listing-count';

const DOT = String.fromCharCode(0xb7);

describe('listing count line', () => {
	it('counts words, characters and the with-disclosure length', () => {
		expect(countLine('Hello there friend', 'DISCLOSURE')).toBe(
			`3 words ${DOT} 18 characters. With your disclosure: 30 characters.`
		);
	});

	it('uses singular words and thousands separators', () => {
		expect(countLine('Hi', '')).toBe(
			`1 word ${DOT} 2 characters. With your disclosure: 2 characters.`
		);
		const long = 'a '.repeat(600).trim();
		expect(countLine(long, 'D')).toBe(
			`600 words ${DOT} 1,199 characters. With your disclosure: 1,202 characters.`
		);
	});

	it('measures the copied text: trailing whitespace dropped, blank line, disclosure', () => {
		expect(withDisclosure('Body.  \n', 'Line 1\nLine 2')).toBe('Body.\n\nLine 1\nLine 2');
		expect(withDisclosure('Body.', '')).toBe('Body.');
		expect(countLine('Body.\n', 'D')).toBe(
			`1 word ${DOT} 6 characters. With your disclosure: 8 characters.`
		);
	});

	it('counts blank text as zero words', () => {
		expect(wordCount('   ')).toBe(0);
		expect(wordCount(' one  two\nthree ')).toBe(3);
	});

	it('shows the listing-site line within and over the limit', () => {
		const over = siteLimitLine('Hello there friend', 10);
		expect(over).toEqual({
			length: 18,
			limit: 10,
			text: '18 of 10 characters for your listing site.',
			overText:
				"8 characters over your listing site's limit. Shorten the description, or leave the disclosure off if your site doesn't allow it there.",
			over: true
		});
		const within = siteLimitLine('Hello', 4000);
		expect(within?.text).toBe('5 of 4,000 characters for your listing site.');
		expect(within?.over).toBe(false);
		expect(siteLimitLine('Hello', 4)?.overText.startsWith('1 character over')).toBe(true);
	});

	it('has no site line without a positive limit', () => {
		expect(siteLimitLine('Hello', undefined)).toBeNull();
		expect(siteLimitLine('Hello', 0)).toBeNull();
	});
});

describe('SAMPLE_LISTING_FACTS', () => {
	it('validates against the closed whitelist and uses a fictional street', () => {
		const r = validateListingFacts({ ...SAMPLE_LISTING_FACTS }, new Date());
		expect(r.ok).toBe(true);
		expect(SAMPLE_LISTING_FACTS.streetOrArea).toBe('12 Example Lane');
		// The E2E plants "A fireplace." as an unsupported feature: it must not be in the facts.
		expect(SAMPLE_LISTING_FACTS.features).not.toContain('Fireplace');
	});

	it('its keyless sample draft has zero findings', () => {
		const f = { ...SAMPLE_LISTING_FACTS, features: [...SAMPLE_LISTING_FACTS.features] };
		const text = sampleListing(f);
		expect(text.length).toBeGreaterThan(0);
		expect(checkFairHousing(text)).toEqual([]);
		expect(
			runChecks(text, [
				numberPostCheck('listing', listingAllowedNumbers(f)),
				unsupportedFeaturePostCheck(f),
				numberWordsPostCheck()
			])
		).toEqual([]);
	});
});
