import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
	plugins: [WxtVitest({ root })],
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
