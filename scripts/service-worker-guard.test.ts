// Static guard over apps/web/src/service-worker/index.ts. The worker runs on an origin that holds
// provider keys, so its shape is pinned here: it may only answer same-origin GETs for files in
// the build's own precache list, and it may never write to a cache at runtime, take over open
// pages early, or load code from anywhere. The precache dotfile filter is checked by
// calling apps/web/src/lib/precache-filter.ts, the pure filter the worker applies.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { isPrecacheable, precacheFiles } from '../apps/web/src/lib/precache-filter';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SW_PATH = join(REPO_ROOT, 'apps', 'web', 'src', 'service-worker', 'index.ts');

const REQUIRED = [
	"from '$app/manifest'",
	"from '$app/env'",
	"req.method !== 'GET'",
	'url.origin !== sw.location.origin',
	'!ASSETS.has(url.pathname)',
	'tran-shell-'
];

const FORBIDDEN = [
	'cache.put',
	'.put(',
	'skipWaiting',
	'clients.claim',
	'navigationPreload',
	'importScripts',
	'$app/service-worker',
	'$service-worker',
	'http://',
	'https://'
];

/** Returns one string per violated rule; [] when the source has the required shape. */
function guardFaults(source: string): string[] {
	const faults: string[] = [];
	for (const s of REQUIRED) if (!source.includes(s)) faults.push(`missing ${s}`);
	for (const s of FORBIDDEN) if (source.includes(s)) faults.push(`forbidden ${s}`);
	return faults;
}

const readSw = () => (existsSync(SW_PATH) ? readFileSync(SW_PATH, 'utf8') : '');

describe('service-worker/index.ts shape', () => {
	test('the worker source exists', () => {
		expect(existsSync(SW_PATH)).toBe(true);
	});

	test('the worker is allowlist-only, same-origin GET, with no runtime caching', () => {
		expect(guardFaults(readSw())).toEqual([]);
	});

	test('non-vacuity: a planted runtime cache write is caught', () => {
		const planted = `${readSw()}\nconst cache = await caches.open('x'); cache.put(req, res);\n`;
		const faults = guardFaults(planted);
		expect(faults).toContain('forbidden cache.put');
		expect(faults).toContain('forbidden .put(');
	});

	test('non-vacuity: the retired $service-worker import and a dropped manifest import are caught', () => {
		const retired = readSw().replace("from '$app/manifest'", "from '$service-worker'");
		expect(guardFaults(retired)).toEqual(
			expect.arrayContaining(["missing from '$app/manifest'", 'forbidden $service-worker'])
		);
	});

	test('non-vacuity: dropping the cross-origin early return is caught', () => {
		const planted = readSw().replace('url.origin !== sw.location.origin', 'false');
		expect(guardFaults(planted)).toContain('missing url.origin !== sw.location.origin');
	});
});

describe('precache dotfile filter (precache-filter)', () => {
	test('excludes dotfiles anywhere in the path and keeps real assets', () => {
		for (const f of ['.nojekyll', 'sub/.hidden', '.well-known/x', 'sub\\.hidden']) {
			expect(isPrecacheable(f), f).toBe(false);
		}
		for (const f of ['frame-guard.js', 'icons/icon-192.png', 'manifest.webmanifest']) {
			expect(isPrecacheable(f), f).toBe(true);
		}
	});

	test('a Kit 3 manifest assets list drops .nojekyll and .well-known, keeps real files', () => {
		const assets = [
			{ path: '.nojekyll' },
			{ path: 'manifest.webmanifest' },
			{ path: 'icons/icon-192.png' },
			{ path: '.well-known/x' }
		];
		expect(precacheFiles(assets)).toEqual(['manifest.webmanifest', 'icons/icon-192.png']);
	});

	test('the worker builds its precache through precacheFiles', () => {
		expect(readSw()).toContain('precacheFiles(assets)');
	});
});

describe('OSM tiles are never handled (no offline use, OSM tile policy)', () => {
	const TILE = 'https://tile.openstreetmap.org/3/1/2.png';

	test('the cross-origin early return is still present, so tile requests fall through', () => {
		// Runs before any respondWith: every cross-origin request (tile.openstreetmap.org included)
		// is ignored by the worker and goes straight to the network, never into a cache.
		const sw = readSw();
		expect(sw).toContain('url.origin !== sw.location.origin');
		expect(sw.indexOf('url.origin !== sw.location.origin')).toBeLessThan(sw.indexOf('respondWith'));
	});

	test('the worker names no tile host and no absolute URL', () => {
		const sw = readSw();
		expect(sw).not.toMatch(/openstreetmap/i);
		expect(sw).not.toContain('https://');
	});

	test.each(['https://wolfwdavid.github.io', 'http://127.0.0.1:4273'])(
		'tile.openstreetmap.org is cross-origin to %s',
		(origin) => {
			expect(new URL(TILE).origin).not.toBe(new URL(origin).origin);
		}
	);

	test('non-vacuity: a planted tile cache rule is caught', () => {
		const planted = `${readSw()}\nif (url.hostname === 'tile.openstreetmap.org') cache.put(req, res);\n`;
		expect(planted).toMatch(/openstreetmap/i);
		expect(guardFaults(planted)).toContain('forbidden .put(');
	});
});
