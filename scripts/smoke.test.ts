// scripts/smoke.mjs: target table, build-stamp reads, the stale-build gate and the version poll.
// Importing the module must never run its CLI (it would start serve-pages or spawn Playwright).
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, test, vi } from 'vitest';
import { resolveSiteOrigin } from '../apps/web/src/lib/site-config.js';
import { targetEnv } from './lib/build-targets.mjs';
import { localTargets, readStamp, staleBuilds, waitForVersion } from './smoke.mjs';

const HEAD = 'b'.repeat(40);

describe('localTargets', () => {
	test('defaults: root, sub, configured in order on the emulator ports', () => {
		expect(localTargets({})).toEqual([
			{
				name: 'root',
				baseUrl: 'http://127.0.0.1:4273/',
				siteUrl: 'https://tranrealestate.github.io/',
				analyticsHost: '',
				dir: 'apps/web/build'
			},
			{
				name: 'sub',
				baseUrl: 'http://127.0.0.1:4274/tran_real_estate/',
				siteUrl: 'https://tranrealestate.github.io/tran_real_estate/',
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
	const BASE = 'https://tranrealestate.github.io/';

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
			/^https:\/\/tranrealestate\.github\.io\/_app\/version\.json\?_=\S+/
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
