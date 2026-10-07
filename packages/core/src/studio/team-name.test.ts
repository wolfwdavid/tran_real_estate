import { describe, expect, test } from 'vitest';

import { LICENSE_TYPE_OPTIONS, validateLicenseTitle, validateTeamName } from './team-name.js';

const codes = (ws: { code: string }[]): string[] => ws.map((w) => w.code);

describe('LICENSE_TYPE_OPTIONS', () => {
	test('exact options in order', () => {
		expect(LICENSE_TYPE_OPTIONS).toEqual([
			'Licensed Real Estate Salesperson',
			'Licensed Associate Real Estate Broker',
			'Licensed Real Estate Broker',
			'Sales Associate',
			'Other'
		]);
	});
});

describe('validateLicenseTitle', () => {
	test.each([
		['Sales Associate', 'NY', ['ny-title']],
		['Broker', 'NY', ['ny-title']],
		['licensed sales agent', 'NY', ['ny-title']],
		['  sales agent ', 'ny', ['ny-title']],
		['Licensed Real Estate Salesperson', 'NY', []],
		['Licensed Associate Real Estate Broker', 'NY', []],
		['Sales Associate', 'FL', []],
		['Broker', 'TX', []],
		['', 'NY', []]
	])('%s in %s', (title, state, expected) => {
		expect(codes(validateLicenseTitle(title, state))).toEqual(expected);
	});

	test('ny-title message names the title', () => {
		const [w] = validateLicenseTitle('Sales Associate', 'NY');
		expect(w?.message).toBe(
			'In New York, use your exact license title, like "Licensed Real Estate Salesperson". "Sales Associate" isn\'t allowed in ads.'
		);
	});
});

describe('validateTeamName', () => {
	test.each([
		['NY', 'Sample Group', ['ny-team-word', 'ny-team-forbidden']],
		['NY', 'The Sample Team', []],
		['NY', 'Sample Realty Team', ['ny-team-forbidden']],
		['NY', 'Sample Associates Team', ['ny-team-forbidden']],
		['NY', 'Teamwork Partners', ['ny-team-word']],
		['TX', 'Sample Realty Partners', ['tx-team-suffix']],
		['TX', 'Sample Team', []],
		['TX', 'Sample Group', []],
		['TX', 'Sample Company Team', ['tx-team-forbidden']],
		['FL', 'Sample Realty Team', ['fl-team-forbidden']],
		['FL', 'Sample Real Estate Team', ['fl-team-forbidden']],
		['FL', 'Sample Corp. Team', ['fl-team-forbidden']],
		['FL', 'The Sample Team', []],
		['CA', 'Sample Team LLC', ['ca-team-entity']],
		['CA', 'Sample Team', []],
		['OH', 'Anything', []],
		['ZZ', 'Sample Realty Group LLC', []]
	])('%s %s', (state, name, expected) => {
		expect(codes(validateTeamName(name, state))).toEqual(expected);
	});

	test.each(['NY', 'TX', 'FL', 'CA', 'OH', 'NJ', 'ZZ', ''])(
		'no team name means no warnings in %s',
		(st) => {
			expect(validateTeamName('', st)).toEqual([]);
			expect(validateTeamName('   ', st)).toEqual([]);
		}
	);

	test('matching is case-insensitive and respects word boundaries', () => {
		expect(codes(validateTeamName('sample REALTY team', 'FL'))).toEqual(['fl-team-forbidden']);
		// "Realtyworks" is not the word "Realty".
		expect(validateTeamName('Realtyworks Team', 'FL')).toEqual([]);
		// Letters outside ASCII still count as word characters.
		const accented = `Realty${String.fromCharCode(0xe9)} Team`;
		expect(validateTeamName(accented, 'FL')).toEqual([]);
	});

	test('messages are plain language', () => {
		expect(validateTeamName('Sample Group', 'NY').map((w) => w.message)).toEqual([
			'In New York, a team name must include the word "Team".',
			'In New York, a team name can\'t use "Group".'
		]);
		expect(validateTeamName('Sample Realty Partners', 'TX')[0]?.message).toBe(
			'In Texas, a team name must end with "Team" or "Group".'
		);
		expect(validateTeamName('Sample Realty Team', 'FL')[0]?.message).toBe(
			'In Florida, a team name can\'t use "Realty".'
		);
		expect(validateTeamName('Sample Team LLC', 'CA')[0]?.message).toBe(
			'In California, a team name can\'t suggest a business separate from your brokerage, so leave out "LLC".'
		);
		expect(validateTeamName('Sample Company Team', 'TX')[0]?.message).toBe(
			'In Texas, a team name can\'t use "Company".'
		);
	});

	test('one warning per forbidden word', () => {
		expect(codes(validateTeamName('Sample Realty Properties LLC', 'FL'))).toEqual([
			'fl-team-forbidden',
			'fl-team-forbidden',
			'fl-team-forbidden'
		]);
	});
});
