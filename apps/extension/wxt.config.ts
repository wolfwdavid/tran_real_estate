import { defineConfig } from 'wxt';
import { COPY } from './src/lib/copy';
import { ZILLOW_MATCH } from './src/lib/config';
import { resolveSiteUrl } from '../web/src/lib/site-config.js';

export const POPUP_CSP =
	"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

export default defineConfig({
	srcDir: 'src',
	modules: ['@wxt-dev/module-svelte'],
	imports: false,
	manifest: ({ mode }) => ({
		name: COPY.name,
		short_name: COPY.shortName,
		description: COPY.description,
		permissions: ['storage'],
		host_permissions: [ZILLOW_MATCH],
		icons: { 16: 'icon/16.png', 32: 'icon/32.png', 48: 'icon/48.png', 128: 'icon/128.png' },
		action: {
			default_title: COPY.actionTitle,
			default_icon: { 16: 'icon/16.png', 32: 'icon/32.png' }
		},
		...(mode === 'production' ? { content_security_policy: { extension_pages: POPUP_CSP } } : {})
	}),
	zip: {
		artifactTemplate: 'sponsored-listing-filter-{{packageVersion}}-{{browser}}{{modeSuffix}}.zip'
	},
	// modulePreload.polyfill: Vite otherwise injects a `fetch(link.href)` polyfill for
	// <link rel=modulepreload> into the popup chunk. MV3 Chrome preloads natively, and the popup
	// CSP is connect-src 'none' anyway; dropping it keeps the bundle free of network primitives.
	// __TRAN_SITE_URL__ (src/lib/site.ts): PUBLIC_SITE_URL + BASE_PATH through the web app's
	// resolveSiteUrl(), resolved here on the Node side so the validators are never bundled; a
	// malformed value fails the build by name. The web define, this define and the oracle allowlist
	// share the helper, so the privacy link cannot miss the live project site's base path (D-04).
	vite: () => ({
		define: { __TRAN_SITE_URL__: JSON.stringify(resolveSiteUrl()) },
		build: { assetsInlineLimit: 0, modulePreload: { polyfill: false } }
	})
});
