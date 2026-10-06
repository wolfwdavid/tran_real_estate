// Pure list-state helpers (08-17): ?list= / ?q= codec and the contacts search filter.
import { describe, expect, test } from 'vitest';
import type { Contact } from '@tran/core/agent';
import { filterContacts, readListParam, readQueryParam, withParams } from './list-state';

const contact = (over: Partial<Contact>): Contact =>
	({
		id: 'c1',
		createdAt: '2026-10-01T12:00:00.000Z',
		updatedAt: '2026-10-01T12:00:00.000Z',
		name: 'Jordan Example',
		email: 'jordan@example.com',
		phone: '(555) 555-0101',
		stage: 'new',
		stageChangedAt: '2026-10-01T12:00:00.000Z',
		source: 'manual',
		propertyOfInterest: '',
		notes: '',
		consentSource: 'unknown',
		emailOptOutAt: null,
		lastContactedAt: null,
		sample: false,
		...over
	}) as Contact;

describe('readListParam', () => {
	test('known list values pass through', () => {
		expect(readListParam('?list=due-today')).toBe('due-today');
		expect(readListParam('list=new-this-week')).toBe('new-this-week');
		expect(readListParam(new URLSearchParams('list=no-contact-7d'))).toBe('no-contact-7d');
	});
	test('unknown or missing falls back to all', () => {
		expect(readListParam('')).toBe('all');
		expect(readListParam('?list=bogus')).toBe('all');
		expect(readListParam('?list=')).toBe('all');
		expect(readListParam('?list=constructor')).toBe('all');
	});
});

describe('readQueryParam', () => {
	test('decodes q', () => {
		expect(readQueryParam('?q=jo%20ex')).toBe('jo ex');
		expect(readQueryParam('?q=a+b')).toBe('a b');
	});
	test('missing is empty', () => {
		expect(readQueryParam('')).toBe('');
		expect(readQueryParam('?list=all')).toBe('');
	});
});

describe('withParams', () => {
	test('preserves other params and writes list and q', () => {
		expect(withParams('?x=1', { list: 'due-today', q: 'jo' })).toBe('?x=1&list=due-today&q=jo');
	});
	test('drops list=all and empty q', () => {
		expect(withParams('?list=due-today&q=jo&x=1', { list: 'all', q: '' })).toBe('?x=1');
		expect(withParams('?q=jo', { q: '   ' })).toBe('');
	});
	test('leaves unspecified keys alone', () => {
		expect(withParams('?list=new-this-week&q=a', { q: 'b' })).toBe('?list=new-this-week&q=b');
		expect(withParams('?q=a', { list: 'due-today' })).toBe('?q=a&list=due-today');
	});
	test('empty result is the empty string', () => {
		expect(withParams('', { list: 'all', q: '' })).toBe('');
	});
});

describe('filterContacts', () => {
	const a = contact({ id: 'a', name: 'Jordan Example' });
	const b = contact({
		id: 'b',
		name: 'Riley Sample',
		email: 'riley@test.org',
		phone: '555-555-0202'
	});
	const gone = contact({ id: 'g', name: 'Jordan Gone', deletedAt: '2026-10-02T00:00:00.000Z' });
	const all = [a, b, gone];
	const ids = (q: string) => filterContacts(all, q).map((c) => c.id);

	test('empty query returns all live contacts', () => {
		expect(ids('')).toEqual(['a', 'b']);
		expect(ids('   ')).toEqual(['a', 'b']);
	});
	test('case-insensitive name substring', () => {
		expect(ids('JORDAN')).toEqual(['a']);
		expect(ids('ley sam')).toEqual(['b']);
	});
	test('email substring', () => {
		expect(ids('test.org')).toEqual(['b']);
		expect(ids('@EXAMPLE')).toEqual(['a']);
	});
	test('phone digits substring needs at least 3 digits', () => {
		expect(ids('0101')).toEqual(['a']);
		expect(ids('555-0202')).toEqual(['b']);
		expect(ids('02')).toEqual([]);
	});
	test('tombstoned contacts never match', () => {
		expect(ids('gone')).toEqual([]);
	});
	test('preserves input order and does not mutate', () => {
		const input = [b, a];
		expect(filterContacts(input, '555').map((c) => c.id)).toEqual(['b', 'a']);
		expect(input).toEqual([b, a]);
	});
});
