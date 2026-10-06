import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
	ACCESS_KEY_RE,
	INQUIRY_VERSION,
	inquiryParamPairs,
	parseInquiryParams,
	TITLE_CODES,
	type InquiryConfig
} from './inquiry-params.js';
import { cleanText } from './normalize.js';

// Low-entropy test key: gitleaks-safe and UUID-shaped.
const KEY = '00000000-0000-4000-8000-000000000000';

const FULL_QUERY = {
	k: KEY,
	n: 'Sample Agent',
	b: 'Example Realty',
	tm: 'The Sample Team',
	t: 's',
	st: 'TX',
	lic: 'SAMPLE-0001',
	ph: '(555) 555-0100',
	p: '12 Sample Lane'
};

const FULL_CONFIG: InquiryConfig = {
	key: KEY,
	name: 'Sample Agent',
	brokerage: 'Example Realty',
	team: 'The Sample Team',
	title: 'salesperson',
	state: 'TX',
	license: 'SAMPLE-0001',
	brokeragePhone: '+15555550100',
	property: '12 Sample Lane'
};

const MIN = { k: KEY, n: 'Sample Agent', b: 'Example Realty' };

describe('constants', () => {
	it('access key pattern is UUID-shaped and case-insensitive', () => {
		expect(ACCESS_KEY_RE.test(KEY)).toBe(true);
		expect(ACCESS_KEY_RE.test(KEY.toUpperCase().replace(/0/g, 'A'))).toBe(true);
		expect(ACCESS_KEY_RE.test('not-a-key')).toBe(false);
		expect(ACCESS_KEY_RE.test(`${KEY}0`)).toBe(false);
		expect(ACCESS_KEY_RE.test(` ${KEY}`)).toBe(false);
	});
	it('title codes and version', () => {
		expect(TITLE_CODES).toEqual({
			salesperson: 's',
			'associate-broker': 'ab',
			broker: 'b',
			'sales-associate': 'sa'
		});
		expect(INQUIRY_VERSION).toBe('1');
	});
});

