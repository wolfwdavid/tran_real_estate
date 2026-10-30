// Static guard over apps/web/src/service-worker.ts. The worker runs on an origin that holds
// provider keys, so its shape is pinned here: it may only answer same-origin GETs for files in
// the build's own precache list, and it may never write to a cache at runtime, take over open
// pages early, or load code from anywhere. The svelte.config.js dotfile filter is checked by
// importing the real config and calling it.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SW_PATH = join(REPO_ROOT, 'apps', 'web', 'src', 'service-worker.ts');

const REQUIRED = [
	"from '$service-worker'",
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

describe('service-worker.ts shape', () => {
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

	test('non-vacuity: dropping the cross-origin early return is caught', () => {
		const planted = readSw().replace('url.origin !== sw.location.origin', 'false');
		expect(guardFaults(planted)).toContain('missing url.origin !== sw.location.origin');
	});
});

describe('svelte.config.js serviceWorker.files dotfile filter', () => {
	test('excludes dotfiles anywhere in the path and keeps real assets', async () => {
		const { default: config } = await import('../apps/web/svelte.config.js');
		const files = config.kit?.serviceWorker?.files;
		expect(typeof files).toBe('function');
		for (const f of ['.nojekyll', 'sub/.hidden', '.well-known/x', 'sub\\.hidden']) {
			expect(files!(f), f).toBe(false);
		}
		for (const f of ['frame-guard.js', 'icons/icon-192.png', 'manifest.webmanifest']) {
			expect(files!(f), f).toBe(true);
		}
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
