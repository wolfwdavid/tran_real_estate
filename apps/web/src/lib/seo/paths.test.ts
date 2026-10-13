import { expect, test } from 'vitest';
import { canonicalPath } from './paths.js';

test.each([
	['/(marketing)', '/'],
	['/', '/'],
	[null, '/'],
	['/(marketing)/tools/cap-rate', '/tools/cap-rate/'],
	['/(marketing)/tools', '/tools/'],
	['/(marketing)/legal/privacy', '/legal/privacy/'],
	['/(app)/setup/rentcast', '/setup/rentcast/'],
	['/(app)/(nested)/agent/studio', '/agent/studio/'],
	['/(print)/print/snapshot', '/print/snapshot/'],
	['/for-renters', '/for-renters/'],
	['/for-renters/', '/for-renters/']
] as const)('canonicalPath(%s) === %s', (routeId, expected) => {
	expect(canonicalPath(routeId)).toBe(expected);
});

test('every canonical path starts and ends with a slash and has no route group', () => {
	for (const id of ['/(marketing)/tools/dscr', '/(app)/settings', '/(marketing)']) {
		const p = canonicalPath(id);
		expect(p).toMatch(/^\/(?:[^()]+\/)?$/);
		expect(p).not.toContain('//');
	}
});
