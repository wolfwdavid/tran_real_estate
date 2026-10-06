import { describe, expect, test } from 'vitest';
import {
	BRAND_FALLBACK,
	FALLBACK_NAMES,
	assessBrandColor,
	effectiveBrandColors,
	normalizeHex
} from './brand-color';
import { contrastRatio, tokens } from './index';

const WHITE = '#FFFFFF';
const round2 = (n: number) => Math.round(n * 100) / 100;

describe('normalizeHex', () => {
	test('accepts #rrggbb, bare rrggbb, #rgb and surrounding whitespace; uppercases', () => {
		expect(normalizeHex('#a4452a')).toBe('#A4452A');
		expect(normalizeHex('a4452a')).toBe('#A4452A');
		expect(normalizeHex('#abc')).toBe('#AABBCC');
		expect(normalizeHex(' #A4452A ')).toBe('#A4452A');
	});

	test('rejects non-hex, empty, alpha and wrong lengths', () => {
		expect(normalizeHex('#ggg000')).toBeNull();
		expect(normalizeHex('')).toBeNull();
		expect(normalizeHex('#A4452A00')).toBeNull();
		expect(normalizeHex('#abcd')).toBeNull();
		expect(normalizeHex('##A4452A')).toBeNull();
		expect(normalizeHex('rgb(1,2,3)')).toBeNull();
	});
});

describe('assessBrandColor', () => {
	test('Tran terracotta passes as primary (white text, 6.06:1)', () => {
		const a = assessBrandColor('#A4452A', 'primary');
		expect(a.valid).toBe(true);
		if (!a.valid) return;
		expect(a.hex).toBe('#A4452A');
		expect(a.role).toBe('primary');
		expect(a.against).toBe('white');
		expect(round2(a.ratio)).toBe(6.06);
		expect(a.displayRatio).toBe('6.0');
		expect(a.passes).toBe(true);
	});

	test('white fails and black passes as primary', () => {
		const w = assessBrandColor('#FFFFFF', 'primary');
		expect(w).toMatchObject({ valid: true, against: 'white', ratio: 1, passes: false });
		const b = assessBrandColor('#000000', 'primary');
		expect(b.valid && b.passes).toBe(true);
		expect(b.valid && round2(b.ratio)).toBe(21);
	});

	test('accent is checked against espresso text', () => {
		const sand = assessBrandColor('#F6E3D8', 'accent');
		expect(sand).toMatchObject({ valid: true, against: 'dark', passes: true });
		expect(sand.valid && round2(sand.ratio)).toBe(13.1);
		const espresso = assessBrandColor('#2B1D16', 'accent');
		expect(espresso).toMatchObject({ valid: true, against: 'dark', passes: false });
	});

	test('AA boundary: #767676 passes, #777777 fails, and a failing ratio never displays as 4.5', () => {
		const pass = assessBrandColor('#767676', 'primary');
		expect(pass.valid && round2(pass.ratio)).toBe(4.54);
		expect(pass.valid && pass.passes).toBe(true);
		expect(pass.valid && pass.displayRatio).toBe('4.5');

		const fail = assessBrandColor('#777777', 'primary');
		expect(fail.valid && round2(fail.ratio)).toBe(4.48);
		expect(fail.valid && fail.passes).toBe(false);
		expect(fail.valid && fail.displayRatio).toBe('4.4');
	});

	test('invalid input is reported as invalid', () => {
		expect(assessBrandColor('nope', 'primary')).toEqual({ valid: false });
		expect(assessBrandColor('', 'accent')).toEqual({ valid: false });
	});
});

describe('effectiveBrandColors', () => {
	test('fallbacks are the Tran terracotta and sand tokens', () => {
		expect(BRAND_FALLBACK).toEqual({
			primary: tokens.color.primary,
			accent: tokens.color['accent-surface']
		});
		expect(FALLBACK_NAMES).toEqual({ primary: 'terracotta', accent: 'sand' });
	});

	test('failing or empty colors resolve to the fallback tokens', () => {
		expect(effectiveBrandColors({ brandPrimary: '#FFFFFF', brandAccent: '' })).toEqual({
			primary: tokens.color.primary,
			accent: tokens.color['accent-surface'],
			primaryFromAgent: false,
			accentFromAgent: false
		});
		expect(effectiveBrandColors({})).toEqual({
			primary: tokens.color.primary,
			accent: tokens.color['accent-surface'],
			primaryFromAgent: false,
			accentFromAgent: false
		});
	});

	test('passing colors are used, normalized', () => {
		expect(effectiveBrandColors({ brandPrimary: '#1F4E79', brandAccent: '#f6e3d8' })).toEqual({
			primary: '#1F4E79',
			accent: '#F6E3D8',
			primaryFromAgent: true,
			accentFromAgent: true
		});
	});

	test('the AA boundary decides fromAgent', () => {
		expect(effectiveBrandColors({ brandPrimary: '#767676' }).primaryFromAgent).toBe(true);
		expect(effectiveBrandColors({ brandPrimary: '#777777' }).primaryFromAgent).toBe(false);
	});

	test('a failing color never reaches output (64 seeded hexes, both roles)', () => {
		// Deterministic LCG (seed 0x7a11) so failures are reproducible without fast-check.
		let seed = 0x7a11;
		const next = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0);
		const hex = () => '#' + (next() & 0xffffff).toString(16).padStart(6, '0');
		let fallbacks = 0;
		let agents = 0;
		for (let i = 0; i < 64; i++) {
			const input = { brandPrimary: hex(), brandAccent: hex() };
			const out = effectiveBrandColors(input);
			expect(contrastRatio(WHITE, out.primary)).toBeGreaterThanOrEqual(4.5);
			expect(contrastRatio(tokens.color.foreground, out.accent)).toBeGreaterThanOrEqual(4.5);
			for (const fromAgent of [out.primaryFromAgent, out.accentFromAgent]) {
				if (fromAgent) agents++;
				else fallbacks++;
			}
		}
		// Non-vacuity: the sample exercises both the pass-through and the fallback branch.
		expect(agents).toBeGreaterThan(0);
		expect(fallbacks).toBeGreaterThan(0);
	});
});
