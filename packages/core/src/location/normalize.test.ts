import { describe, expect, test } from 'vitest';

import { normalizeLocation, parseLocation, titleCaseCity } from './normalize.js';
import { stateFromInput, US_STATES } from './states.js';

describe('normalizeLocation: ZIP codes', () => {
	test.each([
		['78701', '78701'],
		['78701-1234', '78701'],
		[' 74201 ', '74201']
	])('%j → zip %s', (input, zipCode) => {
		expect(normalizeLocation(input)).toEqual({ ok: true, kind: 'zip', zipCode, label: zipCode });
	});

	test.each([
		['00000', 'invalid-zip'],
		['7870', 'missing-state']
	])('%j → error %s', (input, error) => {
		expect(normalizeLocation(input)).toEqual({ ok: false, error });
	});
});

describe('normalizeLocation: city + state', () => {
	test.each([
		['austin tx', 'Austin', 'TX'],
		['Austin, Texas', 'Austin', 'TX'],
		['st. louis, mo', 'St. Louis', 'MO'],
		['winston-salem nc', 'Winston-Salem', 'NC'],
		['mcallen, tx', 'McAllen', 'TX'],
		['SALT LAKE CITY UT', 'Salt Lake City', 'UT'],
		['macon ga', 'Macon', 'GA'],
		['DeKalb, IL', 'DeKalb', 'IL'],
		['LaGrange GA', 'LaGrange', 'GA'],
		['new york new york', 'New York', 'NY'],
		['kansas city missouri', 'Kansas City', 'MO'],
		['washington district of columbia', 'Washington', 'DC'],
		['  austin    tx  ', 'Austin', 'TX']
	])('%j → %s, %s', (input, city, state) => {
		expect(normalizeLocation(input)).toEqual({
			ok: true,
			kind: 'city',
			city,
			state,
			label: `${city}, ${state}`
		});
	});

	test.each([
		['Austin', 'missing-state'],
		['Springfield, XX', 'unknown-state'],
		['', 'empty'],
		['   ', 'empty']
	])('%j → error %s', (input, error) => {
		expect(normalizeLocation(input)).toEqual({ ok: false, error });
	});

	test('a lone state name is missing its city', () => {
		expect(normalizeLocation('texas')).toEqual({ ok: false, error: 'missing-state' });
	});

	test('an empty city before a comma is missing its city', () => {
		expect(normalizeLocation(', TX')).toEqual({ ok: false, error: 'missing-state' });
	});
});

describe('parseLocation', () => {
	test('is an alias of normalizeLocation', () => {
		expect(parseLocation).toBe(normalizeLocation);
	});
});

describe('titleCaseCity', () => {
	test.each([
		['st. louis', 'St. Louis'],
		['winston-salem', 'Winston-Salem'],
		['mcallen', 'McAllen'],
		['MACON', 'Macon'],
		["coeur d'alene", "Coeur D'alene"]
	])('%j → %j', (input, out) => {
		expect(titleCaseCity(input)).toBe(out);
	});
});

describe('US_STATES', () => {
	test('has the 50 states plus DC', () => {
		expect(US_STATES).toHaveLength(51);
		expect(US_STATES).toContainEqual({ abbr: 'DC', name: 'District of Columbia' });
		expect(new Set(US_STATES.map((s) => s.abbr)).size).toBe(51);
	});

	test.each([
		['tx', 'TX'],
		['Texas', 'TX'],
		['NEW YORK', 'NY'],
		['district of columbia', 'DC'],
		['xx', null],
		['', null]
	])('stateFromInput(%j) → %j', (input, abbr) => {
		expect(stateFromInput(input)).toBe(abbr);
	});
});
