// Shared E2E helpers for the investor portal (07-03). A plain module, not a spec.
//
// This EXTENDS the 06-09 no-network harness, it does not fork it: import `test` and `expect`
// from here (re-exported from ../support/network, whose auto `net` fixture denies every non-local
// request first and fails the test if anything was denied), and call `test.use(INVESTOR_TEST_OPTIONS)`
// so service workers cannot bypass page.route. mockRentCast layers the investor answers over
// ../support/rentcast-mocks mockRentCast; anything it does not handle falls back to that mock.
// AI mocks reuse ../helpers/ai-mocks (Phase 5); keys go in through the shipped Settings UI.
import AxeBuilder from '@axe-core/playwright';
import type { Page, Route } from '@playwright/test';
import { fakeKey } from '../../support/fake-keys';
import {
	AI_HOSTS as AI_HOST_ORIGINS,
	openAiSettings,
	routeAnthropic,
	saveKey as saveAiKey,
	type AiCall
} from '../helpers/ai-mocks';
import { openSettings, saveKey } from '../helpers/settings';
import {
	expect,
	rentcastCalls,
	recordRequest,
	RENTER_TEST_OPTIONS,
	test,
	type Net
} from '../support/network';
import {
	MARKETS_PATH,
	PROBE_ZIP,
	RENT_ESTIMATE_PATH,
	RENTCAST_V1_ROUTE,
	mockRentCast as mockFixtureRentCast,
	type MockRentCastOptions
} from '../support/rentcast-mocks';
import {
	SALE_LISTINGS_PATH,
	VALUE_ESTIMATE_PATH,
	marketStatsBody,
	rentEstimateFor,
	type MockResult
} from './rentcast-mocks';

export { expect, test, type Net };
export * from './rentcast-mocks';

/** Every investor spec: `test.use(INVESTOR_TEST_OPTIONS)` (page.route misses SW requests). */
export const INVESTOR_TEST_OPTIONS = RENTER_TEST_OPTIONS;

export const RENTCAST_ORIGIN = 'https://api.rentcast.io';
export const AI_HOSTS = [
	'api.anthropic.com',
	'api.openai.com',
	'generativelanguage.googleapis.com',
	'openrouter.ai'
] as const;

/** A live list of every request URL whose host is one of `hosts` (filled from page 'request'). */
export function collectRequests(page: Page, hosts: readonly string[]): string[] {
	const urls: string[] = [];
	page.on('request', (r) => {
		if (hosts.includes(new URL(r.url()).host)) urls.push(r.url());
	});
	return urls;
}

export type InvestorEndpoint = 'rentEstimate' | 'valueEstimate' | 'saleListings' | 'markets';
export type MockAnswer = MockResult | ((url: URL) => MockResult | Promise<MockResult>);

export interface InvestorMockOptions extends MockRentCastOptions {
	/** Rent-estimate comparables (fixture comps, cloned when more are asked for). Default 8. */
	rentComps?: number;
	/** Replace one endpoint's answer (any status), e.g. `{ valueEstimate: { status: 429, body } }`. */
	respond?: Partial<Record<InvestorEndpoint, MockAnswer>>;
}

export interface RentCastMock {
	/** RentCast requests answered so far; with `path` (e.g. '/v1/avm/value'), only that path. */
	count(path?: string): number;
	/** Every answered RentCast URL, in order (CORS preflights excluded). */
	readonly urls: string[];
}

const CORS = { 'access-control-allow-origin': '*' };
const JSON_HEADERS = { ...CORS, 'content-type': 'application/json' };
const NOT_FOUND = { error: 'resource/not-found', message: 'No sample data matches this request.' };

function endpointOf(pathname: string): InvestorEndpoint | null {
	const path = pathname.replace(/\/+$/, '');
	if (path === RENT_ESTIMATE_PATH) return 'rentEstimate';
	if (path === VALUE_ESTIMATE_PATH) return 'valueEstimate';
	if (path === SALE_LISTINGS_PATH) return 'saleListings';
	if (path === MARKETS_PATH) return 'markets';
	return null;
}

/**
 * Mocks RentCast for an investor spec: rent AVM with `rentComps` comparables, value AVM and
 * for-sale listings from the fixtures, market stats with the monthly bedroom series
 * (rentcast-mocks.ts marketStatsBody), 404 for anything the fixtures do not cover. Register it
 * inside the test (after the deny-all).
 */
