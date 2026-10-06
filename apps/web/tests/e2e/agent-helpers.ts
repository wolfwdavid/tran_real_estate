import { expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Shared helpers for the agent portal and public inquiry E2E specs (plain module, not a spec).
// The access key is a low-entropy test UUID so secret scanners never flag it.
export const TEST_ACCESS_KEY = '00000000-0000-4000-8000-000000000000';
export const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/** Aborts and records every RentCast request: agent pages must make none. */
export async function rentcastTripwire(page: Page): Promise<string[]> {
	const hits: string[] = [];
	await page.route('https://api.rentcast.io/**', (route) => {
		hits.push(route.request().url());
		return route.abort();
	});
	return hits;
}

export type W3FMode = 'ok' | 'rejected' | 'captcha' | 'rate-limited' | 'server' | 'network';

const CORS = {
	'access-control-allow-origin': '*',
	'access-control-allow-headers': 'content-type, accept',
	'access-control-allow-methods': 'POST'
};

/**
 * Mocks https://api.web3forms.com/submit. Answers the CORS preflight, records each POST body and
 * fulfils it per `mode`. The returned array fills as requests arrive.
 */
export async function mockWeb3Forms(
	page: Page,
	mode: W3FMode = 'ok'
): Promise<Record<string, unknown>[]> {
	const posts: Record<string, unknown>[] = [];
	await page.route('https://api.web3forms.com/submit', async (route) => {
		const req = route.request();
		if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
		posts.push(req.postDataJSON() as Record<string, unknown>);
		if (mode === 'network') return route.abort('failed');
		const reply = (status: number, body: unknown) =>
			route.fulfill({
				status,
				headers: { ...CORS, 'content-type': 'application/json' },
				body: JSON.stringify(body)
			});
		switch (mode) {
			case 'ok':
				return reply(200, { success: true, message: 'Email sent successfully!' });
			case 'rejected':
				return reply(400, { success: false, message: 'Invalid access key' });
			case 'captcha':
				return reply(400, { success: false, body: { message: 'hCaptcha verification required' } });
			case 'rate-limited':
				return reply(429, { success: false, message: 'Too may requests. Please try later!' });
			case 'server':
				return reply(500, { statusCode: 500, error: 'Something went wrong on server.' });
		}
	});
	return posts;
}

/** Relative inquiry page path (resolves under both the root and sub-path bases). */
export function inquiryPath(params: Record<string, string>): string {
	return `agent/inquire/?${new URLSearchParams(params).toString()}`;
}

export async function expectAxeClean(page: Page, label: string): Promise<void> {
	const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
	expect(results.passes.length, `axe evaluated no rules on ${label}`).toBeGreaterThan(0);
	const ids = results.violations.map((v) => `${v.id} (${v.impact}): ${v.help}`);
	expect(results.violations, `axe violations on ${label}:\n${ids.join('\n')}`).toEqual([]);
}

export async function expectNoHorizontalScroll(page: Page): Promise<void> {
	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth - window.innerWidth
	);
	expect(overflow).toBeLessThanOrEqual(0);
}
