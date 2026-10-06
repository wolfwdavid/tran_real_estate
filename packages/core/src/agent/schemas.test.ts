import { describe, expect, it } from 'vitest';

import { SAMPLE_AGENT_PROFILE } from './fixtures/sample-profile.js';
import { activitySchema, agentProfileSchema, contactSchema, taskSchema } from './schemas.js';
import {
	CONTACT_MAKING,
	EMPTY_PROFILE_INPUT,
	isLive,
	STAGES,
	US_STATES,
	type Activity,
	type AgentProfile,
	type Contact,
	type Task
} from './types.js';

const T = '2026-10-04T12:00:00.000Z';
const sync = (id: string) => ({
	id,
	ownerId: 'local' as const,
	createdAt: T,
	updatedAt: T,
	schemaVersion: 1
});
const CID = '11111111-1111-4111-8111-111111111111';

const contact: Contact = {
	...sync(CID),
	name: 'Jordan Example',
	email: 'jordan@example.com',
	emailNorm: 'jordan@example.com',
	phone: '(555) 555-0142',
	phoneNorm: '+15555550142',
	stage: 'touring',
	stageChangedAt: T,
	source: 'inquiry',
	propertyOfInterest: '12 Sample Lane',
	notes: 'Wants a yard.',
	consentSource: 'inquiry-form',
	emailOptOutAt: null,
	lastContactedAt: T,
	sample: false
};
const task: Task = {
	...sync('22222222-2222-4222-8222-222222222222'),
	contactId: CID,
	title: 'Call back',
	dueDate: '2026-10-04',
	status: 'done',
	doneAt: T,
	sample: false
};
const activity: Activity = {
	...sync('33333333-3333-4333-8333-333333333333'),
	contactId: CID,
	type: 'stage_changed',
	text: 'Moved to Touring',
	at: T,
	fromStage: 'contacted',
	toStage: 'touring',
	sample: false
};
const profile: AgentProfile = {
	...sync('profile'),
	...SAMPLE_AGENT_PROFILE,
	id: 'profile',
	teamName: 'Sample Team',
	brokerageLicenseNumber: 'B-0001',
	iabsUrl: 'https://example.com/iabs.pdf',
	brandPrimary: '#1A2B3C',
	brandAccent: '#abcdef',
	logo: { base64: 'iVBORw0KGgo=', mime: 'image/png', width: 64, height: 64, bytes: 1024 },
	web3formsAccessKey: '0f0f0f0f-1a2b-4c3d-8e9f-0123456789ab'
};

describe('agent schemas', () => {
	it('parses fully populated records', () => {
		expect(contactSchema.safeParse(contact).success).toBe(true);
		expect(taskSchema.safeParse(task).success).toBe(true);
		expect(activitySchema.safeParse(activity).success).toBe(true);
		expect(agentProfileSchema.safeParse(profile).success).toBe(true);
	});

	it('parses the sample profile and the empty profile with Syncable fields', () => {
		expect(
			agentProfileSchema.safeParse({ ...sync('profile'), ...SAMPLE_AGENT_PROFILE }).success
		).toBe(true);
		expect(
			agentProfileSchema.safeParse({ ...sync('profile'), ...EMPTY_PROFILE_INPUT }).success
		).toBe(true);
	});

	it('rejects bad values', () => {
		expect(contactSchema.safeParse({ ...contact, stage: 'won' }).success).toBe(false);
		expect(contactSchema.safeParse({ ...contact, name: 'x'.repeat(121) }).success).toBe(false);
		expect(contactSchema.safeParse({ ...contact, deletedAt: null }).success).toBe(false);
		expect(taskSchema.safeParse({ ...task, dueDate: '2026-10-4' }).success).toBe(false);
		expect(agentProfileSchema.safeParse({ ...profile, brandPrimary: '#abc' }).success).toBe(false);
		expect(agentProfileSchema.safeParse({ ...profile, id: CID }).success).toBe(false);
		expect(agentProfileSchema.safeParse({ ...profile, web3formsAccessKey: 'nope' }).success).toBe(
			false
		);
		expect(
			agentProfileSchema.safeParse({ ...profile, logo: { ...profile.logo!, bytes: 524_289 } })
				.success
		).toBe(false);
	});

	it('US_STATES has 50 states plus DC with unique codes', () => {
		expect(US_STATES).toHaveLength(51);
		expect(new Set(US_STATES.map((s) => s.code)).size).toBe(51);
		expect(US_STATES.some((s) => s.code === 'DC')).toBe(true);
		const names = US_STATES.map((s) => s.name);
		expect([...names].sort((a, b) => a.localeCompare(b))).toEqual(names);
	});

	it('constants and isLive', () => {
		expect(STAGES).toEqual(['new', 'contacted', 'touring', 'offer', 'closed']);
		expect(CONTACT_MAKING.has('stage_changed')).toBe(false);
		expect(CONTACT_MAKING.has('call')).toBe(true);
		expect(isLive(contact)).toBe(true);
		expect(isLive({ deletedAt: T })).toBe(false);
	});
});
