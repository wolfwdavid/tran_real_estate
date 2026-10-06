import { describe, expect, it } from 'vitest';

import { EMPTY_PROFILE_INPUT, type ProfileInput } from '../agent/types.js';
import { composeDisclosure, missingForDrafts } from './compose.js';
import {
	GENERIC_RULE,
	PROFILE_FIELD_LABELS,
	STATE_RULES,
	ruleFor,
	type RuleId,
	type RuleTable
} from './state-rules.js';

const SEP = ' \u00b7 ';

function profile(overrides: Partial<ProfileInput> = {}): ProfileInput {
	return {
		...EMPTY_PROFILE_INPUT,
		postal: { ...EMPTY_PROFILE_INPUT.postal },
		...overrides
	};
}

const FULL = {
	brokerage: 'Example Realty',
	name: 'Sample Agent',
	licenseType: 'salesperson' as const,
	licenseNumber: '12345',
	brokeragePhone: '(555) 555-0100',
	brokerageLicenseNumber: '67890',
	iabsUrl: 'https://example.com/iabs.pdf'
};

const STATE_FOR: Record<RuleId, string> = {
	generic: 'WA',
	FL: 'FL',
	NJ: 'NJ',
	OH: 'OH',
	CA: 'CA',
	NY: 'NY',
	TX: 'TX'
};

const ALL_RULES: RuleId[] = ['generic', 'FL', 'NJ', 'OH', 'CA', 'NY', 'TX'];

/**
 * Returns null when the composed text names the brokerage before the agent, otherwise a failure
 * message. The real presence test and the planted control both use this helper.
 */
function brokerageFirstFailure(text: string, brokerage: string, name: string): string | null {
	const b = text.indexOf(brokerage);
	const n = text.indexOf(name);
	if (b < 0) return `brokerage "${brokerage}" missing`;
	if (n < 0) return `name "${name}" missing`;
	if (b > n) return 'brokerage appears after the agent name';
	return null;
}

describe('composeDisclosure: base line', () => {
	it('generic state uses the locked format', () => {
		const r = composeDisclosure(profile({ ...FULL, licenseState: 'WA' }), 'email');
		expect(r.rule).toBe('generic');
		expect(r.lines[0]).toBe(
			`Example Realty${SEP}Sample Agent, Real Estate Salesperson${SEP}Lic. #12345 (WA)${SEP}(555) 555-0100`
		);
		expect(r.text).toBe(r.lines.join('\n'));
		expect(r.missing).toEqual([]);
	});

	it('team variant leads with "{Team} at {Brokerage}"', () => {
		const r = composeDisclosure(
			profile({ ...FULL, licenseState: 'WA', teamName: 'The Sample Team' })
		);
		expect(r.lines[0]!.startsWith(`The Sample Team at Example Realty${SEP}`)).toBe(true);
	});

	it('omits empty optional segments', () => {
		const r = composeDisclosure(
			profile({ brokerage: 'Example Realty', name: 'Sample Agent', licenseState: 'WA' })
		);
		expect(r.lines[0]).toBe(`Example Realty${SEP}Sample Agent`);
	});

	it('license number without state has no parenthesis', () => {
		const r = composeDisclosure(profile({ ...FULL, licenseState: '' }));
		expect(r.lines[0]).toContain(`Lic. #12345${SEP}`);
	});

	it('every rule requires name and brokerage', () => {
		for (const id of ALL_RULES) {
			const r = composeDisclosure(profile({ licenseState: STATE_FOR[id] }));
			expect(r.rule).toBe(id);
			expect(r.missing).toContain('name');
			expect(r.missing).toContain('brokerage');
		}
	});
});

