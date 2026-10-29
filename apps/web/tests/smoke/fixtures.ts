// Smoke fixtures (SMOKE-01). Every smoke spec imports `test` from here, so every spec inherits:
//   - GPC on (Sec-GPC header + the navigator flag), so the live site never counts a smoke visit
//   - a read-only network monitor: provider hosts are aborted at the route layer and fail the test,
//     any write (non-GET/HEAD) beyond the analytics beacon budget fails it, and so does any request
//     carrying a key header
// `testGpcOff` drops the GPC part only. analytics.smoke.ts is its one legitimate user.
import { test as base, expect } from '@playwright/test';
import { CONNECT } from '../../../../scripts/assert-csp.mjs';
import { parseSmokeEnv } from './env.js';

const smoke = parseSmokeEnv(process.env);

/**
 * Provider origins the smoke must never reach: CONNECT minus 'self' (RentCast, Anthropic, OpenAI,
 * Gemini, OpenRouter, Web3Forms). Derived from the CSP oracle so there is no third host list.
 */
export const PROVIDER_ORIGINS: readonly string[] = CONNECT.filter((s) => s !== "'self'").map(
	(h) => new URL(h).origin
);
const KEY_HEADERS = ['x-api-key', 'authorization', 'x-goog-api-key', 'anthropic-api-key'];

interface Seen {
	method: string;
	url: string;
	type: string;
	headers: Record<string, string>;
}

const withMonitor = base.extend<{ beaconBudget: number; monitor: void }>({
	// Analytics beacons a spec may send (POST <analyticsHost>/api/send). Zero unless a spec opts in.
	beaconBudget: [0, { option: true }],
	monitor: [
		async ({ context, beaconBudget }, use) => {
			const seen: Seen[] = [];
			const blocked: string[] = [];
			context.on('request', (r) => {
				seen.push({
					method: r.method(),
					url: r.url(),
					type: r.resourceType(),
					headers: r.headers()
				});
			});
			for (const origin of PROVIDER_ORIGINS) {
				await context.route(`${origin}/**`, (r) => {
					blocked.push(r.request().url());
					return r.abort('blockedbyclient');
				});
			}

			await use();

			expect(blocked, 'provider-host requests (RentCast / LLM / Web3Forms)').toEqual([]);
			const beacon = (s: Seen) =>
				s.method === 'POST' &&
				smoke.analyticsHost !== '' &&
				s.url === `${smoke.analyticsHost}/api/send`;
			expect(
				seen
					.filter((s) => !['GET', 'HEAD'].includes(s.method) && !beacon(s))
					.map((s) => `${s.method} ${s.url}`),
				'write requests'
			).toEqual([]);
			expect(seen.filter(beacon).length, 'analytics beacons').toBeLessThanOrEqual(beaconBudget);
			expect(
				seen.filter((s) => KEY_HEADERS.some((h) => h in s.headers)).map((s) => s.url),
				'requests carrying a key header'
			).toEqual([]);
		},
		{ auto: true }
	]
});

export const test = withMonitor.extend<{ gpc: void }>({
	extraHTTPHeaders: { 'Sec-GPC': '1' },
	gpc: [
		async ({ context }, use) => {
			await context.addInitScript(() =>
				Object.defineProperty(Navigator.prototype, 'globalPrivacyControl', { get: () => true })
			);
			await use();
		},
		{ auto: true }
	]
});

/** GPC OFF. Imported by analytics.smoke.ts ONLY (12-09 adds a static guard). */
export const testGpcOff = withMonitor;
export { expect, smoke };
/** Re-exported so specs never import @playwright/test directly (scripts/smoke-readonly.test.ts). */
export type { Page } from '@playwright/test';
