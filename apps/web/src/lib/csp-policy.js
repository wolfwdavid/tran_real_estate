// The site's Content-Security-Policy, as a SvelteKit `kit.csp` config (10-RESEARCH Pattern 11).
//
// scripts/assert-csp.mjs keeps an independent literal copy of this policy: any change here must
// land in the same commit as the matching oracle change (a reviewed two-file diff).
// The only build-time variable is the optional first-party analytics origin, which joins
// connect-src and nothing else. With no host the policy is exactly the pre-Phase-10 one.

/**
 * @param {{ analyticsHost?: string }} [o]
 */
export function buildCsp({ analyticsHost = '' } = {}) {
	const connect = [
		'self',
		'https://api.rentcast.io',
		'https://api.anthropic.com',
		'https://api.openai.com',
		'https://generativelanguage.googleapis.com',
		'https://openrouter.ai',
		'https://api.web3forms.com'
	];
	return {
		mode: /** @type {'hash'} */ ('hash'),
		directives: {
			'default-src': ['self'],
			'script-src': ['self'],
			'style-src': ['self'],
			'style-src-attr': ['unsafe-inline'],
			// Map tiles (Phase 6) plus same-origin blob object URLs for agent logos (Phase 8).
			// Never the data scheme, never a./b./c. tile subdomains.
			'img-src': ['self', 'https://tile.openstreetmap.org', 'blob:'],
			'connect-src': analyticsHost ? [...connect, analyticsHost] : connect,
			'object-src': ['none'],
			'base-uri': ['self'],
			'form-action': ['self', 'https://api.web3forms.com']
		}
	};
}
