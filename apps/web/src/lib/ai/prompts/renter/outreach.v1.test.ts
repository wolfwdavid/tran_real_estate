import { describe, expect, expectTypeOf, it } from 'vitest';
import { checkFairHousing } from '@tran/core/fair-housing';
import { FIXTURE_OUTPUTS } from '../../providers/fixture-outputs.js';
import { buildPrompt, getPrompt } from '../registry.js';
import {
	RENTER_OUTREACH_PROMPT_ID,
	buildOutreachInputs,
	renterOutreachV1,
	type RenterOutreachForm,
	type RenterOutreachInputs,
	type RenterOutreachListing
} from './outreach.v1.js';

const LISTING: RenterOutreachListing = {
	streetLine: '18 Example Lane',
	city: 'Springfield',
	state: 'IL',
	zipCode: '62701',
	rent: 2150,
	bedrooms: 2,
	bathrooms: 1,
	propertyType: 'Apartment',
	daysOnMarket: 12,
	contactName: 'Casey Morgan'
};

const FORM: RenterOutreachForm = {
	moveInDate: '2026-11-01',
	occupants: '3',
	pets: 'none',
	petDescription: '',
	topics: { availability: true, pets: true, fees: true, lease: true },
	extraQuestion: ''
};

const form = (o: Partial<RenterOutreachForm> = {}): RenterOutreachForm => ({ ...FORM, ...o });

const TOPIC_LINES = {
	availability: 'availability and move-in timing',
	pets: 'pet policy and pet fees',
	fees: 'application fees and deposit',
	lease: 'lease length and terms'
} as const;

describe('RenterOutreachInputs', () => {
	it('has exactly six keys: no household, age or relationship input can exist', () => {
		expectTypeOf<keyof RenterOutreachInputs>().toEqualTypeOf<
			'listing' | 'moveInDate' | 'occupants' | 'pets' | 'topics' | 'extraQuestion'
		>();
		const built = buildOutreachInputs(LISTING, FORM);
		expect(Object.keys(built).sort()).toEqual(
			['extraQuestion', 'listing', 'moveInDate', 'occupants', 'pets', 'topics'].sort()
		);
	});
});

describe('buildOutreachInputs', () => {
	it('keeps occupants as a whole number from 1 to 12, else null', () => {
		expect(buildOutreachInputs(LISTING, form({ occupants: '3' })).occupants).toBe(3);
		expect(buildOutreachInputs(LISTING, form({ occupants: '12' })).occupants).toBe(12);
		for (const bad of ['0', '13', '2.5', 'two', '', ' ', '-1', '1e1']) {
			expect(buildOutreachInputs(LISTING, form({ occupants: bad })).occupants).toBeNull();
		}
	});

	it('maps pets to yes/no plus a trimmed description capped at 60 characters', () => {
		expect(buildOutreachInputs(LISTING, form({ pets: 'none', petDescription: 'cat' })).pets).toEqual(
			{ has: false }
		);
		expect(
			buildOutreachInputs(LISTING, form({ pets: 'yes', petDescription: '  one cat  ' })).pets
		).toEqual({ has: true, description: 'one cat' });
		const long = buildOutreachInputs(LISTING, form({ pets: 'yes', petDescription: 'x'.repeat(80) }));
		expect(long.pets).toEqual({ has: true, description: 'x'.repeat(60) });
	});

	it('trims the extra question and caps it at 500 characters; empty move-in date is null', () => {
		const b = buildOutreachInputs(
			LISTING,
			form({ extraQuestion: `  ${'q'.repeat(600)}  `, moveInDate: '  ' })
		);
		expect(b.extraQuestion).toBe('q'.repeat(500));
		expect(b.moveInDate).toBeNull();
		expect(buildOutreachInputs(LISTING, FORM).moveInDate).toBe('2026-11-01');
	});

	it('copies the topics without sharing the form object', () => {
		const f = form();
		const b = buildOutreachInputs(LISTING, f);
		f.topics.fees = false;
		expect(b.topics.fees).toBe(true);
	});
});

