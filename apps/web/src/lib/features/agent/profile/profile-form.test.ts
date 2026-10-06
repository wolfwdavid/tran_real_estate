import { describe, expect, it } from 'vitest';
import { EMPTY_PROFILE_INPUT, type ProfileInput } from '@tran/core/agent/types';
import {
	EMAIL_ERROR,
	FIELD_ORDER,
	PHONE_ERROR,
	WEBSITE_ERROR,
	ZIP_ERROR,
	isDirty,
	normalizeWebsite,
	validateProfile
} from './profile-form';

const base = (over: Partial<ProfileInput> = {}): ProfileInput => ({
	...EMPTY_PROFILE_INPUT,
	postal: { ...EMPTY_PROFILE_INPUT.postal },
	...over
});
const withZip = (zip: string): ProfileInput =>
	base({ postal: { ...EMPTY_PROFILE_INPUT.postal, zip } });

describe('validateProfile', () => {
	it('accepts an empty profile (no field is required to save)', () => {
		expect(validateProfile(base())).toEqual({ errors: {}, firstInvalid: null });
	});

	it('uses the UI-SPEC copy verbatim', () => {
		expect(EMAIL_ERROR).toBe('This email address looks incomplete.');
		expect(ZIP_ERROR).toBe('Enter a 5-digit ZIP code, or ZIP+4.');
		expect(WEBSITE_ERROR).toBe(
			"This website address doesn't look right. Check it, like https://yourname.com."
		);
		expect(PHONE_ERROR).toBe('Enter a phone number with area code.');
	});

	it.each(['sample@example', 'sample', '@example.com', 'a b@example.com'])(
		'flags email %s',
		(email) => {
			expect(validateProfile(base({ email })).errors.email).toBe(EMAIL_ERROR);
		}
	);

	it('accepts a complete email', () => {
		expect(validateProfile(base({ email: 'agent@example.com' })).errors.email).toBeUndefined();
	});

	it.each(['12345', '12345-6789'])('accepts ZIP %s', (zip) => {
		expect(validateProfile(withZip(zip)).errors.zip).toBeUndefined();
	});

	it.each(['1234', '123456', '12345-678', '12345-67890', 'abcde', '12345 6789'])(
		'rejects ZIP %s',
		(zip) => {
			expect(validateProfile(withZip(zip)).errors.zip).toBe(ZIP_ERROR);
		}
	);

	it('ignores surrounding whitespace on ZIP', () => {
		expect(validateProfile(withZip(' 12345 ')).errors.zip).toBeUndefined();
	});

	it.each(['yourname.com', 'https://yourname.com', 'http://a.test/path'])(
		'accepts website %s',
		(website) => {
			expect(validateProfile(base({ website })).errors.website).toBeUndefined();
		}
	);

	it.each(['not a site', 'ftp://example.com', 'https://', 'javascript:alert(1)', 'http://'])(
		'rejects website %s',
		(website) => {
			expect(validateProfile(base({ website })).errors.website).toBe(WEBSITE_ERROR);
		}
	);

	it('applies the same check to the IABS link', () => {
		expect(validateProfile(base({ iabsUrl: 'not a site' })).errors.iabsUrl).toBe(WEBSITE_ERROR);
		expect(validateProfile(base({ iabsUrl: 'example.com/iabs.pdf' })).errors.iabsUrl).toBe(
			undefined
		);
	});

	it('needs 10 digits in a phone number', () => {
		expect(validateProfile(base({ phone: '555-0100' })).errors.phone).toBe(PHONE_ERROR);
		expect(validateProfile(base({ brokeragePhone: '555 555 010' })).errors.brokeragePhone).toBe(
			PHONE_ERROR
		);
		expect(validateProfile(base({ phone: '(555) 555-0100' })).errors.phone).toBeUndefined();
		expect(
			validateProfile(base({ brokeragePhone: '5555550100' })).errors.brokeragePhone
		).toBeUndefined();
	});

	it('reports the first invalid field in DOM order', () => {
		const r = validateProfile(
			base({
				email: 'bad',
				brokeragePhone: '123',
				postal: { ...EMPTY_PROFILE_INPUT.postal, zip: '1' }
			})
		);
		expect(r.firstInvalid).toBe('brokeragePhone');
		expect(Object.keys(r.errors).sort()).toEqual(['brokeragePhone', 'email', 'zip']);
		expect(validateProfile(withZip('1')).firstInvalid).toBe('zip');
	});

	it('lists every input id in DOM order', () => {
		expect(FIELD_ORDER).toEqual([
			'name',
			'brokerage',
			'teamName',
			'licenseType',
			'licenseNumber',
			'licenseState',
			'brokerageLicenseNumber',
			'brokeragePhone',
			'phone',
			'email',
			'website',
			'iabsUrl',
			'street',
			'line2',
			'city',
			'postalState',
			'zip'
		]);
	});
});

describe('normalizeWebsite', () => {
	it('adds https:// to a bare host', () => {
		expect(normalizeWebsite('yourname.com')).toBe('https://yourname.com');
		expect(normalizeWebsite('  yourname.com ')).toBe('https://yourname.com');
	});
	it('keeps an explicit scheme', () => {
		expect(normalizeWebsite('http://a.test')).toBe('http://a.test');
		expect(normalizeWebsite('HTTPS://a.test')).toBe('HTTPS://a.test');
	});
	it('leaves empty input empty', () => {
		expect(normalizeWebsite('')).toBe('');
		expect(normalizeWebsite('   ')).toBe('');
	});
});

describe('isDirty', () => {
	it('is false for structurally equal profiles', () => {
		expect(isDirty(base(), base())).toBe(false);
	});
	it('detects a top-level change', () => {
		expect(isDirty(base(), base({ name: 'Sample Agent' }))).toBe(true);
		expect(isDirty(base(), base({ licenseType: 'broker' }))).toBe(true);
	});
	it('detects a postal change', () => {
		expect(isDirty(base(), withZip('12345'))).toBe(true);
	});
	it('compares logos by content', () => {
		const logo = { base64: 'AAAA', mime: 'image/png' as const, width: 1, height: 1, bytes: 3 };
		expect(isDirty(base({ logo }), base({ logo: { ...logo } }))).toBe(false);
		expect(isDirty(base({ logo }), base({ logo: { ...logo, base64: 'AAAB' } }))).toBe(true);
		expect(isDirty(base({ logo }), base())).toBe(true);
	});
});
