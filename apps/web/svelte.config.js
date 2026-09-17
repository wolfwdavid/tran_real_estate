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
		prerender: { handleHttpError: 'fail', handleMissingId: 'fail', handleUnseenRoutes: 'fail' },
		csp: {
			mode: 'hash',
			directives: {
				'default-src': ['self'],
				'script-src': ['self'],
				'style-src': ['self'],
				'style-src-attr': ['unsafe-inline'],
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
