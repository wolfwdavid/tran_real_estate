import { describe, expect, test } from 'vitest';

import { PORTALS, isPortal } from './index.js';

describe('PORTALS', () => {
	test('lists exactly the three portals in order', () => {
		expect(PORTALS).toEqual(['renter', 'investor', 'agent']);
		expect(PORTALS).toHaveLength(3);
	});

	test('is a readonly tuple that cannot be mutated', () => {
		const mutable = PORTALS as unknown as string[];
		expect(() => mutable.push('marketing')).toThrow(TypeError);
		expect(PORTALS).toHaveLength(3);
	});
});

describe('isPortal', () => {
	test.each(['renter', 'investor', 'agent'])('accepts %s', (value) => {
		expect(isPortal(value)).toBe(true);
	});

	test.each(['marketing', '', 'Renter', 'renters', ' agent'])('rejects %j', (value) => {
		expect(isPortal(value)).toBe(false);
	});
});
