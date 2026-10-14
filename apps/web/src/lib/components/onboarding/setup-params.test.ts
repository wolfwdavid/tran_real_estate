import { describe, expect, it } from 'vitest';
import { consumeSampleParam, parseSetupPortal } from './setup-params';

describe('parseSetupPortal', () => {
	it.each([
		['?portal=investor', 'investor'],
		['?portal=agent', 'agent'],
		['?portal=renter', 'renter'],
		['portal=agent', 'agent'],
		['', 'renter'],
		['?portal=hacker', 'renter'],
		['?portal=RENTER', 'renter'],
		['?portal=', 'renter'],
		['?portal=investor&portal=agent', 'investor'],
		['?other=agent', 'renter']
	])('%j -> %s', (search, expected) => {
		expect(parseSetupPortal(search)).toBe(expected);
	});
});

describe('consumeSampleParam', () => {
	it('drops source=sample and keeps the other params and the hash', () => {
		expect(consumeSampleParam(new URL('https://x.test/renter/?source=sample&id=7#a'))).toEqual({
			sample: true,
			cleaned: 'https://x.test/renter/?id=7#a'
		});
	});

	it('leaves no dangling ? when source=sample was the only param', () => {
		expect(consumeSampleParam(new URL('https://x.test/agent/?source=sample'))).toEqual({
			sample: true,
			cleaned: 'https://x.test/agent/'
		});
	});

	it('ignores any other source value', () => {
		const url = new URL('https://x.test/renter/?source=live');
		expect(consumeSampleParam(url)).toEqual({ sample: false, cleaned: url.href });
	});

	it('reports no sample when the param is absent', () => {
		const url = new URL('https://x.test/renter/?id=7');
		expect(consumeSampleParam(url)).toEqual({ sample: false, cleaned: url.href });
	});

	it('does not mutate the URL it is given', () => {
		const url = new URL('https://x.test/investor/?source=sample');
		consumeSampleParam(url);
		expect(url.href).toBe('https://x.test/investor/?source=sample');
	});
});
