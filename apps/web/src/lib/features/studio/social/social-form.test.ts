// Social brief form model (09-20, STU-02): validation copy, sample detection, restore, the prompt
// inputs and the listing source option label.
import { describe, expect, test } from 'vitest';
import { SAMPLE_SOCIAL_BRIEF } from '../fixtures/sample-social-brief';
import {
	BRIEF_MAX,
	SOCIAL_ERRORS,
	briefToForm,
	emptySocialForm,
	firstInvalidKey,
	isValidLink,
	listingOptionLabel,
	restoreSocialForm,
	sameBrief,
	toSocialInputs,
	validateSocialForm
} from './social-form';

const MID = String.fromCharCode(0xb7);
const ELLIPSIS = String.fromCharCode(0x2026);

describe('social brief form', () => {
	test('the sample brief is the plan fixture and validates', () => {
		expect(SAMPLE_SOCIAL_BRIEF).toEqual({
			postType: 'just-listed',
			brief: 'Just listed: 3 bedrooms, 2 baths, updated kitchen, open house Saturday 1 to 3.',
			cityOrArea: 'Harlow Springs',
			link: '',
			tone: 'warm'
		});
		expect(validateSocialForm(briefToForm(SAMPLE_SOCIAL_BRIEF))).toEqual({});
	});

	test('validation copy: empty brief, too long, bad link', () => {
		const empty = emptySocialForm();
		expect(validateSocialForm(empty)).toEqual({ brief: SOCIAL_ERRORS.briefRequired });
		expect(SOCIAL_ERRORS.briefRequired).toBe('Write a short brief.');
		const long = { ...empty, brief: 'a'.repeat(BRIEF_MAX + 1) };
		expect(validateSocialForm(long).brief).toBe('Keep your brief under 2,000 characters.');
		expect(validateSocialForm({ ...empty, brief: 'a'.repeat(BRIEF_MAX) })).toEqual({});
		const bad = { ...empty, brief: 'Open house.', link: 'yourname' };
		expect(validateSocialForm(bad)).toEqual({
			link: "This link doesn't look right. Check it, like https://yourname.com."
		});
		expect(firstInvalidKey(validateSocialForm({ ...empty, link: 'x' }))).toBe('brief');
	});

	test('links: optional, http(s) only, a dotted host, no spaces', () => {
		expect(isValidLink('')).toBe(true);
		expect(isValidLink('https://yourname.com')).toBe(true);
		expect(isValidLink(' http://example.com/a?b=1 ')).toBe(true);
		for (const bad of [
			'yourname.com',
			'https://localhost',
			'ftp://x.com',
			'https://a b.com',
			'javascript:alert(1)'
		]) {
			expect(isValidLink(bad), bad).toBe(false);
		}
	});

	test('sample detection ignores the listing source and breaks on any edit', () => {
		const f = briefToForm(SAMPLE_SOCIAL_BRIEF);
		expect(sameBrief(f, SAMPLE_SOCIAL_BRIEF)).toBe(true);
		expect(sameBrief({ ...f, source: 'abc' }, SAMPLE_SOCIAL_BRIEF)).toBe(true);
		expect(sameBrief({ ...f, tone: 'luxury' }, SAMPLE_SOCIAL_BRIEF)).toBe(false);
		expect(sameBrief({ ...f, brief: `${f.brief} ` }, SAMPLE_SOCIAL_BRIEF)).toBe(false);
	});

	test('restore drops unknown keys and malformed values', () => {
		expect(restoreSocialForm(null)).toEqual(emptySocialForm());
		expect(restoreSocialForm(['x'])).toEqual(emptySocialForm());
		const r = restoreSocialForm({
			postType: 'open-house',
			tone: 'shouty',
			brief: 'Open house Sunday.',
			cityOrArea: 'x'.repeat(90),
			link: 7,
			extra: 'nope'
		});
		expect(r).toEqual({
			postType: 'open-house',
			source: '',
			brief: 'Open house Sunday.',
			cityOrArea: 'x'.repeat(40),
			link: '',
			tone: 'warm'
		});
	});

	test('prompt inputs: trimmed, an invalid link is never sent, the disclosure rides along', () => {
		const i = toSocialInputs(
			{
				...emptySocialForm(),
				brief: '  Open house.  ',
				cityOrArea: ' Harlow Springs ',
				link: 'nope'
			},
			'DISCLOSURE'
		);
		expect(i).toEqual({
			postType: 'just-listed',
			brief: 'Open house.',
			cityOrArea: 'Harlow Springs',
			link: '',
			tone: 'warm',
			disclosure: 'DISCLOSURE'
		});
	});

	test('listing option label: month and day, a middle dot, then the first 40 characters', () => {
		const label = listingOptionLabel({
			createdAt: '2026-10-05T15:00:00.000Z',
			text: 'Welcome to 12 Example Lane, a bright single family home with an updated kitchen.'
		});
		expect(label).toMatch(
			new RegExp(`^Oct [45] ${MID} Welcome to 12 Example Lane, a bright sin${ELLIPSIS}$`)
		);
		expect(listingOptionLabel({ createdAt: '2026-10-05T15:00:00.000Z', text: 'Short.' })).toMatch(
			new RegExp(`${MID} Short[.]$`)
		);
	});
});
