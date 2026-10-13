import { expect, test } from 'vitest';
import { ANALYTICS, CONTACT_EMAIL, SITE_BASE, SITE_ORIGIN, SITE_URL, WEB3FORMS_KEY } from './site';

// Run with no PUBLIC_* and no BASE_PATH set (10-01 verify clears them): the defaults are a no-op.
test('SITE_URL defaults to the org origin with no base path', () => {
	expect(SITE_URL).toBe('https://tranrealestate.github.io');
	expect(SITE_ORIGIN).toBe('https://tranrealestate.github.io');
	expect(SITE_BASE).toBe('');
});

test('optional owner settings default to empty', () => {
	expect(ANALYTICS).toEqual({ host: '', websiteId: '' });
	expect(Object.isFrozen(ANALYTICS)).toBe(true);
	expect(WEB3FORMS_KEY).toBe('');
	expect(CONTACT_EMAIL).toBe('');
});
