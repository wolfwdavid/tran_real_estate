// scripts/smoke.mjs: target table, build-stamp reads, the stale-build gate and the version poll.
// Importing the module must never run its CLI (it would start serve-pages or spawn Playwright).
// Also pins the 429 relabel (classifySuiteExit + the SMOKE_429_LOG fixture): a rate-limited Pages CDN exits 2.
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, test, vi } from 'vitest';
import { resolveSiteOrigin } from '../apps/web/src/lib/site-config.js';
import {
	AGENT_ROUTES,
	APP_ROUTES,
	INVESTOR_ROUTES,
	LEGAL_ROUTES,
	LIVE_THIRD_PARTY_SAMPLE,
	MARKETING_ROUTES,
	PRINT_ROUTES,
	PUBLIC_ROUTES,
	RENTER_ROUTES,
	ROUTES,
	STUDIO_ROUTES,
	TOOL_ROUTES
} from '../apps/web/tests/e2e/routes';
import { targetEnv } from './lib/build-targets.mjs';
import {
	checkSuperseded,
	classifyServed,
	classifySuiteExit,
	countRateLimited,
	githubCompare,
	localTargets,
	readStamp,
	staleBuilds,
	supersededLookup,
	waitForVersion
} from './smoke.mjs';

const HEAD = 'b'.repeat(40);

describe('localTargets', () => {
	test('defaults: root, sub, configured in order on the emulator ports', () => {
		expect(localTargets({})).toEqual([
			{
				name: 'root',
				baseUrl: 'http://127.0.0.1:4273/',
				siteUrl: 'https://wolfwdavid.github.io/',
				analyticsHost: '',
				dir: 'apps/web/build'
			},
			{
				name: 'sub',
				baseUrl: 'http://127.0.0.1:4274/tran_real_estate/',
				siteUrl: 'https://wolfwdavid.github.io/tran_real_estate/',
				analyticsHost: '',
				dir: 'apps/web/build-sub'
			},
			{
				name: 'configured',
				baseUrl: 'http://127.0.0.1:4276/',
				// Derived, never a literal: the configured target's site URL may change.
				siteUrl: resolveSiteOrigin({ ...targetEnv('configured', {}) }) + '/',
				analyticsHost: 'http://127.0.0.1:4275',
				dir: 'apps/web/build-configured'
			}
		]);
	});

	test('E2E_PORT_* overrides move every port, including the configured analytics host', () => {
		const t = localTargets({
			E2E_PORT_ROOT: '5001',
			E2E_PORT_SUB: '5002',
			E2E_PORT_CONFIGURED: '5003',
			E2E_PORT_ATTACKER: '5004'
		});
		expect(t.map((x) => x.baseUrl)).toEqual([
			'http://127.0.0.1:5001/',
			'http://127.0.0.1:5002/tran_real_estate/',
			'http://127.0.0.1:5003/'
		]);
		expect(t[2].analyticsHost).toBe('http://127.0.0.1:5004');
	});

	test('root takes owner settings from the env; sub stays blank', () => {
		const t = localTargets({
			PUBLIC_ANALYTICS_HOST: 'https://gateway.umami.is',
			PUBLIC_ANALYTICS_WEBSITE_ID: '11111111-1111-4111-8111-111111111111'
		});
		expect(t[0].analyticsHost).toBe('https://gateway.umami.is');
		expect(t[1].analyticsHost).toBe('');
	});

	test('root follows BASE_PATH (D-02): the emulator base and the site URL move together', () => {
		const knob = localTargets({ BASE_PATH: '/tran_real_estate' });
		expect(knob[0].baseUrl).toBe('http://127.0.0.1:4273/tran_real_estate/');
		expect(knob[0].siteUrl).toMatch(/\/tran_real_estate\/$/);
		expect(knob[1].baseUrl).toBe('http://127.0.0.1:4274/tran_real_estate/');
		expect(knob[2].baseUrl).toBe('http://127.0.0.1:4276/');
		const unset = localTargets({});
		expect(unset[0].baseUrl).toBe('http://127.0.0.1:4273/');
		expect(unset[1].baseUrl).toBe('http://127.0.0.1:4274/tran_real_estate/');
	});

	test('a malformed BASE_PATH is rejected by name instead of producing a bad root base', () => {
		expect(() => localTargets({ BASE_PATH: 'C:/Program Files/Git/tran_real_estate' })).toThrow(
			/BASE_PATH must be/
		);
	});
});

