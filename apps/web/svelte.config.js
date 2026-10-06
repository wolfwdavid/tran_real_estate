import adapter from '@sveltejs/adapter-static';
import { resolveBasePath, resolveBuildDir } from './src/lib/base-path.js';

const base = resolveBasePath();
const out = resolveBuildDir();

/** @type {import('@sveltejs/kit').Config} */
export default {
	kit: {
		adapter: adapter({
			pages: out,
			assets: out,
			fallback: '404.html',
			precompress: false,
			strict: true
		}),
		paths: { base },
		// cache.addAll() in the service worker is all-or-nothing, and $service-worker `files`
		// included /.nojekyll, which GitHub Pages never serves. Keep every dotfile out of the precache.
		serviceWorker: { files: (filepath) => !/(^|[\\/])\./.test(filepath) },
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
				'/print/memo/'
			],
			handleHttpError: 'fail',
			handleMissingId: 'fail',
			handleUnseenRoutes: 'fail'
		},
		csp: {
			mode: 'hash',
			directives: {
				'default-src': ['self'],
				'script-src': ['self'],
				'style-src': ['self'],
				'style-src-attr': ['unsafe-inline'],
				// Map tiles (Phase 6) plus same-origin blob object URLs for agent logos (Phase 8).
				// Never the data scheme, never a./b./c. tile subdomains.
				'img-src': ['self', 'https://tile.openstreetmap.org', 'blob:'],
				'connect-src': [
					'self',
					'https://api.rentcast.io',
					'https://api.anthropic.com',
					'https://api.openai.com',
					'https://generativelanguage.googleapis.com',
					'https://openrouter.ai',
					'https://api.web3forms.com'
				],
				'object-src': ['none'],
				'base-uri': ['self'],
				'form-action': ['self', 'https://api.web3forms.com']
			}
		}
	}
};
