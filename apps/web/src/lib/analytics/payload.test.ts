import { describe, expect, test } from 'vitest';
import {
	SCREEN_CLASSES,
	buildPageview,
	portalOf,
	referrerOrigin,
	screenClass,
	stripBase
} from './payload.js';

const WEBSITE_ID = '00000000-0000-4000-8000-000000000001';
const HOST = 'tranrealestate.github.io';
const BASE = '/tran_real_estate';

describe('screenClass', () => {
	test('exposes exactly three classes', () => {
		expect(SCREEN_CLASSES).toEqual(['small', 'medium', 'large']);
	});

	test.each([
		[375, 'small'],
		[639, 'small'],
		[640, 'medium'],
		[1023, 'medium'],
		[1024, 'large'],
		[2560, 'large']
	])('%d -> %s', (width, expected) => {
		expect(screenClass(width)).toBe(expected);
	});

	test.each([NaN, Infinity, -Infinity, -1])('non-finite or negative width %d -> small', (w) => {
		expect(screenClass(w)).toBe('small');
	});
});

describe('stripBase', () => {
	test('removes the base from a nested path', () => {
		expect(stripBase('/tran_real_estate/renter/', BASE)).toBe('/renter/');
	});

	test('the bare base becomes /', () => {
		expect(stripBase('/tran_real_estate', BASE)).toBe('/');
		expect(stripBase('/tran_real_estate/', BASE)).toBe('/');
	});

	test('an empty base leaves the path alone', () => {
		expect(stripBase('/renter/', '')).toBe('/renter/');
	});

	test('cuts at the first ? or #', () => {
		expect(stripBase('/tran_real_estate/agent/inquire/?k=1#x', BASE)).toBe('/agent/inquire/');
		expect(stripBase('/investor/#a?b', '')).toBe('/investor/');
	});

	test('a path outside the base is returned unchanged', () => {
		expect(stripBase('/other/renter/', BASE)).toBe('/other/renter/');
		expect(stripBase('/tran_real_estate_x/', BASE)).toBe('/tran_real_estate_x/');
	});

	test('an empty path becomes /', () => {
		expect(stripBase('', '')).toBe('/');
	});
});

describe('portalOf', () => {
	test.each([
		['/renter/', 'renter'],
		['/renter/saved/', 'renter'],
		['/investor/', 'investor'],
		['/investor/deals/', 'investor'],
		['/agent/', 'agent'],
		['/agent/crm/', 'agent']
	])('%s -> %s', (path, portal) => {
		expect(portalOf(path)).toBe(portal);
	});

	test.each(['/', '/for-renters/', '/tools/cap-rate/', '/setup/rentcast/', '/settings/'])(
		'%s -> none',
		(path) => {
			expect(portalOf(path)).toBe('none');
		}
	);
});

describe('referrerOrigin', () => {
	test('reduces an external referrer to its origin URL', () => {
		expect(referrerOrigin('https://news.ycombinator.com/item?id=1', HOST)).toBe(
			'https://news.ycombinator.com/'
		);
		expect(referrerOrigin('http://example.org/a?b#c', HOST)).toBe('http://example.org/');
	});

	test('same host, empty, non-http and unparseable referrers are dropped', () => {
		expect(referrerOrigin(`https://${HOST}/tran_real_estate/`, HOST)).toBeUndefined();
		expect(referrerOrigin('', HOST)).toBeUndefined();
		expect(referrerOrigin('android-app://x', HOST)).toBeUndefined();
		expect(referrerOrigin('not a url', HOST)).toBeUndefined();
	});

	test('credentials in a referrer never survive', () => {
		expect(referrerOrigin('https://user:pass@example.org:8443/p', HOST)).toBe(
			'https://example.org/'
		);
	});
});

describe('buildPageview', () => {
	test('builds the exact whitelisted Umami body', () => {
		expect(
			buildPageview(
				{ pathname: '/tran_real_estate/investor/deals/', hostname: HOST },
				'https://www.google.com/search?q=x',
				390,
				WEBSITE_ID,
				BASE
			)
		).toStrictEqual({
			type: 'event',
			payload: {
				website: WEBSITE_ID,
				hostname: HOST,
				url: '/investor/deals/',
				referrer: 'https://www.google.com/',
				screen: 'small',
				data: { portal: 'investor' }
			}
		});
	});

	test('omits the referrer key when there is no external referrer', () => {
		const { payload } = buildPageview({ pathname: '/renter/', hostname: HOST }, '', 1280, WEBSITE_ID);
		expect('referrer' in payload).toBe(false);
		const self = buildPageview(
			{ pathname: '/renter/', hostname: HOST },
			`https://${HOST}/`,
			1280,
			WEBSITE_ID
		);
		expect('referrer' in self.payload).toBe(false);
	});

	test('carries only whitelisted keys', () => {
		const body = buildPageview(
			{ pathname: '/tran_real_estate/agent/', hostname: HOST },
			'https://example.org/x',
			800,
			WEBSITE_ID,
			BASE
		);
		expect(Object.keys(body)).toEqual(['type', 'payload']);
		const allowed = ['website', 'hostname', 'url', 'referrer', 'screen', 'data'];
		for (const key of Object.keys(body.payload)) expect(allowed).toContain(key);
		for (const banned of ['ip', 'userAgent', 'id', 'language', 'title', 'timestamp', 'tag', 'name']) {
			expect(banned in body.payload).toBe(false);
		}
		expect(Object.keys(body.payload.data)).toEqual(['portal']);
	});

	test.each(['/agent/inquire/?k=00000000-0000-4000-8000-000000000000&n=A', '/investor/analyze/?id=abc#x'])(
		'never leaks a query or fragment: %s',
		(href) => {
			const u = new URL(href, `https://${HOST}`);
			const { payload } = buildPageview(
				{ pathname: u.pathname, hostname: u.hostname },
				'',
				1280,
				WEBSITE_ID
			);
			expect(payload.url).not.toMatch(/[?#]/);
		}
	);

	test.each([
		['/tran_real_estate/agent/inquire/?k=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 'https://a.example.com/x?token=BBBBBBBBBBBBBBBBBBBBBBBBBBBBBB'],
		['/tran_real_estate/renter/#frag', 'https://user:secret@b.example.org/p#q'],
		['/tran_real_estate/', '']
	])('value hygiene for %s with referrer %s', (pathname, referrer) => {
		const { payload } = buildPageview({ pathname, hostname: HOST }, referrer, 700, WEBSITE_ID, BASE);
		const values = [
			payload.hostname,
			payload.url,
			payload.screen,
			payload.data.portal,
			...(payload.referrer === undefined ? [] : [payload.referrer])
		];
		for (const v of values) {
			expect(v).not.toMatch(/[?#@]/);
			expect(v).not.toMatch(/[A-Za-z0-9_]{24,}/);
		}
	});
});
