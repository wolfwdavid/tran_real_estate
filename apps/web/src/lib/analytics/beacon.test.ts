import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createTracker, send } from './beacon.js';
import { buildPageview, type BeaconBody } from './payload.js';

const WEBSITE_ID = '00000000-0000-4000-8000-000000000001';
const HOST = 'https://stats.example.org';
const SITE = 'https://tranrealestate.github.io';

type Call = [string, RequestInit];
let calls: Call[];
let fake: typeof fetch;

beforeEach(() => {
	calls = [];
	fake = ((u: string, i: RequestInit) => (
		calls.push([u, i]),
		Promise.resolve(new Response())
	)) as unknown as typeof fetch;
});

const body: BeaconBody = buildPageview(
	{ pathname: '/renter/', hostname: 'tranrealestate.github.io' },
	'',
	1280,
	WEBSITE_ID
);

const flush = () => new Promise<void>((r) => setTimeout(r, 0));

test('send is a no-op without a host', () => {
	send(body, { host: '' }, fake);
	expect(calls).toHaveLength(0);
});

test('send makes exactly one CORS-simple POST to /api/send', () => {
	send(body, { host: HOST }, fake);
	expect(calls).toHaveLength(1);
	const [url, init] = calls[0];
	expect(url).toBe(`${HOST}/api/send`);
	expect(init).toMatchObject({
		method: 'POST',
		mode: 'no-cors',
		credentials: 'omit',
		keepalive: true,
		referrerPolicy: 'no-referrer',
		cache: 'no-store'
	});
	expect(init.headers).toBeUndefined();
	expect(typeof init.body).toBe('string');
	expect(JSON.parse(init.body as string)).toStrictEqual(body);
});

// Vitest fails the run on any unhandled rejection, so a clean run proves none escaped.
describe('errors never surface', () => {
	test('a rejecting fetch never throws or leaves an unhandled rejection', async () => {
		const rejecting = vi.fn(() =>
			Promise.reject(new TypeError('offline'))
		) as unknown as typeof fetch;
		expect(() => send(body, { host: HOST }, rejecting)).not.toThrow();
		await flush();
		await flush();
		expect(rejecting).toHaveBeenCalledTimes(1);
	});

	test('a synchronously throwing fetch never throws', async () => {
		const throwing = vi.fn(() => {
			throw new TypeError('blocked');
		}) as unknown as typeof fetch;
		expect(() => send(body, { host: HOST }, throwing)).not.toThrow();
		await flush();
		expect(throwing).toHaveBeenCalledTimes(1);
	});
});

test('send without an injected fetch uses the global lazily (no-network guard is swallowed)', () => {
	// The unit harness replaces globalThis.fetch with a throwing guard; send must swallow it.
	expect(() => send(body, { host: HOST })).not.toThrow();
});

test('tracker without a host sends nothing', () => {
	createTracker({ host: '', websiteId: '', base: '', fetchImpl: fake, nav: {}, win: {} }).pageview(
		new URL(`${SITE}/renter/`),
		'',
		1280
	);
	expect(calls).toHaveLength(0);
});

test('tracker with a host but no website id sends nothing', () => {
	createTracker({
		host: HOST,
		websiteId: '',
		base: '',
		fetchImpl: fake,
		nav: {},
		win: {}
	}).pageview(new URL(`${SITE}/renter/`), '', 1280);
	expect(calls).toHaveLength(0);
});

test('tracker honours GPC', () => {
	createTracker({
		host: HOST,
		websiteId: WEBSITE_ID,
		base: '',
		fetchImpl: fake,
		nav: { globalPrivacyControl: true },
		win: {}
	}).pageview(new URL(`${SITE}/renter/`), '', 1280);
	expect(calls).toHaveLength(0);
});

test('tracker honours DNT', () => {
	createTracker({
		host: HOST,
		websiteId: WEBSITE_ID,
		base: '',
		fetchImpl: fake,
		nav: {},
		win: { doNotTrack: '1' }
	}).pageview(new URL(`${SITE}/renter/`), '', 1280);
	expect(calls).toHaveLength(0);
});

test('configured and allowed tracker sends the buildPageview body', () => {
	const url = new URL(`${SITE}/tran_real_estate/investor/deals/`);
	createTracker({
		host: HOST,
		websiteId: WEBSITE_ID,
		base: '/tran_real_estate',
		fetchImpl: fake,
		nav: {},
		win: {}
	}).pageview(url, 'https://www.google.com/search?q=x', 390);
	expect(calls).toHaveLength(1);
	expect(JSON.parse(calls[0][1].body as string)).toStrictEqual(
		buildPageview(
			{ pathname: url.pathname, hostname: url.hostname },
			'https://www.google.com/search?q=x',
			390,
			WEBSITE_ID,
			'/tran_real_estate'
		)
	);
});

test('tracker strips the query string from the page URL', () => {
	createTracker({
		host: HOST,
		websiteId: WEBSITE_ID,
		base: '',
		fetchImpl: fake,
		nav: {},
		win: {}
	}).pageview(new URL(`${SITE}/renter/?id=1`), '', 1280);
	expect(calls).toHaveLength(1);
	expect(JSON.parse(calls[0][1].body as string).payload.url).toBe('/renter/');
});
