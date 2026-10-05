// Contract: every provider host in the @tran/core registry is inside the CSP connect-src
// allowlist that scripts/assert-csp.mjs enforces on the built pages. Adding a provider without
// widening the CSP (or narrowing the CSP under a live provider) fails here, not in production.
import { describe, expect, test } from 'vitest';
import { PROVIDERS } from '../packages/core/src/providers.ts';
import { CONNECT } from './assert-csp.mjs';

describe('provider hosts vs CSP connect-src', () => {
	test('the registry has exactly five providers', () => {
		expect(PROVIDERS.length).toBe(5);
	});

	test.each(PROVIDERS.map((p) => [p.id, p.host] as const))(
		'%s host %s is allowed by connect-src',
		(_id, host) => {
			expect(CONNECT).toContain(`https://${host}`);
		}
	);

	test('the check is not vacuous: an unlisted host is rejected', () => {
		expect(CONNECT).not.toContain('https://evil.example');
	});
});
