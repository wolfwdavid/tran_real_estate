// Pure pin/cluster label helpers (06-19, RENT-02). DOM builders are covered in map.browser.test.ts.
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { clusterLabel, pinLabel, pinText, pinWidth, spotTitle } from './pins';

const ROW = {
	price: 2150,
	addressLine1: '418 Larkspur Ln',
	formattedAddress: '418 Larkspur Ln, Harlow Springs, OK 74201',
	bedrooms: 2
};

describe('pinLabel', () => {
	test('rent, street line and bedrooms', () => {
		expect(pinLabel(ROW, false)).toBe('$2,150 a month, 418 Larkspur Ln, 2 bedrooms');
	});

	test('new listings start with "New. "', () => {
		expect(pinLabel(ROW, true)).toBe('New. $2,150 a month, 418 Larkspur Ln, 2 bedrooms');
	});

	test('0 bedrooms is a studio, 1 is singular', () => {
		expect(pinLabel({ ...ROW, bedrooms: 0 }, false)).toBe(
			'$2,150 a month, 418 Larkspur Ln, studio'
		);
		expect(pinLabel({ ...ROW, bedrooms: 1 }, false)).toBe(
			'$2,150 a month, 418 Larkspur Ln, 1 bedroom'
		);
	});

	test('unknown bedrooms are left out; missing line 1 falls back to formattedAddress', () => {
		expect(pinLabel({ ...ROW, bedrooms: null, addressLine1: null }, false)).toBe(
			'$2,150 a month, 418 Larkspur Ln'
		);
	});

	test('a unit line joins the street line', () => {
		expect(pinLabel({ ...ROW, addressLine2: 'Unit 5' }, false)).toBe(
			'$2,150 a month, 418 Larkspur Ln, Unit 5, 2 bedrooms'
		);
	});

	test('missing rent says so instead of a dollar amount', () => {
		expect(pinLabel({ ...ROW, price: null }, false)).toBe(
			'Rent not listed, 418 Larkspur Ln, 2 bedrooms'
		);
	});
});

describe('pinText / clusterLabel / spotTitle', () => {
	test('pinText is the compact rent', () => {
		expect(pinText(2150)).toBe('$2,150');
		expect(pinText(null)).toBe('Rent not listed');
		expect(pinText(Number.NaN)).toBe('Rent not listed');
	});

	test('cluster and spot copy', () => {
		expect(clusterLabel(7)).toBe('7 rentals here. Zoom in to see them.');
		expect(spotTitle(3)).toBe('3 rentals at this spot');
	});
});

describe('pinWidth', () => {
	test('never under 44px and always a multiple of 4', () => {
		for (const text of ['$1', '$950', '$2,150', '$12,500', 'Rent not listed']) {
			const w = pinWidth(text);
			expect(w).toBeGreaterThanOrEqual(44);
			expect(w % 4).toBe(0);
		}
	});

	test('grows with the text', () => {
		expect(pinWidth('$12,500')).toBeGreaterThan(pinWidth('$950'));
		expect(pinWidth('$2,150')).toBe(Math.max(44, Math.ceil((16 + 6 * 8.5) / 4) * 4));
	});
});

describe('pins.ts never builds HTML strings', () => {
	const source = readFileSync(new URL('./pins.ts', import.meta.url), 'utf8');

	test('no innerHTML / outerHTML / insertAdjacentHTML', () => {
		expect(source).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML/);
	});

	test('no template strings or literals containing markup', () => {
		expect(source).not.toMatch(/[`'"]\s*<[a-z]/i);
	});

	test('text goes in through textContent', () => {
		expect(source).toContain('textContent');
	});
});
