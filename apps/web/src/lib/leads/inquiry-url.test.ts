import { describe, expect, test } from 'vitest';
import type { InquiryConfig } from '@tran/core/leads/inquiry-params';
import { buildInquiryUrl, readInquiryParams } from './inquiry-url';

const KEY = '00000000-0000-4000-8000-000000000000';
const ROOT = 'https://tranrealestate.github.io/agent/inquire/';
const SUB = 'https://x.test/tran_real_estate/agent/inquire/';

const MINIMAL: InquiryConfig = { key: KEY, name: 'Sample Agent', brokerage: 'Example Realty' };
const FULL: InquiryConfig = {
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

describe('buildInquiryUrl', () => {
	test('builds a v1 link on the root base with URLSearchParams encoding', () => {
		expect(buildInquiryUrl(ROOT, MINIMAL)).toBe(
			`${ROOT}?v=1&k=${KEY}&n=Sample+Agent&b=Example+Realty`
		);
	});

	test('keeps the sub-path base', () => {
		const url = new URL(buildInquiryUrl(SUB, MINIMAL));
		expect(url.pathname).toBe('/tran_real_estate/agent/inquire/');
		expect(url.origin).toBe('https://x.test');
	});

	test('replaces any query or hash already on the page URL', () => {
		const url = new URL(buildInquiryUrl(`${ROOT}?demo=1#x`, MINIMAL));
		expect(url.searchParams.has('demo')).toBe(false);
		expect(url.hash).toBe('');
	});
});

describe('readInquiryParams round-trips buildInquiryUrl', () => {
	for (const base of [ROOT, SUB]) {
		for (const [label, c] of [
			['minimal', MINIMAL],
			['every optional field', FULL]
		] as const) {
			test(`${label} under ${base}`, () => {
				expect(readInquiryParams(new URL(buildInquiryUrl(base, c)).search)).toEqual({
					status: 'valid',
					config: c
				});
			});
		}
	}

	test('hostile values round-trip as cleaned text', () => {
		const c: InquiryConfig = { key: KEY, name: 'Zoë "Z" <b>', brokerage: 'A & B #1' };
		expect(readInquiryParams(new URL(buildInquiryUrl(SUB, c)).search)).toEqual({
			status: 'valid',
			config: c
		});
		const bidi = readInquiryParams(
			new URL(buildInquiryUrl(ROOT, { ...MINIMAL, name: '‮x Agent' })).search
		);
		expect(bidi).toEqual({ status: 'valid', config: { ...MINIMAL, name: 'x Agent' } });
	});

	test('accepts a search string without the leading question mark', () => {
		const search = new URL(buildInquiryUrl(ROOT, MINIMAL)).search.slice(1);
		expect(readInquiryParams(search)).toEqual({ status: 'valid', config: MINIMAL });
	});

	test('reports demo, newer-version and incomplete links', () => {
		expect(readInquiryParams('?demo=1')).toEqual({ status: 'demo' });
		expect(readInquiryParams(`?v=2&k=${KEY}&n=A&b=B`)).toEqual({ status: 'newer-version' });
		expect(readInquiryParams(`?v=1&k=${KEY}&n=A`)).toEqual({
			status: 'incomplete',
			reason: 'brokerage'
		});
		expect(readInquiryParams('')).toEqual({ status: 'incomplete', reason: 'key' });
	});
});
