import { describe, expect, test } from 'vitest';
import { asset, resolve } from './app-paths.stub';

describe('$app/paths stub follows Kit 3', () => {
	test.each([
		['settings/', '/settings/'],
		['investor/analyze/', '/investor/analyze/'],
		['', '/'],
		['/(marketing)', '/'],
		['/(app)/renter', '/renter'],
		['/(app)/agent/studio/', '/agent/studio/'],
		['/robots.txt', '/robots.txt']
	])('resolve(%j) is %j', (id, expected) => {
		expect(resolve(id)).toBe(expected);
	});

	test.each([
		['icons/a.png', '/icons/a.png'],
		['/icons/a.png', '/icons/a.png']
	])('asset(%j) is %j', (file, expected) => {
		expect(asset(file)).toBe(expected);
	});
});
