// buildSocialSections (09-20, STU-02): fixed order and copy, disclosure-last on every card, the
// per-card parse error, the hashtag cap on an edit, and the keyless sample brief passing every
// card check with zero findings.
import { describe, expect, test } from 'vitest';
import { checkFairHousing } from '@tran/core/fair-housing';
import { composeDisclosure } from '@tran/core/disclosure';
import { runChecks } from '$lib/ai/ui/panel-controller';
import { sampleSocialPack } from '$lib/ai/prompts/studio/social.v1';
import { SAMPLE_AGENT_PROFILE } from '$lib/features/shared/agent-profile';
import { SAMPLE_SOCIAL_BRIEF } from '../fixtures/sample-social-brief';
import {
	SOCIAL_CHECK_GROUPS,
	SOCIAL_CONSTRAINT_LINES,
	SOCIAL_FOOTER_LABEL,
	buildSocialSections
} from './social-sections-spec';
import { briefToForm, toSocialInputs } from './social-form';

const DISCLOSURE = composeDisclosure(SAMPLE_AGENT_PROFILE, { variant: 'ad-inline' }).text;
const INPUTS = toSocialInputs(briefToForm(SAMPLE_SOCIAL_BRIEF), DISCLOSURE);
const PACK = sampleSocialPack(INPUTS);
const specs = () => buildSocialSections(DISCLOSURE, SAMPLE_SOCIAL_BRIEF.brief, '');

describe('buildSocialSections', () => {
	test('three specs in the fixed order with the UI-SPEC labels and constraint lines', () => {
		const s = specs();
		expect(s.map((x) => x.key)).toEqual(['instagram', 'facebook', 'linkedin']);
		expect(s.map((x) => x.label)).toEqual(['Instagram', 'Facebook', 'LinkedIn']);
		expect(s[0]!.constraintLine).toBe(
			'Caption up to 2,200 characters. Up to 5 hashtags, in their own block.'
		);
		expect(s[1]!.constraintLine).toBe('Conversational. Up to 2 hashtags.');
		expect(s[2]!.constraintLine).toBe('Professional. Up to 3 hashtags at the end.');
		expect(s.map((x) => x.constraintLine)).toEqual(Object.values(SOCIAL_CONSTRAINT_LINES));
	});

	test('every spec carries the ad-inline disclosure under the post label', () => {
		expect(DISCLOSURE).toContain('Avery Sample');
		for (const spec of specs()) {
			expect(spec.emailFooter).toEqual({ text: DISCLOSURE, label: SOCIAL_FOOTER_LABEL });
			expect(spec.emailFooter.label).toBe('Added to the end of this post');
		}
	});

	test('assemble(extract(pack)) ends with the disclosure on every card', () => {
		for (const spec of specs()) {
			const ex = spec.extract(PACK, false);
			expect(ex.state).toBe('ok');
			const a = spec.assemble(ex.text);
			expect(a.text.endsWith(spec.emailFooter.text)).toBe(true);
			expect(a.text.endsWith(`\n\n${DISCLOSURE}`)).toBe(true);
			expect(a.length).toBe(a.text.length);
			expect(a.tagsOverCap).toBe(0);
		}
	});

	test('Instagram keeps its hashtag block after the caption', () => {
		const ig = specs()[0]!;
		const text = ig.extract(PACK, false).text;
		expect(text).toContain('Link in bio.');
		expect(text.split('\n\n').at(-1)).toMatch(/^#\w+( #\w+){0,4}$/);
	});

	test('a pack missing FACEBOOK: that card errors after the stream, the others are ok', () => {
		const noFacebook = PACK.replace(/=== FACEBOOK ===[\s\S]*?(?==== LINKEDIN ===)/, '');
		const [ig, fb, li] = specs();
		expect(fb!.extract(noFacebook, false).state).toBe('error');
		expect(ig!.extract(noFacebook, false).state).toBe('ok');
		expect(li!.extract(noFacebook, false).state).toBe('ok');
		// While streaming a missing section is only "not started yet".
		expect(fb!.extract(noFacebook, true).state).not.toBe('error');
		// Before any text there is nothing to report.
		expect(fb!.extract('', false).state).toBe('empty');
	});

	test('streaming marks only the section that is arriving', () => {
		const partial = PACK.slice(0, PACK.indexOf('=== FACEBOOK ===') + 30);
		const [ig, fb, li] = specs();
		expect(fb!.extract(partial, true).state).toBe('streaming');
		expect(ig!.extract(partial, true).state).toBe('ok');
		expect(li!.extract(partial, true).state).toBe('empty');
	});

	test('editing the Instagram section to 7 hashtags puts it 2 over the cap', () => {
		const ig = specs()[0]!;
		const edited = 'A bright home.\n\n#A1 #B2 #C3 #D4 #E5 #F6 #G7';
		const a = ig.assemble(edited);
		expect(a.tagsOverCap).toBe(2);
		expect(a.keptTags).toHaveLength(5);
		expect(a.text.endsWith(DISCLOSURE)).toBe(true);
	});

	test('over the Instagram limit is counted with the disclosure included', () => {
		const ig = specs()[0]!;
		const body = 'A sunny porch and new counters. '.repeat(70).trim();
		const a = ig.assemble(body);
		expect(a.limit).toBe(2200);
		expect(a.over).toBe(a.text.length - 2200);
		expect(a.over).toBeGreaterThan(0);
	});

	test('the sample brief gives zero Fair Housing and number findings on all three cards', () => {
		for (const spec of specs()) {
			const text = spec.extract(PACK, false).text;
			expect(checkFairHousing(text)).toEqual([]);
			expect(runChecks(text, spec.postChecks)).toEqual([]);
		}
	});

	test('a number not in the brief is a Must fix finding; the link numbers are allowed', () => {
		const withLink = buildSocialSections(
			DISCLOSURE,
			'Open house Saturday 1 to 3.',
			'https://x.example/24'
		);
		const fb = withLink[1]!;
		const bad = runChecks('Open house Saturday 1 to 3. Only 5 days left.', fb.postChecks);
		expect(bad.map((f) => [f.phrase, f.severity])).toEqual([['5', 'block']]);
		expect(runChecks('See https://x.example/24 for 24 photos.', fb.postChecks)).toEqual([]);
	});

	test('number words are a Review finding', () => {
		const li = specs()[2]!;
		const f = runChecks('Rents rose twelve percent.', li.postChecks);
		expect(f.length).toBeGreaterThan(0);
		expect(f.every((x) => x.severity === 'warn')).toBe(true);
	});

	test('check groups: Number check then Numbers as words', () => {
		expect(SOCIAL_CHECK_GROUPS.map((g) => g.label)).toEqual(['Number check', 'Numbers as words']);
		expect(SOCIAL_CHECK_GROUPS[0]!.findingsTitle(1, 0)).toBe('Number check: 1 to fix');
	});
});
