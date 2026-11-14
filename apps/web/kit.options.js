// SvelteKit 3 reads its options from the sveltekit() plugin call in vite.config.ts, not from
// svelte.config.js. They live here, in a module with no runtime import of Kit's Vite plugin, so
// unit tests and scripts can read the same object the build uses.
import { spawnSync } from 'node:child_process';
import adapter from '@sveltejs/adapter-static';
import { resolveBasePath, resolveBuildDir } from './src/lib/base-path.js';
import { buildCsp } from './src/lib/csp-policy.js';
import { resolveBuildStamp } from './src/lib/build-stamp.js';
import { resolveAnalytics, resolveSiteOrigin } from './src/lib/site-config.js';

const base = /** @type {'' | `/${string}`} */ (resolveBasePath());
const out = resolveBuildDir();
const readHead = () =>
	(spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout ?? '').trim();

/** @type {import('@sveltejs/kit/vite').Config} */
export default {
	adapter: adapter({
		pages: out,
		assets: out,
		fallback: '404.html',
		precompress: false,
		strict: true
	}),
	// Absolute og:image/og:url/canonical links on the site origin are crawled like relative ones,
	// so a missing share card fails the build (10-RESEARCH Pattern 3).
	paths: { base, origin: resolveSiteOrigin() },
	// LIVE-04: /_app/version.json and the service-worker cache key carry the commit SHA.
	version: { name: resolveBuildStamp(process.env, readHead) },
	// /renter/listing/ is reached only through client-rendered links (?id= in onMount), so the
	// crawler never sees it; list it explicitly so handleUnseenRoutes stays 'fail'. The same
	// holds for the investor query-param routes (?ids=, ?id=, ?zip=) and the memo printout.
	prerender: {
		entries: [
			'*',
			'/renter/listing/',
			'/investor/compare/',
			'/investor/memo/',
			'/investor/market/',
			'/print/memo/',
			// The agent contact detail (?id=) is linked only from client-rendered lists.
			'/agent/contact/',
			// The public inquiry page is reached only through shared links.
			'/agent/inquire/',
			// The Studio hub and the snapshot printout (Phase 9) are also linked by static anchors
			// (AgentNav Studio, the hub's "Preview a sample report"); listed so the crawler reaches
			// them however later plans render those links (09-UI-SPEC Planner Note 11).
			'/agent/studio/',
			'/print/snapshot/',
			// The guided key setup (10-16) is linked only from the guide's client-rendered tour step;
			// Settings links it statically from 10-18 on.
			'/setup/rentcast/'
		],
		handleHttpError: 'fail',
		handleMissingId: 'fail',
		handleUnseenRoutes: 'fail'
	},
	// Policy literal lives in src/lib/csp-policy.js; scripts/assert-csp.mjs keeps an independent
	// literal copy — change both in one commit.
	csp: /** @type {import('@sveltejs/kit/vite').Config['csp']} */ (
		buildCsp({ analyticsHost: resolveAnalytics().host })
	)
};
