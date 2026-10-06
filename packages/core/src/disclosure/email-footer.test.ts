import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { EMPTY_PROFILE_INPUT, type ProfileInput } from '../agent/types.js';
import { SAMPLE_AGENT_PROFILE } from '../agent/fixtures/sample-profile.js';
import { composeDisclosure, missingForDrafts } from './compose.js';
import {
	AD_IDENTIFICATION_LINE,
	OPT_OUT_LINE,
	appendFooter,
	composeEmailFooter,
	formatPostal
} from './email-footer.js';

const SEP = ' \u00B7 ';

const POSTAL = {
	street: '12 Sample Lane',
	line2: 'Suite 2',
	city: 'Harlow Springs',
	state: 'TX',
	zip: '75001'
};

function profile(overrides: Partial<ProfileInput> = {}): ProfileInput {
	return {
		...EMPTY_PROFILE_INPUT,
		name: 'Sample Agent',
		brokerage: 'Example Realty',
		licenseType: 'salesperson',
		licenseNumber: '12345',
		licenseState: 'TX',
		brokeragePhone: '(555) 555-0100',
		phone: '(555) 555-0142',
		email: 'agent@example.com',
		website: 'https://example.com',
		postal: { ...POSTAL },
		...overrides
	};
}

describe('constants', () => {
	it('opt-out and ad identification lines are verbatim', () => {
		expect(OPT_OUT_LINE).toBe('Reply STOP or unsubscribe to stop receiving emails from me.');
		expect(AD_IDENTIFICATION_LINE).toBe('This email is a solicitation for real estate services.');
	});
});

describe('formatPostal', () => {
	it('joins the address on one line', () => {
		expect(formatPostal(POSTAL)).toBe('12 Sample Lane, Suite 2, Harlow Springs, TX 75001');
		expect(formatPostal({ ...POSTAL, line2: '' })).toBe('12 Sample Lane, Harlow Springs, TX 75001');
	});
});

describe('composeEmailFooter', () => {
	it('inquiry-form consent: exact line order, no ad identification', () => {
		const p = profile();
		const f = composeEmailFooter(p, { consentSource: 'inquiry-form' });
		expect(f.lines).toEqual([
			'Sample Agent',
			'Example Realty',
			`(555) 555-0142${SEP}agent@example.com${SEP}https://example.com`,
			'',
			'12 Sample Lane, Suite 2, Harlow Springs, TX 75001',
			OPT_OUT_LINE,
			...composeDisclosure(p, 'email').lines
		]);
		expect(f.text).toBe(f.lines.join('\n'));
		expect(f.text).not.toContain(AD_IDENTIFICATION_LINE);
	});

	it("'unknown' consent inserts the ad identification line right after the opt-out line", () => {
		const f = composeEmailFooter(profile(), { consentSource: 'unknown' });
		const i = f.lines.indexOf(OPT_OUT_LINE);
		expect(i).toBeGreaterThan(0);
		expect(f.lines[i + 1]).toBe(AD_IDENTIFICATION_LINE);
	});

	it('team line and omitted contact line', () => {
		const f = composeEmailFooter(
			profile({ teamName: 'The Sample Team', phone: '', email: '', website: '' }),
			{ consentSource: 'inquiry-form' }
		);
		expect(f.lines[1]).toBe('The Sample Team at Example Realty');
		expect(f.lines[2]).toBe('');
		const partial = composeEmailFooter(profile({ phone: '', website: '' }), {
			consentSource: 'inquiry-form'
		});
		expect(partial.lines[2]).toBe('agent@example.com');
	});

	it('missing mirrors missingForDrafts', () => {
		for (const p of [profile(), profile({ email: '', licenseNumber: '' }), EMPTY_PROFILE_INPUT]) {
			expect(composeEmailFooter(p, { consentSource: 'unknown' }).missing).toEqual(
				missingForDrafts(p)
			);
		}
	});

	it('the sample agent profile produces a complete footer', () => {
		const f = composeEmailFooter(SAMPLE_AGENT_PROFILE, { consentSource: 'inquiry-form' });
		expect(f.text).toContain(OPT_OUT_LINE);
		expect(f.text).toContain(formatPostal(SAMPLE_AGENT_PROFILE.postal));
		expect(f.text).toContain(SAMPLE_AGENT_PROFILE.brokerage);
	});

	it('contains no HTML and no sms: text', () => {
		const f = composeEmailFooter(profile(), { consentSource: 'unknown' });
		expect(f.text).not.toContain('<');
		expect(f.text).not.toContain('sms:');
	});

	it('appendFooter puts the footer last after a blank line', () => {
		expect(appendFooter('Hello there.\n\n  ', 'FOOTER')).toBe('Hello there.\n\nFOOTER');
	});
});

describe('presence property', () => {
	const nonBlank = fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim() !== '');
	const arbProfile = fc.record({
		name: nonBlank,
		brokerage: nonBlank,
		teamName: fc.string({ maxLength: 20 }),
		licenseState: fc.constantFrom('FL', 'NJ', 'OH', 'CA', 'NY', 'TX', 'WA', ''),
		licenseType: fc.constantFrom(
			'' as const,
			'salesperson' as const,
			'associate-broker' as const,
			'broker' as const,
			'sales-associate' as const
		),
		licenseNumber: fc.string({ maxLength: 12 }),
		street: nonBlank,
		line2: fc.string({ maxLength: 10 }),
		city: nonBlank,
		state: nonBlank,
		zip: nonBlank,
		consent: fc.constantFrom('inquiry-form' as const, 'unknown' as const)
	});

	it('footer always holds the postal address, opt-out line and every disclosure line, last', () => {
		fc.assert(
			fc.property(arbProfile, fc.string(), (a, draft) => {
				const p = profile({
					name: a.name,
					brokerage: a.brokerage,
					teamName: a.teamName,
					licenseState: a.licenseState,
					licenseType: a.licenseType,
					licenseNumber: a.licenseNumber,
					postal: { street: a.street, line2: a.line2, city: a.city, state: a.state, zip: a.zip }
				});
				const f = composeEmailFooter(p, { consentSource: a.consent });
				expect(f.text).toContain(formatPostal(p.postal));
				expect(f.text).toContain(OPT_OUT_LINE);
				for (const line of composeDisclosure(p, 'email').lines) {
					expect(f.text).toContain(line);
				}
				expect(`${draft}\n\n${f.text}`.endsWith(f.text)).toBe(true);
				expect(appendFooter(draft, f.text).endsWith(f.text)).toBe(true);
			}),
			{ numRuns: 200 }
		);
	});
});
