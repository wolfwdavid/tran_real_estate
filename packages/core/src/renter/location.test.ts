import { describe, expect, test } from 'vitest';

import { locationDisplay, normalizeRenterLocation } from './location.js';

const city = (c: string, state: string) => ({
	ok: true,
	location: { kind: 'city', city: c, state }
});

describe('normalizeRenterLocation', () => {
	test('blank input is the empty error', () => {
		expect(normalizeRenterLocation('')).toEqual({ ok: false, error: 'empty' });
		expect(normalizeRenterLocation('   ')).toEqual({ ok: false, error: 'empty' });
	});

	test('a 5-digit ZIP and a ZIP+4 normalize to the 5-digit zipCode', () => {
		expect(normalizeRenterLocation('78701')).toEqual({
			ok: true,
			location: { kind: 'zip', zipCode: '78701' }
		});
		expect(normalizeRenterLocation('78701-1234')).toEqual({
			ok: true,
			location: { kind: 'zip', zipCode: '78701' }
		});
	});

	test.each(['00000', '7870', '787011', '78701-12'])('%j is bad-zip', (input) => {
		expect(normalizeRenterLocation(input)).toEqual({ ok: false, error: 'bad-zip' });
	});

	test.each(['austin tx', 'Austin, TX', 'austin, texas'])('%j → Austin, TX', (input) => {
		expect(normalizeRenterLocation(input)).toEqual(city('Austin', 'TX'));
	});

	test.each([
		['winston-salem, nc', 'Winston-Salem', 'NC'],
		['mcallen tx', 'McAllen', 'TX'],
		['st. louis, mo', 'St. Louis', 'MO'],
		['DeKalb, IL', 'DeKalb', 'IL']
	])('%j keeps RentCast casing → %s', (input, c, state) => {
		expect(normalizeRenterLocation(input)).toEqual(city(c, state));
	});

	test('a city without a state is city-without-state', () => {
		expect(normalizeRenterLocation('Austin')).toEqual({
			ok: false,
			error: 'city-without-state'
		});
		expect(normalizeRenterLocation('los angeles')).toEqual({
			ok: false,
			error: 'city-without-state'
		});
	});

	test('an unknown state token is unrecognized', () => {
		expect(normalizeRenterLocation('Austin, ZZ')).toEqual({ ok: false, error: 'unrecognized' });
		expect(normalizeRenterLocation('Austin ZZ')).toEqual({ ok: false, error: 'unrecognized' });
	});
});

describe('locationDisplay', () => {
	test('zip and city/state labels', () => {
		expect(locationDisplay({ kind: 'zip', zipCode: '78701' })).toBe('78701');
		expect(locationDisplay({ kind: 'city', city: 'Austin', state: 'TX' })).toBe('Austin, TX');
	});
});
