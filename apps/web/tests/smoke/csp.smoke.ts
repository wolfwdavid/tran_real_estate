// SMOKE-02 CSP contract over HTTP: every served route (and the 404 body) passes the same oracle the
// build gate uses (checkHtml from the CSP oracle), so there is no third copy of the policy. The
// policy is the <meta> tag; a CSP response header on Pages would mean GitHub's own 404 page, so
// headers are never read here.
import { test, expect, smoke } from './fixtures';
import { checkHtml } from '../../../../scripts/assert-csp.mjs';
import { NOT_FOUND, ROUTES } from '../e2e/routes';

const opts = { analyticsHost: smoke.analyticsHost };

for (const route of [...ROUTES]) {
	test(`CSP meta on /${route}`, async ({ request }) => {
		const res = await request.get(route);
		expect(res.status()).toBe(200);
		expect(checkHtml(route || 'index.html', await res.text(), opts)).toEqual([]);
	});
}

test('CSP meta on the 404 page', async ({ request }) => {
	const res = await request.get(NOT_FOUND);
	expect(res.status()).toBe(404);
	expect(checkHtml('404.html', await res.text(), opts)).toEqual([]);
});