export async function mockRentCast(
	page: Page,
	net: Net,
	opts: InvestorMockOptions = {}
): Promise<RentCastMock> {
	await mockFixtureRentCast(page, net, opts);
	const rentComps = opts.rentComps ?? 8;

	async function answer(endpoint: InvestorEndpoint, url: URL): Promise<MockResult | null> {
		const custom = opts.respond?.[endpoint];
		if (custom) return typeof custom === 'function' ? custom(url) : custom;
		if (endpoint === 'rentEstimate') return rentEstimateFor(url, rentComps);
		if (endpoint === 'markets') {
			const zip = url.searchParams.get('zipCode') ?? '';
			if (zip === PROBE_ZIP || opts.markets === 'none') return null;
			const body = await marketStatsBody(zip);
			return body ? { status: 200, body } : { status: 404, body: NOT_FOUND };
		}
		return null;
	}

	// Registered after the fixture mock, so it is consulted first; unhandled requests fall back.
	await page.route(RENTCAST_V1_ROUTE, async (route: Route) => {
		const request = route.request();
		const url = new URL(request.url());
		const endpoint = endpointOf(url.pathname);
		if (request.method() === 'OPTIONS' || endpoint === null) return route.fallback();
		const result = await answer(endpoint, url);
		if (result === null) return route.fallback();
		recordRequest(net, request);
		await route.fulfill({
			status: result.status,
			headers: JSON_HEADERS,
			body: JSON.stringify(result.body)
		});
	});

	return {
		count: (path?: string) => rentcastCalls(net, path),
		get urls() {
			return net.requests
				.filter((r) => new URL(r.url).host === 'api.rentcast.io')
				.map((r) => r.url);
		}
	};
}

/**
 * Answers every RentCast request 500 and records it: proves a keyless or manual flow never calls
 * RentCast (`expect(blocked.count()).toBe(0)`).
 */
export async function blockRentCast(page: Page): Promise<{ count(): number; urls: string[] }> {
	const urls: string[] = [];
	await page.route(`${RENTCAST_ORIGIN}/**`, async (route) => {
		if (route.request().method() === 'OPTIONS') {
			await route.fulfill({
				status: 204,
				headers: { ...CORS, 'access-control-allow-headers': '*' }
			});
			return;
		}
		urls.push(route.request().url());
		await route.fulfill({ status: 500, headers: JSON_HEADERS, body: '{}' });
	});
	return { count: () => urls.length, urls };
}

/**
 * Saves a fake RentCast key through the shipped Settings UI (session-only default) and waits for
 * the saved state. The default is the shared gitleaks-safe fake key, assembled at runtime.
 */
export async function useMockedRentCastKey(page: Page, key = fakeKey('rentcast')): Promise<void> {
	await openSettings(page);
	await saveKey(page, 'RentCast', key);
	await expect(page.locator('#key-rentcast')).toContainText(`Key ending in ${key.slice(-4)}`);
}

/**
 * Saves a fake Anthropic key through Settings > AI drafting. Call mockAnthropicText first: saving
 * may list models, and the deny-all fails the test on any unmocked provider request.
 */
export async function useMockedAnthropicKey(page: Page, key = fakeKey('anthropic')): Promise<void> {
	await openAiSettings(page);
	await saveAiKey(page, 'Anthropic', key);
}

/**
 * Answers api.anthropic.com/v1/messages with an SSE stream of `text` (the Phase 5 routeAnthropic
 * mock) and returns the live list of calls it served.
 */
export function mockAnthropicText(page: Page, text: string): Promise<AiCall[]> {
	return routeAnthropic(page, { stream: text });
}

/** The Anthropic origin, for specs that assert on hosts. */
export const ANTHROPIC_ORIGIN = AI_HOST_ORIGINS.anthropic;

type PrintWindow = Window & { __printed?: number };

/** Replaces window.print with a counter at window.__printed. Call before navigation. */
export async function stubPrint(page: Page): Promise<void> {
	await page.addInitScript(() => {
		const w = window as PrintWindow;
		w.__printed = 0;
		w.print = () => {
			w.__printed = (w.__printed ?? 0) + 1;
		};
	});
}

/** How many times the page called window.print() (stubPrint must be installed). */
export function printCount(page: Page): Promise<number> {
	return page.evaluate(() => (window as PrintWindow).__printed ?? 0);
}

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/** axe with the project's WCAG 2.0/2.1/2.2 A and AA tag set (a11y.spec.ts). */
export async function expectNoAxeViolations(page: Page, label: string): Promise<void> {
	const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
	expect(results.passes.length, `axe evaluated no rules on ${label}`).toBeGreaterThan(0);
	const ids = results.violations.map((v) => `${v.id} (${v.impact}): ${v.help}`);
	expect(results.violations, `axe violations on ${label}:\n${ids.join('\n')}`).toEqual([]);
}

/** The document never scrolls sideways at the current viewport. */
export async function expectNoHorizontalScroll(page: Page): Promise<void> {
	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth - window.innerWidth
	);
	expect(overflow, 'horizontal overflow in px').toBeLessThanOrEqual(0);
}
