// The launch-proof screenshot script (13-08, D-20): its argument gate and its plan are pure and
// tested here without a browser. The script itself runs against the live site in plan 13-13 and is
// scanned by scripts/smoke-readonly.test.ts like every other file under apps/web/tests/smoke.
import { describe, expect, test } from 'vitest';
import { checkMisses, parseProofArgs, proofPlan } from '../apps/web/tests/smoke/proof-shots.mjs';

const BASE = 'https://wolfwdavid.github.io/tran_real_estate/';

describe('parseProofArgs', () => {
	test('returns the base URL and the output directory', () => {
		expect(parseProofArgs(['--base-url', BASE, '--out', 'x'])).toEqual({ baseUrl: BASE, out: 'x' });
	});

	test('argument order does not matter', () => {
		expect(parseProofArgs(['--out', 'shots', '--base-url', BASE])).toEqual({
			baseUrl: BASE,
			out: 'shots'
		});
	});

	test('a missing --base-url throws by name', () => {
		expect(() => parseProofArgs(['--out', 'x'])).toThrow(/--base-url is required/);
	});

	test('an http:// base throws by name', () => {
		expect(() =>
			parseProofArgs(['--base-url', 'http://wolfwdavid.github.io/tran_real_estate/', '--out', 'x'])
		).toThrow(/--base-url must be https/);
	});

	test('a base without its trailing slash throws by name', () => {
		expect(() =>
			parseProofArgs(['--base-url', 'https://wolfwdavid.github.io/tran_real_estate', '--out', 'x'])
		).toThrow(/--base-url must end with \//);
	});

	test('a base that is not an absolute URL throws by name', () => {
		expect(() => parseProofArgs(['--base-url', 'not a url/', '--out', 'x'])).toThrow(
			/--base-url is not an absolute URL/
		);
	});

	test('a missing --out throws by name', () => {
		expect(() => parseProofArgs(['--base-url', BASE])).toThrow(/--out is required/);
	});

	test('an unknown flag throws by name', () => {
		expect(() => parseProofArgs(['--base-url', BASE, '--out', 'x', '--full-page'])).toThrow(
			/unknown argument --full-page/
		);
	});
});

describe('proofPlan: shots', () => {
	const { shots } = proofPlan(BASE);

	test('five numbered screenshots in the locked order', () => {
		expect(shots.map((s) => s.file)).toEqual([
			'01-landing.png',
			'02-renter.png',
			'03-deep-route-refresh.png',
			'04-not-found.png',
			'05-version-json.png'
		]);
	});

	test('each shot targets its page under the base', () => {
		expect(shots.map((s) => s.url)).toEqual([
			BASE,
			`${BASE}renter/`,
			`${BASE}investor/`,
			`${BASE}proof-not-found-13/`,
			`${BASE}_app/version.json`
		]);
		for (const s of shots) expect(s.url.startsWith(BASE), s.file).toBe(true);
	});

	test('only the deep-route shot reloads the page', () => {
		expect(shots.filter((s) => s.reload).map((s) => s.file)).toEqual(['03-deep-route-refresh.png']);
	});
});

describe('proofPlan: checks', () => {
	const { checks } = proofPlan(BASE);
	const byName = Object.fromEntries(checks.map((c) => [c.name, c]));

	test('records the five HTTP facts in order', () => {
		expect(checks.map((c) => c.name)).toEqual([
			'landing',
			'slashless-redirect',
			'not-found',
			'http-upgrade',
			'version-json'
		]);
	});

	test('landing answers 200', () => {
		expect(byName['landing']).toMatchObject({ url: BASE, expectStatus: 200 });
	});

	test('the slashless renter path answers 301 to the slash form', () => {
		expect(byName['slashless-redirect']).toMatchObject({
			url: `${BASE}renter`,
			expectStatus: 301,
			expectLocation: { endsWith: '/renter/' }
		});
	});

	test('the unknown path answers 404', () => {
		expect(byName['not-found']).toMatchObject({
			url: `${BASE}proof-not-found-13/`,
			expectStatus: 404
		});
	});

	test('the http:// variant of the base answers 301 to an https:// Location', () => {
		expect(byName['http-upgrade']).toMatchObject({
			url: 'http://wolfwdavid.github.io/tran_real_estate/',
			expectStatus: 301,
			expectLocation: { startsWith: 'https://' }
		});
	});

	test('version.json answers 200 JSON with a 40-hex version', () => {
		expect(byName['version-json']).toMatchObject({
			url: `${BASE}_app/version.json`,
			expectStatus: 200,
			expectVersionSha: true
		});
	});

	test('every check but the http variant stays under the base', () => {
		for (const c of checks) {
			if (c.name === 'http-upgrade') continue;
			expect(c.url.startsWith(BASE), c.name).toBe(true);
		}
	});
});

describe('checkMisses', () => {
	const { checks } = proofPlan(BASE);
	const byName = Object.fromEntries(checks.map((c) => [c.name, c]));
	const sha = 'a'.repeat(40);

	test('a response that holds every expectation has no misses', () => {
		expect(checkMisses(byName['landing'], { status: 200, location: null, version: null })).toEqual(
			[]
		);
		expect(
			checkMisses(byName['slashless-redirect'], {
				status: 301,
				location: `${BASE}renter/`,
				version: null
			})
		).toEqual([]);
		expect(
			checkMisses(byName['http-upgrade'], { status: 301, location: BASE, version: null })
		).toEqual([]);
		expect(
			checkMisses(byName['version-json'], { status: 200, location: null, version: sha })
		).toEqual([]);
	});

	test('names a wrong status', () => {
		expect(
			checkMisses(byName['not-found'], { status: 200, location: null, version: null })
		).toEqual(['status 200, expected 404']);
	});

	test('names a redirect Location that does not end with the slash form', () => {
		const misses = checkMisses(byName['slashless-redirect'], {
			status: 301,
			location: `${BASE}renter`,
			version: null
		});
		expect(misses).toEqual([
			`Location ${JSON.stringify(`${BASE}renter`)} does not end with /renter/`
		]);
	});

	test('names a redirect that stays on http://', () => {
		const misses = checkMisses(byName['http-upgrade'], {
			status: 301,
			location: 'http://wolfwdavid.github.io/tran_real_estate/',
			version: null
		});
		expect(misses).toHaveLength(1);
		expect(misses[0]).toMatch(/does not start with https:\/\//);
	});

	test('a missing Location counts as a miss', () => {
		expect(
			checkMisses(byName['slashless-redirect'], { status: 301, location: null, version: null })
		).toEqual(['Location "" does not end with /renter/']);
	});

	test('names a version that is not a 40-hex SHA', () => {
		expect(
			checkMisses(byName['version-json'], { status: 200, location: null, version: 'dev' })
		).toEqual(['version "dev" is not a 40-hex SHA']);
		expect(
			checkMisses(byName['version-json'], { status: 200, location: null, version: null })
		).toEqual(['version null is not a 40-hex SHA']);
	});

	test('reports every miss, not only the first', () => {
		expect(
			checkMisses(byName['version-json'], { status: 404, location: null, version: null })
		).toHaveLength(2);
	});
});