describe('renter/outreach.v1 prompt', () => {
	const inputs = (o: Partial<RenterOutreachForm> = {}) => buildOutreachInputs(LISTING, form(o));

	it('is registered with the renter outreach id and carries client data', () => {
		expect(RENTER_OUTREACH_PROMPT_ID).toBe('renter/outreach.v1');
		const def = getPrompt('renter/outreach.v1');
		expect(def).toBe(renterOutreachV1);
		expect(def.id).toBe('renter/outreach.v1');
		expect(def.version).toBe(1);
		expect(def.feature).toBe('renter-outreach');
		expect(def.containsClientData).toBe(true);
		expect(def.housingCopy).toBe(true);
		expect(def.maxTokens).toBeGreaterThanOrEqual(2048);
	});

	it('states the occupant number and never a household description', async () => {
		const built = await buildPrompt('renter/outreach.v1', inputs({ occupants: '3' }));
		expect(built.user).toContain('People who would live there: 3');
		expect(built.user).not.toMatch(/household|children|kids|ages?\b|relationship|married/i);
		const none = await buildPrompt('renter/outreach.v1', inputs({ occupants: 'two' }));
		expect(none.user).not.toContain('People who would live there');
	});

	it('lists all four topics when all are on, and only fees when only fees is on', async () => {
		const all = await buildPrompt('renter/outreach.v1', inputs());
		for (const line of Object.values(TOPIC_LINES)) expect(all.user).toContain(line);

		const fees = await buildPrompt(
			'renter/outreach.v1',
			inputs({ topics: { availability: false, pets: false, fees: true, lease: false } })
		);
		expect(fees.user).toContain(TOPIC_LINES.fees);
		for (const k of ['availability', 'pets', 'lease'] as const) {
			expect(fees.user).not.toContain(TOPIC_LINES[k]);
		}
	});

	it('says there are no pets, or passes the short pet description', async () => {
		const none = await buildPrompt('renter/outreach.v1', inputs({ pets: 'none' }));
		expect(none.user).toContain('Pets: none');
		const cat = await buildPrompt(
			'renter/outreach.v1',
			inputs({ pets: 'yes', petDescription: 'one cat' })
		);
		expect(cat.user).toContain('Pets: one cat');
	});

	it('includes listing facts as short lines', async () => {
		const built = await buildPrompt('renter/outreach.v1', inputs());
		expect(built.user).toContain('18 Example Lane, Springfield, IL 62701');
		expect(built.user).toContain('$2,150 a month');
		expect(built.user).toContain('2 bedrooms');
		expect(built.user).toContain('1 bathroom');
		expect(built.user).toContain('Apartment');
		expect(built.user).toContain('12 days on market');
		expect(built.user).toContain('Preferred move-in date: 2026-11-01');
	});

	it('omits missing listing facts instead of inventing them', async () => {
		const built = await buildPrompt(
			'renter/outreach.v1',
			buildOutreachInputs(
				{
					...LISTING,
					rent: null,
					bedrooms: null,
					bathrooms: null,
					propertyType: null,
					daysOnMarket: null,
					contactName: null
				},
				FORM
			)
		);
		expect(built.user).not.toMatch(/\$|bedroom|bathroom|days on market|null|undefined/);
	});

	it('redacts the contact name and any email or phone in the extra question', async () => {
		const email = ['casey', 'example.com'].join('@');
		const phone = ['(212)', '555', '0147'].join(' ').replace(') 555 ', ') 555-');
		const built = await buildPrompt(
			'renter/outreach.v1',
			inputs({ extraQuestion: `Is parking included? Reach me at ${email} or ${phone}.` })
		);
		expect(built.user).toContain('Is parking included?');
		expect(built.user).toContain('{contact_name}');
		expect(built.user).not.toContain('Casey Morgan');
		expect(built.user).not.toContain(email);
		expect(built.user).not.toContain('0147');
		expect(built.redactions.map((r) => r.original)).toEqual(
			expect.arrayContaining(['Casey Morgan', email, phone])
		);
	});

	it('instructs: home not people, occupant count only, assistance animals, never claim open', () => {
		const { system } = renterOutreachV1.build(inputs());
		expect(system).toContain('Describe the home, not people.');
		expect(system).toContain('schools');
		expect(system).toContain('places of worship');
		expect(system).toContain('the only household detail you may state is the number of people');
		expect(system).toContain('never refer to an assistance animal as a pet');
		expect(system).toContain('Never claim the home is open or will be open; ask about it.');
		expect(system).toContain('{your_name}');
	});
});

describe('renter outreach sample output', () => {
	const sample = FIXTURE_OUTPUTS['renter/outreach.v1@1'];

	it('exists for the fixture provider under the built promptId', async () => {
		const built = await buildPrompt('renter/outreach.v1', buildOutreachInputs(LISTING, FORM));
		expect(built.promptId).toBe('renter/outreach.v1@1');
		expect(Object.hasOwn(FIXTURE_OUTPUTS, built.promptId)).toBe(true);
	});

	it('passes the Fair Housing checker with zero findings', () => {
		expect(checkFairHousing(sample)).toHaveLength(0);
	});

	it('asks about availability instead of claiming it, and signs off with a token', () => {
		for (const claim of ['still available', 'is available', 'available now']) {
			expect(sample.toLowerCase()).not.toContain(claim);
		}
		expect(sample).toContain('{your_name}');
		expect(sample).toMatch(/pet policy/);
		expect(sample).toMatch(/application fee/);
		expect(sample).toMatch(/lease lengths/);
	});
});
