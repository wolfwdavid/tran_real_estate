import { describe, expect, it } from 'vitest';
import { findBanned } from '../../../../../scripts/lib/banned-terms-rules.mjs';
import { audiences, type Audience } from './audiences';

/** Collects every string value in a nested object/array. */
function collectStrings(value: unknown, out: string[] = []): string[] {
	if (typeof value === 'string') out.push(value);
	else if (Array.isArray(value)) for (const v of value) collectStrings(v, out);
	else if (value && typeof value === 'object')
		for (const v of Object.values(value)) collectStrings(v, out);
	return out;
}

const entries = Object.entries(audiences) as [string, Audience][];

describe('audiences content', () => {
	it('has exactly the renter, investor and agent keys', () => {
		expect(Object.keys(audiences).sort()).toEqual(['agent', 'investor', 'renter']);
		for (const [key, a] of entries) expect(a.portal).toBe(key);
	});

	it('gives each audience 4 features, 3 limits and no empty strings', () => {
		for (const [, a] of entries) {
			expect(a.features).toHaveLength(4);
			expect(a.limits).toHaveLength(3);
			expect(a.limitsHeading).toBe('Good to know');
			for (const s of collectStrings(a)) expect(s.trim().length).toBeGreaterThan(0);
		}
	});

	it('uses the site title suffix and a for-* slug', () => {
		for (const [, a] of entries) {
			expect(a.docTitle.endsWith(': Tran Real Estate Tools')).toBe(true);
			expect(a.slug).toMatch(/^for-(renters|investors|agents)$/);
			expect(a.slug).toBe(`for-${a.portal}s`);
		}
	});

	it('passes the banned-terms rules', () => {
		const text = collectStrings(audiences).join('\n');
		expect(findBanned('audiences', text)).toEqual([]);
	});

	it('fails the banned-terms rules when a planted claim is added (control)', () => {
		const planted = structuredClone(audiences);
		planted.investor = {
			...planted.investor,
			features: planted.investor.features.map((f, i) =>
				i === 0 ? { ...f, body: 'guaranteed returns' } : f
			)
		};
		const text = collectStrings(planted).join('\n');
		expect(findBanned('audiences', text).length).toBeGreaterThan(0);
	});
});
