/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

// Allowlist-only, cache-first app shell. This origin holds provider keys, so the worker is
// deliberately narrower than Kit's docs example in three ways:
//   1. It never answers a request that is cross-origin, not a GET, or outside the build's own
//      precache list. Provider calls (and the keys they carry) go straight to the network,
//      unknown paths still reach the server and get a real 404, and Playwright page.route()
//      mocks of provider hosts keep intercepting.
//   2. It never caches at runtime. The only writes are the install-time precache, so API
//      responses can never land in Cache Storage outside Phase 4's budgeted IndexedDB cache.
//   3. No early activation (no skip-waiting, no claiming of open clients). An open page lazy-loads hashed chunks from its own
//      version; activating a new worker under it would delete those chunks from the cache after
//      GitHub Pages has already deleted them from the server. A new version takes over once
//      every Tran tab is closed.
import { assets, immutable, prerendered } from '$app/manifest';
import { version } from '$app/env';
import { asset, resolve } from '$app/paths';
import { precacheFiles } from '../lib/precache-filter.ts';

const sw = self as unknown as ServiceWorkerGlobalScope;
const CACHE = `tran-shell-${version}`;
// Base-prefixed absolute paths, so the fetch guard below compares like with like. Kit 3's `assets`
// lists every file under static/ (dotfiles included), hence the in-worker filter.
// Manifest paths are base-relative pathnames ('/' for the root page), which resolve() accepts at runtime;
// its types only admit route IDs and the non-root pathnames, hence the widened signature.
const toUrl = resolve as (path: string) => string;
const ASSETS = new Set([
	...immutable.map((e) => toUrl(e.path)),
	...precacheFiles(assets).map((p) => asset(p)),
	...prerendered.map((e) => toUrl(e.path))
]);

sw.addEventListener('install', (event) => {
	event.waitUntil(caches.open(CACHE).then((c) => c.addAll([...ASSETS])));
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(
					keys
						.filter((k) => k.startsWith('tran-shell-') && k !== CACHE)
						.map((k) => caches.delete(k))
				)
			)
	);
});

sw.addEventListener('fetch', (event) => {
	const req = event.request;
	if (req.method !== 'GET') return; // never POSTs (AI providers, Web3Forms)
	const url = new URL(req.url);
	if (url.origin !== sw.location.origin) return; // never provider hosts or key-bearing requests
	if (!ASSETS.has(url.pathname)) return; // unknown paths go to the network: real 404s stay 404s
	event.respondWith(
		caches.open(CACHE).then(async (c) => (await c.match(url.pathname)) ?? fetch(req))
	);
});
