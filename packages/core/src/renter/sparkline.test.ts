import { describe, expect, it } from 'vitest';
import { lastPoint, sparklinePath } from './sparkline.js';

describe('sparklinePath', () => {
	it('returns null for fewer than two points', () => {
		expect(sparklinePath([], 320, 48)).toBeNull();
		expect(sparklinePath([5], 320, 48)).toBeNull();
	});

	it('maps an ascending series corner to corner', () => {
		const p = sparklinePath([1, 2, 3], 320, 48, 2)!;
		expect(p.startsWith('M2.0,46.0')).toBe(true);
		expect(p.endsWith('L318.0,2.0')).toBe(true);
		expect(p).toBe('M2.0,46.0 L160.0,24.0 L318.0,2.0');
	});

	it('draws equal values as a flat line at h - pad', () => {
		expect(sparklinePath([7, 7, 7], 100, 20, 2)).toBe('M2.0,18.0 L50.0,18.0 L98.0,18.0');
	});
});

describe('lastPoint', () => {
	it('returns the final coordinate', () => {
		expect(lastPoint([1, 2, 3], 320, 48, 2)).toEqual({ x: 318, y: 2 });
	});
	it('returns null when there is no line', () => {
		expect(lastPoint([1], 320, 48, 2)).toBeNull();
	});
});
