import { afterEach, describe, expect, test, vi } from 'vitest';
import { ANALYTICS, SITE_BASE } from '$lib/site';
import { pageview, tracker, trackerConfig } from './boot.js';

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe('analytics boot', () => {
	test('config matches $lib/site (the canonical reader of the build-time defines)', () => {
		expect(trackerConfig).toEqual({
			host: ANALYTICS.host,
			websiteId: ANALYTICS.websiteId,
			base: SITE_BASE
		});
	});

	test('only the first pageview carries the document referrer', () => {
		vi.stubGlobal('document', { referrer: 'https://search.example/' });
		vi.stubGlobal('window', { innerWidth: 390 });
		const spy = vi.spyOn(tracker, 'pageview').mockImplementation(() => {});
		const a = new URL('https://tranrealestate.github.io/tools/');
		const b = new URL('https://tranrealestate.github.io/tools/dscr/');
		pageview(a);
		pageview(b);
		expect(spy.mock.calls).toEqual([
			[a, 'https://search.example/', 390],
			[b, '', 390]
		]);
	});
});
