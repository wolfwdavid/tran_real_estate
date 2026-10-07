// SSR tests for the shared studio components (09-12). svelte/server renders each component to a
// string in the node project; resolve() from $app/paths is stubbed (base ''). The input note's
// 300 ms debounce lives in an $effect, which SSR never runs, so its copy is tested through the
// pure noteRows/noteRowsFor helpers exported from the component's module script.
import { render } from 'svelte/server';
import type { Component } from 'svelte';
import { describe, expect, test } from 'vitest';
import type { ProfileInput } from '@tran/core/agent/types';
import { composeDisclosure } from '@tran/core/disclosure';
import { checkFairHousing } from '@tran/core/fair-housing';
import { SAMPLE_AGENT_PROFILE } from '$lib/features/shared/agent-profile';
import CharacterCount from './CharacterCount.svelte';
import DisclosureStatus from './DisclosureStatus.svelte';
import InputFairHousingNote, {
	INPUT_NOTE_DELAY_MS,
	noteRows,
	noteRowsFor
} from './InputFairHousingNote.svelte';

const strip = (h: string) => h.replace(/<!--[\s\S]*?-->/g, '');
/** Visible text with tags dropped and whitespace collapsed. */
const textOf = (h: string) =>
	strip(h)
		.replace(/<[^>]+>/g, ' ')
		.replace(/&#39;|&apos;/g, "'")
		.replace(/&quot;/g, '"')
		.replace(/&amp;/g, '&')
		.replace(/\s+/g, ' ')
		.trim();
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- each case passes its component's props
const html = <P extends Record<string, any>>(C: Component<P>, props: P) =>
	strip(render(C, { props }).body);

const profile = (over: Partial<ProfileInput> = {}): ProfileInput =>
	({ ...SAMPLE_AGENT_PROFILE, ...over }) as ProfileInput;

const NOTE =
	"Check your disclosure against your state's and brokerage's advertising rules. This isn't legal advice.";

describe('DisclosureStatus', () => {
	test('ready: title, lead-in, the composed ad-inline line, Edit in your profile, note', () => {
		const p = profile({ name: 'Jordan Rivera', licenseState: 'CA' });
		const h = html(DisclosureStatus, { profile: p, usingSample: false });
		const t = textOf(h);
		expect(h).toContain('data-disclosure-status="ready"');
		expect(t).toContain('Your disclosure is ready');
		expect(t).toContain('Added to the end of every description, post, and script you copy:');
		const line = composeDisclosure(p, { variant: 'ad-inline' }).text;
		expect(line).toContain('Jordan Rivera');
		expect(t).toContain(line);
		expect(h).toMatch(/<a\b[^>]*href="\/agent\/profile\/"[^>]*>\s*Edit in your profile\s*<\/a>/);
		expect(t).toContain(NOTE);
		expect(t).not.toContain('Finish your profile');
	});

	test('incomplete NY profile lists license number and brokerage phone', () => {
		const p = profile({ licenseState: 'NY', licenseNumber: '', brokeragePhone: '' });
		const h = html(DisclosureStatus, { profile: p, usingSample: false });
		const t = textOf(h);
		expect(h).toContain('data-disclosure-status="incomplete"');
		expect(t).toContain('Finish your profile to copy studio content');
		expect(t).toContain('Missing: license number, brokerage phone.');
		expect(t).toContain('You can still write drafts now.');
		expect(h).toMatch(/<a\b[^>]*href="\/agent\/profile\/"[^>]*>\s*Finish your profile\s*<\/a>/);
		expect(t).toContain(NOTE);
		// No disclosure line is shown while fields are missing.
		expect(h).not.toContain('data-disclosure-text');
	});

	test('a CA profile without a brokerage phone is complete (phone required only in NY and NJ)', () => {
		const h = html(DisclosureStatus, {
			profile: profile({ licenseState: 'CA', brokeragePhone: '' }),
			usingSample: false
		});
		expect(h).toContain('data-disclosure-status="ready"');
	});

	test('an NJ profile without a brokerage phone is incomplete', () => {
		const t = textOf(
			html(DisclosureStatus, {
				profile: profile({ licenseState: 'NJ', brokeragePhone: '' }),
				usingSample: false
			})
		);
		expect(t).toContain('Missing: brokerage phone.');
	});

	test('no saved profile: every base field is missing', () => {
		const t = textOf(html(DisclosureStatus, { profile: null, usingSample: false }));
		expect(t).toContain(
			'Missing: full name, brokerage, license type, license number, license state.'
		);
	});

	test('sample: the sample line, Set up your profile, and the Avery Sample ad-inline line', () => {
		const h = html(DisclosureStatus, { profile: null, usingSample: true });
		const t = textOf(h);
		expect(h).toContain('data-disclosure-status="sample"');
		expect(t).toContain('Using a sample agent profile with sample facts.');
		expect(h).toMatch(/<a\b[^>]*href="\/agent\/profile\/"[^>]*>\s*Set up your profile\s*<\/a>/);
		expect(t).toContain('to use your own details.');
		const line = composeDisclosure(SAMPLE_AGENT_PROFILE, { variant: 'ad-inline' }).text;
		expect(line).toContain('Avery Sample');
		expect(t).toContain(line);
		expect(t).toContain(NOTE);
	});

	test('token classes only: no raw hex and no dark: variants', () => {
		for (const usingSample of [true, false]) {
			const h = html(DisclosureStatus, { profile: profile(), usingSample });
			expect(h).not.toMatch(/#[0-9A-Fa-f]{6}\b/);
			expect(h).not.toContain('dark:');
		}
	});
});

describe('InputFairHousingNote', () => {
	test('debounce is 300 ms', () => {
		expect(INPUT_NOTE_DELAY_MS).toBe(300);
	});

	test('"Ideal for families" gives one row in the input-note copy', () => {
		const findings = checkFairHousing('Ideal for families');
		expect(findings).toHaveLength(1);
		const rows = noteRowsFor('Ideal for families');
		expect(rows).toHaveLength(1);
		expect(rows[0].text).toBe(
			`"${findings[0].phrase}" may describe people rather than the home. ${findings[0].members[0].explanation} It will be flagged in the draft too.`
		);
		expect(
			rows[0].text.startsWith('"Ideal for families" may describe people rather than the home. ')
		).toBe(true);
	});

	test('the phrase is quoted exactly as the checker matched it (original casing)', () => {
		const rows = noteRowsFor('Bright rooms, IDEAL FOR FAMILIES near parks.');
		expect(rows).toHaveLength(1);
		expect(rows[0].text.startsWith('"IDEAL FOR FAMILIES" may describe')).toBe(true);
	});

	test('clean text gives no rows', () => {
		expect(noteRowsFor('Sunny two-bedroom with hardwood floors near the park.')).toEqual([]);
		expect(noteRowsFor('')).toEqual([]);
		expect(noteRows([])).toEqual([]);
	});

	test('SSR renders only the empty described-by target (the check runs after mount)', () => {
		const h = html(InputFairHousingNote, { text: 'Ideal for families', id: 'facts-other-note' });
		expect(h).toMatch(/<div\b[^>]*id="facts-other-note"/);
		expect(h).not.toContain('<li');
		expect(textOf(h)).toBe('');
	});
});

describe('CharacterCount', () => {
	test('over the limit: icon plus the over text in Label 14/600', () => {
		const h = html(CharacterCount, {
			length: 2250,
			limit: 2200,
			text: '2,250 of 2,200 characters',
			overText: '50 characters over the Instagram limit'
		});
		expect(h).toContain('data-char-count="over"');
		expect(h).toContain('lucide-triangle-alert');
		expect(h).toMatch(/class="[^"]*\bfont-semibold\b[^"]*\btext-foreground\b/);
		expect(h).toMatch(/class="[^"]*\btext-label\b/);
		expect(textOf(h)).toBe('50 characters over the Instagram limit');
		expect(h).not.toContain('text-destructive');
		expect(h).not.toContain('text-primary');
	});

	test('within the limit: muted Label 14/400 line, no icon', () => {
		const h = html(CharacterCount, { length: 120, limit: 2200, text: '120 of 2,200 characters' });
		expect(h).toContain('data-char-count="within"');
		expect(h).not.toContain('<svg');
		expect(h).toMatch(/class="[^"]*\btext-muted-foreground\b/);
		expect(h).not.toContain('font-semibold');
		expect(textOf(h)).toBe('120 of 2,200 characters');
	});

	test('no limit is never over', () => {
		const h = html(CharacterCount, { length: 99999, text: '99,999 characters' });
		expect(h).toContain('data-char-count="within"');
	});

	test('exactly at the limit is within', () => {
		const h = html(CharacterCount, { length: 2200, limit: 2200, text: '2,200 of 2,200' });
		expect(h).toContain('data-char-count="within"');
	});
});