describe('readStamp', () => {
	const tmp = mkdtempSync(join(tmpdir(), 'smoke-stamp-'));
	afterAll(() => rmSync(tmp, { recursive: true, force: true }));

	test('returns the version from <dir>/_app/version.json', () => {
		const dir = join(tmp, 'build');
		mkdirSync(join(dir, '_app'), { recursive: true });
		writeFileSync(join(dir, '_app', 'version.json'), JSON.stringify({ version: HEAD }));
		expect(readStamp(dir)).toBe(HEAD);
	});

	test('a missing file throws a named error', () => {
		let caught: unknown;
		try {
			readStamp(join(tmp, 'nope'));
		} catch (e) {
			caught = e;
		}
		expect(caught).toBeInstanceOf(Error);
		expect((caught as Error).name).toBe('MissingBuildStamp');
		expect((caught as Error).message).toMatch(/no build stamp at .*version\.json/);
	});
});

describe('staleBuilds', () => {
	const targets = [
		{ name: 'root', dir: 'apps/web/build' },
		{ name: 'sub', dir: 'apps/web/build-sub' },
		{ name: 'configured', dir: 'apps/web/build-configured' }
	];

	test('every stamp equals HEAD: no messages', () => {
		expect(staleBuilds(targets, HEAD, () => HEAD)).toEqual([]);
	});

	test('a stale stamp and a missing build each produce one message naming the rebuild', () => {
		const read = (dir: string) => {
			if (dir.endsWith('build-sub')) return 'c'.repeat(40);
			if (dir.endsWith('build-configured')) throw new Error('no build stamp');
			return HEAD;
		};
		const out = staleBuilds(targets, HEAD, read);
		expect(out).toHaveLength(2);
		expect(out[0]).toMatch(/apps\/web\/build-sub is missing or stale/);
		expect(out[0]).toContain('rebuild: pnpm build:sub');
		expect(out[1]).toMatch(/apps\/web\/build-configured is missing or stale \(stamp none/);
		expect(out[1]).toContain('rebuild: pnpm build:configured');
	});

	test('the default reader treats a missing dir as missing', () => {
		const out = staleBuilds([{ name: 'root', dir: join(tmpdir(), 'smoke-no-such-build') }], HEAD);
		expect(out).toHaveLength(1);
		expect(out[0]).toMatch(/missing or stale/);
		expect(out[0]).toContain('pnpm build:root');
	});
});

describe('waitForVersion', () => {
	const BASE = 'https://wolfwdavid.github.io/';

	test('resolves ok once version.json reports the SHA, polling through errors and non-200s', async () => {
		const get = vi
			.fn()
			.mockRejectedValueOnce(new Error('ECONNRESET'))
			.mockResolvedValueOnce({ status: 404, body: '<html>not found</html>' })
			.mockResolvedValue({ status: 200, body: JSON.stringify({ version: HEAD }) });
		await expect(waitForVersion(BASE, HEAD, { get, timeoutMs: 50, everyMs: 5 })).resolves.toBe(
			'ok'
		);
		expect(get).toHaveBeenCalledTimes(3);
	});

	test('requests the cache-busted version.json under the base', async () => {
		const get = vi.fn().mockResolvedValue({ status: 200, body: JSON.stringify({ version: HEAD }) });
		await waitForVersion(BASE, HEAD, { get, timeoutMs: 50, everyMs: 5 });
		expect(get.mock.calls[0][0]).toMatch(
			/^https:\/\/wolfwdavid\.github\.io\/_app\/version\.json\?_=\S+/
		);
	});

	test('resolves timeout when the SHA never shows (old deploy, bad JSON)', async () => {
		const get = vi
			.fn()
			.mockResolvedValueOnce({ status: 200, body: 'not json' })
			.mockResolvedValue({ status: 200, body: JSON.stringify({ version: 'd'.repeat(40) }) });
		await expect(waitForVersion(BASE, HEAD, { get, timeoutMs: 50, everyMs: 5 })).resolves.toBe(
			'timeout'
		);
		expect(get.mock.calls.length).toBeGreaterThan(1);
	});
});

describe('superseded: a newer deployed commit is not a failure (SMOKE-08)', () => {
	const BASE = 'https://wolfwdavid.github.io/tran_real_estate/';
	const REPO = 'wolfwdavid/tran_real_estate';
	const NEWER = 'c'.repeat(40);
	const OLDER = 'a'.repeat(40);
	const TOKEN = 'placeholder-for-the-unit-test';
	const CHAINED = {
		GITHUB_EVENT_NAME: 'workflow_run',
		GITHUB_REPOSITORY: REPO,
		GITHUB_TOKEN: TOKEN
	};
	const serves = (version: unknown) =>
		vi.fn().mockResolvedValue({ status: 200, body: JSON.stringify({ version }) });
	const answers = (status: unknown) =>
		vi.fn().mockResolvedValue({ status: 200, body: JSON.stringify({ status }) });
	const FAST = { timeoutMs: 50, everyMs: 5 };
	// A poll that would outlive the test if 'superseded' did not end it at once.
	const SLOW = { timeoutMs: 600_000, everyMs: 600_000 };

	describe('classifyServed', () => {
		test.each([
			['the expected SHA', HEAD, null, 'ok'],
			['the expected SHA, whatever the lookup says', HEAD, 'ahead', 'ok'],
			['a different SHA that compares ahead', NEWER, 'ahead', 'superseded'],
			['behind (propagation lag or a rollback)', OLDER, 'behind', 'pending'],
			['diverged (a force push)', NEWER, 'diverged', 'pending'],
			['identical with a different string', NEWER, 'identical', 'pending'],
			['a failed lookup', NEWER, null, 'pending'],
			['no lookup', NEWER, undefined, 'pending'],
			['an unknown status', NEWER, 'AHEAD', 'pending'],
			['a non-hex version', 'v1.2.3', 'ahead', 'pending'],
			['an upper-case SHA', NEWER.toUpperCase(), 'ahead', 'pending'],
			['a short SHA', NEWER.slice(1), 'ahead', 'pending'],
			['a SHA with a trailing newline', NEWER + '\n', 'ahead', 'pending'],
			['a version that is not a string', 42, 'ahead', 'pending'],
			['no version', null, 'ahead', 'pending']
		])('%s', (_name, served, status, want) => {
			expect(classifyServed(HEAD, served, status)).toBe(want);
		});
	});

	describe('waitForVersion with a compare lookup', () => {
		test('a newer SHA that compares ahead ends the poll at once with superseded', async () => {
			const get = serves(NEWER);
			const compare = vi.fn().mockResolvedValue('ahead');
			const onSuperseded = vi.fn();
			await expect(
				waitForVersion(BASE, HEAD, { get, compare, onSuperseded, ...SLOW })
			).resolves.toBe('superseded');
			expect(get).toHaveBeenCalledTimes(1);
			expect(compare.mock.calls).toEqual([[NEWER]]);
			expect(onSuperseded.mock.calls).toEqual([[NEWER]]);
		});

		test.each([
			['behind', () => Promise.resolve('behind')],
			['diverged', () => Promise.resolve('diverged')],
			['identical', () => Promise.resolve('identical')],
			['a null answer', () => Promise.resolve(null)],
			['a rejected lookup', () => Promise.reject(new Error('ECONNRESET'))],
			[
				'a throwing lookup',
				() => {
					throw new Error('boom');
				}
			]
		])('%s keeps polling to the timeout and asks once', async (_name, answer) => {
			const compare = vi.fn(answer);
			const onSuperseded = vi.fn();
			const get = serves(NEWER);
			await expect(
				waitForVersion(BASE, HEAD, { get, compare, onSuperseded, ...FAST })
			).resolves.toBe('timeout');
			expect(get.mock.calls.length).toBeGreaterThan(1);
			expect(compare).toHaveBeenCalledTimes(1);
			expect(onSuperseded).not.toHaveBeenCalled();
		});

		test('the expected SHA is ok and the lookup is never asked', async () => {
			const compare = vi.fn().mockResolvedValue('ahead');
			await expect(
				waitForVersion(BASE, HEAD, { get: serves(HEAD), compare, ...FAST })
			).resolves.toBe('ok');
			expect(compare).not.toHaveBeenCalled();
		});

		test('a version that is not a 40-hex SHA is never sent to the lookup', async () => {
			const compare = vi.fn().mockResolvedValue('ahead');
			await expect(
				waitForVersion(BASE, HEAD, { get: serves('../../orgs/x'), compare, ...FAST })
			).resolves.toBe('timeout');
			expect(compare).not.toHaveBeenCalled();
		});

		test('the lookup is asked once per distinct served SHA', async () => {
			const old = { status: 200, body: JSON.stringify({ version: OLDER }) };
			const get = vi
				.fn()
				.mockResolvedValueOnce(old)
				.mockResolvedValueOnce(old)
				.mockResolvedValueOnce(old)
				.mockResolvedValue({ status: 200, body: JSON.stringify({ version: NEWER }) });
			const compare = vi.fn((served: string) =>
				Promise.resolve(served === NEWER ? 'ahead' : 'behind')
			);
			await expect(
				waitForVersion(BASE, HEAD, { get, compare, timeoutMs: 5_000, everyMs: 1 })
			).resolves.toBe('superseded');
			expect(compare.mock.calls).toEqual([[OLDER], [NEWER]]);
		});

		test('without a lookup (the default) a newer SHA still times out', async () => {
			await expect(waitForVersion(BASE, HEAD, { get: serves(NEWER), ...FAST })).resolves.toBe(
				'timeout'
			);
		});
	});

	describe('githubCompare', () => {
		test('asks the compare endpoint for expected...served and returns its status', async () => {
			const get = answers('ahead');
			await expect(githubCompare(REPO, HEAD, NEWER, TOKEN, get)).resolves.toBe('ahead');
			expect(get).toHaveBeenCalledTimes(1);
			const [url, headers] = get.mock.calls[0];
			expect(url).toBe(`https://api.github.com/repos/${REPO}/compare/${HEAD}...${NEWER}`);
			expect(headers.authorization).toBe(`Bearer ${TOKEN}`);
			expect(headers.accept).toBe('application/vnd.github+json');
			expect(headers['user-agent']).toBeTruthy();
		});

		test('the token is never part of the URL', async () => {
			const get = answers('ahead');
			await githubCompare(REPO, HEAD, NEWER, TOKEN, get);
			expect(get.mock.calls[0][0]).not.toContain(TOKEN);
		});

		test('without a token no Authorization header is sent', async () => {
			const get = answers('behind');
			await expect(githubCompare(REPO, HEAD, NEWER, '', get)).resolves.toBe('behind');
			expect(Object.keys(get.mock.calls[0][1])).not.toContain('authorization');
		});

		test.each([
			['a non-hex head', REPO, HEAD, '../../../orgs/x'],
			['an upper-case head', REPO, HEAD, NEWER.toUpperCase()],
			['a short head', REPO, HEAD, NEWER.slice(1)],
			['a head with a query', REPO, HEAD, NEWER + '?x=1'],
			['a non-hex base', REPO, 'main', NEWER],
			['a repo with a third segment', 'a/b/c', HEAD, NEWER],
			['a repo with a query', 'a/b?x=1', HEAD, NEWER],
			['a repo with no owner', 'tran_real_estate', HEAD, NEWER],
			['an empty repo', '', HEAD, NEWER],
			['no repo', undefined, HEAD, NEWER]
		])('%s is rejected without a request', async (_name, repo, base, head) => {
			const get = answers('ahead');
			await expect(githubCompare(repo, base, head, TOKEN, get)).resolves.toBeNull();
			expect(get).not.toHaveBeenCalled();
		});

		test.each([
			['a 403', vi.fn().mockResolvedValue({ status: 403, body: '{"status":"ahead"}' })],
			['a 404', vi.fn().mockResolvedValue({ status: 404, body: '{"message":"Not Found"}' })],
			['a body that is not JSON', vi.fn().mockResolvedValue({ status: 200, body: '<html>' })],
			['a body without a status', vi.fn().mockResolvedValue({ status: 200, body: '{}' })],
			['a status that is not a string', answers(1)],
			['a network error', vi.fn().mockRejectedValue(new Error('ETIMEDOUT'))]
		])('%s is null', async (_name, get) => {
			await expect(githubCompare(REPO, HEAD, NEWER, TOKEN, get)).resolves.toBeNull();
		});
	});

	describe('supersededLookup', () => {
		test('a chained run with a repository and a token gets a lookup for expected...served', async () => {
			const get = answers('ahead');
			const lookup = supersededLookup(CHAINED, HEAD, get);
			expect(lookup).toBeTypeOf('function');
			await expect(lookup?.(NEWER)).resolves.toBe('ahead');
			expect(get.mock.calls[0][0]).toBe(
				`https://api.github.com/repos/${REPO}/compare/${HEAD}...${NEWER}`
			);
		});

		test.each([
			['a dispatch', { ...CHAINED, GITHUB_EVENT_NAME: 'workflow_dispatch' }],
			['a push', { ...CHAINED, GITHUB_EVENT_NAME: 'push' }],
			['a local run (no event)', { GITHUB_REPOSITORY: REPO, GITHUB_TOKEN: TOKEN }],
			['a missing token', { ...CHAINED, GITHUB_TOKEN: undefined }],
			['an empty token', { ...CHAINED, GITHUB_TOKEN: '' }],
			['a missing repository', { ...CHAINED, GITHUB_REPOSITORY: undefined }],
			['an empty env', {}]
		])('%s gets no lookup', (_name, env) => {
			expect(supersededLookup(env, HEAD, answers('ahead'))).toBeNull();
		});

		test('a chained run is superseded by a newer SHA; a dispatch of the same state times out', async () => {
			const api = answers('ahead');
			const chained = supersededLookup(CHAINED, HEAD, api) ?? undefined;
			await expect(
				waitForVersion(BASE, HEAD, { get: serves(NEWER), compare: chained, ...SLOW })
			).resolves.toBe('superseded');

			const dispatchApi = answers('ahead');
			const dispatch =
				supersededLookup(
					{ ...CHAINED, GITHUB_EVENT_NAME: 'workflow_dispatch' },
					HEAD,
					dispatchApi
				) ?? undefined;
			await expect(
				waitForVersion(BASE, HEAD, { get: serves(NEWER), compare: dispatch, ...FAST })
			).resolves.toBe('timeout');
			expect(dispatchApi).not.toHaveBeenCalled();
		});
	});

	describe('checkSuperseded (after a failed suite)', () => {
		const ahead = () => vi.fn().mockResolvedValue('ahead');

		test('a newer SHA that compares ahead is returned, after exactly one read', async () => {
			const get = serves(NEWER);
			await expect(checkSuperseded(BASE, HEAD, { get, compare: ahead() })).resolves.toBe(NEWER);
			expect(get).toHaveBeenCalledTimes(1);
			expect(get.mock.calls[0][0]).toMatch(/_app\/version\.json\?_=\S+/);
		});

		test('the expected SHA still served is not superseded, and the lookup is not asked', async () => {
			const compare = ahead();
			await expect(checkSuperseded(BASE, HEAD, { get: serves(HEAD), compare })).resolves.toBeNull();
			expect(compare).not.toHaveBeenCalled();
		});

		test.each([
			['behind', serves(OLDER), vi.fn().mockResolvedValue('behind')],
			['diverged', serves(NEWER), vi.fn().mockResolvedValue('diverged')],
			['a failed lookup', serves(NEWER), vi.fn().mockResolvedValue(null)],
			['a rejected lookup', serves(NEWER), vi.fn().mockRejectedValue(new Error('x'))],
			['a non-hex version', serves('v2'), ahead()],
			['a non-200 read', vi.fn().mockResolvedValue({ status: 429, body: '' }), ahead()],
			['a failed read', vi.fn().mockRejectedValue(new Error('ECONNRESET')), ahead()],
			[
				'a body that is not JSON',
				vi.fn().mockResolvedValue({ status: 200, body: '<html>' }),
				ahead()
			]
		])('%s is not superseded', async (_name, get, compare) => {
			await expect(checkSuperseded(BASE, HEAD, { get, compare })).resolves.toBeNull();
		});

		test('without a lookup nothing is superseded', async () => {
			await expect(checkSuperseded(BASE, HEAD, { get: serves(NEWER) })).resolves.toBeNull();
		});
	});

	describe('remote() source pins', () => {
		const source = readFileSync(join(import.meta.dirname, 'smoke.mjs'), 'utf8').replace(
			/\r\n/g,
			'\n'
		);
		const TOKEN_DROP = 'delete env.GITHUB_TOKEN;';
		const RECHECK = 'await checkSuperseded(';
		/** What is wrong with the superseded handling in remote(); empty when it is wired. */
		const problems = (src: string) => {
			const body = src.slice(
				src.indexOf('async function remote('),
				src.indexOf('async function local(')
			);
			const out = [
				'superseded by',
				'::notice::',
				'supersededLookup(process.env',
				"=== 'superseded'",
				TOKEN_DROP,
				RECHECK
			]
				.filter((n) => !body.includes(n))
				.map((n) => `missing ${n}`);
			const run = body.indexOf('runPlaywright(passthrough, env)');
			if (run === -1 || body.indexOf(TOKEN_DROP) > run) {
				out.push('Playwright is not given the env copy without the token');
			}
			if (body.indexOf(RECHECK) > body.indexOf('classifySuiteExit(')) {
				out.push('the superseded recheck comes after classifySuiteExit');
			}
			return out;
		};

		test('remote() looks up, rechecks before classifySuiteExit and drops the token', () => {
			expect(source).toContain('async function remote(');
			expect(problems(source)).toEqual([]);
		});

		test('non-vacuity: a remote() without the notice text is reported', () => {
			expect(problems(source.replaceAll('superseded by', 'replaced by'))).toEqual([
				'missing superseded by'
			]);
		});

		test('non-vacuity: a remote() that keeps the token in the Playwright env is reported', () => {
			expect(problems(source.replace(TOKEN_DROP, ''))).toEqual([`missing ${TOKEN_DROP}`]);
			expect(
				problems(
					source.replace(
						'= runPlaywright(passthrough, env)',
						'= runPlaywright(passthrough, process.env)'
					)
				)
			).toEqual(['Playwright is not given the env copy without the token']);
		});

		test('non-vacuity: a remote() without the recheck, or with it after the exit mapping, is reported', () => {
			expect(problems(source.replace(RECHECK, 'await never('))).toEqual([`missing ${RECHECK}`]);
			const late = source
				.replace(RECHECK, 'await never(')
				.replace('return code;', `return code; ${RECHECK}`);
			expect(problems(late)).toEqual(['the superseded recheck comes after classifySuiteExit']);
		});
	});
});

describe('classifySuiteExit (429 relabel)', () => {
	test('a failed suite with 429 responses is exit 2 (CDN rate-limited)', () => {
		expect(classifySuiteExit(1, 3)).toBe(2);
	});
	test('a failed suite without 429 evidence keeps exit 1 (a 500 or an assertion)', () => {
		expect(classifySuiteExit(1, 0)).toBe(1);
	});
	test('a green run is never relabelled, even with 429 evidence', () => {
		expect(classifySuiteExit(0, 0)).toBe(0);
		expect(classifySuiteExit(0, 5)).toBe(0);
		expect(classifySuiteExit(0, 3)).toBe(0);
	});
	test('any non-zero status with 429 evidence is 2', () => {
		expect(classifySuiteExit(4, 2)).toBe(2);
	});
	test('a single 429 is enough, so the comparison is not a larger threshold', () => {
		expect(classifySuiteExit(1, 1)).toBe(2);
	});
});

describe('countRateLimited', () => {
	test('counts non-empty evidence lines; empty or undefined is 0', () => {
		expect(countRateLimited(undefined)).toBe(0);
		expect(countRateLimited('')).toBe(0);
		expect(countRateLimited('https://a/\n\nhttps://b/\n')).toBe(2);
	});
});

describe('429 evidence fixture pin', () => {
	const read = (rel: string) =>
		readFileSync(join(import.meta.dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
	const FIXTURES = 'apps/web/tests/smoke/fixtures.ts';
	// The context listener (navigations, sub-resources, the worker's install fetches), the `request`
	// fixture wrapper (API-context traffic, which the listener never sees) and the fast install failure.
	const LISTENER = 'if (response.status() === 429) appendFileSync(log, response.url()';
	const WRAPPER = 'request: async ({ request }, use) =>';
	const INSTALL = 'HTTP 429 during the service worker install';
	/** What is wrong with the fixture's 429 evidence; empty when every source is recorded. */
	const problems = (src: string) => {
		const out = ['SMOKE_429_LOG', WRAPPER, INSTALL]
			.filter((n) => !src.includes(n))
			.map((n) => `missing ${n}`);
		// Once in the listener and once in the wrapper.
		if (src.split(LISTENER).length - 1 !== 2) out.push('a 429 observer is missing or restricted');
		if (/isNavigationRequest|serviceWorker\(\)/.test(src)) out.push('429 limited to one source');
		return out;
	};
	/** API-context calls that bypass the wrapped `request` fixture. */
	const BYPASS = /\b(page|context)\.request\b|\bnewContext\(/;

	test('fixtures.ts records every 429 to SMOKE_429_LOG, whatever its source', () => {
		expect(problems(read(FIXTURES))).toEqual([]);
	});
	test('non-vacuity: the pin reports a fixture without the env var', () => {
		const src = read(FIXTURES).replaceAll('SMOKE_429_LOG', 'X');
		expect(problems(src)).toEqual(['missing SMOKE_429_LOG']);
	});
	test('non-vacuity: a navigation-only listener is reported (the worker install would go unlogged)', () => {
		const src = read(FIXTURES).replace(
			LISTENER,
			'if (response.status() === 429 && response.request().isNavigationRequest()) appendFileSync(log, response.url()'
		);
		expect(problems(src)).toEqual([
			'a 429 observer is missing or restricted',
			'429 limited to one source'
		]);
	});
	test('non-vacuity: a fixture without the request wrapper or the install check is reported', () => {
		const src = read(FIXTURES).replace(WRAPPER, 'x: async () =>').replace(INSTALL, 'HTTP 429');
		expect(problems(src)).toEqual([`missing ${WRAPPER}`, `missing ${INSTALL}`]);
	});
	test('no smoke spec makes API-context requests around the wrapped request fixture', () => {
		const dir = join(import.meta.dirname, '..', 'apps/web/tests/smoke');
		const specs = readdirSync(dir).filter((f) => f.endsWith('.smoke.ts'));
		expect(specs.length).toBe(9); // non-vacuity
		expect(specs.filter((f) => BYPASS.test(read(`apps/web/tests/smoke/${f}`)))).toEqual([]);
		expect(BYPASS.test("await page.request.get('x')")).toBe(true);
		expect(BYPASS.test('await playwright.request.newContext()')).toBe(true);
	});
});

describe('SMOKE-07 volume pins: live third-party sample and page-free seo spec', () => {
	const read = (rel: string) =>
		readFileSync(join(import.meta.dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
	// A route group added to routes.ts later is not enforced until it is added to this list.
	const GROUPS: Record<string, readonly string[]> = {
		TOOL_ROUTES,
		MARKETING_ROUTES,
		LEGAL_ROUTES,
		RENTER_ROUTES,
		APP_ROUTES,
		INVESTOR_ROUTES,
		AGENT_ROUTES,
		STUDIO_ROUTES,
		PUBLIC_ROUTES,
		PRINT_ROUTES
	};
	/** What the third-party spec must reference; returns the missing needles. */
	const missing = (src: string) =>
		['LIVE_THIRD_PARTY_SAMPLE', 'SMOKE_ALLOW_HTTP'].filter((n) => !src.includes(n));

	test('the sample is nine distinct routes, all members of ROUTES', () => {
		expect(new Set(LIVE_THIRD_PARTY_SAMPLE).size).toBe(9);
		expect(LIVE_THIRD_PARTY_SAMPLE).toHaveLength(9);
		expect(LIVE_THIRD_PARTY_SAMPLE.filter((r) => !ROUTES.includes(r))).toEqual([]);
	});

	test('the sample holds at least one route of every route group', () => {
		const uncovered = Object.entries(GROUPS)
			.filter(([, group]) => !group.some((r) => LIVE_THIRD_PARTY_SAMPLE.includes(r)))
			.map(([name]) => name);
		expect(uncovered).toEqual([]);
	});

	test('third-party.smoke.ts picks the sample or all routes by SMOKE_ALLOW_HTTP', () => {
		expect(missing(read('apps/web/tests/smoke/third-party.smoke.ts'))).toEqual([]);
	});

	test('non-vacuity: the pin reports a spec without the sample', () => {
		const src = read('apps/web/tests/smoke/third-party.smoke.ts').replaceAll(
			'LIVE_THIRD_PARTY_SAMPLE',
			'ROUTES'
		);
		expect(missing(src)).toEqual(['LIVE_THIRD_PARTY_SAMPLE']);
	});

	test('seo.smoke.ts makes no page loads', () => {
		expect(read('apps/web/tests/smoke/seo.smoke.ts')).not.toMatch(/page\.(goto|locator|request)/);
	});
});

describe('service worker is blocked outside the one worker spec (live CDN request volume)', () => {
	const root = join(import.meta.dirname, '..');
	const read = (rel: string) => readFileSync(join(root, rel), 'utf8').replace(/\r\n/g, '\n');
	const stripComments = (src: string) => src.replace(/\/\/.*$/gm, '');
	/** Violations of the contract in a config text. */
	const configProblems = (cfg: string) => {
		const code = stripComments(cfg);
		const out: string[] = [];
		if (!code.includes("serviceWorkers: 'block'")) out.push("missing serviceWorkers: 'block'");
		if (!/retries: 0\b/.test(code)) out.push('retries is not 0');
		return out;
	};
	const CONFIG = 'apps/web/playwright.smoke.config.ts';
	const WORKER_SPECS = ['pwa.smoke.ts'];
	/** Violations of the single-install contract in the worker spec's text. */
	const installProblems = (spec: string) => {
		const code = stripComments(spec);
		const out: string[] = [];
		const installs = code.split('installedPrecache(').length - 1;
		if (installs !== 1) out.push(`installedPrecache is called ${installs} times`);
		if (/request\.get\(u\)|CHUNK/.test(code)) out.push('per-hash GET loop');
		return out;
	};

	test("the suite default is serviceWorkers 'block' with retries still 0", () => {
		expect(configProblems(read(CONFIG))).toEqual([]);
	});

	test('non-vacuity: the check reports a config without the block line', () => {
		const cfg = read(CONFIG).replace("serviceWorkers: 'block',", '');
		expect(configProblems(cfg)).toEqual(["missing serviceWorkers: 'block'"]);
	});

	test('pwa.smoke.ts installs the worker exactly once and has no per-hash GET loop', () => {
		expect(installProblems(read('apps/web/tests/smoke/pwa.smoke.ts'))).toEqual([]);
	});

	test('non-vacuity: the check reports a second install and a per-hash loop', () => {
		const spec = read('apps/web/tests/smoke/pwa.smoke.ts');
		expect(installProblems(spec + '\nawait installedPrecache(page);\nrequest.get(u);')).toEqual([
			'installedPrecache is called 2 times',
			'per-hash GET loop'
		]);
	});

	test("the worker spec opts back in with serviceWorkers 'allow'", () => {
		for (const f of WORKER_SPECS) {
			expect(read(`apps/web/tests/smoke/${f}`), f).toContain("serviceWorkers: 'allow'");
		}
	});

	test('no other smoke spec installs the worker through installedPrecache', () => {
		const dir = join(root, 'apps/web/tests/smoke');
		const users = readdirSync(dir)
			.filter((f) => f.endsWith('.smoke.ts'))
			.filter((f) =>
				stripComments(read(`apps/web/tests/smoke/${f}`)).includes('installedPrecache')
			);
		expect(users.sort()).toEqual([...WORKER_SPECS].sort());
	});
});
