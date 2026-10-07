// Shared agent-profile access (09-10): the Studio's sanctioned path to the profile.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ProfileInput } from '@tran/core/agent/types';
import { _resetDb, getDb } from '$lib/storage/db';
import { freshIdb } from '$lib/storage/test-utils';
import { saveProfile } from '$lib/storage/agent/profile-repo';
import {
	BrandPreview,
	SAMPLE_AGENT_PROFILE,
	effectiveBrandColors,
	isProfileComplete,
	loadAgentProfile,
	logoObjectUrl,
	toDisclosureProfile
} from './index';

const sample = (overrides: Partial<ProfileInput> = {}): ProfileInput => ({
	...SAMPLE_AGENT_PROFILE,
	postal: { ...SAMPLE_AGENT_PROFILE.postal },
	...overrides
});

describe('toDisclosureProfile', () => {
	it('maps the sample agent onto the studio formatter input', () => {
		const d = toDisclosureProfile(SAMPLE_AGENT_PROFILE);
		expect(d.fullName).toBe('Avery Sample');
		expect(d.brokerage).toBe('Sample Realty');
		expect(d.licenseType).toBe('Licensed Real Estate Salesperson');
		expect(d.licenseState).toBe('TX');
	});

	it('the sample agent uses the NY-safe salesperson title and synthetic contact details', () => {
		expect(SAMPLE_AGENT_PROFILE.licenseType).toBe('salesperson');
		expect(SAMPLE_AGENT_PROFILE.brokeragePhone).toMatch(/^\(555\) 555-01\d\d$/);
		expect(SAMPLE_AGENT_PROFILE.phone).toMatch(/^\(555\) 555-01\d\d$/);
		expect(SAMPLE_AGENT_PROFILE.email.endsWith('@example.com')).toBe(true);
	});
});

describe('isProfileComplete', () => {
	it('is false without a profile', () => {
		expect(isProfileComplete(null, 'ad-inline')).toBe(false);
	});

	it('is true for the sample agent in every variant', () => {
		for (const v of ['ad-inline', 'ad-block', 'print'] as const)
			expect(isProfileComplete(SAMPLE_AGENT_PROFILE, v)).toBe(true);
	});

	it('is false when a required field is missing', () => {
		expect(isProfileComplete(sample({ licenseNumber: '' }), 'ad-inline')).toBe(false);
		expect(isProfileComplete(sample({ licenseType: '' }), 'print')).toBe(false);
	});

	it('NY needs the brokerage phone', () => {
		expect(isProfileComplete(sample({ licenseState: 'NY' }), 'ad-inline')).toBe(true);
		expect(isProfileComplete(sample({ licenseState: 'NY', brokeragePhone: '' }), 'ad-inline')).toBe(
			false
		);
		expect(isProfileComplete(sample({ brokeragePhone: '' }), 'ad-inline')).toBe(true);
	});
});

describe('re-exports', () => {
	it('exposes BrandPreview, effectiveBrandColors and logoObjectUrl', () => {
		expect(typeof BrandPreview).toBe('function');
		expect(typeof logoObjectUrl).toBe('function');
		const eff = effectiveBrandColors({ brandPrimary: '', brandAccent: '' });
		expect(eff.primary).toMatch(/^#[0-9A-Fa-f]{6}$/);
	});
});

describe('loadAgentProfile', () => {
	beforeEach(() => {
		_resetDb();
		getDb(freshIdb());
	});
	afterEach(() => _resetDb());

	it('returns null before a profile is saved, then the saved profile', async () => {
		expect(await loadAgentProfile()).toBeNull();
		await saveProfile(sample(), '2026-10-07T09:30:00.000Z');
		const p = await loadAgentProfile();
		expect(p).toMatchObject({ id: 'profile', name: 'Avery Sample', brokerage: 'Sample Realty' });
	});
});
