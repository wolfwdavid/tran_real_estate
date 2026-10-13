import { describe, expect, it } from 'vitest';
import { findBanned } from '../../../../../scripts/lib/banned-terms-rules.mjs';
import * as content from './tools';
import {
	DEFAULT_OG,
	SHARED_TOOL_COPY,
	TOOLS,
	TOOLS_HUB,
	TOOL_SLUGS,
	type ToolContent
} from './tools';

/** Collects every string value in a nested object/array (functions are rendered with a sample arg). */
function collectStrings(value: unknown, out: string[] = []): string[] {
	if (typeof value === 'string') out.push(value);
	else if (typeof value === 'function')
		out.push(String((value as (s: string) => string)('Sample')));
	else if (Array.isArray(value)) for (const v of value) collectStrings(v, out);
	else if (value && typeof value === 'object')
		for (const v of Object.values(value)) collectStrings(v, out);
	return out;
}

const tools = TOOL_SLUGS.map((slug) => TOOLS[slug]) as ToolContent[];
const PRIVACY_Q = 'Is anything I enter saved or sent?';

describe('tool content', () => {
	it('lists the four calculators in order', () => {
		expect(TOOL_SLUGS).toEqual(['affordability', 'cap-rate', 'cash-on-cash', 'dscr']);
		expect(Object.keys(TOOLS).sort()).toEqual([...TOOL_SLUGS].sort());
		for (const slug of TOOL_SLUGS) expect(TOOLS[slug].slug).toBe(slug);
	});

	it('gives every tool its title, a unique description, 5 FAQ items and the share-card text', () => {
		const descriptions = new Set<string>();
		for (const t of tools) {
			expect(t.docTitle).toBe(`${t.h1}: Tran Real Estate Tools`);
			expect(t.description.trim().length).toBeGreaterThan(0);
			descriptions.add(t.description);
			expect(t.faq).toHaveLength(5);
			expect(t.faq[4].q).toBe(PRIVACY_Q);
			expect(t.og.eyebrow).toBe('FREE CALCULATOR');
			expect(t.og.subline).toBe('Runs in your browser. No sign-up, no API key.');
			expect(t.ogAlt).toBe(`${t.h1}. Free calculator from Tran Real Estate Tools.`);
		}
		expect(descriptions.size).toBe(4);
		expect(descriptions.has(TOOLS_HUB.description)).toBe(false);
	});

	it('uses the route-table h1s', () => {
		expect(tools.map((t) => t.h1)).toEqual([
			'Rent affordability calculator',
			'Cap rate calculator',
			'Cash-on-cash return calculator',
			'DSCR calculator'
		]);
		expect(TOOLS_HUB.docTitle).toBe(`${TOOLS_HUB.h1}: Tran Real Estate Tools`);
	});

	it('uses the UI-SPEC example values in field order', () => {
		const examples = (slug: 'cap-rate' | 'cash-on-cash' | 'dscr') =>
			TOOLS[slug].fields.map((f) => f.example);
		expect(examples('cap-rate')).toEqual(['250,000', '2,000', '0', '5', '600']);
		expect(examples('cash-on-cash')).toEqual([
			'250,000',
			'25',
			'7,500',
			'7',
			'30',
			'2,000',
			'5',
			'600'
		]);
		expect(examples('dscr')).toEqual(['2,000', '5', '600', '187,500', '7', '30']);
		expect(TOOLS.affordability.fields).toEqual([]);
	});

	it('pairs each field kind with its accessible unit suffix and adornment', () => {
		const suffix = {
			money: ', in dollars',
			percent: ', as a percent',
			rate: ', as a percent',
			years: ', in years'
		};
		const adornment = { money: '$', percent: '%', rate: '%', years: 'years' };
		for (const t of tools)
			for (const f of t.fields) {
				expect(f.srSuffix).toBe(suffix[f.kind]);
				expect(f.adornment).toBe(adornment[f.kind]);
			}
		const price = TOOLS['cap-rate'].fields[0];
		expect(price.positive).toBe(true);
		const loan = TOOLS.dscr.fields.find((f) => f.id === 'loanAmount');
		expect(loan?.positive).not.toBe(true);
		expect(TOOLS['cap-rate'].fields.find((f) => !f.required)?.label).toBe(
			'Other monthly income (optional)'
		);
	});

	it('marks the cards: renter for affordability, investor for the rest and the hub, none for the default', () => {
		expect(TOOLS.affordability.og.mark).toBe('renter');
		for (const slug of ['cap-rate', 'cash-on-cash', 'dscr'] as const)
			expect(TOOLS[slug].og.mark).toBe('investor');
		expect(TOOLS_HUB.og.mark).toBe('investor');
		expect(DEFAULT_OG.mark).toBe(null);
	});

	it('keeps the share-card line breaks the renderer was checked against (10-07 overflow fixtures)', () => {
		expect(TOOLS.affordability.og.titleLines).toEqual(['Rent affordability', 'calculator']);
		expect(TOOLS['cap-rate'].og.titleLines).toEqual(['Cap rate', 'calculator']);
		expect(TOOLS['cash-on-cash'].og.titleLines).toEqual(['Cash-on-cash', 'return calculator']);
		expect(TOOLS.dscr.og.titleLines).toEqual(['DSCR calculator']);
		expect(TOOLS_HUB.og.titleLines).toEqual(['Free real estate', 'calculators']);
		expect(DEFAULT_OG.titleLines).toEqual(['Real estate tools that', 'do the refreshing for you']);
	});

	it('sends the investor calculators to the analyzer and affordability to the renter portal', () => {
		for (const slug of ['cap-rate', 'cash-on-cash', 'dscr'] as const) {
			expect(TOOLS[slug].goFurther.heading).toBe('Analyze the whole deal');
			expect(TOOLS[slug].goFurther.primary.path).toBe('/investor/analyze/');
			expect(TOOLS[slug].goFurther.sample.path).toBe('/investor/');
		}
		expect(TOOLS.affordability.goFurther.heading).toBe('Find rentals that fit');
		expect(TOOLS.affordability.goFurther.primary.path).toBe('/renter/');
		expect(TOOLS.affordability.goFurther.sample.path).toBe('/renter/');
	});

	it('renders the validation templates', () => {
		expect(SHARED_TOOL_COPY.validation.required('Monthly rent')).toBe('Enter monthly rent.');
		expect(SHARED_TOOL_COPY.validation.min('1')).toBe('Enter 1 or more.');
		expect(SHARED_TOOL_COPY.validation.max('40')).toBe('Enter 40 or less.');
	});

	it('passes the banned-terms rules', () => {
		const text = collectStrings(content).join('\n');
		expect(text.length).toBeGreaterThan(1000);
		expect(findBanned('tools', JSON.stringify(content))).toEqual([]);
		expect(findBanned('tools', text)).toEqual([]);
	});

	it('fails the banned-terms rules when a planted claim is added (control)', () => {
		const planted = { ...TOOLS.dscr, lead: 'Guaranteed returns on every deal.' };
		expect(findBanned('tools', collectStrings(planted).join('\n')).length).toBeGreaterThan(0);
	});

	it('makes no claims about user counts', () => {
		const claim = /\b\d[\d,]*\+?\s+(users|people|investors|renters|agents)\b/i;
		expect(collectStrings(content).filter((s) => claim.test(s))).toEqual([]);
		expect(claim.test('2,000 renters')).toBe(true);
	});
});
