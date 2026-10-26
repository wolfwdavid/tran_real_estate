import { describe, expect, test } from 'vitest';
import raw from '../src/lib/selectors.v1.json';
import { CONFIG, hasClassSelector, normalizeLabel } from '../src/lib/config';

const SELECTOR_GROUPS = [
	'resultsContainers',
	'cardRoots',
	'itemRoots',
	'adSlots',
	'badgeScopes'
] as const;

const allSelectors = (): string[] => SELECTOR_GROUPS.flatMap((group) => [...CONFIG[group]]);
const allLabels = (): string[] => Object.values(CONFIG.labels).flatMap((list) => [...list]);
const allOptInLabels = (): string[] =>
	Object.values(CONFIG.optInLabels).flatMap((list) => [...list]);

describe('selectors.v1.json schema', () => {
	test('is version 1 and CONFIG is the bundled file', () => {
		expect(CONFIG.version).toBe(1);
		expect(raw.version).toBe(1);
		expect(CONFIG.observed).toBe(raw.observed);
	});

	test('every selector group is a non-empty list', () => {
		for (const group of SELECTOR_GROUPS) {
			expect(CONFIG[group].length, group).toBeGreaterThan(0);
		}
	});

	test('every selector parses in the DOM', () => {
		const root = document.createElement('div');
		for (const selector of allSelectors()) {
			expect(() => root.querySelectorAll(selector), selector).not.toThrow();
		}
	});

	test('no selector uses a class selector', () => {
		expect(allSelectors().filter(hasClassSelector)).toEqual([]);
	});

	test('the class-selector check rejects a hashed class name (non-vacuity)', () => {
		expect(hasClassSelector('.StyledPropertyCard-c11n-8-1__sc-1')).toBe(true);
		expect(hasClassSelector('article.property-card')).toBe(true);
		expect(hasClassSelector('[data-testid="a.b"]')).toBe(false);
		expect(hasClassSelector('#grid-search-results')).toBe(false);
	});

	test('label keys are exactly sponsored, promoted, featured and ad', () => {
		expect(Object.keys(CONFIG.labels).sort()).toEqual(['ad', 'featured', 'promoted', 'sponsored']);
	});

	test('showcase is the only opt-in category', () => {
		expect(Object.keys(CONFIG.optInLabels)).toEqual(['showcase']);
		expect(CONFIG.optInLabels.showcase).toEqual(['showcase']);
	});

	test('every label is already normalized', () => {
		for (const label of [...allLabels(), ...allOptInLabels()]) {
			expect(normalizeLabel(label), label).toBe(label);
		}
	});

	test('opt-in labels are disjoint from default labels', () => {
		const defaults = new Set(allLabels());
		expect(allOptInLabels().filter((label) => defaults.has(label))).toEqual([]);
	});
});

describe('normalizeLabel', () => {
	test.each([
		[' Sponsored · ', 'sponsored'],
		['FEATURED:', 'featured'],
		['Promoted —', 'promoted'],
		['Sponsored listing', 'sponsored listing'],
		['Ad-free', 'ad-free'],
		['  Promoted\n\tlisting  ', 'promoted listing']
	])('%j -> %j', (input, expected) => {
		expect(normalizeLabel(input)).toBe(expected);
	});
});
