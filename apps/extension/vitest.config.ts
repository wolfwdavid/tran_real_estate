import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';
import { resolveSiteOrigin } from '../web/src/lib/site-config.js';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
	plugins: [WxtVitest({ root })],
	define: { __TRAN_ORIGIN__: JSON.stringify(resolveSiteOrigin()) },
	test: {
		name: 'extension',
		environment: 'happy-dom',
		include: ['tests/**/*.test.ts'],
		exclude: ['tests/browser/**', 'e2e/**', '**/node_modules/**'],
		setupFiles: ['../../tooling/vitest/no-network.ts', './tests/setup-no-network.ts'],
		environmentOptions: {
			happyDOM: {
				settings: {
					disableJavaScriptFileLoading: true,
					disableJavaScriptEvaluation: true,
					disableCSSFileLoading: true,
					navigation: {
						disableMainFrameNavigation: true,
						disableChildFrameNavigation: true,
						disableChildPageNavigation: true
					}
				}
			}
		}
	}
});
