// The home page's "Get set up" checklist (08-21) is computed from data, never from clicks.
import { describe, expect, it } from 'vitest';
import { EMPTY_PROFILE_INPUT, type AgentProfile, type Contact } from '@tran/core/agent/types';
import { setupChecklist } from './setup-checklist';

const SYNC = {
	ownerId: 'local' as const,
	createdAt: '2026-10-01T12:00:00.000Z',
	updatedAt: '2026-10-01T12:00:00.000Z',
	schemaVersion: 1
};

const profile = (over: Partial<AgentProfile> = {}): AgentProfile => ({
	...SYNC,
	...EMPTY_PROFILE_INPUT,
	...over
});

const full = (): AgentProfile =>
	profile({
		name: 'Avery Example',
		brokerage: 'Example Realty',
		licenseNumber: '12345',
		licenseState: 'TX',
		postal: { street: '1 Main St', line2: '', city: 'Austin', state: 'TX', zip: '78701' },
		web3formsAccessKey: '00000000-0000-4000-8000-000000000000'
	});

const contact = (over: Partial<Contact> = {}): Contact => ({
	...SYNC,
	id: 'c1',
	name: 'Jordan Example',
	email: 'jordan@example.com',
	phone: '',
	stage: 'new',
	stageChangedAt: SYNC.createdAt,
	source: 'manual',
	propertyOfInterest: '',
	notes: '',
	consentSource: 'unknown',
	emailOptOutAt: null,
	lastContactedAt: null,
	sample: false,
	...over
});

describe('setupChecklist', () => {
	it('lists the three steps, all to do, for a fresh browser', () => {
		const r = setupChecklist({ profile: null, contacts: [] });
		expect(r.items.map((i) => i.key)).toEqual(['details', 'inquiry', 'contact']);
		expect(r.items.map((i) => i.label)).toEqual([
			'Add your name, license, and mailing address',
			'Create your inquiry link',
			'Add your first contact'
		]);
		expect(r.items.map((i) => i.done)).toEqual([false, false, false]);
		expect(r.allDone).toBe(false);
	});

	it('marks details done only with name, license number, license state and a full address', () => {
		const details = (p: AgentProfile) => setupChecklist({ profile: p, contacts: [] }).items[0].done;
		expect(details(full())).toBe(true);
		const noZip = full();
		noZip.postal = { ...noZip.postal, zip: '' };
		expect(details(noZip)).toBe(false);
		expect(details(profile({ ...full(), licenseState: '' }))).toBe(false);
		expect(details(profile({ ...full(), licenseNumber: '  ' }))).toBe(false);
		expect(details(profile({ ...full(), name: '' }))).toBe(false);
	});

	it('marks the inquiry link done with a name, a brokerage and a valid access key', () => {
		expect(setupChecklist({ profile: full(), contacts: [] }).items[1].done).toBe(true);
		expect(
			setupChecklist({ profile: profile({ ...full(), web3formsAccessKey: 'nope' }), contacts: [] })
				.items[1].done
		).toBe(false);
		expect(
			setupChecklist({ profile: profile({ ...full(), brokerage: '' }), contacts: [] }).items[1].done
		).toBe(false);
	});

	it('marks the first contact done only for a live, non-sample contact', () => {
		expect(setupChecklist({ profile: null, contacts: [contact()] }).items[2].done).toBe(true);
		expect(
			setupChecklist({ profile: null, contacts: [contact({ sample: true })] }).items[2].done
		).toBe(false);
		expect(
			setupChecklist({ profile: null, contacts: [contact({ deletedAt: SYNC.updatedAt })] }).items[2]
				.done
		).toBe(false);
	});

	it('is allDone only when every step is', () => {
		expect(setupChecklist({ profile: full(), contacts: [contact()] }).allDone).toBe(true);
		expect(setupChecklist({ profile: full(), contacts: [] }).allDone).toBe(false);
	});
});