describe('composeDisclosure: brokerage presence for all 7 rules', () => {
	for (const id of ALL_RULES) {
		it(`${id}: brokerage present and before the agent name`, () => {
			const r = composeDisclosure(profile({ ...FULL, licenseState: STATE_FOR[id] }));
			expect(r.rule).toBe(id);
			expect(brokerageFirstFailure(r.text, FULL.brokerage, FULL.name)).toBeNull();
		});
		it(`${id}: team variant still names the brokerage first`, () => {
			const r = composeDisclosure(
				profile({ ...FULL, licenseState: STATE_FOR[id], teamName: 'The Sample Team' })
			);
			expect(r.lines[0]).toContain('The Sample Team at Example Realty');
			expect(brokerageFirstFailure(r.text, FULL.brokerage, FULL.name)).toBeNull();
		});
	}

	it('planted control: a FL template without the brokerage is caught by the same helper', () => {
		const mutated: RuleTable = {
			...STATE_RULES,
			FL: { ...STATE_RULES.FL, template: (s) => [s.agent, s.license, s.phone] }
		};
		const r = composeDisclosure(profile({ ...FULL, licenseState: 'FL' }), 'email', {
			rules: mutated
		});
		expect(r.rule).toBe('FL');
		expect(brokerageFirstFailure(r.text, FULL.brokerage, FULL.name)).not.toBeNull();
		// The unmutated table passes for the same profile.
		const ok = composeDisclosure(profile({ ...FULL, licenseState: 'FL' }));
		expect(brokerageFirstFailure(ok.text, FULL.brokerage, FULL.name)).toBeNull();
	});
});

describe('composeDisclosure: state rules', () => {
	const title = (state: string, licenseType: ProfileInput['licenseType']) =>
		composeDisclosure(profile({ ...FULL, licenseState: state, licenseType })).lines[0];

	it('NY titles and the banned bare title', () => {
		expect(title('NY', 'salesperson')).toContain('Sample Agent, Licensed Real Estate Salesperson');
		expect(title('NY', 'associate-broker')).toContain(
			'Sample Agent, Licensed Associate Real Estate Broker'
		);
		expect(title('NY', 'broker')).toContain('Sample Agent, Licensed Real Estate Broker');
		const r = composeDisclosure(
			profile({ ...FULL, licenseState: 'NY', licenseType: 'sales-associate' })
		);
		expect(r.missing).toContain('licenseType');
		expect(r.warnings).toContain('ny-title');
		expect(r.text).not.toMatch(/sales associate/i);
	});

	it('NY requires brokerage phone and license type', () => {
		const r = composeDisclosure(
			profile({ ...FULL, licenseState: 'NY', brokeragePhone: '', licenseType: '' })
		);
		expect(r.missing).toEqual(expect.arrayContaining(['brokeragePhone', 'licenseType']));
		const ok = composeDisclosure(profile({ ...FULL, licenseState: 'NY' }));
		expect(ok.missing).toEqual([]);
	});

	it('NJ titles and required brokerage phone', () => {
		expect(title('NJ', 'salesperson')).toContain(', Real Estate Salesperson');
		expect(title('NJ', 'associate-broker')).toContain(', Broker-Salesperson');
		expect(title('NJ', 'broker')).toContain(', Real Estate Broker');
		expect(title('NJ', 'sales-associate')).toContain(', Sales Associate');
		const r = composeDisclosure(profile({ ...FULL, licenseState: 'NJ', brokeragePhone: '' }));
		expect(r.missing).toEqual(['brokeragePhone']);
		const wa = composeDisclosure(profile({ ...FULL, licenseState: 'WA', brokeragePhone: '' }));
		expect(wa.missing).toEqual([]);
	});

	it('FL titles; license number not required', () => {
		expect(title('FL', 'salesperson')).toContain(', Sales Associate');
		expect(title('FL', 'associate-broker')).toContain(', Broker Associate');
		expect(title('FL', 'broker')).toContain('Sample Agent, Broker');
		expect(title('FL', 'sales-associate')).toContain(', Sales Associate');
		const r = composeDisclosure(profile({ ...FULL, licenseState: 'FL', licenseNumber: '' }));
		expect(r.missing).toEqual([]);
	});

	it('CA requires a license number and adds the brokerage license line', () => {
		const r = composeDisclosure(profile({ ...FULL, licenseState: 'CA' }));
		expect(r.lines).toContain('Example Realty Lic. #67890 (CA)');
		const noBroker = composeDisclosure(
			profile({ ...FULL, licenseState: 'CA', brokerageLicenseNumber: '' })
		);
		expect(noBroker.lines).toHaveLength(1);
		const noLic = composeDisclosure(profile({ ...FULL, licenseState: 'CA', licenseNumber: '' }));
		expect(noLic.missing).toEqual(['licenseNumber']);
		const wa = composeDisclosure(profile({ ...FULL, licenseState: 'WA', licenseNumber: '' }));
		expect(wa.missing).toEqual([]);
		expect(wa.lines).toHaveLength(1);
	});

	it('OH uses generic titles and requires only brokerage and name', () => {
		expect(title('OH', 'associate-broker')).toContain(', Associate Broker');
		const r = composeDisclosure(
			profile({
				brokerage: 'Example Realty',
				name: 'Sample Agent',
				licenseState: 'OH'
			})
		);
		expect(r.rule).toBe('OH');
		expect(r.missing).toEqual([]);
	});

	it('TX adds the IABS and Consumer Protection Notice lines', () => {
		const r = composeDisclosure(profile({ ...FULL, licenseState: 'TX' }));
		expect(r.lines).toContain('Information About Brokerage Services: https://example.com/iabs.pdf');
		expect(r.lines).toContain(
			'Texas Real Estate Commission Consumer Protection Notice: https://www.trec.texas.gov/forms/consumer-protection-notice'
		);
		const noIabs = composeDisclosure(profile({ ...FULL, licenseState: 'TX', iabsUrl: '' }));
		expect(noIabs.lines.some((l) => l.startsWith('Information About Brokerage'))).toBe(false);
		expect(noIabs.lines.some((l) => l.includes('consumer-protection-notice'))).toBe(true);
		const wa = composeDisclosure(profile({ ...FULL, licenseState: 'WA' }));
		expect(wa.text).not.toContain('Information About Brokerage');
	});

	it('generic titles', () => {
		expect(title('WA', 'salesperson')).toContain(', Real Estate Salesperson');
		expect(title('WA', 'associate-broker')).toContain(', Associate Broker');
		expect(title('WA', 'broker')).toContain(', Real Estate Broker');
		expect(title('WA', 'sales-associate')).toContain(', Sales Associate');
	});

	it('ruleFor is case-insensitive and falls back to the generic rule', () => {
		expect(ruleFor('ny').id).toBe('NY');
		expect(ruleFor('ZZ')).toBe(GENERIC_RULE);
		expect(ruleFor('')).toBe(GENERIC_RULE);
	});

	it('every rule cites a source', () => {
		for (const rule of [...Object.values(STATE_RULES), GENERIC_RULE]) {
			expect(rule.source.trim().length).toBeGreaterThan(0);
		}
		expect(Object.keys(STATE_RULES).sort()).toEqual(['CA', 'FL', 'NJ', 'NY', 'OH', 'TX']);
	});
});