describe('parseInquiryParams', () => {
	it('demo=1 wins over everything else', () => {
		expect(parseInquiryParams({ demo: '1' })).toEqual({ status: 'demo' });
		expect(parseInquiryParams({ demo: '1', ...MIN, v: '9' })).toEqual({ status: 'demo' });
	});

	it('a newer link version is reported as newer-version', () => {
		expect(parseInquiryParams({ v: '2', ...MIN })).toEqual({ status: 'newer-version' });
		expect(parseInquiryParams({ v: 'x', ...MIN })).toEqual({ status: 'newer-version' });
	});

	it('v absent or 1 is accepted', () => {
		expect(parseInquiryParams(MIN).status).toBe('valid');
		expect(parseInquiryParams({ v: '1', ...MIN }).status).toBe('valid');
	});

	it('parses the full valid example', () => {
		expect(parseInquiryParams(FULL_QUERY)).toEqual({ status: 'valid', config: FULL_CONFIG });
	});

	it('a minimal link has only key, name and brokerage', () => {
		expect(parseInquiryParams(MIN)).toEqual({
			status: 'valid',
			config: { key: KEY, name: 'Sample Agent', brokerage: 'Example Realty' }
		});
	});

	it('maps every title code back to its license type', () => {
		for (const [type, code] of Object.entries(TITLE_CODES)) {
			const r = parseInquiryParams({ ...MIN, t: code });
			expect(r).toMatchObject({ status: 'valid', config: { title: type } });
		}
	});

	it('incomplete: missing or malformed key', () => {
		expect(parseInquiryParams({ n: 'A', b: 'B' })).toEqual({ status: 'incomplete', reason: 'key' });
		for (const k of ['', 'abc', '00000000-0000-4000-8000-00000000000g', `${KEY}-extra`]) {
			expect(parseInquiryParams({ ...MIN, k })).toEqual({ status: 'incomplete', reason: 'key' });
		}
	});

	it('incomplete: name empty after cleaning or longer than 80', () => {
		expect(parseInquiryParams({ ...MIN, n: undefined })).toEqual({
			status: 'incomplete',
			reason: 'name'
		});
		expect(parseInquiryParams({ ...MIN, n: ' \u200B\u202E ' })).toEqual({
			status: 'incomplete',
			reason: 'name'
		});
		expect(parseInquiryParams({ ...MIN, n: 'a'.repeat(80) }).status).toBe('valid');
		expect(parseInquiryParams({ ...MIN, n: 'a'.repeat(81) })).toEqual({
			status: 'incomplete',
			reason: 'name'
		});
	});

	it('incomplete: brokerage is required and capped at 120', () => {
		expect(parseInquiryParams({ k: KEY, n: 'A' })).toEqual({
			status: 'incomplete',
			reason: 'brokerage'
		});
		expect(parseInquiryParams({ ...MIN, b: 'b'.repeat(120) }).status).toBe('valid');
		expect(parseInquiryParams({ ...MIN, b: 'b'.repeat(121) })).toEqual({
			status: 'incomplete',
			reason: 'brokerage'
		});
	});

	it('the key is checked before name and brokerage', () => {
		expect(parseInquiryParams({})).toEqual({ status: 'incomplete', reason: 'key' });
		expect(parseInquiryParams({ k: KEY })).toEqual({ status: 'incomplete', reason: 'name' });
	});

	it('drops invalid optional params and keeps the link valid', () => {
		const r = parseInquiryParams({
			...MIN,
			t: 'x',
			st: 'ZZ',
			lic: 'bad<lic>',
			ph: '0100',
			tm: 't'.repeat(81),
			p: 'p'.repeat(121)
		});
		expect(r).toEqual({
			status: 'valid',
			config: { key: KEY, name: 'Sample Agent', brokerage: 'Example Realty' }
		});
	});

	it('license: at most 30 chars of the allowed set', () => {
		expect(parseInquiryParams({ ...MIN, lic: 'A1 .#-/'.padEnd(30, 'Z') })).toMatchObject({
			config: { license: 'A1 .#-/'.padEnd(30, 'Z') }
		});
		expect(parseInquiryParams({ ...MIN, lic: 'Z'.repeat(31) })).not.toHaveProperty(
			'config.license'
		);
	});

	it('state is uppercased before the allowlist check', () => {
		expect(parseInquiryParams({ ...MIN, st: 'tx' })).toMatchObject({ config: { state: 'TX' } });
	});

	it('team and property respect their caps', () => {
		expect(parseInquiryParams({ ...MIN, tm: 't'.repeat(80), p: 'p'.repeat(120) })).toMatchObject({
			config: { team: 't'.repeat(80), property: 'p'.repeat(120) }
		});
	});

	it('cleans hostile characters from every value', () => {
		const r = parseInquiryParams({
			...MIN,
			n: '\u202Eevil\u200B',
			b: '\u2066Example\u2069 Realty',
			tm: 'Team\u0007',
			p: '\uFEFF12 Sample Lane'
		});
		expect(r).toEqual({
			status: 'valid',
			config: {
				key: KEY,
				name: 'evil',
				brokerage: 'Example Realty',
				team: 'Team',
				property: '12 Sample Lane'
			}
		});
	});

	it('markup stays literal text (cleaning, not escaping)', () => {
		const r = parseInquiryParams({ ...MIN, n: '<script>alert(1)</script>' });
		expect(r).toMatchObject({ config: { name: '<script>alert(1)</script>' } });
	});

	it('blank optional params are omitted', () => {
		const r = parseInquiryParams({ ...MIN, tm: ' ', p: '', lic: '' });
		expect(r).toEqual({
			status: 'valid',
			config: { key: KEY, name: 'Sample Agent', brokerage: 'Example Realty' }
		});
	});
});

describe('inquiryParamPairs', () => {
	it('emits ordered pairs with the phone in national format', () => {
		expect(inquiryParamPairs(FULL_CONFIG)).toEqual([
			['v', '1'],
			['k', KEY],
			['n', 'Sample Agent'],
			['b', 'Example Realty'],
			['tm', 'The Sample Team'],
			['t', 's'],
			['st', 'TX'],
			['lic', 'SAMPLE-0001'],
			['ph', '(555) 555-0100'],
			['p', '12 Sample Lane']
		]);
	});

	it('omits absent optional params', () => {
		const min: InquiryConfig = { key: KEY, name: 'Sample Agent', brokerage: 'Example Realty' };
		expect(inquiryParamPairs(min)).toEqual([
			['v', '1'],
			['k', KEY],
			['n', 'Sample Agent'],
			['b', 'Example Realty']
		]);
	});

	it('round-trips the full and minimal configs', () => {
		const min: InquiryConfig = { key: KEY, name: 'Sample Agent', brokerage: 'Example Realty' };
		for (const c of [FULL_CONFIG, min]) {
			expect(parseInquiryParams(Object.fromEntries(inquiryParamPairs(c)))).toEqual({
				status: 'valid',
				config: c
			});
		}
	});

	it('property: arbitrary names and brokerages round-trip cleaned', () => {
		const nonEmpty = (max: number) =>
			fc
				.string({ minLength: 1, maxLength: max + 10 })
				.map(cleanText)
				.filter((s) => s.length > 0 && s.length <= max);
		fc.assert(
			fc.property(nonEmpty(80), nonEmpty(120), (name, brokerage) => {
				const c: InquiryConfig = { key: KEY, name, brokerage };
				expect(parseInquiryParams(Object.fromEntries(inquiryParamPairs(c)))).toEqual({
					status: 'valid',
					config: c
				});
			}),
			{ numRuns: 200 }
		);
	});
});
