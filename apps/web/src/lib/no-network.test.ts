import { expect, test } from 'vitest';

test('fetch is disabled in unit tests', () => {
	// eslint-disable-next-line no-restricted-syntax -- this test exists to prove the fetch ban holds
	expect(() => fetch('https://example.com')).toThrow(/Network access is disabled/);
});
