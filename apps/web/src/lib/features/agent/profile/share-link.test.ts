// Profile -> inquiry share link mapping (AGT-02, plan 08-24). The link may carry only the public
// fields the inquiry page needs; everything else on the profile must stay out of the URL.
import { describe, expect, test } from 'vitest';
import { EMPTY_PROFILE_INPUT, type AgentProfile, type ProfileInput } from '@tran/core/agent/types';
import { inquiryConfigFor } from '$lib/features/agent/home/setup-checklist';
import { buildInquiryUrl, readInquiryParams } from '$lib/leads/inquiry-url';
import { inquiryConfigFromProfile, shareLinkBlockers } from './share-link';

const KEY = '00000000-0000-4000-8000-000000000000';
const ROOT = 'https://tranrealestate.github.io/agent/inquire/';
const SUB = 'https://x.test/tran_real_estate/agent/inquire/';
const ALLOWED = ['v', 'k', 'n', 'b', 'tm', 't', 'st', 'lic', 'ph', 'p'];

const profile = (over: Partial<ProfileInput> = {}): ProfileInput => ({
	...EMPTY_PROFILE_INPUT,
	postal: { ...EMPTY_PROFILE_INPUT.postal },
	...over
});

/** Every field filled, including the ones that must never reach the link. */
const FULL: ProfileInput = profile({
	name: 'Sample Agent',
	brokerage: 'Example Realty',
	teamName: 'The Sample Team',
	licenseType: 'salesperson',
	licenseNumber: 'SAMPLE-0001',
	licenseState: 'TX',
	brokerageLicenseNumber: 'BRK-9000',
	brokeragePhone: '(555) 555-0100',
	phone: '(555) 555-0199',
	email: 'sample.agent@example.com',
	website: 'https://sample-agent.example.com',
	iabsUrl: 'https://sample-agent.example.com/iabs',
	postal: { street: '12 Sample Lane', line2: 'Suite 4', city: 'Austin', state: 'TX', zip: '78701' },
	brandPrimary: '#1F4E79',
	brandAccent: '#E8D9B5',
	logo: { base64: 'iVBORw0KGgoAAAANSUhEUg', mime: 'image/png', width: 2, height: 1, bytes: 70 },
	web3formsAccessKey: KEY.toUpperCase()
});

describe('shareLinkBlockers', () => {
	test('a missing profile needs everything, in order', () => {
		expect(shareLinkBlockers(null)).toEqual(['name', 'brokerage', 'key']);
		expect(shareLinkBlockers(profile())).toEqual(['name', 'brokerage', 'key']);
	});

	test('reports only what is missing, keeping the order name, brokerage, key', () => {
		expect(shareLinkBlockers(profile({ name: 'Sample Agent' }))).toEqual(['brokerage', 'key']);
		expect(shareLinkBlockers(profile({ brokerage: 'Example Realty' }))).toEqual(['name', 'key']);
		expect(
			shareLinkBlockers(profile({ brokerage: 'Example Realty', web3formsAccessKey: KEY }))
		).toEqual(['name']);
	});

	test('whitespace-only name or brokerage still blocks', () => {
		expect(shareLinkBlockers(profile({ name: '   ', brokerage: '\t' }))).toEqual([
			'name',
			'brokerage',
			'key'
		]);
	});

	test('a key that is not a Web3Forms uuid blocks', () => {
		const base = { name: 'Sample Agent', brokerage: 'Example Realty' };
		expect(shareLinkBlockers(profile({ ...base, web3formsAccessKey: 'not-a-key' }))).toEqual([
			'key'
		]);
		expect(shareLinkBlockers(profile({ ...base, web3formsAccessKey: KEY.slice(0, 35) }))).toEqual(
			['key']
		);
		expect(shareLinkBlockers(profile({ ...base, web3formsAccessKey: KEY }))).toEqual([]);
		expect(shareLinkBlockers(profile({ ...base, web3formsAccessKey: KEY.toUpperCase() }))).toEqual(
			[]
		);
	});
});