describe('composeDisclosure: placeholders', () => {
	it('renders bracketed placeholders only when asked', () => {
		const p = profile({ licenseState: 'NY' });
		const preview = composeDisclosure(p, 'web', { placeholders: true });
		for (const ph of ['[Brokerage]', '[Full name]', '[License type]', '[Brokerage phone]']) {
			expect(preview.text).toContain(ph);
		}
		const plain = composeDisclosure(p, 'web');
		expect(plain.text).not.toContain('[');
	});

	it('CA preview shows the license-number placeholder', () => {
		const p = profile({ brokerage: 'Example Realty', name: 'Sample Agent', licenseState: 'CA' });
		expect(composeDisclosure(p, 'web', { placeholders: true }).text).toContain('[License number]');
		expect(composeDisclosure(p).text).not.toContain('[License number]');
	});
});

describe('missingForDrafts and labels', () => {
	it('lists draft prerequisites in order, de-duplicated', () => {
		expect(missingForDrafts(profile({ licenseState: 'NY' }))).toEqual([
			'name',
			'brokerage',
			'licenseType',
			'licenseNumber',
			'brokeragePhone',
			'postal',
			'email'
		]);
		expect(missingForDrafts(profile())).toEqual([
			'name',
			'brokerage',
			'licenseNumber',
			'licenseState',
			'postal',
			'email'
		]);
	});

	it('is empty for a complete profile; a partial postal counts as missing', () => {
		const full = profile({
			...FULL,
			licenseState: 'WA',
			email: 'agent@example.com',
			postal: { street: '1 Sample St', line2: '', city: 'Sampleton', state: 'WA', zip: '98000' }
		});
		expect(missingForDrafts(full)).toEqual([]);
		expect(missingForDrafts({ ...full, postal: { ...full.postal, zip: '' } })).toEqual(['postal']);
	});

	it('labels every field', () => {
		expect(PROFILE_FIELD_LABELS).toEqual({
			name: 'Full name',
			brokerage: 'Brokerage',
			licenseNumber: 'License number',
			licenseState: 'License state',
			licenseType: 'License type',
			brokeragePhone: 'Brokerage phone',
			postal: 'Mailing address',
			email: 'Email'
		});
	});
});