describe('inquiryConfigFromProfile', () => {
	test('maps the public fields, lowercases the key and normalizes the brokerage phone', () => {
		expect(inquiryConfigFromProfile(FULL, { property: '12 Sample Lane' })).toStrictEqual({
			key: KEY,
			name: 'Sample Agent',
			brokerage: 'Example Realty',
			team: 'The Sample Team',
			title: 'salesperson',
			state: 'TX',
			license: 'SAMPLE-0001',
			brokeragePhone: '+15555550100',
			property: '12 Sample Lane'
		});
	});

	test('omits optional parts that are empty instead of sending empty strings', () => {
		const minimal = profile({
			name: '  Sample Agent ',
			brokerage: ' Example Realty',
			web3formsAccessKey: KEY
		});
		expect(inquiryConfigFromProfile(minimal, {})).toStrictEqual({
			key: KEY,
			name: 'Sample Agent',
			brokerage: 'Example Realty'
		});
		expect(inquiryConfigFromProfile(minimal)).toStrictEqual({
			key: KEY,
			name: 'Sample Agent',
			brokerage: 'Example Realty'
		});
	});

	test('drops a brokerage phone that is not a US number', () => {
		const c = inquiryConfigFromProfile(profile({ ...FULL, brokeragePhone: '12345' }));
		expect(c.brokeragePhone).toBeUndefined();
	});

	test('trims the property and drops it when empty or over 120 characters', () => {
		expect(inquiryConfigFromProfile(FULL, { property: '  12 Sample Lane  ' }).property).toBe(
			'12 Sample Lane'
		);
		expect(inquiryConfigFromProfile(FULL, { property: '   ' }).property).toBeUndefined();
		expect(inquiryConfigFromProfile(FULL, { property: 'x'.repeat(120) }).property).toHaveLength(
			120
		);
		expect(inquiryConfigFromProfile(FULL, { property: 'x'.repeat(121) }).property).toBeUndefined();
	});

	test('agrees with the home page checklist mapping for a saved profile', () => {
		const stored: AgentProfile = {
			...FULL,
			ownerId: 'local',
			createdAt: '2026-10-01T12:00:00.000Z',
			updatedAt: '2026-10-01T12:00:00.000Z',
			schemaVersion: 1
		};
		expect(inquiryConfigFromProfile(stored)).toStrictEqual(inquiryConfigFor(stored));
	});
});

describe('the built link', () => {
	const url = buildInquiryUrl(ROOT, inquiryConfigFromProfile(FULL, { property: '12 Sample Lane' }));
	const decoded = decodeURIComponent(url.replace(/\+/g, ' '));

	test('carries only v, k, n, b, tm, t, st, lic, ph and p', () => {
		const names = [...new URL(url).searchParams.keys()];
		expect(names).toEqual(ALLOWED);
		for (const n of names) expect(ALLOWED).toContain(n);
	});

	test('never contains the email, phone, postal address, website, IABS link, logo or colors', () => {
		for (const secret of [
			'sample.agent@example.com',
			'0199',
			'12 Sample Lane, Suite 4',
			'Suite 4',
			'Austin',
			'78701',
			'sample-agent.example.com',
			'iabs',
			'BRK-9000',
			'iVBORw0KGgo',
			'1F4E79',
			'E8D9B5'
		]) {
			expect(decoded, `link must not contain ${secret}`).not.toContain(secret);
			expect(url, `link must not contain ${secret}`).not.toContain(secret);
		}
		// The property is the only street-like value, and it is there because it was asked for.
		expect(decoded).toContain('p=12 Sample Lane');
	});

	test('round-trips through the public page parser on the root base', () => {
		const parsed = readInquiryParams(new URL(url).search);
		expect(parsed).toStrictEqual({
			status: 'valid',
			config: inquiryConfigFromProfile(FULL, { property: '12 Sample Lane' })
		});
	});

	test('round-trips under /tran_real_estate/', () => {
		const config = inquiryConfigFromProfile(FULL);
		const sub = new URL(buildInquiryUrl(SUB, config));
		expect(sub.pathname).toBe('/tran_real_estate/agent/inquire/');
		expect(readInquiryParams(sub.search)).toStrictEqual({ status: 'valid', config });
	});
});
